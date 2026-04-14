import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { PROJECT_ICON_FALLBACK_CANDIDATES } from "@okcode/shared/projectIcons";

const FAVICON_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const FALLBACK_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6b728080" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-fallback="project-favicon"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/></svg>`;

// Files that may contain a <link rel="icon"> or icon metadata declaration.
const ICON_SOURCE_FILES = [
  "index.html",
  "public/index.html",
  "app/routes/__root.tsx",
  "src/routes/__root.tsx",
  "app/root.tsx",
  "src/root.tsx",
  "src/index.html",
];

// Matches <link ...> tags or object-like icon metadata where rel/href can appear in any order.
const LINK_ICON_HTML_RE =
  /<link\b(?=[^>]*\brel=["'](?:icon|shortcut icon)["'])(?=[^>]*\bhref=["']([^"'?]+))[^>]*>/i;
const LINK_ICON_OBJ_RE =
  /(?=[^}]*\brel\s*:\s*["'](?:icon|shortcut icon)["'])(?=[^}]*\bhref\s*:\s*["']([^"'?]+))[^}]*/i;

function extractIconHref(source: string): string | null {
  const htmlMatch = source.match(LINK_ICON_HTML_RE);
  if (htmlMatch?.[1]) return htmlMatch[1];
  const objMatch = source.match(LINK_ICON_OBJ_RE);
  if (objMatch?.[1]) return objMatch[1];
  return null;
}

function resolveIconHref(projectCwd: string, href: string): string[] {
  const clean = href.replace(/^\//, "");
  return [path.join(projectCwd, "public", clean), path.join(projectCwd, clean)];
}

function isPathWithinProject(projectCwd: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(projectCwd), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function serveFaviconFile(filePath: string, res: http.ServerResponse): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = FAVICON_MIME_TYPES[ext] ?? "application/octet-stream";
  fs.readFile(filePath, (readErr, data) => {
    if (readErr) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Read error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    });
    res.end(data);
  });
}

function serveFallbackFavicon(res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=3600",
  });
  res.end(FALLBACK_FAVICON_SVG);
}

export function tryHandleProjectFaviconRequest(url: URL, res: http.ServerResponse): boolean {
  if (url.pathname !== "/api/project-favicon") {
    return false;
  }

  const projectCwd = url.searchParams.get("cwd");
  if (!projectCwd) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing cwd parameter");
    return true;
  }

  const overrideIconPath = url.searchParams.get("icon");
  if (overrideIconPath) {
    const candidates = resolveIconHref(projectCwd, overrideIconPath);
    const serveOverrideOrFallback = (index: number): void => {
      if (index >= candidates.length) {
        serveFallbackFavicon(res);
        return;
      }
      const candidate = candidates[index]!;
      if (!isPathWithinProject(projectCwd, candidate)) {
        serveOverrideOrFallback(index + 1);
        return;
      }
      fs.stat(candidate, (err, stats) => {
        if (err || !stats?.isFile()) {
          serveOverrideOrFallback(index + 1);
          return;
        }
        serveFaviconFile(candidate, res);
      });
    };
    serveOverrideOrFallback(0);
    return true;
  }

  const tryResolvedPaths = (paths: string[], index: number, onExhausted: () => void): void => {
    if (index >= paths.length) {
      onExhausted();
      return;
    }
    const candidate = paths[index]!;
    if (!isPathWithinProject(projectCwd, candidate)) {
      tryResolvedPaths(paths, index + 1, onExhausted);
      return;
    }
    fs.stat(candidate, (err, stats) => {
      if (err || !stats?.isFile()) {
        tryResolvedPaths(paths, index + 1, onExhausted);
        return;
      }
      serveFaviconFile(candidate, res);
    });
  };

  const trySourceFiles = (index: number): void => {
    if (index >= ICON_SOURCE_FILES.length) {
      serveFallbackFavicon(res);
      return;
    }
    const sourceFile = path.join(projectCwd, ICON_SOURCE_FILES[index]!);
    fs.readFile(sourceFile, "utf8", (err, content) => {
      if (err) {
        trySourceFiles(index + 1);
        return;
      }
      const href = extractIconHref(content);
      if (!href) {
        trySourceFiles(index + 1);
        return;
      }
      const candidates = resolveIconHref(projectCwd, href);
      tryResolvedPaths(candidates, 0, () => trySourceFiles(index + 1));
    });
  };

  const tryCandidates = (index: number): void => {
    if (index >= PROJECT_ICON_FALLBACK_CANDIDATES.length) {
      trySourceFiles(0);
      return;
    }
    const candidate = path.join(projectCwd, PROJECT_ICON_FALLBACK_CANDIDATES[index]!);
    if (!isPathWithinProject(projectCwd, candidate)) {
      tryCandidates(index + 1);
      return;
    }
    fs.stat(candidate, (err, stats) => {
      if (err || !stats?.isFile()) {
        tryCandidates(index + 1);
        return;
      }
      serveFaviconFile(candidate, res);
    });
  };

  tryCandidates(0);
  return true;
}
