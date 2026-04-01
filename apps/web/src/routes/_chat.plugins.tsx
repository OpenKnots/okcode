import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";

function PluginsRouteView() {
  const navigate = useNavigate();
  return (
    <SidebarInset>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="inline-flex rounded-xl border bg-muted/35 p-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void navigate({ to: "/plugins" })}
              >
                Plugins
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void navigate({ to: "/skills", search: { create: undefined, name: undefined } })
                }
              >
                Skills
              </Button>
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-6 py-12">
          <div className="rounded-2xl border bg-card/80 p-8 text-center">
            <h1 className="font-semibold text-3xl text-foreground">Plugins are next</h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              The plugin tab is reserved for a fuller plugin-management experience. The skills
              library is complete now.
            </p>
            <Button
              className="mt-6"
              onClick={() =>
                void navigate({ to: "/skills", search: { create: undefined, name: undefined } })
              }
            >
              Open skills
            </Button>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/plugins")({
  component: PluginsRouteView,
});
