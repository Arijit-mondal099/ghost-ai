type LegalSection = {
  id: string;
  label: string;
  plain: string;
  paragraphs: string[];
  bullets?: string[];
};

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "what-we-collect",
    label: "What we collect",
    plain: "Your account details, your designs, and the minimum logs we need to run the service.",
    paragraphs: [
      "When you sign in with Clerk we receive your email address, name, and avatar. When you use Ghost AI we store the projects you create, the collaborator emails you invite, the nodes and edges on your canvases, the prompts you send to the AI architect, and the Markdown specs you generate.",
      "We also keep short operational logs — task run records, error traces, and usage counts such as how many projects you own — so we can keep the service reliable and enforce plan limits.",
    ],
  },
  {
    id: "how-we-use-it",
    label: "How we use it",
    plain: "To run your workspace, generate your designs, and keep the lights on. Nothing else.",
    paragraphs: [
      "Your data powers exactly three things: rendering your editor and canvas, running AI generation jobs you explicitly trigger, and operating the service — authentication, billing metering, abuse prevention, and support.",
    ],
    bullets: [
      "We never sell your personal data or your designs.",
      "We never show you ads and never share data with advertisers.",
      "We never use your canvas content to market to you.",
    ],
  },
  {
    id: "ai-processing",
    label: "AI processing",
    plain: "When you press generate, your prompt and canvas go to the model. Only then.",
    paragraphs: [
      "Design generation and spec generation run as background jobs. When you trigger one, we send your prompt together with the relevant project context and canvas graph to our AI model provider so it can return nodes, edges, or a Markdown spec.",
      "Prompts are sent only when you ask for generation. Simply typing, drawing, or moving nodes on the canvas does not call the model. The provider processes your input under its own data-processing terms and does not receive your Clerk credentials or billing details.",
    ],
  },
  {
    id: "realtime-collaboration",
    label: "Realtime collaboration",
    plain: "Live cursors and edits travel through an encrypted realtime room.",
    paragraphs: [
      "The shared canvas is powered by Liveblocks rooms scoped to a single project. Cursor positions, presence state, and node or edge edits are synced through that room so collaborators see each other live.",
      "Room access tokens are issued only after we verify you own the project or are an invited collaborator. Anyone you remove from a project loses room access immediately.",
    ],
  },
  {
    id: "storage",
    label: "Where it lives",
    plain: "Metadata in Postgres, design artifacts in Blob storage. Two layers, on purpose.",
    paragraphs: [
      "Project metadata, collaborator lists, spec records, and task run history live in a managed Neon Postgres database. Large artifacts — canvas snapshots and generated Markdown specs — live in Vercel Blob storage, with the reference URL stored alongside your project record.",
      "Canvas snapshots exist so a room can be restored and collaborators stay in sync. Deleting a project deletes its metadata, its stored snapshots, and its generated specs.",
    ],
  },
  {
    id: "sharing",
    label: "Who we share with",
    plain: "Our infrastructure providers, your collaborators, and nobody else.",
    paragraphs: [
      "We share data only with the subprocessors that run Ghost AI and with the collaborators you invite. Each receives the minimum needed for its job:",
    ],
    bullets: [
      "Clerk — sign-in, identity, and subscription billing.",
      "Liveblocks — realtime canvas rooms, presence, and cursors.",
      "Trigger.dev — durable AI generation jobs you trigger.",
      "Neon and Vercel — database and artifact storage and hosting.",
      "AI model provider — prompts and canvas context for generations you request.",
    ],
  },
  {
    id: "cookies",
    label: "Cookies",
    plain: "A session cookie to keep you signed in. No tracking cookies.",
    paragraphs: [
      "Clerk sets the session cookies that keep you signed in and protect against cross-site request forgery. We do not set advertising or cross-site tracking cookies, and we do not run third-party analytics that follows you across the web.",
    ],
  },
  {
    id: "retention-deletion",
    label: "Retention and deletion",
    plain: "Delete a project and its designs are gone. Delete your account and everything follows.",
    paragraphs: [
      "Projects you delete are removed with their canvas snapshots and generated specs. Short-lived task run records may persist briefly in logs for debugging and are then rotated out.",
      "To delete your account and all associated projects, contact us at the address below and we will confirm once removal is complete.",
    ],
  },
  {
    id: "security",
    label: "Security",
    plain: "Encrypted in transit and at rest, with access checks on every request.",
    paragraphs: [
      "Traffic is encrypted with TLS, and stored data is encrypted at rest by our providers. Every mutation endpoint verifies your identity and project membership before touching data, and Liveblocks room tokens are minted per project member only.",
      "No system is perfectly secure. If we discover a breach affecting your data, we will notify you at your account email.",
    ],
  },
  {
    id: "your-rights",
    label: "Your rights",
    plain: "Ask for a copy, a correction, or a deletion and we will act.",
    paragraphs: [
      "You can review and edit your projects, prompts, and specs directly in the editor at any time. For requests to export, correct, restrict, or delete your personal data — including rights under GDPR or CCPA — contact us and we will respond within 30 days.",
    ],
  },
  {
    id: "changes-contact",
    label: "Changes and contact",
    plain: "We will post updates here and keep prior promises intact.",
    paragraphs: [
      "If this policy changes materially, we will update the date below and, for significant changes, notify you by email before they take effect. Questions about privacy at Ghost AI: privacy@ghost-ai.example.",
    ],
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "the-service",
    label: "The service",
    plain: "Describe systems in plain English, design them together, export the spec.",
    paragraphs: [
      "Ghost AI provides a realtime collaborative workspace where you describe a system in plain English, refine the generated architecture on a shared canvas with collaborators, and export a Markdown technical specification.",
      "Starter templates are prebuilt starting points you may import and modify freely within your projects.",
    ],
  },
  {
    id: "your-account",
    label: "Your account",
    plain: "One account per person, keep your credentials to yourself.",
    paragraphs: [
      "You sign in through Clerk and are responsible for activity under your account. You must provide accurate contact details and be at least 16 years old, or the age of digital consent in your jurisdiction, to use the service.",
      "Project ownership belongs to the account that created the project. Owners may invite collaborators by email; collaborators can view and edit the canvas but cannot delete the project or manage billing.",
    ],
  },
  {
    id: "your-content",
    label: "Your content",
    plain: "Your designs are yours. You give us just enough rights to host and process them.",
    paragraphs: [
      "You retain full ownership of your prompts, canvas graphs, and generated specs. By using the service you grant us a limited license to store, display, sync, and process that content — including sending it to our AI provider when you request generation — solely to operate Ghost AI for you.",
      "You are responsible for having the rights to anything you upload or invite others to, and for what your collaborators do with access you grant them. Remove a collaborator the moment they should no longer see the work.",
    ],
  },
  {
    id: "ai-output",
    label: "AI output",
    plain: "Generated architectures are drafts. Review them like any other draft.",
    paragraphs: [
      "AI-generated nodes, edges, and specs can be incomplete, inaccurate, or insecure. They are suggestions, not engineering advice, and you are responsible for reviewing generated designs before relying on them in production.",
      "You may use generated output in your own systems and documentation, including commercially, subject to these terms.",
    ],
  },
  {
    id: "acceptable-use",
    label: "Acceptable use",
    plain: "Use Ghost AI to design systems. Don't abuse it or anyone on it.",
    paragraphs: ["You agree not to misuse the service or its realtime infrastructure:"],
    bullets: [
      "No unlawful content, malware designs, or instructions facilitating wrongdoing.",
      "No probing, scraping, or overloading the canvas sync, APIs, or generation queues.",
      "No impersonating others, harvesting collaborator emails, or evading access controls.",
      "No reselling or repackaging the service itself without written permission.",
    ],
  },
  {
    id: "plans-billing",
    label: "Plans and billing",
    plain: "Free covers up to 3 owned projects. Paid plans bill through Clerk.",
    paragraphs: [
      "The Free plan includes up to 3 owned projects; projects shared with you do not count against your limit. Paid plans add project capacity and generation headroom as described on the pricing page.",
      "Checkout, upgrades, downgrades, and cancellations are handled by Clerk Billing. Paid fees are non-refundable except where required by law, and nothing you drew is ever held hostage to billing — downgrading never deletes your existing projects.",
    ],
  },
  {
    id: "termination",
    label: "Suspension and termination",
    plain: "Break the rules and we may suspend you. Leave anytime and take your specs first.",
    paragraphs: [
      "We may suspend or terminate accounts that violate these terms, abuse shared infrastructure, or pose a security risk, with notice where practical. You may stop using the service at any time.",
      "Download any specs you need before deleting projects or closing your account — deletion of projects and their artifacts is permanent.",
    ],
  },
  {
    id: "disclaimers-liability",
    label: "Disclaimers and liability",
    plain: "Provided as-is; our liability is capped at what you paid us.",
    paragraphs: [
      "The service is provided as-is without warranties of any kind, including availability, fitness for a particular purpose, or error-free AI output. To the maximum extent permitted by law, Ghost AI's total liability for any claim is limited to the fees you paid in the 12 months before the claim, or $50 if you paid nothing.",
      "We are not liable for indirect, incidental, or consequential damages, including lost designs you failed to export before deletion.",
    ],
  },
  {
    id: "changes-contact",
    label: "Changes and contact",
    plain: "We will post updates here before they take effect.",
    paragraphs: [
      "We may update these terms as the product evolves. Material changes take effect 14 days after posting, with email notice to account holders; continued use after that date means you accept the updated terms.",
      "Questions about these terms: legal@ghost-ai.example.",
    ],
  },
];

export { PRIVACY_SECTIONS, TERMS_SECTIONS };
export type { LegalSection };
