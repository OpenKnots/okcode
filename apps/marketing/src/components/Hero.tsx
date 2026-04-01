import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingTop: "120px",
        paddingBottom: "80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient effect */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "800px",
          height: "800px",
          background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          {/* Badge */}
          <div
            className="badge"
            style={{
              marginBottom: "1.5rem",
            }}
          >
            Open Source
          </div>

          {/* Headline */}
          <h1
            style={{
              marginBottom: "1.5rem",
            }}
          >
            The unified GUI for
            <br />
            <span style={{ color: "var(--muted-foreground)" }}>coding agents</span>
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: "1.25rem",
              maxWidth: "600px",
              margin: "0 auto 2.5rem",
              color: "var(--muted-foreground)",
            }}
          >
            A minimal, powerful interface for Claude Code, OpenAI Codex, and more. One app to manage
            all your AI coding assistants.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="https://github.com/OpenKnots/okcode/releases"
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "1rem 2rem", fontSize: "1rem" }}
            >
              Download Desktop App
            </Link>

            <div
              className="btn btn-secondary"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                gap: "0.75rem",
              }}
            >
              <span style={{ color: "var(--muted-foreground)" }}>$</span>
              <span>npx okcodes</span>
              <button
                onClick={() => navigator.clipboard.writeText("npx okcodes")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label="Copy to clipboard"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div
            style={{
              marginTop: "3rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "2rem",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--muted-foreground)",
                fontSize: "0.875rem",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Secure & Private
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--muted-foreground)",
                fontSize: "0.875rem",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              Open Source
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "var(--muted-foreground)",
                fontSize: "0.875rem",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              macOS, Windows, Linux
            </div>
          </div>
        </div>

        {/* App Preview */}
        <div
          style={{
            marginTop: "4rem",
            position: "relative",
          }}
        >
          <div
            style={{
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <Image
              src="/ok-code-app.png"
              alt="OK Code Application Interface"
              width={1456}
              height={816}
              style={{
                width: "100%",
                height: "auto",
              }}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
