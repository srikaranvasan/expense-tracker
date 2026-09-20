import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AccountForm } from "@/features/accounts/components/AccountForm";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add account" };

export default async function NewAccountPage() {
  const user = await requireUser();

  return (
    <Box as="section">
      <PageHeader title="Add account" description="Bank, cash, or credit card." />

      <Card>
        <CardBody>
          <AccountForm currency={user.currency} />
        </CardBody>
      </Card>
    </Box>
  );
}
