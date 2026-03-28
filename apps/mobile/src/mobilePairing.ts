export interface ParsedMobilePairing {
  serverUrl: string;
  token: string;
  wsUrl: string;
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
