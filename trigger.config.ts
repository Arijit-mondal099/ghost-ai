import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Project ref from the Trigger.dev dashboard (public identifier, not a
  // secret). Dev/prod are environments inside this one project, so the
  // literal is correct for both `trigger:dev` and `trigger:deploy` — no
  // env var needed at config load.
  project: "proj_fdxdszhltdgtrgaykswl",
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
