"use client";

import { Text } from "@chakra-ui/react";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { deleteExpenseAction } from "../actions/expense-actions";

export type ExpenseDeleteButtonProps = {
  expenseId: string;
  description: string;
};

/**
 * Delete control for an expense.
 *
 * Confirms first, because deleting changes account balances and - for a shared
 * expense - what people owe.
 */
export function ExpenseDeleteButton({ expenseId, description }: ExpenseDeleteButtonProps) {
  return (
    <ConfirmDeleteButton
      label="Delete expense"
      redirectTo="/transactions"
      onConfirm={() => deleteExpenseAction(expenseId)}
      confirmPrompt={
        <>
          Delete{" "}
          <Text as="span" fontWeight="medium">
            {description}
          </Text>
          ? Account balances will be recalculated without it.
        </>
      }
    />
  );
}
