import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { accountParent } from "@/components/layout/Parents";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { getAccountDetailView } from "@/features/accounts/queries/account-queries";
import { isAppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit account" };

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const account = await getAccountDetailView(user.id, id).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  });

  if (!account) notFound();

  return (
    <Box as="section">
      {/*
        The parent of an edit form is the **record**, not the list: `description` already names the
        account, and group 46 made that name a destination. Cancelling and the back link now agree.
      */}
      <PageHeader
        title="Edit account"
        description={account.name}
        parent={accountParent(account.id, account.name)}
      />

      <AccountForm currency={user.currency} account={account} />
    </Box>
  );
}
