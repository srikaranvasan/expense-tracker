"use client";

import { useCallback, useEffect, useState } from "react";
import {
  describeInstallSteps,
  detectInstallPlatform,
  isStandaloneDisplay,
  observeInstallability,
  promptInstall,
  supportsInstallPrompt,
} from "../pwa/install";
import type { BeforeInstallPromptEvent, InstallPlatform } from "../pwa/install";

/**
 * Remembers a dismissal so the invitation is offered once, not on every visit.
 *
 * `localStorage` is right for this and wrong for financial data. This is a single UI
 * preference that may be lost without consequence; the prohibition in
 * docs/08-OFFLINE-SYNC.md section 4 is about the application's dataset, which lives in
 * IndexedDB.
 */
const DISMISSED_KEY = "expense-tracker:install-dismissed";

function readDismissed(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Storage can throw outright in Safari private browsing.
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage?.setItem(DISMISSED_KEY, "1");
  } catch {
    // A dismissal that cannot be remembered is a small annoyance, not a failure.
  }
}

export type InstallPromptStatus = {
  platform: InstallPlatform;
  /** Already running as an installed app, so there is nothing to offer. */
  standalone: boolean;
  /** The browser has offered a programmatic prompt and the user has not dismissed it. */
  canPrompt: boolean;
  /** True when instructions are the only route, which on iOS is always. */
  needsManualSteps: boolean;
  steps: readonly string[];
  install: () => Promise<boolean>;
  dismiss: () => void;
};

/**
 * Drives the install affordance.
 *
 * Everything starts in its "nothing to show" state and is corrected after mount. The
 * server cannot know the platform, the display mode, or whether the app is already
 * installed, so rendering any of it during SSR would be a hydration mismatch.
 */
export function useInstallPrompt(): InstallPromptStatus {
  const [platform, setPlatform] = useState<InstallPlatform>("unknown");
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    setStandalone(isStandaloneDisplay());
    setDismissed(readDismissed());

    return observeInstallability({
      onPromptAvailable: setEvent,
      onInstalled: () => setInstalled(true),
    });
  }, []);

  const install = useCallback(async () => {
    if (!event) return false;

    const accepted = await promptInstall(event);

    // Chromium delivers `beforeinstallprompt` once per page load, so the event is spent
    // either way. Keeping it would produce a button that silently does nothing.
    setEvent(null);
    if (!accepted) {
      writeDismissed();
      setDismissed(true);
    }
    return accepted;
  }, [event]);

  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  const hidden = standalone || installed || dismissed;

  return {
    platform,
    standalone,
    canPrompt: !hidden && event !== null,
    // iOS never fires the event, so instructions are the only route there. Other platforms
    // fall back to instructions only when the browser has not offered a prompt.
    needsManualSteps: !hidden && event === null && !supportsInstallPrompt(platform),
    steps: describeInstallSteps(platform),
    install,
    dismiss,
  };
}
