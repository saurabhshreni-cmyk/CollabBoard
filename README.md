# 🎨 CollabBoard

![Java](https://img.shields.io/badge/Java-17-orange) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen) ![React](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

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

- **Infinite canvas** — wheel zoom (0.1×–5×), space/middle-drag pan, minimap, dot grid with optional snapping
- **Drawing tools** — pen (pressure-style via `perfect-freehand`), highlighter, laser pointer, rectangle, circle, diamond, triangle, arrow, text, sticky notes, emoji stamps, eraser
- **Selection & editing** — Konva transformer with resize/rotate, multi-select, floating selection toolbar, 50-step undo/redo
- **Real-time collaboration** — STOMP-over-SockJS sync of every shape, live cursors with names and tool icons, presence roster, auto-reconnect with status indicator
- **Persistence** — the full board is stored as a JSON snapshot per room, so late joiners see everything
- **Export** — PNG, JPEG (2× pixel ratio), or copy straight to the clipboard
- **No login** — shareable 6-character room codes

---

## 🧰 Tech Stack

| Layer      | Technology                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Backend    | Java 17, Spring Boot 3.2, Spring WebSocket (STOMP), Spring Data JPA, Lombok                                                   |
| Database   | PostgreSQL 16 (H2 in-memory for tests)                                                                                        |
| Build      | Maven, Docker (multi-stage)                                                                                                   |
| Frontend   | React 18, Vite 5, react-konva + konva, perfect-freehand, @stomp/stompjs, sockjs-client, axios, react-router-dom, TailwindCSS   |
| Tests      | JUnit 5 + Spring Boot Test + Mockito (backend), Vitest + Testing Library (frontend)                                            |
| Deploy     | Render (backend + DB), Vercel (frontend)                                                                                      |

---

## 📦 Project Structure

```
CollabBoard/
├── collabboard-backend/            # Spring Boot API + WebSocket server
│   ├── src/main/java/com/collabboard/
│   │   ├── config/                 # WebSocket, CORS, STOMP disconnect listener
│   │   ├── controller/             # REST (rooms, health) + STOMP (whiteboard)
│   │   ├── dto/                    # Draw event, shape, room, presence DTOs
│   │   ├── model/                  # Room JPA entity
│   │   ├── repository/             # Spring Data repository
│   │   └── service/                # Room, presence, cleanup task
│   ├── src/test/java/com/collabboard/   # JUnit 5 tests (H2-backed)
│   ├── Dockerfile
│   └── pom.xml
├── collabboard-frontend/           # React + Vite client
│   ├── src/
│   │   ├── api/                    # axios room API
│   │   ├── components/             # Landing, room, canvas, toolbars, minimap, cursors…
│   │   ├── context/                # Toast provider
│   │   ├── hooks/                  # useUserIdentity, useWebSocket, useHistory
│   │   └── utils/                  # colour + drawing helpers (+ unit tests)
│   ├── Dockerfile / nginx.conf
│   └── package.json
├── .github/workflows/ci.yml        # Build + test both apps on every push
└── docker-compose.yml
```

---

## ✅ Prerequisites (non-Docker setup)

- **Java 17** (`java -version`)
- **Maven 3.8+** (`mvn -version`)
- **Node.js 18+** and npm (`node -v`)
- **PostgreSQL 14+** running locally

---

## 🚀 Local Setup

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
mvn spring-boot:run
```

The API starts on `http://localhost:8080`. Tables are auto-created by Hibernate (`ddl-auto=update`).

### 3. Run the frontend

```bash
cd collabboard-frontend
npm install
npm run dev
```

### 4. Open the app

Visit **http://localhost:5173**, create a room, copy the link, and open it in a second browser/tab to see real-time collaboration.

> In dev, Vite proxies `/api` and `/ws` to `localhost:8080`, so no CORS setup is needed locally.

---

## 🧪 Tests

```bash
# Backend — JUnit 5 against an in-memory H2 database
cd collabboard-backend && mvn test

# Frontend — Vitest (jsdom)
cd collabboard-frontend && npm test
```

Both suites also run in GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

---

## 🔧 Environment Variables

### Backend (`collabboard-backend`)

| Variable               | Description                                            | Default                                        |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `DB_URL`               | JDBC URL for PostgreSQL                                | `jdbc:postgresql://localhost:5432/collabboard` |
| `DB_USERNAME`          | Database username                                      | `postgres`                                     |
| `DB_PASSWORD`          | Database password                                      | `password`                                     |
| `PORT`                 | HTTP port                                              | `8080`                                         |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins (REST **and** SockJS)  | `*`                                            |

### Frontend (`collabboard-frontend`)

| Variable             | Description                       | Default                       |
| -------------------- | --------------------------------- | ----------------------------- |
| `VITE_API_BASE_URL`  | Base URL of the backend API       | `http://localhost:8080`       |
| `VITE_WS_URL`        | SockJS WebSocket endpoint         | `http://localhost:8080/ws`    |

---

## 🔌 API Reference

### REST

| Method   | Path                          | Description                                          |
| -------- | ----------------------------- | ---------------------------------------------------- |
| `POST`   | `/api/rooms`                  | Create a room → `201` with a 6-character code        |
| `GET`    | `/api/rooms/{code}`           | Fetch a room + its board snapshot (`404` if unknown) |
| `PUT`    | `/api/rooms/{code}/name`      | Rename the board — body `{"boardName": "..."}`       |
| `DELETE` | `/api/rooms/{code}/clear`     | Reset the board snapshot to `[]`                     |
| `GET`    | `/api/rooms/{code}/users`     | Current presence roster for the room                 |
| `GET`    | `/api/health`                 | `{status, timestamp, roomCount}`                     |

### WebSocket (STOMP over SockJS at `/ws`)

| Direction | Destination                   | Payload                                                                       |
| --------- | ----------------------------- | ----------------------------------------------------------------------------- |
| send      | `/app/room/{code}/draw`       | Draw event (`draw`, `update`, `delete`, `replace`, `clear`, `cursor`, `laser`) |
| send      | `/app/room/{code}/presence`   | `{type: "join" \| "leave", userId, userName, userColor}`                       |
| subscribe | `/topic/room/{code}`          | Every draw event broadcast to the room                                        |
| subscribe | `/topic/room/{code}/presence` | The room's user roster whenever it changes                                    |

Board-altering event types are persisted to the room snapshot; `cursor`, `laser`, `join`, and `leave` are relayed only.

---

## ☁️ Deploy the Backend on Render

1. **Create a PostgreSQL database** — Render Dashboard → **New +** → **PostgreSQL** → Free plan. Copy the credentials. Render's URL looks like `postgres://user:pass@host/db`; for Spring use `jdbc:postgresql://host/db` and set username/password separately.

2. **Create the Web Service** — **New +** → **Web Service** → connect your repo.
   - **Root Directory:** `collabboard-backend`
   - **Runtime:** Docker (Render auto-detects the `Dockerfile`)

3. **Set environment variables:**

   | Key                    | Value                                                  |
   | ---------------------- | ------------------------------------------------------ |
   | `DB_URL`               | `jdbc:postgresql://<host>/<database>`                  |
   | `DB_USERNAME`          | from the Render Postgres credentials                   |
   | `DB_PASSWORD`          | from the Render Postgres credentials                   |
   | `CORS_ALLOWED_ORIGINS` | your Vercel URL, e.g. `https://collabboard.vercel.app` |

   > `PORT` is provided automatically by Render — the app already reads `${PORT}`.

4. **Deploy.** Your API will be at `https://<your-service>.onrender.com`.

---

## ▲ Deploy the Frontend on Vercel

1. Vercel Dashboard → **Add New** → **Project** → import your repo.
2. **Root Directory:** `collabboard-frontend`
3. **Framework Preset:** Vite (auto-detected). Build command `npm run build`, output directory `dist`.
4. **Environment Variables:**

   | Key                 | Value                                    |
   | ------------------- | ---------------------------------------- |
   | `VITE_API_BASE_URL` | `https://<your-service>.onrender.com`    |
   | `VITE_WS_URL`       | `https://<your-service>.onrender.com/ws` |

5. **Deploy**, then make sure the backend's `CORS_ALLOWED_ORIGINS` includes your Vercel domain and redeploy the backend if you changed it.

---

## ⚠️ Known Limitations

- **No authentication** — anyone with a room code can view and edit that board.
- **Undo/redo is per-client and broadcasts a full board replace.** If two people undo at the same moment, the last event wins.
- **Presence is in-memory**, so the roster resets if the backend restarts.
- **Idle rooms are logged, not deleted.** `RoomCleanupTask` flags rooms inactive for more than 7 days hourly; deletion is intentionally left as an opt-in change.
- **Render free tier spin-down:** the backend sleeps after ~15 minutes of inactivity; the first request after that can take 30–60s.
- **Render free PostgreSQL expiry:** free databases are removed ~30 days after creation.

---

## 🤝 Contributing

1. Fork the repo and create a feature branch: `git checkout -b feature/my-feature`.
2. Commit your changes with clear messages.
3. Run `mvn test` and `npm test`, then verify real-time sync locally with two browser tabs.
4. Open a pull request describing what changed and why.

Issues and suggestions are welcome — please include reproduction steps for bugs.

---

## 📄 License

MIT — do whatever you like, attribution appreciated.
