import type { Metadata } from "next";
import { Heading } from "@chakra-ui/react";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <Heading as="h2" size="md" mb="5">
        Sign in
      </Heading>
      <LoginForm />
    </>
  );
}
