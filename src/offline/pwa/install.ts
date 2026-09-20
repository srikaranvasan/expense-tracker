/**
 * Installation: detecting whether it is possible, and explaining how where it is not.
 *
 * The awkward part of PWA installation is that the platforms disagree. Chromium fires
 * `beforeinstallprompt` and lets the app ask. Safari on iOS fires nothing and never will —
 * the user has to go through Share -> Add to Home Screen. So there are two paths, and the
 * iOS one is instructions rather than a button.
 *
 * The detection is written as pure functions taking a user-agent string so it can be
 * tested for every platform without a browser.
 */

export type InstallPlatform = "ios" | "android" | "desktop" | "unknown";

/**
 * The event Chromium fires when the app is installable.
 *
 * Typed here because it is not in the DOM lib: it is a Chromium extension to the standard,
 * which is precisely why the iOS path exists.
 */
export type BeforeInstallPromptEvent = Event & {
  readonly platforms: readonly string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type IosNavigator = Navigator & { standalone?: boolean };

/**
 * Classifies the platform from the user agent.
 *
 * User-agent sniffing is normally the wrong tool, but here the question is not "what can
 * this browser do" — it is "which set of installation instructions does this user need",
 * and that genuinely is a platform question with no feature to detect.
 *
 * `maxTouchPoints` is needed because iPadOS reports a desktop Safari user agent. Without
 * it, an iPad user gets desktop instructions that do not exist on their device.
 */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (!userAgent) return "unknown";

  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";

  // iPadOS 13+ masquerades as macOS. A Mac with a touchscreen does not exist, so touch
  // points on a "Macintosh" means iPad.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";

  if (/Android/i.test(userAgent)) return "android";

  if (/Windows|Macintosh|Linux|CrOS/i.test(userAgent)) return "desktop";

  return "unknown";
}

/**
 * Whether the app is already running as an installed app.
 *
 * Two checks: the standard `display-mode` media query, and the non-standard
 * `navigator.standalone` that iOS Safari has used since long before the standard existed
 * and still relies on.
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  }

  return (navigator as IosNavigator).standalone === true;
}

/**
 * How to install, per platform.
 *
 * Returned as steps rather than a paragraph so the UI can render a numbered list, which is
 * far easier to follow one-handed on a phone than prose.
 */
export function describeInstallSteps(platform: InstallPlatform): readonly string[] {
  switch (platform) {
    case "ios":
      return [
        "Tap the Share button in Safari's toolbar.",
        "Choose “Add to Home Screen”.",
        "Tap “Add”.",
      ];
    case "android":
      return [
        "Open the browser menu.",
        "Choose “Install app” or “Add to Home screen”.",
        "Confirm.",
      ];
    case "desktop":
      return [
        "Look for the install icon in the address bar.",
        "Or open the browser menu and choose “Install Expense Tracker”.",
      ];
    default:
      return ["Use your browser's menu to add this app to your home screen."];
  }
}

/**
 * Whether this platform can be asked to install programmatically.
 *
 * iOS cannot, which is the whole reason `describeInstallSteps` exists.
 */
export function supportsInstallPrompt(platform: InstallPlatform): boolean {
  return platform === "android" || platform === "desktop";
}

/**
 * Captures `beforeinstallprompt` and hands the event to the caller.
 *
 * `preventDefault()` is required: without it Chromium shows its own mini-infobar and
 * discards the event, so the app can never prompt at a moment of its own choosing.
 *
 * Returns an unsubscribe function. Also listens for `appinstalled` so the affordance can
 * disappear the moment installation completes.
 */
export function observeInstallability(listeners: {
  onPromptAvailable: (event: BeforeInstallPromptEvent) => void;
  onInstalled?: () => void;
}): () => void {
  if (typeof window === "undefined") return () => {};

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    listeners.onPromptAvailable(event as BeforeInstallPromptEvent);
  };

  const onInstalled = () => listeners.onInstalled?.();

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/**
 * Shows the browser's install dialog and reports what the user chose.
 *
 * A dismissed prompt is a normal outcome, not an error: Chromium will not deliver a second
 * `beforeinstallprompt` for the same page load, so the caller must stop offering it rather
 * than retrying.
 */
export async function promptInstall(event: BeforeInstallPromptEvent): Promise<boolean> {
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome === "accepted";
  } catch {
    return false;
  }
}
