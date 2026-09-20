"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Box, HStack, SimpleGrid, Stack } from "@chakra-ui/react";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import type { CategoryOption } from "@/features/categories/view-models/category-view-model";
import type { PersonOption } from "@/features/people/view-models/person-view-model";

export type TransactionFiltersProps = {
  accountOptions: readonly AccountOption[];
  categoryOptions: readonly CategoryOption[];
  personOptions: readonly PersonOption[];
};

/**
 * Filter and search controls for the transaction list.
 *
 * Filters live in the URL rather than component state, so a filtered view can be
 * bookmarked, shared, and survives a refresh. Changing a filter resets the cursor,
 * because a page-two cursor is meaningless against a different result set.
 */
export function TransactionFilters({
  accountOptions,
  categoryOptions,
  personOptions,
}: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const current = (key: string) => searchParams.get(key) ?? "";

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === "") next.delete(key);
      else next.set(key, value);
    }

    // A cursor from the previous result set would skip or repeat rows.
    next.delete("cursor");

    router.push(next.toString() ? `/transactions?${next.toString()}` : "/transactions");
  }

  const activeCount = [
    "accountId",
    "categoryId",
    "personId",
    "type",
    "from",
    "to",
    "shared",
  ].filter((key) => searchParams.get(key)).length;

  return (
    <Stack gap="3" mb="4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("search");
          apply({ search: value ? String(value).trim() : "" });
        }}
      >
        <HStack gap="2" align="flex-end">
          <Box flex="1">
            <Field id="search" label="Search">
              <TextInput
                id="search"
                name="search"
                type="search"
                defaultValue={current("search")}
                placeholder="Description"
                autoComplete="off"
              />
            </Field>
          </Box>
          <Button type="submit">Search</Button>
        </HStack>
      </form>

      <Box>
        <Button tone="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Hide filters" : `Filters${activeCount > 0 ? ` (${activeCount})` : ""}`}
        </Button>
      </Box>

      {expanded ? (
        <Stack gap="4" borderWidth="1px" borderColor="line" bg="surface" rounded="card" p="4">
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
            <Field id="filter-type" label="Type">
              <SelectInput
                id="filter-type"
                value={current("type")}
                onChange={(event) => apply({ type: event.target.value })}
              >
                <option value="">All types</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="credit_card_payment">Card payment</option>
                <option value="income">Income</option>
              </SelectInput>
            </Field>

            <Field id="filter-shared" label="Shared">
              <SelectInput
                id="filter-shared"
                value={current("shared")}
                onChange={(event) => apply({ shared: event.target.value })}
              >
                <option value="">All expenses</option>
                <option value="false">Personal only</option>
                <option value="true">Shared only</option>
              </SelectInput>
            </Field>

            <Field id="filter-account" label="Account">
              <SelectInput
                id="filter-account"
                value={current("accountId")}
                onChange={(event) => apply({ accountId: event.target.value })}
              >
                <option value="">All accounts</option>
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="filter-category" label="Category">
              <SelectInput
                id="filter-category"
                value={current("categoryId")}
                onChange={(event) => apply({ categoryId: event.target.value })}
              >
                <option value="">All categories</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="filter-person" label="Person">
              <SelectInput
                id="filter-person"
                value={current("personId")}
                onChange={(event) => apply({ personId: event.target.value })}
              >
                <option value="">Anyone</option>
                {personOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="filter-from" label="From date">
              <TextInput
                id="filter-from"
                type="date"
                value={current("from")}
                onChange={(event) => apply({ from: event.target.value })}
              />
            </Field>

            <Field id="filter-to" label="To date">
              <TextInput
                id="filter-to"
                type="date"
                value={current("to")}
                onChange={(event) => apply({ to: event.target.value })}
              />
            </Field>
          </SimpleGrid>

          {activeCount > 0 || current("search") ? (
            <Box>
              <Button tone="secondary" size="sm" onClick={() => router.push("/transactions")}>
                Clear all filters
              </Button>
            </Box>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
