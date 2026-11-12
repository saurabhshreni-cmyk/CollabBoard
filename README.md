<div align="center">

# 🎨 CollabBoard

### A real-time collaborative whiteboard — draw together on an infinite canvas

Create a room, share the link, and sketch, plan and brainstorm with anyone, live.<br/>
No sign-up. No install. Just a link.

<br/>

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-collabboard--3vp6.onrender.com-6366F1?style=for-the-badge)](https://collabboard-3vp6.onrender.com)

[![CI](https://github.com/saurabhshreni-cmyk/CollabBoard/actions/workflows/ci.yml/badge.svg)](https://github.com/saurabhshreni-cmyk/CollabBoard/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-240_passing-22c55e)
![License](https://img.shields.io/badge/license-MIT-blue)

![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-STOMP-010101)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

<br/>

<a href="https://collabboard-3vp6.onrender.com">
  <img src="docs/screenshots/board.png" alt="A CollabBoard board with a flow diagram, sticky notes, hand-drawn strokes and emoji stamps" width="900"/>
</a>

<sub>The live demo runs on a free plan, so the first visit after a quiet spell takes up to a minute while the server wakes up.</sub>

<br/><br/>

[Features](#-features) ·
[How it works](#-how-it-works) ·
[Engineering highlights](#-engineering-highlights) ·
[Quick start](#-quick-start) ·
[API](#-api-reference) ·
[Deploy](#-deploying)

</div>

---

## ✨ Features

<table>
<tr>
<td width="33%" valign="top">

### ✏️ Draw

- Smooth freehand **pen** and **highlighter**
- **Shapes** — rectangle, circle, diamond, triangle
- **Arrows**, **text** and **sticky notes**
- **Emoji stamps** 👍 ❤️ 🔥 ✅ ❓ ⭐
- **Laser pointer** that fades away
- **Eraser** — click or sweep

</td>
<td width="33%" valign="top">

### 🤝 Collaborate

- Every change appears **live** for everyone
- **Live cursors** with names and tools
- See text **as it is typed**
- **Who's online** roster
- Works across **tabs, devices and networks**
- **Keeps working offline**, syncs on return

</td>
<td width="33%" valign="top">

### 🧭 Navigate & edit

- **Infinite canvas** — zoom 10%–500%, pan
- **Touch**: drag to pan, pinch to zoom
- Select, **move, resize, rotate**, recolour
- **Undo / redo** that only undoes *your* work
- **Minimap**, grid and snap-to-grid
- **Export** to PNG, JPEG or clipboard

</td>
</tr>
</table>

<div align="center">
  <img src="docs/screenshots/landing.png" alt="The CollabBoard landing page: create a room or join one with a code" width="760"/>
</div>

The full list is in [FEATURES.md](FEATURES.md).

---

## 🧩 How it works

> **The browser draws immediately and tells the server; the server saves the change and tells everyone else.**

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice's browser
    participant S as Spring Boot server
    participant D as PostgreSQL
    participant B as Bob's browser

    A->>A: Draw the shape on screen right away
    A->>S: STOMP  /app/room/{code}/draw
    S->>S: Validate and sanitise the event
    S->>D: Lock the room row, update the snapshot, commit
    S-->>A: Broadcast  /topic/room/{code}
    S-->>B: Broadcast  /topic/room/{code}
    A->>A: Own echo → mark as confirmed
    B->>B: Apply the event → shape appears
```

### Architecture

```mermaid
flowchart LR
    subgraph Browser["🌐 Browser — React 18 + Konva"]
        UI["Canvas · Toolbar · Top bar"]
        Board["useBoard<br/>shapes · undo/redo · resync"]
        WS["useWebSocket<br/>STOMP client · offline queue"]
        UI --> Board --> WS
    end

    subgraph Server["☕ Spring Boot 3.5"]
        REST["RoomController<br/>REST API"]
        RT["WhiteboardController<br/>STOMP handlers"]
        San["BoardEventSanitizer"]
        Svc["RoomService"]
        Pres["PresenceService"]
        Broker(["Message broker<br/>/topic/room/*"])
        RT --> San --> Svc
        RT --> Pres
        REST --> Svc
        RT --> Broker
    end

    DB[("🐘 PostgreSQL<br/>rooms")]

    Board -- "HTTP: create / load a room" --> REST
    WS <-- "WebSocket: live events" --> RT
    Broker -. "broadcast" .-> WS
    Svc --> DB
```

Two channels, each for what it is good at:

| Channel | Used for | Why |
| ------- | -------- | --- |
| **REST over HTTP** | Creating and loading a room | One question, one answer. Also how a client recovers after reconnecting |
| **STOMP over WebSocket** | Drawing, cursors, presence | The server must push to every browser the instant something changes |

---

## 🏆 Engineering highlights

The drawing is the easy part. The hard part is keeping everyone's board **identical** when people act at the same moment or lose their connection.

| Problem | What goes wrong | How it is solved |
| ------- | --------------- | ---------------- |
| **Lost updates** | Two people draw at once; one stroke silently disappears from the saved board | Every change runs in a transaction holding a **database row lock** (`SELECT … FOR UPDATE`) |
| **Out-of-order events** | A "draw" then "delete" is processed as "delete" then "draw", leaving a zombie shape | Each client's messages are handled **strictly in the order sent** |
| **Diverging clients** | Two people edit the same shape and end up looking at different boards | Each tab tracks its **unconfirmed edits** and ignores stale incoming ones until the server confirms |
| **Dropped connections** | Work done offline is lost; missed changes never arrive | Changes are **queued and flushed in order**, then the board **resyncs** from the server |
| **Undo wipes others' work** | Undoing your stroke erases what a teammate drew since | Undo is **per person and operation-based** — it reverses only your own action |
| **Two tabs, one person** | Tabs ignore each other; closing one marks you offline | A per-tab **client id** for echoes, and presence tracked **per connection** |
| **Large strokes kill the socket** | A long line exceeds the server's default 8 KB frame and drops the connection | Frame limit raised, strokes **thinned and capped** on the client |
| **Untrusted input** | Anyone with a room code can send arbitrary JSON to every other browser | Every event is **rebuilt from an allowlist** with size and range limits |

Each of these was reproduced with a failing test before it was fixed — including tests that connect **real STOMP clients to a live server**.

---

## 🧰 Tech stack

| Layer | Technology |
| ----- | ---------- |
| **Backend** | Java 17 · Spring Boot 3.5 · Spring WebSocket (STOMP + SockJS) · Spring Data JPA · Lombok |
| **Database** | PostgreSQL 16 (H2 in memory for development and tests) |
| **Frontend** | React 18 · Vite 8 · Konva + react-konva · perfect-freehand · @stomp/stompjs · React Router 7 · Tailwind CSS |
| **Testing** | JUnit 5 · AssertJ · Mockito · Spring Boot Test · Vitest · Testing Library · ESLint |
| **Delivery** | Docker (multi-stage) · GitHub Actions · Render |

---

## 🚀 Quick start

### Option 1 — No database needed (recommended)

Requires Java 17+ and Node.js 20.19+ / 22.12+. The `dev` profile uses an in-memory database.

```bash
# Terminal 1 — backend on :8080
cd collabboard-backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev      # Windows: .\mvnw.cmd

# Terminal 2 — frontend on :5173
cd collabboard-frontend
npm ci
npm run dev
```

Open **http://localhost:5173**, create a room, and open the same link in a second tab to collaborate with yourself.

> **Windows:** double-click `start-collabboard.cmd` to do all of the above, and `stop-collabboard.cmd` to stop.

<details>
<summary><b>Option 2 — Everything in Docker</b></summary>

<br/>

```bash
docker compose up --build
```

Starts PostgreSQL, the backend and the frontend. Open **http://localhost:5173**. Data persists in the `collabboard_pgdata` volume; `docker compose down -v` wipes it.

</details>

<details>
<summary><b>Option 3 — With your own PostgreSQL</b></summary>

<br/>

```bash
createdb collabboard

cd collabboard-backend
export DB_URL=jdbc:postgresql://localhost:5432/collabboard
export DB_USERNAME=postgres
export DB_PASSWORD=yourpassword
./mvnw spring-boot:run

cd ../collabboard-frontend
npm ci && npm run dev
```

Tables are created automatically on first start.

</details>

<details>
<summary><b>Sharing a local board with another device</b></summary>

<br/>

`localhost` links only work on your own machine. Click **Share** in the top bar: it detects this and offers your network address instead, so anyone on the same WiFi can join. For a public link, see [Deploying](#-deploying).

</details>

---

## 🧪 Tests

```bash
cd collabboard-backend  && ./mvnw test                  # 102 tests
cd collabboard-frontend && npm test && npm run lint     # 138 tests + ESLint
```

| Suite | What it covers |
| ----- | -------------- |
| **Backend** | Room lifecycle, snapshot changes, **concurrent writers**, board limits, event sanitising, presence, rate limiting, REST contracts, and **live WebSocket tests** with real STOMP clients |
| **Frontend** | Board operations and undo entries, the board hook (optimistic edits, resync replay), pending-edit reconciliation, the API client, drawing utilities and UI components |

GitHub Actions runs both suites, the linter, a dependency audit and all three Docker image builds on every push.

---

## 🔌 API reference

<details>
<summary><b>REST endpoints</b></summary>

<br/>

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/rooms` | Create a room → `201` with a 6-character code (`429` when rate-limited) |
| `GET` | `/api/rooms/{code}` | Fetch a room and its board snapshot (`404` if unknown; codes are case-insensitive) |
| `PUT` | `/api/rooms/{code}/name` | Rename the board — body `{"boardName": "..."}` |
| `DELETE` | `/api/rooms/{code}/clear` | Reset the board to empty |
| `GET` | `/api/rooms/{code}/users` | Who is online in the room |
| `GET` | `/api/health` | `{status, timestamp, roomCount}` |
| `GET` | `/api/network` | Host LAN addresses for the share dialog (**`dev` profile only**) |

Errors are RFC 7807 problem details: `{"status": 404, "detail": "Room not found: ABC123"}`.

</details>

<details>
<summary><b>WebSocket (STOMP over SockJS at <code>/ws</code>)</b></summary>

<br/>

| Direction | Destination | Payload |
| --------- | ----------- | ------- |
| send | `/app/room/{code}/draw` | A board event |
| send | `/app/room/{code}/presence` | `{type: "join", userId, userName, userColor}` or `{type: "leave"}` |
| subscribe | `/topic/room/{code}` | Every board event for the room |
| subscribe | `/topic/room/{code}/presence` | The online roster whenever it changes |

**Event types**

| Type | Saved? | Meaning |
| ---- | :----: | ------- |
| `draw` | ✅ | Add a shape (replaces one with the same id) |
| `update` | ✅ | Replace an existing shape. Never creates one |
| `delete` | ✅ | Remove shapes by id |
| `clear` / `replace` | ✅ | Empty or swap the whole board |
| `rename` | ✅ | Change the board name; the server echoes the tidied name |
| `preview` | – | Text being typed, shown live |
| `cursor` / `laser` | – | Pointer position / laser stroke |
| `sync` | – | Marker a client sends after reconnecting |
| `rejected` | – | Server → client: a change could not be applied |

Limits: 256 KB per message, 5,000 shapes and 4 MB per board.

</details>

<details>
<summary><b>Environment variables</b></summary>

<br/>

**Backend**

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `DATABASE_URL` | `postgresql://user:pass@host/db`, as hosting providers inject | – |
| `DB_URL` · `DB_USERNAME` · `DB_PASSWORD` | Alternative: the JDBC URL and credentials separately | local PostgreSQL |
| `PORT` | HTTP port | `8080` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins (REST and WebSocket) | the service's own URL on Render, otherwise `*` |
| `ROOM_RETENTION_DAYS` | Delete rooms idle for this many days; `0` keeps them | `0` |
| `ROOM_CREATIONS_PER_MINUTE` | Rooms one address may create per minute | `20` |
| `DB_POOL_SIZE` | Maximum database connections | `5` |

**Frontend** (read at build time; leave unset unless the API is on a different host)

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `VITE_API_BASE_URL` | Backend base URL | derived from the page's address |
| `VITE_WS_URL` | WebSocket endpoint | `<API base>/ws` |

</details>

<details>
<summary><b>Project structure</b></summary>

<br/>

```
CollabBoard/
├── collabboard-backend/                 Spring Boot API + WebSocket server
│   └── src/main/java/com/collabboard/
│       ├── config/                      WebSocket, CORS, rate limit, security headers
│       ├── controller/                  REST (rooms, health) + STOMP (whiteboard)
│       ├── dto/                         Draw event, shape, room, presence
│       ├── model/                       Room entity
│       ├── repository/                  Spring Data repository (with row locking)
│       └── service/                     Rooms, event sanitizer, presence, cleanup
├── collabboard-frontend/                React + Vite client
│   └── src/
│       ├── api/                         fetch-based room API
│       ├── components/                  Landing, room, canvas, toolbars, minimap, cursors…
│       ├── hooks/                       useBoard, useWebSocket, useHistory, useUserIdentity…
│       └── utils/                       Board operations, pending edits, drawing helpers
├── .github/workflows/ci.yml             Lint, test, audit and build images on every push
├── Dockerfile                           Single image: frontend baked into the server
├── render.yaml                          Render blueprint: app + database
└── docker-compose.yml                   Local stack: db + backend + frontend
```

</details>

---

## ☁️ Deploying

The whole app deploys to Render as **one service**. The root `Dockerfile` builds the frontend and bakes it into the Spring Boot server, which then serves the web UI, the API and the WebSocket from a single URL — nothing to configure.

1. Push the repo to GitHub.
2. On Render: **New +** → **Blueprint** → select the repo → **Apply**.

Or run the same image anywhere:

```bash
docker build -t collabboard .
docker run -p 8080:8080 -e DATABASE_URL=postgresql://user:pass@host:5432/collabboard collabboard
```

[DEPLOY.md](DEPLOY.md) has the full walkthrough, optional settings, how to use a database that does not expire, and the alternative split deployment.

---

## ⚠️ Known limitations

- **No authentication** — anyone with a room code can view and edit that board.
- **Last write wins per shape** — two people editing the *same* shape at the same instant: the later edit replaces the earlier one. Edits to different shapes never conflict.
- **Undo history is per tab** and is lost on reload.
- **Single server instance** — presence and the message broker are in memory; several instances would need an external broker.
- **Export captures the visible area**, not the whole canvas.

---

## 🤝 Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Make your change, then run `./mvnw test` and `npm test && npm run lint`
3. Check real-time sync locally with two browser tabs
4. Open a pull request describing what changed and why

---

<div align="center">

## 📄 License

MIT — see [LICENSE](LICENSE).

<br/>

**[▶ Try the live demo](https://collabboard-3vp6.onrender.com)** · If you like the project, a ⭐ on GitHub is appreciated.

</div>
