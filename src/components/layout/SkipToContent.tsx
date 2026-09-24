import { Link } from "@chakra-ui/react";

/**
 * Keyboard skip link.
 *
 * Visually hidden until focused, so keyboard users can jump past the navigation
 * without it occupying space for everyone else
 * (docs/06-CODING-PRACTICES.md section 40).
 */
export function SkipToContent() {
  return (
    <Link
      href="#main"
      position="absolute"
      left="4"
      top="4"
      zIndex="skipLink"
      bg="brand.solid"
      // Ink on teal in both modes.
      color="brand.contrast"
      borderWidth="thick"
      borderStyle="solid"
      borderColor="line"
      paddingInline="16px"
      // 11px, not the 8px this started at: group 40 measured the link at 41px high, three short of
      // `sizes.touch`. It is only reachable by keyboard, so the pointer minimum is arguably moot —
      // but the padding is free and an exception that has to be explained is not.
      paddingBlock="11px"
      fontFamily="heading"
      fontWeight="600"
      fontSize="row"
      textDecoration="none"
      outline="none"
      // Removed from the layout until it receives focus.
      opacity="0"
      pointerEvents="none"
      /*
       * The offset shadow appears with the link rather than being its focus indicator.
       *
       * This is the one control in the app whose *visibility* is the focus state, so the usual
       * "add a teal shadow on focus" would be redundant — the link only exists when focused. The
       * ink shadow is what makes it look like the design's other primary surfaces.
       */
      _focusVisible={{ opacity: 1, pointerEvents: "auto", boxShadow: "hard" }}
    >
      Skip to content
    </Link>
  );
}
