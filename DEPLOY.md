# Deploy Pullwright (all on Railway)

**Recommended setup:** one Railway project with 3 services — **Redis**, **API**, **Frontend** — plus custom domains on `iayush.com`.

| Service | URL | Railway root directory |
|---------|-----|------------------------|
| Frontend | `https://pullwright.iayush.com` | `frontend` |
| API | `https://api.pullwright.iayush.com` | `backend` |
| Redis | internal only | Redis plugin |

Config files in this repo: `backend/railway.toml`, `frontend/railway.toml`, `frontend/vercel.json` (optional if you ever move frontend to Vercel).

---

## Why all-Railway (not Vercel + Railway)?

- One dashboard, one bill ($20 plan is enough for API + static frontend + Redis)
- **Redis private networking** is trivial (no egress fees, lower latency)
- Frontend is a static Vite build served by `serve` — no need for Vercel unless you want their CDN at the edge

You can still use Vercel for frontend later; set `VITE_API_URL` the same way.

---

## Redis: private vs public URL

| Variable | When to use |
|----------|-------------|
| `REDIS_PRIVATE_URL` or `REDIS_URL` (`.railway.internal`) | **Backend on Railway** — always use this |
| `REDIS_PUBLIC_URL` | **Only** when running the backend on your laptop but pointing at cloud Redis |

**You do NOT need the public URL in production.** In the backend service variables:

```env
REDIS_URL=${{Redis.REDIS_PRIVATE_URL}}
```

Or reference `${{Redis.REDIS_URL}}` if Railway already injects the private hostname.

The codebase sets `family: 0` on ioredis (required for Railway private IPv6 DNS). No extra query params needed.

**Local dev:** keep `REDIS_URL=redis://127.0.0.1:6379` in `backend/.env`.

---

## Docker / sandbox caveat ($20 plan)

Pullwright spawns **per-task Docker containers** via `dockerode`. **Railway does not expose a host Docker socket**, even on paid plans — so agent **code execution in sandboxes will fail** on Railway.

What **does** work on Railway:

- GitHub OAuth, dashboard, task queue, SSE logs, API

What **does not**:

- Clone repo → run tools in container → push PR

**For full execution later:** add a free Oracle Cloud VM as a remote Docker host (Tailscale + `DOCKER_HOST`) — see **[DEPLOY-VPS-DOCKER.md](./DEPLOY-VPS-DOCKER.md)** for the full step-by-step guide ($0 extra beyond your Railway plan).

Or move the whole backend to Fly — or move the whole backend to a VPS.

---

## Step 1 — Push code to GitHub

```bash
git add .
git commit -m "Add Railway deploy configs"
git push origin main
```

---

## Step 2 — Railway project

