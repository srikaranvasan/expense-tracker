import { Box, Stack } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { TintPanel } from "@/components/ui/FormLayout";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountRef, NotesBlock } from "./ExpenseDetail";
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
        parent={PARENTS.transactions}
        action={
          <AppLink href={`/transactions/${transfer.id}/edit`} textDecoration="none">
            <Button size="sm" tone="secondary">
              Edit
            </Button>
          </AppLink>
        }
      />

      <Card>
        {/* The same chip the activity row carried, so the record is recognisable from the list. */}
        <CardHeader title="Details" action={<StatusBadge kind="transfer" />} />
        <CardBody>
          <DetailList>
            <DetailRow label="Amount" value={transfer.formattedAmount} emphasis />
            {/*
              Both ends are links now. A transfer is the one record whose whole meaning is the two
              accounts it names, and it named them as plain text (audit 4.4).
            */}
            <DetailRow
              label="From"
              value={<AccountRef id={transfer.fromAccountId} name={transfer.fromAccountName} />}
            />
            <DetailRow
              label="To"
              value={<AccountRef id={transfer.toAccountId} name={transfer.toAccountName} />}
            />
            <DetailRow label="Date" value={transfer.dateLabel} />
          </DetailList>

          {transfer.notes ? <NotesBlock notes={transfer.notes} /> : null}

          {/*
            The same tint panel the form's side rail uses, without its eyebrow — the card header
            already says what is being explained.
          */}
          <Box mt="18px">
            <TintPanel>
              A transfer moves money between your own accounts, so it is not counted as spending.
            </TintPanel>
          </Box>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Record" />
        <CardBody>
          <DetailList>
            <DetailRow
              label="Reference"
              value={<ReferenceCode code={transfer.referenceCode} fontSize="meta" />}
            />
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
