import { PrUserHoverCard } from "./PrUserHoverCard";

export function PrCommentBody({ body, cwd }: { body: string; cwd: string | null }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-6 text-foreground/88">
      {lines.map((line, lineIndex) => {
        const segments = line.split(/(@[a-zA-Z0-9-]+)/g);
        return (
          <p key={`${lineIndex}:${line}`}>
            {segments.map((segment, segmentIndex) => {
              if (/^@[a-zA-Z0-9-]+$/.test(segment)) {
                return (
                  <PrUserHoverCard
                    cwd={cwd}
                    key={`${lineIndex}:${segmentIndex}`}
                    login={segment.slice(1)}
                  >
                    {segment}
                  </PrUserHoverCard>
                );
              }
              return <span key={`${lineIndex}:${segmentIndex}`}>{segment}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
