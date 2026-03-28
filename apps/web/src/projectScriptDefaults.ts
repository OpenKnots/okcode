import type {
  NativeApi,
  ProjectDirectoryEntry,
  ProjectScript,
  ProjectScriptIcon,
} from "@okcode/contracts";

import { nextProjectScriptId } from "./projectScripts";

export type ProjectPackageManager = "bun" | "pnpm" | "yarn" | "npm";

export interface ProjectScriptDraft {
  name: string;
  command: string;
  icon: ProjectScriptIcon;
  runOnWorktreeCreate: boolean;
}

export interface PackageScriptInventory {
  packageName: string | null;
  scriptNames: string[];
  packageManagerField: ProjectPackageManager | null;
  lockfilePackageManagers: ProjectPackageManager[];
}

export interface PackageManagerResolution {
  preferredPackageManager: ProjectPackageManager | null;
  requiresManualSelection: boolean;
  warning: string | null;
}

const PACKAGE_MANAGER_LOCKFILES: Record<ProjectPackageManager, readonly string[]> = {
  bun: ["bun.lock", "bun.lockb"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
  npm: ["package-lock.json", "npm-shrinkwrap.json"],
};

const PACKAGE_MANAGER_PRIORITY: readonly ProjectPackageManager[] = ["bun", "pnpm", "yarn", "npm"];

function parsePackageManagerField(value: unknown): ProjectPackageManager | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("bun@")) return "bun";
  if (normalized.startsWith("pnpm@")) return "pnpm";
  if (normalized.startsWith("yarn@")) return "yarn";
  if (normalized.startsWith("npm@")) return "npm";
  return null;
}

function toTitleCase(value: string): string {
  return value
    .split(/[:/_-]+/g)
    .map((segment) => (segment.length > 0 ? `${segment[0]!.toUpperCase()}${segment.slice(1)}` : ""))
    .filter((segment) => segment.length > 0)
    .join(" ");
}

function resolveScriptIcon(scriptName: string): ProjectScriptIcon {
  const normalized = scriptName.trim().toLowerCase();
  if (/(^|:)(test|spec|check)(:|$)/.test(normalized)) return "test";
  if (normalized.includes("lint")) return "lint";
  if (/(^|:)(build|bundle|compile)(:|$)/.test(normalized)) return "build";
  if (/(^|:)(setup|bootstrap|configure|config)(:|$)/.test(normalized)) return "configure";
  if (/(^|:)(debug|inspect)(:|$)/.test(normalized)) return "debug";
  return "play";
}

function quotePackageScriptName(scriptName: string): string {
  return /^[a-z0-9:_-]+$/i.test(scriptName) ? scriptName : JSON.stringify(scriptName);
}

function commandForPackageScript(
  packageManager: ProjectPackageManager,
  scriptName: string,
): string {
  return `${packageManager} run ${quotePackageScriptName(scriptName)}`;
}

export function resolvePackageManagerResolution(
  inventory: Pick<PackageScriptInventory, "lockfilePackageManagers" | "packageManagerField">,
): PackageManagerResolution {
  if (inventory.lockfilePackageManagers.length === 1) {
    return {
      preferredPackageManager: inventory.lockfilePackageManagers[0] ?? null,
      requiresManualSelection: false,
      warning: null,
    };
  }

  if (inventory.lockfilePackageManagers.length > 1) {
    const labels = inventory.lockfilePackageManagers.join(", ");
    return {
      preferredPackageManager: inventory.packageManagerField,
      requiresManualSelection: true,
      warning: `Multiple package manager lockfiles were detected (${labels}). Select the package manager to use for imported actions.`,
    };
  }

  if (inventory.packageManagerField) {
    return {
      preferredPackageManager: inventory.packageManagerField,
      requiresManualSelection: false,
      warning: null,
    };
  }

  return {
    preferredPackageManager: null,
    requiresManualSelection: true,
    warning:
      "No package manager lockfile was detected. Select the package manager to use for imported actions.",
  };
}

export function parsePackageScriptInventory(
  packageJsonContents: string,
  rootEntries: ReadonlyArray<Pick<ProjectDirectoryEntry, "path" | "kind">>,
): PackageScriptInventory {
  const parsed = JSON.parse(packageJsonContents) as {
    name?: unknown;
    packageManager?: unknown;
    scripts?: Record<string, unknown>;
  };
  const packageName =
    typeof parsed.name === "string" && parsed.name.trim().length > 0 ? parsed.name : null;
  const scripts = parsed.scripts ?? {};
  const scriptNames = Object.entries(scripts)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    )
    .map(([name]) => name);
  const fileNames = new Set(
    rootEntries.filter((entry) => entry.kind === "file").map((entry) => entry.path),
  );
  const lockfilePackageManagers = PACKAGE_MANAGER_PRIORITY.filter((manager) =>
    PACKAGE_MANAGER_LOCKFILES[manager].some((fileName) => fileNames.has(fileName)),
  );

  return {
    packageName,
    scriptNames,
    packageManagerField: parsePackageManagerField(parsed.packageManager),
    lockfilePackageManagers,
  };
}

export function buildProjectScriptDraftsFromPackageScripts(input: {
  scriptNames: ReadonlyArray<string>;
  packageManager: ProjectPackageManager;
}): ProjectScriptDraft[] {
  return input.scriptNames.map((scriptName) => ({
    name: toTitleCase(scriptName),
    command: commandForPackageScript(input.packageManager, scriptName),
    icon: resolveScriptIcon(scriptName),
    runOnWorktreeCreate: false,
  }));
}

export function materializeProjectScripts(
  drafts: ReadonlyArray<ProjectScriptDraft>,
  existing: ReadonlyArray<ProjectScript> = [],
): ProjectScript[] {
  const nextScripts = existing.map((script) => ({ ...script }));
  const existingIds = nextScripts.map((script) => script.id);

  for (const draft of drafts) {
    const matchIndex = nextScripts.findIndex(
      (script) => script.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
    );
    if (matchIndex >= 0) {
      nextScripts[matchIndex] = {
        ...nextScripts[matchIndex]!,
        ...draft,
      };
      continue;
    }

    const id = nextProjectScriptId(draft.name, existingIds);
    existingIds.push(id);
    nextScripts.push({
      id,
      ...draft,
    });
  }

  return nextScripts;
}

export async function readPackageScriptInventory(
  api: NativeApi,
  cwd: string,
): Promise<PackageScriptInventory> {
  const [packageJsonResult, directoryResult] = await Promise.all([
    api.projects.readFile({
      cwd,
      relativePath: "package.json",
    }),
    api.projects.listDirectory({ cwd }),
  ]);

  return parsePackageScriptInventory(packageJsonResult.contents, directoryResult.entries);
}
