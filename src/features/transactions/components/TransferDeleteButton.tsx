"use client";

import { Text } from "@chakra-ui/react";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { deleteTransferAction } from "../actions/transfer-actions";

export type TransferDeleteButtonProps = {
  transferId: string;
  /** Where the money went, e.g. "HDFC Savings → Cash". */
  directionLabel: string;
};

/**
 * Delete control for a transfer.
 *
 * The prompt names both accounts, because deleting a transfer moves two balances and
 * the user should see which ones before confirming.
 */
export function TransferDeleteButton({ transferId, directionLabel }: TransferDeleteButtonProps) {
  return (
    <ConfirmDeleteButton
      label="Delete transfer"
      redirectTo="/transactions"
      onConfirm={() => deleteTransferAction(transferId)}
      confirmPrompt={
        <>
          Delete this transfer{" "}
          <Text as="span" fontWeight="medium">
            {directionLabel}
          </Text>
          ? Both account balances will be recalculated without it.
        </>
      }
    />
  );
}
