# Remote Access Setup

Use this when you want to open OK Code from another device (phone, tablet, another laptop).

The web client supports direct browser access. The native mobile shell in `apps/mobile` uses the
same server, but stores the auth token locally and pairs through a deep link instead of keeping the
token in the browser URL.

## CLI ↔ Env option map

The OK Code CLI accepts the following configuration options, available either as CLI flags or environment variables:

| CLI flag                | Env var               | Notes                              |
| ----------------------- | --------------------- | ---------------------------------- |
| `--mode <web\|desktop>` | `OKCODE_MODE`         | Runtime mode.                      |
| `--port <number>`       | `OKCODE_PORT`         | HTTP/WebSocket port.               |
| `--host <address>`      | `OKCODE_HOST`         | Bind interface/address.            |
| `--base-dir <path>`     | `OKCODE_HOME`         | Base directory.                    |
| `--dev-url <url>`       | `VITE_DEV_SERVER_URL` | Dev web URL redirect/proxy target. |
| `--no-browser`          | `OKCODE_NO_BROWSER`   | Disable auto-open browser.         |
| `--auth-token <token>`  | `OKCODE_AUTH_TOKEN`   | WebSocket auth token.              |

> TIP: Use the `--help` flag to see all available options and their descriptions.

## Security First

- Always set `--auth-token` before exposing the server outside localhost.
- Treat the token like a password.
- Prefer binding to trusted interfaces (LAN IP or Tailnet IP) instead of opening all interfaces unless needed.

## 1) Build + run server for remote access

Remote access should use the built web app (not local Vite redirect mode).

```bash
bun run build
TOKEN="$(openssl rand -hex 24)"
bun run --cwd apps/server start -- --host 0.0.0.0 --port 3773 --auth-token "$TOKEN" --no-browser
```

Then open on your phone:

`http://<your-machine-ip>:3773`

To force the mobile companion layout during dogfooding, append:

`?client=mobile`

Example:

`http://192.168.1.42:3773?client=mobile`

To pair the native mobile app, construct a deep link using the same server URL and token:

`okcode://pair?server=http%3A%2F%2F192.168.1.42%3A3773&token=<token>`

The app also accepts a plain server URL that includes the token as a query parameter:

`http://192.168.1.42:3773?token=<token>`

Notes:

- `--host 0.0.0.0` listens on all IPv4 interfaces.
- `--no-browser` prevents local auto-open, which is usually better for headless/remote sessions.
- Ensure your OS firewall allows inbound TCP on the selected port.

## 2) Tailnet / Tailscale access

If you use Tailscale, you can bind directly to your Tailnet address.

```bash
TAILNET_IP="$(tailscale ip -4)"
TOKEN="$(openssl rand -hex 24)"
bun run --cwd apps/server start -- --host "$(tailscale ip -4)" --port 3773 --auth-token "$TOKEN" --no-browser
```

Open from any device in your tailnet:

`http://<tailnet-ip>:3773`

You can also append `?client=mobile` to force the companion layout.

Native-app pairing uses the same deep-link format:

`okcode://pair?server=http%3A%2F%2F<tailnet-ip>%3A3773&token=<token>`

You can also bind `--host 0.0.0.0` and connect through the Tailnet IP, but binding directly to the Tailnet IP limits exposure.

## 3) Build the native mobile shell

The mobile shell wraps the built `apps/web` companion experience with a Capacitor runtime and a
native pairing bridge.

```bash
bun run --cwd apps/mobile build
bun run --cwd apps/mobile sync
```

Then open the generated projects:

```bash
bun run --cwd apps/mobile open:ios
bun run --cwd apps/mobile open:android
```
