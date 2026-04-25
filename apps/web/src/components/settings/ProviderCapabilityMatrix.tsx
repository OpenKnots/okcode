import type { ProviderKind, ServerProviderStatus } from "@okcode/contracts";

import {
  getProviderLabel,
  getProviderStatusDescription,
  getProviderStatusHeading,
} from "../chat/providerStatusPresentation";
import { isProviderReadyForThreadSelection } from "../../lib/providerAvailability";
import {
  PROVIDER_CAPABILITY_METADATA,
  SETTINGS_AUTH_PROVIDER_ORDER,
  SHARED_PROVIDER_CAPABILITIES,
} from "../../lib/settingsProviderMetadata";
import { cn } from "../../lib/utils";

function getProviderBadge(input: {
  provider: ProviderKind;
  status: ServerProviderStatus | null;
  openclawGatewayUrl: string;
}): { tone: "success" | "warning" | "error"; label: string } {
  if (
    isProviderReadyForThreadSelection({
      provider: input.provider,
      statuses: input.status ? [input.status] : [],
      openclawGatewayUrl: input.openclawGatewayUrl,
    })
  ) {
    return { tone: "success", label: "Available" };
  }

  if (input.status?.authStatus === "unauthenticated") {
    return { tone: "error", label: "Sign-in required" };
  }

  if (input.provider === "openclaw" && input.openclawGatewayUrl.trim().length === 0) {
    return { tone: "warning", label: "Gateway missing" };
  }

  if (input.status?.available === false || input.status?.status === "error") {
    return { tone: "error", label: "Unavailable" };
  }

  return { tone: "warning", label: "Needs verification" };
}

function getBadgeClassName(tone: "success" | "warning" | "error"): string {
  switch (tone) {
    case "success":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "error":
      return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
    case "warning":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}

export function ProviderCapabilityMatrix({
  statuses,
  openclawGatewayUrl,
}: {
  statuses: ReadonlyArray<ServerProviderStatus>;
  openclawGatewayUrl: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card/50 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">Shared runtime contract</h3>
          <p className="text-xs text-muted-foreground">
            Every supported provider plugs into the same chat surface and orchestration flow. The
            differences below are where setup or controls are truly provider-specific.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SHARED_PROVIDER_CAPABILITIES.map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {capability}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {SETTINGS_AUTH_PROVIDER_ORDER.map((provider) => {
          const status = statuses.find((entry) => entry.provider === provider) ?? null;
          const metadata = PROVIDER_CAPABILITY_METADATA[provider];
          const badge = getProviderBadge({
            provider,
            status,
            openclawGatewayUrl,
          });
          const heading = status
            ? getProviderStatusHeading(status)
            : `${getProviderLabel(provider)} needs configuration`;
          const description = status
            ? getProviderStatusDescription(status)
            : metadata.configSurface;

          return (
            <div key={provider} className="rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">
                      {getProviderLabel(provider)}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                        getBadgeClassName(badge.tone),
                      )}
                    >
                      {badge.label}
                    </span>
                    {metadata.projectChatDefault ? (
                      <span className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">
                        Project chat default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs font-medium text-foreground">{heading}</p>
                  <p className="max-w-2xl text-xs text-muted-foreground">{description}</p>
                </div>
                {status?.checkedAt ? (
                  <span className="text-[11px] text-muted-foreground">
                    Checked {new Date(status.checkedAt).toLocaleString()}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Unique
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {metadata.uniqueCapabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] text-foreground"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Config
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{metadata.configSurface}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
