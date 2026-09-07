// ---------------------------------------------------------------------------
// Shared types and constants for the AI sidebar.
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
] as const;

export type AISidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};
