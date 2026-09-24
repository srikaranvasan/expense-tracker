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

/**
 * Sign-in, as drawn in `design/ux/screens/Login.html`.
 *
 * The two prefix glyphs are the only place in the app where an input carries an icon. They are
 * affordances for the two field types everyone recognises on sight, and they are `aria-hidden`: the
 * mono label above each field is what actually names it.
 *
 * ## The failure message says which *pair* was wrong, never which half
 *
 * `loginAction` returns one string — "Email or password is incorrect." — for a wrong password and for
 * an address that has never registered. That is deliberate and must stay that way: telling a visitor
 * "no account with that email" turns the sign-in form into a free account-enumeration oracle
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md). It is also why the error is a form-level `Alert` rather
 * than a field error — attaching it to the password field would imply the email was accepted.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    // 22px between the fields, as drawn — wider than the app's usual 16px, because this card has
    // only two of them and the handoff gives them room.
    <Stack asChild gap="22px">
      <form action={formAction} noValidate>
        {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

        <Field id="email" label="Email" errors={state.fieldErrors?.email} required>
          <TextInput
            id="email"
            name="email"
            type="email"
            icon="mail"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field id="password" label="Password" errors={state.fieldErrors?.password} required>
          {/*
            No placeholder. The artboard draws a row of bullets, which is what the browser's own
            masking already shows the moment anything is typed — and an empty field whose placeholder
            is bullets looks filled in.
          */}
          <TextInput
            id="password"
            name="password"
            type="password"
            icon="lock"
            autoComplete="current-password"
            required
          />
        </Field>

        {/* 30px above the button in the handoff: the 22px stack gap plus this. */}
        <Button type="submit" size="lg" fullWidth loading={pending} mt="8px">
          Sign in
        </Button>

        <Text fontSize="subtitle" color="content.muted" textAlign="center" mt="2px">
          No account yet?{" "}
          {/*
            Ink rather than `AppLink`'s teal, as drawn. This link sits inside a sentence at the foot
            of the card, where teal would compete with the teal submit button directly above it; the
            weight and the underline carry it instead.
          */}
          <AppLink href="/register" color="content" textUnderlineOffset="3px">
            Create one
          </AppLink>
        </Text>
      </form>
    </Stack>
  );
}
