"use client";

import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";
import { CATEGORY_ICON_CHOICES } from "../icon-map";

/**
 * Picks the glyph a category is drawn with.
 *
 * Group 21 decided this (2.3): **no `Category.color` field, but do add an icon picker.** The colour is
 * derived from the category's id by a hash, so it needs no input and cannot be got wrong; the glyph is
 * the one visual choice a user actually has an opinion about, and `Category.icon` already existed as
 * free text to hold it.
 *
 * ## Why it offers a subset, not all 43
 *
 * The registry holds navigation glyphs (`home`, `accounts`), control glyphs (`chevron-down`, `edit`)
 * and state glyphs (`offline`, `check`). Offering `chevron-down` as a category icon would be offering
 * nonsense. The list below is the set that can plausibly *mean* a kind of spending, in the order they
 * appear on the categories screen.
 *
 * ## Why radios and not a listbox
 *
 * It is a single choice from a small fixed set, which is what a radio group is. A native
 * `role="radiogroup"` gets arrow-key navigation, a single tab stop and a group name for free — a custom
 * grid of buttons would have to reimplement all three and would get the roving tabindex wrong.
 */

export type CategoryIconPickerProps = {
  /** Field id, so the label points at the group. */
  id: string;
  /** The category's current icon, which may be absent or a name this set does not offer. */
  defaultValue?: string | null;
};

export function CategoryIconPicker({ id, defaultValue }: CategoryIconPickerProps) {
  /*
   * An icon the picker does not offer — a name from before this picker existed, or one that was
   * renamed in the registry — is kept as the stored value but shown as unselected. Silently rewriting
   * it to the fallback on first edit would change data the user never touched.
   */
  const initial = CATEGORY_ICON_CHOICES.find((name) => name === defaultValue) ?? null;
  const [selected, setSelected] = useState<IconName | null>(initial);

  return (
    <Box>
      {/*
        `aria-labelledby`, not a `<label htmlFor>`: a label may only point at a form control, and the
        group is a `div`. This gives the radiogroup the same visible heading and a correct accessible
        name.
      */}
      <Text id={`${id}-label`} textStyle="eyebrow" display="block" mb="8px">
        Icon
      </Text>

      {/*
        A real radio group. One tab stop for the whole set, arrow keys between options, and a name the
        group is announced with — none of which a grid of buttons would give without reimplementing it.
      */}
      {/*
        A wrapping flex row of fixed 44px tiles, not a grid.

        A `SimpleGrid` stretched each tile to its column — measured 130×44 at 1440px — which turned a
        row of square swatches into a row of wide rectangles that no longer previewed anything. Packing
        them and letting them wrap keeps every tile square at every width.
      */}
      <Flex id={id} role="radiogroup" aria-labelledby={`${id}-label`} wrap="wrap" gap="8px">
        {CATEGORY_ICON_CHOICES.map((name) => {
          const isSelected = selected === name;

          return (
            <Box key={name} as="label" cursor="pointer">
              {/*
                The input is the control, visually hidden rather than removed: `display: none` takes it
                out of the accessibility tree and off the keyboard, which is the usual way this pattern
                is broken.
              */}
              <Box
                asChild
                position="absolute"
                width="1px"
                height="1px"
                opacity="0"
                pointerEvents="none"
              >
                <input
                  type="radio"
                  name="icon"
                  value={name}
                  checked={isSelected}
                  onChange={() => setSelected(name)}
                  /*
                   * `peer` is what lets the tile below react to this input's focus.
                   *
                   * Chakra resolves `_peerFocusVisible` to
                   * `.peer:is(:focus-visible, [data-focus-visible]) ~ &`, a sibling selector — which
                   * is the only way round the problem that the focused element here is invisible and
                   * the visible element cannot be focused.
                   */
                  className="peer"
                />
              </Box>

              <Flex
                align="center"
                justify="center"
                width="touch"
                height="touch"
                borderWidth="thick"
                borderStyle="solid"
                /*
                  Selection is the design's own emphasis language: full ink border plus the offset
                  shadow, against the soft outline and no shadow of an unselected tile. Not a colour
                  change — the swatch colour is derived from the id, so tinting the tile here would
                  promise a colour the category will not have.
                */
                borderColor={isSelected ? "line" : "line.card"}
                boxShadow={isSelected ? "hardSm" : "none"}
                bg={isSelected ? "brand.muted" : "surface"}
                color={isSelected ? "content.onTint" : "content.muted"}
                /*
                  Focus, and the reason the `peer` class exists on the input.

                  Group 40 found this group had **no focus indicator at all**: the control that receives
                  focus is the visually hidden radio, the tile that a user can see is a sibling `div`,
                  and nothing connected the two. Tabbing into the picker changed nothing on screen.

                  The teal shadow is the app's focus device everywhere else, and it stays distinct from
                  selection because selection is an *ink* shadow: a focused unselected tile gets the ink
                  border and a teal shadow, and a focused selected tile swaps its ink shadow for the teal
                  one. Neither state can be mistaken for the other.
                */
                _peerFocusVisible={{ boxShadow: "hardFocus", borderColor: "line" }}
              >
                <Icon name={name} size="swatchLg" />
              </Flex>
            </Box>
          );
        })}
      </Flex>

      <Text fontSize="meta" color="content.subtle" mt="8px">
        The colour is chosen for you and stays the same for this category.
      </Text>
    </Box>
  );
}
