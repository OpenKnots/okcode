import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("chat route sidebar chrome", () => {
  it("keeps the left sidebar off the backdrop blur path", () => {
    const src = readFileSync(resolve(import.meta.dirname, "./_chat.tsx"), "utf8");

    expect(src).not.toContain("backdrop-blur-sm");
  });
});
