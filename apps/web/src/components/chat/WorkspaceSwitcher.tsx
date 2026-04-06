import { memo } from "react";
import { ChevronDownIcon, FolderOpenIcon, MonitorIcon, ServerIcon } from "lucide-react";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator, MenuGroupLabel } from "~/components/ui/menu";

interface WorkspaceSwitcherProps {
  activeProjectName: string | undefined;
  recentProjects: Array<{ id: string; name: string }>;
  onSelectProject: (id: string) => void;
  onOpenFolder: () => void;
}

export const WorkspaceSwitcher = memo(function WorkspaceSwitcher({
  activeProjectName,
  recentProjects,
  onSelectProject,
  onOpenFolder,
}: WorkspaceSwitcherProps) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent [-webkit-app-region:no-drag]"
          >
            <span className="max-w-[120px] truncate">{activeProjectName ?? "Home"}</span>
            <ChevronDownIcon className="size-3 text-muted-foreground/70" />
          </button>
        }
      />
      <MenuPopup side="bottom" align="start" className="w-64">
        {recentProjects.length > 0 && (
          <>
            <MenuGroupLabel>Recents</MenuGroupLabel>
            {recentProjects.slice(0, 5).map((project) => (
              <MenuItem key={project.id} onClick={() => onSelectProject(project.id)}>
                <FolderOpenIcon className="size-4 mr-2 text-muted-foreground" />
                <span className="truncate">{project.name}</span>
              </MenuItem>
            ))}
            <MenuSeparator />
          </>
        )}
        <MenuGroupLabel>Run On</MenuGroupLabel>
        <MenuItem disabled>
          <MonitorIcon className="size-4 mr-2 text-muted-foreground" />
          This Mac
        </MenuItem>
        <MenuItem disabled>
          <ServerIcon className="size-4 mr-2 text-muted-foreground" />
          Remote SSH
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={onOpenFolder}>
          <FolderOpenIcon className="size-4 mr-2 text-muted-foreground" />
          Open Folder...
        </MenuItem>
        <MenuItem disabled>
          <ServerIcon className="size-4 mr-2 text-muted-foreground" />
          Connect SSH...
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
});
