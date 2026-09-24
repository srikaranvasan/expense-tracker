import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { EmptyState } from "./EmptyState";

/**
 * The empty state's title is a heading.
 *
 * Group 40 found it was a `<p>`. The group 28 restyle replaced a `Heading` with a styled `Text`, the
 * pixels came out identical, and nothing in the suite noticed — the two not-found pages lost their
 * only heading, and every empty list lost the landmark a screen-reader user navigates by.
 *
 * The regression was invisible to every visual check and to every measurement, which is the argument
 * for asserting the role rather than the styling.
 */

describe("EmptyState", () => {
  it("renders its title as a heading", () => {
    renderWithProviders(<EmptyState title="No settlements yet" />);
    expect(screen.getByRole("heading", { name: "No settlements yet" })).toBeInTheDocument();
  });

  it("defaults to h2, because a PageHeader usually owns the h1", () => {
    renderWithProviders(<EmptyState title="No accounts yet" />);
    expect(screen.getByRole("heading", { level: 2, name: "No accounts yet" })).toBeInTheDocument();
  });

  it("can be the page's h1, for a route with no PageHeader", () => {
    // The two not-found pages. Their title is the whole message of the page.
    renderWithProviders(<EmptyState title="Page not found" titleAs="h1" />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });

  it("does not promote the eyebrow to a heading", () => {
    /*
     * `ERROR 404` is a status line, not a section title. Two headings here would give a page with one
     * sentence on it two entries in the heading outline.
     */
    renderWithProviders(<EmptyState eyebrow="Error 404" title="Page not found" titleAs="h1" />);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByText("Error 404")).toBeInTheDocument();
  });
});
