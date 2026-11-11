# ✨ CollabBoard Features

A real-time collaborative whiteboard inspired by Excalidraw, Miro, and FigJam.
Java 17 + Spring Boot 3 backend, React 18 + Vite frontend, PostgreSQL persistence.

## Canvas & Drawing

- [x] **Infinite canvas** — wheel zoom (0.1×–5×), pan by dragging empty canvas with the Select tool, Space/middle-drag,
      or two fingers; pinch to zoom on touch screens; zoom % control with +/−/reset
- [x] **Minimap** — bottom-right overview of all shapes with a live viewport rectangle
- [x] **Smooth pen** — `perfect-freehand` pressure-style strokes rendered as Konva `Path`; points are thinned and
      rounded as you draw, so even a very long stroke stays a small message
- [x] **Highlighter** — thick translucent (opacity 0.4) stroke
- [x] **Laser pointer** — temporary red stroke, broadcast to others, fades after 3s, never persisted
- [x] **Shapes** — rectangle, circle/ellipse, diamond, triangle with stroke + fill colors
- [x] **Arrows** — two-click placement with arrowheads (Konva `Arrow`)
- [x] **Text** — zoom/pan-aware HTML textarea overlay, font size 12–72px, bold + italic.
      Editor and canvas share one font/line-height/padding config, so what you type is
      exactly what lands. Multi-line with word wrap; Esc or click-away commits
- [x] **Sticky notes** — 200×150 rounded notes, 5 colors, double-click to edit, draggable and resizable. Text appears
      for everyone as it is typed; placing a note switches to Select so the next click finishes typing and the
      note can be moved straight away; a whole edit is one undo step
- [x] **Reaction stamps** — 👍 ❤️ 🔥 ✅ ❓ ⭐ placed as 32px emoji nodes
- [x] **Eraser** — click a shape, or hold and sweep across several, to delete

## Selection & Editing

- [x] **Select tool** with Konva `Transformer` — resize + rotate handles (pen strokes and arrows included)
- [x] **Multi-select** with Shift+Click; **Select all** with Ctrl+A
- [x] **Drag to move**, delete with Delete/Backspace
- [x] **Floating selection toolbar** — quick color, stroke width, delete
- [x] **Undo / redo** — per-person and operation-based (100 steps): undo reverses *your* last action only and never
      rolls back what collaborators drew in the meantime. Clearing the board is undoable too
- [x] **Grid + snap-to-grid** at 20px, scales with zoom

## Real-time Collaboration

- [x] **Live drawing sync** over STOMP-over-SockJS WebSocket
- [x] **Live cursors** — name + current-tool icon, zoom/pan-aware, label fades after 2s, 30ms throttle
- [x] **Presence tracking** — per connection, so someone with two tabs open is listed once and stays online until
      the last tab closes; roster broadcast on `/presence`
- [x] **Multi-tab collaboration** — every tab has its own `clientId`, so two tabs in one browser sync like two people
- [x] **Connected users panel** — avatars + dropdown with names and "You"
- [x] **Auto-reconnect** with status indicator (green / yellow / red) and server heartbeats
- [x] **Offline queue + resync** — changes made while disconnected are queued, flushed in order on reconnect, and the
      board is then reloaded from the server so nothing missed stays missing
- [x] **Persistence** — full board (all shape types + transforms) stored as JSON snapshot
- [x] **Live board rename** — renaming from the top bar or settings panel is broadcast to
      every peer; the server echoes the normalised name so all clients converge

## UI / UX

- [x] **Floating pill toolbar** (bottom center) with context-sensitive options bar
- [x] **Redesigned top bar** — logo, status dot, room code + copy, inline board-name edit, zoom, undo/redo, grid, export, settings
- [x] **Animated dark landing page** with feature highlights
- [x] **Settings panel** — board name, background color, grid, snap, clear board; view preferences are remembered
- [x] **Toast notifications** — success / error / info, auto-dismiss, slide-out
- [x] **Keyboard shortcuts** + help modal (`?`)
- [x] **Export** — PNG, JPEG (2× pixel ratio), copy to clipboard
- [x] **Share dialog** — detects a `localhost` URL (which never works for anyone else),
      asks the backend for the machine's LAN address and offers a link that does work
- [x] **Empty-board hint** — a new board tells you what to do instead of showing a void
- [x] **Friendly failure states** — error boundary, 404 page, "server is waking up" hint for sleeping free-tier
      backends, and clear messages when the server is unreachable
