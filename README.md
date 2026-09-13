# Ghost AI

> Real-time collaborative system design workspace. Describe a system in plain English, let an AI agent map it onto a shared canvas, refine it with collaborators, and export a technical specification.

[![GitHub stars](https://img.shields.io/github/stars/Arijit-mondal099/ghost-ai?logo=github)](https://github.com/Arijit-mondal099/ghost-ai)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./docs/contributing.md)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)](#license)

**Repository:** <https://github.com/Arijit-mondal099/ghost-ai> · **Issues:** [report a bug](https://github.com/Arijit-mondal099/ghost-ai/issues)

---

## Table of contents

- [What you can do](#what-you-can-do)
- [1. Sign in](#1-sign-in)
- [2. Create or open a project](#2-create-or-open-a-project)
- [3. Design on the canvas](#3-design-on-the-canvas)
- [4. Start from a template](#4-start-from-a-template)
- [5. Generate architecture with AI](#5-generate-architecture-with-ai)
- [6. Collaborate with others](#6-collaborate-with-others)
- [7. Generate and download a spec](#7-generate-and-download-a-spec)
- [8. Plans and limits](#8-plans-and-limits)
- [Tips for good results](#tips-for-good-results)
- [Something not working?](#something-not-working)
- [Self-hosting and contributing](#self-hosting-and-contributing)
- [License](#license)

---

## What you can do

1. **Prompt** an AI architect in plain English ("Design an e-commerce backend").
2. **Refine** the resulting architecture on a shared canvas — drag shapes, connect services, edit labels, recolor nodes.
3. **Invite** collaborators to edit with you in real time.
4. **Export** the final graph as a Markdown technical spec.

---

## 1. Sign in

Open the app and sign in (or create an account on the sign-up page). Once signed in you land on the project home, which has two tabs:

- **My Projects** — projects you own.
- **Shared** — projects others have shared with you.

---

## 2. Create or open a project

- Click **New Project** (in the sidebar or the home page), give it a name, and confirm — the new project opens immediately.
- Click any project row to open it.
- On projects you own, the `…` menu on each row lets you **Rename** or **Delete** it. (Delete cannot be undone.)
- Projects you are invited to show under **Shared** without the rename/delete menu.

---

## 3. Design on the canvas

The canvas is the center of the workspace. Everything saves automatically, and there is a **Save** button in the top bar if you ever want to force a save.

| Action            | How                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Add a shape       | Drag one of the 6 shapes (rectangle, diamond, circle, pill, cylinder, hexagon) from the shape panel at the bottom onto the canvas.         |
| Connect two nodes | Hover a node to reveal its white connection dots, then drag from a dot to another node.                                                    |
| Move / resize     | Drag a node to move it. Select a node to show resize handles and drag to resize.                                                           |
| Edit a node label | Double-click the label (or select it and press Enter), type, then press Enter or click away to commit. Press Escape to cancel.             |
| Recolor a node    | Select a node — a color toolbar with 8 colors appears above it. Pick a swatch.                                                             |
| Label an edge     | Select an edge to make its label editable, type, then commit the same way as node labels.                                                  |
| Delete            | Select nodes/edges and press Backspace or Delete, or use the floating `Delete (N)` pill. Deleting a node also removes its connected edges. |
| Zoom / fit        | Use the control bar (`+` / `-`, fit-to-view) or keyboard: `+` / `-` to zoom, `Ctrl/Cmd + Z` to undo, `Ctrl/Cmd + Shift + Z` to redo.       |

Your collaborators see every change live, including your cursor.

---

## 4. Start from a template

Don't want a blank canvas? Click **Templates** in the top bar to open the starter-template gallery (monolith, microservices, event-driven, serverless, and more). Pick a card and choose import — its nodes and edges are added to your canvas and framed in view. You can import a template at any time, not just at the start.

---

## 5. Generate architecture with AI

Open the AI sidebar (sparkles button in the top bar) and stay on the **Architect** tab.

1. Type what you want in the _"Describe the system to draft…"_ box — or click a starter draft such as _"Design an e-commerce backend"_.
2. Press Enter to send (`Shift + Enter` for a new line).
3. A status strip shows the run's progress and a Ghost cursor appears on the canvas while the AI works. The input locks until the run finishes.
4. Nodes and edges land directly in the shared canvas — on your screen and your collaborators' screens at the same time. A summary message appears in the chat when the run completes.

If the run fails, the error appears inline in the chat — just adjust the prompt and try again.

---

## 6. Collaborate with others

Click **Share** in the top bar to open the _Share project_ dialog:

- **Copy link** — copies the project URL to send to a teammate.
- **Invite** — enter your teammate's email and send the invite. They need an account with that email to access the project.
- **Remove** — owners can remove a collaborator with the `×` next to their name.

What collaborators get: the project appears under their **Shared** tab; they can edit the canvas, use the AI architect, and view/download specs. Only the owner can rename, delete, or invite.

While you work together you'll see each other's cursors in distinct colors and avatar stacks in the top bar.

---

## 7. Generate and download a spec

When the canvas looks right, turn it into a document:

1. In the AI sidebar, switch to the **Specs** tab.
2. Click **Generate Spec** (it reads _"Drafting…"_ while working, with a step rail showing snapshot → draft → save).
3. The finished spec appears in the list as a `Draft …` row with its creation time.
4. Click a row to preview the rendered Markdown, or use the download button to save the `.md` file.

Each generation creates a new entry — older specs stay in the list, so you can compare iterations.

---

## 8. Plans and limits

- **Free** — up to 3 projects you own.
- **Pro / Pro Max** — up to 100 / 1000 owned projects.

Projects shared with you never count against your limit, and AI generation plus specs are included on every plan. If you hit the cap, the sidebar shows an upgrade prompt linking to the **Pricing** page (crown icon in the top bar), where you can manage your subscription. Deleting a project frees its slot immediately.

---

## Tips for good results

- **Be specific with the AI**: name the system, the scale, and the pieces you care about — _"design a URL shortener for 10k rps with cache, rate limiting, and click analytics"_ beats _"design a backend"_.
- **Generate, then refine**: let the AI lay down the first draft, then drag, reconnect, relabel, and recolor by hand — the canvas is yours.
- **One idea per prompt**: follow-up prompts extend the existing canvas, so build complex systems in a few focused steps.
- **Template + AI combos work well**: import the closest starter template first, then ask the AI to extend it.

---

## Something not working?

- **Canvas stuck on "connecting"** — wait for the automatic retry, or use the **Retry now** button on the rate-limit notice. Heavy traffic can briefly throttle realtime connections.
- **AI says retry later** — generation is rate-limited; wait out the shown countdown and send again.
- **Prompt fails immediately** — shorten very long prompts and avoid special formatting; plain sentences work best.
- **Invited teammate can't open the project** — confirm they signed up with the exact invited email address, and that you sent them the project link.
- **Spec still "Drafting…" after minutes** — the run timed out; nothing was saved. Try again (a smaller canvas generates faster).
- Still stuck? [Open an issue](https://github.com/Arijit-mondal099/ghost-ai/issues) with what you clicked and what you saw.

---

## Self-hosting and contributing

This guide covers _using_ the app. For everything else, see [`docs/`](./docs/README.md):

- [Getting started](./docs/getting-started.md) — run it locally (prereqs, env vars, database, dev servers)
- [Architecture](./docs/architecture.md) · [API reference](./docs/api-reference.md) · [Database](./docs/database.md)
- [Deployment](./docs/deployment.md) — Vercel + Neon + Trigger.dev checklist
- [Contributing](./docs/contributing.md) — spec → plan → implement workflow, branches, quality gates

---

## License

No license file is present yet — **one must be added (MIT or Apache-2.0 recommended) before redistributing this project.** Until then, all rights remain with the authors by default.
