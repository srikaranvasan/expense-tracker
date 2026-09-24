"use client";

import type { ReactNode } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { ColorModeProvider } from "@/components/theme/ColorModeProvider";
import { system } from "@/theme";

/**
 * Client-side providers.
 *
 * Isolated in its own Client Component so `app/layout.tsx` can stay a Server
 * Component: making the UI themeable must not push the whole tree onto the client
 * (docs/05-FOLDER-STRUCTURE.md section 17).
 *
 * `ColorModeProvider` wraps `ChakraProvider` rather than sitting inside it. It does not read
 * anything from Chakra — it manipulates `<html>` directly — and being outermost means a
 * component can call `useColorMode()` without also being inside the styling system, which
 * keeps the two concerns separable. The actual mechanism by which the mode reaches the
 * styles is a CSS class on `<html>`, not React context, so provider order carries no
 * styling consequence either way.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ColorModeProvider>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ColorModeProvider>
  );
}
