import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className merge utility)", () => {
  it("merges multiple class strings", () => {
    const result = cn("text-ink", "bg-black");
    expect(result).toContain("text-ink");
    expect(result).toContain("bg-black");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles undefined and null values", () => {
    const result = cn("base", undefined, null, "extra");
    expect(result).toContain("base");
    expect(result).toContain("extra");
  });

  it("handles conditional classes via clsx syntax", () => {
    const isActive = true;
    const result = cn("btn", isActive && "btn-active");
    expect(result).toContain("btn");
    expect(result).toContain("btn-active");
  });

  it("removes falsy conditional classes", () => {
    const isActive = false;
    const result = cn("btn", isActive && "btn-active");
    expect(result).toBe("btn");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });

  it("deduplicates identical classes", () => {
    const result = cn("p-4", "p-4");
    expect(result).toBe("p-4");
  });

  it("merges padding conflicts correctly", () => {
    const result = cn("p-4", "p-2");
    expect(result).toBe("p-2");
  });

  it("handles array input", () => {
    const result = cn(["flex", "items-center"]);
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
  });
});
