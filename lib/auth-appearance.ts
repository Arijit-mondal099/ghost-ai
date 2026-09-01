import { shadcn } from "@clerk/ui/themes";

import type { ClerkAppearanceTheme } from "@clerk/shared/types";

// Single source of truth for how Clerk surfaces look in this app.
//
// Color/font tokens are intentionally NOT overridden here. The shadcn theme
// reads standard shadcn variable names (--card, --foreground, --primary, etc.)
// that are already declared in app/globals.css `:root` and `.dark` with the
// project's dark hex values. Overriding the variables block would replace the
// theme's defaults with our own references and break surfaces that read the
// shadcn namespace (e.g. UserProfile / AccountSettings).
//
// Per-element overrides below apply our two-panel layout's structural tweaks
// and a non-conflicting font family on top of the theme.
export const authAppearance: ClerkAppearanceTheme = {
  theme: shadcn,
  variables: {
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    card: "bg-transparent shadow-none",
    formButtonPrimary: "bg-brand text-base hover:opacity-90",
    formFieldInput: "bg-surface border-surface-border text-copy-primary",
    footerActionLink: "text-brand hover:opacity-80",
    socialButtonsBlockButton: "bg-surface border-surface-border text-copy-primary",
    dividerLine: "bg-surface-border",
    dividerText: "text-copy-muted",
    identityPreview: "bg-surface",
    formFieldLabel: "text-copy-secondary",
  },
};
