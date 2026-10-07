/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { globalLogger } from './src/observability/logger';
import { globalMetrics } from './src/observability/metrics';
import { globalOrchestrator } from './src/core/orchestrator';
import { globalPortfolio } from './src/portfolio/portfolioEngine';
import { globalExecutionEngine } from './src/execution/executionEngine';
import { globalDbPool } from './src/db/dbPool';
import { globalTelegramNotifier } from './src/observability/telegramAlerts';
import { globalVenueRegistry } from './src/execution/adapters/venueRegistry';
import { globalLiveVenueFeed } from './src/data/liveVenueFeed';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Strict body parsing with size limitation to prevent memory exhaustion
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

// In-memory sliding window rate limiter for API protection
interface IRateLimitBucket {
  count: number;
  resetTime: number;
}
const rateLimitMap: Map<string, IRateLimitBucket> = new Map();

function apiRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}_${req.baseUrl || req.path}`;
    const now = Date.now();

    let bucket = rateLimitMap.get(key);
    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, bucket);
    } else {
      bucket.count++;
      if (bucket.count > maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Rate limit is ${maxRequests} requests per ${windowMs / 1000}s.`,
          retryAfterSec: Math.ceil((bucket.resetTime - now) / 1000)
        });
      }
    }
    next();
  };
}

// Security headers & Request tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || `REQ_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-Id', reqId);
  (req as any).requestId = reqId;

  // OWASP security headers compatible with iframe embedding
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      globalLogger.info(`${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`, undefined, reqId);
    }
  });

  next();
});

// -----------------------------------------------------------------------------
// HEALTH & OBSERVABILITY ENDPOINTS
// -----------------------------------------------------------------------------
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'polymaster-quantum'
  });
});

app.get('/livez', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/readyz', (_req: Request, res: Response) => {
  const status = globalOrchestrator.getStatus();
  const dbHealth = globalDbPool.getHealth();
  const isReady = dbHealth.healthy && !status.killSwitchActive;

  if (isReady) {
    res.status(200).json({
      status: 'ready',
      mode: status.mode,
      engineState: status.state,
      dbHealthy: dbHealth.healthy,
      killSwitchActive: status.killSwitchActive
    });
  } else {
    res.status(503).json({
      status: 'unready',
      reason: status.killSwitchActive ? 'KILL_SWITCH_ACTIVE' : 'DB_UNHEALTHY'
    });
  }
});

app.get('/metrics', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(globalMetrics.toPrometheusFormat());
});

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    ...globalOrchestrator.getStatus(),
    db: globalDbPool.getHealth(),
    metrics: globalMetrics.getSnapshot(),
    liveFeed: globalLiveVenueFeed.getStatus()
  });
});

app.get('/api/venues', (_req: Request, res: Response) => {
  res.json({
    venues: globalVenueRegistry.getAllStatuses(),
    liveTradingEnabled: globalExecutionEngine.isLiveMode()
  });
});

app.get('/api/portfolio', (_req: Request, res: Response) => {
  res.json(globalPortfolio.getState());
});

app.get('/api/positions', (_req: Request, res: Response) => {
  res.json(globalPortfolio.getPositions());
});

app.get('/api/orders', (_req: Request, res: Response) => {
  res.json(globalExecutionEngine.getOrders());
});

app.get('/api/audit', (_req: Request, res: Response) => {
  res.json(globalOrchestrator.runQuadrupleSafetyAudit());
});

// Trading endpoint with strict schema validation and rate limiting
app.post('/api/orders', apiRateLimiter(20, 10000), async (req: Request, res: Response) => {
  try {
    const { symbol, venue, direction, orderType, size, price, stopPrice, takeProfitPrice, clientOrderId } = req.body;
    
    // Strict Input Validation
    if (!symbol || typeof symbol !== 'string' || symbol.length > 80) {
      return res.status(400).json({ success: false, message: 'Invalid or missing symbol parameter' });
    }
    if (!venue || typeof venue !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid or missing venue parameter' });
    }
    if (direction !== 'BUY' && direction !== 'SELL') {
      return res.status(400).json({ success: false, message: 'Invalid direction parameter. Must be BUY or SELL.' });
    }
    const parsedSize = parseFloat(size);
    if (isNaN(parsedSize) || parsedSize <= 0) {
      return res.status(400).json({ success: false, message: 'Size must be a positive number' });
    }

    const result = await globalExecutionEngine.submitOrder({
      symbol: symbol.trim(),
      venue: venue as any,
      direction,
      orderType: orderType || 'MARKET',
      size: parsedSize,
      price: price ? parseFloat(price) : undefined,
      stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
      takeProfitPrice: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
      clientOrderId: clientOrderId ? String(clientOrderId).slice(0, 64) : undefined
    });

    return res.status(result.success ? 200 : 422).json(result);
  } catch (err: any) {
    globalLogger.error(`API order submission exception: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal execution processing error' });
  }
});

app.post('/api/kill-switch', (req: Request, res: Response) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Invalid payload: active must be boolean' });
  }
  globalOrchestrator.setKillSwitch(active);
  globalTelegramNotifier.sendAlert({
    level: active ? 'CRITICAL' : 'INFO',
    title: active ? 'Kill Switch Activated via API' : 'Kill Switch Deactivated via API',
    details: `Operator changed kill switch state to ${active ? 'ENGAGED' : 'NORMAL'}.`
  });
  return res.json({ success: true, killSwitchActive: active });
});

// Environment Contract Validator
function validateEnvironmentContract() {
  const mode = process.env.TRADING_MODE || 'PAPER';
  const liveEnabled = process.env.LIVE_TRADING_ENABLED === 'true';

  globalLogger.info(`[STARTUP_AUDIT] Mode: ${mode} | Live Trading Enabled: ${liveEnabled}`);

  if (isProduction && liveEnabled) {
    const statuses = globalVenueRegistry.getAllStatuses();
    const anyConfigured = statuses.some(s => s.configured);
    if (!anyConfigured) {
      globalLogger.warn('[STARTUP_WARNING] LIVE_TRADING_ENABLED=true but no venue API credentials were found in environment. Live orders will fail closed until keys are configured.');
    }
  }
}

// Bootstrap Server & Static Assets
async function bootstrapServer() {
  validateEnvironmentContract();
  await globalDbPool.initialize();

  // Start live public venue data feed
  globalLiveVenueFeed.start(10000);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    globalLogger.info('Mounted Vite HMR middlewares for development.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h', etag: true }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    globalLogger.info(`Serving static production assets from ${distPath}`);
  }

  const server = app.listen(PORT, HOST, () => {
    globalLogger.info(`PolyMaster Quantum Server active on http://${HOST}:${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    globalLogger.info(`Received ${signal}. Starting graceful shutdown...`);
    globalOrchestrator.stop();
    globalLiveVenueFeed.stop();
    server.close(() => {
      globalLogger.info('HTTP server closed. Exiting process safely.');
      process.exit(0);
    });

    setTimeout(() => {
      globalLogger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrapServer().catch((err) => {
  globalLogger.error(`Server initialization failure: ${err.message}`);
  process.exit(1);
});

export default app;
