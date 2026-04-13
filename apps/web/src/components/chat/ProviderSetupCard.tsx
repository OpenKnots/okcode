import { type ServerProviderStatus } from "@okcode/contracts";
import { memo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  SettingsIcon,
  TerminalIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  getProviderLabel,
  getProviderSetupPhase,
  getProviderStatusDescription,
  getProviderStatusHeading,
} from "./providerStatusPresentation";

const PROVIDER_CONFIG = {
  codex: {
    installCmd: "npm install -g @openai/codex",
    authCmd: "codex login",
    verifyCmd: "codex login status",
    note: undefined,
  },
  claudeAgent: {
    installCmd: "npm install -g @anthropic-ai/claude-code",
    authCmd: "set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN",
    verifyCmd: "claude auth status",
    note: "You can also configure a Claude auth token helper command or one-click secret-manager preset in Settings.",
  },
  copilot: {
    installCmd: "npm install -g @github/copilot",
    authCmd: "copilot login",
    verifyCmd: "gh auth status",
    note: undefined,
  },
  copilot: {
    installCmd: "npm install -g @github/copilot",
    authCmd: "copilot login",
    verifyCmd: "gh auth status",
  },
} as const;

function StatusIcon({ status }: { status: ServerProviderStatus["status"] }) {
  switch (status) {
    case "ready":
      return <CheckCircle2Icon className="size-4 text-emerald-500" />;
    case "warning":
      return <CircleAlertIcon className="size-4 text-amber-500" />;
    case "error":
      return <XCircleIcon className="size-4 text-red-400" />;
  }
}

function ProviderRow({ status }: { status: ServerProviderStatus }) {
  const [expanded, setExpanded] = useState(status.status !== "ready");
  const config = PROVIDER_CONFIG[status.provider as keyof typeof PROVIDER_CONFIG];
  if (!config) return null;
  const setupPhase = getProviderSetupPhase(status);
  const heading = getProviderStatusHeading(status);
  const description = getProviderStatusDescription(status);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 text-left text-sm"
        onClick={() => setExpanded((v) => !v)}
      >
        <StatusIcon status={status.status} />
        <span className="flex-1 font-medium text-foreground">
          {getProviderLabel(status.provider)}
        </span>
        {status.status !== "ready" ? (
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {setupPhase}
          </span>
        ) : null}
        {expanded ? (
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {status.status !== "ready" && (
        <div className="mt-1.5 ml-6.5 space-y-1">
          <p className="text-xs font-medium text-foreground">{heading}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      )}

      {expanded && status.status !== "ready" && (
        <div className="mt-3 ml-6.5 space-y-2">
          <div className="space-y-1.5">
            <Step n={1} label="Install" active={setupPhase === "install"}>
              <Code>{config.installCmd}</Code>
            </Step>
            <Step n={2} label="Authenticate" active={setupPhase === "authenticate"}>
              <Code>{config.authCmd}</Code>
            </Step>
            <Step n={3} label="Verify" active={setupPhase === "verify"}>
              <Code>{config.verifyCmd}</Code>
            </Step>
          </div>
          {config.note ? <p className="text-xs text-muted-foreground">{config.note}</p> : null}
        </div>
      )}

      {status.status === "ready" && (
        <p className="mt-1 ml-6.5 text-xs text-emerald-600 dark:text-emerald-400">Ready</p>
      )}
    </div>
  );
}

function Step({
  n,
  label,
  active,
  children,
}: {
  n: number;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span
        className={
          active ? "shrink-0 font-medium text-foreground" : "shrink-0 text-muted-foreground"
        }
      >
        {n}. {label}:
      </span>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </code>
  );
}

export const ProviderSetupCard = memo(function ProviderSetupCard({
  providers,
}: {
  providers: ReadonlyArray<ServerProviderStatus>;
}) {
  const navigate = useNavigate();
  const readyCount = providers.filter((p) => p.status === "ready").length;

  // Don't show if all providers are ready
  if (readyCount === providers.length && providers.length > 0) {
    return null;
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <TerminalIcon className="size-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Set up a provider</h2>
        <p className="text-sm text-muted-foreground">
          {readyCount === 0
            ? "Connect at least one AI provider to start coding."
            : `${readyCount} of ${providers.length} providers ready. Set up another provider or start coding.`}
        </p>
      </div>

      <div className="space-y-2">
        {providers.map((status) => (
          <ProviderRow key={status.provider} status={status} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/settings" })}>
          <SettingsIcon />
          Settings
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        Run <Code>npx okcodes doctor</Code> to diagnose setup issues from the terminal.
      </p>
    </div>
  );
});
