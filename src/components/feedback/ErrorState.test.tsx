import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@tests/helpers/render";
import { ErrorState } from "./ErrorState";

/**
 * The shared presentation for every error boundary in the app, so the three things section
 * 45 of docs/12-SECURITY-AND-ERROR-HANDLING.md asks for are worth pinning down: a friendly
 * state, a retry, and a route back to safe ground.
 */

describe("ErrorState", () => {
  it("announces itself as an alert", () => {
    renderWithProviders(<ErrorState />);

    // A crashed screen is worth interrupting a screen reader for, unlike a status update.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("offers a way back even with no retry available", () => {
    renderWithProviders(<ErrorState />);

    const home = screen.getByRole("link", { name: /go to dashboard/i });
    expect(home).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("calls the boundary's reset when retried", () => {
    const onRetry = vi.fn();

    renderWithProviders(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    // `reset` re-renders the failed segment rather than reloading, so a queued sync keeps
    // running across the retry.
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the digest so a report can be matched to a server log", () => {
    renderWithProviders(<ErrorState digest="a1b2c3d4e5" />);

    // In production this hash is the only thing linking what the user saw to a log entry:
    // Next replaces the real message with a generic string.
    expect(screen.getByText("a1b2c3d4e5")).toBeInTheDocument();
    expect(screen.getByText(/reference for support/i)).toBeInTheDocument();
  });

  it("omits the reference block when there is no digest", () => {
    renderWithProviders(<ErrorState />);

    expect(screen.queryByText(/reference for support/i)).not.toBeInTheDocument();
  });

  it("does not promise the data is safe unless the caller says so", () => {
    // The default copy talks about "nothing you have already saved", which is true anywhere.
    // The stronger claim about the sync queue is only accurate inside the authenticated
    // shell, so it has to be passed in rather than assumed.
    renderWithProviders(<ErrorState />);
    expect(screen.queryByText(/still queued/i)).not.toBeInTheDocument();

    renderWithProviders(
      <ErrorState description="Your saved data is safe. Anything waiting to sync is still queued." />,
    );
    expect(screen.getByText(/still queued/i)).toBeInTheDocument();
  });

  it("accepts an alternative destination for unauthenticated screens", () => {
    // The root boundary uses this: a signed-out user cannot reach the dashboard.
    renderWithProviders(<ErrorState homeHref="/" homeLabel="Start again" />);

    expect(screen.getByRole("link", { name: /start again/i })).toHaveAttribute("href", "/");
  });
});
