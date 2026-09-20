import { describe, expect, it } from "vitest";
import { AUTH_ROUTES, isPublicPath } from "./auth-config";

describe("isPublicPath", () => {
  it("allows the authentication screens and endpoints", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/api/auth/callback/credentials")).toBe(true);
    expect(isPublicPath("/api/auth/register")).toBe(true);
  });

  it("allows the health probe and PWA shell assets", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/icons/icon-192.png")).toBe(true);
  });

  it("protects application routes and data endpoints", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/transactions")).toBe(false);
    expect(isPublicPath("/api/me")).toBe(false);
    expect(isPublicPath("/api/expenses")).toBe(false);
    expect(isPublicPath("/api/sync/push")).toBe(false);
  });

  it("does not treat a prefix match as a path match", () => {
    // "/logins" must not inherit the public status of "/login".
    expect(isPublicPath("/logins")).toBe(false);
    expect(isPublicPath("/registered-users")).toBe(false);
    expect(isPublicPath("/api/authorised-thing")).toBe(false);
  });

  it("points the sign-in flow at the login screen", () => {
    expect(AUTH_ROUTES.login).toBe("/login");
    expect(AUTH_ROUTES.afterLogin).toBe("/dashboard");
  });
});
