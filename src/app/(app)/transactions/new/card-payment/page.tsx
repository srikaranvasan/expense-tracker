import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { CardPaymentForm } from "@/features/transactions/components/CardPaymentForm";
import { FormSwitcher } from "@/features/transactions/components/FormSwitcher";
import { toDateInputValue } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Pay credit card" };

/**
 * `?cardId=` pre-selects a card, so arriving from a card's own page does not make the
 * user pick it again.
 */
export default async function NewCardPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [accountOptions, params] = await Promise.all([getAccountOptions(user.id), searchParams]);

  const requested = params.cardId;
  const cardId = typeof requested === "string" ? requested : null;

  return (
    <Box as="section">
      <PageHeader
        title="Pay credit card"
        description="Lower what you owe on a card. This is not spending."
        parent={PARENTS.transactions}
        action={<FormSwitcher current="/transactions/new/card-payment" />}
      />

      <CardPaymentForm
        currency={user.currency}
        accountOptions={accountOptions}
        // Defaults to today in the user's timezone, not the server's.
        todayValue={toDateInputValue(new Date(), user.timezone)}
        defaultCardId={cardId}
      />
    </Box>
  );
}
