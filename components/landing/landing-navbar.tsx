"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LandingGhostMark } from "./ghost-mark";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-base/80 backdrop-blur-md">
      <nav
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6 md:h-16"
        aria-label="Landing"
      >
        <LandingGhostMark />
        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-3 py-2 text-sm text-copy-secondary outline-none transition-colors hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="https://github.com/Arijit-mondal099/ghost-ai"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-copy-secondary outline-none transition-colors hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
          >
            GitHub
            <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </Button>
      </nav>
      <div
        className={cn(
          "overflow-hidden border-surface-border transition-all lg:hidden",
          open ? "max-h-96 border-t" : "max-h-0",
        )}
      >
        <div className="space-y-1 px-6 py-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-copy-secondary hover:bg-subtle hover:text-copy-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="https://github.com/Arijit-mondal099/ghost-ai"
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-copy-secondary hover:bg-subtle hover:text-copy-primary"
          >
            GitHub
            <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="flex gap-2 pt-3">
            <Button variant="ghost" size="sm" asChild className="flex-1">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild className="flex-1">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
