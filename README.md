# Sol ☀️

A mobile-first web frontend for [pi](https://pi.dev), the CLI-based AI coding agent. Sol lets you browse historical sessions, send prompts, stream agent responses, inspect modified files, and switch models — all from your phone over Tailscale VPN.

Named after Sol Robeson, Max's mentor in the film *π*.

## Architecture

```
┌──────────────┐   Tailscale   ┌──────────────────────────────────────┐
│  iPhone /    │───────────────▶│  Sol Server (Express, port 8081)     │
│  Browser     │   SSE + REST   │                                      │
└──────────────┘               │  ┌─────────────┐  ┌───────────────┐  │
                               │  │ pi SDK       │  │ pi --mode rpc │  │
                               │  │ (read-only)  │  │ (active I/O)  │  │
                               │  └─────────────┘  └───────────────┘  │
                               └──────────────────────────────────────┘
```

- **Backend:** Node.js + Express v4 + TypeScript, run via `tsx` (no compile step).
- **Frontend:** Preact + Tailwind CSS v4 + Headless UI, built with Vite.
- **Historical sessions:** Read-only discovery via `@mariozechner/pi-coding-agent` SDK (`SessionManager`).
- **Active sessions:** Spawns `pi --mode rpc` subprocesses, streams events to the browser via SSE.
- **Security:** No app-level auth — Tailscale provides network-level security.

## Prerequisites

- **Node.js** ≥ 22 (tested on v22.21.0)
- **npm** ≥ 10
- **pi** installed and available on `$PATH` ([pi.dev](https://pi.dev))
- **Tailscale** (for remote access from phone — not required for local development)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> sol && cd sol

# 2. Install dependencies (backend + frontend)
npm install
cd frontend && npm install && cd ..

# 3. Build the frontend
npm run build:frontend

# 4. Start the server
npm run dev
```

The server starts at **http://localhost:8081**. Open it in a browser to use Sol.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend with file watching (`tsx watch`) |
| `npm run dev:frontend` | Start Vite dev server with HMR (port 5173, proxies `/api` → 8081) |
| `npm start` | Production server (`tsx src/server.ts`) |
| `npm run build` | Type-check backend + frontend (no JS output) |
| `npm run build:frontend` | Build frontend for production (output in `frontend/dist`) |
| `npm run lint` | Same as `build` — type-check everything |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Development Workflow

### Running backend + frontend together

For the best development experience, run both servers in separate terminals:

```bash
# Terminal 1 — Backend (auto-restarts on changes)
npm run dev

# Terminal 2 — Frontend (hot module replacement)
npm run dev:frontend
```

The Vite dev server on port **5173** proxies all `/api/*` requests to the Express backend on port **8081**. Open **http://localhost:5173** during development for instant HMR updates.

### Production-like local run

To test the full production setup locally (Express serves the built frontend):

```bash
npm run build:frontend
npm start
# Open http://localhost:8081
```

## Testing Locally

### Type checking

```bash
npm run build
```

This runs `tsc --noEmit` on both backend and frontend. Run this before every commit.

### Unit & integration tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

Tests use **Vitest** and **supertest** for API integration testing. Test files are co-located with source files (`src/foo.test.ts` alongside `src/foo.ts`), with shared utilities in `src/__test__/`.

### Manual API testing

With the dev server running (`npm run dev`), you can test endpoints with curl:

```bash
# Health check
curl http://localhost:8081/api/health

# List all sessions (requires pi sessions to exist on disk)
curl http://localhost:8081/api/sessions
```

### Testing with pi sessions

Sol discovers sessions from pi's default session directory. To have data to browse:

1. Run a few pi sessions normally (`pi` in any project directory).
2. Start Sol (`npm run dev`).
3. Open http://localhost:8081 — your sessions appear grouped by project.

For active session features (prompting, streaming, model switching), Sol spawns `pi --mode rpc` subprocesses, so `pi` must be installed and on your `$PATH`.

## Accessing from your phone

1. Install [Tailscale](https://tailscale.com) on both your laptop and phone.
2. Start Sol on your laptop: `npm start`
3. Find your laptop's Tailscale IP: `tailscale ip -4`
4. Open `http://<tailscale-ip>:8081` in Safari on your phone.

The server binds to `0.0.0.0` so it's accessible on all network interfaces including Tailscale.

## Project Structure

```
src/
  server.ts              # Express entry point (port 8081, bound to 0.0.0.0)
  app.ts                 # Express app setup, routes, static file serving
  sessions.ts            # Session discovery via pi SDK
  __test__/              # Shared test utilities and mock factories
  *.test.ts              # Co-located test files

frontend/
  src/
    main.tsx             # Preact entry point
    App.tsx              # Root component
    components/          # UI components
    utils/               # Frontend utilities
  index.html             # HTML shell
  vite.config.ts         # Vite config (Preact + Tailwind v4 plugins)

docs/
  PRD/                   # Product Requirements Documents
  ADR/                   # Architecture Decision Records
  features/              # Feature documentation with README.md index
  tickets/               # Implementation tickets
  constitution.md        # Binding project rules
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/sessions` | GET | All sessions grouped by project |
| `/api/session/:id` | GET | Full entries for a historical session |
| `/api/session/:id/connect` | POST | Spawn RPC subprocess for active session |
| `/api/session/:id/stream` | GET (SSE) | Stream agent events in real-time |
| `/api/session/:id/prompt` | POST | Send a prompt to the active session |
| `/api/session/:id/abort` | POST | Abort current operation |
| `/api/session/:id/model` | PUT | Switch model for active session |
| `/api/tree/:id` | GET | Conversation tree structure |
| `/api/files/:id` | GET | Git working tree changes |
| `/api/files/:id/content` | GET | Full file contents |
| `/api/files/:id/diff` | GET | Git diff for a file |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 + tsx (no compile step) |
| Backend | Express v4, TypeScript (strict mode) |
| Frontend | Preact, Tailwind CSS v4, Headless UI |
| Build | Vite 7 |
| Testing | Vitest, supertest |
| Session SDK | `@mariozechner/pi-coding-agent` |
| Active sessions | `pi --mode rpc` subprocesses → SSE |

## License

Private project.
