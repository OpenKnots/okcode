export function resolveProjectIconUrl(input: {
  cwd: string;
  iconPath?: string | null | undefined;
}): string {
  const searchParams = new URLSearchParams({ cwd: input.cwd });
  const iconPath = input.iconPath?.trim();
  if (iconPath) {
    searchParams.set("icon", iconPath);
  }
  return `/api/project-favicon?${searchParams.toString()}`;
}
