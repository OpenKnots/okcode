import { CodeBlock } from "./CodeBlock";
import { ExternalLink } from "./ExternalLink";
import { LINKS } from "./links";

export function GetStarted() {
  return (
    <section id="get-started" className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-xl text-center">
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
