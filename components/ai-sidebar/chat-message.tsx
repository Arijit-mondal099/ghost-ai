"use client";

import type { ChatMessage as ChatMessageType } from "./constants";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Individual chat message. Two voices, two treatments:
//   - user: right-aligned success-tinted bubble (spec 27's green accent,
//     expressed through the `success` theme token — never a hardcoded hex)
//     with a squared near corner.
//   - assistant: left-aligned drafting annotation — a dotted schematic rail
//     with a node dot (echoing canvas nodes) and a mono "Ghost" eyebrow over
//     un-bubbled body copy. Annotations, not chat bubbles: Ghost writes on
//     the blueprint, it doesn't text you.
//
// Both variants show the sender name and send time (spec 26): a mono micro
// line that stays quiet next to the message body. Payloads arrive validated
// via `isAiChatFeedPayload`, so sender/content/timestamp are trusted here.
// ---------------------------------------------------------------------------

export type ChatMessageProps = {
  message: ChatMessageType;
};

function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const time = formatChatTime(message.timestamp);
  const meta = time ? `${message.sender.name} · ${time}` : message.sender.name;

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        <div className="max-w-[80%]">
          <p className="mb-1 text-right font-mono text-[11px] text-copy-faint">{meta}</p>
          <div className="rounded-2xl rounded-br-md border border-success/40 bg-success/10 px-3 py-2 text-sm leading-relaxed text-copy-primary">
            {message.content}
          </div>
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
        <p className="mt-0.5 font-mono text-[11px] text-copy-faint">{meta}</p>
        <p className={cn("mt-1 text-sm leading-relaxed text-copy-secondary")}>{message.content}</p>
      </div>
    </div>
  );
}

export { ChatMessage };
