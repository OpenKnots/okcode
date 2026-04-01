import Link from "next/link";

export function CTA() {
  return (
    <section
      style={{
        padding: "120px 0",
        borderTop: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h2 style={{ marginBottom: "1.5rem" }}>
            Ready to supercharge your
            <br />
            development workflow?
          </h2>
          <p
            style={{
              fontSize: "1.125rem",
              marginBottom: "2.5rem",
              color: "var(--muted-foreground)",
            }}
          >
            Join developers who are shipping faster with AI-powered coding assistants. Free, open
            source, and built for the way you work.
          </p>

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
              Download Now
            </Link>
            <Link
              href="https://github.com/OpenKnots/okcode"
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "1rem 2rem", fontSize: "1rem" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ marginRight: "0.5rem" }}
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Star on GitHub
            </Link>
          </div>

          <p
            style={{
              marginTop: "2rem",
              fontSize: "0.875rem",
              color: "var(--muted-foreground)",
            }}
          >
            Available for macOS, Windows, and Linux
          </p>
        </div>
      </div>
    </section>
  );
}
