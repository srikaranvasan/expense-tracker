"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { archiveAccountAction, restoreAccountAction } from "../actions/account-actions";

export type AccountArchiveButtonProps = {
  accountId: string;
  accountName: string;
  isArchived: boolean;
};

/**
 * Archive / restore control.
 *
 * Archiving is reversible and preserves history, but it removes the account from
 * every picker, so it asks for confirmation first.
 */
export function AccountArchiveButton({
  accountId,
  accountName,
  isArchived,
}: AccountArchiveButtonProps) {
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
          onClick={() => run(() => restoreAccountAction(accountId))}
        >
          Restore account
        </Button>
      </Stack>
    );
  }

  if (!confirming) {
    return (
      <Stack gap="2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button tone="secondary" onClick={() => setConfirming(true)}>
          Archive account
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="3" borderWidth="1px" borderColor="line" bg="surface.sunken" rounded="lg" p="3">
      <Text fontSize="sm">
        Archive{" "}
        <Text as="span" fontWeight="medium">
          {accountName}
        </Text>
        ? Its transactions are kept, but it will no longer be selectable for new ones.
      </Text>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <HStack gap="2">
        <Button
          tone="danger"
          loading={pending}
          onClick={() => run(() => archiveAccountAction(accountId))}
        >
          Archive
        </Button>
        <Button tone="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
      </HStack>
    </Stack>
  );
}
