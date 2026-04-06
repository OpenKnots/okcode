import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import { memo, useState } from "react";
import { VscodeEntryIcon } from "~/components/chat/VscodeEntryIcon";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { projectListDirectoryQueryOptions } from "~/lib/projectReactQuery";
import { basenameOfPath } from "~/vscode-icons";

interface BreadcrumbBarProps {
  cwd: string;
  relativePath: string;
  resolvedTheme: "light" | "dark";
  onNavigate: (cwd: string, relativePath: string) => void;
}

export default memo(function BreadcrumbBar({
  cwd,
  relativePath,
  resolvedTheme,
  onNavigate,
}: BreadcrumbBarProps) {
  const segments = relativePath.split("/");

  return (
    <nav
      aria-label="File path"
      className="flex h-8 items-center gap-0.5 border-b border-border px-4 overflow-x-auto"
    >
      {segments.map((segment, index) => (
        <BreadcrumbSegment
          key={index}
          cwd={cwd}
          segment={segment}
          segmentIndex={index}
          segments={segments}
          isLast={index === segments.length - 1}
          resolvedTheme={resolvedTheme}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
});

interface BreadcrumbSegmentProps {
  cwd: string;
  segment: string;
  segmentIndex: number;
  segments: string[];
  isLast: boolean;
  resolvedTheme: "light" | "dark";
  onNavigate: (cwd: string, relativePath: string) => void;
}

const BreadcrumbSegment = memo(function BreadcrumbSegment({
  cwd,
  segment,
  segmentIndex,
  segments,
  isLast,
  resolvedTheme,
  onNavigate,
}: BreadcrumbSegmentProps) {
  const [open, setOpen] = useState(false);

  const parentDir = segments.slice(0, segmentIndex).join("/") || undefined;

  const { data } = useQuery({
    ...projectListDirectoryQueryOptions({
      cwd,
      directoryPath: parentDir,
      enabled: open,
    }),
  });

  return (
    <>
      {segmentIndex > 0 && (
        <ChevronRightIcon className="size-3 text-muted-foreground/40 shrink-0" />
      )}
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger
          className={
            isLast
              ? "text-[11px] text-foreground font-medium rounded-sm px-1 py-0.5"
              : "text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-[120ms] rounded-sm px-1 py-0.5 hover:bg-accent/60"
          }
        >
          {segment}
        </MenuTrigger>
        <MenuPopup side="bottom" align="start">
          {data?.entries.map((entry) => (
            <MenuItem
              key={entry.path}
              onClick={() => {
                if (entry.kind === "file") {
                  onNavigate(cwd, entry.path);
                }
              }}
            >
              <VscodeEntryIcon
                pathValue={entry.path}
                kind={entry.kind}
                theme={resolvedTheme}
                className="size-3.5 shrink-0"
              />
              <span className="truncate">{basenameOfPath(entry.path)}</span>
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    </>
  );
});
