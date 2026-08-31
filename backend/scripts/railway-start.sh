#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo "Starting Tailscale..."
  tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/var/run/tailscale/tailscaled.sock &
  sleep 2
  tailscale up \
    --auth-key="${TAILSCALE_AUTHKEY}" \
    --hostname="${TAILSCALE_HOSTNAME:-pullwright-api}" \
    --accept-routes
  echo "Tailscale IP: $(tailscale ip -4 2>/dev/null || echo unknown)"
fi

if [[ -z "${DOCKER_HOST:-}" ]]; then
  echo "WARNING: DOCKER_HOST is not set — sandbox tasks will fail until you point at the Oracle Docker host."
fi

exec node dist/index.js
