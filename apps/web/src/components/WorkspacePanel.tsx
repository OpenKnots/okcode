import { ChevronDownIcon, FolderIcon } from "lucide-react";
import { memo, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export type WorkspaceLayoutMode = "stacked" | "split";

const WORKSPACE_SPLIT_MIN_WIDTH_PX = 600;

export function resolveWorkspaceLayoutMode(width: number): WorkspaceLayoutMode {
  return width >= WORKSPACE_SPLIT_MIN_WIDTH_PX ? "split" : "stacked";
}

function basenameOfPath(pathValue: string): string {
  const normalizedPath = pathValue.replace(/\/+$/, "");
  const segments = normalizedPath.split("/");
  return segments[segments.length - 1] || pathValue;
}

export const WorkspacePanel = memo(function WorkspacePanel(props: {
  cwd: string | null;
  tree: ReactNode;
  editor: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>("stacked");
  const workspaceLabel = props.cwd ? basenameOfPath(props.cwd) : "Workspace";

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const syncLayoutMode = () => {
      const nextMode = resolveWorkspaceLayoutMode(element.getBoundingClientRect().width);
      setLayoutMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
    };

    syncLayoutMode();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncLayoutMode();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const [treeCollapsed, setTreeCollapsed] = useState(false);

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col bg-background">
      <div className={cn("flex min-h-0 flex-1", layoutMode === "split" ? "flex-row" : "flex-col")}>
        {props.cwd ? (
          <section
            className={cn(
              "flex shrink-0 overflow-hidden bg-card/35",
              treeCollapsed
                ? "min-h-0 h-auto"
                : layoutMode === "split"
                  ? "min-h-0 w-[clamp(15rem,32%,19rem)] border-r border-border/60"
                  : "min-h-0 h-[clamp(14rem,34vh,20rem)] border-b border-border/60",
              treeCollapsed && "border-b border-border/60",
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={() => setTreeCollapsed((prev) => !prev)}
                className="flex w-full items-center border-b border-border/60 px-3 py-2 text-left hover:bg-accent/40 transition-colors"
              >
                <ChevronDownIcon
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground/60 transition-transform mr-1.5",
                    treeCollapsed && "-rotate-90",
                  )}
                />
                <FolderIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
                <div className="min-w-0 ml-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
                    Workspace
                  </p>
                  <p className="truncate font-mono text-[11px] text-foreground/85">
                    {workspaceLabel}
                  </p>
                </div>
              </button>
              {!treeCollapsed && (
                <div className="min-h-0 flex-1 overflow-y-auto py-2">{props.tree}</div>
              )}
            </div>
          </section>
        ) : null}
        <section className="min-h-0 min-w-0 flex-1 bg-background">{props.editor}</section>
      </div>
    </div>
  );
});
