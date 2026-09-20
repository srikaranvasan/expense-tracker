"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { deleteSettlementAction } from "../actions/settlement-actions";

export type SettlementDeleteButtonProps = {
  settlementId: string;
  personId: string;
  personName: string;
  formattedAmount: string;
};

/**
 * Removes a settlement.
 *
 * This is also how a user unwinds a payment in order to edit a settled expense, so the
 * confirmation says what will happen to the balance rather than just asking "are you
 * sure?".
 */
export function SettlementDeleteButton({
  settlementId,
  personId,
  personName,
  formattedAmount,
}: SettlementDeleteButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      const result = await deleteSettlementAction(settlementId, personId);

      if (!result.ok) {
        setError(result.message ?? "That did not work. Please try again.");
        return;
      }

      router.push(`/people/${personId}`);
    });
  }

  if (!confirming) {
    return (
      <Stack gap="2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button tone="secondary" onClick={() => setConfirming(true)}>
          Remove settlement
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="3" borderWidth="1px" borderColor="line" bg="surface.sunken" rounded="lg" p="3">
      <Text fontSize="sm">
        Remove this {formattedAmount} settlement? The expenses it paid down will show as outstanding
        again, and your balance with {personName} will go back up.
      </Text>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <HStack gap="2">
        <Button tone="danger" loading={pending} onClick={remove}>
          Remove
        </Button>
        <Button tone="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
      </HStack>
    </Stack>
  );
}
