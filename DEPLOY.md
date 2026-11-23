# 🚀 Getting a public link

Right now the board runs on `localhost`, which only works on your own machine.
This guide gets you a permanent `https://` link anyone can open.

Everything below uses **free tiers** — no card required.

| | Same WiFi only | Anyone, anywhere |
|---|---|---|
| Setup time | none — already works | ~10 minutes, once |
| Link | `http://192.168.x.x:5173` | `https://collabboard-xxxx.onrender.com` |
| Needs your laptop on | yes | no |
| Steps | [Option A](#option-a--share-over-your-wifi) | [Option B](#option-b--deploy-it-publicly) |

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

The app — web page, API and live connection — deploys to **Render** as one
free service from one file (`render.yaml`), and keeps its boards in a free
**Neon** PostgreSQL database. The server serves the web page itself, so there
is a single URL; the only setting is the database's connection string.

### Step 1 — Push to GitHub

Render deploys from the GitHub repository
(**https://github.com/saurabhshreni-cmyk/CollabBoard**), so the code has to be
there first:

```bash
git add .
git commit -m "your message"
git push
```

`.gitignore` already excludes `node_modules/`, `target/`, `logs/` and any `.env`
file, so no secrets or build output get committed. The CI workflow then runs
the tests and builds the Docker images on every push.

### Step 2 — Create a free database on Neon

Render's own free PostgreSQL is deleted 30 days after it is created, so the app
keeps its boards in [Neon](https://neon.com) instead. Neon's free plan is
permanent and needs no card.

1. Sign up at [neon.com](https://neon.com) (GitHub sign-in works).
2. Create a project. Pick the region closest to your Render service (Render's
   free region is usually Oregon or Frankfurt; Neon's `AWS US West (Oregon)` or
   `AWS Europe Central (Frankfurt)` match them).
3. On the project dashboard click **Connect**. Leave **Connection pooling**
   **off** — the app keeps its own small pool, so it uses the direct connection.
4. Copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:npg_xxxx@ep-xxxx.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   Treat it like a password: paste it only into Render, never into the code.

The app creates its table on first start; there is nothing to run in Neon.

### Step 3 — Create the app on Render

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New +** → **Blueprint** → pick the `CollabBoard` repo.
3. Render reads `render.yaml`, offers to create the **collabboard** web
   service, and asks for **`DATABASE_URL`**. Paste the Neon connection string
   from step 2, then click **Apply**.
4. Wait for the first build (~5–8 minutes — it builds the web page and the
   server inside Docker).
5. When it's live, open the URL Render shows. It looks like
   `https://collabboard-xxxx.onrender.com` (this project runs at https://collabboard-3vp6.onrender.com).

That is the only setting:

- The app converts the `postgresql://…` string into the form Java needs at
  startup, including the user name, password and SSL settings.
- The server only accepts requests from its own public address, which Render
  tells it automatically.

### Step 4 — Confirm it works

1. Open `<your url>/api/health` — you should see `{"status":"UP",...}`.
2. Open your URL, create a board, and open the link on a phone using mobile
   data (not WiFi). You should see both cursors moving live.
3. Redeploy the service once (**Manual Deploy → Deploy latest commit**) and
   check the board is still there. That proves it is stored in Neon.

> **Free tier notes**
> - The app sleeps after 15 minutes without visitors, so the first visit after a
>   quiet spell takes ~30–60 seconds. The page says "the server is waking up"
>   while it waits.
> - Neon's free database also pauses after 5 minutes without queries and wakes
>   in well under a second on the next one. You will not notice it next to the
>   app's own wake-up.
> - Neon's free plan includes 1 GB of storage and 100 compute-hours per month
>   per project, far more than this app needs.

---

## Optional settings

Set these on the Render service under **Environment** if you want them:

| Name | What it does | Default |
| ---- | ------------ | ------- |
| `ROOM_RETENTION_DAYS` | Deletes boards nobody has touched for this many days, which keeps a small database from filling up. `0` keeps everything. | `0` |
| `ROOM_CREATIONS_PER_MINUTE` | How many boards one address may create per minute. | `20` |
| `DB_POOL_SIZE` | Maximum database connections. | `5` |
| `CORS_ALLOWED_ORIGINS` | Other websites allowed to use this server. Only needed if you host the web page separately (below). | the app's own URL |

## Moving an existing deployment to Neon

If your service was created when this project still used Render's own free
database (`collabboard-db`), move it before that database expires:

1. **Create the Neon database** (step 2 above).
2. **Copy your boards across (optional).** Skip this if you do not need the
   existing boards. Otherwise, in Render open **collabboard-db → Connect** and
   copy the **External Database URL**, then run this on any machine with
   Docker, replacing the two strings:
   ```bash
   docker run --rm postgres:16 sh -c 'pg_dump --no-owner --no-acl "RENDER_EXTERNAL_URL" | psql "NEON_CONNECTION_STRING"'
   ```
3. **Point the app at Neon.** On the **collabboard** service → **Environment**,
   change `DATABASE_URL` to the Neon connection string and save. Render
   redeploys automatically.
4. **Check it** as in step 4 above.
5. **Delete the old database** in Render (**collabboard-db → Settings →
   Delete Database**). Removing it from `render.yaml` does not delete it.

## Alternative: web page on Vercel, server on Render

You only need this if you specifically want the web page on Vercel's network.
It is more to set up, because the two halves live at different addresses.

1. Deploy the server to Render as above.
2. On [vercel.com](https://vercel.com): **Add New** → **Project** → pick the
   repo, set **Root Directory** to `collabboard-frontend`, and add two
   environment variables using your Render URL:

   | Name | Value |
   | ---- | ----- |
   | `VITE_API_BASE_URL` | `https://collabboard-xxxx.onrender.com` |
   | `VITE_WS_URL` | `https://collabboard-xxxx.onrender.com/ws` |

3. **Deploy**, then on Render set `CORS_ALLOWED_ORIGINS` to your exact Vercel
   URL (for example `https://collabboard.vercel.app`, no trailing slash).

Vite bakes `VITE_*` values in at build time — after changing them you must
**redeploy** the Vercel project, not just save.

---

## Troubleshooting

**The build fails on Render**
Open the service's **Logs** tab; the failing step is near the end. The same
build runs in GitHub Actions on every push, so a red ✗ there shows the problem
before Render does.

**The page loads but stays "Connecting…"**
The live connection is being blocked. If you set `CORS_ALLOWED_ORIGINS`
yourself, it must exactly match the address in your browser's address bar
(including `https://`, without a trailing slash). If you did not set it, remove
any value and redeploy.

**"Failed to load the room" or "Could not reach the server"**
The server is probably asleep. Open `<your url>/api/health` and wait for it to
answer, then reload.

**"Too many rooms created"**
The server limits board creation to 20 per minute per address. Wait a minute,
or raise `ROOM_CREATIONS_PER_MINUTE`.

**Everything worked, then broke a month later**
The service is still using an expired Render database. Follow
[Moving an existing deployment to Neon](#moving-an-existing-deployment-to-neon).

**Logs say "SSL" or "password authentication failed"**
`DATABASE_URL` was pasted incompletely. Copy the whole Neon string again,
including everything after `?`, and save.
