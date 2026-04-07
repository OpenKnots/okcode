import { UserIcon, BotIcon } from "lucide-react";
import type { SmeMessage } from "@okcode/contracts";

import { cn } from "~/lib/utils";

interface SmeMessageBubbleProps {
  message: SmeMessage;
}

export function SmeMessageBubble({ message }: SmeMessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {/* Render text with basic whitespace preservation */}
        <div className="whitespace-pre-wrap break-words">{message.text}</div>

        {/* Streaming indicator */}
        {message.isStreaming ? (
          <span className="mt-1 inline-block size-2 animate-pulse rounded-full bg-current opacity-60" />
        ) : null}
      </div>
    </div>
  );
}
