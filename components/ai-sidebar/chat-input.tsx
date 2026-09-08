"use client";

import { ArrowUpIcon, LoaderCircleIcon } from "lucide-react";
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
  onSend: (content: string) => boolean;
  disabled?: boolean;
  isRunning?: boolean;
  sendError?: string | null;
};

const MIN_HEIGHT = 72;
const MAX_HEIGHT = 160;

function ChatInput({ onSend, disabled, isRunning, sendError }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = disabled === true || isRunning === true;
  const armed = value.trim().length > 0 && !busy;

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const scrollHeight = el.scrollHeight;
    const clamped = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${clamped}px`;
  }

  function submit() {
    if (!value.trim() || busy) return;
    const ok = onSend(value.trim());
    // Clear only after a successful send so a failed broadcast keeps the
    // draft in the composer (spec 26).
    if (ok) {
      setValue("");
      requestAnimationFrame(resize);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Skip submission while an IME composition is active — Enter confirms
    // the composition, not the message. Covers browsers reporting the state
    // via `isComposing` and the legacy 229 keyCode fallback.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-surface-border p-3">
      {sendError ? (
        <p role="alert" className="mb-2 text-xs leading-relaxed text-state-error">
          {sendError}
        </p>
      ) : null}
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
          disabled={busy}
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
            aria-label={isRunning === true ? "Ghost is drafting" : "Send message"}
            aria-busy={isRunning === true}
            className="shrink-0 rounded-xl"
          >
            {isRunning === true ? (
              <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            ) : (
              <ArrowUpIcon />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ChatInput };
