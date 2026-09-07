# Plan: AI Sidebar Shell — Build Out the Floating Chat Sidebar UI

## Context

The `editor-workspace-client.tsx` currently has an inline AI sidebar placeholder (lines 130-152) — a bare `aside` element with a header and a "AI chat coming soon" message. This spec asks to extract that placeholder into a proper, fully-structured component with tabs, chat UI, and spec generation.

**Current state**: The placeholder lives inline in `editor-workspace-client.tsx`. The open/close state (`isAiSidebarOpen`) is controlled by the parent component. The slide animation uses `translate-x-0` (open) / `translate-x-full` (closed) with `transition-transform duration-200`. Surface styling: `fixed right-0 top-14 bottom-0 z-40`, `w-80`, `border-l border-surface-border`, `bg-base/95`, `backdrop-blur-md`.

**Key constraint**: The spec uses some token names that don't exist in the codebase (e.g., `text-primary-text`, `text-muted-text`, `text-accent-text`, `bg-brand-dim`). These must be mapped to actual tokens:

- `text-primary-text` → `text-copy-primary`
- `text-muted-text` → `text-copy-muted`
- `bg-brand-dim` → `bg-accent-dim`
- `border-brand/50` → `border-accent/50`
- `text-accent-text` → `text-accent-foreground`
- `bg-accent` → `bg-accent` (shadcn `--accent`, #222222)

## Files to Create

```
components/ai-sidebar/
  index.tsx               # Main AISidebar component (open/close animation + layout)
  header.tsx              # Header: title, subtitle, bot icon, close button
  tabs.tsx                # Tabbed layout (AI Architect, Specs) using shadcn Tabs
  chat-area.tsx           # Chat message list with ScrollArea
  chat-empty-state.tsx    # Empty state with bot icon + starter chips
  chat-message.tsx        # Individual message (user/assistant) rendering
  chat-input.tsx          # Auto-resizing textarea + send button
  starter-chips.tsx       # Starter prompt chips
  specs-tab.tsx           # Specs tab content (generate button + demo card)
  constants.ts            # Shared constants (starter prompts, ChatMessage type, SidebarTab type)
```

## Files to Modify

1. `components/editor/index.ts` — add `export { AISidebar, type AISidebarProps } from "./ai-sidebar"`
2. `app/editor/[roomId]/editor-workspace-client.tsx` — replace inline placeholder `aside` with `<AISidebar isOpen={isAiSidebarOpen} onClose={() => setIsAiSidebarOpen(false)} />`

## Component Design

### constants.ts

- `ChatMessage` interface: `{ id: string; role: 'user' | 'assistant'; content: string }`
- `SidebarTab` type: `'architect' | 'specs'`
- `STARTER_PROMPTS` array: 3 prompt strings
- `type AISidebarProps = { isOpen: boolean; onClose: () => void }`

### index.tsx (AISidebar)

- `"use client"` directive
- Accepts `isOpen` and `onClose` props
- Preserves the exact animation and surface styling from the placeholder:
  ```tsx
  <aside
    inert={!isOpen}
    aria-hidden={!isOpen}
    className={cn(
      "fixed right-0 top-14 bottom-0 z-40 flex w-80 flex-col border-l border-surface-border bg-base/95 backdrop-blur-md transition-transform duration-200",
      isOpen ? "translate-x-0" : "translate-x-full",
    )}
  >
    <AISidebarHeader onClose={onClose} />
    <AISidebarTabs />
  </aside>
  ```

### header.tsx (AISidebarHeader)

- Title: "AI Workspace", subtitle: "Collaborate with Ghost AI"
- Bot icon (lucide `BotIcon`, `h-5 w-5`)
- Close button (lucide `XIcon`) on the right using `Button variant="ghost" size="icon-sm"`
- Title uses `text-copy-primary`, subtitle uses `text-copy-muted`
- Structure: flex row with icon + title block on left, close button on right
- Border-bottom: `border-surface-border`

### tabs.tsx (AISidebarTabs)

- Uses shadcn `Tabs` with default value "architect"
- `TabsList` with two `TabsTrigger`s: "AI Architect" and "Specs"
- Active tab: `bg-accent` / `text-accent-foreground`
- Inactive tab: `text-copy-muted`
- `TabsContent` for each tab wrapping the respective sub-component

### chat-area.tsx (ChatArea)

- Uses shadcn `ScrollArea`
- Renders either `ChatEmptyState` (when no messages) or `ChatMessage` list
- `ChatMessage` receives messages and renders each based on role

### chat-empty-state.tsx (ChatEmptyState)

- Bot icon (larger, `h-8 w-8`), short description text
- `StarterChips` component with 3 prompt chips

### starter-chips.tsx (StarterChips)

- Renders the 3 starter prompts as soft pills
- Styles: `bg-subtle` + `text-accent-foreground` (maps to spec's `text-accent-text`)
- Clickable but `onClick` is a no-op (no backend logic per scope)

### chat-message.tsx (ChatMessage)

- Receives `{ id, role, content }`
- User messages: right-aligned, `bg-accent-dim` + `border-accent/50 border-2` + `text-copy-primary`
- Assistant messages: left-aligned, `bg-elevated` + `border border-surface-border` + `text-accent-foreground`
- Uses `cn()` for conditional alignment

### chat-input.tsx (ChatInput)

- Auto-resizing textarea (72px min, 160px max)
- Send button: `bg-accent` + `text-white`
- `Enter` submits, `Shift+Enter` adds newline
- Uses shadcn `Textarea` + `Button`

### specs-tab.tsx (SpecsTab)

- `Generate Spec` button: `bg-accent` + `text-white`
- Demo spec card: `bg-elevated` + `border-surface-border`
- Card contains: file icon (`FileTextIcon`), title, snippet, disabled download button

## Token Mapping Reference (globals.css → spec)

| Spec Token              | Actual Token             | CSS Variable                    |
| ----------------------- | ------------------------ | ------------------------------- |
| `bg-base/95`            | `bg-base/95`             | `--bg-base` + opacity           |
| `border-surface-border` | `border-surface-border`  | `--border-default`              |
| `text-primary-text`     | `text-copy-primary`      | `--text-primary`                |
| `text-muted-text`       | `text-copy-muted`        | `--text-muted`                  |
| `text-accent`           | `text-accent`            | `--accent` (but is #222222)     |
| `bg-accent`             | `bg-accent`              | `--accent` (#222222)            |
| `text-accent-text`      | `text-accent-foreground` | `--accent-foreground` (#eeeeee) |
| `bg-subtle`             | `bg-subtle`              | `--bg-subtle` (#2a2a2a)         |
| `bg-elevated`           | `bg-elevated`            | `--bg-elevated` (#222222)       |
| `bg-brand-dim`          | `bg-accent-dim`          | `--accent-primary-dim`          |
| `border-brand/50`       | `border-accent/50`       | `--accent-primary` + opacity    |
| `text-copy-primary`     | `text-copy-primary`      | `--text-primary`                |
| `border-surface-border` | `border-surface-border`  | `--border-default`              |

## Verification

1. `bun run typecheck` — no TypeScript errors
2. `bun run lint` — no lint errors
3. `bun run build` — builds successfully
4. The AI sidebar renders as a floating element with slide animation
5. Both tabs render: AI Architect (with empty state + starter chips + input) and Specs (with generate button + demo card)
6. Parent component (`editor-workspace-client.tsx`) still controls `isOpen`/`onClose`
