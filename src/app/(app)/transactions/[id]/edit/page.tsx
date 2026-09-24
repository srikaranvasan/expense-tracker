import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Box, HStack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { transactionParent } from "@/components/layout/Parents";
import { AppLink } from "@/components/ui/AppLink";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { getCategoryOptions } from "@/features/categories/queries/category-queries";
import { getPersonOptions } from "@/features/people/queries/person-queries";
import { CardPaymentForm } from "@/features/transactions/components/CardPaymentForm";
import { ExpenseForm } from "@/features/transactions/components/ExpenseForm";
import { SharedExpenseForm } from "@/features/transactions/components/SharedExpenseForm";
import { TransferForm } from "@/features/transactions/components/TransferForm";
import {
  getSettlementsBlockingExpense,
  isExpenseSettled,
} from "@/features/transactions/queries/settlement-status";
import { getTransactionDetail } from "@/features/transactions/queries/transaction-detail";
import { toDateInputValue } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit transaction" };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const detail = await getTransactionDetail(user.id, id, user.timezone).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  });

  if (!detail) notFound();

  const todayValue = toDateInputValue(new Date(), user.timezone);

  if (detail.kind === "transfer") {
    const { transfer } = detail;
    const accountOptions = await getAccountOptions(user.id);

    return (
      <Box as="section">
        {/*
          No `FormSwitcher` on an edit screen, and no card here either: the forms render their own
          `FormLayout`. Offering "Transfer instead" while editing an existing expense would be an
          invitation to a conversion this app does not do — a record's type is fixed once written.
        */}
        <PageHeader
          title="Edit transfer"
          description={transfer.directionLabel}
          parent={transactionParent(transfer.id, transfer.description)}
        />
        <TransferForm
          currency={user.currency}
          accountOptions={accountOptions}
          todayValue={todayValue}
          transfer={transfer}
        />
      </Box>
    );
  }

  if (detail.kind === "card_payment") {
    const { payment } = detail;
    const accountOptions = await getAccountOptions(user.id);

    return (
      <Box as="section">
        <PageHeader
          title="Edit card payment"
          description={payment.directionLabel}
          parent={transactionParent(payment.id, payment.description)}
        />
        <CardPaymentForm
          currency={user.currency}
          accountOptions={accountOptions}
          todayValue={todayValue}
          payment={payment}
        />
      </Box>
    );
  }

  const { expense } = detail;

  // Income and card payments have no editor yet, so there is nothing to show.
  if (expense.type !== "expense") {
    redirect(`/transactions/${expense.id}`);
  }

  // A settled expense cannot be changed: its shares are referenced by settlement
  // allocations. Showing the form would only lead to a rejected submission.
  if (await isExpenseSettled(user.id, expense.id)) {
    /*
      Group 47 rebuilt this screen. It was the worst page in the application for navigation: a title,
      a paragraph, and nothing else. The form never renders here, so `FormActions` never renders, so
      there was no Cancel — and the prose named two records, *this expense* and *the settlement*, and
      linked to neither. A user was told to go and remove a settlement on a page that could reach
      neither the settlement nor the expense, and that is not in the tab bar
      (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 6.3).

      Three things fixed it: a back link to the expense, a link to each blocking settlement, and the
      settlement ids to build them from — see `getSettlementsBlockingExpense`.

      It deliberately does **not** offer to remove the settlement from here. Removal belongs on the
      settlement's own page, where its amount and the expenses it cleared are on screen and the
      consequences are visible.
    */
    const blocking = await getSettlementsBlockingExpense(user.id, expense.id);

    return (
      <Box as="section">
        <PageHeader
          title="Cannot edit"
          description={expense.description}
          parent={transactionParent(expense.id, expense.description)}
        />
        <Alert
          tone="warning"
          title="This expense has been settled"
          action={
            <HStack gap="16px" wrap="wrap">
              {blocking.length > 0 ? (
                blocking.map((settlementId, index) => (
                  <AppLink key={settlementId} href={`/settlements/${settlementId}`}>
                    {blocking.length === 1 ? "Open the settlement" : `Open settlement ${index + 1}`}
                  </AppLink>
                ))
              ) : (
                /*
                  Reached only if the boolean guard and the id query disagree, which should be
                  impossible — but a screen whose whole problem was being inescapable must not become
                  inescapable again because of an empty list.
                */
                <AppLink href="/settlements">Open settlements</AppLink>
              )}
              <AppLink href={`/transactions/${expense.id}`}>Back to the expense</AppLink>
            </HStack>
          }
        >
          Changing it would leave the settlement pointing at a share that no longer exists. Remove
          the settlement first, then edit the expense.
        </Alert>
      </Box>
    );
  }

  const [accountOptions, categoryOptions, peopleOptions] = await Promise.all([
    getAccountOptions(user.id),
    getCategoryOptions(user.id),
    expense.isShared ? getPersonOptions(user.id) : Promise.resolve([]),
  ]);

  return (
    <Box as="section">
      <PageHeader
        title={expense.isShared ? "Edit shared expense" : "Edit expense"}
        description={expense.description}
        parent={transactionParent(expense.id, expense.description)}
      />

      {expense.isShared ? (
        <SharedExpenseForm
          currency={user.currency}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          peopleOptions={peopleOptions}
          todayValue={todayValue}
          expense={expense}
        />
      ) : (
        <ExpenseForm
          userId={user.id}
          currency={user.currency}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          todayValue={todayValue}
          expense={expense}
        />
      )}
    </Box>
  );
}
