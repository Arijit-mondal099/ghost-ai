import type { Metadata } from "next";

import { LegalLayout, TERMS_SECTIONS } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Ghost AI",
  description:
    "The terms governing Ghost AI accounts, collaboration, AI-generated output, plans, and billing.",
};

function TermsPage() {
  return (
    <LegalLayout
      slug="terms"
      title="Fair terms for shared work."
      lede="The rules for your account, your collaborators, generated output, and what happens when you pay us or leave."
      updated="September 2026"
      sections={TERMS_SECTIONS}
      crossLink={{
        href: "/privacy",
        title: "Privacy Policy",
        description: "What we collect, how AI processing works, and your rights.",
      }}
    />
  );
}

export default TermsPage;
