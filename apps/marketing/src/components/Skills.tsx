import Image from "next/image";

export function Skills() {
  return (
    <section
      style={{
        padding: "120px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="container">
        <div className="skills-grid">
          <div>
            <div className="badge" style={{ marginBottom: "1rem" }}>
              Extensibility
            </div>
            <h2 style={{ marginBottom: "1.5rem" }}>Make OK Code work your way</h2>
            <p style={{ marginBottom: "2rem" }}>
              Install recommended skills, keep system skills ready, and create your own
              slash-command workflows. Extend functionality for PDFs, spreadsheets, documents,
              GitHub integration, and more.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "var(--secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontWeight: 500, marginBottom: "0.25rem" }}>Bundled Skills</h4>
                  <p style={{ fontSize: "0.875rem" }}>
                    PDF, Doc, Spreadsheet, GitHub, and Playwright ready to install
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "var(--secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontWeight: 500, marginBottom: "0.25rem" }}>System Skills</h4>
                  <p style={{ fontSize: "0.875rem" }}>
                    Skill Creator, Image Gen, Plugin Creator always available
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "var(--secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontWeight: 500, marginBottom: "0.25rem" }}>Create Your Own</h4>
                  <p style={{ fontSize: "0.875rem" }}>
                    Build custom skills and slash commands for your workflow
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
            }}
          >
            <Image
              src="/ok-skills.png"
              alt="OK Code Skills Interface"
              width={1372}
              height={872}
              style={{
                width: "100%",
                height: "auto",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
