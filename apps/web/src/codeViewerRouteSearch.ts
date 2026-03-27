export interface CodeViewerRouteSearch {
  codeViewer?: "1" | undefined;
}

function isCodeViewerOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

export function stripCodeViewerSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "codeViewer"> {
  const { codeViewer: _codeViewer, ...rest } = params;
  return rest as Omit<T, "codeViewer">;
}

export function parseCodeViewerRouteSearch(search: Record<string, unknown>): CodeViewerRouteSearch {
  const codeViewer = isCodeViewerOpenValue(search.codeViewer) ? "1" : undefined;
  if (codeViewer) {
    return { codeViewer };
  }
  return {};
}
