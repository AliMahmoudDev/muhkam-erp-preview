import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineBanner } from "@/components/offline-banner";

describe("OfflineBanner", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: originalOnLine, writable: true });
  });

  it("renders nothing when online", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    const { container } = render(<OfflineBanner />);
    expect(container.firstElementChild).toBeNull();
  });

  it("shows offline message when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    render(<OfflineBanner />);
    expect(screen.getByText("لا يوجد اتصال بالإنترنت")).toBeInTheDocument();
  });

  it("shows offline banner after offline event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    render(<OfflineBanner />);

    // Initially nothing shown
    expect(screen.queryByText("لا يوجد اتصال بالإنترنت")).not.toBeInTheDocument();

    // Fire offline event
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText("لا يوجد اتصال بالإنترنت")).toBeInTheDocument();
  });

  it("shows recovery message after online event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    render(<OfflineBanner />);

    expect(screen.getByText("لا يوجد اتصال بالإنترنت")).toBeInTheDocument();

    // Fire online event
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByText("تم استعادة الاتصال")).toBeInTheDocument();
  });

  it("hides recovery message after 3 seconds", () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    render(<OfflineBanner />);

    // Go online
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByText("تم استعادة الاتصال")).toBeInTheDocument();

    // Advance time by 3s
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should be gone now
    expect(screen.queryByText("تم استعادة الاتصال")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
