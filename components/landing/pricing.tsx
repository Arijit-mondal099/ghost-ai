"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

type BillingPeriod = "monthly" | "annually";

const PLANS = [
  {
    name: "Free plan",
    desc: "Everything you need to sketch your first systems",
    monthly: "$0",
    annual: "$0",
    rows: ["3 owned projects", "Basic AI drafts", "Basic collaboration"],
  },
  {
    name: "Pro plan",
    desc: "AI reviews, advanced exports, analytics",
    monthly: "$20",
    annual: "$17",
    featured: true,
    rows: ["100 owned projects", "Higher AI limits", "More collab capacity", "Advanced analytics"],
  },
  {
    name: "Pro Max plan",
    desc: "Custom workflows, priority support, SSO",
    monthly: "$100",
    annual: "$85",
    rows: ["1,000 owned projects", "Highest AI limits", "Highest capacity", "All analytics"],
  },
];

export function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="border-b border-surface-border"
    >
      <div className="scroll-mt-20 px-6 pt-20 md:pt-28">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-1 font-mono text-xs text-copy-secondary">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
            Pricing
          </p>
          <h2
            id="pricing-heading"
            className="mt-5 max-w-2xl text-3xl font-medium tracking-tight text-copy-primary md:text-5xl"
          >
            Simple pricing for growing architecture teams.
          </h2>
          <p className="mt-4 text-base text-copy-secondary md:text-lg">
            Start free. Upgrade when your graph grows.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex rounded-2xl border border-surface-border bg-surface p-1"
            >
              {(["monthly", "annually"] as const).map((p) => (
                <motion.button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  whileTap={{ scale: 0.94 }}
                  className={cn(
                    "rounded-xl px-6 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
                    period === p
                      ? "bg-elevated text-copy-primary"
                      : "text-copy-muted hover:text-copy-secondary",
                  )}
                >
                  {p === "monthly" ? "Monthly" : "Annually"}
                </motion.button>
              ))}
            </div>
            <p className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-1.5 font-mono text-xs text-copy-secondary">
              Save 15% with the annual plan
            </p>
          </div>
        </Reveal>
      </div>

      <div className="mt-12 grid border-t border-surface-border md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: i * 0.08 }}
            className={cn(
              "flex flex-col px-6 py-10",
              i > 0 && "border-t border-surface-border md:border-t-0 md:border-l",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-medium text-copy-primary">{plan.name}</h3>
              {plan.featured ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-2.5 py-1 font-mono text-[11px] text-copy-secondary">
                  <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                  Best value
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-copy-secondary">{plan.desc}</p>
            <p className="mt-14 text-4xl font-semibold tracking-tight text-copy-primary">
              {period === "monthly" ? plan.monthly : plan.annual}
            </p>
            <p className="mt-2 text-sm text-copy-muted">
              {period === "monthly" ? "Per month" : "Per month, billed annually"}
            </p>
            <motion.span
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="inline-block"
            >
              <Button asChild className="mt-6 w-fit">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </motion.span>
            <ul className="mt-10 space-y-4 border-t border-surface-border pt-8">
              {plan.rows.map((row) => (
                <li key={row} className="flex items-start gap-2.5 text-sm text-copy-secondary">
                  <CheckIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-copy-muted"
                    aria-hidden="true"
                  />
                  {row}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <p className="border-t border-surface-border px-6 py-5 font-mono text-xs text-copy-muted">
        Prices shown for reference. Checkout lives in the app.
      </p>
    </section>
  );
}
