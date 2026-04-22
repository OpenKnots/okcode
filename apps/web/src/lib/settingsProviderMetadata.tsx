import type { ProviderKind } from "@okcode/contracts";
import type { ReactNode } from "react";

export type InstallBinarySettingsKey = "claudeBinaryPath" | "codexBinaryPath" | "copilotBinaryPath";
export type InstallHomeSettingsKey = "codexHomePath" | "copilotConfigDir";

export interface InstallProviderSettings {
  readonly provider: Extract<ProviderKind, "codex" | "claudeAgent" | "copilot">;
  readonly title: string;
  readonly binaryPathKey: InstallBinarySettingsKey;
  readonly binaryPlaceholder: string;
  readonly binaryDescription: ReactNode;
  readonly homePathKey?: InstallHomeSettingsKey;
  readonly homePlaceholder?: string;
  readonly homeDescription?: ReactNode;
}

export interface ProviderAuthGuide {
  readonly installCmd?: string;
  readonly authCmd?: string;
  readonly verifyCmd?: string;
  readonly note: string;
}

export const SETTINGS_AUTH_PROVIDER_ORDER = [
  "codex",
  "claudeAgent",
  "gemini",
  "copilot",
  "openclaw",
] as const satisfies readonly ProviderKind[];

export const INSTALL_PROVIDER_SETTINGS = [
  {
    provider: "codex",
    title: "Codex",
    binaryPathKey: "codexBinaryPath",
    binaryPlaceholder: "Codex binary path",
    binaryDescription: (
      <>
        Leave blank to use <code>codex</code> from your PATH. Authentication normally uses{" "}
        <code>codex login</code> unless your Codex config selects a non-OpenAI backend.
      </>
    ),
    homePathKey: "codexHomePath",
    homePlaceholder: "CODEX_HOME",
    homeDescription: "Optional custom Codex home and config directory.",
  },
  {
    provider: "claudeAgent",
    title: "Claude Code",
    binaryPathKey: "claudeBinaryPath",
    binaryPlaceholder: "Claude Code binary path",
    binaryDescription: (
      <>
        Leave blank to use <code>claude</code> from your PATH. Authentication uses{" "}
        <code>claude auth login</code>.
      </>
    ),
  },
  {
    provider: "copilot",
    title: "GitHub Copilot",
    binaryPathKey: "copilotBinaryPath",
    binaryPlaceholder: "GitHub Copilot binary path",
    binaryDescription: (
      <>
        Leave blank to use <code>copilot</code> from your PATH. Authentication uses{" "}
        <code>copilot login</code> or GitHub CLI credentials.
      </>
    ),
    homePathKey: "copilotConfigDir",
    homePlaceholder: "Copilot config directory",
    homeDescription: "Optional custom Copilot config directory.",
  },
] as const satisfies readonly InstallProviderSettings[];

export const PROVIDER_AUTH_GUIDES: Record<ProviderKind, ProviderAuthGuide> = {
  codex: {
    installCmd: "npm install -g @openai/codex",
    authCmd: "codex login",
    verifyCmd: "codex login status",
    note: "Codex appears in the thread picker when the CLI is reachable and the selected backend is either OpenAI-authenticated or a configured non-OpenAI backend. For local models, see the Ollama and LM Studio sections below.",
  },
  claudeAgent: {
    installCmd: "npm install -g @anthropic-ai/claude-code",
    authCmd: "claude auth login",
    verifyCmd: "claude auth status",
    note: "Claude Code must be installed and signed in before it appears in the thread picker.",
  },
  gemini: {
    installCmd: "npm install -g @google/gemini-cli",
    authCmd: "set GEMINI_API_KEY or GOOGLE_API_KEY",
    verifyCmd: "gemini --version",
    note: "Gemini CLI appears in the thread picker when the binary is installed and headless auth is available or locally cached.",
  },
  copilot: {
    installCmd: "npm install -g @github/copilot",
    authCmd: "copilot login",
    verifyCmd: "copilot auth status",
    note: "GitHub Copilot must be installed and signed in before it appears in the thread picker.",
  },
  openclaw: {
    authCmd: "Use gateway shared secret",
    verifyCmd: "Test Connection",
    note: "OpenClaw uses the gateway URL and shared secret below rather than a local CLI login. Depending on gateway auth mode, OK Code sends that shared secret as token-style or password-style auth. Shared-secret auth usually works without device pairing and is the recommended default for Tailscale and remote gateways. Connection is verified by a WebSocket handshake plus /health probe and a connect handshake; click Test Connection again if the gateway restarts or your network changes.",
  },
};

export type LocalBackendKey = "ollama" | "lmstudio";

export const LOCAL_BACKEND_LABELS: Record<LocalBackendKey, string> = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

export const LOCAL_BACKEND_AUTH_GUIDES: Record<LocalBackendKey, ProviderAuthGuide> = {
  ollama: {
    installCmd: "brew install ollama  # or https://ollama.com/download",
    authCmd: "ollama serve  # then: ollama pull llama3.1",
    verifyCmd: "curl http://localhost:11434/api/tags",
    note: 'Ollama is exposed to Codex by setting model_provider = "ollama" in ~/.codex/config.toml. Keep `ollama serve` running (launchd on macOS) so the daemon stays reachable on localhost:11434.',
  },
  lmstudio: {
    installCmd: "Install LM Studio from https://lmstudio.ai",
    authCmd: "Load a model and start the Local Server from the Developer tab",
    verifyCmd: "curl http://localhost:1234/v1/models",
    note: 'LM Studio is exposed to Codex by setting model_provider = "lmstudio" in ~/.codex/config.toml. The OpenAI-compatible server must be running on localhost:1234 for Codex to pick it up.',
  },
};
