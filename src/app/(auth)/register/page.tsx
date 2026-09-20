import type { Metadata } from "next";
import { Heading } from "@chakra-ui/react";
import { getServerEnv } from "@/config/env";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  const { DEFAULT_TIMEZONE } = getServerEnv();

  return (
    <>
      <Heading as="h2" size="md" mb="5">
        Create your account
      </Heading>
      <RegisterForm defaultTimezone={DEFAULT_TIMEZONE} />
    </>
  );
}
