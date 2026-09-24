"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { IconButton } from "@/components/ui/Button";
import { useColorMode } from "./ColorModeProvider";

/**
 * Switches between the light and dark palettes.
 *
 * Lives in the app header, immediately before sign-out, because group 21 decided that: there
 * is no settings screen (`src/app/(app)/settings/` is empty) and adding one to hold a single
 * control is scope the restyle does not need. The header is the one piece of chrome present
 * on every authenticated screen.
 *
 * It is **icon-only** from the start rather than a labelled button that group 30 shrinks
 * later. A wide text button in the mobile header is the direct cause of the crushed-title
 * bug this restyle exists to fix (`docs/design-tasks/01-DESIGN-SYSTEM.md` section 9.2), and
 * introducing one temporarily would mean reintroducing the bug and hoping to remember.
 */

/**
 * Both glyphs are always rendered, and CSS decides which is visible.
 *
 * Not a stylistic preference — it is what makes the control hydration-safe. The server cannot
 * know the user's mode (no `localStorage`, no `matchMedia`), so choosing the glyph in
 * JavaScript would guarantee a hydration mismatch on every dark-mode visit. Selecting it with
 * the `.dark` class means the markup is identical on both sides, and the right glyph is
 * showing before React has even loaded.
 *
 * The glyphs themselves were drawn in this file by group 24, before the registry existed, and
 * moved into it by group 25 unchanged.
 */
export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();

  /*
   * `aria-pressed` is only attached after mount.
   *
   * The server renders this without knowing the mode, so emitting `aria-pressed` during SSR
   * would either be wrong half the time or produce a hydration mismatch. Omitting it until
   * mounted keeps the first client render byte-identical to the server's, and the attribute
   * appears a tick later — at which point the control is a proper toggle button that
   * announces its state. Before then it is still a working button with an accessible name.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <IconButton
      tone="secondary"
      onClick={toggleColorMode}
      // The name describes the control, not the action, so it does not have to change when
      // the state does — `aria-pressed` carries the state.
      aria-label="Dark theme"
      title="Dark theme"
      {...(mounted ? { "aria-pressed": colorMode === "dark" } : {})}
    >
      <Icon name="sun" size="tab" display="block" _dark={{ display: "none" }} />
      <Icon name="moon" size="tab" display="none" _dark={{ display: "block" }} />
    </IconButton>
  );
}
