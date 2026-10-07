# PolyMaster Quantum · 24/7 VPS Production Deployment Guide

This guide provides instructions to deploy **PolyMaster Quantum** to a Linux Virtual Private Server (VPS) for continuous 24/7 autonomous execution with zero downtime.

---

## 1. Why a VPS is Required for 24/7 Autonomous Trading

A personal computer or browser tab sleeps when you close your laptop, causing:
* Dropped exchange WebSockets and missed arbitrage execution windows.
* Delayed stop-loss and protective risk-gate enforcements.
* Lost sub-slot sniping opportunities on Solana and Polymarket.

A dedicated Linux VPS ensures:
* **100% 24/7 Uptime**: The trading orchestrator and autonomous AI engine run continuously in background containers.
* **Low Latency (<15ms)**: Direct fiber connectivity to major exchange endpoints and Solana RPC nodes.
* **Non-Custodial Multi-User Isolation**: Traders can connect to your hosted online instance using their own Web3 Wallets (Phantom, MetaMask, WalletConnect) or Social OAuth (Google, Apple) while your creator commission routes to your locked Solana address.

---

## 2. Recommended VPS Providers & Hardware Specifications

| Cloud Provider | Recommended Plan | Location | Approx. Cost |
| :--- | :--- | :--- | :--- |
| **Hetzner Cloud** (Top Value) | CPX21 (3 vCPU, 4 GB RAM, 80 GB NVMe) | Falkenstein / Nuremberg or Ashburn (US) | ~€7 / month |
| **DigitalOcean** | Basic Droplet (2 vCPU, 4 GB RAM, 80 GB SSD) | NYC1 or Frankfurt (FRA1) | ~$24 / month |
| **AWS EC2** | `t4g.medium` or `c7g.large` (ARM Graviton) | `us-east-1` (N. Virginia) | ~$25 / month |
| **Vultr** | High Frequency Compute (2 vCPU, 4 GB RAM) | New Jersey or Amsterdam | ~$24 / month |

* **Operating System**: **Ubuntu 24.04 LTS** or **Ubuntu 22.04 LTS** (64-bit x86_64 or arm64).

---

## 3. Server Preparation & Hardening (5 Minutes)

Connect to your VPS via SSH from your terminal:
```bash
ssh root@YOUR_SERVER_IP
```

### Step 3.1: Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban htop unzip
```

### Step 3.2: Configure UFW Firewall
Allow SSH, Web, and Application ports:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Let's Encrypt / Caddy)
sudo ufw allow 443/tcp   # HTTPS SSL
sudo ufw allow 3000/tcp  # Direct Engine Port
sudo ufw --force enable
```

### Step 3.3: Configure 4 GB Swap Space (Prevents OOM Crashes)
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Method A: Docker Compose Deployment (Recommended)

Docker Compose provides container isolation, resource caps, healthchecks, and auto-restart on unexpected crashes or VPS reboots.

### Step 4.1: Install Docker & Docker Compose
Run the official automated installation script:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

Verify installation:
```bash
docker --version && docker compose version
```

### Step 4.2: Clone Your Repository
```bash
cd /opt
git clone https://github.com/nicrobben3-gif/polymastet-quantum-1.git polymaster
cd polymaster
```

### Step 4.3: Configure Production Environment Variables
Create a production `.env` file:
```bash
cat << 'EOF' > .env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Immutable Creator Commission Destination (Solana SPL-USDT)
VITE_CREATOR_FEE_WALLET=GmRZNNRyzYZKatdCsSALmgyLksNX8Mx1XrJPCt1ZwUbm
CREATOR_PERFORMANCE_FEE_RATE=0.05

# Optional Custom RPC Endpoints (Default public fallbacks active)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
POLYGON_RPC_URL=https://polygon-rpc.com
JITO_RELAYER_URL=https://mainnet.block-engine.jito.wtf
EOF
```

### Step 4.4: Build & Launch in Background
```bash
docker compose up -d --build
```

### Step 4.5: Verify Container Health & Stream Logs
```bash
# Check container status (should show 'Up (healthy)')
docker compose ps

# View live trading engine logs
docker compose logs -f polymaster-engine
```

