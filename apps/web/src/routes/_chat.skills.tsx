import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { SkillsPage } from "~/components/skills/SkillsPage";
import { useStore } from "~/store";

function SkillsRouteView() {
  const projects = useStore((state) => state.projects);
  const cwd = useMemo(() => projects[0]?.cwd ?? null, [projects]);
  const search = Route.useSearch();
  return (
    <SkillsPage
      cwd={cwd}
      initialCreateOpen={search.create === "1"}
      {...(search.name ? { initialName: search.name } : {})}
    />
  );
}

export const Route = createFileRoute("/_chat/skills")({
  validateSearch: (search: Record<string, unknown>) => ({
    create: search.create === "1" ? "1" : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
  }),
  component: SkillsRouteView,
});
