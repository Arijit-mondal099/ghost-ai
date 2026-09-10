import { BotIcon, FolderIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// "How counting works" — the about section. Four facts that answer the real
// hesitation behind this page: "will I be charged for my collaborators, my
// drafts, my downgrade?" Plain verbs, sentence case, no invented numbers.
// ---------------------------------------------------------------------------

const FACTS = [
  {
    icon: FolderIcon,
    title: "Only projects you own count",
    body: "Your limit counts projects where you are the owner. Open a project, invite the team, keep designing — ownership is the only thing the meter reads.",
  },
  {
    icon: UsersIcon,
    title: "Shared projects never count",
    body: "When someone shares a canvas with you, it appears under Shared and costs you nothing. Join as many shared projects as you like on any plan.",
  },
  {
    icon: BotIcon,
    title: "AI and specs are included everywhere",
    body: "Every plan can prompt the AI architect and generate Markdown specs. Higher tiers raise generation limits; the Free tier covers getting started.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Downgrades pause, never delete",
    body: "If a downgrade leaves you over the limit, existing projects turn read-only. View everything, delete down under the limit, and write access returns.",
  },
] as const;

function CountingSection() {
  return (
    <section aria-labelledby="counting-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-copy-muted">about / how counting works</p>
        <h2 id="counting-heading" className="text-xl font-medium text-copy-primary">
          The meter reads one thing: ownership
        </h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {FACTS.map((fact) => (
          <li
            key={fact.title}
            className="flex gap-3 rounded-2xl border border-surface-border bg-surface px-4 py-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated">
              <fact.icon className="h-4 w-4 text-brand" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-copy-primary">{fact.title}</span>
              <span className="text-sm leading-relaxed text-copy-muted">{fact.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { CountingSection };
