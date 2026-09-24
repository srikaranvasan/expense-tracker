import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add account" };

export default async function NewAccountPage() {
  const user = await requireUser();

  return (
    <Box as="section">
      <PageHeader
        title="Add account"
        description="Bank, cash, or credit card."
        parent={PARENTS.accounts}
      />

      {/* No card here: `AccountForm` renders its own `FormLayout`, which owns the card and the rail. */}
      <AccountForm currency={user.currency} />
    </Box>
  );
}
