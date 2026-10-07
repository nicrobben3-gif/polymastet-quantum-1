# PolyMaster Quantum - Security & Secret Architecture

## 1. Zero-Trust Security Principles

PolyMaster Quantum handles API credentials and blockchain wallets under an institutional defense-in-depth model.

### Core Rules:
1. **Never Hardcode Secrets**: No API keys, secret passphrases, or private keys are ever stored in code repositories.
2. **Environment & Secret Managers**: All credentials originate from environment variables or vault secret managers.
3. **Cryptographic Redaction**: All structured logs, error traces, and API responses automatically redact sensitive strings matching key patterns.
4. **Least-Privilege API Keys**:
   - Trading keys must strictly **disable withdrawal permissions**.
   - PolyMaster verifies that withdrawal permissions are absent before allowing live trading.
5. **Non-Custodial Wallet Security**:
   - Blockchain execution (Polygon Safe, Solana, EVM) supports signing-service or client-side non-custodial signatures.
   - Private keys are kept in encrypted memory segments and never passed to frontend dashboards.
6. **Replay & Timestamp Protection**:
   - Webhooks and REST requests enforce HMAC-SHA256 signatures with 5,000ms clock skew windows and monotonic nonces.
7. **Rate Limiting**: Token-bucket algorithm prevents API bans across upstream exchange endpoints.
