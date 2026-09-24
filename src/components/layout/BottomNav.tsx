"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import { NAV_ITEMS, isActiveNavItem } from "./NavItems";

/**
 * Primary navigation on phones.
 *
 * Fixed to the bottom because that is where a thumb reaches, and hidden from `md` upwards where
 * `HeaderNav` takes over (docs/04-USER-FLOWS.md section 2). Both read the same `NAV_ITEMS`, so the
 * order, the labels and the glyphs cannot drift apart.
 *
 * Icon over label, with the same 3px teal underline the desktop nav uses for the active item — one
 * active-state idiom at both widths rather than two.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <Box
      as="nav"
      aria-label="Main"
      position="fixed"
      insetInline="0"
      bottom="0"
      zIndex="sticky"
      // 2px full ink, matching the header's bottom rule: these are the two edges of the app frame.
      borderTopWidth="thick"
      borderColor="line"
      bg="surface"
      // Respects the iPhone home indicator. The padding is *outside* the 64px row, so the tabs stay
      // 64px tall and the bar grows instead.
      pb="env(safe-area-inset-bottom)"
      hideFrom="md"
    >
      <Flex
        maxW="content"
        mx="auto"
        align="stretch"
        justify="space-around"
        height="64px"
        paddingInline="6px"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActiveNavItem(pathname, item.href);

          return (
            <Link
              key={item.href}
              asChild
              flex="1"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap="4px"
              minH="touch"
              /*
               * The underline is the tab's bottom border, so it sits on the bar's inner bottom edge.
               * Transparent when inactive rather than absent, so the icon-and-label stack does not
               * shift by 3px as the active tab changes.
               */
              borderBottomWidth="accent"
              borderBottomStyle="solid"
              borderBottomColor={active ? "brand.solid" : "transparent"}
              color={active ? "content" : "content.subtle"}
              textDecoration="none"
              outline="none"
              _hover={{ textDecoration: "none", color: "content" }}
              // Inset so the focus shadow is not clipped by the bar's own edges.
              _focusVisible={{ boxShadow: "hardFocus", position: "relative", zIndex: "1" }}
            >
              <NextLink href={item.href} aria-current={active ? "page" : undefined}>
                <Icon name={item.icon} size="tab" />
                <Text
                  fontFamily="heading"
                  fontSize="badge"
                  fontWeight={active ? "700" : "600"}
                  lineHeight="1"
                >
                  {item.label}
                </Text>
              </NextLink>
            </Link>
          );
        })}
      </Flex>
    </Box>
  );
}
