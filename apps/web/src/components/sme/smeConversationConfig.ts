import type { ProviderKind, SmeAuthMethod } from "@okcode/contracts";

export const SME_PROVIDER_LABELS: Record<ProviderKind, string> = {
  codex: "Codex / ChatGPT",
  claudeAgent: "Claude Code",
  copilot: "GitHub Copilot",
  openclaw: "OpenClaw",
};

export function getDefaultSmeAuthMethod(provider: ProviderKind): SmeAuthMethod {
  switch (provider) {
    case "claudeAgent":
      return "apiKey";
    case "copilot":
      return "auto";
    case "codex":
      return "chatgpt";
    case "openclaw":
      return "password";
  }
}

export function getSmeAuthMethodOptions(
  provider: ProviderKind,
): Array<{ value: SmeAuthMethod; label: string }> {
  switch (provider) {
    case "claudeAgent":
      return [
        { value: "apiKey", label: "Anthropic API Key" },
        { value: "authToken", label: "Auth Token" },
        { value: "auto", label: "CLI" },
      ];
    case "copilot":
      return [{ value: "auto", label: "Auto" }];
    case "codex":
      return [
        { value: "chatgpt", label: "ChatGPT OAuth" },
        { value: "apiKey", label: "API Key" },
        { value: "customProvider", label: "Custom Provider" },
        { value: "auto", label: "Auto" },
      ];
    case "openclaw":
      return [
        { value: "password", label: "Gateway Password" },
        { value: "none", label: "No Password" },
        { value: "auto", label: "Auto" },
      ];
  }
}

export function getSmeAuthMethodLabel(provider: ProviderKind, authMethod: SmeAuthMethod): string {
  return (
    getSmeAuthMethodOptions(provider).find((option) => option.value === authMethod)?.label ??
    authMethod
  );
}
