import type { NativeApi, ProjectId } from "@okcode/contracts";

import { newCommandId } from "./utils";
import { normalizeProjectIconPath } from "./projectIcons";

export async function updateProjectIconOverride(
  api: NativeApi,
  projectId: ProjectId,
  iconPath: string | null | undefined,
): Promise<void> {
  await api.orchestration.dispatchCommand({
    type: "project.meta.update",
    commandId: newCommandId(),
    projectId,
    iconPath: normalizeProjectIconPath(iconPath),
  });
}
