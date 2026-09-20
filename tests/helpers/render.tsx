import type { ReactElement, ReactNode } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { render } from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { system } from "@/theme";

/**
 * Renders a component inside the application's providers.
 *
 * Chakra components read the theme from context, so rendering one without the
 * provider either throws or silently loses every token. Centralising it here keeps
 * the provider out of individual test files
 * (docs/11-TESTING-STRATEGY.md section 3).
 */

function Providers({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
