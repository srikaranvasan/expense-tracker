import type { Metadata } from "next";
import { getServerEnv } from "@/config/env";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  const { DEFAULT_TIMEZONE } = getServerEnv();

  return (
    <>
      {/*
        Sign-up is not drawn (section 10), so the eyebrow is written to sit in the same register as
        sign-in's "Ledger access": the noun is the ledger, and this is the screen that opens one.
      */}
      <AuthHeading eyebrow="New ledger" title="Create your account" />
      <RegisterForm defaultTimezone={DEFAULT_TIMEZONE} />
    </>
  );
}
