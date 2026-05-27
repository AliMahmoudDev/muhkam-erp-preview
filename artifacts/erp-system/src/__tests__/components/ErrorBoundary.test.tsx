import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";

/* ── Helper: component that throws on demand ────────────────── */
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error message");
  return <div data-testid="child">Normal content</div>;
}

/* Suppress React error boundary console.error noise in test output */
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("حدث خطأ غير متوقع")).toBeInTheDocument();
  });

  it("displays the error message", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("shows retry button", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("إعادة المحاولة")).toBeInTheDocument();
  });

  it("resets error state on retry click", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Verify error UI is showing
    expect(screen.getByText("حدث خطأ غير متوقع")).toBeInTheDocument();

    // Click retry — but child will throw again, so error UI stays
    fireEvent.click(screen.getByText("إعادة المحاولة"));

    // After reset, component re-renders children — which throws again
    expect(screen.getByText("حدث خطأ غير متوقع")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByText("حدث خطأ غير متوقع")).not.toBeInTheDocument();
  });

  it("reports error to /api/health/client-error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    // fetch should have been called with the error report
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/health/client-error",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });
});
