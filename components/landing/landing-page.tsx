import { LandingNavbar } from "./landing-navbar";
import { LandingMotion } from "./reveal";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { Features } from "./features";
import { Pricing } from "./pricing";
import { Testimonials } from "./testimonials";
import { Faqs } from "./faqs";
import { CtaBand } from "./cta-band";
import { LandingFooter } from "./landing-footer";

export function LandingPage() {
  return (
    <div className="min-h-full bg-base text-copy-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-elevated focus:px-4 focus:py-2 focus:text-copy-primary focus:ring-2 focus:ring-brand"
      >
        Skip to content
      </a>
      <LandingNavbar />
      <LandingMotion>
        <div className="mx-auto w-full max-w-7xl border-x border-surface-border">
          <main id="main">
            <Hero />
            <HowItWorks />
            <Features />
            <Pricing />
            <Testimonials />
            <Faqs />
            <CtaBand />
          </main>
          <LandingFooter />
        </div>
      </LandingMotion>
    </div>
  );
}
