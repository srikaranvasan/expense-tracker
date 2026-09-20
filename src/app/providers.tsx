"use client";

import type { ReactNode } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/theme";

/**
 * Client-side providers.
 *
 * Isolated in its own Client Component so `app/layout.tsx` can stay a Server
 * Component: making the UI themeable must not push the whole tree onto the client
 * (docs/05-FOLDER-STRUCTURE.md section 17).
 */
export function Providers({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
