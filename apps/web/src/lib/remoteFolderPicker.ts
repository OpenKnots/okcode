export function isProbablyLocalWebSession(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function deriveRemoteFolderBrowserRoot(cwd: string | null | undefined): string {
  const normalized = normalizeSlashes(cwd ?? "");
  if (!normalized) {
    return "/";
  }

  const openclawWorkspaceMarker = "/.openclaw/workspace/";
  const openclawWorkspaceIndex = normalized.indexOf(openclawWorkspaceMarker);
  if (openclawWorkspaceIndex !== -1) {
    return normalized.slice(0, openclawWorkspaceIndex + openclawWorkspaceMarker.length - 1);
  }

  const windowsDriveMatch = normalized.match(/^[a-z]:/i);
  if (windowsDriveMatch) {
    return `${windowsDriveMatch[0]}\\`;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] === "Users" && segments[1]) {
    return `/${segments[0]}/${segments[1]}`;
  }
  if (segments[0] === "home" && segments[1]) {
    return `/${segments[0]}/${segments[1]}`;
  }

  return normalized.startsWith("/") ? "/" : normalized;
}

export function joinRemoteFolderPath(rootPath: string, relativePath: string): string {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const normalizedRoot = trimTrailingSeparators(rootPath);
  if (!normalizedRelativePath) {
    return normalizedRoot || rootPath;
  }

  if (usesWindowsSeparators(rootPath)) {
    return `${normalizedRoot}\\${normalizedRelativePath.replace(/\//g, "\\")}`;
  }

  return `${normalizedRoot}/${normalizedRelativePath}`;
}

export function relativeRemoteFolderPath(
  absolutePath: string | null | undefined,
  rootPath: string,
): string {
  const normalizedAbsolutePath = trimTrailingSeparators(normalizeSlashes(absolutePath ?? ""));
  const normalizedRoot = trimTrailingSeparators(normalizeSlashes(rootPath));

  if (!normalizedAbsolutePath || !normalizedRoot) {
    return "";
  }

  if (normalizedAbsolutePath === normalizedRoot) {
    return "";
  }

  const prefix = `${normalizedRoot}/`;
  if (!normalizedAbsolutePath.startsWith(prefix)) {
    return "";
  }

  return normalizeRelativePath(normalizedAbsolutePath.slice(prefix.length));
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function trimTrailingSeparators(value: string): string {
  if (value === "/") {
    return value;
  }
  if (/^[a-z]:[\\/]*$/i.test(value)) {
    return `${value.slice(0, 2)}\\`;
  }
  return value.replace(/[\\/]+$/g, "");
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function usesWindowsSeparators(value: string): boolean {
  return /^[a-z]:/i.test(value) || value.includes("\\");
}
