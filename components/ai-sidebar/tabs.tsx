"use client";

import { useState } from "react";

import { ChatArea } from "./chat-area";
import { ChatInput } from "./chat-input";
import type { ChatMessage } from "./constants";
import { SpecsTab } from "./specs-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Tabbed layout for the AI sidebar: "Architect" (chat) and "Specs".
// Plain shadcn tabs on theme tokens: the list is a full-width subtle track,
// triggers carry only a text-size tweak — active/disabled/focus states come
// from the primitive itself.
// ---------------------------------------------------------------------------

function AISidebarTabs() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function handleSend(content: string) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
  }

  function handleStarterSelect(prompt: string) {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };
    setMessages((prev) => [...prev, userMessage]);
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
        <ChatInput onSend={handleSend} />
      </TabsContent>

      <TabsContent value="specs" className="mt-0 flex flex-1 flex-col overflow-hidden">
        <SpecsTab />
      </TabsContent>
    </Tabs>
  );
}

export { AISidebarTabs };
