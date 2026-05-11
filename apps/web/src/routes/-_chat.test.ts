import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("chat route sidebar chrome", () => {
  it("keeps the left sidebar off the backdrop blur path", () => {
    const src = readFileSync(resolve(import.meta.dirname, "./_chat.tsx"), "utf8");

    expect(src).not.toContain("backdrop-blur-sm");
  });

  it("does not expose screenshot UI or shortcuts in the chat shell", () => {
    const chatRouteSrc = readFileSync(resolve(import.meta.dirname, "./_chat.tsx"), "utf8");
    const chatWidgetShellSrc = readFileSync(
      resolve(import.meta.dirname, "../components/widget/ChatWidgetShell.tsx"),
      "utf8",
    );

    expect(chatRouteSrc).not.toContain("ScreenshotTool");
    expect(chatRouteSrc).not.toContain("ScreenshotButton");
    expect(chatRouteSrc).not.toContain("useScreenshotStore");
    expect(chatRouteSrc).not.toContain("toggleScreenshot");
    expect(chatRouteSrc).not.toContain("Cmd+Shift+S");
    expect(chatRouteSrc).not.toContain("Ctrl+Shift+S");

    expect(chatWidgetShellSrc).not.toContain("ScreenshotTool");
    expect(chatWidgetShellSrc).not.toContain("ScreenshotButton");
  });
});
