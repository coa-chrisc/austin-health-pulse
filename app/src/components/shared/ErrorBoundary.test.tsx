import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorBoundary, { ErrorFallback } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("derives error state from a thrown error", () => {
    const err = new Error("boom");
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });

  it("renders children when there is no error", () => {
    const boundary = new ErrorBoundary({ children: "ok" });
    expect(boundary.render()).toBe("ok");
  });

  it("renders the accessible fallback once an error is captured", () => {
    const boundary = new ErrorBoundary({ children: "ok" });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error("boom"));
    const html = renderToStaticMarkup(<>{boundary.render()}</>);
    expect(html).toBe(renderToStaticMarkup(<ErrorFallback />));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Something went wrong loading this view");
    expect(html).toContain("Reload");
    expect(html).toContain('href="#/"');
  });
});
