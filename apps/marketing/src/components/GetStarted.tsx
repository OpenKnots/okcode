import Link from "next/link";

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
        padding: "120px 0",
        borderTop: "1px solid var(--border)",
        background: "var(--card)",
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
            Quick Start
          </div>
          <h2>Get started in minutes</h2>
          <p style={{ marginTop: "1rem" }}>
            Three simple steps to supercharge your development workflow with AI.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "2rem",
            maxWidth: "1000px",
            margin: "0 auto",
          }}
        >
          {steps.map((step, index) => (
            <div
              key={index}
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "2rem",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: "3rem",
                  fontWeight: 700,
                  color: "var(--muted)",
                  position: "absolute",
                  top: "1rem",
                  right: "1.5rem",
                  lineHeight: 1,
                }}
              >
                {step.number}
              </span>
              <h3 style={{ marginBottom: "0.75rem", paddingRight: "3rem" }}>{step.title}</h3>
              <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>{step.description}</p>
              {step.code && (
                <pre
                  style={{
                    background: "var(--secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "1rem",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.8125rem",
                    color: "var(--muted-foreground)",
                    overflow: "auto",
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
            marginTop: "4rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              marginBottom: "1.5rem",
              color: "var(--muted-foreground)",
            }}
          >
            Having trouble? Run the diagnostic command:
          </p>
          <code
            style={{
              display: "inline-block",
              background: "var(--background)",
              padding: "0.75rem 1.5rem",
              borderRadius: "var(--radius)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.875rem",
            }}
          >
            npx okcodes doctor
          </code>
        </div>
      </div>
    </section>
  );
}
