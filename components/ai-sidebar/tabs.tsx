"use client";

import { useUser } from "@clerk/nextjs";

import { ChatArea } from "./chat-area";
import { ChatInput } from "./chat-input";
import type { AISidebarTabsProps } from "./constants";
import { SpecsTab } from "./specs-tab";
import { StatusStrip } from "./status-strip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiChatFeed } from "@/hooks/use-ai-chat-feed";
import { useDesignAgent } from "@/hooks/use-design-agent";

// ---------------------------------------------------------------------------
// Tabbed layout for the AI sidebar: "Architect" (chat) and "Specs".
// Plain shadcn tabs on theme tokens: the list is a full-width subtle track,
// triggers carry only a text-size tweak — active/disabled/focus states come
// from the primitive itself.
//
// Architect is collaborative room chat (spec 26) plus design generation
// (spec 27): the user message travels over the room-scoped ephemeral
// `ai-chat` feed (`AI_CHAT` RoomEvents, sender-bound to the connection
// identity and validated by `isAiChatFeedPayload`),
// so every connected client sees the same ordered history — then the same
// prompt is sent to the design agent, whose terminal text is posted back to
// `ai-chat` as a Ghost message through the ownership-gated server route
// (spec 28: only the initiating run's owner can publish as Ghost).
// Run status is tracked two ways: `useRealtimeRun` (inside the design hook)
// drives the input-disabled/spinner lifecycle, and the `AI_STATUS` feed text
// drives the status strip. Canvas updates need no code here:
// `useLiveblocksFlow` reflects the task's Storage writes automatically.
// ---------------------------------------------------------------------------

function AISidebarTabs({ projectId, roomId }: AISidebarTabsProps) {
  const { user } = useUser();
  const { messages, sendError, send, sendAssistant } = useAiChatFeed();
  const design = useDesignAgent({
    projectId,
    roomId,
    // Terminal Ghost messages go through the ownership-gated server route
    // (spec 28); requester-local failures (runId null) append locally only.
    onTerminal: (message, _ok, runId) => {
      void sendAssistant(runId, message);
    },
  });

  function handleSend(content: string): boolean {
    const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? null;
    const fallbackEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;
    const name =
      user?.fullName?.trim() ||
      user?.username?.trim() ||
      primaryEmail ||
      fallbackEmail ||
      "Someone";
    const chatOk = send(content, { id: user?.id ?? "anonymous", name });
    // Never trigger the backend when the chat send failed — the draft stays
    // in the composer and no orphan run starts.
    if (!chatOk) return false;
    void design.start(content);
    return true;
  }

  function handleStarterSelect(prompt: string) {
    void handleSend(prompt);
  }

  return (
    <Tabs defaultValue="architect" className="flex flex-1 flex-col overflow-hidden">
      <div className="px-4 pt-3">
        <TabsList className="w-full">
          <TabsTrigger value="architect" className="text-xs">
            Architect
          </TabsTrigger>
          <TabsTrigger value="specs" className="text-xs">
            Specs
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="architect" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <ChatArea messages={messages} onStarterSelect={handleStarterSelect} />
        {design.isActive ? <StatusStrip message={design.lastMessage} /> : null}
        <ChatInput
          onSend={handleSend}
          disabled={design.isActive}
          isRunning={design.isActive}
          sendError={sendError}
        />
      </TabsContent>

      <TabsContent value="specs" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <SpecsTab />
      </TabsContent>
    </Tabs>
  );
}

export { AISidebarTabs };
