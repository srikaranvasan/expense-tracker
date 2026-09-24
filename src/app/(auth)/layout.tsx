import { redirect } from "next/navigation";
import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { publicConfig } from "@/config/env";
import { DiamondMark } from "@/components/layout/DiamondMark";
import { Card, CardBody, GraphPaper, RegistrationTicks } from "@/components/ui/Card";
import { AUTH_ROUTES } from "@/server/auth/auth-config";
import { getCurrentUserId } from "@/server/auth/session";

/**
 * Layout for the unauthenticated screens.
 *
 * An already signed-in visitor is sent to the app rather than shown a login form.
 *
 * Three bands, as `Login.html` draws them: the brand lockup, the card, and a line of mono text at
 * the foot. The artboard pins the first and third 48px from the top and bottom edges with the card
 * absolutely centred; this uses a flex column with the card in a growing middle band, which puts
 * everything in the same place on a 1440×900 desktop and degrades to ordinary stacked flow on a
 * 402px phone — where absolute 48px insets would have the three bands overlap.
 */

/**
 * The line under the card.
 *
 * Not decoration, and not a slogan: it is the product's central rule stated on the way in
 * (docs/01-MVP-SCOPE.md section 4 — no stored aggregates, every figure recomputed). It is the same
 * claim the dashboard's "AS OF" eyebrow makes on the inside.
 */
const LEDGER_FOOTER = "Every entry timestamped · Nothing stored that can't be recomputed";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUserId()) {
    redirect(AUTH_ROUTES.afterLogin);
  }

  return (
    // Graph paper, and only here: the app shell is plain `surface.muted` (5.5).
    <GraphPaper asChild>
      <Flex
        as="main"
        id="main"
        direction="column"
        align="center"
        minH="100dvh"
        paddingInline="16px"
        paddingBlock={{ base: "32px", md: "48px" }}
        gap={{ base: "28px", md: "40px" }}
      >
        {/*
          The wordmark, not a heading. The page's `h1` is "Sign in" or "Create your account", inside
          the card — which is both what the artboard draws and the right answer for a screen reader:
          an `h1` should name the page, not the product it belongs to.
        */}
        <HStack gap="10px" flexShrink="0">
          <DiamondMark size="xl" />
          <Text as="span" fontFamily="heading" fontWeight="700" fontSize="lg" color="content">
            {publicConfig.appName}
          </Text>
        </HStack>

        {/* The growing middle band, so the card sits optically centred between the two fixed ones. */}
        <Flex flex="1" align="center" justify="center" width="full">
          {/* 440px as drawn, up from 420px. */}
          <Box w="full" maxW="440px">
            {/*
              The auth card is the subject of its page, so it is emphasised — 2px ink and an offset
              shadow — and it is the only card in the app that carries registration ticks.
              `hardXl` rather than the emphasis default: the handoff draws this one card at 8px, the
              deepest shadow in the design, because there is nothing else on the page to compete
              with.
            */}
            <RegistrationTicks>
              <Card emphasis boxShadow="hardXl">
                {/*
                  44px/40px as drawn. Reduced on a phone, where 40px of inline padding inside a
                  370px card would leave the inputs under 290px wide.
                */}
                <CardBody
                  paddingInline={{ base: "24px", md: "40px" }}
                  paddingBlock={{ base: "32px", md: "44px" }}
                >
                  {children}
                </CardBody>
              </Card>
            </RegistrationTicks>
          </Box>
        </Flex>

        <Text
          textStyle="amount"
          fontSize="eyebrow"
          letterSpacing="0.05em"
          textTransform="uppercase"
          color="content.subtle"
          textAlign="center"
          flexShrink="0"
        >
          {LEDGER_FOOTER}
        </Text>
      </Flex>
    </GraphPaper>
  );
}
