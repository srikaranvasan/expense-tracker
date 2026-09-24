import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardList, DetailList, DetailRow } from "@/components/ui/Card";
import { Icon } from "@/components/icons/Icon";
import { RowLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountArchiveButton } from "@/features/accounts/components/AccountArchiveButton";
import { AccountSwatch } from "@/features/accounts/components/AccountSwatch";
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
        parent={PARENTS.accounts}
        /*
          The identity swatch, in the meta slot above the title — the same square the list row and the
          dashboard show for this account, so the page is recognisable as the row that was tapped.
        */
        meta={
          <HStack gap="10px">
            <AccountSwatch type={account.type} />
            {account.isArchived ? <StatusBadge kind="archived" /> : null}
          </HStack>
        }
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

      {/*
        One card, one row, and the whole row is the target — far easier to hit on a phone than a small
        text link inside it, and it matches every other list row in the app.
      */}
      <Card>
        <CardHeader title="Activity" />
        <CardList>
          <RowLink href={`/transactions?accountId=${account.id}`}>
            <HStack gap="12px" minW="0">
              <Icon name="activity" size="tile" color="content.muted" />
              <Text fontSize="row" fontWeight="600">
                View transactions for this account
              </Text>
            </HStack>
            <Icon name="chevron-right" size="inline" color="content.subtle" />
          </RowLink>
        </CardList>
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
