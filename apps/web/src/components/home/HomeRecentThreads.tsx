import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { RecentThread } from "./home-utils";

interface HomeRecentThreadsProps {
  threads: RecentThread[];
  onThreadClick: (id: string) => void;
}

export function HomeRecentThreads({ threads, onThreadClick }: HomeRecentThreadsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Recent threads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {threads.length > 0 ? (
          threads.map((thread) => (
            <button
              type="button"
              key={thread.id}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent/50"
              onClick={() => onThreadClick(thread.id)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {thread.projectName} · {thread.statusLabel}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{thread.updatedLabel}</span>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No threads yet. Start one above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
