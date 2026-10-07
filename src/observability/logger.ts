/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  correlationId?: string;
  data?: Record<string, any>;
  durationMs?: number;
}

const SENSITIVE_KEYS = new Set([
  'secret',
  'password',
  'privatekey',
  'private_key',
  'seedphrase',
  'seed_phrase',
  'authorization',
  'api_key',
  'apikey',
  'token',
  'bearer'
]);

function sanitizeData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeData);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lower) || lower.includes('secret') || lower.includes('token') || lower.includes('key')) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      clean[k] = sanitizeData(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export class StructuredLogger {
  private component: string;

  constructor(component: string = 'QuantumCore') {
    this.component = component;
  }

  public log(level: LogLevel, message: string, data?: Record<string, any>, correlationId?: string, durationMs?: number) {
    const entry: ILogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      correlationId: correlationId || `REQ_${Math.random().toString(36).substring(2, 9)}`,
      data: data ? sanitizeData(data) : undefined,
      durationMs
    };

    const formatted = `[${entry.timestamp}] [${entry.level}] [${entry.component}] ${entry.message}${
      entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : ''
    }${entry.data ? ` | ${JSON.stringify(entry.data)}` : ''}`;

    if (level === 'ERROR' || level === 'FATAL') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    return entry;
  }

  public info(message: string, data?: Record<string, any>, correlationId?: string) {
    return this.log('INFO', message, data, correlationId);
  }

  public warn(message: string, data?: Record<string, any>, correlationId?: string) {
    return this.log('WARN', message, data, correlationId);
  }

  public error(message: string, data?: Record<string, any>, correlationId?: string) {
    return this.log('ERROR', message, data, correlationId);
  }

  public debug(message: string, data?: Record<string, any>, correlationId?: string) {
    return this.log('DEBUG', message, data, correlationId);
  }
}

export const globalLogger = new StructuredLogger('QuantumTrader');
