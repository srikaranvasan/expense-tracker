import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { getCategoryOptions } from "@/features/categories/queries/category-queries";
import { getPersonOptions } from "@/features/people/queries/person-queries";
import { FormSwitcher } from "@/features/transactions/components/FormSwitcher";
import { SharedExpenseForm } from "@/features/transactions/components/SharedExpenseForm";
import { toDateInputValue } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Split an expense" };

export default async function NewSharedExpensePage() {
  const user = await requireUser();

  const [accountOptions, categoryOptions, peopleOptions] = await Promise.all([
    getAccountOptions(user.id),
    getCategoryOptions(user.id),
    getPersonOptions(user.id),
  ]);

  return (
    <Box as="section">
      <PageHeader
        title="Split an expense"
        description="Share a cost with one or more people."
        parent={PARENTS.transactions}
        action={<FormSwitcher current="/transactions/new/shared" />}
      />

      <SharedExpenseForm
        currency={user.currency}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        peopleOptions={peopleOptions}
        todayValue={toDateInputValue(new Date(), user.timezone)}
      />
    </Box>
  );
}
