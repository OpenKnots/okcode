import { FeatureCard } from "./FeatureCard";

/* Shared props to avoid repeating on every inline SVG icon */
const svgProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const icons = {
  messageSquare: (
    <svg {...svgProps}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  gitBranch: (
    <svg {...svgProps}>
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  fileDiff: (
    <svg {...svgProps}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M9 15h6" />
      <path d="M12 18v-6" />
    </svg>
  ),
  terminal: (
    <svg {...svgProps}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  ),
  listChecks: (
    <svg {...svgProps}>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  ),
  shieldCheck: (
    <svg {...svgProps}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
};

const primaryFeatures = [
  {
    icon: icons.messageSquare,
    title: "Codex and Claude, one interface",
    description:
      "Switch providers per thread. Stream responses in real time. Attach images, terminal output, or file context.",
  },
  {
    icon: icons.gitBranch,
    title: "Every thread, its own worktree",
    description:
      "Each conversation runs in an isolated git worktree. Your main branch stays clean. Merge when ready.",
  },
  {
    icon: icons.fileDiff,
    title: "Review every change",
    description:
      "Inline and side-by-side diffs with syntax highlighting. Accept or reject changes per file before committing.",
  },
  {
    icon: icons.terminal,
    title: "Built-in terminal",
    description:
      "Up to four terminal tabs per thread. Feed output directly to the agent. No window switching.",
  },
  {
    icon: icons.listChecks,
    title: "Structured implementation plans",
    description:
      "AI-generated step-by-step plans with status tracking. See the full scope before any code changes.",
  },
  {
    icon: icons.shieldCheck,
    title: "You stay in control",
    description:
      "Full-access or approval-required modes. Review every file write and command before execution.",
  },
];

const secondaryFeatures = [
  {
    title: "GitHub PR review",
    description: "Inline comments, conflict resolution, full review flow.",
  },
  {
    title: "Reusable skills",
    description: "Built-in and custom skill catalog for automation.",
  },
  {
    title: "Restore any turn",
    description: "Automatic snapshots. Roll back to any point in the conversation.",
  },
  {
    title: "Desktop, web, mobile",
    description: "npx, Electron, or Capacitor. Same experience everywhere.",
  },
];

export function FeatureGrid() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
      {/* Section top glow line */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-px w-[60%]"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.50 0.18 270 / 0.25), transparent)",
        }}
      />
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[13px]">
        Features
      </p>
      <h2 className="mb-16 text-center text-foreground">Everything you need</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {primaryFeatures.map((feature) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryFeatures.map((feature) => (
          <FeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
            compact
          />
        ))}
      </div>
    </section>
  );
}
