import { type ModelSlug, type ProviderKind, type ServerProviderStatus } from "@okcode/contracts";
import { memo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { getThreadProviderLabel } from "~/lib/providerAvailability";
import { ClaudeAI, Gemini, GitHubIcon, type Icon, OpenAI, OpenClawIcon } from "../Icons";
import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";

const CODEX_LOCAL_BACKEND_LABELS: Record<string, string> = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

function getCodexLocalBackendLabel(id: string | null | undefined): string | null {
  if (typeof id !== "string") {
    return null;
  }
  return CODEX_LOCAL_BACKEND_LABELS[id] ?? null;
}

type OpenclawGatewayBadge = "connected" | "url-configured" | null;

function getOpenclawGatewayBadge(input: {
  readonly snapshot: ServerProviderStatus | null;
  readonly gatewayUrl: string | null | undefined;
}): OpenclawGatewayBadge {
  const snapshot = input.snapshot;
  if (snapshot !== null) {
    const isAvailable = snapshot.available === true || snapshot.enabled === true;
    if (snapshot.status === "ready" && isAvailable) {
      return "connected";
    }
  }
  if (typeof input.gatewayUrl === "string" && input.gatewayUrl.trim().length > 0) {
    return "url-configured";
  }
  return null;
}

const PROVIDER_ICON_BY_PROVIDER: Record<ProviderKind, Icon> = {
  codex: OpenAI,
  claudeAgent: ClaudeAI,
  gemini: Gemini,
  copilot: GitHubIcon,
  openclaw: OpenClawIcon,
};

function providerIconClassName(provider: ProviderKind, fallbackClassName: string): string {
  if (provider === "claudeAgent") return "text-[#d97757]";
  if (provider === "gemini") return "text-[#78c2ff]";
  if (provider === "openclaw") return "text-[#6cb4ee]";
  if (provider === "copilot") return "text-white/85";
  return fallbackClassName;
}

function getProviderLabel(provider: ProviderKind): string {
  return getThreadProviderLabel(provider);
}

function getProviderSnapshot(
  providers: ReadonlyArray<ServerProviderStatus>,
  provider: ProviderKind,
): ServerProviderStatus | null {
  return providers.find((entry) => entry.provider === provider) ?? null;
}

export const ProviderModelPicker = memo(function ProviderModelPicker(props: {
  provider: ProviderKind;
  model: ModelSlug;
  lockedProvider: ProviderKind | null;
  providers: ReadonlyArray<ServerProviderStatus>;
  activeProviderIconClassName?: string;
  codexSelectedModelProviderId?: string | null | undefined;
  openclawGatewayUrl?: string | null | undefined;
  compact?: boolean;
  disabled?: boolean;
  onProviderModelChange: (provider: ProviderKind, model: ModelSlug) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeProvider = props.lockedProvider ?? props.provider;
  const visibleProviders =
    props.lockedProvider !== null
      ? [props.lockedProvider]
      : props.providers.map((provider) => provider.provider);
  const activeProviderSnapshot = getProviderSnapshot(props.providers, activeProvider);
  const rawSelectedModelLabel =
    activeProviderSnapshot?.models?.find((option) => option.slug === props.model)?.name ??
    props.model;
  const codexLocalBackendLabel =
    activeProvider === "codex"
      ? getCodexLocalBackendLabel(props.codexSelectedModelProviderId ?? null)
      : null;
  const selectedModelLabel = codexLocalBackendLabel
    ? `${rawSelectedModelLabel} · ${codexLocalBackendLabel}`
    : rawSelectedModelLabel;
  const ProviderIcon = PROVIDER_ICON_BY_PROVIDER[activeProvider];

  const handleModelChange = (provider: ProviderKind, value: string) => {
    if (props.disabled || !value) {
      return;
    }
    const option = getProviderSnapshot(props.providers, provider)?.models?.find(
      (model) => model.slug === value,
    );
    if (!option) {
      return;
    }
    props.onProviderModelChange(provider, option.slug);
    setIsMenuOpen(false);
  };

  return (
    <Menu
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (props.disabled) {
          setIsMenuOpen(false);
          return;
        }
        setIsMenuOpen(open);
      }}
    >
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "min-w-0 justify-start overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 [&_svg]:mx-0",
              props.compact ? "max-w-42 shrink-0" : "max-w-48 shrink sm:max-w-56 sm:px-3",
            )}
            disabled={props.disabled}
          />
        }
      >
        <span
          className={cn(
            "flex min-w-0 w-full items-center gap-2 overflow-hidden",
            props.compact ? "max-w-36" : undefined,
          )}
        >
          <ProviderIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0",
              providerIconClassName(activeProvider, "text-muted-foreground/70"),
              props.activeProviderIconClassName,
            )}
          />
          <span className="min-w-0 flex-1 truncate">{selectedModelLabel}</span>
          <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
        </span>
      </MenuTrigger>
      <MenuPopup align="start">
        {visibleProviders.map((provider, index) => {
          const providerSnapshot = getProviderSnapshot(props.providers, provider);
          const ProviderOptionIcon = PROVIDER_ICON_BY_PROVIDER[provider];
          if (!providerSnapshot?.models || providerSnapshot.models.length === 0) {
            return null;
          }

          const openclawBadge =
            provider === "openclaw"
              ? getOpenclawGatewayBadge({
                  snapshot: providerSnapshot,
                  gatewayUrl: props.openclawGatewayUrl,
                })
              : null;
          const codexGroupBackendLabel =
            provider === "codex"
              ? getCodexLocalBackendLabel(props.codexSelectedModelProviderId ?? null)
              : null;

          return (
            <MenuGroup key={provider}>
              {index > 0 ? <MenuDivider /> : null}
              <MenuGroupLabel className="flex items-center gap-2 px-2 pb-1 pt-2 text-[11px] uppercase tracking-[0.08em]">
                <ProviderOptionIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    providerIconClassName(provider, "text-muted-foreground/85"),
                  )}
                />
                <span>
                  {getProviderLabel(provider)}
                  {codexGroupBackendLabel ? ` · ${codexGroupBackendLabel}` : ""}
                  {props.lockedProvider === provider ? " · locked for this thread" : ""}
                </span>
                {openclawBadge === "connected" ? (
                  <span
                    className="ml-auto shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300"
                    aria-label="OpenClaw gateway connected"
                  >
                    ✓ Connected
                  </span>
                ) : openclawBadge === "url-configured" ? (
                  <span
                    className="ml-auto shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300"
                    aria-label="OpenClaw gateway URL configured"
                  >
                    URL configured
                  </span>
                ) : null}
              </MenuGroupLabel>
              <MenuRadioGroup
                value={props.provider === provider ? props.model : ""}
                onValueChange={(value) => handleModelChange(provider, value)}
              >
                {providerSnapshot.models.map((modelOption) => (
                  <MenuRadioItem
                    key={`${provider}:${modelOption.slug}`}
                    value={modelOption.slug}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {modelOption.name}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          );
        })}
      </MenuPopup>
    </Menu>
  );
});
