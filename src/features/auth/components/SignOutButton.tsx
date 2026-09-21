"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { clearPrivateCaches } from "@/offline/pwa/service-worker";
import { logoutAction } from "../actions/auth-actions";

/**
 * Sign-out is a mutation through a server action rather than a GET link, so it
 * cannot be triggered by a link prefetch or an embedded image
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md).
 */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  /**
   * Cached HTML is dropped as the session ends.
   *
   * Group 16 made the service worker cache rendered pages, so the dashboard — balances,
   * descriptions, who owes whom — sits in the Cache API. On a shared device that must not
   * outlive the session, and the sign-out click is the only moment the page can still talk
   * to the worker.
   *
   * Deliberately **not awaited**. Group 16 originally awaited it before calling the action,
   * which broke sign-out entirely: the action then ran outside the transition, its
   * `Set-Cookie` was never applied, and the user was redirected to /login still holding a
   * valid session — so the sign-in page bounced them straight back to the dashboard. Caught
   * by `tests/e2e/journeys.spec.ts`.
   *
   * Nothing is lost by not waiting. `postMessage` reaches the worker synchronously and the
   * worker keeps itself alive with `waitUntil`, so the deletion completes whether or not this
   * page survives. And being unable to clear a cache was never a reason to keep someone
   * signed in.
   *
   * It does **not** clear IndexedDB, which may hold expenses that have not reached the server
   * yet (docs/08-OFFLINE-SYNC.md section 50, rule 8).
   */
  const handleSignOut = () => {
    void clearPrivateCaches();

    // The action stays inside the transition so React applies its cookie changes and its
    // redirect.
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <Button tone="secondary" size="sm" loading={pending} onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
