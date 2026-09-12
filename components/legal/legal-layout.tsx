import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { LandingFooter, LandingNavbar } from "@/components/landing";
import type { LegalSection } from "./legal-content";

type LegalCrossLink = {
  href: string;
  title: string;
  description: string;
};

type LegalLayoutProps = {
  slug: string;
  title: string;
  lede: string;
  updated: string;
  sections: LegalSection[];
  crossLink: LegalCrossLink;
};

function ClauseCard({ section }: { section: LegalSection }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      className="scroll-mt-24 rounded-2xl border border-surface-border bg-surface p-6 md:p-8"
    >
      <p className="font-mono text-xs tracking-widest text-ai-text uppercase">
        clause / {section.id}
      </p>
      <h2
        id={`${section.id}-heading`}
        className="mt-2 text-xl font-medium tracking-tight text-copy-primary"
      >
        {section.label}
      </h2>
      <div className="mt-4 border-l-2 border-dotted border-brand/60 pl-4">
        <p className="font-mono text-[11px] tracking-widest text-copy-muted uppercase">
          In plain English
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-brand">{section.plain}</p>
      </div>
      <div className="mt-4 space-y-3">
        {section.paragraphs.map((paragraph) => (
          <p
            key={paragraph.slice(0, 32)}
            className="text-[15px] leading-relaxed text-copy-secondary"
          >
            {paragraph}
          </p>
        ))}
        {section.bullets ? (
          <ul className="space-y-2">
            {section.bullets.map((bullet) => (
              <li
                key={bullet.slice(0, 32)}
                className="flex gap-3 text-[15px] leading-relaxed text-copy-secondary"
              >
                <span
                  aria-hidden="true"
                  className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ai-text"
                />
                {bullet}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function LegalLayout({ slug, title, lede, updated, sections, crossLink }: LegalLayoutProps) {
  return (
    <div className="min-h-full bg-base text-copy-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-elevated focus:px-4 focus:py-2 focus:text-copy-primary focus:ring-2 focus:ring-brand"
      >
        Skip to content
      </a>
      <LandingNavbar />
      <div className="mx-auto w-full max-w-7xl border-x border-surface-border">
        <main id="main" className="px-6 pt-14 pb-16 md:pt-20">
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-xs tracking-widest text-copy-muted uppercase">
              legal / {slug}
            </p>
            <h1 className="mt-3 text-4xl font-medium tracking-tight text-copy-primary md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-copy-secondary">{lede}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-mono text-xs text-copy-muted">updated / {updated}</p>
              <p className="font-mono text-xs text-copy-faint">
                cream lines summarize — the body text governs
              </p>
            </div>
          </div>

          <nav aria-label="On this page" className="mx-auto mt-10 max-w-3xl lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {sections.map((section) => (
                <Link
                  key={section.id}
                  href={`#${section.id}`}
                  className="shrink-0 rounded-xl border border-surface-border bg-surface px-3 py-2 font-mono text-xs text-copy-secondary outline-none transition-colors hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {section.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="mx-auto mt-10 grid max-w-6xl gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <nav
                aria-label="On this page"
                className="sticky top-24 border-l border-dotted border-subtle-border pl-5"
              >
                <p className="font-mono text-[11px] tracking-widest text-copy-muted uppercase">
                  On this page
                </p>
                <ul className="mt-4 space-y-1">
                  {sections.map((section) => (
                    <li key={section.id} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ai-text"
                      />
                      <Link
                        href={`#${section.id}`}
                        className="rounded py-1 font-mono text-[13px] leading-snug text-copy-secondary outline-none transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {section.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <div className="mx-auto w-full max-w-3xl space-y-5 lg:mx-0">
              {sections.map((section) => (
                <ClauseCard key={section.id} section={section} />
              ))}

              <Link
                href={crossLink.href}
                className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface p-5 outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] tracking-widest text-copy-muted uppercase">
                    Keep reading
                  </span>
                  <span className="mt-1 block text-[15px] font-medium text-copy-primary">
                    {crossLink.title}
                  </span>
                  <span className="block truncate text-sm text-copy-muted">
                    {crossLink.description}
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-copy-muted" aria-hidden="true" />
              </Link>

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl px-1 py-1 text-sm text-copy-secondary outline-none transition-colors hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
              >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                Back to home
              </Link>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}

export { LegalLayout };
export type { LegalLayoutProps };
