import { type ModelSlug, type ProviderKind } from "@okcode/contracts";
import { resolveSelectableModel } from "@okcode/shared/model";
import { memo, useCallback, useRef, useState } from "react";
import { type ProviderPickerKind, PROVIDER_OPTIONS } from "../../session-logic";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import {
  ClaudeAI,
  CursorIcon,
  Gemini,
  GitHubIcon,
  Icon,
  OpenAI,
  OpenClawIcon,
  OpenCodeIcon,
} from "../Icons";
import { cn } from "~/lib/utils";

function isAvailableProviderOption(option: (typeof PROVIDER_OPTIONS)[number]): option is {
  value: ProviderKind;
  label: string;
  available: true;
} {
  return option.available;
}

const PROVIDER_ICON_BY_PROVIDER: Record<ProviderPickerKind, Icon> = {
  codex: OpenAI,
  claudeAgent: ClaudeAI,
  openclaw: OpenClawIcon,
  copilot: GitHubIcon,
  cursor: CursorIcon,
};

export const AVAILABLE_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter(isAvailableProviderOption);
const UNAVAILABLE_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter((option) => !option.available);
const COMING_SOON_PROVIDER_OPTIONS = [
  { id: "opencode", label: "OpenCode", icon: OpenCodeIcon },
  { id: "gemini", label: "Gemini", icon: Gemini },
] as const;

function providerIconClassName(
  provider: ProviderKind | ProviderPickerKind,
  fallbackClassName: string,
): string {
  if (provider === "claudeAgent") return "text-[#d97757]";
  if (provider === "openclaw") return "text-[#6cb4ee]";
  if (provider === "copilot") return "text-white/85";
  return fallbackClassName;
}

function getProviderLabel(provider: ProviderKind): string {
  return AVAILABLE_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export const ProviderModelPicker = memo(function ProviderModelPicker(props: {
  provider: ProviderKind;
  model: ModelSlug;
  lockedProvider: ProviderKind | null;
  modelOptionsByProvider: Record<ProviderKind, ReadonlyArray<{ slug: string; name: string }>>;
  activeProviderIconClassName?: string;
  compact?: boolean;
  disabled?: boolean;
  onProviderModelChange: (provider: ProviderKind, model: ModelSlug) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenuProvider, setActiveMenuProvider] = useState<ProviderKind>(
    props.lockedProvider ?? props.provider,
  );
  const menuJustOpenedRef = useRef(false);
  const setActiveMenuProviderFromInteraction = useCallback((provider: ProviderKind) => {
    if (menuJustOpenedRef.current) return;
    setActiveMenuProvider(provider);
  }, []);
  const activeProvider = props.lockedProvider ?? props.provider;
  const selectedProviderOptions = props.modelOptionsByProvider[activeProvider];
  const selectedModelLabel =
    selectedProviderOptions.find((option) => option.slug === props.model)?.name ?? props.model;
  const ProviderIcon = PROVIDER_ICON_BY_PROVIDER[activeProvider];
  const previewProvider = props.lockedProvider ?? activeMenuProvider;
  const previewProviderOptions = props.modelOptionsByProvider[previewProvider];
  const PreviewProviderIcon = PROVIDER_ICON_BY_PROVIDER[previewProvider];
  const providerList =
    props.lockedProvider === null
      ? AVAILABLE_PROVIDER_OPTIONS
      : AVAILABLE_PROVIDER_OPTIONS.filter((option) => option.value === props.lockedProvider);
  const handleModelChange = (provider: ProviderKind, value: string) => {
    if (props.disabled) return;
    if (!value) return;
    const resolvedModel = resolveSelectableModel(
      provider,
      value,
      props.modelOptionsByProvider[provider],
    );
    if (!resolvedModel) return;
    props.onProviderModelChange(provider, resolvedModel);
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
        if (open) {
          setActiveMenuProvider(props.lockedProvider ?? props.provider);
          menuJustOpenedRef.current = true;
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
      <MenuPopup
        align="start"
        className="w-[min(40rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden"
      >
        <div className="grid h-[min(30rem,calc(100vh-6rem))] min-h-[22rem] grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border/70 bg-muted/20">
            <div className="px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/85">
              Providers
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
              <div
                aria-label="Providers"
                className="space-y-0.5"
                role="list"
                onPointerMove={() => {
                  menuJustOpenedRef.current = false;
                }}
              >
                {providerList.map((option) => {
                  const OptionIcon = PROVIDER_ICON_BY_PROVIDER[option.value];
                  const isCurrentProvider = props.provider === option.value;
                  const isPreviewProvider = previewProvider === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-base text-foreground outline-none transition-colors sm:min-h-7 sm:text-sm",
                        isPreviewProvider
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60",
                      )}
                      onClick={() => {
                        if (props.lockedProvider !== null) return;
                        setActiveMenuProvider(option.value);
                      }}
                      onFocus={() => setActiveMenuProviderFromInteraction(option.value)}
                      onMouseEnter={() => setActiveMenuProviderFromInteraction(option.value)}
                    >
                      <OptionIcon
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0",
                          providerIconClassName(
                            option.value,
                            isPreviewProvider
                              ? "text-accent-foreground/85"
                              : "text-muted-foreground/85",
                          ),
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {isCurrentProvider ? (
                        <span className="rounded-full border border-border/80 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/75">
                          Current
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {props.lockedProvider === null ? (
                <>
                  <div className="mx-2 my-2 h-px bg-border" />
                  {[...UNAVAILABLE_PROVIDER_OPTIONS, ...COMING_SOON_PROVIDER_OPTIONS].map(
                    (option) => {
                      const OptionIcon =
                        "value" in option ? PROVIDER_ICON_BY_PROVIDER[option.value] : option.icon;
                      const key = "value" in option ? option.value : option.id;
                      return (
                        <div
                          key={key}
                          className="flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground/72 opacity-64 sm:min-h-7 sm:text-sm"
                        >
                          <OptionIcon
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground/85 opacity-80"
                          />
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/75">
                            Soon
                          </span>
                        </div>
                      );
                    },
                  )}
                </>
              ) : null}
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 pb-2 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <PreviewProviderIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    providerIconClassName(previewProvider, "text-muted-foreground/85"),
                  )}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {getProviderLabel(previewProvider)}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
                    Models
                  </div>
                </div>
              </div>
              {props.lockedProvider !== null ? (
                <span className="rounded-full border border-border/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/75">
                  Locked
                </span>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {previewProviderOptions.length > 0 ? (
                <div
                  aria-label={`${getProviderLabel(previewProvider)} models`}
                  className="space-y-0.5"
                  role="list"
                >
                  {previewProviderOptions.map((modelOption) => {
                    const isSelected =
                      props.provider === previewProvider && props.model === modelOption.slug;
                    return (
                      <button
                        key={`${previewProvider}:${modelOption.slug}`}
                        type="button"
                        className={cn(
                          "grid min-h-8 w-full grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-left text-base text-foreground outline-none transition-colors sm:min-h-7 sm:text-sm",
                          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                        )}
                        onClick={() => handleModelChange(previewProvider, modelOption.slug)}
                      >
                        <span className="col-start-1 flex items-center justify-center">
                          {isSelected ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
                        </span>
                        <span className="col-start-2">{modelOption.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full min-h-32 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground/80">
                  No models are available for this provider yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </MenuPopup>
    </Menu>
  );
});
