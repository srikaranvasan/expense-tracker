"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Box, Flex, Link, Text } from "@chakra-ui/react";

const ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/transactions", label: "Activity" },
  { href: "/accounts", label: "Accounts" },
  { href: "/people", label: "People" },
  { href: "/categories", label: "Categories" },
] as const;

/**
 * Primary navigation.
 *
 * Fixed to the bottom on phones because that is where a thumb reaches, and hidden
 * from `md` upwards where the header navigation takes over
 * (docs/04-USER-FLOWS.md section 2).
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
      borderTopWidth="1px"
      borderColor="line"
      bg="surface"
      pb="env(safe-area-inset-bottom)"
      hideFrom="md"
    >
      <Flex maxW="content" mx="auto">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              asChild
              flex="1"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minH="touch"
              px="1"
              py="2"
              textDecoration="none"
              color={active ? "brand.fg" : "content.muted"}
              _hover={{ textDecoration: "none", bg: "surface.sunken" }}
            >
              <NextLink href={item.href} aria-current={active ? "page" : undefined}>
                <Text fontSize="xs" fontWeight="medium">
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
