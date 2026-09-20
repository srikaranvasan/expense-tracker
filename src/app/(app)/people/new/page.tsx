import type { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { PersonForm } from "@/features/people/components/PersonForm";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add person" };

export default async function NewPersonPage() {
  await requireUser();

  return (
    <Box as="section">
      <PageHeader title="Add person" description="They do not need an account in this app." />

      <Card>
        <CardBody>
          <PersonForm />
        </CardBody>
      </Card>
    </Box>
  );
}
