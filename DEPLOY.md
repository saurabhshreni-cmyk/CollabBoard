# 🚀 Getting a public link

Right now the board runs on `localhost`, which only works on your own machine.
This guide gets you a permanent `https://` link anyone can open.

Everything below uses **free tiers** — no card required.

There are two options. Pick based on who needs access.

| | Same WiFi only | Anyone, anywhere |
|---|---|---|
| Setup time | none — already works | ~30 minutes, once |
| Link | `http://192.168.x.x:5173` | `https://your-board.vercel.app` |
| Needs your laptop on | yes | no |
| Steps | [below](#option-a--share-over-your-wifi) | [below](#option-b--deploy-it-publicly) |

---

## Option A — Share over your WiFi

Already set up. Nothing to configure.

1. Start the app (`start-collabboard.cmd`).
2. Click **Share** in the top bar.
3. Copy the **network link** it shows and send it to someone on the same WiFi.

The share dialog asks the backend for your machine's IP, so the link it gives
you is the real one — not `localhost`.

**If it doesn't connect**, Windows Firewall is usually the cause. Allow Java and
Node through it, or run this once in an **Administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "CollabBoard" -Direction Inbound -LocalPort 5173,8080 -Protocol TCP -Action Allow
```

---

## Option B — Deploy it publicly

Three pieces: a database and backend on **Render**, the frontend on **Vercel**.

### Step 1 — Push to GitHub ✅ done

The repository is live at
**https://github.com/saurabhshreni-cmyk/CollabBoard** on the `main` branch, and
the CI workflow (backend tests, frontend tests, Docker image builds) runs green
on every push. Render and Vercel both deploy straight from that repo, so there
is nothing to do here — just keep pushing to `main`.

To push future changes:

```bash
git add .
git commit -m "your message"
git push
```

`.gitignore` already excludes `node_modules/`, `target/`, `logs/` and any `.env`
file, so no secrets or build output get committed.

### Step 2 — Backend + database on Render

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New +** → **Blueprint** → pick your `collabboard` repo.
3. Render reads `render.yaml` and offers to create **collabboard-db** and
   **collabboard-backend**. Click **Apply**.

   The database connection is wired up for you: Render injects `DATABASE_URL`
   in `postgresql://…` form, and the app converts it to the `jdbc:postgresql://…`
   form Spring needs at startup. You don't set any DB variables by hand.
4. Wait for the first build (~5 minutes — it compiles the jar in Docker).
5. When it's live, copy the URL. It looks like
   `https://collabboard-backend.onrender.com`.
6. Check it works: open `<that url>/api/health` — you should see
   `{"status":"UP",...}`.

> **Free tier caveat:** the backend sleeps after 15 minutes of inactivity, so
> the first visit after a quiet spell takes ~30 seconds to wake. Free Render
> databases are also deleted about 30 days after creation.

### Step 3 — Frontend on Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub.
2. **Add New** → **Project** → pick the same repo.
3. Set **Root Directory** to `collabboard-frontend`. Vercel detects Vite from
   `vercel.json`; leave the build settings alone.
4. Add two **Environment Variables**, using your Render URL from step 2:

   | Name | Value |
   | ---- | ----- |
   | `VITE_API_BASE_URL` | `https://collabboard-backend.onrender.com` |
   | `VITE_WS_URL` | `https://collabboard-backend.onrender.com/ws` |

5. **Deploy**. You'll get a URL like `https://collabboard.vercel.app`.

### Step 4 — Let the backend trust the frontend

Back in Render → **collabboard-backend** → **Environment**:

- Set `CORS_ALLOWED_ORIGINS` to your exact Vercel URL, e.g.
  `https://collabboard.vercel.app` (no trailing slash).
- Save. Render redeploys automatically.

This applies to both the REST API and the WebSocket handshake.

### Step 5 — Confirm it works

Open your Vercel URL, create a board, and paste the link into a phone on mobile
data (not WiFi). You should see both cursors moving live.

---

## Troubleshooting

**Board loads but stays "Connecting…"**
The WebSocket is blocked. Check `CORS_ALLOWED_ORIGINS` on Render exactly matches
your Vercel origin, and that `VITE_WS_URL` ends in `/ws`.

**"Failed to load room" / network errors in the console**
`VITE_API_BASE_URL` is wrong or the backend is asleep. Open
`<backend>/api/health` directly and wait for it to wake.

**Changes to environment variables did nothing**
Vite bakes `VITE_*` values in at build time — you must **redeploy** the Vercel
project after changing them, not just save.

**Everything worked, then broke a month later**
The free Render database expired. Create a new one and update the backend's
`DB_*` variables.
