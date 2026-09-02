<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `.claude/context/project-overview.md` — product definition, goals, features, and scope
2. `.claude/context/architecture-context.md` — system structure, boundaries, storage model, and invariants
3. `.claude/context/ui-context.md` — theme, colors, typography, canvas design, and component conventions
4. `.claude/context/progress-tracker.md` — current phase, completed work, open questions, and next steps

Update `.claude/context/progress-tracker.md` after each meaningful implementation change.

## Spec & Plan Workflow

- All incoming specs live in `.claude/context/specs/` — one file per feature (`NN-kebab-case.md`).
- All implementation plans live in `.claude/plans/` — one file per spec with matching number/slug (`NN-kebab-case.md`).
- Create and get approval for the plan in `.claude/plans/` before starting implementation.
- Keep spec and plan numbers in sync; do not implement without a stored plan.

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.
