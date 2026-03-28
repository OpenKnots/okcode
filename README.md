# OK Code

A minimal web GUI for coding agents. Currently supports Codex and Claude, with more providers coming.

## Quick Start

```bash
npx okcodes
```

This starts the OK Code server and opens your browser. The app automatically detects which providers you have installed.

Or install the [desktop app from the Releases page](https://github.com/OpenKnots/okcode/releases).

### Provider Setup

OK Code supports multiple AI providers. You need **at least one** configured to start coding.

<details>
<summary><strong>Option A: OpenAI (Codex CLI)</strong></summary>

1. Install: `npm install -g @openai/codex`
2. Authenticate: `codex login`
3. Verify: `codex login status`

If using a custom model provider (Azure OpenAI, Portkey, etc.), configure `model_provider` in `~/.codex/config.toml` instead — no `codex login` needed.

</details>

<details>
<summary><strong>Option B: Anthropic (Claude Code)</strong></summary>

1. Install: `npm install -g @anthropic-ai/claude-code`
2. Authenticate: `claude auth login`
3. Verify: `claude auth status`

</details>

> [!TIP]
> You can install both providers and switch between them per session.

### Troubleshooting

Run the built-in diagnostic to check your setup:

```bash
npx okcodes doctor
```

If OK Code shows a provider error banner after launch:

| Banner message                 | Fix                                               |
| ------------------------------ | ------------------------------------------------- |
| "not installed or not on PATH" | Install the CLI (see above), then restart OK Code |
| "not authenticated"            | Run the login command for that provider           |
| "version check failed"         | Update the CLI to the latest version              |

> [!NOTE]
> OK Code launches even without providers configured — you can explore the UI and configure provider binary paths from **Settings** before starting a session.

## Development Setup

**Prerequisites**: [Bun](https://bun.sh) >= 1.3.9, [Node.js](https://nodejs.org) >= 24.13.1

```bash
bun install
bun dev            # start server + web in parallel
```

This runs the contracts build, then starts the server (port 3773) and web app (port 5733) together via Turbo.

Other dev commands:

```bash
bun dev:server     # server only
bun dev:web        # web only
bun dev:desktop    # Electron desktop + web
bun dev:marketing  # Astro marketing site
```

Quality checks:

```bash
bun fmt            # format (oxfmt)
bun lint           # lint (oxlint)
bun typecheck      # type-check all packages
bun run test       # run tests (Vitest)
```

## Architecture

OK Code is a monorepo with four apps and two shared packages, orchestrated by [Turbo](https://turbo.build).

```
┌─────────────────────────────────┐
│  Browser (React + Vite)         │
│  wsTransport (state machine)    │
│  Typed push decode at boundary  │
└──────────┬──────────────────────┘
           │ ws://localhost:3773
┌──────────▼──────────────────────┐
│  apps/server (Node.js)          │
│  WebSocket + HTTP static server │
│  OrchestrationEngine            │
│  ProviderService                │
└──────────┬──────────────────────┘
           │ JSON-RPC over stdio
┌──────────▼──────────────────────┐
│  codex app-server               │
└─────────────────────────────────┘
```

The server spawns `codex app-server` as a child process, communicating over JSON-RPC on stdio. Provider runtime events are normalized into orchestration domain events and pushed to the browser over WebSocket.

### Packages

| Package             | Path                 | Role                                                                                                                                                                                          |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `okcodes`           | `apps/server`        | Node.js CLI and WebSocket server. Wraps Codex app-server, serves the React web app, and manages provider sessions.                                                                            |
| `@okcode/web`       | `apps/web`           | React 19 + Vite SPA. Session UX, conversation rendering, and client-side state via Zustand. Connects to the server over WebSocket.                                                            |
| `@okcode/desktop`   | `apps/desktop`       | Electron shell that bundles the server and web app into a native desktop application with auto-updates.                                                                                       |
| `@okcode/marketing` | `apps/marketing`     | Astro marketing site.                                                                                                                                                                         |
| `@okcode/contracts` | `packages/contracts` | Shared [Effect](https://effect.website) schemas and TypeScript contracts for the WebSocket protocol, provider events, orchestration model, and session types. Schema-only — no runtime logic. |
| `@okcode/shared`    | `packages/shared`    | Shared runtime utilities (git, logging, shell, networking). Uses explicit subpath exports (`@okcode/shared/git`, etc.) — no barrel index.                                                     |

### Key Technologies

- **Runtime**: Node.js + Bun
- **UI**: React 19, Vite 8, Tailwind CSS 4, TanStack Router & Query
- **Server**: Effect, WebSocket (`ws`), node-pty
- **Desktop**: Electron
- **Schemas**: Effect Schema (in `@okcode/contracts`)
- **Build**: Turbo, tsdown
- **Lint/Format**: oxlint, oxfmt
- **Tests**: Vitest, Playwright

### Event Flow

1. The browser opens a WebSocket to the server and registers typed listeners.
2. User actions become typed requests sent through the WebSocket transport.
3. The server routes requests to `ProviderService`, which talks to `codex app-server` over JSON-RPC.
4. Provider events are ingested, normalized into orchestration events, and persisted.
5. The server pushes domain events back to the browser through an ordered push bus (`orchestration.domainEvent` channel).
6. Async work (checkpoints, command reactions) runs through queue-backed workers and emits typed receipts on completion.

For the full architecture with sequence diagrams, see [.docs/architecture.md](.docs/architecture.md).

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

## Support

Join the [Discord](https://discord.gg/openknot).
