#!/bin/bash
set -euo pipefail

echo "========================================="
echo "  Agent Platform - Deploy Script"
echo "========================================="

# --- 1. Install Docker if needed ---
if ! command -v docker &> /dev/null; then
  echo "[1/7] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/7] Docker already installed"
fi

if ! docker compose version &> /dev/null; then
  echo "  Installing Docker Compose plugin..."
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi

echo "  $(docker --version)"
echo "  $(docker compose version)"

# --- 2. Clone repo ---
echo "[2/7] Setting up project..."
cd /root
if [ -d "agent-platform" ]; then
  echo "  Project directory exists, pulling latest..."
  cd agent-platform
  git pull
else
  git clone https://github.com/probabilityexchange-sketch/agent-platform.git
  cd agent-platform
fi

# --- 3. Create .env ---
echo "[3/7] Configuring environment..."
JWT_SECRET=$(openssl rand -hex 32)

cat > .env << ENVEOF
# Database (internal Docker network)
DATABASE_URL="postgresql://agentplatform:agentplatform@db:5432/agentplatform?schema=public"

# Domain - change when you have one
NEXT_PUBLIC_DOMAIN="66.179.241.33"

# JWT
JWT_SECRET="${JWT_SECRET}"

# Solana (devnet for now - switch to mainnet-beta before launch)
NEXT_PUBLIC_SOLANA_NETWORK="devnet"
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_RPC_URL="https://api.devnet.solana.com"

# SPL Token (update TOKEN_MINT when you create your Pump.fun token)
TOKEN_MINT="So11111111111111111111111111111111111111112"
NEXT_PUBLIC_TOKEN_MINT="So11111111111111111111111111111111111111112"
TOKEN_DECIMALS="9"
TREASURY_WALLET="BFnVSDKbTfe7tRPB8QqmxcXZjzkSxwBMH34HdnbStbQ3"

# Credit pricing
CREDITS_PACKAGE_SMALL_AMOUNT="100"
CREDITS_PACKAGE_SMALL_TOKENS="1000000000"
CREDITS_PACKAGE_MEDIUM_AMOUNT="500"
CREDITS_PACKAGE_MEDIUM_TOKENS="4500000000"
CREDITS_PACKAGE_LARGE_AMOUNT="1200"
CREDITS_PACKAGE_LARGE_TOKENS="10000000000"

# Docker
DOCKER_SOCKET="/var/run/docker.sock"
DOCKER_NETWORK="traefik-net"
TRAEFIK_NETWORK="traefik-net"

# Container defaults
CONTAINER_MAX_MEMORY="4294967296"
CONTAINER_MAX_CPU="2000000000"
CONTAINER_PID_LIMIT="256"
CONTAINER_DEFAULT_HOURS="4"

# Agent images
AGENT_ZERO_IMAGE="frdel/agent-zero:latest"
OPENCLAW_IMAGE="openclaw/openclaw:latest"

# Cloudflare (fill in when you have a domain)
CF_API_EMAIL=""
CF_DNS_API_TOKEN=""
ENVEOF

echo "  .env created with generated JWT secret"

# --- 4. Traefik setup ---
echo "[4/7] Setting up Traefik..."
mkdir -p traefik/acme
touch traefik/acme/acme.json
chmod 600 traefik/acme/acme.json

# --- 5. Build and launch ---
echo "[5/7] Building and launching (this takes 2-3 minutes)..."
docker compose up -d --build

echo "  Waiting for services to be healthy..."
sleep 10

# Wait for db to be ready
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U agentplatform &> /dev/null; then
    echo "  Database is ready"
    break
  fi
  echo "  Waiting for database... ($i/30)"
  sleep 2
done

# Wait for app to be ready
for i in $(seq 1 30); do
  if docker compose exec -T app wget -qO- http://localhost:3000 &> /dev/null 2>&1; then
    echo "  App is ready"
    break
  fi
  echo "  Waiting for app... ($i/30)"
  sleep 3
done

# --- 6. Database setup ---
echo "[6/7] Setting up database..."
docker compose exec -T app npx prisma db push --accept-data-loss
docker compose exec -T app npx tsx prisma/seed.ts

# --- 7. Network security ---
echo "[7/7] Setting up network policies..."
if iptables -L DOCKER-USER &> /dev/null 2>&1; then
  bash scripts/setup-iptables.sh
else
  echo "  Skipping iptables (DOCKER-USER chain not available yet)"
fi

# --- Done ---
echo ""
echo "========================================="
echo "  Deployment complete!"
echo "========================================="
echo ""
echo "  Site: http://66.179.241.33"
echo "  Treasury: BFnVSDKbTfe7tRPB8QqmxcXZjzkSxwBMH34HdnbStbQ3"
echo ""
echo "  Services:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  Next steps:"
echo "  1. Visit http://66.179.241.33 to verify"
echo "  2. Buy a domain and point *.domain + domain -> 66.179.241.33"
echo "  3. Update NEXT_PUBLIC_DOMAIN in .env and restart: docker compose restart app"
echo "  4. On token launch day: update TOKEN_MINT in .env and restart app"
echo ""
