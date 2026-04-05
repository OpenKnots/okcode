import { OkCodeMark } from "../OkCodeMark";
import { Kbd } from "../ui/kbd";

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);

interface HomeGreetingProps {
  projectName: string | null;
}

export function HomeGreeting({ projectName }: HomeGreetingProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <OkCodeMark className="size-4" />
      </span>
      <h1 className="text-lg font-semibold text-foreground">{projectName ?? "Welcome back"}</h1>
      <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <Kbd>{isMac ? "\u2318" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </div>
    </div>
  );
}
