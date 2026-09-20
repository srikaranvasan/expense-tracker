"use client";

import { Text } from "@chakra-ui/react";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { deleteCardPaymentAction } from "../actions/card-payment-actions";

export type CardPaymentDeleteButtonProps = {
  paymentId: string;
  /** Where the money went, e.g. "HDFC Savings → Amex". */
  directionLabel: string;
};

/**
 * Delete control for a credit-card payment.
 *
 * The prompt spells out the consequence, because it is the one people get wrong:
 * removing a payment puts the debt back on the card.
 */
export function CardPaymentDeleteButton({
  paymentId,
  directionLabel,
}: CardPaymentDeleteButtonProps) {
  return (
    <ConfirmDeleteButton
      label="Delete payment"
      redirectTo="/transactions"
      onConfirm={() => deleteCardPaymentAction(paymentId)}
      confirmPrompt={
        <>
          Delete this payment{" "}
          <Text as="span" fontWeight="medium">
            {directionLabel}
          </Text>
          ? The amount will go back onto the card as outstanding.
        </>
      }
    />
  );
}
