import { Badge, Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { ExpenseDeleteButton } from "./ExpenseDeleteButton";
import type { ExpenseDetailView } from "../view-models/expense-view-model";

export type ExpenseDetailProps = {
  expense: ExpenseDetailView;
};

/**
 * Detail layout for an expense.
 *
 * Shows the user's share as its own row only when it differs from the amount, so a
 * personal expense is not padded with a row that repeats the line above it.
 */
export function ExpenseDetail({ expense }: ExpenseDetailProps) {
  const isExpense = expense.type === "expense";
  const canEditInline = isExpense && !expense.isShared;

  return (
    <Stack as="section" gap="5">
      <PageHeader
        title={expense.description}
        description={`${expense.typeLabel} · ${expense.dateLabel}`}
        action={
          canEditInline ? (
            <AppLink href={`/transactions/${expense.id}/edit`} textDecoration="none">
              <Button size="sm" tone="secondary">
                Edit
              </Button>
            </AppLink>
          ) : undefined
        }
      />

      <Card>
        <CardHeader
          title="Details"
          action={
            expense.isShared ? (
              <HStack gap="2" flexShrink="0">
                <Badge variant="subtle" bg="brand.muted" color="brand.fg">
                  Split
                </Badge>
                {expense.settlementLabel ? (
                  <Badge
                    variant="subtle"
                    bg={
                      expense.settlementStatus === "settled" ? "positive.surface" : "surface.sunken"
                    }
                    color={expense.settlementStatus === "settled" ? "positive" : "content.muted"}
                  >
                    {expense.settlementLabel}
                  </Badge>
                ) : null}
              </HStack>
            ) : undefined
          }
        />
        <CardBody>
          <DetailList>
            <DetailRow label="Amount" value={expense.formattedAmount} emphasis />
            {expense.isSplit ? (
              <DetailRow label="Your share" value={expense.formattedUserShare} emphasis />
            ) : null}
            {isExpense ? <DetailRow label="Paid by" value={expense.paidByName} /> : null}
            <DetailRow label="Account" value={expense.accountName ?? "—"} />
            <DetailRow label="Category" value={expense.categoryName ?? "Uncategorised"} />
            <DetailRow label="Date" value={expense.dateLabel} />
          </DetailList>

          {expense.notes ? <NotesBlock notes={expense.notes} /> : null}
        </CardBody>
      </Card>

      {expense.isShared ? (
        <Card>
          <CardHeader
            title="Split between"
            subtitle={
              expense.outstandingShareCount > 0
                ? `${expense.participants.length} participants · ${expense.outstandingShareCount} still owing`
                : `${expense.participants.length} participants · all settled`
            }
          />
          <CardBody>
            <Stack gap="0" separator={<Box borderTopWidth="1px" borderColor="line" />}>
              {expense.participants.map((participant) => (
                <Flex
                  key={participant.expenseSplitId}
                  align="center"
                  justify="space-between"
                  gap="4"
                  py="3"
                >
                  <HStack gap="2" minW="0">
                    <Text fontSize="sm" truncate>
                      {participant.name}
                    </Text>
                    {participant.isUser ? (
                      <Badge variant="subtle" bg="surface.sunken" color="content.muted">
                        You
                      </Badge>
                    ) : null}
                  </HStack>

                  <Text textStyle="amount" fontSize="sm" fontWeight="medium" flexShrink="0">
                    {participant.formattedShare}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Record" />
        <CardBody>
          <DetailList>
            <DetailRow label="Created" value={expense.createdAtLabel} />
            <DetailRow label="Last updated" value={expense.updatedAtLabel} />
          </DetailList>
        </CardBody>
      </Card>

      {isExpense ? (
        <Card>
          <CardHeader title="Manage" />
          <CardBody>
            <ExpenseDeleteButton expenseId={expense.id} description={expense.description} />
          </CardBody>
        </Card>
      ) : null}
    </Stack>
  );
}

export function NotesBlock({ notes }: { notes: string }) {
  return (
    <Box mt="4">
      <Text fontSize="xs" fontWeight="semibold" color="content.muted" mb="1">
        Notes
      </Text>
      <Text fontSize="sm" whiteSpace="pre-wrap">
        {notes}
      </Text>
    </Box>
  );
}
