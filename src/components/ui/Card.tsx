import type { ReactNode } from "react";
import { Box, DataList, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

/**
 * Surface primitives.
 *
 * A thin wrapper over Box rather than Chakra's Card, because the project needs the same surface
 * treatment on panels, list containers and detail blocks, and one definition keeps them identical.
 *
 * Restyled in group 28 (section 7.3). Values transcribed from `design/ux/screens/Dashboard-Light.html`,
 * whose `.d-card` and `.d-row` classes are the two shapes almost every screen is built from.
 */

export type CardProps = BoxProps & {
  children: ReactNode;
  /**
   * Marks this card as the **subject of the page** rather than a container on it.
   *
   * The distinction is the whole point of section 7.3 and it is not decorative. A container card
   * is quiet: `1.5px` at 18% ink, no shadow, so a page of six of them reads as one page. A subject
   * card is the page: `2px` of full ink and a 6px offset shadow. Exactly one card per screen should
   * be emphasised — the Add expense form, the Settle up form. Two competing is worse than none.
   */
  emphasis?: boolean;
};

export function Card({ children, emphasis, ...rest }: CardProps) {
  return (
    <Box
      bg="surface"
      borderStyle="solid"
      borderWidth={emphasis ? "thick" : "thin"}
      borderColor={emphasis ? "line" : "line.card"}
      boxShadow={emphasis ? "hardLg" : "none"}
      /*
       * `overflow: hidden` is deliberately **not** set on an emphasised card.
       *
       * It is needed on a container card so a `RowLink`'s hover fill cannot bleed past the border,
       * but on an emphasised card it would clip the offset shadow of any button inside it — and the
       * subject card is a form, which ends in one.
       */
      overflow={emphasis ? "visible" : "hidden"}
      {...rest}
    >
      {children}
    </Box>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Flex
      align="flex-start"
      justify="space-between"
      gap="3"
      borderBottomWidth="hairline"
      borderColor="line.soft"
      paddingInline={{ base: "16px", md: "24px" }}
      paddingBlock={{ base: "13px", md: "16px" }}
    >
      <Box minW="0">
        <Heading
          as="h2"
          fontFamily="heading"
          fontWeight="700"
          fontSize={{ base: "control", md: "cardTitle" }}
          color="content"
          truncate
        >
          {title}
        </Heading>
        {subtitle ? (
          <Text mt="2px" fontSize={{ base: "eyebrow", md: "subtitle" }} color="content.subtle">
            {subtitle}
          </Text>
        ) : null}
      </Box>

      {/* Usually a `CardActionLink` — a mono uppercase link, not a button (7.3). */}
      {action}
    </Flex>
  );
}

export function CardBody({ children, ...rest }: Omit<CardProps, "emphasis">) {
  return (
    <Box
      paddingInline={{ base: "16px", md: "24px" }}
      paddingBlock={{ base: "16px", md: "20px" }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * Vertically divided list of rows inside a Card.
 *
 * The divider is a **1px `line.soft`** hairline, not the card's own border weight: a list of eight
 * rows drawn at card weight reads as eight cards. The separator sits between rows only, so the
 * first row has no rule above it — the handoff's `.d-row:first-of-type { border-top: none }`.
 */
export function CardList({ children }: { children: ReactNode }) {
  return (
    <Stack gap="0" separator={<Box borderTopWidth="hairline" borderColor="line.soft" />}>
      {children}
    </Stack>
  );
}

/**
 * Label/value pair for detail panels.
 *
 * Renders as a real description list so the label/value relationship is exposed to assistive
 * technology, and values use tabular figures so a column of amounts lines up.
 */
export function DetailList({ children }: { children: ReactNode }) {
  return (
    <DataList.Root orientation="horizontal" gap="2.5">
      {children}
    </DataList.Root>
  );
}

export function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <DataList.Item justifyContent="space-between" gap="4">
      {/*
        The label is an eyebrow, which is what makes a detail block read as a ledger rather than a
        settings page. `textStyle` carries the family, size, tracking, uppercasing and colour.
      */}
      <DataList.ItemLabel textStyle="eyebrow" flex="none">
        {label}
      </DataList.ItemLabel>
      <DataList.ItemValue
        textStyle="amount"
        fontSize={{ base: "subtitle", md: "row" }}
        textAlign="end"
        justifyContent="flex-end"
        fontWeight={emphasis ? "600" : "500"}
        color="content"
        flex="none"
      >
        {value}
      </DataList.ItemValue>
    </DataList.Item>
  );
}

/**
 * The five colours a summary tile's top edge may be.
 *
 * Named for the meaning rather than the colour, because the mapping is **semantic, not
 * decorative** (7.3): cash and bank is the brand teal, spending is the caution butter, card debt is
 * the negative coral, available credit is the positive mint. A tile that picks its colour to look
 * nice breaks the association the dashboard depends on.
 */
export const TILE_EDGES = {
  brand: "swatch.teal",
  caution: "swatch.butter",
  negative: "swatch.coral",
  positive: "swatch.mint",
  info: "swatch.sky",
} as const;

export type TileEdge = keyof typeof TILE_EDGES;

export type SummaryTileProps = {
  label: string;
  /** Pre-formatted. Money formatting belongs to `lib/money`, not here. */
  value: ReactNode;
  /** Secondary line: a comparison, a count, or a caveat. */
  hint?: ReactNode;
  /** The 4px coloured top edge. See `TILE_EDGES`. */
  edge: TileEdge;
  /** Corner marker, sized for the tile (15px). */
  icon?: IconName;
  /**
   * Colour of the figure itself.
   *
   * Separate from `edge` because they answer different questions: the edge says *what kind of
   * figure this is*, the tone says *whether this particular number is good news*. Card debt has a
   * coral edge whatever its value; only the figure changes colour.
   *
   * Colour is never the only signal — the label above always says what the number is
   * (docs/06-CODING-PRACTICES.md section 40).
   */
  tone?: "neutral" | "positive" | "negative";
};

const FIGURE_COLOR = {
  neutral: "content",
  positive: "positive",
  negative: "negative",
} as const;

/**
 * One figure, in a card with a coloured top edge.
 *
 * A `Card` variant rather than a separate surface, so it inherits the container treatment and only
 * adds what is different: the edge, the eyebrow-and-icon row, and the mono figure.
 */
export function SummaryTile({
  label,
  value,
  hint,
  edge,
  icon,
  tone = "neutral",
}: SummaryTileProps) {
  return (
    <Card borderTopWidth="tile" borderTopColor={TILE_EDGES[edge]}>
      <Box paddingInline={{ base: "16px", md: "20px" }} paddingBlock={{ base: "14px", md: "18px" }}>
        <Flex align="center" justify="space-between" gap="2">
          <Text textStyle="eyebrow">{label}</Text>
          {icon ? <Icon name={icon} size="tile" color="content.muted" /> : null}
        </Flex>

        <Text
          textStyle="amount"
          fontSize={{ base: "figure", md: "figureLg" }}
          fontWeight="600"
          color={FIGURE_COLOR[tone]}
          mt="8px"
        >
          {value}
        </Text>

        {hint ? (
          <Text fontSize={{ base: "eyebrow", md: "meta" }} color="content.subtle" mt="4px">
            {hint}
          </Text>
        ) : null}
      </Box>
    </Card>
  );
}

/**
 * Four corner brackets, drawn inside a card.
 *
 * One of the four audit motifs (5.4), and the design restricts it to **the sign-in card only** —
 * registration ticks are printer's marks, and putting them on every card would turn a deliberate
 * flourish into wallpaper.
 *
 * Drawn with four absolutely-positioned boxes rather than an SVG so they inherit `line` and flip
 * with the colour mode. Each is a 14px L: two borders on a transparent box, inset 14px.
 */
export function RegistrationTicks({ children, ...rest }: Omit<CardProps, "emphasis">) {
  const arm = "14px";
  const inset = "14px";

  const corners = [
    { top: inset, left: inset, borderTopWidth: "tick", borderLeftWidth: "tick" },
    { top: inset, right: inset, borderTopWidth: "tick", borderRightWidth: "tick" },
    { bottom: inset, left: inset, borderBottomWidth: "tick", borderLeftWidth: "tick" },
    { bottom: inset, right: inset, borderBottomWidth: "tick", borderRightWidth: "tick" },
  ] as const;

  return (
    <Box position="relative" {...rest}>
      {children}

      {corners.map((corner, index) => (
        <Box
          key={index}
          aria-hidden="true"
          position="absolute"
          width={arm}
          height={arm}
          borderStyle="solid"
          borderColor="line"
          // Decoration sitting over the card, so it must never swallow a click meant for a field.
          pointerEvents="none"
          {...corner}
        />
      ))}
    </Box>
  );
}

/**
 * The 24px graph-paper grid (5.5).
 *
 * Only on the unauthenticated layout — the app shell is plain `surface.muted`. Two crossed
 * gradients rather than a background image, so the colour is a token and flips with the mode.
 *
 * `line.grid` is ink at 5%, which is faint by design: it should read as paper texture, not as a
 * table. It is the one place in the app where a decorative background exists at all.
 */
export function GraphPaper({ children, ...rest }: Omit<CardProps, "emphasis">) {
  return (
    <Box
      bg="surface.muted"
      // `{colors.line.grid}` is Chakra's token reference syntax inside a style value — the same
      // mechanism the hard shadows use. It resolves to the CSS variable, so the grid flips with the
      // colour mode without this component knowing either value.
      backgroundImage="linear-gradient({colors.line.grid} 1px, transparent 1px), linear-gradient(90deg, {colors.line.grid} 1px, transparent 1px)"
      backgroundSize="24px 24px"
      {...rest}
    >
      {children}
    </Box>
  );
}
