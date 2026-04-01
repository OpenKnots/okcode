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
        backdropFilter: "blur(12px)",
        backgroundColor: "rgba(10, 10, 10, 0.8)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <Image
            src="/okcode-logo.png"
            alt="OK Code"
            width={32}
            height={32}
            style={{ borderRadius: "8px" }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: "1.125rem",
              letterSpacing: "-0.02em",
            }}
          >
            OK Code
          </span>
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2rem",
          }}
        >
          <Link
            href="#features"
            style={{
              fontSize: "0.875rem",
              color: "var(--muted-foreground)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
          >
            Features
          </Link>
          <Link
            href="#providers"
            style={{
              fontSize: "0.875rem",
              color: "var(--muted-foreground)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
          >
            Providers
          </Link>
          <Link
            href="https://github.com/OpenKnots/okcode"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.875rem",
              color: "var(--muted-foreground)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
          >
            GitHub
          </Link>
          <Link
            href="https://discord.gg/openknot"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.875rem",
              color: "var(--muted-foreground)",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
          >
            Discord
          </Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link
            href="https://github.com/OpenKnots/okcode/releases"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </Link>
        </div>
      </div>
    </header>
  );
}
