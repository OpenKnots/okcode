import { UserIcon, SparklesIcon } from "lucide-react";
import type { SmeMessage } from "@okcode/contracts";

import { cn } from "~/lib/utils";

interface SmeMessageBubbleProps {
  message: SmeMessage;
}

export function SmeMessageBubble({ message }: SmeMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("group flex w-full gap-4 px-4 py-5", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground",
        )}
      >
        {isUser ? <UserIcon className="size-4" /> : <SparklesIcon className="size-4" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 max-w-[85%] space-y-1", isUser && "text-right")}>
        <p className="text-xs font-medium text-muted-foreground">
          {isUser ? "You" : "SME Assistant"}
        </p>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground",
          )}
        >
          <div className="whitespace-pre-wrap break-words">{message.text}</div>

          {/* Streaming cursor */}
          {message.isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-text-bottom opacity-70" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
