"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { HeroSchematic } from "./hero-schematic";

const TRUSTED_BY = ["OrbitHQ", "novatech", "CORE|DATA", "ramp", "Metricly"];

const RISE = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section aria-labelledby="hero-heading">
      <div className="border-b border-surface-border px-6 pt-14 pb-12 text-center md:pt-20 md:pb-16">
        <motion.p
          {...RISE}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-1.5 text-sm text-copy-secondary"
        >
          <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
          AI architecture layer for teams and ideas
        </motion.p>
        <motion.h1
          id="hero-heading"
          {...RISE}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mx-auto mt-6 max-w-3xl text-4xl font-medium tracking-tight text-balance md:text-6xl"
        >
          <span className="text-copy-primary">System design</span>{" "}
          <span className="text-copy-muted">for Everything</span> <br className="hidden md:block" />
          <span className="text-copy-muted">You</span>{" "}
          <span className="text-copy-primary">Think, Build and Ship</span>
        </motion.h1>
        <motion.p
          {...RISE}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="mx-auto mt-5 max-w-2xl text-base text-copy-secondary"
        >
          From prompt to shared canvas to Markdown spec — Ghost AI keeps your architecture
          searchable, collaborative, and ready to build from.
        </motion.p>
        <motion.div
          {...RISE}
          transition={{ duration: 0.6, delay: 0.24 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button size="lg" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </motion.span>
          <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="outline" size="lg" asChild>
              <Link href="#how">Learn more</Link>
            </Button>
          </motion.span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative border-b border-surface-border bg-cover bg-center bg-no-repeat px-4 pt-10 md:px-16 md:pt-14"
        style={{ backgroundImage: "url(/hero-background.jpg)" }}
      >
        <div className="relative">
          <HeroSchematic />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="border-b border-surface-border px-6 py-8 text-center text-sm text-copy-muted"
      >
        Trusted by leading teams worldwide
      </motion.p>
      <div className="grid grid-cols-2 divide-x divide-y divide-surface-border border-b border-surface-border sm:grid-cols-3 lg:grid-cols-5">
        {TRUSTED_BY.map((name) => (
          <div key={name} className="flex h-24 items-center justify-center px-4">
            <span className="text-lg font-semibold tracking-tight text-copy-muted">{name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
