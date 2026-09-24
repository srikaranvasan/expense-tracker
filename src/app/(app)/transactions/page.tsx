import type { Metadata } from "next";
import { Box, HStack, Text } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { PAGINATION } from "@/config/constants";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { getCategoryOptions } from "@/features/categories/queries/category-queries";
import { getPersonOptions } from "@/features/people/queries/person-queries";
import { TransactionFilters } from "@/features/transactions/components/TransactionFilters";
import { TransactionHistory } from "@/features/transactions/components/TransactionHistory";
import { getTransactionListView } from "@/features/transactions/queries/expense-queries";
import { listExpensesQuerySchema } from "@/features/transactions/schemas/expense-schemas";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Activity" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // The page validates its own query string with the same schema as the API, so a
  // hand-edited URL cannot reach the repository unchecked.
  const parsed = listExpensesQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : { limit: PAGINATION.defaultLimit };

  const [view, accountOptions, categoryOptions, personOptions] = await Promise.all([
    getTransactionListView(user.id, user.timezone, {
      limit: query.limit,
      ...("cursor" in query && query.cursor ? { cursor: query.cursor } : {}),
      ...("type" in query && query.type ? { types: query.type } : {}),
      ...("accountId" in query && query.accountId ? { accountId: query.accountId } : {}),
      ...("categoryId" in query && query.categoryId ? { categoryId: query.categoryId } : {}),
      ...("personId" in query && query.personId ? { personId: query.personId } : {}),
      ...("from" in query && query.from ? { from: query.from } : {}),
      ...("to" in query && query.to ? { to: query.to } : {}),
      ...("search" in query && query.search ? { search: query.search } : {}),
      ...("shared" in query && query.shared !== undefined ? { shared: query.shared } : {}),
    }),
    getAccountOptions(user.id),
    getCategoryOptions(user.id),
    getPersonOptions(user.id),
  ]);

  const isFiltered = Object.keys(params).some((key) => key !== "cursor" && params[key]);

  return (
    <Box as="section">
      <PageHeader
        title="Activity"
        description="Everything you have recorded."
        action={
          <HStack gap="2">
            <AppLink href="/transactions/new/transfer" textDecoration="none">
              <Button size="sm" tone="secondary">
                Transfer
              </Button>
            </AppLink>
            <AppLink href="/transactions/new/shared" textDecoration="none">
              <Button size="sm" tone="secondary">
                Split
              </Button>
            </AppLink>
            <AppLink href="/transactions/new" textDecoration="none">
              <Button size="sm">Add expense</Button>
            </AppLink>
          </HStack>
        }
      />

      <TransactionFilters
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        personOptions={personOptions}
      />

      {!parsed.success ? (
        <Text mb="4" fontSize="sm" color="negative">
          Some filters in the address bar were not valid and have been ignored.
        </Text>
      ) : null}

      {view.items.length === 0 ? (
        <EmptyState
          title={isFiltered ? "Nothing matches those filters" : "No transactions yet"}
          description={
            isFiltered
              ? "Try widening the date range or clearing a filter."
              : "Record your first expense to start tracking."
          }
          action={
            isFiltered ? (
              <AppLink href="/transactions" textDecoration="none">
                <Button tone="secondary">Clear filters</Button>
              </AppLink>
            ) : (
              <AppLink href="/transactions/new" textDecoration="none">
                <Button>Add your first expense</Button>
              </AppLink>
            )
          }
        />
      ) : (
        <TransactionHistory
          initialItems={view.items}
          initialCursor={view.nextCursor}
          initialHasMore={view.hasMore}
          accountNames={view.accountNames}
          categoryNames={view.categoryNames}
          personNames={view.personNames}
          categoryIcons={view.categoryIcons}
        />
      )}
    </Box>
  );
}
