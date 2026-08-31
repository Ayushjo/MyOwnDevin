# Build stage
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Railway injects service variables at build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Run stage — serve static SPA
FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install -g serve@14.2.6

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "serve dist -s -l tcp://0.0.0.0:${PORT}"]
