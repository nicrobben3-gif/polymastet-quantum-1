# Credential Rotation Guide (SEC-003)

## Supported Credentials & Rotation Schedules

| Credential Type | Rotation Interval | Service Location | Rotation Impact |
| :--- | :--- | :--- | :--- |
| **Solana Private Keys** | Quarterly | Docker Secrets / Vault | Downtime required: 2 mins |
| **Exchange API Keys** | Every 60 days | Polymarket, Kalshi, Novig | Zero downtime (dual-key swap) |
| **Telegram Bot Token** | Every 180 days | BotFather | Zero downtime |
| **PostgreSQL Passwords** | Every 90 days | Cloud SQL / Local DB | Zero downtime (connection pool reload) |

---

## Step-by-Step Dual-Key Rotation Procedure

1. **Generate Secondary Keypair in Exchange/Cloud**:
   - Create new key with minimum required scopes (`READ`, `TRADE`; strictly **NO WITHDRAWAL** permissions).
2. **Update Environment on Staging**:
   - Verify connectivity and place simulated order in `PAPER` mode.
3. **Deploy to Production**:
   - Update `.env` or Docker Secret on production VPS:
     ```bash
     ssh root@<vps-ip>
     cd /opt/polymaster
     nano .env
     # Update API_KEY_SECRET
     docker compose up -d --no-deps applet
     ```
4. **Revoke Retired Key**:
   - Decommission the previous key on the exchange console immediately after new key confirmation.
