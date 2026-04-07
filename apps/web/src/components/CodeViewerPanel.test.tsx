import { renderToStaticMarkup } from "react-dom/server";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeCodeViewerTabId, useCodeViewerStore } from "../codeViewerStore";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: vi.fn(() => ({
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    })),
  };
});

vi.mock("./CodeMirrorViewer", () => ({
  CodeMirrorViewer: (props: { editable?: boolean; contents: string }) => (
    <div data-editable={props.editable ? "true" : "false"} data-testid="mock-editor">
      {props.contents}
    </div>
  ),
}));

vi.mock("./MarkdownPreview", () => ({
  MarkdownPreview: (props: { contents: string }) => (
    <div data-testid="mock-markdown-preview">{props.contents}</div>
  ),
}));

vi.mock("~/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" as const }),
}));

const useQueryMock = vi.mocked(useQuery);
const useQueryClientMock = vi.mocked(useQueryClient);

function resetCodeViewerStore() {
  useCodeViewerStore.setState({
    isOpen: false,
    tabs: [],
    activeTabId: null,
    pendingContext: null,
  });
}

describe("CodeViewerFileContent", () => {
  beforeEach(() => {
    resetCodeViewerStore();
    useQueryMock.mockReset();
    useQueryClientMock.mockReturnValue({
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    } as never);
  });

  it("renders markdown preview in view mode", async () => {
    const tabId = makeCodeViewerTabId("/repo", "README.md");
    useCodeViewerStore.setState({
      isOpen: true,
      activeTabId: tabId,
      pendingContext: null,
      tabs: [
        {
          tabId,
          cwd: "/repo",
          relativePath: "README.md",
          label: "README.md",
          savedContents: "# Hello\n",
          draftContents: "# Hello\n",
          isDirty: false,
          isSaving: false,
          lastSaveError: null,
          mode: "view",
          hasExternalChange: false,
        },
      ],
    });
    useQueryMock.mockReturnValue({
      data: {
        relativePath: "README.md",
        contents: "# Hello\n",
        truncated: false,
        sizeBytes: 8,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    const { CodeViewerFileContent } = await import("./CodeViewerPanel");
    const markup = renderToStaticMarkup(
      <CodeViewerFileContent
        cwd="/repo"
        relativePath="README.md"
        resolvedTheme="light"
        onAddContext={() => {}}
      />,
    );

    expect(markup).toContain("mock-markdown-preview");
    expect(markup).toContain("Edit");
    expect(markup).toContain("Save");
  });

  it("renders the source editor for editable text files and keeps the saved state visible when clean", async () => {
    const tabId = makeCodeViewerTabId("/repo", "src/index.ts");
    useCodeViewerStore.setState({
      isOpen: true,
      activeTabId: tabId,
      pendingContext: null,
      tabs: [
        {
          tabId,
          cwd: "/repo",
          relativePath: "src/index.ts",
          label: "index.ts",
          savedContents: "const value = 1;\n",
          draftContents: "const value = 1;\n",
          isDirty: false,
          isSaving: false,
          lastSaveError: null,
          mode: "edit",
          hasExternalChange: false,
        },
      ],
    });
    useQueryMock.mockReturnValue({
      data: {
        relativePath: "src/index.ts",
        contents: "const value = 1;\n",
        truncated: false,
        sizeBytes: 18,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    const { CodeViewerFileContent } = await import("./CodeViewerPanel");
    const markup = renderToStaticMarkup(
      <CodeViewerFileContent
        cwd="/repo"
        relativePath="src/index.ts"
        resolvedTheme="light"
        onAddContext={() => {}}
      />,
    );

    expect(markup).toContain('data-testid="mock-editor"');
    expect(markup).toContain('data-editable="true"');
    expect(markup).toContain("Saved");
    expect(markup).not.toContain("Save</button>");
  });

  it("keeps env files read-only until values are revealed", async () => {
    const tabId = makeCodeViewerTabId("/repo", ".env");
    useCodeViewerStore.setState({
      isOpen: true,
      activeTabId: tabId,
      pendingContext: null,
      tabs: [
        {
          tabId,
          cwd: "/repo",
          relativePath: ".env",
          label: ".env",
          savedContents: "SECRET=value\n",
          draftContents: "SECRET=value\n",
          isDirty: false,
          isSaving: false,
          lastSaveError: null,
          mode: "edit",
          hasExternalChange: false,
        },
      ],
    });
    useQueryMock.mockReturnValue({
      data: {
        relativePath: ".env",
        contents: "SECRET=value\n",
        truncated: false,
        sizeBytes: 13,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    const { CodeViewerFileContent } = await import("./CodeViewerPanel");
    const markup = renderToStaticMarkup(
      <CodeViewerFileContent
        cwd="/repo"
        relativePath=".env"
        resolvedTheme="light"
        onAddContext={() => {}}
      />,
    );

    expect(markup).toContain("Sensitive file");
    expect(markup).toContain("Reveal values to edit this file.");
    expect(markup).toContain('data-editable="false"');
  });

  it("renders inline previews for binary files", async () => {
    const tabId = makeCodeViewerTabId("/repo", "photo.heic");
    useCodeViewerStore.setState({
      isOpen: true,
      activeTabId: tabId,
      pendingContext: null,
      tabs: [
        {
          tabId,
          cwd: "/repo",
          relativePath: "photo.heic",
          label: "photo.heic",
          savedContents: null,
          draftContents: null,
          isDirty: false,
          isSaving: false,
          lastSaveError: null,
          mode: "view",
          hasExternalChange: false,
        },
      ],
    });
    useQueryMock.mockReturnValue({
      data: {
        relativePath: "photo.heic",
        contents: "",
        hasTextContents: false,
        truncated: false,
        sizeBytes: 32,
        previewDataUrl: "data:image/heic;base64,AAAA",
        previewMimeType: "image/heic",
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    const { CodeViewerFileContent } = await import("./CodeViewerPanel");
    const markup = renderToStaticMarkup(
      <CodeViewerFileContent
        cwd="/repo"
        relativePath="photo.heic"
        resolvedTheme="light"
        onAddContext={() => {}}
      />,
    );

    expect(markup).toContain("Previewing");
    expect(markup).toContain("image/heic");
    expect(markup).toContain("<img");
  });

  it("renders preview toggle for previewable text files", async () => {
    const tabId = makeCodeViewerTabId("/repo", "icon.svg");
    useCodeViewerStore.setState({
      isOpen: true,
      activeTabId: tabId,
      pendingContext: null,
      tabs: [
        {
          tabId,
          cwd: "/repo",
          relativePath: "icon.svg",
          label: "icon.svg",
          savedContents: "<svg />",
          draftContents: "<svg />",
          isDirty: false,
          isSaving: false,
          lastSaveError: null,
          mode: "edit",
          hasExternalChange: false,
        },
      ],
    });
    useQueryMock.mockReturnValue({
      data: {
        relativePath: "icon.svg",
        contents: "<svg />",
        hasTextContents: true,
        truncated: false,
        sizeBytes: 7,
        previewDataUrl: "data:image/svg+xml;base64,PHN2ZyAvPg==",
        previewMimeType: "image/svg+xml",
      },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    const { CodeViewerFileContent } = await import("./CodeViewerPanel");
    const markup = renderToStaticMarkup(
      <CodeViewerFileContent
        cwd="/repo"
        relativePath="icon.svg"
        resolvedTheme="light"
        onAddContext={() => {}}
      />,
    );

    expect(markup).toContain("Preview");
    expect(markup).toContain('data-testid="mock-editor"');
  });
});
