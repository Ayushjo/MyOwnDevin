# Deploy Pullwright: Railway + Oracle Free Docker

**Goal:** Use your **$20 Railway plan** for frontend, API, worker, and Redis. Use a **free Oracle Cloud VM** only as the Docker host for agent sandboxes. **Total extra cost: $0.**

| Component | Where | URL |
|-----------|--------|-----|
| Frontend | Railway | `https://pullwright.iayush.com` |
| API + worker | Railway | `https://api.pullwright.iayush.com` |
| Redis | Railway (private) | internal only |
| Docker daemon | Oracle VM (free) | Tailscale IP `100.x.x.x:2375` |

---

## How it works

```
Browser ──► Railway Frontend
              │
              ▼
         Railway Backend (API + BullMQ worker)
              │  DOCKER_HOST=tcp://100.x.x.x:2375  (Tailscale)
              ▼
         Oracle VM (dockerd + devin-sandbox image)
```

- API and worker stay on **one Railway service** → live SSE logs keep working.
- Sandboxes run on Oracle via remote Docker.
- Docker port is **not** exposed on the public internet — only on Tailscale.

---

## Prerequisites checklist

Before you start, have these ready:

- [ ] GitHub repo pushed (this repo)
- [ ] Railway account on **$20 plan**
- [ ] Domain DNS access for `iayush.com` (or your domain)
- [ ] GitHub OAuth App ([create here](https://github.com/settings/developers))
- [ ] At least one LLM API key (Groq, OpenAI, Gemini, etc.)
- [ ] Oracle Cloud account ([signup](https://www.oracle.com/cloud/free/)) — free tier VM
- [ ] Tailscale account ([signup](https://tailscale.com)) — free for personal use

---

## Part 1 — Push code to GitHub

If not already done:

```bash
cd /path/to/MyOwnDevin
git add frontend/ backend/src/config/docker.ts backend/Dockerfile backend/scripts/ scripts/ DEPLOY-VPS-DOCKER.md
git commit -m "Add UI revamp and Railway + Oracle Docker deploy guide"
git push origin main
```

---

## Part 2 — Railway project (frontend + API + Redis)

### Step 2.1 — Create project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Name it `pullwright`

### Step 2.2 — Add Redis

1. **+ New** → **Database** → **Redis**
2. Wait until status is **Healthy**
3. Note the service name (usually `Redis`)

### Step 2.3 — Add API (backend)

1. **+ New** → **GitHub Repo** → select `MyOwnDevin`
2. **Settings**:
   - **Service name:** `api`
   - **Root directory:** `backend`
   - **Builder:** Dockerfile (Railway auto-detects `backend/Dockerfile`)
3. **Variables** → add all of these:

```env
NODE_ENV=production

FRONTEND_URL=https://pullwright.iayush.com
BACKEND_URL=https://api.pullwright.iayush.com

REDIS_URL=${{Redis.REDIS_PRIVATE_URL}}

GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
SESSION_SECRET=<run: openssl rand -hex 32>

# At least one LLM key
GROQ_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

PLANNER_MODEL=groq:llama-3.1-8b-instant
EXECUTOR_MODEL=openai:gpt-4o-mini
VERIFIER_MODEL=groq:llama-3.1-8b-instant
REPLAN_MODEL=openai:gpt-4.1-nano
LLM_FAILOVER=groq,gemini,openrouter,openai
LLM_FREE_TIER=false
TASK_BUDGET_USD=0.10
ORG_BUDGET_USD=5.00

# Set in Part 3 after Oracle VM is ready:
DOCKER_HOST=tcp://100.x.x.x:2375
TAILSCALE_AUTHKEY=<from tailscale.com/admin/settings/keys>
TAILSCALE_HOSTNAME=pullwright-api
```

Replace `Redis` in `${{Redis.REDIS_PRIVATE_URL}}` if your Redis service has a different name.

4. **Networking** → **Generate domain** (temporary `*.up.railway.app`)
5. **Settings** → disable serverless sleep / keep service **always on** (SSE + worker need it)

### Step 2.4 — Add Frontend

1. **+ New** → **GitHub Repo** → same repo (second service)
2. **Settings**:
   - **Service name:** `web`
   - **Root directory:** `frontend`
3. **Variables** (build-time — redeploy after changing):

```env
VITE_API_URL=https://api.pullwright.iayush.com
```

4. **Networking** → **Generate domain**

### Step 2.5 — Custom domains

In your DNS provider (Cloudflare, Vercel DNS, etc.):

| Record | Type | Value |
|--------|------|-------|
| `pullwright` | CNAME | Railway `web` service target |
| `api.pullwright` | CNAME | Railway `api` service target |

In Railway, add custom domains under each service’s **Networking** tab and wait for SSL (~5–15 min).

Verify:

```bash
curl https://api.pullwright.iayush.com/health
# {"status":"ok",...}
```

`/health/docker` will be **503** until Part 3 is done — that’s expected.

---

## Part 3 — Oracle Cloud free VM (Docker host)

### Step 3.1 — Create the VM

1. [Oracle Cloud Console](https://cloud.oracle.com) → **Compute** → **Instances** → **Create instance**
2. **Name:** `pullwright-docker`
3. **Image:** Ubuntu 22.04 or 24.04
4. **Shape:** **Ampere** → `VM.Standard.A1.Flex` → **1 OCPU, 6 GB RAM** (always free eligible)
   - If Ampere is unavailable in your region, try another region or use AMD `VM.Standard.E2.1.Micro` (also free tier)
5. **Networking:** assign a public IPv4
6. **SSH key:** add your public key (`~/.ssh/id_ed25519.pub`)
7. **Create**

Note the **public IP**.

### Step 3.2 — Open SSH port only

Oracle **Security List** / **Network Security Group**:

- Allow **TCP 22** from your IP (SSH)
- Do **not** open port 2375 to the internet

### Step 3.3 — SSH into the VM

```bash
ssh ubuntu@<ORACLE_PUBLIC_IP>
```

### Step 3.4 — Clone repo (optional, for sandbox Dockerfile)

```bash
sudo mkdir -p /opt/pullwright
sudo chown "$USER":"$USER" /opt/pullwright
git clone https://github.com/<your-user>/MyOwnDevin.git /opt/pullwright
```

### Step 3.5 — Run setup script

```bash
cd /opt/pullwright
sudo bash scripts/setup-docker-host.sh
```

The script will:

1. Install Docker Engine
2. Install Tailscale
3. Pause for you to run `tailscale up` (browser auth)
4. Configure `dockerd` to listen on **Tailscale IP only** (`:2375`)
5. Build `devin-sandbox:latest`

When finished, note the printed **Tailscale IP** (e.g. `100.73.45.12`).

### Step 3.6 — Manual Tailscale auth (if script paused)

```bash
sudo tailscale up
# Follow the URL in the terminal to log in
tailscale ip -4
```

### Step 3.7 — Verify Docker on the VM

```bash
docker ps
docker images | grep devin-sandbox
```

---

## Part 4 — Connect Railway to Oracle Docker

### Step 4.1 — Create Tailscale auth key for Railway

1. [Tailscale Admin → Settings → Keys](https://login.tailscale.com/admin/settings/keys)
2. **Generate auth key**
   - Reusable: **Yes** (Railway redeploys need it)
   - Expiration: 90 days (set a calendar reminder to rotate)
3. Copy the key (`tskey-auth-...`)

### Step 4.2 — Update Railway API variables

In Railway `api` service → **Variables**:

```env
DOCKER_HOST=tcp://100.x.x.x:2375
TAILSCALE_AUTHKEY=tskey-auth-...
TAILSCALE_HOSTNAME=pullwright-api
```

Use the **Oracle VM Tailscale IP** from Part 3.

**Redeploy** the `api` service (Railway → Deployments → Redeploy).

### Step 4.3 — Verify Docker from Railway

```bash
curl https://api.pullwright.iayush.com/health/docker
```

Expected:

```json
{"status":"ok","socket":"default"}
```

If `503`, check Railway deploy logs for Tailscale errors and confirm both machines appear in [Tailscale admin machines](https://login.tailscale.com/admin/machines).

---

## Part 5 — GitHub OAuth

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Edit your app:

| Field | Value |
|-------|-------|
| Homepage URL | `https://pullwright.iayush.com` |
| Authorization callback URL | `https://api.pullwright.iayush.com/api/auth/github/callback` |

3. Copy **Client ID** and **Client Secret** into Railway `api` variables if not already set
4. Redeploy `api`

---

## Part 6 — End-to-end test

1. Open `https://pullwright.iayush.com`
2. **Sign in with GitHub** → should land on dashboard (no login loop)
3. `curl https://api.pullwright.iayush.com/health/docker` → `ok`
4. Submit a small test issue (demo issue on your repo)
5. Open task view → live log should stream; sandbox should run on Oracle

---

## Troubleshooting

### Login loop after GitHub OAuth

- `FRONTEND_URL` must exactly match browser URL (`https://`, no trailing slash)
- `BACKEND_URL` must match API domain
- `NODE_ENV=production` on API
- OAuth callback must be `{BACKEND_URL}/api/auth/github/callback`

### `/health/docker` returns 503

| Check | Fix |
|-------|-----|
| `DOCKER_HOST` wrong IP | Use `tailscale ip -4` on Oracle VM |
| Tailscale not on Railway | Check `TAILSCALE_AUTHKEY` in variables; read deploy logs |
| Machines not on same tailnet | Both must show in Tailscale admin |
| Sandbox image missing | On VM: `docker build -t devin-sandbox:latest /opt/pullwright/backend/src/sandbox` |
| Docker not listening | On VM: `sudo systemctl status docker` |

### Task queued but never runs

- Redis: confirm `REDIS_URL=${{Redis.REDIS_PRIVATE_URL}}`
- API logs in Railway → look for BullMQ / worker errors

### Live log not updating

- API and worker must stay on the **same** Railway service (don’t split worker to another host without code changes)

### Oracle “Out of capacity” for Ampere

- Try another region (Phoenix, Ashburn, Frankfurt, etc.)
- Or use `VM.Standard.E2.1.Micro` (AMD, 1 GB — tight but works for Docker-only host)

---

## Security notes

- Never expose Docker `2375` on a **public** IP without TLS
- This guide binds Docker to the **Tailscale IP** only
- Rotate `TAILSCALE_AUTHKEY` periodically
- Rotate `SESSION_SECRET` if compromised

---

## Environment cheat sheet

| Variable | Service | Required |
|----------|---------|----------|
| `REDIS_URL` | api | ✅ private Railway URL |
| `FRONTEND_URL` | api | ✅ |
| `BACKEND_URL` | api | ✅ |
| `VITE_API_URL` | web | ✅ |
| `NODE_ENV=production` | api | ✅ |
| `SESSION_SECRET` | api | ✅ |
| `GITHUB_CLIENT_ID/SECRET` | api | ✅ |
| `DOCKER_HOST` | api | ✅ after Oracle setup |
| `TAILSCALE_AUTHKEY` | api | ✅ for Railway→Oracle |
| LLM keys | api | ✅ at least one |

---

## Plan B (if Tailscale on Railway is painful)

Run the **full backend** on the Oracle VM (Docker works natively, no `DOCKER_HOST` needed). Keep only **frontend + Redis** on Railway. Point `api.pullwright.iayush.com` A record to Oracle public IP and use Caddy/nginx for HTTPS.

See `DEPLOY.md` for Railway-only UI setup; backend env vars are the same except `REDIS_URL` uses Railway’s **public** Redis URL instead of private.

---

## Monthly cost

| Item | Cost |
|------|------|
| Railway ($20 plan) | $20 (you already have this) |
| Oracle VM | $0 |
| Tailscale personal | $0 |
| **Total** | **$20/month** |
