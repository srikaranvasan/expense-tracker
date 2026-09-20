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
   * Cached HTML is dropped before the session ends.
   *
   * Group 16 made the service worker cache rendered pages, which means the dashboard —
   * balances, descriptions, who owes whom — sits in the Cache API. On a shared device that
   * must not outlive the session, and the sign-out click is the only moment it can be
   * removed while the page is still able to talk to the worker.
   *
   * Awaited before signing out, but a failure does not block it: being unable to clear a
   * cache is not a reason to keep someone signed in. It deliberately does *not* clear
   * IndexedDB, which may hold expenses that have not reached the server yet
   * (docs/08-OFFLINE-SYNC.md section 50, rule 8).
   */
  const signOut = async () => {
    try {
      await clearPrivateCaches();
    } catch {
      // Nothing useful to tell the user; the session still ends.
    }
    await logoutAction();
  };

  return (
    <Button
      tone="secondary"
      size="sm"
      loading={pending}
      onClick={() => startTransition(() => void signOut())}
    >
      Sign out
    </Button>
  );
}
