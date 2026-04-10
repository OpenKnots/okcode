import type { ProviderKind, SmeAuthMethod, SmeConversation } from "@okcode/contracts";
import { useEffect, useMemo, useState } from "react";
import { Settings2Icon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import {
  getCustomModelOptionsByProvider,
  resolveAppModelSelection,
  useAppSettings,
} from "~/appSettings";
import { ensureNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useSmeStore } from "~/smeStore";

import {
  getDefaultSmeAuthMethod,
  getSmeAuthMethodOptions,
  SME_PROVIDER_LABELS,
} from "./smeConversationConfig";

interface SmeConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  conversation?: SmeConversation | null;
}

export function SmeConversationDialog({
  open,
  onOpenChange,
  projectId,
  conversation,
}: SmeConversationDialogProps) {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const addConversation = useSmeStore((state) => state.addConversation);
  const updateConversation = useSmeStore((state) => state.updateConversation);
  const setActiveConversationId = useSmeStore((state) => state.setActiveConversationId);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("New Conversation");
  const [provider, setProvider] = useState<ProviderKind>("claudeAgent");
  const [authMethod, setAuthMethod] = useState<SmeAuthMethod>("apiKey");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [error, setError] = useState<string | null>(null);

  const modelOptionsByProvider = useMemo(() => {
    const options = getCustomModelOptionsByProvider(settings);
    const openClawOptions = options.openclaw.some((option) => option.slug === "default")
      ? options.openclaw
      : [{ slug: "default", name: "default" }, ...options.openclaw];
    return {
      ...options,
      openclaw: openClawOptions,
    };
  }, [settings]);

  const selectedProviderModelOptions = modelOptionsByProvider[provider];
  const authMethodOptions = useMemo(() => getSmeAuthMethodOptions(provider), [provider]);
  const hasOpenClawCustomModels = settings.customOpenClawModels.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextProvider = conversation?.provider ?? "claudeAgent";
    const nextTitle = conversation?.title ?? "New Conversation";
    const nextAuthMethod = conversation?.authMethod ?? getDefaultSmeAuthMethod(nextProvider);
    const nextModel =
      conversation?.model ??
      resolveAppModelSelection(
        nextProvider,
        {
          codex: settings.customCodexModels,
          claudeAgent: settings.customClaudeModels,
          copilot: settings.customCopilotModels,
          openclaw: settings.customOpenClawModels,
        },
        null,
      );

    setTitle(nextTitle);
    setProvider(nextProvider);
    setAuthMethod(nextAuthMethod);
    setModel(nextModel);
    setError(null);
  }, [
    conversation,
    open,
    settings.customClaudeModels,
    settings.customCopilotModels,
    settings.customCodexModels,
    settings.customOpenClawModels,
  ]);

  const handleProviderChange = (nextProvider: ProviderKind) => {
    setProvider(nextProvider);
    const nextAuthMethod = getDefaultSmeAuthMethod(nextProvider);
    setAuthMethod(nextAuthMethod);
    setModel(
      resolveAppModelSelection(
        nextProvider,
        {
          codex: settings.customCodexModels,
          claudeAgent: settings.customClaudeModels,
          copilot: settings.customCopilotModels,
          openclaw: settings.customOpenClawModels,
        },
        nextProvider === "openclaw" ? "default" : null,
      ),
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const api = ensureNativeApi();
      if (conversation) {
        const updated = await api.sme.updateConversation({
          conversationId: conversation.conversationId,
          title,
          provider,
          authMethod,
          model,
        });
        updateConversation(updated);
      } else {
        const created = await api.sme.createConversation({
          projectId: projectId as never,
          title,
          provider,
          authMethod,
          model,
        });
        addConversation(created);
        setActiveConversationId(created.conversationId);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save conversation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {conversation ? "Conversation settings" : "New SME conversation"}
          </DialogTitle>
          <DialogDescription>
            Choose the provider, auth method, and model used for future SME replies.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Title</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Provider</span>
            <select
              value={provider}
              onChange={(event) => handleProviderChange(event.target.value as ProviderKind)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {(["claudeAgent", "codex", "openclaw"] as const).map((value) => (
                <option key={value} value={value}>
                  {SME_PROVIDER_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Auth method</span>
            <select
              value={authMethod}
              onChange={(event) => setAuthMethod(event.target.value as SmeAuthMethod)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {authMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Model</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {selectedProviderModelOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {provider === "openclaw" && !hasOpenClawCustomModels ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                Add one or more OpenClaw model slugs in Settings before using a custom OpenClaw
                model. The `default` model remains available.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => void navigate({ to: "/settings" })}
              >
                <Settings2Icon className="size-3.5" />
                Open Settings
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!title.trim() || !model.trim() || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : conversation ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
