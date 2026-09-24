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
 * The colours and the square corners are the literal values behind the `paper`, `ink`,
 * `teal` and `line.card` tokens rather than references to them, for the same reason — it
 * must not import even `raw-colors.ts`. That makes this the one file a palette change has
 * to be applied to by hand, which is why it is listed as a consumer in
 * `src/theme/raw-colors.ts` and in the group 23 update document.
 *
 * It is not themed for dark mode. A page that renders when the provider failed cannot ask
 * the provider what mode it is in, and `prefers-color-scheme` in an inline style would mean
 * duplicating the whole block. Light-only is the honest choice here.
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
          background: "#FAF7F2",
          color: "#1E1B29",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          lineHeight: 1.5,
        }}
      >
        <main role="alert" style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>Something went wrong</h1>

          <p style={{ fontSize: "0.875rem", color: "#5B5770", margin: "0 0 1.5rem" }}>
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
                borderRadius: 0,
                // Ink border and a hard offset shadow: the primary button of this design,
                // reproduced without the theme that normally draws it.
                border: "2px solid #1E1B29",
                boxShadow: "4px 4px 0 #1E1B29",
                background: "#7FD1C3",
                color: "#1E1B29",
                fontSize: "0.875rem",
                fontWeight: 600,
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
                borderRadius: 0,
                border: "2px solid #1E1B29",
                background: "#FFFFFF",
                color: "#1E1B29",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to dashboard
            </a>
          </div>

          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#726E8A", marginTop: "1.5rem" }}>
              Reference for support: <code style={{ userSelect: "all" }}>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
