import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { PersonForm } from "@/features/people/components/PersonForm";
import { getPersonDetailView } from "@/features/people/queries/person-queries";
import { isAppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit person" };

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const person = await getPersonDetailView(user.id, id, user.currency, user.timezone).catch(
    (error: unknown) => {
      if (isAppError(error) && error.code === "NOT_FOUND") return null;
      throw error;
    },
  );

  if (!person) notFound();

  return (
    <Box as="section">
      <PageHeader title="Edit person" description={person.name} />

      <Card>
        <CardBody>
          <PersonForm person={person} />
        </CardBody>
      </Card>
    </Box>
  );
}
