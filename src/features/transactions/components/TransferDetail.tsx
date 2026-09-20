import { Stack, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { NotesBlock } from "./ExpenseDetail";
import { TransferDeleteButton } from "./TransferDeleteButton";
import type { TransferDetailView } from "../view-models/transfer-view-model";

export type TransferDetailProps = {
  transfer: TransferDetailView;
};

/**
 * Detail layout for a transfer.
 *
 * Deliberately says, in words, that the transfer is not spending. A user looking at a
 * ₹20,000 movement needs to know it is absent from their monthly total, and the
 * alternative - noticing that the dashboard number did not change - is worse.
 */
export function TransferDetail({ transfer }: TransferDetailProps) {
  return (
    <Stack as="section" gap="5">
      <PageHeader
        title={transfer.description}
        description={`${transfer.typeLabel} · ${transfer.dateLabel}`}
        action={
          <AppLink href={`/transactions/${transfer.id}/edit`} textDecoration="none">
            <Button size="sm" tone="secondary">
              Edit
            </Button>
          </AppLink>
        }
      />

      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <DetailList>
            <DetailRow label="Amount" value={transfer.formattedAmount} emphasis />
            <DetailRow label="From" value={transfer.fromAccountName ?? "—"} />
            <DetailRow label="To" value={transfer.toAccountName ?? "—"} />
            <DetailRow label="Date" value={transfer.dateLabel} />
          </DetailList>

          {transfer.notes ? <NotesBlock notes={transfer.notes} /> : null}

          <Text fontSize="xs" color="content.muted" mt="4">
            A transfer moves money between your own accounts, so it is not counted as spending.
          </Text>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Record" />
        <CardBody>
          <DetailList>
            <DetailRow label="Created" value={transfer.createdAtLabel} />
            <DetailRow label="Last updated" value={transfer.updatedAtLabel} />
          </DetailList>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Manage" />
        <CardBody>
          <TransferDeleteButton transferId={transfer.id} directionLabel={transfer.directionLabel} />
        </CardBody>
      </Card>
    </Stack>
  );
}
