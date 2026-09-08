// ---------------------------------------------------------------------------
// Shared types and constants for the AI sidebar.
//
// The canonical chat message shape lives in `types/tasks.ts`
// (`AiChatFeedPayload`: id, sender, role, content, timestamp) and is
// validated by `isAiChatFeedPayload` before rendering. This module re-exports
// it as `ChatMessage` so existing sidebar imports keep working against the
// single validated shape.
// ---------------------------------------------------------------------------

import type { AiChatFeedPayload } from "@/types/tasks";

export type ChatRole = AiChatFeedPayload["role"];

export type ChatMessage = AiChatFeedPayload;

export const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
] as const;

export type AISidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Project id for the design trigger route (`roomId === Project.id`). */
  projectId: string;
  /** Liveblocks room id the canvas is connected to. */
  roomId: string;
};

export type AISidebarTabsProps = {
  projectId: string;
  roomId: string;
};
