import type { ReactNode } from "react";
import { Alert as ChakraAlert } from "@chakra-ui/react";

export type AlertTone = "info" | "success" | "warning" | "error";

export type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
};

/**
 * Inline message block.
 *
 * Chakra sets `role="alert"` for the error status, so a validation failure is
 * announced as soon as it appears rather than being noticed only by its colour
 * (docs/06-CODING-PRACTICES.md section 40).
 */
export function Alert({ tone = "info", title, children }: AlertProps) {
  return (
    <ChakraAlert.Root status={tone} variant="subtle" rounded="lg" alignItems="flex-start">
      <ChakraAlert.Indicator />
      <ChakraAlert.Content gap="0.5">
        {title ? <ChakraAlert.Title>{title}</ChakraAlert.Title> : null}
        <ChakraAlert.Description fontSize="sm">{children}</ChakraAlert.Description>
      </ChakraAlert.Content>
    </ChakraAlert.Root>
  );
}
