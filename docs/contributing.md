# Contributing

## Workflow (spec → plan → implement)

This repo follows a spec & plan workflow (`AGENTS.md`):

1. Specs live in `.claude/context/specs/` — one file per feature (`NN-kebab-case.md`).
2. Plans live in `.claude/plans/` — matching number/slug. **Get plan approval before implementing.**
3. Keep numbers in sync; do not implement without a stored plan.
4. If work changes architecture/scope/standards, update `.claude/context/*.md` first.
5. After each meaningful change, update `.claude/context/progress-tracker.md`.

## Branches & commits

- Branch from `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`.
- Conventional Commits (commitlint + husky): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- Read `node_modules/next/dist/docs/` before writing Next.js code — this is Next 16, some APIs differ from training data.

## Gates (run before every PR)

```bash
bunx next typegen      # first, if RouteContext types are missing
bun run typecheck      # tsc --noEmit → 0
bun run lint           # oxlint → 0
bun run fmt:check      # oxfmt --check (or bun run fmt to fix)
bun run build          # next build → 0, check route list + Proxy
```

Also: no `components/ui/*` modifications (override at call sites), no hardcoded colors (use theme tokens), no new `.md` files unless requested, no secrets in commits (`git status`/`diff` review before push).

## PR checklist

- [ ] Spec + plan files linked
- [ ] Gates green (typecheck/lint/fmt/build)
- [ ] Live smoke noted (which matrix: Neon CRUD, two-client collab, AI run, spec download)
- [ ] Context docs updated (`progress-tracker.md` + any changed architecture/UI/scope)
- [ ] No secrets, no generated-client diffs (`app/generated/prisma/` is gitignored)

## Good first issues

- Add a starter template (`components/editor/starter-templates.ts` + card).
- Add a troubleshooting entry with repro + fix.
- Improve empty states / a11y labels on canvas controls.
- Add FAQ entries from real user questions.
