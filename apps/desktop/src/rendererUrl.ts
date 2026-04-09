export interface DesktopRendererUrlInput {
  readonly isDevelopment: boolean;
  readonly devServerUrl?: string | undefined;
  readonly scheme: string;
  readonly query?: Record<string, string | number | boolean | null | undefined> | undefined;
}

function applyQuery(url: URL, query: DesktopRendererUrlInput["query"]): URL {
  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      url.searchParams.delete(key);
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

export function resolveDesktopRendererUrl(input: DesktopRendererUrlInput): string {
  if (input.isDevelopment) {
    const devServerUrl = input.devServerUrl;
    if (!devServerUrl) {
      throw new Error("VITE_DEV_SERVER_URL is required when resolving a development renderer URL.");
    }

    return applyQuery(new URL(devServerUrl), input.query).toString();
  }

  return applyQuery(new URL(`${input.scheme}://app/index.html`), input.query).toString();
}
