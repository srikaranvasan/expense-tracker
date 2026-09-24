import { Flex, HStack, Text } from "@chakra-ui/react";
import { publicConfig } from "@/config/env";
import { Avatar } from "@/components/ui/Avatar";
import { ColorModeToggle } from "@/components/theme/ColorModeToggle";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { DiamondMark } from "./DiamondMark";
import { HeaderNav } from "./HeaderNav";

export type AppHeaderProps = {
  user: { name: string; email: string };
};

/**
 * The application header.
 *
 * ## One component, two headers
 *
 * Section 7.5 describes them separately — 58px with navigation on desktop, 50px and slim on mobile —
 * and they are one tree here, with responsive values for the height, the mark and the gutters. The
 * alternative (two components behind `hideBelow`/`hideFrom`) would duplicate the user badge, the
 * colour-mode toggle and the sign-out button, and duplicated chrome is how the two widths drift
 * apart.
 *
 * ## Why the mobile header is slim, and what it fixes
 *
 * The **crushed mobile title** bug (9.2): at 402px, a header carrying more than one wide action
 * squeezed the page title below it to one word per line. Three things fix it and all three are load-
 * bearing:
 *
 * 1. **No wide text button.** Sign-out and the colour-mode toggle are both icon-only squares.
 * 2. **No user name below `md`.** The avatar carries identity; the name is redundant when the
 *    initials are right there and there is no room for it.
 * 3. **No navigation in the header on mobile** — `BottomNav` has it.
 *
 * `PageHeader` stacking its title and actions below 768px is the other half of the fix.
 */
export function AppHeader({ user }: AppHeaderProps) {
  return (
    <Flex
      // 50px mobile, 58px desktop, as drawn.
      minH={{ base: "50px", md: "58px" }}
      align="center"
      justify="space-between"
      gap="3"
      maxW="content"
      mx="auto"
      w="full"
      // 16px mobile, 32px desktop — the handoff's header gutters, which are tighter than the page's
      // own 40px because the header runs edge to edge.
      paddingInline={{ base: "16px", md: "32px" }}
    >
      {/*
        `alignSelf="stretch"` as well as `align="stretch"`.
        
        The outer `Flex` centres its children, so without `alignSelf` this group would be only as tall
        as its text and `HeaderNav`'s "full height" links would stretch to *that* — leaving the active
        underline floating 19px above the header's bottom rule. Measured before and after; see section 5
        of the group 30 update document.
      */}
      <HStack gap={{ base: "8px", md: "44px" }} align="stretch" alignSelf="stretch" minW="0">
        <HStack gap={{ base: "8px", md: "9px" }} minW="0">
          {/*
            16px at both widths. The handoff draws 14px with a 1.5px border on mobile; a 2px
            difference on a 16px shape is imperceptible, and one size avoids either a responsive
            variant on `DiamondMark` or two marks behind media queries.
          */}
          <DiamondMark size="lg" />
          <Text
            fontFamily="heading"
            fontWeight="700"
            fontSize={{ base: "row", md: "md" }}
            color="content"
            truncate
          >
            {publicConfig.appName}
          </Text>
        </HStack>

        <HeaderNav />
      </HStack>

      <HStack gap={{ base: "10px", md: "12px" }} flexShrink="0">
        {/*
          Teal, because this is the signed-in user. `aria-hidden` inside `Avatar`, so the name below
          is what a screen reader reads on desktop — and on mobile the email `title` on nothing means
          identity is carried by the sign-out label plus the page itself.
        */}
        <Avatar name={user.name} relation="self" size="sm" />

        <Text fontSize="row" color="content.muted" hideBelow="md" title={user.email} truncate>
          {user.name}
        </Text>

        {/* Both icon-only, both at both widths. See the note above about the crushed title. */}
        <ColorModeToggle />
        <SignOutButton />
      </HStack>
    </Flex>
  );
}
