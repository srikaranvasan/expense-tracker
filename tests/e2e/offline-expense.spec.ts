import { expect, test } from "@playwright/test";
import { createBankAccount, formField, registerAndSignIn, selectOptionByText } from "./helpers/app";
import {
  goOffline,
  goOnline,
  installConnectivityControl,
  waitForServiceWorkerControl,
  warmPageCache,
} from "./helpers/pwa";

/**
 * Recording an expense with no connection, and watching it sync.
 *
 * This is the one journey nothing else can cover. The integration suite exercises the sync
 * API against MongoDB but never runs a browser; the offline vitest project exercises the
 * queue and the engine against `fake-indexeddb` but has no service worker, no real network
 * to lose, and no UI. Only here do all four take part at once: a cached shell serves the
 * form, the write lands in IndexedDB, the queue survives, and the engine drains it when the
 * connection returns.
 *
 * It is also the application's headline feature (docs/01-MVP-SCOPE.md), so it is worth the
 * cost of a slow test.
 */

test.describe("offline expense", () => {
  test("is saved on the device and syncs when the connection returns", async ({
    page,
    context,
  }) => {
    // Before the first navigation: the override is installed per document.
    await installConnectivityControl(page);

    await registerAndSignIn(page);
    const accountName = await createBankAccount(page, "HDFC Savings", "50000");

    await waitForServiceWorkerControl(page);

    /*
     * Both pages are visited online first.
     *
     * Not a workaround — it is the actual contract. The worker caches pages as they are
     * visited rather than precaching the app, so offline support means "somewhere you have
     * been before". A user who has never opened the expense form cannot open it offline, and
     * the test has to reflect that rather than pretend otherwise.
     */
    await warmPageCache(page, ["/transactions", "/transactions/new"]);

    await goOffline(page, context);
    await page.goto("/transactions/new");

    // The form tells the user what is about to happen, rather than letting them discover it
    // after the fact (docs/08-OFFLINE-SYNC.md section 49).
    await expect(page.getByText(/Saving to this device/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save on this device" })).toBeVisible();

    await formField(page, "amount").fill("725.25");
    await formField(page, "description").fill("Offline lunch");
    await selectOptionByText(page, "accountId", accountName);
    await page.getByRole("button", { name: "Save on this device" }).click();

    /*
     * It navigates to the list, not to a detail page: no server id exists yet, so there is
     * nothing to open.
     *
     * The bare path matters. This used to be `/transactions?saved=offline`, and because the
     * worker caches by exact URL, the one navigation guaranteed to happen offline was the one
     * guaranteed to miss — so the user landed on the offline page instead of their
     * transactions. This test is what found it.
     */
    await page.waitForURL(/\/transactions$/, { timeout: 30_000 });

    // The queue is visible and framed as normal, not as a failure.
    await expect(page.getByText(/Offline · will sync later/)).toBeVisible();

    /*
     * Durability check, and the reason this test exists.
     *
     * The record must be in IndexedDB — not React state — before the connection returns, or
     * closing the tab here would lose it (docs/08-OFFLINE-SYNC.md section 10).
     */
    const queued = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.map((database) => database.name).filter(Boolean).length;
    });
    expect(queued).toBeGreaterThan(0);

    await goOnline(page, context);

    /*
     * The engine syncs on the `online` event. Polling with a reload rather than asserting
     * once, because the push, the server write and the next render are three separate steps
     * and the test should not depend on how long they take.
     */
    await expect
      .poll(
        async () => {
          await page.goto("/transactions");
          return page.getByText("Offline lunch").count();
        },
        { timeout: 60_000, intervals: [1_000, 2_000, 3_000, 5_000] },
      )
      .toBeGreaterThan(0);

    // And the balance moved, which is the proof the server applied it rather than the client
    // merely displaying its own copy. 50000 - 725.25 = 49274.75.
    await page.goto("/accounts");
    await expect(page.getByText(/49,?274\.75/).first()).toBeVisible();

    // Nothing left queued.
    await expect(page.getByText(/Offline · will sync later/)).toHaveCount(0);
  });

  test("does not offer to save an edit offline", async ({ page, context }) => {
    await installConnectivityControl(page);
    await registerAndSignIn(page);
    const accountName = await createBankAccount(page);

    await page.goto("/transactions/new");
    await formField(page, "amount").fill("300");
    await formField(page, "description").fill("Editable expense");
    await selectOptionByText(page, "accountId", accountName);
    await page.getByRole("button", { name: "Record expense" }).click();
    await page.waitForURL(/\/transactions\/[a-f\d]{24}$/, { timeout: 30_000 });

    const editUrl = `${page.url()}/edit`;
    await waitForServiceWorkerControl(page);
    await warmPageCache(page, [editUrl]);

    await goOffline(page, context);
    await page.goto(editUrl);

    /*
     * Offline *creation* is supported; offline *editing* is not. An edit carries the version
     * it was based on, so queueing one without being able to check that version against the
     * server risks overwriting a change made elsewhere — which section 26 forbids.
     *
     * The form says so and disables the button, rather than accepting the edit and failing
     * later.
     */
    await expect(page.getByText(/You are offline/i)).toBeVisible();
    await expect(page.getByText(/needs a connection/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
