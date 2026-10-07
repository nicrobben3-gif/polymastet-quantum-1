# Emergency Kill Switch Standard Operating Procedure (SOP-002)

## Purpose
The Emergency Kill Switch is an institutional fail-safe mechanism designed to halt all automated trading operations, cancel outstanding exchange orders, and liquidate open risk positions within milliseconds.

---

## Trigger Criteria

The Kill Switch MUST be activated immediately upon:
1. **Daily Loss Breached**: Cumulative daily loss exceeds 3.0% of portfolio equity.
2. **Drawdown Exceeded**: Drawdown from high-water mark exceeds 10.0%.
3. **Data Quality Failure**: Market tick age exceeds 4,000ms or corrupted order books detected.
4. **Exchange Disconnect**: Continuous API or WebSocket disconnection from primary execution venue (>15 seconds).
5. **Security Breach**: Unauthorized API key usage, unexpected outbound network traffic, or ledger mismatch.

---

## Activation Methods

### Method 1: Web Dashboard (Zero Latency)
1. Locate the top navigation bar in PolyMaster Quantum.
2. Click the **"KILL SWITCH"** toggle button.
3. The engine transitions immediately to `EMERGENCY_HALT`.

### Method 2: REST API Call
```bash
curl -X POST http://localhost:3000/api/kill-switch \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

### Method 3: Embedded Terminal CLI
Within the application embedded terminal:
```text
> kill-switch on
```

---

## Deactivation & Recovery Procedure
Once the underlying threat is identified and resolved:
1. Ensure all open orders are 100% reconciled.
2. Confirm market feeds are fresh and latency is below 150ms.
3. Verify database pool health: `curl http://localhost:3000/readyz`.
4. Deactivate the kill switch via Dashboard or API:
```bash
curl -X POST http://localhost:3000/api/kill-switch \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```
5. Re-run the Quadruple Safety Audit: `GET /api/audit`.
