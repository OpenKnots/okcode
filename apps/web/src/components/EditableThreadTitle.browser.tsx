import "../index.css";

import { useState } from "react";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { EditableThreadTitle } from "./EditableThreadTitle";

function EditableThreadTitleHarness(props: {
  initialTitle?: string;
  showEditButton?: boolean;
  onCommit?: (title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(props.initialTitle ?? "Thread title");
  const [draftTitle, setDraftTitle] = useState(title);

  return (
    <EditableThreadTitle
      title={title}
      isEditing={isEditing}
      draftTitle={draftTitle}
      showEditButton={props.showEditButton ?? true}
      onStartEditing={() => {
        setDraftTitle(title);
        setIsEditing(true);
      }}
      onDraftTitleChange={setDraftTitle}
      onCommit={() => {
        const nextTitle = draftTitle.trim();
        setTitle(nextTitle);
        setDraftTitle(nextTitle);
        setIsEditing(false);
        props.onCommit?.(nextTitle);
      }}
      onCancel={() => {
        setDraftTitle(title);
        setIsEditing(false);
      }}
    />
  );
}

describe("EditableThreadTitle", () => {
  it("opens inline editing from the edit button and commits on Enter", async () => {
    const onCommit = vi.fn();
    const screen = await render(
      <EditableThreadTitleHarness onCommit={onCommit} initialTitle="Initial thread" />,
    );

    try {
      await page.getByRole("button", { name: "Rename thread" }).click();
      const input = page.getByRole("textbox", { name: "Rename thread" });
      await input.fill("Renamed thread");
      if (!(document.activeElement instanceof HTMLElement)) {
        throw new Error("Expected the inline title input to be focused.");
      }
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      await vi.waitFor(() => {
        expect(onCommit).toHaveBeenCalledWith("Renamed thread");
        expect(document.body.textContent ?? "").toContain("Renamed thread");
      });
    } finally {
      await screen.unmount();
    }
  });

  it("opens inline editing on double click even without the edit button", async () => {
    const onCommit = vi.fn();
    const screen = await render(
      <EditableThreadTitleHarness
        showEditButton={false}
        onCommit={onCommit}
        initialTitle="Header thread"
      />,
    );

    try {
      await page.getByText("Header thread").dblClick();
      const input = page.getByRole("textbox", { name: "Rename thread" });
      await input.fill("Header rename");
      if (!(document.activeElement instanceof HTMLElement)) {
        throw new Error("Expected the inline title input to be focused.");
      }
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      await vi.waitFor(() => {
        expect(onCommit).toHaveBeenCalledWith("Header rename");
        expect(document.body.textContent ?? "").toContain("Header rename");
      });
    } finally {
      await screen.unmount();
    }
  });
});
