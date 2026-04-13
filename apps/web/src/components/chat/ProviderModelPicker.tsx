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
  const selectedModelLabel =
    activeProviderSnapshot?.models?.find((option) => option.slug === props.model)?.name ??
    props.model;
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
                  {props.lockedProvider === provider ? " · locked for this thread" : ""}
                </span>
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
