import { DomainError, ERROR_CODES } from "@/lib/errors";
import type { ErrorDetails } from "@/lib/errors";

/**
 * Explicit errors for known business-rule failures.
 *
 * A named error with a stable code is far more useful than `throw new Error(...)`:
 * the API maps it to a status and the UI maps it to a message
 * (docs/06-CODING-PRACTICES.md section 19).
 */

export class InvalidAmountError extends DomainError {
  constructor(message = "Amount must be greater than zero.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_AMOUNT, message, { httpStatus: 400, details });
  }
}

export class InvalidCurrencyError extends DomainError {
  constructor(message = "All amounts in a transaction must use the same currency.") {
    super(ERROR_CODES.INVALID_CURRENCY, message, { httpStatus: 400 });
  }
}

export class InvalidAccountError extends DomainError {
  constructor(
    message = "The selected account cannot be used for this operation.",
    details?: ErrorDetails,
  ) {
    super(ERROR_CODES.INVALID_ACCOUNT, message, { httpStatus: 400, details });
  }
}

export class InvalidCategoryError extends DomainError {
  constructor(message = "The selected category cannot be used for this operation.") {
    super(ERROR_CODES.INVALID_CATEGORY, message, { httpStatus: 400 });
  }
}

export class InvalidPersonError extends DomainError {
  constructor(message = "The selected person cannot be used for this operation.") {
    super(ERROR_CODES.INVALID_PERSON, message, { httpStatus: 400 });
  }
}

export class InvalidSplitError extends DomainError {
  constructor(message = "The expense split is not valid.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_SPLIT, message, { httpStatus: 400, details });
  }
}

export class InvalidSplitTotalError extends DomainError {
  constructor(expected: string, actual: string, currency: string) {
    super(ERROR_CODES.INVALID_SPLIT_TOTAL, "Split amounts must add up to the expense total.", {
      httpStatus: 400,
      details: { expectedTotal: expected, actualTotal: actual, currency },
    });
  }
}

export class InvalidParticipantError extends DomainError {
  constructor(message = "The expense participants are not valid.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_PARTICIPANT, message, { httpStatus: 400, details });
  }
}

export class InvalidSettlementError extends DomainError {
  constructor(message = "The settlement is not valid.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_SETTLEMENT, message, { httpStatus: 400, details });
  }
}

export class InvalidSettlementAllocationError extends DomainError {
  constructor(message = "The settlement allocation is not valid.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_SETTLEMENT_ALLOCATION, message, { httpStatus: 400, details });
  }
}

export class OverSettlementError extends DomainError {
  constructor(details: {
    expenseSplitId: string;
    remaining: string;
    requested: string;
    currency: string;
  }) {
    super(
      ERROR_CODES.OVER_SETTLEMENT,
      "That is more than the amount still outstanding on this expense.",
      { httpStatus: 409, details },
    );
  }
}

export class InvalidTransferError extends DomainError {
  constructor(message = "The transfer is not valid.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_TRANSFER, message, { httpStatus: 400, details });
  }
}

export class InvalidCreditCardPaymentError extends DomainError {
  constructor(message = "The credit-card payment is not valid.", details?: ErrorDetails) {
    super(ERROR_CODES.INVALID_CREDIT_CARD_PAYMENT, message, { httpStatus: 400, details });
  }
}

export class ExpenseHasSettlementsError extends DomainError {
  constructor(
    message = "This expense has already been settled and cannot be changed that way.",
    details?: ErrorDetails,
  ) {
    super(ERROR_CODES.EXPENSE_HAS_SETTLEMENTS, message, { httpStatus: 409, details });
  }
}
