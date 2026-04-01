const features = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Multi-Provider Support",
    description:
      "Switch seamlessly between Claude Code, OpenAI Codex, and more providers. Use the best tool for each task.",
    color: "var(--accent-blue)",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    title: "Unified Interface",
    description:
      "One consistent UI for all your coding agents. No more switching between terminal windows and apps.",
    color: "var(--accent-green)",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    title: "Extensible Skills",
    description:
      "Customize your workflow with bundled skills for PDFs, spreadsheets, GitHub, and more. Create your own.",
    color: "var(--accent-purple)",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Real-time Collaboration",
    description:
      "Watch AI agents work in real-time with live previews, file changes, and conversation history.",
    color: "var(--accent-orange)",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
      </svg>
    ),
    title: "Git Integration",
    description:
      "Built-in Git support with branch management, PR reviews, and merge conflict resolution.",
    color: "var(--accent-green)",
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Desktop & Web",
    description:
      "Run as a desktop app with native performance or in your browser. Your choice, same experience.",
    color: "var(--accent-blue)",
  },
];

export function Features() {
  return (
    <section
      id="features"
      style={{
        padding: "120px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="container">
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto 4rem",
            textAlign: "center",
          }}
        >
          <div className="badge" style={{ marginBottom: "1rem" }}>
            Features
          </div>
          <h2>Everything you need to ship faster</h2>
          <p style={{ marginTop: "1rem" }}>
            OK Code brings together the best AI coding assistants into one powerful, unified
            experience designed for developers.
          </p>
        </div>

        <div className="grid-features">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                transition: "transform 0.2s, border-color 0.2s",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: `${feature.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: feature.color,
                }}
              >
                {feature.icon}
              </div>
              <h3 style={{ fontSize: "1.125rem" }}>{feature.title}</h3>
              <p style={{ fontSize: "0.875rem" }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
