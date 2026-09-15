#!/usr/bin/env bash
# ==============================================================================
# ZTerminal Compute Node Bootstrap Script
# Target: Ubuntu 22.04 / 24.04 LTS (OCI Always Free ARM/x86 or Linux VPS)
# ==============================================================================

set -Eeuo pipefail

echo "==> [1/5] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

echo "==> [2/5] Installing prerequisite utilities..."
sudo apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    git

echo "==> [3/5] Installing Docker and Docker Compose..."
if ! command -v docker &> /dev/null; then
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
fi

echo "==> [4/5] Configuring firewall (ports 22, 80, 443)..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "==> [5/5] Checking Docker installation..."
docker --version
docker compose version

echo "=============================================================================="
echo "ZTerminal host bootstrap completed successfully."
echo "To start services:"
echo "  1. Copy your .env configuration into infrastructure/.env"
echo "  2. Run: docker compose -f infrastructure/docker-compose.production.yml up -d"
echo "  3. Verify health: curl http://localhost/health"
echo "=============================================================================="
