import { renderToStaticMarkup } from "react-dom/server";
import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

const useQueryMock = vi.mocked(useQuery);

describe("WorkspaceFileTree", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("does not crash when the directory query returns a partial payload", async () => {
    useQueryMock.mockReturnValue({
      data: { truncated: false },
      isError: false,
      isLoading: false,
      error: null,
    } as never);

    const { WorkspaceFileTree } = await import("./WorkspaceFileTree");
    const markup = renderToStaticMarkup(
      <WorkspaceFileTree cwd="/repo/project" resolvedTheme="light" />,
    );

    expect(markup).toContain("No files found.");
  });
});
