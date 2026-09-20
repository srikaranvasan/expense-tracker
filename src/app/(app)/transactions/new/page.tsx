import type { Metadata } from "next";
import { Box, HStack } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { getAccountOptions } from "@/features/accounts/queries/account-queries";
import { getCategoryOptions } from "@/features/categories/queries/category-queries";
import { ExpenseForm } from "@/features/transactions/components/ExpenseForm";
import { toDateInputValue } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage() {
  const user = await requireUser();

  const [accountOptions, categoryOptions] = await Promise.all([
    getAccountOptions(user.id),
    getCategoryOptions(user.id),
  ]);

  return (
    <Box as="section">
      <PageHeader
        title="Add expense"
        description="Something you paid for yourself."
        action={
          <HStack gap="2" wrap="wrap">
            <AppLink href="/transactions/new/shared" textDecoration="none">
              <Button size="sm" tone="secondary">
                Split instead
              </Button>
            </AppLink>
            <AppLink href="/transactions/new/transfer" textDecoration="none">
              <Button size="sm" tone="secondary">
                Transfer
              </Button>
            </AppLink>
            <AppLink href="/transactions/new/card-payment" textDecoration="none">
              <Button size="sm" tone="secondary">
                Pay card
              </Button>
            </AppLink>
          </HStack>
        }
      />

      <Card>
        <CardBody>
          <ExpenseForm
            userId={user.id}
            currency={user.currency}
            accountOptions={accountOptions}
            categoryOptions={categoryOptions}
            // Defaults to today in the user's timezone, not the server's.
            todayValue={toDateInputValue(new Date(), user.timezone)}
            defaultAccountId={user.settings.defaultAccountId}
          />
        </CardBody>
      </Card>
    </Box>
  );
}
