import { describe, expect, it } from "vitest";

import { generateQrDataUrl, generateQrSvg } from "./qrCode";

describe("qrCode", () => {
  describe("generateQrSvg", () => {
    it("returns a valid SVG string for short text", () => {
      const svg = generateQrSvg("hello");
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it("includes a white background rect and black data path", () => {
      const svg = generateQrSvg("test");
      expect(svg).toContain('fill="#fff"');
      expect(svg).toContain('fill="#000"');
    });

    it("generates different SVGs for different inputs", () => {
      const svg1 = generateQrSvg("aaa");
      const svg2 = generateQrSvg("bbb");
      expect(svg1).not.toBe(svg2);
    });

    it("handles a typical pairing URL without throwing", () => {
      const url = "okcode://pair?server=http%3A%2F%2F192.168.1.42%3A3773&token=abc123def456";
      const svg = generateQrSvg(url);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    });

    it("handles URLs up to ~200 characters (version 7+)", () => {
      const longUrl = `okcode://pair?server=http%3A%2F%2Fmy-tailnet-host.example.com%3A3773&token=${"a".repeat(120)}`;
      const svg = generateQrSvg(longUrl);
      expect(svg).toContain("<svg");
    });

    it("throws for data that exceeds the maximum supported version", () => {
      const huge = "x".repeat(500);
      expect(() => generateQrSvg(huge)).toThrow("Data too long");
    });

    it("uses crispEdges rendering for clean pixel grid", () => {
      const svg = generateQrSvg("qr");
      expect(svg).toContain('shape-rendering="crispEdges"');
    });
  });

  describe("generateQrDataUrl", () => {
    it("returns a data: URL with SVG MIME type", () => {
      const dataUrl = generateQrDataUrl("test");
      expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    });

    it("contains the encoded SVG content", () => {
      const dataUrl = generateQrDataUrl("test");
      const decoded = decodeURIComponent(dataUrl.replace("data:image/svg+xml;charset=utf-8,", ""));
      expect(decoded).toContain("<svg");
      expect(decoded).toContain("</svg>");
    });
  });
});
