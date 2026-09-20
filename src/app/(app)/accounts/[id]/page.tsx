import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HStack, Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { AccountArchiveButton } from "@/features/accounts/components/AccountArchiveButton";
import { getAccountDetailView } from "@/features/accounts/queries/account-queries";
import { isAppError } from "@/lib/errors";
import { formatMoney, money } from "@/lib/money";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const account = await getAccountDetailView(user.id, id).catch((error: unknown) => {
    // A missing account and another user's account are indistinguishable here,
    // which is the point.
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  });

  if (!account) notFound();

  const isCard = account.type === "credit_card";

  return (
    <Stack as="section" gap="5">
      <PageHeader
        title={account.name}
        description={[account.typeLabel, account.institutionName].filter(Boolean).join(" · ")}
        action={
          <HStack gap="2">
            {/* Offered from the card itself, where the outstanding balance is on screen. */}
            {isCard && !account.isArchived ? (
              <AppLink
                href={`/transactions/new/card-payment?cardId=${account.id}`}
                textDecoration="none"
              >
                <Button size="sm">Pay card</Button>
              </AppLink>
            ) : null}
            <AppLink href={`/accounts/${account.id}/edit`} textDecoration="none">
              <Button size="sm" tone="secondary">
                Edit
              </Button>
            </AppLink>
          </HStack>
        }
      />

      {account.isArchived ? (
        <Alert tone="warning">
          This account is archived. It cannot be selected for new transactions, and its history is
          unchanged.
        </Alert>
      ) : null}

      {account.overLimit ? <Alert tone="error">This card is over its credit limit.</Alert> : null}

      <Card>
        <CardHeader
          title={isCard ? "Card position" : "Balance"}
          subtitle="Calculated from your transactions"
        />
        <CardBody>
          <DetailList>
            {isCard ? (
              <>
                <DetailRow label="Outstanding" value={account.formattedOutstanding} emphasis />
                <DetailRow
                  label="Credit limit"
                  value={
                    account.creditLimit
                      ? formatMoney(money(account.creditLimit.amount, account.creditLimit.currency))
                      : "—"
                  }
                />
                <DetailRow
                  label="Available credit"
                  value={account.formattedAvailableCredit ?? "—"}
                  emphasis
                />
                <DetailRow label="Statement day" value={account.statementDay ?? "Not set"} />
                <DetailRow label="Payment due day" value={account.paymentDueDay ?? "Not set"} />
                <DetailRow
                  label="Opening outstanding"
                  value={formatMoney(
                    money(account.openingBalance.amount, account.openingBalance.currency),
                  )}
                />
              </>
            ) : (
              <>
                <DetailRow label="Current balance" value={account.formattedBalance} emphasis />
                <DetailRow
                  label="Opening balance"
                  value={formatMoney(
                    money(account.openingBalance.amount, account.openingBalance.currency),
                  )}
                />
                <DetailRow label="Currency" value={account.currency} />
              </>
            )}
          </DetailList>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Activity" />
        <CardBody>
          <AppLink href={`/transactions?accountId=${account.id}`} fontSize="sm">
            View transactions for this account
          </AppLink>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Manage" />
        <CardBody>
          <AccountArchiveButton
            accountId={account.id}
            accountName={account.name}
            isArchived={account.isArchived}
          />
        </CardBody>
      </Card>
    </Stack>
  );
}
