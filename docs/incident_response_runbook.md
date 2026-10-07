# Incident Response Runbook (IR-001)

## Severity Levels

| Severity | Definition | Response SLA | Action Trigger |
| :--- | :--- | :--- | :--- |
| **SEV-1 (CRITICAL)** | Live funds at risk, RPC exploit, circuit breaker tripped, unauthorized order execution. | < 5 minutes | Immediate Kill Switch activation; cancel all open orders; emergency flatten. |
| **SEV-2 (HIGH)** | Data feed stale (>4000ms), single venue disconnect, execution slippage >50 bps. | < 15 minutes | Halt quoting on affected venue; route to fallback venues; trigger alert. |
| **SEV-3 (MEDIUM)** | Webhook delivery failure, non-critical latency degradation, reporting mismatch. | < 1 hour | Log diagnostic dump; restart worker container if needed. |
| **SEV-4 (LOW)** | Minor UI discrepancy, non-impacting telemetry lag. | Next release | Ticket logged; routine maintenance. |

---

## Triage Procedure for SEV-1 (Emergency)

1. **Activate Global Kill Switch**:
   - Web Dashboard: Click the glowing red **"EMERGENCY KILL SWITCH"** button in the header bar.
   - API / CLI: `POST /api/kill-switch` with payload `{"active": true}`.
   - Server Shell: `npm run test` or CLI: `kill-switch on`.
2. **Verify Position Liquidation**:
   - Check `GET /api/positions` to confirm positions are closed or market impact mitigated.
3. **Notify Core Team & Stakeholders**:
   - Check Telegram Alert stream for automated incident dispatch.
4. **Isolate Root Cause**:
   - Inspect `/app/logs/` or Docker container logs: `docker compose logs -f applet`.
   - Verify RPC node endpoints (Solana, Polygon, Binance).
5. **Post-Mortem & Remediation**:
   - Complete Post-Mortem within 24 hours of incident resolution.
