import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // TODO: replace with your project ref from the Trigger.dev dashboard
  // (e.g. "proj_abc123"). Pick or create the project after
  // `npx trigger.dev@latest login`.
  project: process.env.TRIGGER_PROJECT_REF!,
  runtime: "node",
  dirs: ["trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      randomize: true,
    },
  },
});
