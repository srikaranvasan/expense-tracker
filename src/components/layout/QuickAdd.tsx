"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import { IconButton } from "@/components/ui/Button";
import { QUICK_ADD_ACTIONS } from "./QuickAddActions";

/**
 * The mobile quick-add button and its action stack (7.7).
 *
 * Phones only — above `md` the four actions are already a row on the dashboard and the header
 * carries the navigation, so a floating button would be a third way to reach the same routes.
 *
 * ## Why this is `fixed` and lives in the shell
 *
 * `DESIGN.md` specifies `position: absolute` inside the screen container. That was advice for a
 * static artboard, where there is nothing to scroll. In the real app the button has to stay reachable
 * while a long activity list scrolls past, so it is `fixed`; and it is mounted here in `AppShell`
 * beside `BottomNav` rather than inside page content, for the same reason the tab bar is: a `fixed`
 * element inside a page's own subtree ends up in whatever stacking and transform context that page
 * happens to create, and it is the thing that made the old bottom nav appear halfway down a full-page
 * screenshot.
 *
 * ## Stacking
 *
 * Closed, the layer sits at `docked` — above page content, below the tab bar, as 7.7 asks. Open, the
 * scrim and the layer both move to `overlay`, which is above `sticky`, so the tab bar dims with
 * everything else. Leaving the tab bar bright and tappable while focus is trapped in the menu would
 * be an inconsistency: unreachable by keyboard, one tap away by thumb.
 */

/**
 * Visual order, top to bottom.
 *
 * `QUICK_ADD_ACTIONS` is declared primary-first, which is the dashboard's reading order. A stack that
 * opens *upward* reads outward from the button, so the primary ends up at the bottom. Reversing the
 * array — rather than reversing the flex direction — keeps DOM order equal to visual order, which is
 * what `Tab` follows (WCAG 2.4.3).
 */
const STACKED_ACTIONS = [...QUICK_ADD_ACTIONS].reverse();

/**
 * 84px in the artboard, over a 64px tab bar: a 20px gap.
 *
 * The `env()` term is the part the drawing cannot express — the bar grows by the home-indicator inset
 * on an installed iPhone, and without this the button would slide down onto it.
 */
const LAYER_BOTTOM = "calc(84px + env(safe-area-inset-bottom))";

