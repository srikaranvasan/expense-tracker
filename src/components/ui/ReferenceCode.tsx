import { Text } from "@chakra-ui/react";
import type { TextProps } from "@chakra-ui/react";

/**
 * A record's reference code — `#A3F09`, or `#A3F09 · draft` before it reaches the server.
 *
 * Takes the **finished string**, not an id. Formatting happens in the view models alongside
 * `formattedAmount` and `dateLabel`, which is how everything else in this app works — `Amount` takes
 * `formattedAmount`, not a `Money`. The format itself and the choice of which id it derives from live
 * in `lib/utils/reference-code.ts`, which explains both.
 *
 * (Group 29 shipped this with a `recordId` prop that derived the code itself. Group 32 changed it:
 * once the view models carry `referenceCode`, a component that derives its own would be a second
 * answer to the same question, and the two could disagree the day the derivation changes.)
 */

export type ReferenceCodeProps = Omit<TextProps, "children"> & {
  /**
   * The formatted code, from a view model's `referenceCode`.
   *
   * Nullable, and renders nothing when null: a record with no reference should show no chip rather
   * than a placeholder implying the code exists and is merely unknown.
   */
  code: string | null | undefined;
  /**
   * Where it is drawn.
   *
   * `default` is `content.meta` on a plain surface. **`onTint` is required inside a tinted panel** —
   * the reference box in a form's side rail, `ErrorState`'s digest box — because `content.meta`
   * measures 4.2:1 on `tealTint`, just under AA, and would be far worse on the dark counterpart
   * (`brand.muted` inverts between modes; see `components/feedback/Alert.tsx`).
   */
  tone?: "default" | "onTint";
  /**
   * The record has a reference but is not on the server yet.
   *
   * Drawn in `AddExpense-Light.html` as `TXN-08232 · draft`. Two cases reach it: a create form showing
   * the code of the record it is about to write, and a record queued offline.
   *
   * The word is rendered as **text**, not as a colour or a style change, so it survives for a
   * screen-reader user and for anyone who cannot distinguish the two weights (9.1).
   */
  draft?: boolean;
};

/** Separator between the code and the draft marker, matching the handoff's middot. */
const DRAFT_SUFFIX = " · draft";

export function ReferenceCode({
  code,
  tone = "default",
  draft = false,
  ...rest
}: ReferenceCodeProps) {
  if (!code) return null;

  return (
    <Text
      as="span"
      /*
       * Mono, because it is a code: a run of hex read out character by character needs the
       * unambiguous letterforms and the fixed advance width. It is also the rule that every number,
       * date and code in this app is mono (9.1).
       */
      textStyle="amount"
      fontSize="eyebrow"
      fontWeight="500"
      color={tone === "onTint" ? "content.onTint" : "content.meta"}
      whiteSpace="nowrap"
      {...rest}
    >
      {draft ? `${code}${DRAFT_SUFFIX}` : code}
    </Text>
  );
}
