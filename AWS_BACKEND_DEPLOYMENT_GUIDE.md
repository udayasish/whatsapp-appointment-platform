# 🚀 Interactive AWS EC2 Backend Deployment Guide (100% Free Tier & Zero-Cost Domain)

> **Target Architecture**: AWS EC2 (Ubuntu 24.04 LTS) • Docker (Redis 7) • Neon PostgreSQL (Serverless) • Caddy (Auto-HTTPS) • PM2 (Node.js 20)  
> **Domain Approach**: **100% Free `sslip.io` Wildcard Domain** (No domain purchase or registration required)  
> **Estimated Setup Time**: 15 – 20 minutes

---

## 📋 Interactive Progress Checklist

- [ ] **Phase 1**: AWS Console Setup (EC2, Security Group, Elastic IP)
- [ ] **Phase 2**: Understand Your Free Domain (`sslip.io`)
- [ ] **Phase 3**: SSH Connection from Local Machine
- [ ] **Phase 4**: Server Base Prep & 4GB Swap Space
- [ ] **Phase 5**: Install Docker, Node.js 20, PM2 & Caddy
- [ ] **Phase 6**: Run Redis in Docker Container
- [ ] **Phase 7**: Clone Repository & Configure `.env`
- [ ] **Phase 8**: Neon PostgreSQL Migrations & Seeding
- [ ] **Phase 9**: Build & Launch Backend via PM2
- [ ] **Phase 10**: Configure Caddy with Free `sslip.io` Domain & Auto-SSL
- [ ] **Phase 11**: Connect Meta WhatsApp Webhook
- [ ] **Phase 12**: Production Maintenance & Update Workflow

---

## 🧰 Prerequisites Checklist

