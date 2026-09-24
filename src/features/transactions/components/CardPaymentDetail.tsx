import { Box, Stack } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { TintPanel } from "@/components/ui/FormLayout";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CardPaymentDeleteButton } from "./CardPaymentDeleteButton";
import { AccountRef, NotesBlock } from "./ExpenseDetail";
import type { CardPaymentDetailView } from "../view-models/card-payment-view-model";

export type CardPaymentDetailProps = {
  payment: CardPaymentDetailView;
};

/**
 * Detail layout for a credit-card payment.
 *
 * Shows what is still owed on the card after this payment, because that is the
 * question the user opened the record to answer. When the card ended up in credit it
 * says so in words rather than relying on a minus sign
 * (docs/06-CODING-PRACTICES.md section 40 - colour and sign are never the only signal).
 */
export function CardPaymentDetail({ payment }: CardPaymentDetailProps) {
  return (
    <Stack as="section" gap="5">
      <PageHeader
        title={payment.description}
        description={`${payment.typeLabel} · ${payment.dateLabel}`}
        parent={PARENTS.transactions}
        action={
          <AppLink href={`/transactions/${payment.id}/edit`} textDecoration="none">
            <Button size="sm" tone="secondary">
              Edit
            </Button>
          </AppLink>
        }
      />

      <Card>
        <CardHeader title="Details" action={<StatusBadge kind="cardPayment" />} />
        <CardBody>
          <DetailList>
            <DetailRow label="Amount paid" value={payment.formattedAmount} emphasis />
            {/*
              The card link matters more than most: "still owed on the card" is right below, and the
              next thing a user wants is the card's own page with its limit and available credit.
            */}
            <DetailRow
              label="Paid from"
              value={<AccountRef id={payment.fromAccountId} name={payment.fromAccountName} />}
            />
            <DetailRow
              label="Card"
              value={<AccountRef id={payment.toAccountId} name={payment.toAccountName} />}
            />
            <DetailRow label="Date" value={payment.dateLabel} />
            {payment.formattedOutstandingAfter ? (
              <DetailRow
                label={payment.cardInCredit ? "Card is in credit" : "Still owed on the card"}
                value={payment.formattedOutstandingAfter}
              />
            ) : null}
          </DetailList>

          {payment.notes ? <NotesBlock notes={payment.notes} /> : null}

          <Box mt="18px">
            <TintPanel>
              {payment.cardInCredit
                ? "This card has been paid more than it owed, so it holds a credit balance."
                : "A card payment is not counted as spending — that was recorded when the card was used."}
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
              value={<ReferenceCode code={payment.referenceCode} fontSize="meta" />}
            />
            <DetailRow label="Created" value={payment.createdAtLabel} />
            <DetailRow label="Last updated" value={payment.updatedAtLabel} />
          </DetailList>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Manage" />
        <CardBody>
          <CardPaymentDeleteButton paymentId={payment.id} directionLabel={payment.directionLabel} />
        </CardBody>
      </Card>
    </Stack>
  );
}
