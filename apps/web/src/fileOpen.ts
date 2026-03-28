import { type NativeApi } from "@okcode/contracts";
import { openInPreferredEditor } from "./editorPreferences";

const POSITION_SUFFIX_PATTERN = /:(\d+)(?::(\d+))?$/;

export interface FileTargetPosition {
  path: string;
  line: number | null;
  column: number | null;
}

export function splitFileTargetPosition(targetPath: string): FileTargetPosition {
  const match = targetPath.match(POSITION_SUFFIX_PATTERN);
  if (!match?.[1]) {
    return {
      path: targetPath,
      line: null,
      column: null,
    };
  }

  return {
    path: targetPath.slice(0, -match[0].length),
    line: Number(match[1]),
    column: match[2] ? Number(match[2]) : null,
  };
}

function normalizePathForComparison(pathValue: string): string {
  return pathValue.replaceAll("\\", "/").replace(/\/+$/, "");
}

export function resolveCodeViewerRelativePath(
  targetPath: string,
  cwd: string | undefined,
): string | null {
  if (!cwd) return null;

  const { path } = splitFileTargetPosition(targetPath);
  const normalizedPath = normalizePathForComparison(path);
  const normalizedCwd = normalizePathForComparison(cwd);

  if (normalizedPath === normalizedCwd) {
    return null;
  }

  const prefix = `${normalizedCwd}/`;
  if (!normalizedPath.startsWith(prefix)) {
    return null;
  }

  return normalizedPath.slice(prefix.length);
}

export async function openFileReference(props: {
  api: NativeApi;
  cwd: string | undefined;
  targetPath: string;
  preferExternal: boolean;
  openInViewer: (cwd: string, relativePath: string) => void;
}): Promise<void> {
  const { api, cwd, openInViewer, preferExternal, targetPath } = props;

  if (preferExternal) {
    await openInPreferredEditor(api, targetPath);
    return;
  }

  const relativePath = resolveCodeViewerRelativePath(targetPath, cwd);
  if (!cwd || !relativePath) {
    throw new Error("Unable to open this file inside OK Code.");
  }

  openInViewer(cwd, relativePath);
}
