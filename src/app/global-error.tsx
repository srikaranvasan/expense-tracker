"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: a failure in the root layout itself.
 *
 * This replaces the whole document, which is why it renders its own `<html>` and `<body>`.
 * It is also why it uses **inline styles and no components**: if the root layout threw, the
 * Chakra provider never mounted, so the theme, the tokens and every `components/ui`
 * primitive are unavailable. Importing them here would risk the error page throwing too,
 * and then the user gets a blank screen with nothing to act on.
 *
 * The colours are the literal values behind the `surface`, `content` and `brand` tokens
 * rather than references to them, for the same reason. If those change in
 * `src/theme/tokens.ts` this page will look slightly dated — a trade worth making for a
 * page that must never fail.
 *
 * In practice this should be unreachable. The root layout renders a provider and the
 * children; there is very little in it to break.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout failed", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#ffffff",
          color: "#1a1a1a",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          lineHeight: 1.5,
        }}
      >
        <main role="alert" style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>Something went wrong</h1>

          <p style={{ fontSize: "0.875rem", color: "#5c5c5c", margin: "0 0 1.5rem" }}>
            The application could not start. Anything you have already saved on this device is safe
            and will sync when the app recovers.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                // 44px: the minimum comfortable touch target
                // (docs/06-CODING-PRACTICES.md section 40).
                minHeight: "2.75rem",
                padding: "0 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#4f5bd5",
                color: "#ffffff",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>

            {/*
              A plain anchor, not next/link. The router is part of what may have failed, so a
              full page load is the more reliable escape.
            */}
            <a
              href="/dashboard"
              style={{
                minHeight: "2.75rem",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #d9d9de",
                color: "#1a1a1a",
                fontSize: "0.875rem",
                textDecoration: "none",
              }}
            >
              Go to dashboard
            </a>
          </div>

          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#8a8a94", marginTop: "1.5rem" }}>
              Reference for support: <code style={{ userSelect: "all" }}>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