- [x] **Works on a phone** — the top bar collapses to the essentials, the toolbar scrolls, and the canvas pans and
      zooms by touch
- [x] **Context-aware selection toolbar** — note colours for sticky notes, line width only for outlined shapes
- [x] **Accessible controls** — every icon button has a name and pressed state; dialogs and switches are announced

## Backend

- [x] **Presence service** — session→user map, cleanup on disconnect, a connection can only remove itself
- [x] **Board name** — `rename` STOMP event persists and broadcasts the name live;
      `PUT /api/rooms/{code}/name` is the fallback used while the socket is down
- [x] **Room retention** — hourly task; set `ROOM_RETENTION_DAYS` to delete idle rooms (off by default)
- [x] **Race-safe snapshot updates** — each event is applied under a database row lock, and one client's events are
      processed in the order they were sent
- [x] **Input sanitising** — every event is validated and trimmed before it is stored or relayed; boards are capped at
      5,000 shapes and 4 MB
- [x] **Rate limiting** — room creation is limited per client address (`429` + `Retry-After`)
- [x] **Large-message safe** — the WebSocket frame buffer is raised from Tomcat's 8 KB default so long strokes no
      longer drop the connection
- [x] **Problem-detail errors**, gzip, graceful shutdown, proxy-aware client addresses
- [x] **Serves the web UI** — static frontend with security headers, long-lived caching for hashed assets, and
      board links (`/room/…`) that survive a refresh
- [x] **Live typing without database churn** — in-progress text is relayed as `preview` events and only the finished
      edit is saved
- [x] **Health check** — `GET /api/health` → `{status, timestamp, roomCount}`
- [x] **Presence roster endpoint** — `GET /api/rooms/{code}/users`
- [x] **LAN discovery** — `GET /api/network` reports the host's site-local IPv4 addresses
      so the share dialog can offer a link other devices can actually reach.
      `dev` profile only, so a public deployment never exposes internal addresses
- [x] **Platform database URLs** — Render/Heroku/Railway supply a `postgresql://` URL;
      an `EnvironmentPostProcessor` rewrites it to the `jdbc:` form Spring needs, so the
      same jar boots unchanged locally and in the cloud
- [x] **Configurable origins** — `CORS_ALLOWED_ORIGINS` applies to both REST and the SockJS handshake

## Quality

- [x] **Backend tests** (102) — JUnit 5 + Spring Boot Test against in-memory H2: room lifecycle, snapshot mutations,
      concurrent writers, board limits, event sanitising, presence, rate limiting, REST contracts, platform
      database-URL translation, and integration tests that drive the real STOMP endpoint on a live port
- [x] **Frontend tests** (138) — Vitest + Testing Library: board operations and undo entries, the board hook
      (optimistic edits, resync replay), the API client, drawing and colour utilities, toasts, the board-rename
      flow, share dialog, and the shared text metrics that keep the editor and canvas aligned
- [x] **Lint + audit in CI** — ESLint with zero warnings allowed, and `npm audit` on production dependencies
- [x] **CI** — GitHub Actions builds and tests both apps plus both Docker images on every push
- [x] **Maven wrapper** — `./mvnw` pins the Maven version; no local Maven install needed
- [x] **Reproducible checkouts** — `.gitattributes` normalises line endings so shell
      scripts and the wrapper keep working on Linux CI after a Windows commit
- [x] **One-click deployment** — the root `Dockerfile` bakes the frontend into the server, so `render.yaml` deploys the
      whole app as a single service with one URL and no settings to fill in
- [x] **Deployment ready** — `render.yaml` blueprint, `vercel.json` and `nginx.conf` with security headers (CSP,
      nosniff, frame denial) and correct caching, non-root Docker image with layer-cached dependencies, and a
      step-by-step [DEPLOY.md](DEPLOY.md)

## Keyboard Shortcuts

`V` select · `P` pen · `H` highlighter · `L` laser · `R` rectangle · `O` circle · `D` diamond ·
`G` triangle · `A` arrow · `T` text · `S` sticky · `E` eraser ·
`Del/Backspace` delete · `Ctrl+Z` undo · `Ctrl+Y` / `Ctrl+Shift+Z` redo · `Ctrl+A` select all ·
`Esc` deselect/cancel · `Space+drag` or drag empty canvas with Select to pan · `+/−` zoom · `0` reset zoom · `?` shortcuts help
