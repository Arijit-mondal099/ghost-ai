import type { Metadata } from "next";

import { LegalLayout, PRIVACY_SECTIONS } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Ghost AI",
  description:
    "How Ghost AI collects, uses, and protects your account data, canvas designs, prompts, and generated specs.",
};

function PrivacyPage() {
  return (
    <LegalLayout
      slug="privacy"
      title="Your designs stay yours."
      lede="What we collect when you design with Ghost AI, why we need it, and what we will never do with it."
      updated="September 2026"
      sections={PRIVACY_SECTIONS}
      crossLink={{
        href: "/terms",
        title: "Terms of Service",
        description: "The rules for accounts, collaboration, billing, and AI output.",
      }}
    />
  );
}

export default PrivacyPage;