1. [railway.app](https://railway.app) → **New Project**
2. Name it e.g. `pullwright`

### 2a. Add Redis

1. **+ New** → **Database** → **Redis**
2. Wait until healthy. Note the service name (e.g. `Redis`).

### 2b. Add API (backend)

1. **+ New** → **GitHub Repo** → select this repo
2. **Settings**:
   - **Service name:** `api`
   - **Root directory:** `backend`
   - Railway reads `backend/railway.toml` automatically
3. **Variables** → add (see table below)
4. **Networking** → **Generate domain** (temporary `*.up.railway.app`)

**Backend variables:**

```env
NODE_ENV=production

FRONTEND_URL=https://pullwright.iayush.com
BACKEND_URL=https://api.pullwright.iayush.com

# Link to Redis service (private — no egress)
REDIS_URL=${{Redis.REDIS_PRIVATE_URL}}

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=          # openssl rand -hex 32

OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=

GITHUB_TOKEN=            # optional fallback

PLANNER_MODEL=groq:llama-3.1-8b-instant
EXECUTOR_MODEL=openai:gpt-4o-mini
VERIFIER_MODEL=groq:llama-3.1-8b-instant
REPLAN_MODEL=openai:gpt-4.1-nano
LLM_FAILOVER=groq,gemini,openrouter,openai
LLM_FREE_TIER=false
TASK_BUDGET_USD=0.10
ORG_BUDGET_USD=5.00
```

Replace `Redis` in `${{Redis.REDIS_PRIVATE_URL}}` if your Redis service has a different name.

### 2c. Add Frontend

1. **+ New** → **GitHub Repo** → same repo (second service)
2. **Settings**:
   - **Service name:** `web`
   - **Root directory:** `frontend`
3. **Variables** (build-time — redeploy after changes):

```env
VITE_API_URL=https://api.pullwright.iayush.com
```

4. **Networking** → **Generate domain**

---

## Step 3 — Custom domains (iayush.com)

DNS is wherever `iayush.com` is managed (Vercel DNS, Cloudflare, etc.).

### Frontend → `pullwright.iayush.com`

1. Railway `web` service → **Settings → Networking → Custom Domain**
2. Add `pullwright.iayush.com`
3. Create **CNAME** record:
   - Name: `pullwright`
   - Value: Railway’s target (e.g. `web-production-xxxx.up.railway.app`)

### API → `api.pullwright.iayush.com`

1. Railway `api` service → add custom domain `api.pullwright.iayush.com`
2. CNAME `api.pullwright` → Railway API target

Wait for SSL (usually &lt; 15 min). Then confirm:

```bash
curl https://api.pullwright.iayush.com/health
curl -I https://pullwright.iayush.com
```

---

## Step 4 — GitHub OAuth App

[GitHub OAuth Apps](https://github.com/settings/developers) → your app:

| Field | Value |
|-------|-------|
| Homepage URL | `https://pullwright.iayush.com` |
| Callback URL | `https://api.pullwright.iayush.com/api/auth/github/callback` |

Copy Client ID + Secret into Railway `api` variables. Redeploy `api` if already deployed.

---

## Step 5 — Verify

1. Open `https://pullwright.iayush.com`
2. **Sign in with GitHub** → should land on dashboard (not a login loop)
3. `GET https://api.pullwright.iayush.com/health` → `{"status":"ok"}`
4. `GET https://api.pullwright.iayush.com/health/docker` → likely `503` on Railway (expected)
5. Submit a test issue — UI + SSE should work; sandbox step may fail until you add a Docker host

### Login loop fixes

- `FRONTEND_URL` must match browser URL exactly (`https://`, no trailing slash)
- `BACKEND_URL` must match API domain
- `NODE_ENV=production` on API (for `SameSite=None` cookies)
- OAuth callback must equal `{BACKEND_URL}/api/auth/github/callback`

---

## Optional — Frontend on Vercel instead

If you prefer Vercel for `pullwright.iayush.com`:

1. Import repo, root `frontend`, build `npm run build`, output `dist`
2. Env: `VITE_API_URL=https://api.pullwright.iayush.com`
3. `frontend/vercel.json` handles SPA routing
4. Point `pullwright.iayush.com` in Vercel Domains
5. Keep API + Redis on Railway

---

## Environment cheat sheet

| Variable | Service | Required |
|----------|---------|----------|
| `REDIS_URL` | api | ✅ private URL on Railway |
| `FRONTEND_URL` | api | ✅ |
| `BACKEND_URL` | api | ✅ |
| `VITE_API_URL` | web | ✅ |
| `NODE_ENV=production` | api | ✅ |
| `SESSION_SECRET` | api | ✅ |
| `GITHUB_CLIENT_ID/SECRET` | api | ✅ |
| LLM keys | api | ✅ at least one |

---

## Scaling on $20 plan

- Disable **serverless sleep** / use always-on for `api` (long SSE + worker)
- Redis + API in the **same region**
- Monitor **egress** — using private Redis URL avoids Redis egress charges

---

## Full agent execution (future)

When you need real PRs from the agent:

1. **Fly.io** — deploy `backend` with Docker socket support, or
2. **VPS** (Hetzner, DigitalOcean) — Docker installed, run `npm start`

Keep frontend on Railway or Vercel; only the worker needs Docker.
