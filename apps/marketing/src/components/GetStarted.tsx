const steps = [
  {
    number: "01",
    title: "Install OK Code",
    description: "Download the desktop app or run with npx for instant access.",
    code: "npx okcodes",
  },
  {
    number: "02",
    title: "Configure a Provider",
    description: "Set up Claude Code, OpenAI Codex, or both. Just authenticate once.",
    code: "codex login\nclaude auth login",
  },
  {
    number: "03",
    title: "Start Coding",
    description: "Open a project and start chatting with your AI coding assistant.",
    code: null,
  },
];

export function GetStarted() {
  return (
    <section
      style={{
        padding: "80px 0",
        borderTop: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      <div className="container">
        <div
          style={{
            maxWidth: "480px",
            margin: "0 auto 3rem",
            textAlign: "center",
          }}
        >
          <div className="badge" style={{ marginBottom: "0.75rem" }}>
            Quick Start
          </div>
          <h2>Get started in minutes</h2>
          <p style={{ marginTop: "0.75rem" }}>
            Three simple steps to supercharge your development workflow with AI.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
            maxWidth: "900px",
            margin: "0 auto",
          }}
        >
          {steps.map((step, index) => (
            <div
              key={index}
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "1.5rem",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: "2rem",
                  fontWeight: 600,
                  color: "var(--border)",
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  lineHeight: 1,
                }}
              >
                {step.number}
              </span>
              <h3 style={{ marginBottom: "0.5rem", paddingRight: "2.5rem", fontSize: "1rem" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "0.8125rem", marginBottom: step.code ? "1rem" : 0 }}>
                {step.description}
              </p>
              {step.code && (
                <pre
                  style={{
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: "0.75rem",
                    color: "var(--muted-foreground)",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {step.code}
                </pre>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "3rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              marginBottom: "1rem",
              fontSize: "0.8125rem",
              color: "var(--muted-foreground)",
            }}
          >
            Having trouble? Run the diagnostic command:
          </p>
          <code
            style={{
              display: "inline-block",
              background: "var(--muted)",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: "0.8125rem",
            }}
          >
            npx okcodes doctor
          </code>
        </div>
      </div>
    </section>
  );
}
