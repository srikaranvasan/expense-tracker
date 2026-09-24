import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading eyebrow="Ledger access" title="Sign in" />
      <LoginForm />
    </>
  );
}
