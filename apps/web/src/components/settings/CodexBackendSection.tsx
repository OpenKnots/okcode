import type { ServerCodexConfigSummary } from "@okcode/contracts";

import { buildCodexBackendCatalog } from "../../lib/codexBackendCatalog";
import { cn } from "../../lib/utils";

function CodexBackendGroup({
  title,
  rows,
}: {
  title: string;
  rows: ReadonlyArray<ReturnType<typeof buildCodexBackendCatalog>["builtIn"][number]>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-2 overflow-hidden rounded-xl border border-border/70">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-3 border-t border-border/60 px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{row.title}</span>
                {row.statusBadge ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                      row.statusBadge === "Configured"
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : row.statusBadge === "Implicit default"
                          ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {row.statusBadge}
                  </span>
                ) : null}
              </div>
              <code className="mt-1 block truncate text-xs text-muted-foreground">{row.id}</code>
            </div>
            <div className="text-xs text-muted-foreground">{row.authNote}</div>
            <div className="text-xs text-muted-foreground sm:text-right">
              {row.selected
                ? "Active backend"
                : row.definedInConfig
                  ? "Detected from config"
                  : "Available preset"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CodexBackendSection({
  summary,
}: {
  summary: ServerCodexConfigSummary | null | undefined;
}) {
  const catalog = buildCodexBackendCatalog(summary);

  return (
    <div className="space-y-4">
      {catalog.parseError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
          Codex config parsing failed, so this list may be incomplete. The last recoverable backend
          selection is still shown.
        </div>
      ) : null}

      <CodexBackendGroup title="Built-in" rows={catalog.builtIn} />
      <CodexBackendGroup title="Curated presets" rows={catalog.curated} />
      <CodexBackendGroup title="Detected custom" rows={catalog.detectedCustom} />
    </div>
  );
}
