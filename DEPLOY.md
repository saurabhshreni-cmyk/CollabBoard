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

The whole app — web page, API and database — deploys to **Render** as one
service from one file (`render.yaml`). The server serves the web page itself,
so there is a single URL and nothing to wire together.

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

### Step 2 — Create the app on Render

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New +** → **Blueprint** → pick the `CollabBoard` repo.
3. Render reads `render.yaml` and offers to create **collabboard-db** (the
   database) and **collabboard** (the app). Click **Apply**.
4. Wait for the first build (~5–8 minutes — it builds the web page and the
   server inside Docker).
5. When it's live, open the URL Render shows. It looks like
   `https://collabboard-xxxx.onrender.com`.

That's it. There are no environment variables to set:

- The database connection is wired up for you. Render injects `DATABASE_URL`
  in `postgresql://…` form and the app converts it at startup.
- The server only accepts requests from its own public address, which Render
  tells it automatically.

### Step 3 — Confirm it works

1. Open `<your url>/api/health` — you should see `{"status":"UP",...}`.
2. Open your URL, create a board, and open the link on a phone using mobile
   data (not WiFi). You should see both cursors moving live.

> **Free tier caveats**
> - The app sleeps after 15 minutes without visitors, so the first visit after a
>   quiet spell takes ~30–60 seconds. The page says "the server is waking up"
>   while it waits.
> - Free Render databases are deleted about 30 days after creation. See
>   [Keeping your boards longer](#keeping-your-boards-longer).

---

## Optional settings

Set these on the Render service under **Environment** if you want them:

| Name | What it does | Default |
| ---- | ------------ | ------- |
| `ROOM_RETENTION_DAYS` | Deletes boards nobody has touched for this many days, which keeps a small database from filling up. `0` keeps everything. | `0` |
| `ROOM_CREATIONS_PER_MINUTE` | How many boards one address may create per minute. | `20` |
| `DB_POOL_SIZE` | Maximum database connections. Free databases allow few. | `5` |
| `CORS_ALLOWED_ORIGINS` | Other websites allowed to use this server. Only needed if you host the web page separately (below). | the app's own URL |

## Keeping your boards longer

The app works with any PostgreSQL database, so you are not tied to Render's
30-day free one. Create a free database at a provider that does not expire it
(for example [Neon](https://neon.tech) or [Supabase](https://supabase.com)),
copy its connection string (`postgresql://user:password@host/dbname?sslmode=require`),
and on Render set the service's `DATABASE_URL` to that string in place of the
linked database. Boards in the old database are not copied across.

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
The free Render database expired. Create a new database and point
`DATABASE_URL` at it (see [Keeping your boards longer](#keeping-your-boards-longer)).
