import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { FormSwitcher } from "@/features/transactions/components/FormSwitcher";
import { TransferForm } from "@/features/transactions/components/TransferForm";
import { toDateInputValue } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Transfer money" };

export default async function NewTransferPage() {
  const user = await requireUser();
  const accountOptions = await getAccountOptions(user.id);

  return (
    <Box as="section">
      <PageHeader
        title="Transfer money"
        description="Move money between your own accounts. This is not spending."
        parent={PARENTS.transactions}
        action={<FormSwitcher current="/transactions/new/transfer" />}
      />

      <TransferForm
        currency={user.currency}
        accountOptions={accountOptions}
        // Defaults to today in the user's timezone, not the server's.
        todayValue={toDateInputValue(new Date(), user.timezone)}
      />
    </Box>
  );
}
