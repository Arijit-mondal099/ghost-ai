import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { LandingPage } from "@/components/landing";

export const metadata: Metadata = {
  title: "Ghost AI — Describe systems. Design together. Ship the spec.",
  description:
    "Ghost AI turns plain-English prompts into a realtime collaborative architecture canvas and exports a Markdown technical spec.",
  openGraph: {
    title: "Ghost AI — Describe systems. Design together. Ship the spec.",
    description: "Prompt it, refine it together on a live canvas, export the spec.",
    type: "website",
  },
};

async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/editor");
  }

  return <LandingPage />;
}

export default Home;
