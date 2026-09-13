# Design System

Dark only — no light mode. Near-black workspace, layered surfaces, warm-cream brand accent, indigo AI accent.

## Tokens (`app/globals.css`)

Colors are CSS custom properties mapped to Tailwind via `@theme inline`. **Never hardcode hex or use raw `zinc-*` classes.**

| Role                      | Variable                        | Value                             |
| ------------------------- | ------------------------------- | --------------------------------- |
| Page bg                   | `--bg-base`                     | `#111111`                         |
| Surface                   | `--bg-surface`                  | `#191919`                         |
| Elevated                  | `--bg-elevated`                 | `#222222`                         |
| Subtle                    | `--bg-subtle`                   | `#2a2a2a`                         |
| Border                    | `--border-default`              | `#201e18`                         |
| Subtle border             | `--border-subtle`               | `#484848`                         |
| Primary text              | `--text-primary`                | `#eeeeee`                         |
| Secondary text            | `--text-secondary`              | `#b4b4b4`                         |
| Muted text                | `--text-muted`                  | `#717171`                         |
| Faint text                | `--text-faint`                  | `#3a3a3a`                         |
| Brand accent              | `--accent-primary`              | `#ffe0c2` (warm cream)            |
| Brand dim                 | `--accent-primary-dim`          | `rgba(255,224,194,0.12)`          |
| AI accent                 | `--accent-ai`                   | `#6457f9` (indigo)                |
| AI text                   | `--accent-ai-text`              | `#8b82ff`                         |
| Error / success / warning | `--state-error/success/warning` | `#e54d2e` / `#34d399` / `#fbbf24` |

Utilities: `bg-base`, `bg-surface`, `text-copy-primary`, `text-copy-muted`, `border-surface-border`, `text-brand`, `bg-accent-dim`, `bg-ai`, `text-ai-text`, etc.

## Typography & radius

- UI: Geist Sans (`--font-geist-sans`); code/mono: Geist Mono (`--font-geist-mono`), loaded via `next/font/google` on `<html>`, `body` antialiased.
- Radius grows with depth: inline `rounded-xl` → cards `rounded-2xl` → modals `rounded-3xl`.

## Canvas (`types/canvas.ts`)

Node fills (dark) + contrasting text, tuned for the dark canvas. Default `#1F1F1F/#EDEDED`.

| Fill      | Text                |
| --------- | ------------------- |
| `#1F1F1F` | `#EDEDED` (neutral) |
| `#10233D` | `#52A8FF` (blue)    |
| `#2E1938` | `#BF7AF0` (purple)  |
| `#331B00` | `#FF990A` (orange)  |
| `#3C1618` | `#FF6166` (red)     |
| `#3A1726` | `#F75F8F` (pink)    |
| `#0F2E18` | `#62C073` (green)   |
| `#062822` | `#0AC7B4` (teal)    |

- Shapes: `rectangle` (default), `diamond` (decision), `circle` (event), `pill` (service), `cylinder` (database), `hexagon` (external). Complex shapes render as inline SVG (`viewBox 0 0 100 100`, `preserveAspectRatio="none"`, `non-scaling-stroke`).
- Edges: smooth-step + arrow marker, default `#f8fafc`, thin — secondary to nodes.
- Handles: small white circles, hidden until node hover, all four sides.
- Background: React Flow `<Background>` dots on base color.

## Components & layout

- shadcn/ui on Tailwind. Primitives in `components/ui/` — add via `shadcn` CLI, never hand-write; never modify generated files (override at call sites).
- Editor: full-viewport — floating left sidebar overlay, center canvas, slide-over AI sidebar right. Sidebars: floating overlay, dark translucent + subtle border. Modals: centered, `rounded-3xl`, backdrop blur. Navbar: top bar + bottom border.
- Icons: Lucide stroke only (`h-4 w-4` inline, `h-5 w-5` buttons, `h-8 w-8` empty-state features).
- AI sidebar identity: indigo glyph tiles with glow, cream user bubbles, assistant messages as schematic annotations (dotted rail + mono "Ghost" eyebrow), mono voice for eyebrows/metadata.
