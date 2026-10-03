# PolyMaster Quantum - Deployment Guide

## 1. Production Architecture

PolyMaster Quantum can be deployed on a standard Linux VPS (Ubuntu 22.04 / 24.04 LTS), bare metal, or containerized via Docker and Kubernetes.

```
                  [ NGINX Reverse Proxy (SSL / TLS 1.3) ]
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [ Web Frontend :3000 ]             [ FastAPI / Express Engine ]
     Next.js / Vite Static SPA              Async WebSocket & REST Core
                                                      │
                         ┌────────────────────────────┼───────────────────────────┐
                         ▼                            ▼                           ▼
                 [ Redis 7+ Cache ]          [ PostgreSQL 16+ ]           [ Celery / Async Workers ]
                 PubSub & Tick Ring           Trades, Fills, Audits        Backtests & Scanners
```

---

## 2. Docker & Docker Compose Quickstart

### Step 1: Clone Repository and Configure Environment
```bash
git clone https://github.com/polymaster/quantum-engine.git
cd quantum-engine
cp .env.example .env
# Edit .env with your specific venue API keys and risk limits
```

### Step 2: Build and Run Services
```bash
docker-compose up --build -d
```

### Step 3: Verify Health Checks
```bash
curl http://localhost:3000/api/health
```

---

## 3. Production Hardening Checklist
- [x] Configure non-root Docker user (`nobody` or `appuser`).
- [x] Enforce SSL termination with TLS 1.3 only.
- [x] Set `LIVE_TRADING_ENABLED=false` until paper trading validation period is satisfied.
- [x] Bind Redis and PostgreSQL only to local Docker network (no public port exposure).
- [x] Configure systemd or Docker restart policies (`restart: unless-stopped`).