Your trading bot is now live and accessible at:
```
http://YOUR_SERVER_IP:3000
```

---

## 5. Setting Up Free SSL with Domain (HTTPS)

For production, you can point a domain (e.g. `trade.yourdomain.com`) to your server IP.

### Option 1: Automatic SSL via Built-in Caddy
1. Add an **A Record** in your domain registrar (GoDaddy, Namecheap, Cloudflare) pointing `trade.yourdomain.com` to `YOUR_SERVER_IP`.
2. Edit `/opt/polymaster/Caddyfile`:
```caddy
trade.yourdomain.com {
    reverse_proxy polymaster-engine:3000
    encode gzip zstd
}
```
3. Uncomment the `caddy` service block in `docker-compose.yml` and run:
```bash
docker compose up -d
```
Caddy will automatically provision and renew a free Let's Encrypt SSL certificate.

### Option 2: Nginx + Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```
Add Nginx server block in `/etc/nginx/sites-available/polymaster`:
```nginx
server {
    server_name trade.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable and provision SSL:
```bash
sudo ln -s /etc/nginx/sites-available/polymaster /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d trade.yourdomain.com
```

---

## 6. Method B: Bare-Metal Node.js with PM2 (Alternative)

If you prefer running directly without Docker:

```bash
# 1. Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. Clone and install dependencies
cd /opt
git clone https://github.com/nicrobben3-gif/polymastet-quantum-1.git polymaster
cd polymaster
npm install
npm run build

# 3. Start with PM2
pm2 start npm --name "polymaster" -- run preview -- --host 0.0.0.0 --port 3000

# 4. Configure automatic reboot persistence
pm2 startup
pm2 save
```

---

## 7. Multi-User Authentication & Creator Fee Protection

* **User Authentication**: Users visiting your hosted instance can connect with **MetaMask, Phantom, WalletConnect, Google, Apple, or Email Passkey**.
* **Cryptographic Sign-In (SIWE / SIWS)**: Users sign an authentication challenge with their wallet to verify key ownership.
* **Account Isolation**: Each user's principal, positions, high-water marks, and P&L are tracked in separate isolated state containers.
* **Creator Commission Auto-Routing**:
  * 5.0% performance fee on net profits above principal.
  * Fees route directly to your Solana USDT public wallet:
    `GmRZNNRyzYZKatdCsSALmgyLksNX8Mx1XrJPCt1ZwUbm`
  * Breakeven and loss withdrawals remain 100% exempt ($0.00).

---

## 8. Managing & Updating the Running Service

### Pull Latest Updates from Git:
```bash
cd /opt/polymaster
git pull origin main
docker compose up -d --build
```

### Stop the Service:
```bash
docker compose down
```

### View Live Real-Time Logs:
```bash
docker compose logs -f --tail=100 polymaster-engine
```

---

## 9. Taking On-Chain Deposits & Capital Management

PolyMaster Quantum includes an on-chain deposit portal accessible from the top navigation bar and the Autonomous AI Trader dashboard:

* **Supported Ingestion Networks & Assets**:
  * **Solana SPL-USDC** (Recommended: instant 400ms finality, sub-$0.001 network fee)
  * **Solana SPL-USDT** (SPL stablecoin)
  * **Native SOL** (Converted using live market oracle prices)
  * **Polygon POS USDC** (Polymarket orderbook native liquidity)
  * **Instant Capital / Direct Transfer** (Direct ledger crediting)
* **Interactive QR Code & Address Display**:
  * Every asset displays an SVG QR Code for instant mobile wallet camera scanning (Phantom Mobile, Solflare, MetaMask, Rainbow).
  * 1-click address copy with instant confirmation checkmark.
* **Instant Vault Crediting**:
  * Ingested funds immediately credit the user's cash reserves and Autonomous AI Trader Vault for compounding.
* **100% Principal Protection Guarantee**:
  * When a deposit is confirmed, the user's initial capital basis increases by that exact amount.
  * The 5.0% performance fee only ever applies to net realized gains *above* total deposits. Withdrawals of deposited principal incur $0.00 fee.

