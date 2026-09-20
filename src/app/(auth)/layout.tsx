import { redirect } from "next/navigation";
import { Box, Flex, Heading } from "@chakra-ui/react";
import { publicConfig } from "@/config/env";
import { Card, CardBody } from "@/components/ui/Card";
import { AUTH_ROUTES } from "@/server/auth/auth-config";
import { getCurrentUserId } from "@/server/auth/session";

/**
 * Layout for the unauthenticated screens.
 * An already signed-in visitor is sent to the app rather than shown a login form.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUserId()) {
    redirect(AUTH_ROUTES.afterLogin);
  }

  return (
    <Flex
      as="main"
      id="main"
      direction="column"
      align="center"
      justify="center"
      minH="100dvh"
      px="4"
      py="10"
    >
      <Box w="full" maxW="md">
        <Heading as="h1" size="xl" textAlign="center" mb="6">
          {publicConfig.appName}
        </Heading>

        <Card>
          <CardBody p="6">{children}</CardBody>
        </Card>
      </Box>
    </Flex>
  );
}
