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
        paddingTop: "100px",
        paddingBottom: "60px",
      }}
    >
      <div className="container">
        <div
          style={{
            maxWidth: "720px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          {/* Badge */}
          <div className="badge" style={{ marginBottom: "1.25rem" }}>
            Open Source
          </div>

          {/* Headline */}
          <h1 style={{ marginBottom: "1.25rem" }}>The unified GUI for coding agents</h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: "1.0625rem",
              maxWidth: "520px",
              margin: "0 auto 2rem",
              color: "var(--muted-foreground)",
              lineHeight: 1.6,
            }}
          >
            A minimal interface for Claude Code, OpenAI Codex, and more. One app to manage all your
            AI coding assistants.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="https://github.com/OpenKnots/okcode/releases"
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Desktop App
            </Link>

            <div
              className="btn btn-secondary"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.8125rem",
                gap: "0.5rem",
                padding: "0.625rem 1rem",
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
                  padding: "0.125rem",
                  display: "flex",
                  alignItems: "center",
                  marginLeft: "0.25rem",
                }}
                aria-label="Copy to clipboard"
              >
                <svg
                  width="14"
                  height="14"
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
              marginTop: "2.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            {[
              { icon: "shield", label: "Secure & Private" },
              { icon: "github", label: "Open Source" },
              { icon: "desktop", label: "macOS, Windows, Linux" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  color: "var(--muted-foreground)",
                  fontSize: "0.8125rem",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {item.icon === "shield" && (
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  )}
                  {item.icon === "github" && (
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  )}
                  {item.icon === "desktop" && (
                    <>
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </>
                  )}
                </svg>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* App Preview */}
        <div
          style={{
            marginTop: "3rem",
            position: "relative",
          }}
        >
          <div
            style={{
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid var(--border)",
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
