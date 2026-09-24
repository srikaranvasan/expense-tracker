import type { ReactNode } from "react";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

/**
 * Inline message block.
 *
 * **This is where errors go** — not a `Stamp` (5.4). A rotated dashed stamp saying something is
 * wrong reads as decoration; a bordered tinted block with an icon and a sentence reads as a
 * message.
 *
 * Restyled in group 28 (section 7.6): square, 1.5px ink border, tinted fill by tone, icon plus an
 * optional title plus a description.
 *
 * ## Why this no longer wraps Chakra's Alert
 *
 * Chakra's `Alert.Root` derives its fill, its border and its indicator colour from `status` and a
 * colour palette. This design's tones use the five pastel fills with a **full-ink border and
 * ink text on every one of them**, which is the opposite of how Chakra colours an alert — the
 * override list was longer than the component. Written out, the four tones are readable together.
 *
 * The accessibility behaviour Chakra provided is reproduced explicitly and is the part that
 * matters: `role="alert"` on the error tone so a validation failure is announced as soon as it
 * appears rather than being noticed only by its colour (docs/06-CODING-PRACTICES.md section 40).
 */

export type AlertTone = "info" | "success" | "warning" | "error";

type ToneStyle = {
  bg: string;
  /**
   * Foreground, and **not** the same token for every tone — see the note below.
   */
  fg: string;
  icon: IconName;
  /** `alert` interrupts; `status` waits for a pause. */
  live: "alert" | "status";
};

/**
 * ## Why `info` has a different foreground from the other three
 *
 * The other three fills are *swatch* fills — mint, butter, coral — and those are bright in **both**
 * colour modes, which is what makes the fixed-ink rule safe on them (`content.onSwatch`, measured
 * 8.5:1 to 13.4:1 either way).
 *
 * `brand.muted` is a **tint**, and a tint is not a swatch: it is pale in light mode (`tealTint`
 * `#DCF3EE`) and *deep* in dark mode (`darkTealTint` `#16302C`). Ink on it measures 14.6:1 light
 * and **1.2:1 dark** — the info alert was unreadable in dark mode. `content.onTint` is the token
 * for exactly this: `inkOnTint` in light, `darkInkSecondary` in dark, 7.8:1 and 8.2:1.
 *
 * Found by rendering the four tones side by side in both modes; no assertion in this group would
 * have caught it, because each token was individually correct.
 */
const TONES: Record<AlertTone, ToneStyle> = {
  /**
   * `shield` is an in-house choice: the handoff draws no informational alert, and the glyph set has
   * nothing neutral-but-noteworthy. A shield reads as "worth knowing, nothing is wrong", which is
   * what an info alert in this app says ("Balances will update once this reaches the server").
   * Flagged for designer review in the group 28 update document.
   */
  info: { bg: "brand.muted", fg: "content.onTint", icon: "shield", live: "status" },
  success: {
    bg: "positive.surface",
    fg: "content.onSwatch",
    icon: "check",
    live: "status",
  },
  warning: {
    bg: "warning.surface",
    fg: "content.onSwatch",
    icon: "alert-triangle",
    live: "status",
  },
  error: {
    bg: "negative.surface",
    fg: "content.onSwatch",
    icon: "alert-triangle",
    live: "alert",
  },
};

export type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  /**
   * A way to act on what the alert just said. Links or buttons.
   *
   * Added in group 47, for the five prerequisite guards. Each of them told the user to go and create
   * an account or a person and **did not link there**
   * (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 5.7) — and because a guard replaces the
   * whole form, `FormActions` never renders, so those screens had no way off them at all.
   *
   * A slot rather than nesting the action in `children`, for the reason `FormActions` is a component
   * rather than a documented pattern: five guards each laying out their own action is five chances to
   * lay it out differently. Here they cannot.
   */
  action?: ReactNode;
};

export function Alert({ tone = "info", title, children, action }: AlertProps) {
  const style = TONES[tone];

  return (
    <Flex
      role={style.live}
      // Only the error tone interrupts. A success message that talks over whatever the user is
      // doing is worse than one they reach a moment later.
      {...(style.live === "status" ? { "aria-live": "polite" } : {})}
      align="flex-start"
      gap="10px"
      bg={style.bg}
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line"
      paddingInline="14px"
      paddingBlock="12px"
    >
      <Box color={style.fg} mt="1px">
        <Icon name={style.icon} size="inline" />
      </Box>

      <Stack gap="2px" color={style.fg} minW="0">
        {title ? (
          <Text fontFamily="heading" fontWeight="700" fontSize="row">
            {title}
          </Text>
        ) : null}
        <Text fontSize={{ base: "subtitle", md: "row" }}>{children}</Text>

        {/*
          Below the prose, inside the text stack so it aligns with the description rather than with the
          icon. `mt` rather than the stack's `gap`, which is 2px and tuned for title-above-description.
        */}
        {action ? <Box mt="10px">{action}</Box> : null}
      </Stack>
    </Flex>
  );
}
