import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { FormSwitcher } from "@/features/transactions/components/FormSwitcher";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { getCategoryOptions } from "@/features/categories/queries/category-queries";
import { ExpenseForm } from "@/features/transactions/components/ExpenseForm";
import { toDateInputValue } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage() {
  const user = await requireUser();

  const [accountOptions, categoryOptions] = await Promise.all([
    getAccountOptions(user.id),
    getCategoryOptions(user.id),
  ]);

  return (
    <Box as="section">
      {/*
        The parent matters most on this form and its three siblings: the quick-add button opens them
        from every authenticated screen, so `router.back()` used to be able to return the user to a
        settlement detail page they had no further business on (audit 4.3).
      */}
      <PageHeader
        title="Add expense"
        description="Something you paid for yourself."
        parent={PARENTS.transactions}
        action={<FormSwitcher current="/transactions/new" />}
      />

      {/*
        No card here: `ExpenseForm` renders its own `FormLayout`, which owns the emphasised card and
        the side rail. The form has to be the one to do it — the rail shows the reference of the record
        about to be written, and that comes from the `clientId` the client component generates.
      */}
      <ExpenseForm
        userId={user.id}
        currency={user.currency}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        // Defaults to today in the user's timezone, not the server's.
        todayValue={toDateInputValue(new Date(), user.timezone)}
        defaultAccountId={user.settings.defaultAccountId}
      />
    </Box>
  );
}
