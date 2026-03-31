import { PrUserHoverCard } from "./PrUserHoverCard";

export function PrCommentBody({ body, cwd }: { body: string; cwd: string | null }) {
  const lines = body.split("\n");
  const lineCounts = new Map<string, number>();
  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-6 text-foreground/88">
      {lines.map((line) => {
        const lineOccurrence = lineCounts.get(line) ?? 0;
        lineCounts.set(line, lineOccurrence + 1);
        const segments = line.split(/(@[a-zA-Z0-9-]+)/g);
        const segmentCounts = new Map<string, number>();
        return (
          <p key={`${line}:${lineOccurrence}`}>
            {segments.map((segment) => {
              const segmentOccurrence = segmentCounts.get(segment) ?? 0;
              segmentCounts.set(segment, segmentOccurrence + 1);
              const segmentKey = `${segment}:${segmentOccurrence}`;
              if (/^@[a-zA-Z0-9-]+$/.test(segment)) {
                return (
                  <PrUserHoverCard cwd={cwd} key={segmentKey} login={segment.slice(1)}>
                    {segment}
                  </PrUserHoverCard>
                );
              }
              return <span key={segmentKey}>{segment}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
