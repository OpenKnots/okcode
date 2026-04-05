import { CodeBlock } from "./CodeBlock";
import { ExternalLink } from "./ExternalLink";
import { LINKS } from "./links";

export function GetStarted() {
  return (
    <section id="get-started" className="relative px-6 py-20 sm:py-28">
      {/* Section glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px]"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.45 0.16 270 / 0.06) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-xl text-center">
        <h2 className="text-foreground">Start building.</h2>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">One command. Zero config.</p>

        <div className="mt-8 flex justify-center">
          <CodeBlock code="npx okcodes" />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[13px]">
          <ExternalLink href={LINKS.github}>View on GitHub</ExternalLink>
          <ExternalLink href={LINKS.releases}>Download Desktop</ExternalLink>
          <ExternalLink href={LINKS.discord}>Join Discord</ExternalLink>
        </div>
      </div>
    </section>
  );
}
