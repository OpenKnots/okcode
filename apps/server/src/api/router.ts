import http from "node:http";

import { tryHandleProjectFaviconRequest } from "../projectFaviconRoute.ts";
import type { TokenManager } from "../tokenManager.ts";
import { createAuthApiRouter } from "./authRouter.ts";

interface ApiRouterOptions {
  readonly authToken: string | undefined;
  readonly host: string | undefined;
  readonly port: number;
  readonly tokenManager: TokenManager;
  readonly fetchImpl?: typeof fetch;
  readonly anthropicBaseUrl?: string;
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function createApiRouter(options: ApiRouterOptions) {
  const tryHandleAuthApiRequest = createAuthApiRouter(options);

  return async function tryHandleApiRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<boolean> {
    if (!isApiPath(url.pathname)) {
      return false;
    }

    if (await tryHandleAuthApiRequest(req, res, url)) {
      return true;
    }

    if (tryHandleProjectFaviconRequest(url, res)) {
      return true;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
    return true;
  };
}