export function QuickAdd() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  /**
   * Close on navigation.
   *
   * The component is part of the shell, so a client-side route change does not unmount it. Without
   * this, tapping a pill would navigate and leave the menu and its scrim sitting over the new page.
   *
   * `setOpen` rather than the `close` below, deliberately: `close` returns focus to the button, which
   * here would take it away from the page that was just navigated to.
   */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /** Dismissal. Focus goes back to the control that opened the menu, as 7.7 requires. */
  const close = useCallback(() => {
    setOpen(false);
    fabRef.current?.focus();
  }, []);

  /**
   * On open, focus the action *nearest the button* — "Add expense", the last link in the DOM.
   *
   * Not the first, which is the conventional menu behaviour, because here the first link is the one
   * furthest from the thumb and the least likely action ("Pay card"). A stack that opens upward has
   * its emphasis at the bottom, and focus should land where the eye does.
   */
  useEffect(() => {
    if (!open) return;
    const links = layerRef.current?.querySelectorAll<HTMLElement>("a[href]");
    links?.[links.length - 1]?.focus();
  }, [open]);

  /**
   * `Escape` closes; `Tab` cycles inside the layer.
   *
   * A hand-rolled trap over five elements rather than a dependency. One listener on the layer is
   * enough because while the menu is open focus is always inside it — that is what the trap
   * guarantees.
   *
   * No arrow-key handling, and no `role="menu"`. These are navigation links, not commands in an
   * application menu; the ARIA authoring practices are explicit that the menu role is the wrong one
   * for a set of links, and arrow keys are the affordance that role promises.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [
        ...(layerRef.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []),
      ];
      if (focusable.length === 0) return;

      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const last = focusable.length - 1;
      const next = event.shiftKey
        ? current <= 0
          ? last
          : current - 1
        : current === last
          ? 0
          : current + 1;

      event.preventDefault();
      focusable[next]?.focus();
    },
    [close, open],
  );

  return (
    <Box hideFrom="md">
      {open ? (
        /*
         * Pointer dismissal only. `Escape` is the keyboard path and the button itself is the semantic
         * control, so there is nothing here for a screen reader to find — and a scrim announced as a
         * clickable region would be a second, nameless way to close the menu.
         */
        <Box
          aria-hidden="true"
          position="fixed"
          inset="0"
          bg="surface.scrim"
          zIndex="overlay"
          onClick={close}
        />
      ) : null}

      <Flex
        ref={layerRef}
        onKeyDown={handleKeyDown}
        position="fixed"
        right="20px"
        bottom={LAYER_BOTTOM}
        direction="column"
        align="flex-end"
        // 12px between the pills, and 12px between the last pill and the button — one gap, because in
        // the artboard they are the same (pills at 148/204/260/316, all 56px apart, 44px tall).
        gap="12px"
        zIndex={open ? "overlay" : "docked"}
      >
        {open ? (
          <Flex
            id={menuId}
            role="group"
            aria-label="Quick add"
            direction="column"
            align="flex-end"
            gap="12px"
          >
            {STACKED_ACTIONS.map((action) => (
              <Link
                key={action.href}
                asChild
                display="flex"
                alignItems="center"
                justifyContent="flex-end"
                gap="10px"
                textDecoration="none"
                outline="none"
                _hover={{ textDecoration: "none" }}
                /*
                 * The focus signal is applied to the two *parts*, not to the link box.
                 *
                 * A pill is a label and a square with a gap between them, so a shadow on the link's
                 * own border box would be drawn mostly behind the square's resting ink shadow and
                 * read as almost nothing. Promoting both parts to the teal offset is unmissable and
                 * still the design's one focus device (5.3).
                 */
                _focusVisible={{ "& [data-quick-add-part]": { boxShadow: "hardFocus" } }}
              >
                <NextLink href={action.href}>
                  <Text
                    as="span"
                    data-quick-add-part="label"
                    fontFamily="heading"
                    fontSize="subtitle"
                    fontWeight="600"
                    whiteSpace="nowrap"
                    paddingBlock="6px"
                    paddingInline="12px"
                    borderWidth="thin"
                    borderStyle="solid"
                    borderColor="line"
                    bg={action.primary ? "brand.solid" : "surface"}
                    // Ink on the teal fill in both modes; the plain fill follows the colour mode.
                    color={action.primary ? "content.onSwatch" : "content"}
                  >
                    {action.label}
                  </Text>
                  <Flex
                    data-quick-add-part="icon"
                    align="center"
                    justify="center"
                    flexShrink="0"
                    // 44px: the drawn size, and the minimum touch target. They agree here.
                    width="touch"
                    height="touch"
                    borderWidth="thick"
                    borderStyle="solid"
                    borderColor="line"
                    boxShadow="hardSm"
                    bg={action.primary ? "brand.solid" : "surface"}
                    color={action.primary ? "content.onSwatch" : "content"}
                  >
                    <Icon name={action.icon} size="tile" />
                  </Flex>
                </NextLink>
              </Link>
            ))}
          </Flex>
        ) : null}

        <IconButton
          ref={fabRef}
          tone="primary"
          /*
           * A constant name, with `aria-expanded` carrying the state.
           *
           * Swapping the label to "Close quick add" when open would say the same thing twice, and
           * the two can disagree: a screen reader announcing "Close quick add, collapsed" during the
           * frame between them is worse than either alone.
           */
          aria-label="Quick add"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          // 52px, larger than the `sizes.touch` square `IconButton` defaults to: this is the one
          // control on the screen that is meant to be hit without looking.
          minW="fab"
          minH="fab"
          width="fab"
          height="fab"
        >
          <Box
            as="span"
            display="flex"
            // The open state rotates the plus into a dismiss affordance rather than swapping it for a
            // close glyph, so the two states read as one control changing rather than two controls.
            transform={open ? "rotate(45deg)" : "rotate(0deg)"}
            transition="transform 120ms ease-out"
            _motionReduce={{ transition: "none" }}
          >
            <Icon name="plus" size="fab" />
          </Box>
        </IconButton>
      </Flex>
    </Box>
  );
}
