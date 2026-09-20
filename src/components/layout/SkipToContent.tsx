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
      color="brand.contrast"
      px="4"
      py="2"
      rounded="md"
      fontWeight="medium"
      // Removed from the layout until it receives focus.
      opacity="0"
      pointerEvents="none"
      _focusVisible={{ opacity: 1, pointerEvents: "auto" }}
    >
      Skip to content
    </Link>
  );
}
