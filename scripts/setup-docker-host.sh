#!/usr/bin/env bash
# Run on Oracle Cloud (or any Ubuntu 22.04/24.04 VM) as root or with sudo.
# Sets up Docker Engine + Tailscale + remote API on the Tailscale interface only.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/setup-docker-host.sh"
  exit 1
fi

echo "==> Installing Docker..."
apt-get update -qq
apt-get install -y ca-certificates curl gnupg ufw

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
fi

systemctl enable docker
systemctl start docker

echo "==> Installing Tailscale..."
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

echo ""
echo "------------------------------------------------------------------"
echo "Next: authenticate Tailscale on this VM"
echo "  tailscale up"
echo "Then note this machine's Tailscale IP:"
echo "  tailscale ip -4"
echo "------------------------------------------------------------------"
echo ""

read -r -p "Press Enter after 'tailscale up' is done..."

TS_IP="$(tailscale ip -4 2>/dev/null || true)"
if [[ -z "${TS_IP}" ]]; then
  echo "Could not read Tailscale IP. Run 'tailscale up' and re-run this script."
  exit 1
fi

echo "==> Configuring Docker to listen on Tailscale (${TS_IP}:2375)..."
mkdir -p /etc/systemd/system/docker.service.d
cat >/etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H unix:///var/run/docker.sock -H tcp://${TS_IP}:2375
EOF

systemctl daemon-reload
systemctl restart docker

echo "==> Firewall: allow Tailscale; block public Docker port"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow in on tailscale0
ufw --force enable

echo "==> Building sandbox image (devin-sandbox:latest)..."
REPO_DIR="${REPO_DIR:-/opt/pullwright}"
if [[ -f "${REPO_DIR}/backend/src/sandbox/Dockerfile" ]]; then
  docker build -t devin-sandbox:latest "${REPO_DIR}/backend/src/sandbox"
else
  cat >/tmp/sandbox.Dockerfile <<'DOCKERFILE'
FROM node:20-alpine
RUN apk add --no-cache git curl bash ripgrep
RUN git config --global user.email "agent@pullwright" && \
    git config --global user.name "Pullwright Agent"
WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
DOCKERFILE
  docker build -t devin-sandbox:latest -f /tmp/sandbox.Dockerfile /tmp
fi

docker images devin-sandbox:latest

echo ""
echo "=================================================================="
echo "Docker host ready."
echo ""
echo "  Tailscale IP:     ${TS_IP}"
echo "  DOCKER_HOST:      tcp://${TS_IP}:2375"
echo "  Sandbox image:    devin-sandbox:latest"
echo ""
echo "On Railway backend, set:"
echo "  DOCKER_HOST=tcp://${TS_IP}:2375"
echo ""
echo "Verify from a machine on your tailnet:"
echo "  DOCKER_HOST=tcp://${TS_IP}:2375 docker ps"
echo "=================================================================="
