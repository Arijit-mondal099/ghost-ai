"use client";

import { ArrowUpIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Chat composer: docked drafting strip. Borderless textarea inside an
// elevated card that takes an indigo focus ring; the send key is solid Ghost
// indigo with a glow while armed, flat subtle while empty. Mono microcopy
// states the key contract. Enter sends, Shift+Enter breaks the line.
// ---------------------------------------------------------------------------

export type ChatInputProps = {
  onSend: (content: string) => void;
  disabled?: boolean;
};

const MIN_HEIGHT = 72;
const MAX_HEIGHT = 160;

function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const armed = value.trim().length > 0 && !disabled;

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const scrollHeight = el.scrollHeight;
    const clamped = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${clamped}px`;
  }

  function submit() {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
      requestAnimationFrame(resize);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-surface-border p-3">
      <div
        className={cn(
          "rounded-2xl border bg-elevated transition-colors",
          focused ? "border-subtle-border" : "border-surface-border",
        )}
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            requestAnimationFrame(resize);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Describe the system to draft…"
          disabled={disabled}
          rows={2}
          aria-label="Message Ghost Architect"
          className="min-h-[72px] max-h-[160px] resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-sm text-copy-primary shadow-none placeholder:text-copy-faint focus-visible:ring-0"
        />
        <div className="flex items-center justify-between px-2.5 pb-2">
          <span className="font-mono text-[11px] text-copy-faint">
            Enter to send · Shift + Enter for newline
          </span>
          <Button
            variant="default"
            size="icon-sm"
            onClick={submit}
            disabled={!armed}
            aria-label="Send message"
            className="shrink-0 rounded-xl"
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ChatInput };
