import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { SettleUpForm } from "@/features/settlements/components/SettleUpForm";
import { getSettleUpView } from "@/features/settlements/queries/settlement-queries";
import { toDateInputValue } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settle up" };

export default async function SettleUpPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const view = await getSettleUpView(user.id, id, user.currency, user.timezone).catch(
    (error: unknown) => {
      if (isAppError(error) && error.code === "NOT_FOUND") return null;
      throw error;
    },
  );

  if (!view) notFound();

  const accountOptions = await getAccountOptions(user.id);

  return (
    <Box as="section">
      <PageHeader
        title="Settle up"
        description={`Record a payment between you and ${view.personName}.`}
      />

      <Card>
        <CardBody>
          <SettleUpForm
            view={view}
            accountOptions={accountOptions}
            todayValue={toDateInputValue(new Date(), user.timezone)}
          />
        </CardBody>
      </Card>
    </Box>
  );
}
