#!/bin/bash
# EC2 first-boot bootstrap for WealthClick
# All output is logged to /var/log/userdata.log and the system console.
set -euo pipefail
exec > >(tee /var/log/userdata.log | logger -t userdata -s 2>/dev/console) 2>&1

echo "=== WealthClick bootstrap start ==="

# ── 1. System updates ─────────────────────────────────────────────────────────
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y git curl build-essential unzip

# ── 2. Node.js 22 ─────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node --version
npm --version

# ── 3. PostgreSQL 15 ──────────────────────────────────────────────────────────
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Create app database and user
# NOTE: Change the password after first boot via SSM:
#   sudo -u postgres psql -c "ALTER USER wealthclick WITH PASSWORD 'your_new_password';"
#   Then update DATABASE_URL in /opt/wealthclick/apps/web/.env
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wealthclick') THEN
    CREATE USER wealthclick WITH PASSWORD 'changeme_on_first_boot';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wealthclick') THEN
    CREATE DATABASE wealthclick OWNER wealthclick;
  END IF;
END$$;
SQL

# ── 4. Redis ──────────────────────────────────────────────────────────────────
apt-get install -y redis-server
# Ensure Redis binds to localhost only (default on Ubuntu but make it explicit)
sed -i 's/^# bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf || true
systemctl enable redis-server
systemctl start redis-server

# ── 5. PM2 (process manager) ─────────────────────────────────────────────────
npm install -g pm2

# ── 6. Clone repository ───────────────────────────────────────────────────────
APP_DIR="/opt/wealthclick"

if [ ! -d "$APP_DIR" ]; then
  git clone https://github.com/${github_repo}.git "$APP_DIR"
else
  echo "App directory already exists, skipping clone"
fi

chown -R ubuntu:ubuntu "$APP_DIR"

# ── 7. Install dependencies and build ────────────────────────────────────────
cd "$APP_DIR/apps/web"
sudo -u ubuntu npm ci
sudo -u ubuntu npm run build

# ── 8. Create .env file ───────────────────────────────────────────────────────
# Secrets are intentionally left empty — fill these in via SSM before first run.
ENV_FILE="$APP_DIR/apps/web/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVEOF'
# ─── Google OAuth ──────────────────────────────────────────────────
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── NextAuth v5 ───────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
AUTH_SECRET=
# Set to ALB DNS until domain is attached, then switch to https://yourdomain.com
NEXTAUTH_URL=http://SET_ALB_DNS_NAME_HERE

# ─── Database ──────────────────────────────────────────────────────
# Update password to match what you set in PostgreSQL
DATABASE_URL=postgresql://wealthclick:changeme_on_first_boot@localhost:5432/wealthclick

# ─── Redis ─────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── App ───────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
ENVEOF
  chown ubuntu:ubuntu "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# ── 9. PM2 ecosystem config ───────────────────────────────────────────────────
cat > "$APP_DIR/ecosystem.config.js" <<'PM2EOF'
module.exports = {
  apps: [{
    name: 'wealthclick',
    cwd: '/opt/wealthclick/apps/web',
    script: 'node_modules/.bin/next',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    error_file: '/var/log/wealthclick-error.log',
    out_file: '/var/log/wealthclick-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
PM2EOF
chown ubuntu:ubuntu "$APP_DIR/ecosystem.config.js"

# ── 10. Start PM2 and configure systemd autostart ────────────────────────────
# NOTE: App will start but won't work until .env is filled in (step 8).
sudo -u ubuntu pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u ubuntu pm2 save

# Register PM2 as a systemd service so it restarts on EC2 reboot
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo ""
echo "=== Bootstrap complete ==="
echo ""
echo "NEXT: Fill in secrets before the app will serve real traffic:"
echo "  aws ssm start-session --target <instance-id> --region il-central-1"
echo "  sudo nano /opt/wealthclick/apps/web/.env"
echo "  sudo -u ubuntu pm2 restart wealthclick"
echo ""
