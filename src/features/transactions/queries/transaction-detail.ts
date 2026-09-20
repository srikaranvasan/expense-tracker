import { NotFoundError } from "@/lib/errors";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import type { CardPaymentDetailView } from "../view-models/card-payment-view-model";
import type { ExpenseDetailView } from "../view-models/expense-view-model";
import type { TransferDetailView } from "../view-models/transfer-view-model";
import { getCardPaymentDetailView } from "./card-payment-queries";
import { getExpenseDetailView } from "./expense-queries";
import { getTransferDetailView } from "./transfer-queries";

/**
 * One entry point for `/transactions/:id`, whatever the record turns out to be.
 *
 * The URL cannot say which type it points at, and the types genuinely need different
 * screens: an expense has participants and a category, a transfer has a direction and
 * neither, a card payment has a direction plus a remaining balance. Returning a
 * discriminated union means the page branches once, on a field the compiler checks,
 * instead of rendering an expense layout full of em dashes for everything else.
 *
 * The type is read first with a cheap `_id` lookup and the detail view is then loaded
 * by the type's own query. That is one extra indexed read per detail page, paid to
 * keep each view's loading logic in one place rather than fanned out here.
 */

export type TransactionDetail =
  | { kind: "expense"; expense: ExpenseDetailView }
  | { kind: "transfer"; transfer: TransferDetailView }
  | { kind: "card_payment"; payment: CardPaymentDetailView };

export async function getTransactionDetail(
  userId: string,
  transactionId: string,
  timezone: string,
): Promise<TransactionDetail> {
  const transaction = await transactionRepository().findById(userId, transactionId);
  if (!transaction) throw new NotFoundError("Transaction");

  switch (transaction.type) {
    case "transfer":
      return {
        kind: "transfer",
        transfer: await getTransferDetailView(userId, transactionId, timezone),
      };

    case "credit_card_payment":
      return {
        kind: "card_payment",
        payment: await getCardPaymentDetailView(userId, transactionId, timezone),
      };

    default:
      // Expense and income. Income has no editor yet but reads correctly here: one
      // account, no split.
      return {
        kind: "expense",
        expense: await getExpenseDetailView(userId, transactionId, timezone),
      };
  }
}
