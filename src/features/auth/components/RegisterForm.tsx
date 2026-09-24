"use client";

import { useActionState } from "react";
import { SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { LIMITS } from "@/config/constants";
import { registerAction } from "../actions/auth-actions";
import type { FormState } from "../actions/auth-actions";
import { commonTimezones, currencyOptions } from "../options";

const initialState: FormState = { ok: false };

/**
 * Currency and timezone are captured at sign-up because every later amount and
 * every daily/monthly grouping depends on them.
 *
 * ## Not drawn, so built from sign-in's parts
 *
 * Section 10 lists sign-up as a screen with no artboard. It uses the same card, eyebrow, heading,
 * field, button and foot-of-card link as `Login.html`, at the same measurements, so the two read as
 * one pair rather than two designs.
 *
 * **One deliberate difference: no prefix icons.** Sign-in has two fields and two glyphs everybody
 * recognises. This form has six, and three of them — name, currency, timezone — have no glyph in the
 * registry that means what they mean (`people` is the section icon for *other* people, not for the
 * visitor's own name). Icons on the two familiar fields and nothing on the rest reads as unfinished,
 * so the form carries none. Its mono labels are doing the same work.
 */
export function RegisterForm({ defaultTimezone }: { defaultTimezone: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  const timezoneOptions = commonTimezones.includes(
    defaultTimezone as (typeof commonTimezones)[number],
  )
    ? commonTimezones
    : ([defaultTimezone, ...commonTimezones] as readonly string[]);

  const errors = state.fieldErrors ?? {};

  return (
    // 22px, matching sign-in. Six fields rather than two, so this is the taller card of the pair.
    <Stack asChild gap="22px">
      <form action={formAction} noValidate>
        {state.message ? (
          <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
        ) : null}

        <Field id="name" label="Name" errors={errors.name} required>
          <TextInput
            id="name"
            name="name"
            autoComplete="name"
            maxLength={LIMITS.nameMaxLength}
            required
          />
        </Field>

        <Field id="email" label="Email" errors={errors.email} required>
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

        <Field
          id="password"
          label="Password"
          hint={`At least ${LIMITS.passwordMinLength} characters.`}
          errors={errors.password}
          required
        >
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={LIMITS.passwordMinLength}
            required
          />
        </Field>

        <Field
          id="confirmPassword"
          label="Confirm password"
          errors={errors.confirmPassword}
          required
        >
          <TextInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <Field id="currency" label="Currency" errors={errors.currency} required>
            <SelectInput id="currency" name="currency" defaultValue="INR">
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field id="timezone" label="Timezone" errors={errors.timezone} required>
            <SelectInput id="timezone" name="timezone" defaultValue={defaultTimezone}>
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </SelectInput>
          </Field>
        </SimpleGrid>

        <Button type="submit" size="lg" fullWidth loading={pending} mt="8px">
          Create account
        </Button>

        <Text fontSize="subtitle" color="content.muted" textAlign="center" mt="2px">
          Already have an account?{" "}
          {/* Same ink treatment as sign-in's, so the two cards' feet match. */}
          <AppLink href="/login" color="content" textUnderlineOffset="3px">
            Sign in
          </AppLink>
        </Text>
      </form>
    </Stack>
  );
}
