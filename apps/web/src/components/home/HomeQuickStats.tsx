import { Separator } from "../ui/separator";

interface HomeQuickStatsProps {
  projectCount: number;
  threadCount: number;
  envModeLabel: string;
}

export function HomeQuickStats({ projectCount, threadCount, envModeLabel }: HomeQuickStatsProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span>
        {threadCount} {threadCount === 1 ? "thread" : "threads"}
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span>{envModeLabel}</span>
    </div>
  );
}
