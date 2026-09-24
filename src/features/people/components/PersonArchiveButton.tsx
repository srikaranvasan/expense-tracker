"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { archivePersonAction, restorePersonAction } from "../actions/person-actions";

export type PersonArchiveButtonProps = {
  personId: string;
  personName: string;
  isArchived: boolean;
  /** Warns before archiving someone with money still outstanding. */
  hasOutstandingBalance: boolean;
  formattedBalance: string;
  balanceLabel: string;
};

export function PersonArchiveButton({
  personId,
  personName,
  isArchived,
  hasOutstandingBalance,
  formattedBalance,
  balanceLabel,
}: PersonArchiveButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(operation: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        setError(result.message ?? "That did not work. Please try again.");
        return;
      }
      setError(null);
      setConfirming(false);
      router.refresh();
    });
  }

  if (isArchived) {
    return (
      <Stack gap="2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button
          tone="secondary"
          loading={pending}
          onClick={() => run(() => restorePersonAction(personId))}
        >
          Restore person
        </Button>
      </Stack>
    );
  }

  if (!confirming) {
    return (
      <Stack gap="2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button tone="secondary" onClick={() => setConfirming(true)}>
          Archive person
        </Button>
      </Stack>
    );
  }

  /*
   * The confirmation, inline rather than in a modal (9.1), and an inset block like every other
   * in-card control group. The outstanding-balance guard is a **warning, not a block**: archiving is
   * reversible and keeps the balance, so refusing would be protecting the user from nothing.
   */
  return (
    <Stack
      gap="14px"
      bg="surface.sunken"
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line.card"
      paddingInline={{ base: "16px", md: "18px" }}
      paddingBlock={{ base: "16px", md: "18px" }}
    >
      {hasOutstandingBalance ? (
        <Alert tone="warning" title="There is still an unsettled balance">
          {formattedBalance} {balanceLabel}. Archiving keeps the balance and history; it only
          removes {personName} from the pickers.
        </Alert>
      ) : (
        <Text fontSize="row">
          Archive{" "}
          <Text as="span" fontWeight="600">
            {personName}
          </Text>
          ? Their history is kept, but they will no longer appear when splitting an expense.
        </Text>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <HStack gap="12px" wrap="wrap">
        <Button
          tone="danger"
          loading={pending}
          onClick={() => run(() => archivePersonAction(personId))}
        >
          Archive
        </Button>
        <Button tone="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Keep them
        </Button>
      </HStack>
    </Stack>
  );
}
