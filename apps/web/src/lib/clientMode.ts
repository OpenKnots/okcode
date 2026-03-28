export type ClientMode = "desktop" | "mobile";

export const CLIENT_MODE_STORAGE_KEY = "okcode:client-mode:v1";

function normalizeClientMode(value: string | null | undefined): ClientMode | null {
  if (value === "desktop" || value === "mobile") {
    return value;
  }
  return null;
}

export function readClientModeFromSearch(search: string): ClientMode | null {
  const params = new URLSearchParams(search);
  return normalizeClientMode(params.get("client"));
}

export function readClientModeFromStorage(storage: Pick<Storage, "getItem">): ClientMode | null {
  return normalizeClientMode(storage.getItem(CLIENT_MODE_STORAGE_KEY));
}

export function persistClientMode(
  storage: Pick<Storage, "removeItem" | "setItem">,
  mode: ClientMode | null,
): void {
  if (mode) {
    storage.setItem(CLIENT_MODE_STORAGE_KEY, mode);
    return;
  }
  storage.removeItem(CLIENT_MODE_STORAGE_KEY);
}

export function resolveClientMode(input: {
  search: string;
  storedMode: ClientMode | null;
  prefersMobileViewport: boolean;
}): ClientMode {
  return (
    readClientModeFromSearch(input.search) ??
    input.storedMode ??
    (input.prefersMobileViewport ? "mobile" : "desktop")
  );
}
