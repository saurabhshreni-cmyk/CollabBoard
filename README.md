# 🎨 CollabBoard

[![CI](https://github.com/saurabhshreni-cmyk/CollabBoard/actions/workflows/ci.yml/badge.svg)](https://github.com/saurabhshreni-cmyk/CollabBoard/actions/workflows/ci.yml) ![Java](https://img.shields.io/badge/Java-17-orange) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5-brightgreen) ![React](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-8-purple) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

A full-stack, real-time collaborative whiteboard. Create a room, share the link, and draw together live on an infinite canvas — freehand pen, highlighter, laser pointer, shapes, arrows, text, sticky notes, emoji stamps, live cursors, undo/redo, and image export. Boards persist to PostgreSQL, so anyone joining later sees the current state.

See [FEATURES.md](FEATURES.md) for the complete feature list.

---

## 🐳 Quick Start (Docker — one command)

The entire stack (PostgreSQL + Spring Boot backend + React frontend) runs with a single command. Requires only Docker Desktop.

```bash
docker compose up --build
```

Then open **http://localhost:5173**. The backend is on `http://localhost:8080` (health check at `/api/health`) and PostgreSQL on `5432`. Data persists in the `collabboard_pgdata` volume. Stop with `docker compose down` (add `-v` to also wipe the database).

---

## ✨ Highlights

- **Infinite canvas** — wheel or pinch zoom (0.1×–5×), drag / space-drag / two-finger pan, minimap, dot grid with optional snapping
- **Drawing tools** — pen (pressure-style via `perfect-freehand`), highlighter, laser pointer, rectangle, circle, diamond, triangle, arrow, text, sticky notes, emoji stamps, eraser
- **Selection & editing** — Konva transformer with resize/rotate, multi-select, floating selection toolbar, per-person undo/redo (100 steps) that never rolls back a collaborator's work
- **Real-time collaboration** — STOMP-over-SockJS sync of every shape, live cursors with names and tool icons, presence roster, auto-reconnect with status indicator
- **Survives a flaky connection** — changes made offline are queued and sent on reconnect, then the board resyncs with the server
- **Persistence** — the full board is stored as a JSON snapshot per room, so late joiners see everything
- **Export** — PNG, JPEG (2× pixel ratio), or copy straight to the clipboard
- **No login** — shareable 6-character room codes

---

## 🧰 Tech Stack

| Layer      | Technology                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Backend    | Java 17, Spring Boot 3.5, Spring WebSocket (STOMP), Spring Data JPA, Lombok                                                   |
| Database   | PostgreSQL 16 (H2 in-memory for tests)                                                                                        |
| Build      | Maven, Docker (multi-stage)                                                                                                   |
| Frontend   | React 18, Vite 8, react-konva + konva, perfect-freehand, @stomp/stompjs, sockjs-client, react-router 7, TailwindCSS            |
| Tests      | JUnit 5 + Spring Boot Test + Mockito, incl. live STOMP integration tests (backend); Vitest + Testing Library, ESLint (frontend) |
| Deploy     | Render — one Docker service serving UI + API, plus PostgreSQL (Vercel frontend optional)                                       |

---

## 📦 Project Structure

```
CollabBoard/
├── collabboard-backend/            # Spring Boot API + WebSocket server
│   ├── src/main/java/com/collabboard/
│   │   ├── config/                 # WebSocket, CORS, rate limit, STOMP disconnect listener
│   │   ├── controller/             # REST (rooms, health) + STOMP (whiteboard)
│   │   ├── dto/                    # Draw event, shape, room, presence DTOs
│   │   ├── model/                  # Room JPA entity
│   │   ├── repository/             # Spring Data repository
│   │   └── service/                # Room, presence, event sanitizer, cleanup task
│   ├── src/test/java/com/collabboard/   # JUnit 5 tests (H2-backed)
│   ├── Dockerfile
│   └── pom.xml
├── collabboard-frontend/           # React + Vite client
│   ├── src/
│   │   ├── api/                    # fetch-based room API
│   │   ├── components/             # Landing, room, canvas, toolbars, minimap, cursors…
│   │   ├── context/                # Toast provider
│   │   ├── hooks/                  # useBoard, useWebSocket, useHistory, useUserIdentity…
│   │   └── utils/                  # board operations, colour + drawing helpers (+ unit tests)
│   ├── Dockerfile / nginx.conf
│   └── package.json
├── .github/workflows/ci.yml        # Lint, test, audit and build images on every push
├── Dockerfile                      # Single image: frontend baked into the server (what Render deploys)
├── render.yaml                     # Render blueprint: app + database
└── docker-compose.yml              # Local stack: db + backend + frontend as separate services
```

---

## ✅ Prerequisites (non-Docker setup)

- **Java 17+** (`java -version`)
- **Node.js 20.19+ or 22.12+** and npm (`node -v`)
- **PostgreSQL 14+** running locally — *not needed for the quick start below*

Maven is **not** required: the repo ships the Maven wrapper (`mvnw` / `mvnw.cmd`),
which downloads the pinned Maven version on first use.

---

## ⚡ Quick start (no database setup)

The `dev` profile runs the backend against an in-memory H2 database, so you can
be drawing in about a minute with nothing else installed.

```bash
# Terminal 1 — backend on :8080
cd collabboard-backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # Windows: .\mvnw.cmd

# Terminal 2 — frontend on :5173
cd collabboard-frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Boards live in memory and reset when the backend
stops; the H2 console is at `http://localhost:8080/h2-console` (JDBC URL
`jdbc:h2:mem:collabboard`, user `sa`, no password). For persistence across
restarts, use the PostgreSQL setup below instead.

On Windows you can just double-click **`start-collabboard.cmd`**, which does all
of the above and opens the browser. **`stop-collabboard.cmd`** shuts it down.

### Sharing the board

`localhost` links only work on your own machine. Click **Share** in the top bar —
it detects this and offers your LAN address instead, so anyone on the same WiFi
can join. For a permanent public link, see **[DEPLOY.md](DEPLOY.md)**.

---

## 🚀 Local Setup (PostgreSQL)

### 1. Create the database

```bash
createdb collabboard
```

(Or via psql: `CREATE DATABASE collabboard;`)

### 2. Configure and run the backend

```bash
cd collabboard-backend
cp .env.example .env    # or just export the variables below
export DB_URL=jdbc:postgresql://localhost:5432/collabboard
export DB_USERNAME=postgres
export DB_PASSWORD=yourpassword
export CORS_ALLOWED_ORIGINS=http://localhost:5173
./mvnw spring-boot:run
```

The API starts on `http://localhost:8080`. Tables are auto-created by Hibernate (`ddl-auto=update`).

### 3. Run the frontend

```bash
cd collabboard-frontend
npm install
npm run dev
```

### 4. Open the app

Visit **http://localhost:5173**, create a room, copy the link, and open it in a second tab or browser to see real-time collaboration.

> In dev the frontend talks to the backend on port 8080 of whatever host you opened the page on, and the `dev` profile allows that origin, so no CORS setup is needed locally.

---

## 🧪 Tests

```bash
# Backend — JUnit 5 against an in-memory H2 database, including tests that
# drive the real WebSocket endpoint on a live port
cd collabboard-backend && ./mvnw test

# Frontend — Vitest (jsdom) and ESLint
cd collabboard-frontend && npm test && npm run lint
```

Both suites, the linter, a dependency audit and both Docker image builds run in GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

---

## 🔧 Environment Variables

### Backend (`collabboard-backend`)

| Variable               | Description                                            | Default                                        |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `DB_URL`               | JDBC URL for PostgreSQL                                | `jdbc:postgresql://localhost:5432/collabboard` |
| `DB_USERNAME`          | Database username                                      | `postgres`                                     |
| `DB_PASSWORD`          | Database password                                      | `password`                                     |
| `DATABASE_URL`         | Alternative to the three above: a `postgresql://user:pass@host/db` URL, as Render/Railway/Heroku inject | –     |
| `PORT`                 | HTTP port                                              | `8080`                                         |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins (REST **and** SockJS)  | the service's own URL on Render, otherwise `*` |
| `ROOM_RETENTION_DAYS`  | Delete rooms idle for this many days; `0` keeps them forever | `0`                                      |
| `ROOM_CREATIONS_PER_MINUTE` | Rooms one client address may create per minute; `0` = unlimited | `20`                             |
| `DB_POOL_SIZE`         | Maximum database connections                           | `5`                                            |

### Frontend (`collabboard-frontend`)

| Variable             | Description                       | Default                       |
| -------------------- | --------------------------------- | ----------------------------- |
| `VITE_API_BASE_URL`  | Base URL of the backend API       | port 8080 on the page's host (dev) / same origin |
| `VITE_WS_URL`        | SockJS WebSocket endpoint         | `<API base>/ws`               |

Both are read at **build** time. Leave them unset locally; set them when the API is on a different host (see [DEPLOY.md](DEPLOY.md)).

---

## 🔌 API Reference

### REST

| Method   | Path                          | Description                                          |
| -------- | ----------------------------- | ---------------------------------------------------- |
| `POST`   | `/api/rooms`                  | Create a room → `201` with a 6-character code (`429` when rate-limited) |
| `GET`    | `/api/rooms/{code}`           | Fetch a room + its board snapshot (`404` if unknown; codes are case-insensitive) |
| `PUT`    | `/api/rooms/{code}/name`      | Rename the board — body `{"boardName": "..."}` (offline fallback for the `rename` STOMP event) |
| `DELETE` | `/api/rooms/{code}/clear`     | Reset the board snapshot to `[]`                     |
| `GET`    | `/api/rooms/{code}/users`     | Current presence roster for the room (each person once) |
| `GET`    | `/api/health`                 | `{status, timestamp, roomCount}`                     |
| `GET`    | `/api/network`                | `{addresses}` — host LAN IPs for the share dialog (**`dev` profile only**) |

### WebSocket (STOMP over SockJS at `/ws`)

| Direction | Destination                   | Payload                                                                       |
| --------- | ----------------------------- | ----------------------------------------------------------------------------- |
| send      | `/app/room/{code}/draw`       | Draw event (`draw`, `update`, `delete`, `replace`, `clear`, `rename`, `preview`, `cursor`, `laser`, `sync`) |
| send      | `/app/room/{code}/presence`   | `{type: "join", userId, userName, userColor}` or `{type: "leave"}`              |
| subscribe | `/topic/room/{code}`          | Every draw event broadcast to the room                                        |
| subscribe | `/topic/room/{code}/presence` | The room's user roster whenever it changes                                    |

Errors from the REST API are RFC 7807 problem details: `{"status": 404, "detail": "Room not found: ABC123"}`.

How the board channel behaves:

- **Persisted vs relayed.** Board-altering types (`draw`, `update`, `delete`, `replace`, `clear`) are applied to the room snapshot under a database row lock, then broadcast. `cursor`, `laser`, `sync` and `preview` are relayed only.
- **Validated.** Every event is sanitised server-side before it is stored or relayed: unknown types and malformed shapes are dropped, text and point counts are capped, and a board holds at most 5,000 shapes. Messages may be up to 256 KB.
- **Ordered.** One client's events are processed in the order it sent them.
- **`clientId`.** Each browser tab stamps its events with a unique `clientId` so it can ignore its own echo — which is what lets two tabs of the same person collaborate.
- **`preview`.** Text being typed into a note or label is shared as `preview` events, so others see it live without a database write per keystroke; the finished edit is saved as one `update`. An `update` never creates a shape, so a note deleted while someone is still typing in it stays deleted.
- **Optimistic, but convergent.** A tab applies its own edits immediately and treats the server's echo as confirmation. Until then it ignores incoming edits to the same shape, which the server will have applied first — so everyone ends on what the server saved.
- **`rejected`.** If the server cannot apply an event (board full, room gone) it broadcasts `{type: "rejected", clientId, reason}`; the sending tab shows the reason and reloads the saved board.
- **`sync`.** After (re)connecting, a client flushes anything it queued while offline, sends `sync`, and reloads the snapshot when the marker comes back.
- **`rename`** updates the board's name rather than its snapshot, and the server echoes the normalised (trimmed, ≤100 char) name back to every subscriber so all clients agree.
- **Presence** is tracked per connection: a person with two tabs open is listed once and stays online until the last tab closes.

---

## ☁️ Deploying

The whole app deploys to Render as **one service** from `render.yaml`: the root
`Dockerfile` builds the frontend and bakes it into the Spring Boot server, which
then serves the web UI, the API and the WebSocket from a single URL. There are
no environment variables to set and no cross-origin configuration.

1. Push the repo to GitHub.
2. On Render: **New +** → **Blueprint** → select the repo → **Apply**.

**[DEPLOY.md](DEPLOY.md)** has the full walkthrough, the optional settings, how
to use a database that does not expire, and the alternative split deployment
(frontend on Vercel, backend on Render).

To run the same image yourself:

```bash
docker build -t collabboard .
docker run -p 8080:8080 -e DATABASE_URL=postgresql://user:pass@host:5432/collabboard collabboard
```

---

## ⚠️ Known Limitations

- **No authentication** — anyone with a room code can view and edit that board.
- **Last write wins per shape.** There is no CRDT: if two people edit the *same* shape at the same moment, the later event replaces the earlier one. Edits to different shapes never conflict.
- **Undo history is per tab and in memory**, so it is lost on reload. Undoing a delete puts the shape back on top rather than at its old depth.
- **Single backend instance.** Presence and the message broker are in memory, so the roster resets on restart and running several instances would need an external broker (snapshot writes are already safe across instances).
- **Idle rooms are kept by default.** Set `ROOM_RETENTION_DAYS` to have rooms with no activity for that long deleted hourly.
- **Export captures the visible part of the board**, not the whole canvas.
- **Render free tier spin-down:** the backend sleeps after ~15 minutes of inactivity; the first request after that can take 30–60s.
- **Render free PostgreSQL expiry:** free databases are removed ~30 days after creation.

---

## 🤝 Contributing

1. Fork the repo and create a feature branch: `git checkout -b feature/my-feature`.
2. Commit your changes with clear messages.
3. Run `./mvnw test` and `npm test`, then verify real-time sync locally with two browser tabs.
4. Open a pull request describing what changed and why.

Issues and suggestions are welcome — please include reproduction steps for bugs.

---

## 📄 License

MIT — do whatever you like, attribution appreciated.
