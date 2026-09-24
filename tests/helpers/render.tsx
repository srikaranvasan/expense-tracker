import type { ReactElement, ReactNode } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { render } from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { ColorModeProvider } from "@/components/theme/ColorModeProvider";
import { system } from "@/theme";

/**
 * Renders a component inside the application's providers.
 *
 * Chakra components read the theme from context, so rendering one without the
 * provider either throws or silently loses every token. Centralising it here keeps
 * the provider out of individual test files
 * (docs/11-TESTING-STRATEGY.md section 3).
 *
 * The provider stack mirrors `src/app/providers.tsx`, including the order. Anything
 * calling `useColorMode()` throws without `ColorModeProvider`, and a test that renders a
 * different stack from the application is a test that can pass while the app is broken.
 */

function Providers({ children }: { children: ReactNode }) {
  return (
    <ColorModeProvider>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ColorModeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
