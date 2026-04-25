import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type {
  FileSystemEntry,
  ProjectBrowseDirectoryInput,
  ProjectBrowseDirectoryResult,
} from "@okcode/contracts";

/**
 * Lists the immediate children of a directory on the machine running the OK
 * Code server. Unlike `listWorkspaceDirectory`, this does not build a full
 * project index — it is intended for interactive folder-picker UIs where the
 * user navigates one level at a time.
 *
 * SECURITY POSTURE: This endpoint is reachable only through the authenticated
 * WebSocket transport (the same auth-token gate as every other WS method), but
 * within that gate it performs no path allowlisting. Any caller holding a
 * valid token can enumerate any directory the server process can stat —
 * effectively the entire filesystem of the user the server runs as. That is
 * intentional: this is a filesystem picker, and constraining it would defeat
 * the feature. Operators running the server with a shared or widely-distributed
 * token should treat filesystem enumeration as within scope of that token.
 */
export async function browseFileSystemDirectory(
  input: ProjectBrowseDirectoryInput,
): Promise<ProjectBrowseDirectoryResult> {
  const requested = input.path ?? homedir();
  if (!path.isAbsolute(requested)) {
    throw new Error(`path must be absolute, got: ${requested}`);
  }

  const resolved = path.resolve(requested);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`not a directory: ${resolved}`);
  }

  const dirents = await fs.readdir(resolved, { withFileTypes: true });
  const includeHidden = input.includeHidden ?? false;
  const entries: FileSystemEntry[] = [];
  let partial = false;

  for (const dirent of dirents) {
    if (!includeHidden && dirent.name.startsWith(".")) {
      continue;
    }

    let isSymlink = dirent.isSymbolicLink();
    let isDirectory = dirent.isDirectory();
    let isFile = dirent.isFile();

    // Resolve symlink targets so the caller can navigate through them. If the
    // target cannot be stat'd (broken link, permission denied) fall back to
    // reporting the link itself as a file-kind entry and flag partial.
    if (isSymlink) {
      try {
        const targetStat = await fs.stat(path.join(resolved, dirent.name));
        isDirectory = targetStat.isDirectory();
        isFile = targetStat.isFile();
      } catch {
        partial = true;
        isDirectory = false;
        isFile = true;
      }
    }

    if (!isDirectory && !isFile) {
      // Skip sockets, block devices, fifos — not meaningful for project picking.
      continue;
    }

    entries.push({
      name: dirent.name,
      kind: isDirectory ? "directory" : "file",
      isSymlink,
    });
  }

  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const parent = path.dirname(resolved);
  // Omit parentPath at the filesystem root, where dirname returns the input.
  return parent === resolved
    ? { path: resolved, entries, partial }
    : { path: resolved, parentPath: parent, entries, partial };
}
