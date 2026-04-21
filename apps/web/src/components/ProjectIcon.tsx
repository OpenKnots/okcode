import { cn } from "../lib/utils";
import { resolveProjectIconUrl } from "../lib/projectIcons";

export function ProjectIcon({
  cwd,
  iconPath,
  className,
}: {
  cwd: string;
  iconPath?: string | null | undefined;
  className?: string;
}) {
  const resolvedIconPath = iconPath?.trim();
  return (
    <img
      src={resolveProjectIconUrl({ cwd, iconPath: resolvedIconPath })}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 rounded-sm object-cover", className)}
    />
  );
}
