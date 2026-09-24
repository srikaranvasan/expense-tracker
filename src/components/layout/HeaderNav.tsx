"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Link } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import { NAV_ITEMS, isActiveNavItem } from "./NavItems";

/**
 * Desktop navigation, inside the header.
 *
 * A Client Component because it needs `usePathname()` to know which item is current. It is the only
 * client-side part of the header, which is why it is a separate file: the header itself stays a
 * Server Component.
 *
 * Hidden below 768px, where `BottomNav` takes over.
 */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <Flex
      as="nav"
      aria-label="Primary"
      align="stretch"
      gap="30px"
      hideBelow="md"
      alignSelf="stretch"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActiveNavItem(pathname, item.href);

        return (
          <Link
            key={item.href}
            asChild
            display="flex"
            alignItems="center"
            gap="6px"
            /*
             * Full height, with the underline as its bottom border.
             *
             * The handoff achieves the flush underline with `padding-bottom: 24px; margin-bottom:
             * -24px`, which works because its link has a known height in a known 58px row. Stretching
             * the link to the header's full height and putting the border on it is the same result
             * without either number: the underline lands on the header's inner bottom edge whatever
             * the header's height, and there is no negative margin to keep in step with a padding.
             */
            alignSelf="stretch"
            borderBottomWidth="accent"
            borderBottomStyle="solid"
            // Transparent rather than absent, so an inactive item reserves the same 3px and the
            // labels do not shift by three pixels when navigation changes the active item.
            borderBottomColor={active ? "brand.solid" : "transparent"}
            fontFamily="heading"
            fontSize="row"
            fontWeight={active ? "700" : "500"}
            color={active ? "content" : "content.muted"}
            textDecoration="none"
            whiteSpace="nowrap"
            outline="none"
            _hover={{ color: "content", textDecoration: "none" }}
            _focusVisible={{ boxShadow: "hardFocus" }}
          >
            <NextLink href={item.href} aria-current={active ? "page" : undefined}>
              <Icon name={item.icon} size="inline" />
              {item.label}
            </NextLink>
          </Link>
        );
      })}
    </Flex>
  );
}
