import type { ReactNode } from "react";
import NextLink from "next/link";
import { Link } from "@chakra-ui/react";
import type { LinkProps } from "@chakra-ui/react";

/**
 * Chakra-styled link that navigates with the Next.js router.
 *
 * `asChild` hands the rendering to `next/link`, so client-side navigation and
 * prefetching still work while the styling comes from the theme.
 */
export type AppLinkProps = Omit<LinkProps, "href"> & {
  href: string;
  children: ReactNode;
};

export function AppLink({ href, children, ...rest }: AppLinkProps) {
  return (
    <Link asChild colorPalette="brand" {...rest}>
      <NextLink href={href}>{children}</NextLink>
    </Link>
  );
}

/**
 * Full-width row that behaves as a link.
 *
 * Used by list rows: the whole row is the target, which is far easier to hit on a
 * phone than a small text link inside it.
 */
export function RowLink({ href, children, ...rest }: AppLinkProps) {
  return (
    <Link
      asChild
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap="4"
      minH="touch"
      p="4"
      textDecoration="none"
      color="content"
      _hover={{ bg: "surface.sunken", textDecoration: "none" }}
      {...rest}
    >
      <NextLink href={href}>{children}</NextLink>
    </Link>
  );
}
