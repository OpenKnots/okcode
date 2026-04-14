import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { tryHandleProjectFaviconRequest } from "./projectFaviconRoute";

interface HttpResponse {
  statusCode: number;
  contentType: string | null;
  location: string | null;
  body: string;
}

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function withRouteServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (tryHandleProjectFaviconRequest(url, res)) {
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected server address to be an object");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function request(
  baseUrl: string,
  pathname: string,
  init?: Pick<RequestInit, "redirect">,
): Promise<HttpResponse> {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  return {
    statusCode: response.status,
    contentType: response.headers.get("content-type"),
    location: response.headers.get("location"),
    body: await response.text(),
  };
}

describe("tryHandleProjectFaviconRequest", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 400 when cwd is missing", async () => {
    await withRouteServer(async (baseUrl) => {
      const response = await request(baseUrl, "/api/project-favicon");
      expect(response.statusCode).toBe(400);
      expect(response.body).toBe("Missing cwd parameter");
    });
  });

  it("serves a well-known favicon file from the project root", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-root-");
    fs.writeFileSync(path.join(projectDir, "favicon.svg"), "<svg>favicon</svg>", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toBe("<svg>favicon</svg>");
    });
  });

  it("serves an explicit icon override when provided", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-override-");
    const iconPath = path.join(projectDir, "public", "brand", "override.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(iconPath, "<svg>override</svg>", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}&icon=${encodeURIComponent("public/brand/override.svg")}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toBe("<svg>override</svg>");
    });
  });

  it("redirects to an explicit absolute icon override when provided", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-absolute-override-");
    const remoteIconUrl = "https://cdn.example.com/assets/project-icon.gif?size=64";

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}&icon=${encodeURIComponent(remoteIconUrl)}`;
      const response = await request(baseUrl, pathname, { redirect: "manual" });
      expect(response.statusCode).toBe(302);
      expect(response.location).toBe(remoteIconUrl);
      expect(response.body).toBe("");
    });
  });

  it("resolves icon href from source files when no well-known favicon exists", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-source-");
    const iconPath = path.join(projectDir, "public", "brand", "logo.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "index.html"),
      '<link rel="icon" href="/brand/logo.svg">',
    );
    fs.writeFileSync(iconPath, "<svg>brand</svg>", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toBe("<svg>brand</svg>");
    });
  });

  it("redirects to an absolute icon href discovered from source files", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-absolute-source-");
    const remoteIconUrl = "https://cdn.example.com/brand/logo.jpeg?version=42";
    fs.writeFileSync(
      path.join(projectDir, "index.html"),
      `<link rel="icon" href="${remoteIconUrl}">`,
    );

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname, { redirect: "manual" });
      expect(response.statusCode).toBe(302);
      expect(response.location).toBe(remoteIconUrl);
      expect(response.body).toBe("");
    });
  });

  it("resolves a local icon href discovered from source files with query params", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-source-query-");
    const iconPath = path.join(projectDir, "public", "brand", "logo.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "index.html"),
      '<link rel="icon" href="/brand/logo.svg?v=123#cache-bust">',
    );
    fs.writeFileSync(iconPath, "<svg>brand-query</svg>", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toBe("<svg>brand-query</svg>");
    });
  });

  it("resolves icon link when href appears before rel in HTML", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-html-order-");
    const iconPath = path.join(projectDir, "public", "brand", "logo.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "index.html"),
      '<link href="/brand/logo.svg" rel="icon">',
    );
    fs.writeFileSync(iconPath, "<svg>brand-html-order</svg>", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toBe("<svg>brand-html-order</svg>");
    });
  });

  it("resolves object-style icon metadata when href appears before rel", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-obj-order-");
    const iconPath = path.join(projectDir, "public", "brand", "obj.svg");
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "src", "root.tsx"),
      'const links = [{ href: "/brand/obj.svg", rel: "icon" }];',
      "utf8",
    );
    fs.writeFileSync(iconPath, "<svg>brand-obj-order</svg>", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toBe("<svg>brand-obj-order</svg>");
    });
  });

  it("serves common image types such as jpeg with the correct content type", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-jpeg-");
    fs.writeFileSync(path.join(projectDir, "favicon.jpeg"), "jpeg-bits", "utf8");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/jpeg");
      expect(response.body).toBe("jpeg-bits");
    });
  });

  it("serves a fallback favicon when no icon exists", async () => {
    const projectDir = makeTempDir("okcode-favicon-route-fallback-");

    await withRouteServer(async (baseUrl) => {
      const pathname = `/api/project-favicon?cwd=${encodeURIComponent(projectDir)}`;
      const response = await request(baseUrl, pathname);
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toContain("image/svg+xml");
      expect(response.body).toContain('data-fallback="project-favicon"');
    });
  });
});
