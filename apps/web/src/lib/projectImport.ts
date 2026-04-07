import type { NativeApi, ProjectScript } from "@okcode/contracts";

import {
  buildProjectScriptDraftsFromPackageScripts,
  materializeProjectScripts,
  readPackageScriptInventory,
  resolvePackageManagerResolution,
} from "../projectScriptDefaults";

export interface ImportedProjectScriptsResolution {
  scripts: ProjectScript[] | undefined;
  warning: string | null;
}

export async function resolveImportedProjectScripts(
  api: NativeApi,
  cwd: string,
): Promise<ImportedProjectScriptsResolution> {
  try {
    const inventory = await readPackageScriptInventory(api, cwd);
    const packageManagerResolution = resolvePackageManagerResolution(inventory);
    const warning = inventory.scriptNames.length > 0 ? packageManagerResolution.warning : null;

    if (
      inventory.scriptNames.length === 0 ||
      !packageManagerResolution.preferredPackageManager ||
      packageManagerResolution.requiresManualSelection
    ) {
      return { scripts: undefined, warning };
    }

    return {
      scripts: materializeProjectScripts(
        buildProjectScriptDraftsFromPackageScripts({
          scriptNames: inventory.scriptNames,
          packageManager: packageManagerResolution.preferredPackageManager,
        }),
      ),
      warning,
    };
  } catch {
    return { scripts: undefined, warning: null };
  }
}
