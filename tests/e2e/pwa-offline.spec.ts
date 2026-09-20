import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * PWA verification in a real browser.
 *
 * These cover the four "verify" checkboxes in group 16 — offline startup, cached
 * resources, reconnect behaviour, installability metadata — none of which can be checked
 * without a browser that has a Cache API and a service worker lifecycle.
 *
 * They deliberately use the **sign-in page** rather than an authenticated screen. Sessions
 * and seeded data belong to the journey tests in group 19; what is under test here is the
 * caching layer, and it behaves identically either side of the login boundary. Using a
 * public page keeps the test focused on the worker.
 */

/**
 * Waits until the worker has finished activating.
 *
 * `navigator.serviceWorker.ready` resolves as soon as there is an *active* worker, which
 * can still be in the `activating` state while its `activate` handler runs. Asserting
 * anything before that is a race: the precache is part of install, and the first
 * navigation the worker handles must find the offline page already stored.
 */
async function waitForActivation(page: Page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker || worker.state === "activated") return;

    await new Promise<void>((resolve) => {
      const check = () => {
        if (worker.state === "activated") {
          worker.removeEventListener("statechange", check);
          resolve();
        }
      };
      worker.addEventListener("statechange", check);
      check();
    });
  });
}

/**
 * Waits until the worker is activated, controlling this page, and has precached the
 * fallback.
 *
 * The precache check is the meaningful gate. Without it a test can go offline in the gap
 * between activation and `cache.add` completing, and then get the worker's inline
 * last-resort response instead of the real /offline page — a pass or fail decided by
 * timing rather than by behaviour.
 */
async function waitForServiceWorkerControl(page: Page) {
  await waitForActivation(page);

  await page.evaluate(async () => {
    if (navigator.serviceWorker.controller) return;
    // The worker claims clients during activation, which can land just after this point.
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
        once: true,
      });
      setTimeout(resolve, 5_000);
    });
  });

  await page.waitForFunction(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      if (await cache.match("/offline")) return true;
    }
    return false;
  });
}

test.describe("PWA", () => {
  test("registers a service worker that takes control of the page", async ({ page }) => {
    await page.goto("/login");
    await waitForActivation(page);

    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return { scope: registration.scope, active: registration.active?.state };
    });

    expect(state.active).toBe("activated");
    // Scope must be the whole origin or navigations outside it would bypass the worker.
    expect(state.scope).toMatch(/\/$/);
  });

  test("serves an installable manifest and the icons it references", async ({ page, request }) => {
    await page.goto("/login");

    // The link element is what makes the browser look for a manifest at all.
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name: string;
      display: string;
      start_url: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");

    // Chromium requires at least one icon of 192px or larger before it offers to install.
    const installable = manifest.icons.filter((icon) =>
      icon.sizes.split(" ").some((size) => size === "any" || Number(size.split("x")[0]) >= 192),
    );
    expect(installable.length).toBeGreaterThan(0);

    // Android crops non-maskable icons, so a maskable variant must exist.
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);

    // Every declared icon must actually resolve. A 404 here is invisible in the manifest
    // itself and shows up only as a browser that quietly declines to install.
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.status(), `${icon.src} should exist`).toBe(200);
    }
  });

  test("declares the iOS home-screen metadata Safari needs", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/icons/apple-touch-icon.png",
    );
    // Without a capable tag, iOS opens the installed app inside Safari chrome.
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      "content",
      "yes",
    );
  });

  test("starts offline from the cached shell", async ({ page, context }) => {
    await page.goto("/login");
    await waitForServiceWorkerControl(page);

    // Second visit while online, so the navigation response is stored by the worker that
    // is now in control.
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    // The app opens with no network at all. This is the checkbox "verify offline app
    // startup".
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("keeps build output available offline", async ({ page, context }) => {
    await page.goto("/login");
    await waitForServiceWorkerControl(page);
    await page.goto("/login");

    await context.setOffline(true);
    await page.reload();

    // A cached document with no cached chunks would render but never hydrate, so the
    // interactive proof is stronger than checking cache contents: React must be running
    // for a controlled input to accept text.
    const email = page.getByLabel(/email/i);
    await email.fill("someone@example.test");
    await expect(email).toHaveValue("someone@example.test");

    const cachedChunks = await page.evaluate(async () => {
      const names = await caches.keys();
      const staticCache = names.find((name) => name.includes("static-"));
      if (!staticCache) return 0;
      const cache = await caches.open(staticCache);
      return (await cache.keys()).length;
    });
    expect(cachedChunks).toBeGreaterThan(0);
  });

  test("shows the offline page for a route that was never visited", async ({ page, context }) => {
    await page.goto("/login");
    await waitForServiceWorkerControl(page);

    await context.setOffline(true);
    await page.goto("/accounts/never-opened-on-this-device");

    // Ours, not the browser's error page — and phrased as a fact rather than a failure
    // (docs/08-OFFLINE-SYNC.md section 49).
    await expect(page.getByRole("heading", { name: /not available offline/i })).toBeVisible();
    await expect(page.getByText(/will sync automatically/i)).toBeVisible();
  });

  test("never answers an API request from the cache", async ({ page, context }) => {
    await page.goto("/login");
    await waitForServiceWorkerControl(page);

    // Prime it: a successful API call while online must still leave nothing behind.
    const online = await page.evaluate(async () => {
      const response = await fetch("/api/health", { cache: "no-store" });
      return response.status;
    });
    expect(online).toBe(200);

    const cachedApiEntries = await page.evaluate(async () => {
      const names = await caches.keys();
      let total = 0;
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        total += keys.filter((request) => new URL(request.url).pathname.startsWith("/api/")).length;
      }
      return total;
    });
    expect(cachedApiEntries).toBe(0);

    await context.setOffline(true);

    // Offline, the request must fail rather than resolve with a stale success. A cached
    // "ok" for a sync push would tell the client an expense had reached the server when it
    // never left the device.
    const offlineResult = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        return { failed: false, status: response.status };
      } catch {
        return { failed: true, status: 0 };
      }
    });
    expect(offlineResult.failed).toBe(true);
  });

  test("recovers when the connection returns", async ({ page, context }) => {
    await page.goto("/login");
    await waitForServiceWorkerControl(page);

    await context.setOffline(true);
    await page.goto("/accounts/never-opened-on-this-device");
    await expect(page.getByRole("heading", { name: /not available offline/i })).toBeVisible();

    await context.setOffline(false);

    // The page probes /api/health rather than trusting navigator.onLine, so recovery is
    // detected by the server actually answering. It becomes a way forward instead of
    // continuing to report a problem the user no longer has.
    await expect(page.getByRole("heading", { name: /back online/i })).toBeVisible({
      timeout: 20_000,
    });

    // And a real navigation works again, served from the network.
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
