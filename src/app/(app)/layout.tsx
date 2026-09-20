import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/server/auth/auth-config";
import { getCurrentUser } from "@/server/auth/session";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Authoritative gate for every authenticated page.
 *
 * Middleware also redirects unauthenticated visitors, but that is a UX
 * optimisation. This server-side check is what actually protects the data, and it
 * resolves the user once for the whole subtree.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(AUTH_ROUTES.login);
  }

  // The id is passed so the shell can start the sync engine for this user. It is not a
  // secret - it is the id of the already-authenticated session - and every server route
  // still takes the user from the session rather than trusting anything the client sends
  // (docs/08-OFFLINE-SYNC.md section 38).
  return <AppShell user={{ id: user.id, name: user.name, email: user.email }}>{children}</AppShell>;
}
