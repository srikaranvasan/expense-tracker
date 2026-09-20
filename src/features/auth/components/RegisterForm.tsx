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
    <Stack asChild gap="4">
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

        <Button type="submit" size="lg" fullWidth loading={pending}>
          Create account
        </Button>

        <Text fontSize="sm" color="content.muted" textAlign="center">
          Already have an account? <AppLink href="/login">Sign in</AppLink>
        </Text>
      </form>
    </Stack>
  );
}
