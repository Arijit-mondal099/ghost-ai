"use client";

import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessage } from "./chat-message";
import type { ChatMessage as ChatMessageType } from "./constants";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Scrollable chat area. Shows the empty state when there are no messages,
// otherwise renders the message list.
// ---------------------------------------------------------------------------

export type ChatAreaProps = {
  messages: ChatMessageType[];
  onStarterSelect?: (prompt: string) => void;
};

function ChatArea({ messages, onStarterSelect }: ChatAreaProps) {
  if (messages.length === 0) {
    return <ChatEmptyState onSelect={onStarterSelect} />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="py-2">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
    </ScrollArea>
  );
}

export { ChatArea };
