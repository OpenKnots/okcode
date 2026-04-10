export interface ParsedMobilePairing {
  serverUrl: string;
  token: string;
  wsUrl: string;
}

/**
 * Parsed representation of the new companion pairing bundle.
 * This shape is forward-compatible with Milestone 2 where the mobile
 * client will exchange the bootstrap token for a device-scoped session.
 */
export interface ParsedCompanionBundle {
  pairingId: string;
  bootstrapToken: string;
  endpoints: Array<{ kind: string; url: string; label?: string; reachable: boolean }>;
  expiresAt: string;
  passwordRequired: boolean;
  passwordHint?: string;
}

const PAIRING_SCHEME = "okcode:";

function normalizeServerUrl(rawValue: string): URL {
  const url = new URL(rawValue);
  if (url.protocol === "ws:") {
    url.protocol = "http:";
  } else if (url.protocol === "wss:") {
    url.protocol = "https:";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Pairing server URL must use http, https, ws, or wss.");
  }

  url.search = "";
  url.hash = "";
  return url;
}

export function createWsUrl(serverUrl: string, token: string): string {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  normalizedServerUrl.protocol = normalizedServerUrl.protocol === "https:" ? "wss:" : "ws:";
  normalizedServerUrl.searchParams.set("token", token);
  return normalizedServerUrl.toString();
}

export function parseMobilePairingInput(input: string): ParsedMobilePairing {
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    throw new Error("Pairing link is required.");
  }

  const parsedUrl = new URL(trimmedInput);

  let serverUrlValue: string | null = null;
  let token: string | null = null;

  if (parsedUrl.protocol === PAIRING_SCHEME) {
    if (parsedUrl.hostname !== "pair") {
      throw new Error("Unsupported OK Code pairing link.");
    }
    serverUrlValue = parsedUrl.searchParams.get("server");
    token = parsedUrl.searchParams.get("token");
  } else {
    serverUrlValue = `${parsedUrl.origin}${parsedUrl.pathname}`;
    token = parsedUrl.searchParams.get("token");
  }

  if (!serverUrlValue || serverUrlValue.trim().length === 0) {
    throw new Error("Pairing link is missing the server URL.");
  }
  if (!token || token.trim().length === 0) {
    throw new Error("Pairing link is missing the auth token.");
  }

  const normalizedServerUrl = normalizeServerUrl(serverUrlValue).toString();
  return {
    serverUrl: normalizedServerUrl,
    token,
    wsUrl: createWsUrl(normalizedServerUrl, token),
  };
}

/**
 * Attempt to parse a JSON companion pairing bundle.
 * Returns `null` if the input is not valid JSON or does not match the
 * expected shape, so callers can fall back to the legacy URL parser.
 *
 * This parser is intentionally lenient: it validates the minimal required
 * fields and ignores unexpected properties so that older clients remain
 * forward-compatible as the bundle schema evolves.
 */
export function tryParseCompanionBundle(input: string): ParsedCompanionBundle | null {
  try {
    const data = JSON.parse(input);
    if (
      typeof data !== "object" ||
      data === null ||
      typeof data.pairingId !== "string" ||
      typeof data.bootstrapToken !== "string" ||
      !Array.isArray(data.endpoints) ||
      typeof data.expiresAt !== "string"
    ) {
      return null;
    }

    return {
      pairingId: data.pairingId,
      bootstrapToken: data.bootstrapToken,
      endpoints: data.endpoints,
      expiresAt: data.expiresAt,
      passwordRequired: data.passwordRequired === true,
      passwordHint: typeof data.passwordHint === "string" ? data.passwordHint : undefined,
    };
  } catch {
    return null;
  }
}
