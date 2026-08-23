# ✨ CollabBoard Features

A real-time collaborative whiteboard inspired by Excalidraw, Miro, and FigJam.
Java 17 + Spring Boot 3 backend, React 18 + Vite frontend, PostgreSQL persistence.

## Canvas & Drawing

- [x] **Infinite canvas** — wheel zoom (0.1×–5×), Space/middle-drag pan, zoom % control with +/−/reset
- [x] **Minimap** — bottom-right overview of all shapes with a live viewport rectangle
- [x] **Smooth pen** — `perfect-freehand` pressure-style strokes rendered as Konva `Path`
- [x] **Highlighter** — thick translucent (opacity 0.4) stroke
- [x] **Laser pointer** — temporary red stroke, broadcast to others, fades after 3s, never persisted
- [x] **Shapes** — rectangle, circle/ellipse, diamond, triangle with stroke + fill colors
- [x] **Arrows** — two-click placement with arrowheads (Konva `Arrow`)
- [x] **Text** — zoom/pan-aware HTML textarea overlay, font size 12–72px, bold + italic.
      Editor and canvas share one font/line-height/padding config, so what you type is
      exactly what lands. Multi-line with word wrap; Esc or click-away commits
- [x] **Sticky notes** — 200×150 rounded notes, 5 colors, double-click to edit, draggable
- [x] **Reaction stamps** — 👍 ❤️ 🔥 ✅ ❓ ⭐ placed as 32px emoji nodes
- [x] **Eraser** — click a shape to delete it

## Selection & Editing

- [x] **Select tool** with Konva `Transformer` — resize + rotate handles
- [x] **Multi-select** with Shift+Click; **Select all** with Ctrl+A
- [x] **Drag to move**, delete with Delete/Backspace
- [x] **Floating selection toolbar** — quick color, stroke width, delete
- [x] **Undo / redo** — 50-step history stack, broadcast to peers (buttons grey out when unavailable)
- [x] **Grid + snap-to-grid** at 20px, scales with zoom

## Real-time Collaboration

- [x] **Live drawing sync** over STOMP-over-SockJS WebSocket
- [x] **Live cursors** — name + current-tool icon, zoom/pan-aware, label fades after 2s, 30ms throttle
- [x] **Presence tracking** — connect/disconnect via Spring `@EventListener`, roster broadcast on `/presence`
- [x] **Connected users panel** — avatars + dropdown with names and "You"
- [x] **Auto-reconnect** with status indicator (green / yellow / red)
- [x] **Persistence** — full board (all shape types + transforms) stored as JSON snapshot
- [x] **Live board rename** — renaming from the top bar or settings panel is broadcast to
      every peer; the server echoes the normalised name so all clients converge

## UI / UX

- [x] **Floating pill toolbar** (bottom center) with context-sensitive options bar
- [x] **Redesigned top bar** — logo, status dot, room code + copy, inline board-name edit, zoom, undo/redo, grid, export, settings
- [x] **Animated dark landing page** with feature highlights
- [x] **Settings panel** — board name, background color, grid, snap, clear board
- [x] **Toast notifications** — success / error / info, auto-dismiss, slide-out
- [x] **Keyboard shortcuts** + help modal (`?`)
- [x] **Export** — PNG, JPEG (2× pixel ratio), copy to clipboard
- [x] **Share dialog** — detects a `localhost` URL (which never works for anyone else),
      asks the backend for the machine's LAN address and offers a link that does work
- [x] **Empty-board hint** — a new board tells you what to do instead of showing a void

## Backend

- [x] **Presence service** — room→users map, session cleanup on disconnect
- [x] **Board name** — `rename` STOMP event persists and broadcasts the name live;
      `PUT /api/rooms/{code}/name` is the fallback used while the socket is down
- [x] **Room expiry logging** — hourly `@Scheduled` task flags rooms idle > 7 days
- [x] **Transactional, race-safe snapshot updates** (draw / update / delete / replace / clear)
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

- [x] **Backend tests** (51) — JUnit 5 + Spring Boot Test against in-memory H2: room lifecycle,
      snapshot mutations (draw / update / delete / replace / clear / rename), presence,
      REST contracts, STOMP routing, and platform database-URL translation
- [x] **Frontend tests** (74) — Vitest + Testing Library: drawing and colour utilities, the
      undo-redo hook, toasts, the board-rename flow, share dialog, and the shared text metrics
      that keep the editor and canvas aligned
- [x] **CI** — GitHub Actions builds and tests both apps plus both Docker images on every push
- [x] **Maven wrapper** — `./mvnw` pins the Maven version; no local Maven install needed
- [x] **Reproducible checkouts** — `.gitattributes` normalises line endings so shell
      scripts and the wrapper keep working on Linux CI after a Windows commit
- [x] **Deployment ready** — `render.yaml` blueprint, `vercel.json`, non-root hardened
      Docker image with layer-cached dependencies, and a step-by-step [DEPLOY.md](DEPLOY.md)

## Keyboard Shortcuts

`V` select · `P` pen · `H` highlighter · `L` laser · `R` rectangle · `O` circle · `D` diamond ·
`G` triangle · `A` arrow · `T` text · `S` sticky · `E` eraser ·
`Del/Backspace` delete · `Ctrl+Z` undo · `Ctrl+Y` / `Ctrl+Shift+Z` redo · `Ctrl+A` select all ·
`Esc` deselect/cancel · `Space+drag` pan · `+/−` zoom · `0` reset zoom · `?` shortcuts help
