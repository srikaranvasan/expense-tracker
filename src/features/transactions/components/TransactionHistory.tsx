"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { isApiError } from "@/types/api";
import type { ApiResponseBody } from "@/types/api";
import { groupByDay } from "../view-models/expense-view-model";
import type { TransactionListItem } from "../view-models/expense-view-model";
import { TransactionList } from "./TransactionList";

export type TransactionHistoryProps = {
  /** First page, rendered on the server so the list is present without JavaScript. */
  initialItems: readonly TransactionListItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  personNames: Record<string, string>;
};

type ListPayload = {
  items: TransactionListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  personNames: Record<string, string>;
};

/**
 * The transaction history list with incremental loading.
 *
 * The first page comes from the server, so the list renders and is readable before any
 * JavaScript runs. "Load older" then **appends** pages in place rather than navigating,
 * which is the difference that matters: the previous approach replaced the visible page,
 * so scrolling back through a month meant losing everything already read.
 *
 * Paging is by cursor, never offset. Recording an expense mid-scroll shifts every row
 * by one under an offset, which would silently skip or repeat a transaction
 * (docs/06-CODING-PRACTICES.md section 43).
 *
 * Loading is user-triggered rather than on-scroll. An automatic fetch on a long list
 * fights the user's scroll position and makes the footer unreachable; an explicit button
 * is also operable from the keyboard.
 */
export function TransactionHistory({
  initialItems,
  initialCursor,
  initialHasMore,
  accountNames,
  categoryNames,
  personNames,
}: TransactionHistoryProps) {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<TransactionListItem[]>([...initialItems]);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [names, setNames] = useState({ accountNames, categoryNames, personNames });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;

    setLoading(true);
    setError(null);

    try {
      // The same filters the server used, plus the cursor. `cursor` is dropped from the
      // copied params first so a stale one cannot leak in from the address bar.
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      params.set("cursor", cursor);

      const response = await fetch(`/api/expenses?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      const body = (await response.json()) as ApiResponseBody<ListPayload>;

      if (!response.ok || isApiError(body)) {
        setError(
          isApiError(body) ? body.error.message : "Could not load more transactions right now.",
        );
        return;
      }

      // A row could already be present if a write landed between pages, and rendering
      // it twice would look like a duplicate expense - the one thing this app must
      // never appear to do.
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...body.data.items.filter((item) => !seen.has(item.id))];
      });

      // Merged, not replaced: the new page only carries names for the accounts,
      // categories and people its own rows reference.
      setNames((current) => ({
        accountNames: { ...current.accountNames, ...body.data.accountNames },
        categoryNames: { ...current.categoryNames, ...body.data.categoryNames },
        personNames: { ...current.personNames, ...body.data.personNames },
      }));

      setCursor(body.data.nextCursor);
      setHasMore(body.data.hasMore);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, searchParams]);

  const groups = groupByDay(items);

  return (
    <Stack gap="4">
      <TransactionList
        groups={groups}
        accountNames={names.accountNames}
        categoryNames={names.categoryNames}
        personNames={names.personNames}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {hasMore ? (
        <Box>
          <Button tone="secondary" fullWidth loading={loading} onClick={() => void loadMore()}>
            Load older
          </Button>
        </Box>
      ) : (
        <Text textAlign="center" fontSize="xs" color="content.muted">
          That is everything{items.length > 0 ? ` — ${items.length} shown` : ""}.
        </Text>
      )}
    </Stack>
  );
}
