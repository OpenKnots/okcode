import Image from "next/image";

const skillItems = [
  {
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: "Bundled Skills",
    description: "PDF, Doc, Spreadsheet, GitHub, and Playwright ready to install",
  },
  {
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v10" />
        <path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24" />
        <path d="M1 12h6m6 0h10" />
        <path d="m4.93 19.07 4.24-4.24m5.66-5.66 4.24-4.24" />
      </svg>
    ),
    title: "System Skills",
    description: "Skill Creator, Image Gen, Plugin Creator always available",
  },
  {
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    title: "Create Your Own",
    description: "Build custom skills and slash commands for your workflow",
  },
];

export function Skills() {
  return (
    <section
      style={{
        padding: "80px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="container">
        <div className="skills-grid">
          <div>
            <div className="badge" style={{ marginBottom: "0.75rem" }}>
              Extensibility
            </div>
            <h2 style={{ marginBottom: "1rem" }}>Make OK Code work your way</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Install recommended skills, keep system skills ready, and create your own
              slash-command workflows.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {skillItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      background: "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h4
                      style={{ fontWeight: 500, marginBottom: "0.125rem", fontSize: "0.9375rem" }}
                    >
                      {item.title}
                    </h4>
                    <p style={{ fontSize: "0.8125rem" }}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid var(--border)",
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
