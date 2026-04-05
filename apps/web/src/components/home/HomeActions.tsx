import { FolderOpenIcon, GitBranchIcon, SettingsIcon, TerminalSquareIcon } from "lucide-react";

import { Button } from "../ui/button";

interface HomeActionsProps {
  latestProjectName: string | null;
  isOpeningProject: boolean;
  onNewThread: () => void;
  onOpenFolder: () => void;
  onCloneRepo: () => void;
  onSettings: () => void;
}

export function HomeActions({
  latestProjectName,
  isOpeningProject,
  onNewThread,
  onOpenFolder,
  onCloneRepo,
  onSettings,
}: HomeActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onNewThread}>
        <TerminalSquareIcon className="size-4" />
        {latestProjectName ? `New thread in ${latestProjectName}` : "Open your first project"}
      </Button>
      <Button variant="outline" onClick={onOpenFolder} disabled={isOpeningProject}>
        <FolderOpenIcon className="size-4" />
        {isOpeningProject ? "Opening..." : "Open folder"}
      </Button>
      <Button variant="outline" onClick={onCloneRepo}>
        <GitBranchIcon className="size-4" />
        Clone repo
      </Button>
      <Button variant="ghost" onClick={onSettings}>
        <SettingsIcon className="size-4" />
        Settings
      </Button>
    </div>
  );
}
