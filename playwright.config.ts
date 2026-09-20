import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * Introduced by group 16, which needs a real browser: a service worker cannot be verified
 * in jsdom or Node, because neither has a Cache API, an install lifecycle, or a way to go
 * offline. Group 19 extends this with the user journeys.
 *
 * The tests run against a **production build**, not `next dev`. Development mode disables
 * some caching and serves unminified chunks, so a service worker verified there would not
 * be the one that ships.
 */

/**
 * Set by `scripts/run-e2e.ts`, which is the intended entry point (`npm run test:e2e`).
 *
 * Running `npx playwright test` directly still works for the PWA specs — they need no
 * database — but the journey specs will fail against whatever `.env.local` points at,
 * which is the developer's real cluster. Hence the wrapper.
 */
const PORT = Number(process.env.E2E_PORT ?? 4200);

/**
 * `127.0.0.1` rather than a hostname: Chrome treats `localhost` and `127.0.0.1` as secure
 * origins, and a service worker will not register anywhere else without TLS.
 */
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",

  // Financial state is shared: two specs creating expenses for the same user would see
  // each other's rows. Correctness first, speed second.
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Explicit, because the whole point of these tests is the worker. Playwright's default
    // has changed before.
    serviceWorkers: "allow",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Built here rather than assumed: a stale .next would silently test the previous
    // revision.
    command: `npm run build && npx next start --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
