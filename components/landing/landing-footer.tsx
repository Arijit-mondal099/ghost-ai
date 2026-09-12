import Link from "next/link";
import { ArrowUpRightIcon, LayoutTemplateIcon } from "lucide-react";

import { LandingGhostMark } from "./ghost-mark";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Pricing", href: "#pricing" },
      { label: "Testimonials", href: "#testimonials" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Sign in", href: "/sign-in" },
      { label: "Sign up", href: "/sign-up" },
      { label: "Open editor", href: "/editor" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer>
      <div className="px-6 pt-16 pb-8 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <LandingGhostMark />
            <p className="mt-5 max-w-xs text-base leading-relaxed text-copy-secondary">
              Describe systems, design them together, ship the spec.
            </p>
            <p className="mt-10 font-mono text-xs tracking-widest text-copy-muted uppercase">
              Also in Ghost
            </p>
            <Link
              href="#features"
              className="mt-4 flex max-w-xs items-center gap-3 rounded-2xl border border-surface-border bg-surface p-4 outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-brand">
                <LayoutTemplateIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-copy-primary">
                  Starter templates
                </span>
                <span className="block truncate text-xs text-copy-muted">
                  Prebuilt designs for microservices, event-driven, and more.
                </span>
              </span>
              <ArrowUpRightIcon className="h-4 w-4 shrink-0 text-copy-muted" aria-hidden="true" />
            </Link>
          </div>
          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Footer">
            {COLS.map((col) => (
              <div key={col.title}>
                <p className="font-mono text-xs tracking-widest text-copy-muted uppercase">
                  {col.title}
                </p>
                <ul className="mt-5 space-y-3.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="rounded text-[15px] text-copy-secondary outline-none transition-colors hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-14 border-t border-surface-border pt-6">
          <p className="text-xs text-copy-muted">
            © 2026 Ghost AI · All rights reserved · Built for systems thinkers.
          </p>
        </div>
      </div>
      <div className="overflow-hidden px-6" aria-hidden="true">
        <p className="translate-y-[18%] text-center text-[13vw] leading-[0.85] font-bold tracking-tight whitespace-nowrap text-copy-faint opacity-40 select-none">
          GHOST AI
        </p>
      </div>
    </footer>
  );
}
