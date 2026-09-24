import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { personParent } from "@/components/layout/Parents";
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
    /*
      A centred 820px column, as `SettleUp-Light.html` draws it — narrower than the other form pages
      and with no side rail. The reason is the allocation box: it is the subject of this screen, and a
      rail beside it would compete with the one thing the user has come here to get right.
     */
    <Box as="section" maxW="820px" mx="auto">
      {/*
        The person, not `/settlements`. Settling up is an action on a person, and the balance the user
        was reading is on that page.
      */}
      <PageHeader
        title="Settle up"
        description={`Record a payment between you and ${view.personName}.`}
        parent={personParent(id, view.personName)}
      />

      {/* No card here: `SettleUpForm` renders its own `FormLayout`. */}
      <SettleUpForm
        view={view}
        accountOptions={accountOptions}
        todayValue={toDateInputValue(new Date(), user.timezone)}
      />
    </Box>
  );
}
