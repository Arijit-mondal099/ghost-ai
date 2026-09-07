"use client";

import type { ChatMessage as ChatMessageType } from "./constants";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Individual chat message. Two voices, two treatments:
//   - user: right-aligned cream bubble (the human's voice is warm cream,
//     matching the brand accent) with a squared near corner.
//   - assistant: left-aligned drafting annotation — a dotted schematic rail
//     with a node dot (echoing canvas nodes) and a mono "Ghost" eyebrow over
//     un-bubbled body copy. Annotations, not chat bubbles: Ghost writes on
//     the blueprint, it doesn't text you.
// ---------------------------------------------------------------------------

export type ChatMessageProps = {
  message: ChatMessageType;
};

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-brand/30 bg-accent-dim px-3 py-2 text-sm leading-relaxed text-copy-primary">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
      <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
        <span className="absolute inset-y-1 w-px border-l border-dashed border-subtle-border" />
        <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] tracking-widest text-brand uppercase">Ghost</p>
        <p className={cn("mt-1 text-sm leading-relaxed text-copy-secondary")}>{message.content}</p>
      </div>
    </div>
  );
}

export { ChatMessage };
