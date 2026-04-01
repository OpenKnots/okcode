import Link from "next/link";
import Image from "next/image";

export function Header() {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(10, 10, 10, 0.85)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "56px",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <Image
            src="/okcode-logo.png"
            alt="OK Code"
            width={28}
            height={28}
            style={{ borderRadius: "6px" }}
          />
          <span
            style={{
              fontWeight: 500,
              fontSize: "0.9375rem",
              letterSpacing: "-0.01em",
            }}
          >
            OK Code
          </span>
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          {["Features", "Providers", "GitHub", "Discord"].map((item) => (
            <Link
              key={item}
              href={
                item === "GitHub"
                  ? "https://github.com/OpenKnots/okcode"
                  : item === "Discord"
                    ? "https://discord.gg/openknot"
                    : `#${item.toLowerCase()}`
              }
              target={item === "GitHub" || item === "Discord" ? "_blank" : undefined}
              rel={item === "GitHub" || item === "Discord" ? "noopener noreferrer" : undefined}
              style={{
                fontSize: "0.8125rem",
                color: "var(--muted-foreground)",
                transition: "color 0.15s",
              }}
            >
              {item}
            </Link>
          ))}
        </nav>

        <Link
          href="https://github.com/OpenKnots/okcode/releases"
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
        >
          Download
        </Link>
      </div>
    </header>
  );
}