Before you begin, have the following ready:
1. **AWS Account**: Active account with Free Tier access.
2. **Key Pair (`.pem` file)**: Downloaded when launching your EC2 instance.
3. **No Domain Needed**: We will use your free `*.sslip.io` domain generated from your Elastic IP.
4. **Neon Database Connection String**: From [neon.tech](https://neon.tech/) (e.g. `postgresql://...&sslmode=require`).
5. **Meta WhatsApp Cloud API Credentials**:
   - Phone Number ID
   - System User Access Token (Permanent)
   - Custom Webhook Verify Token string

---

## Phase 1: AWS Console Setup

### 1.1 Launch EC2 Instance
1. Open the [AWS EC2 Console](https://console.aws.amazon.com/ec2/).
2. Click **Launch Instance**.
3. **Name**: `dococt-whatsapp-backend`
4. **OS / AMI**: Select **Ubuntu Server 24.04 LTS (HVM), SSD Volume Type**.
5. **Instance Type**: `t2.micro` or `t3.micro` *(Free Tier eligible)*.
6. **Key Pair**: Select your existing `.pem` key pair (or create a new one and download it).
7. **Network Settings**:
   - Check **Allow SSH traffic from** -> Select **My IP** (or Anywhere `0.0.0.0/0`).
   - Check **Allow HTTPS traffic from the internet** (Port 443).
   - Check **Allow HTTP traffic from the internet** (Port 80).
8. **Storage**: Keep default **8 GiB gp3** (or set to 15–20 GiB within the 30 GiB free tier allowance).
9. Click **Launch Instance**.

---

### 1.2 Verify Inbound Security Group Rules
1. In EC2 Console, go to **Instances** -> Select your instance -> Click the **Security** tab.
2. Click on the **Security Groups** link.
3. Verify the **Inbound rules** tab matches this exact table:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `My IP` (or `0.0.0.0/0`) | Remote terminal access |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Let's Encrypt challenge & HTTP redirect |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Meta WhatsApp Webhook & API traffic |

> [!CAUTION]
> Do **NOT** open port `5432` (Postgres), `6379` (Redis), or `3000` (Node.js) to the public internet. They must only listen locally on `127.0.0.1`.

---

### 1.3 Allocate and Attach an Elastic IP (Static IP)
*(Without an Elastic IP, your server's public IP changes every time you stop/start the instance, breaking your free domain and WhatsApp webhook).*

1. In the left sidebar of EC2, click **Elastic IPs** (under *Network & Security*).
2. Click **Allocate Elastic IP address** -> Click **Allocate**.
3. Select the new Elastic IP -> Click **Actions** -> **Associate Elastic IP address**.
4. **Resource type**: `Instance`.
5. **Instance**: Select your running `dococt-whatsapp-backend` instance.
6. Click **Associate**.
7. **Copy your Elastic IP address** (e.g., `13.235.45.67`).

---

## Phase 2: Understand Your Free Domain (`sslip.io`)

Meta WhatsApp Cloud API **requires HTTPS** with a valid domain name (it rejects raw IP addresses).  
Instead of paying for a domain, we use **`sslip.io`**, a free public DNS service that instantly turns any IP address into a real, valid domain.

### How your free domain is formatted:
Replace the dots `.` in your Elastic IP with hyphens `-` and add `.sslip.io`:

| Your Elastic IP | Your Free Public Domain |
| :--- | :--- |
| `13.235.45.67` | `13-235-45-67.sslip.io` |
| `65.1.200.85` | `65-1-200-85.sslip.io` |

**Why this works**:
- `sslip.io` automatically resolves to your exact Elastic IP.
- Let's Encrypt recognizes it as a valid domain and issues a **100% genuine SSL certificate**.
- Caddy automatically manages this certificate with zero manual steps.
- Meta accepts `https://<YOUR-IP>.sslip.io/api/whatsapp/webhook` as a valid webhook callback URL.

---

## Phase 3: Connect via SSH

Open **PowerShell** or **Terminal** on your local computer where your `.pem` file is saved:

### For Windows PowerShell:
```powershell
# Navigate to the folder with your pem key
cd C:\path\to\your-key-folder

# Connect to your instance
ssh -i "your-key.pem" ubuntu@<YOUR_ELASTIC_IP>
```

### For Mac / Linux / WSL:
```bash
chmod 400 your-key.pem
ssh -i "your-key.pem" ubuntu@<YOUR_ELASTIC_IP>
```

*(Type `yes` when asked to accept the host key fingerprint. You are now inside your remote Ubuntu terminal).*

---

## Phase 4: Server Prep & Swap Space (Critical for Free Tier)

AWS Free Tier instances have 1 GB of physical RAM. TypeScript builds or npm installations can trigger Out-Of-Memory (OOM) crashes without virtual swap memory.

Run this entire block on your EC2 instance:

```bash
# 1. Update Ubuntu packages
sudo apt update && sudo apt upgrade -y

# 2. Allocate a 4GB Swap file
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Make swap permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 4. Verify swap is active (should show ~4.0G Swap)
free -h
```

---

## Phase 5: Install Docker, Node.js 20, PM2 & Caddy

Run the following commands on your EC2 terminal:

### 5.1 Install Docker
```bash
sudo apt install -y docker.io docker-compose-v2 git curl
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```

### 5.2 Install Node.js 20 LTS & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 5.3 Install Caddy Server
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 5.4 Verify Versions
```bash
node -v      # v20.x.x
docker -v    # Docker version 24.x or 26.x
pm2 -v       # 5.x.x
caddy version
```

---

## Phase 6: Run Redis in Docker

Run Redis 7 inside Docker with persistent volume storage and password authentication:

```bash
# 1. Create a persistent folder for Redis data
mkdir -p ~/redis-data

# 2. Run Redis container binding strictly to localhost (127.0.0.1)
docker run -d \
  --name wap-redis \
  --restart always \
  -p 127.0.0.1:6379:6379 \
  -v ~/redis-data:/data \
  redis:7-alpine redis-server --appendonly yes --requirepass "YourStrongRedisPassword2026!"
```

### Test Redis Connectivity:
```bash
docker exec -it wap-redis redis-cli -a "YourStrongRedisPassword2026!" ping
```
*Expected output: `PONG`*

---

## Phase 7: Clone Repository & Configure `.env`

### 7.1 Create Project Directory & Clone
```bash
# Create standard production directory
sudo mkdir -p /var/www/whatsapp-platform
sudo chown -R ubuntu:ubuntu /var/www/whatsapp-platform
cd /var/www/whatsapp-platform

# Clone your repository
git clone <YOUR_GITHUB_REPO_URL> .
```

### 7.2 Create Production `.env`
```bash
nano /var/www/whatsapp-platform/.env
```

Paste the following production configuration (replace placeholders with your actual details):

```env
NODE_ENV=production
PORT=3000

# ==========================================
# 1. DATABASE (Neon PostgreSQL Serverless)
# ==========================================
DATABASE_URL=postgresql://<user>:<password>@<neon-hostname>/neondb?sslmode=require

# ==========================================
# 2. REDIS (Docker on localhost)
# ==========================================
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=YourStrongRedisPassword2026!

# ==========================================
# 3. META WHATSAPP CLOUD API
# ==========================================
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_meta
WHATSAPP_ACCESS_TOKEN=your_permanent_system_user_token
WHATSAPP_VERIFY_TOKEN=your_custom_webhook_secret_phrase

# ==========================================
# 4. SECURITY & AUTH
# ==========================================
JWT_SECRET=super_secret_jwt_key_random_32_characters_minimum
ADMIN_SESSION_SECRET=super_secret_session_key_random_32_characters

# ==========================================
# 5. CORS (Allow your Vercel web app & free domain)
# ==========================================
CORS_ORIGIN=https://your-app.vercel.app,https://<YOUR-IP>.sslip.io
```

> **Save & Exit**: Press `Ctrl + O` → Press `Enter` → Press `Ctrl + X`.

---

## Phase 8: Neon Database Migration & Seeding

Install dependencies and run Drizzle schemas against your Neon cloud database:

```bash
cd /var/www/whatsapp-platform

# 1. Install dependencies
npm ci

# 2. Run Drizzle migrations against Neon DB
npx drizzle-kit migrate

# 3. Seed initial clinic & doctor data
npm run db:seed

# 4. Generate the 6-day (9 AM & 3 PM) booking slots
npm run slots:refresh
```

---

## Phase 9: Build & Launch Backend with PM2

### 9.1 Compile TypeScript
```bash
npm run build
```
*(This builds `dist/index.js`).*

### 9.2 Start Application with PM2
```bash
pm2 start dist/index.js --name "wap-backend"
```

### 9.3 Enable Auto-Restart Across Server Reboots
```bash
# Save current running process list
pm2 save

# Generate and run the systemd startup command
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 9.4 Verify Status
```bash
pm2 status
pm2 logs wap-backend --lines 25
```
*You should see Express listening on port 3000 and Redis connected.*

---

## Phase 10: Configure Caddy with Free `sslip.io` Domain & Auto-SSL

Caddy will automatically obtain a free, verified Let's Encrypt SSL certificate for your `sslip.io` domain.

### 10.1 Edit Caddyfile
```bash
sudo nano /etc/caddy/Caddyfile
```

Delete everything inside and paste this (replace `13-235-45-67` with your actual Elastic IP with hyphens):

```caddyfile
13-235-45-67.sslip.io {
    reverse_proxy localhost:3000
}
```

> **Save & Exit**: Press `Ctrl + O` → Press `Enter` → Press `Ctrl + X`.

### 10.2 Reload Caddy
```bash
sudo systemctl reload caddy
```

### 10.3 Test Your Free HTTPS API
On your computer's browser or terminal:
```bash
curl -I https://13-235-45-67.sslip.io/health
```
*(Returns `HTTP/2 200 OK` with a valid Let's Encrypt SSL certificate!)*

---

## Phase 11: Connect Meta WhatsApp Webhook

1. Go to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Select your App → **WhatsApp** → **Configuration**.
3. Under **Webhook**, click **Edit**:
   - **Callback URL**: `https://<YOUR-IP>.sslip.io/api/whatsapp/webhook`  
     *(Example: `https://13-235-45-67.sslip.io/api/whatsapp/webhook`)*
   - **Verify Token**: *(The exact string set in `WHATSAPP_VERIFY_TOKEN` in your `.env`)*
4. Click **Verify and Save**. Meta will make an instant GET handshake verification.
5. Under **Webhook fields**, click **Manage** and toggle **`messages`** to **Subscribed**.

---

## Phase 12: Production Maintenance & Update Workflow

Whenever you push new backend code to GitHub, deploy updates with these 4 commands:

```bash
cd /var/www/whatsapp-platform
git pull origin main
npm ci
npm run build
pm2 reload wap-backend
```

### Useful Monitoring Commands:
```bash
# View live application logs
pm2 logs wap-backend

# View server memory & CPU usage
pm2 monit

# Check Caddy SSL status & requests
sudo journalctl -u caddy -n 50 --no-pager

# Check Redis container status
docker ps
docker logs wap-redis --tail 20
```

---

## 🛠️ Troubleshooting Cheat Sheet

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **`Connection refused` on SSH** | Port 22 is closed in AWS Security Group | Open port 22 to `My IP` in AWS Security Group. |
| **Meta Webhook Verification Fails** | Verify Token mismatch or typo in sslip.io domain | Test `curl https://<YOUR-IP>.sslip.io/health`. Ensure `WHATSAPP_VERIFY_TOKEN` in `.env` matches Meta exactly. |
| **`npm run build` exits with code 137** | Out of Memory (OOM) | Check swap with `free -h`. Re-run swap commands in Phase 4. |
| **Redis connection ECONNREFUSED** | Redis container is not running | Run `docker ps`. If stopped, start it: `docker start wap-redis`. |
| **Caddy fails to get SSL** | Port 80 or 443 is blocked in AWS Security Group | Ensure both Port 80 and Port 443 are open to `0.0.0.0/0`. |
