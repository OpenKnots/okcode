import "../index.css";

import { ProjectId, type NativeApi } from "@okcode/contracts";
import type { Project } from "~/types";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ProjectIconEditorDialog } from "./ProjectIconEditorDialog";

function makeProject(): Project {
  return {
    id: ProjectId.makeUnsafe("project-1"),
    name: "Project One",
    cwd: "/repo/project",
    model: "codex-gpt-5.2",
    expanded: false,
    scripts: [],
    iconPath: null,
  };
}

function mockNativeApi() {
  (window as Window & { nativeApi?: NativeApi }).nativeApi = {
    projects: {
      searchEntries: vi.fn(async () => ({ entries: [], truncated: false })),
    },
  } as unknown as NativeApi;
}

afterEach(() => {
  delete (window as Window & { nativeApi?: NativeApi }).nativeApi;
  document.body.innerHTML = "";
});

describe("ProjectIconEditorDialog", () => {
  it("lets the user choose an image file and saves it as a data URL", async () => {
    mockNativeApi();
    const onSave = vi.fn(async (_iconPath: string | null) => undefined);
    const screen = await render(
      <ProjectIconEditorDialog
        project={makeProject()}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );

    try {
      const chooseImageButton = page.getByRole("button", { name: "Choose image" });
      await chooseImageButton.click();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (!fileInput) {
        throw new Error("Expected the hidden project icon file input to exist.");
      }
      expect(fileInput.accept).toBe("image/*");

      const file = new File([new Uint8Array([137, 80, 78, 71])], "project-icon.png", {
        type: "image/png",
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: dataTransfer.files,
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));

      const saveButton = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Save icon"),
      ) as HTMLButtonElement | undefined;
      if (!saveButton) {
        throw new Error("Expected the save icon button to exist.");
      }
      await vi.waitFor(() => {
        expect(saveButton.disabled).toBe(false);
      });

      saveButton.click();

      await vi.waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
      expect(onSave.mock.calls[0]?.[0]).toMatch(/^data:image\/png;base64,/);
    } finally {
      await screen.unmount();
    }
  });
});
