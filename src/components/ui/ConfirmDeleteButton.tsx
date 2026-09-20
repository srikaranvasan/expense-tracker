"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";

export type ConfirmDeleteResult = {
  ok: boolean;
  message?: string;
};

export type ConfirmDeleteButtonProps = {
  /** Text on the button that opens the confirmation, e.g. "Delete transfer". */
  label: string;
  /** What the user is about to lose, shown inside the confirmation. */
  confirmPrompt: ReactNode;
  /** Label on the confirming button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Runs the deletion. Any thrown or returned failure is shown in place. */
  onConfirm: () => Promise<ConfirmDeleteResult>;
  /** Where to go once the record is gone. */
  redirectTo: string;
};

/**
 * Two-step delete control.
 *
 * Every financial record in this app is soft-deleted but there is no undo in the
 * MVP, and deleting one moves balances, so the confirmation step *is* the safeguard
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md). Shared by the expense, transfer and
 * card-payment screens so all three warn in the same way.
 */
export function ConfirmDeleteButton({
  label,
  confirmPrompt,
  confirmLabel = "Delete",
  onConfirm,
  redirectTo,
}: ConfirmDeleteButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      const result = await onConfirm();

      if (!result.ok) {
        setError(result.message ?? "That did not work. Please try again.");
        return;
      }

      router.push(redirectTo);
    });
  }

  if (!confirming) {
    return (
      <Stack gap="2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button tone="secondary" onClick={() => setConfirming(true)}>
          {label}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="3" borderWidth="1px" borderColor="line" bg="surface.sunken" rounded="lg" p="3">
      <Text fontSize="sm">{confirmPrompt}</Text>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <HStack gap="2">
        <Button tone="danger" loading={pending} onClick={remove}>
          {confirmLabel}
        </Button>
        <Button tone="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
      </HStack>
    </Stack>
  );
}
