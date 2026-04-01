import { ExternalLink } from "./ExternalLink";
import { LINKS } from "./links";

export function Nav() {
  return (
    <nav className="fixed top-0 z-40 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-2 text-foreground no-underline">
          <img src="/icon.svg" alt="OK Code" width={24} height={24} className="rounded-md" />
          <span className="text-[15px] font-semibold tracking-tight">OK Code</span>
        </a>

        <div className="flex items-center gap-6">
          <ExternalLink
            href={LINKS.github}
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground no-underline"
          >
            GitHub
          </ExternalLink>
          <a
            href="#get-started"
            className="inline-flex h-8 items-center rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 no-underline"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
