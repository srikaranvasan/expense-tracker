"use client";

import { useActionState } from "react";
import { Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { loginAction } from "../actions/auth-actions";
import type { FormState } from "../actions/auth-actions";

const initialState: FormState = { ok: false };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Stack asChild gap="4">
      <form action={formAction} noValidate>
        {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

        <Field id="email" label="Email" errors={state.fieldErrors?.email} required>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field id="password" label="Password" errors={state.fieldErrors?.password} required>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={pending}>
          Sign in
        </Button>

        <Text fontSize="sm" color="content.muted" textAlign="center">
          No account yet? <AppLink href="/register">Create one</AppLink>
        </Text>
      </form>
    </Stack>
  );
}
