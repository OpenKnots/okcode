export interface OnboardingStepConfig {
  id: string;
  title: string;
  description: string;
  details: string[];
  accentColor: string;
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: "welcome",
    title: "Welcome to OK Code",
    description:
      "Your AI-powered coding companion. Let's take a quick tour of the features that will supercharge your workflow.",
    details: [
      "Work alongside AI agents that read, write, and reason about your code",
      "Every conversation runs in an isolated git worktree by default",
      "This tour takes about a minute — you can skip at any time",
    ],
    accentColor: "primary",
  },
  {
    id: "chat",
    title: "AI-Powered Conversations",
    description:
      "Chat with AI coding agents in real time. Ask questions, request changes, or let the agent drive entire features.",
    details: [
      "Choose between multiple providers — Codex and Claude",
      "Stream responses in real time as the agent works",
      "Attach images and terminal context directly in your prompts",
    ],
    accentColor: "sky",
  },
  {
    id: "git",
    title: "Built-in Git Workflows",
    description:
      "Every thread can run in its own git worktree, keeping your main branch safe while the agent experiments freely.",
    details: [
      "New threads automatically create isolated worktrees",
      "Switch branches, create PRs, and manage worktrees from the toolbar",
      "Link threads to existing pull requests for focused code review",
    ],
    accentColor: "emerald",
  },
  {
    id: "diff",
    title: "Review Changes Side-by-Side",
    description:
      "Inspect every code change the agent makes with a built-in diff viewer before accepting anything.",
    details: [
      "Inline and side-by-side diff views with syntax highlighting",
      "Accept or reject changes per-file with a single click",
      "Word-level highlighting shows exactly what changed",
    ],
    accentColor: "amber",
  },
  {
    id: "terminal",
    title: "Integrated Terminal",
    description:
      "A full terminal lives inside every thread — run commands, see output, and feed context back to the agent.",
    details: [
      "Up to four terminal tabs per thread for parallel workflows",
      "Select terminal output and add it directly to your prompt",
      "Track running subprocesses with live activity indicators",
    ],
    accentColor: "violet",
  },
  {
    id: "plan",
    title: "AI-Generated Plans",
    description:
      "Switch to Plan mode and let the agent outline a structured implementation strategy before writing a single line of code.",
    details: [
      "Step-by-step plans with status tracking as work progresses",
      "Review, copy, or export plans as Markdown",
      'Click "Implement Plan" to kick off execution in a new thread',
    ],
    accentColor: "rose",
  },
  {
    id: "approvals",
    title: "Stay in Control",
    description:
      "You decide what gets executed. The agent asks for your approval before making changes, so nothing happens without your say-so.",
    details: [
      "Approve, request changes, or cancel any proposed action",
      "Switch between full-access and approval-required modes per thread",
      "Review pending file changes before they're applied",
    ],
    accentColor: "orange",
  },
  {
    id: "getStarted",
    title: "You're All Set!",
    description: "You're ready to start building. Here are a few shortcuts to help you move fast.",
    details: [
      "Press Cmd+N (or Ctrl+N) to create a new thread instantly",
      "Use the sidebar to switch between projects and threads",
      "Open Settings to customize models, themes, and keybindings",
    ],
    accentColor: "primary",
  },
];
