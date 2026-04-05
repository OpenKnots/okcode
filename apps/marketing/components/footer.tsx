import { ExternalLink } from "./ExternalLink";
import { LINKS } from "./links";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="text-sm text-muted-foreground">
          <span className="text-foreground/60 font-bold">OK Code</span> &middot; Built by{" "}
          <ExternalLink
            href="https://github.com/OpenKnots"
            className="text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            OpenKnots
          </ExternalLink>
        </span>

        <div className="flex items-center gap-6 text-sm">
          <ExternalLink href={LINKS.github}>GitHub</ExternalLink>
          <ExternalLink href={LINKS.releases}>Releases</ExternalLink>
          <ExternalLink href={LINKS.discord}>Discord</ExternalLink>
        </div>
      </div>
    </footer>
  );
}
