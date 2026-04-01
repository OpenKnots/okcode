import { ExternalLink } from "./ExternalLink";
import { LINKS } from "./links";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.04] px-6 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
        <span className="text-[13px] text-muted-foreground">
          <span className="text-foreground/60">OK Code</span> &middot; Built by{" "}
          <ExternalLink
            href="https://github.com/OpenKnots"
            className="text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            OpenKnots
          </ExternalLink>
        </span>

        <div className="flex items-center gap-5 text-[13px]">
          <ExternalLink href={LINKS.github}>GitHub</ExternalLink>
          <ExternalLink href={LINKS.releases}>Releases</ExternalLink>
          <ExternalLink href={LINKS.discord}>Discord</ExternalLink>
        </div>
      </div>
    </footer>
  );
}
