import type { ReactNode } from "react";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import { Card, CardBody } from "@/components/ui/Card";
import { ReferenceCode } from "@/components/ui/ReferenceCode";

/**
 * The two-column form page: the form card, and a side rail beside it.
 *
 * Section 8 and `design/ux/screens/AddExpense-Light.html`. The form is the subject of the page, so it
 * is the emphasised card — 2px ink and a 6px offset shadow — and the rail is two quiet panels that
 * explain rather than ask.
 *
 * ## The rail comes **after** the form on a phone
 *
 * Section 8 is explicit, and it matters more than it looks. The rail holds explanation, not input; a
 * user who opened this screen to record a ₹220 coffee should reach the amount field without scrolling
 * past a paragraph about why the screen is laid out the way it is. Source order carries it, so the
 * same order is what a screen reader and the keyboard get — no `order` property, which would have
 * moved the pixels and left the tab sequence behind.
 *
 * ## Why the card lives here and not at the call site
 *
 * Four transaction forms, plus the account and person forms later, all want the same emphasised card
 * at the same padding. Putting it in the layout means none of them can forget the shadow, and the one
 * place to change if the design does is here.
 */

export type FormLayoutProps = {
  /** The form itself. Wrapped in the emphasised card. */
  children: ReactNode;
  /**
   * The side rail's contents — normally a `TintPanel` and a `ReferenceBox`.
   *
   * Optional: the edit screens have nothing to explain that the create screens have not already said,
   * and a rail holding one empty panel is worse than no rail.
   */
  rail?: ReactNode;
};

export function FormLayout({ children, rail }: FormLayoutProps) {
  return (
    <Flex
      // 28px below the page header on desktop, 22px on a phone (section 8).
      mt={{ base: "22px", md: "28px" }}
      gap={{ base: "16px", md: "24px" }}
      direction={{ base: "column", md: "row" }}
      align="stretch"
    >
      {/*
        `flex: 1.4` against the rail's `1`, as drawn. `minW="0"` because the card holds a grid of
        selects whose option text can be long — without it a long account name widens the column
        instead of truncating inside it.
      */}
      <Box flex="1.4" minW="0">
        <Card emphasis boxShadow="hardLg">
          <CardBody
            paddingInline={{ base: "20px", md: "40px" }}
            paddingBlock={{ base: "24px", md: "36px" }}
          >
            {children}
          </CardBody>
        </Card>
      </Box>

      {rail ? (
        <Stack flex="1" minW="0" gap="16px">
          {rail}
        </Stack>
      ) : null}
    </Flex>
  );
}

export type TintPanelProps = {
  /**
   * The mono label above the body, with the `equals` marker beside it.
   *
   * Omit it for a bare note — which is how the transaction detail pages use this panel, where the
   * surrounding card already says what is being explained.
   */
  eyebrow?: string;
  children: ReactNode;
};

/**
 * An explanatory panel on the accent tint.
 *
 * The "why this matters" device from section 8, and the note the transfer and card-payment detail
 * pages use to say that a record is **not spending**. One component for both, because they are the
 * same panel and drifting apart would mean two tints.
 *
 * `content.onTint` throughout, never ink: `brand.muted` inverts lightness between colour modes
 * (`tealTint` light, `darkTealTint` dark), so ink on it measures 14.6:1 in one mode and 1.2:1 in the
 * other. This is the mistake group 28 wrote down as "a tint is not a swatch".
 */
export function TintPanel({ eyebrow, children }: TintPanelProps) {
  return (
    <Box
      bg="brand.muted"
      borderWidth="thin"
      borderStyle="solid"
      // Full ink, as drawn — this panel is bordered like a control, not like a container card.
      borderColor="line"
      paddingInline={{ base: "16px", md: "22px" }}
      paddingBlock={{ base: "16px", md: "22px" }}
    >
      {eyebrow ? (
        <HStack gap="8px" mb="10px">
          {/*
            `equals`, the same marker the dashboard's net-position band carries. Decorative: the label
            beside it says what this is.
          */}
          <Icon name="equals" size="inline" color="brand.fg" aria-hidden />
          <Text textStyle="eyebrow" color="brand.fg">
            {eyebrow}
          </Text>
        </HStack>
      ) : null}

      <Text fontSize="subtitle" color="content.onTint" lineHeight="1.6">
        {children}
      </Text>
    </Box>
  );
}

export type ReferenceBoxProps = {
  /** The formatted code, from a view model's `referenceCode` or `referenceCodeFor`. */
  code: string | null | undefined;
  /** Marks a record that has a reference but is not on the server yet. */
  draft?: boolean;
  /** One sentence explaining what the code is for. */
  hint: string;
};

/**
 * The rail's reference panel — `#A3F09 · draft` with a line explaining what it is.
 *
 * A plain surface rather than the tint, as drawn: the tint is for explanation, and this is a fact
 * about the record being written. It is the only place in the app that tells a user what the code
 * *means*, which is why the hint is required rather than optional.
 */
export function ReferenceBox({ code, draft, hint }: ReferenceBoxProps) {
  if (!code) return null;

  return (
    <Box
      bg="surface"
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line.card"
      paddingInline={{ base: "16px", md: "22px" }}
      paddingBlock={{ base: "16px", md: "22px" }}
    >
      <Text textStyle="eyebrow">Reference</Text>
      {/*
        Larger than the code is drawn anywhere else — 14px against the activity row's 11px — because
        here it is the subject of the panel rather than a marker on a row.
      */}
      <ReferenceCode code={code} draft={draft} fontSize="row" display="block" mt="8px" />
      <Text fontSize="meta" color="content.subtle" mt="6px">
        {hint}
      </Text>
    </Box>
  );
}
