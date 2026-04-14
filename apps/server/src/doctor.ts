/**
 * doctor - CLI diagnostic command.
 *
 * Runs provider health checks and prints a summary to the terminal
 * without starting the full server.
 *
 * @module doctor
 */
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import {
  checkCopilotProviderStatus,
  checkCodexProviderStatus,
  checkClaudeProviderStatus,
} from "./provider/Layers/ProviderHealth";
import type { ServerProviderStatus } from "@okcode/contracts";
import { fixPath } from "./os-jank";
import { serverBuildInfo } from "./buildInfo";

const STATUS_ICONS: Record<string, string> = {
  ready: "\u2705",
  warning: "\u26A0\uFE0F",
  error: "\u274C",
};

const AUTH_LABELS: Record<string, string> = {
  authenticated: "authenticated",
  unauthenticated: "not authenticated",
  unknown: "unknown",
};

const PROVIDER_LABELS: Record<string, string> = {
  codex: "Codex (OpenAI)",
  claudeAgent: "Claude Code",
  copilot: "GitHub Copilot",
  gemini: "Gemini CLI",
  openclaw: "OpenClaw",
};

function printStatus(status: ServerProviderStatus): void {
  const icon = STATUS_ICONS[status.status] ?? "?";
  const label = PROVIDER_LABELS[status.provider] ?? status.provider;
  const authStatus = status.authStatus ?? status.auth?.status ?? "unknown";
  const auth = AUTH_LABELS[authStatus] ?? authStatus;

  console.log("");
  console.log(`  ${icon} ${label}`);
  console.log(`     Status: ${status.status}`);
  console.log(`     Auth:   ${auth}`);
  if (status.message) {
    console.log(`     Detail: ${status.message}`);
  }
}

const doctorProgram = Effect.gen(function* () {
  // Fix PATH so CLIs installed via nvm/volta/etc. are reachable.
  fixPath();

  console.log("OK Code Doctor");
  console.log("==============");
  console.log("");
  console.log(`Version: ${serverBuildInfo.version}`);
  console.log(
    `Surface: ${serverBuildInfo.surface} (${serverBuildInfo.platform}/${serverBuildInfo.arch})`,
  );
  console.log(`Channel: ${serverBuildInfo.channel}`);
  console.log(`Commit: ${serverBuildInfo.commitHash ?? "unknown"}`);
  console.log(`Built: ${serverBuildInfo.buildTimestamp}`);
  console.log("");
  console.log("Checking provider health...");

  const statuses = yield* Effect.all(
    [checkCodexProviderStatus, checkClaudeProviderStatus, checkCopilotProviderStatus],
    {
      concurrency: "unbounded",
    },
  );

  for (const status of statuses) {
    printStatus(status);
  }

  const readyCount = statuses.filter((s) => s.status === "ready").length;
  console.log("");
  if (readyCount === 0) {
    console.log("No providers are ready. Set up at least one provider to start coding:");
    console.log("");
    console.log("  Codex:  npm install -g @openai/codex && codex login");
    console.log("  Claude Code: npm install -g @anthropic-ai/claude-code && claude auth login");
    console.log("  Copilot: npm install -g @github/copilot && copilot login");
  } else if (readyCount === statuses.length) {
    console.log("All providers are ready.");
  } else {
    console.log(`${readyCount} of ${statuses.length} providers ready.`);
  }
  console.log("");
});

export const doctorCmd = Command.make("doctor").pipe(
  Command.withDescription("Check provider health and system requirements."),
  Command.withHandler(() => doctorProgram),
);
