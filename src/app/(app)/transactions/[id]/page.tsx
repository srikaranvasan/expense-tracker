import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardPaymentDetail } from "@/features/transactions/components/CardPaymentDetail";
import { ExpenseDetail } from "@/features/transactions/components/ExpenseDetail";
import { TransferDetail } from "@/features/transactions/components/TransferDetail";
import { getTransactionDetail } from "@/features/transactions/queries/transaction-detail";
import { isAppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Transaction" };

/**
 * One URL for every transaction type.
 *
 * The record decides its own layout: a transfer has a direction and no participants,
 * an expense has participants and no direction.
 */
export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const detail = await getTransactionDetail(user.id, id, user.timezone).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  });

  if (!detail) notFound();

  switch (detail.kind) {
    case "transfer":
      return <TransferDetail transfer={detail.transfer} />;
    case "card_payment":
      return <CardPaymentDetail payment={detail.payment} />;
    default:
      return <ExpenseDetail expense={detail.expense} />;
  }
}
