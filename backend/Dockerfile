# Railway backend image with Tailscale (connects to remote Docker host on Oracle VM).
FROM node:20-bookworm-slim

RUN apt-get update -qq \
  && apt-get install -y --no-install-recommends ca-certificates curl iptables \
  && curl -fsSL https://tailscale.com/install.sh | sh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

COPY scripts/railway-start.sh /railway-start.sh
RUN chmod +x /railway-start.sh

ENV NODE_ENV=production
EXPOSE 3500

CMD ["/railway-start.sh"]
