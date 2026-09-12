# Ghost AI — Documentation

Real-time collaborative system design workspace. Describe a system in plain English, let an AI agent map it onto a shared canvas, refine it with collaborators, and generate a technical specification from the resulting graph.

## Start here

| Guide                                                       | What it covers                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Getting Started](./getting-started.md)                     | Prerequisites, env vars, install, run, first project                                  |
| [Architecture](./architecture.md)                           | Stack, system boundaries, storage model, invariants                                   |
| [Configuration](./configuration.md)                         | All environment variables, Clerk / Liveblocks / Trigger / Blob / Upstash / Groq setup |
| [Authentication](./authentication.md)                       | Clerk middleware, public routes, identity, access checks                              |
| [Projects & Collaboration](./projects-and-collaboration.md) | Project CRUD, share dialog, collaborator APIs, billing limits                         |
| [Collaborative Canvas](./canvas.md)                         | Liveblocks + React Flow, shapes, colors, presence, autosave, templates                |
| [AI Design Agent](./ai-design-agent.md)                     | `design-agent` Trigger task, Groq contract, realtime status                           |
| [Spec Generation](./spec-generation.md)                     | `generate-spec` Trigger task, Markdown persistence, download                          |
| [API Reference](./api-reference.md)                         | Every `app/api` route: method, auth, body, responses                                  |
| [Database](./database.md)                                   | Prisma models, relations, indexes, migrations                                         |
| [Design System](./design-system.md)                         | Dark theme tokens, typography, canvas palette, component conventions                  |
| [Deployment](./deployment.md)                               | Vercel + Neon + Trigger.dev production checklist                                      |
| [Contributing](./contributing.md)                           | Branching, commits, lint/typecheck/build, PR process                                  |
| [Troubleshooting](./troubleshooting.md)                     | Common errors (P6000, P2021, 401/403/429, Liveblocks auth)                            |
| [FAQ](./faq.md)                                             | Scope, out-of-scope, roadmap questions                                                |

## Quick links

- Product definition: `.claude/context/project-overview.md`
- Architecture invariants: `.claude/context/architecture-context.md`
- UI tokens: `.claude/context/ui-context.md`
- Progress: `.claude/context/progress-tracker.md`
- Specs: `.claude/context/specs/` · Plans: `.claude/plans/`

## License

This project is open source. See `LICENSE` (add one if missing — MIT or Apache-2.0 recommended) before redistributing.
