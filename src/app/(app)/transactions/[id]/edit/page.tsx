import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { getCategoryOptions } from "@/features/categories/queries/category-queries";
import { getPersonOptions } from "@/features/people/queries/person-queries";
import { CardPaymentForm } from "@/features/transactions/components/CardPaymentForm";
import { ExpenseForm } from "@/features/transactions/components/ExpenseForm";
import { SharedExpenseForm } from "@/features/transactions/components/SharedExpenseForm";
import { TransferForm } from "@/features/transactions/components/TransferForm";
import { isExpenseSettled } from "@/features/transactions/queries/settlement-status";
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
        <PageHeader title="Edit transfer" description={transfer.directionLabel} />
        <Card>
          <CardBody>
            <TransferForm
              currency={user.currency}
              accountOptions={accountOptions}
              todayValue={todayValue}
              transfer={transfer}
            />
          </CardBody>
        </Card>
      </Box>
    );
  }

  if (detail.kind === "card_payment") {
    const { payment } = detail;
    const accountOptions = await getAccountOptions(user.id);

    return (
      <Box as="section">
        <PageHeader title="Edit card payment" description={payment.directionLabel} />
        <Card>
          <CardBody>
            <CardPaymentForm
              currency={user.currency}
              accountOptions={accountOptions}
              todayValue={todayValue}
              payment={payment}
            />
          </CardBody>
        </Card>
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
    return (
      <Box as="section">
        <PageHeader title="Cannot edit" description={expense.description} />
        <Alert tone="warning" title="This expense has been settled">
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
      />

      <Card>
        <CardBody>
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
        </CardBody>
      </Card>
    </Box>
  );
}
