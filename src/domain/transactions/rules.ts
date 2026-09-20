import { LIMITS } from "@/config/constants";
import type { Account } from "@/domain/accounts/entities";
import { assertAccountCurrencyMatches, assertAccountUsable } from "@/domain/accounts/rules";
import { ExpenseHasSettlementsError, InvalidAccountError } from "@/domain/shared/errors";
import { assertPositiveAmount, assertRoundedToCurrency } from "@/domain/shared/invariants";
import { ValidationError } from "@/lib/errors";
import type { Money } from "@/lib/money";
import { normalizeWhitespace } from "@/lib/utils/text";
import type { PaidBy } from "./entities";

/**
 * Business rules shared by every expense, personal or shared.
 *
 * These run server-side on every write, regardless of what the form already
 * checked (docs/06-CODING-PRACTICES.md section 12).
 */

/** An expense amount must be a positive, correctly-scaled monetary value. */
export function assertValidExpenseAmount(amount: Money): void {
  assertPositiveAmount(amount, "Expense amount");
  assertRoundedToCurrency(amount, "Expense amount");
}

export function assertValidDescription(description: string): string {
  const normalized = normalizeWhitespace(description);

  if (normalized === "") {
    throw new ValidationError("A description is required.", {
      fieldErrors: { description: ["A description is required."] },
    });
  }

  if (normalized.length > LIMITS.descriptionMaxLength) {
    throw new ValidationError(
      `Description must be at most ${LIMITS.descriptionMaxLength} characters.`,
      { fieldErrors: { description: ["Description is too long."] } },
    );
  }

  return normalized;
}

/**
 * Validates where the money came from.
 *
 * The rule that matters: an account is required exactly when the user paid, and
 * forbidden when someone else did.
 *
 * If Arun pays for dinner, no account of the user's was charged, so recording one
 * would move a balance that never moved
 * (docs/09-DATABASE-SCHEMA.md section 13). The user still owes their share, but that
 * is a person balance, not an account movement.
 */
export function assertValidExpensePaymentSource(
  paidBy: PaidBy,
  account: Account | null,
  amount: Money,
): void {
  if (paidBy.type === "user") {
    if (!account) {
      throw new InvalidAccountError("Choose the account you paid from.", {
        reason: "account_required_when_user_paid",
      });
    }

    assertAccountUsable(account, "this expense");
    assertAccountCurrencyMatches(account, amount);
    return;
  }

  if (account) {
    throw new InvalidAccountError("Do not choose one of your accounts when someone else paid.", {
      reason: "account_forbidden_when_person_paid",
    });
  }
}

/**
 * An expense that has been settled in part or full cannot be freely changed.
 *
 * Changing the amount of an already-settled expense would leave allocations
 * pointing at a share that no longer exists, and the person balance would silently
 * drift (docs/03-DATA-FLOW.md section 21). The user must remove the settlement
 * first.
 */
export function assertExpenseNotSettled(allocationCount: number, action = "changed"): void {
  if (allocationCount > 0) {
    throw new ExpenseHasSettlementsError(
      `This expense has been settled, so it cannot be ${action}. Remove the settlement first.`,
      { allocationCount },
    );
  }
}
