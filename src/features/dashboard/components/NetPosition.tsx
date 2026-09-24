import { Flex, HStack, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";

export type NetPositionProps = {
  /** Already formatted. The dashboard performs no arithmetic of its own. */
  formattedAmount: string;
};

/**
 * Cash and bank minus what is owed on cards, on the accent tint.
 *
 * The one figure on the dashboard that is a *difference* rather than a total, which is why the
 * handoff gives it a band of its own rather than a fifth tile: it is only meaningful once a card
 * exists to subtract, and the label has to say what was subtracted from what.
 *
 * ## The "computed" marker is a product rule, not a badge
 *
 * `equals` plus the word "computed", in teal, at the right-hand end. Section 9.1 forbids anything
 * implying a stored or cached total — no "live" dot, no "last updated", no refresh affordance. This
 * says the opposite of all three: the number is the result of an equation, recalculated during this
 * render. It is the same claim the page header's `AS OF` eyebrow makes about every other figure.
 *
 * It is hidden from assistive technology. "Computed" describes how the figure was produced, not what
 * it is, and a screen reader announcing "equals computed" after the amount adds nothing a sighted
 * user gets — the label above already reads "Net position — cash and bank minus what you owe on
 * cards", which *is* the equation in words.
 */
export function NetPosition({ formattedAmount }: NetPositionProps) {
  return (
    <Flex
      // `brand.muted` is the accent tint, so its foreground must be `content.onTint`: the tint
      // inverts lightness between colour modes and ink on the dark counterpart measures 1.2:1.
      bg="brand.muted"
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line"
      paddingInline={{ base: "18px", md: "26px" }}
      paddingBlock={{ base: "18px", md: "22px" }}
      align={{ base: "start", md: "center" }}
      justify="space-between"
      direction={{ base: "column", md: "row" }}
      gap={{ base: "12px", md: "4" }}
    >
      <Flex direction="column" minW="0">
        <Text textStyle="eyebrow" color="content.onTint">
          Net position — cash and bank minus what you owe on cards
        </Text>
        <Text
          textStyle="amount"
          // 28px, the largest figure on the page: this is the answer the other tiles build up to.
          fontSize={{ base: "figureLg", md: "hero" }}
          fontWeight="600"
          color="content"
          mt="8px"
        >
          {formattedAmount}
        </Text>
      </Flex>

      <HStack gap="6px" flexShrink="0" aria-hidden="true">
        <Icon name="equals" size="inline" color="brand.fg" />
        <Text textStyle="eyebrow" color="brand.fg">
          computed
        </Text>
      </HStack>
    </Flex>
  );
}
