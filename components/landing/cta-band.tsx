"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="border-b border-surface-border bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/cta.jpg)" }}
    >
      <div className="px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl px-6 py-12 text-center md:py-16"
        >
          <p className="font-mono text-xs tracking-widest text-ai-text uppercase">
            {"// Ready when you are"}
          </p>
          <h2
            id="cta-heading"
            className="mx-auto mt-4 max-w-xl text-2xl font-medium tracking-tight text-copy-primary md:text-3xl"
          >
            Bring your next architecture review to life.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-copy-secondary">
            Start with a sentence. Leave with a diagram and a spec.
          </p>
          <motion.span
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="mt-8 inline-block"
          >
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start designing
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
