# Sol 👴

A mobile-first web frontend for [pi](https://pi.dev), the CLI-based AI coding agent. Browse historical sessions, send prompts, stream agent responses, inspect modified files, and switch models — all from your phone over Tailscale VPN.

Named after Sol Robeson, Max's mentor in the film *π*.

## Architecture

```
┌──────────────┐   Tailscale   ┌──────────────────────────────────────┐
│  iPhone /    │──────────────▶│  Sol Server (Express, port 8081)     │
│  Browser     │   SSE + REST  │                                      │
└──────────────┘               │  ┌─────────────┐  ┌───────────────┐  │
                               │  │ pi SDK      │  │ pi --mode rpc │  │
                               │  │ (read-only) │  │ (active I/O)  │  │
                               │  └─────────────┘  └───────────────┘  │
                               └──────────────────────────────────────┘
```

## Prerequisites

- **Node.js** ≥ 22, **npm** ≥ 10
- **pi** installed and on `$PATH` ([pi.dev](https://pi.dev))
- **Tailscale** for remote access (optional for local dev)

## Quick Start

```bash
git clone <repo-url> sol && cd sol
npm install && cd frontend && npm install && cd ..
npm run build:frontend
npm run dev          # http://localhost:8081
```

For development with HMR, run in two terminals:

```bash
npm run dev            # Backend (auto-restarts)
npm run dev:frontend   # Frontend HMR on http://localhost:5173
```

## Phone Access

Install [Tailscale](https://tailscale.com) on laptop and phone, then open `http://<tailscale-ip>:8081` in Safari. The server binds to `0.0.0.0`.

## Documentation

- **[PRD](docs/PRD/)** — Product requirements and API specifications
- **[ADR](docs/ADR/)** — Architecture decision records
- **[Features](docs/features/)** — Feature documentation index
- **[Tickets](docs/tickets/)** — Implementation tickets
- **[Constitution](docs/constitution.md)** — Binding project rules

## License

Private project.
