import { describe, expect, it } from "vitest";
import { describeInstallSteps, detectInstallPlatform, supportsInstallPrompt } from "./install";

/**
 * Platform detection decides which installation instructions a user is shown, and getting
 * it wrong means telling an iPhone user to look for an install icon in the address bar that
 * Safari does not have. The functions take the user agent as an argument precisely so this
 * can be checked for every platform without a browser.
 */

const AGENTS = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipadLegacy:
    "Mozilla/5.0 (iPad; CPU OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1",
  // iPadOS 13+ reports itself as desktop Safari. Only the touch points give it away.
  ipadModern:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  linux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
} as const;

describe("detectInstallPlatform", () => {
  it("recognises an iPhone", () => {
    expect(detectInstallPlatform(AGENTS.iphone)).toBe("ios");
  });

  it("recognises an older iPad that still says iPad", () => {
    expect(detectInstallPlatform(AGENTS.ipadLegacy)).toBe("ios");
  });

  it("recognises a modern iPad despite its desktop user agent", () => {
    // A Mac with a touchscreen does not exist, so touch points on a "Macintosh" mean iPad.
    // Without this, iPad users would be shown desktop instructions for a menu they do not
    // have.
    expect(detectInstallPlatform(AGENTS.ipadModern, 5)).toBe("ios");
  });

  it("treats a real Mac as desktop", () => {
    expect(detectInstallPlatform(AGENTS.ipadModern, 0)).toBe("desktop");
    expect(detectInstallPlatform(AGENTS.mac)).toBe("desktop");
  });

  it("recognises Android", () => {
    expect(detectInstallPlatform(AGENTS.android)).toBe("android");
  });

  it.each([
    ["Windows", AGENTS.windows],
    ["Linux", AGENTS.linux],
    ["ChromeOS", AGENTS.chromeOs],
  ])("treats %s as desktop", (_name, agent) => {
    expect(detectInstallPlatform(agent)).toBe("desktop");
  });

  it("falls back to unknown rather than guessing", () => {
    expect(detectInstallPlatform("")).toBe("unknown");
    expect(detectInstallPlatform("SomeBotCrawler/1.0")).toBe("unknown");
  });
});

describe("supportsInstallPrompt", () => {
  it("is false on iOS, which fires no install event", () => {
    // This is why the instruction list exists at all: a button here could not work.
    expect(supportsInstallPrompt("ios")).toBe(false);
  });

  it("is true where beforeinstallprompt exists", () => {
    expect(supportsInstallPrompt("android")).toBe(true);
    expect(supportsInstallPrompt("desktop")).toBe(true);
  });

  it("is false when the platform could not be identified", () => {
    expect(supportsInstallPrompt("unknown")).toBe(false);
  });
});

describe("describeInstallSteps", () => {
  it("tells iOS users to use the Share menu", () => {
    const steps = describeInstallSteps("ios");
    expect(steps.join(" ")).toContain("Share");
    expect(steps.join(" ")).toContain("Add to Home Screen");
  });

  it("always returns at least one actionable step", () => {
    for (const platform of ["ios", "android", "desktop", "unknown"] as const) {
      expect(describeInstallSteps(platform).length).toBeGreaterThan(0);
    }
  });
});
