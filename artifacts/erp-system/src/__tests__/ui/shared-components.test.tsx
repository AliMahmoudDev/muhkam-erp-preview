import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PrimaryBtn,
  DangerBtn,
  GhostBtn,
  SInput,
  SSelect,
  FieldLabel,
} from "@/pages/settings/_shared";

/* ─────────────────────────────────────────────────────────────── */
/* PrimaryBtn                                                       */
/* ─────────────────────────────────────────────────────────────── */
describe("PrimaryBtn", () => {
  it("renders children text", () => {
    render(<PrimaryBtn>حفظ</PrimaryBtn>);
    expect(screen.getByRole("button", { name: "حفظ" })).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<PrimaryBtn onClick={onClick}>حفظ</PrimaryBtn>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and does not call onClick when disabled prop is set", () => {
    const onClick = vi.fn();
    render(<PrimaryBtn disabled onClick={onClick}>حفظ</PrimaryBtn>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("merges extra className", () => {
    render(<PrimaryBtn className="my-extra-class">حفظ</PrimaryBtn>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("my-extra-class");
  });

  it("applies amber gradient class", () => {
    render(<PrimaryBtn>حفظ</PrimaryBtn>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("amber");
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* DangerBtn                                                        */
/* ─────────────────────────────────────────────────────────────── */
describe("DangerBtn", () => {
  it("renders children text", () => {
    render(<DangerBtn>حذف</DangerBtn>);
    expect(screen.getByRole("button", { name: "حذف" })).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<DangerBtn onClick={onClick}>حذف</DangerBtn>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is set", () => {
    render(<DangerBtn disabled>حذف</DangerBtn>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("has red styling", () => {
    render(<DangerBtn>حذف</DangerBtn>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("red");
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* GhostBtn                                                         */
/* ─────────────────────────────────────────────────────────────── */
describe("GhostBtn", () => {
  it("renders children text", () => {
    render(<GhostBtn>إلغاء</GhostBtn>);
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<GhostBtn onClick={onClick}>إلغاء</GhostBtn>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is set", () => {
    render(<GhostBtn disabled>إلغاء</GhostBtn>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("has border styling (ghost style)", () => {
    render(<GhostBtn>إلغاء</GhostBtn>);
    const btn = screen.getByRole("button");
    expect(btn.style.border).toBeTruthy();
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* SInput                                                           */
/* ─────────────────────────────────────────────────────────────── */
describe("SInput", () => {
  it("renders as an input element", () => {
    render(<SInput placeholder="اكتب هنا" />);
    expect(screen.getByPlaceholderText("اكتب هنا")).toBeTruthy();
  });

  it("passes value and onChange correctly", () => {
    const onChange = vi.fn();
    render(<SInput value="مرحبا" onChange={onChange} readOnly />);
    const input = screen.getByDisplayValue("مرحبا");
    expect(input).toBeTruthy();
  });

  it("respects type attribute", () => {
    render(<SInput type="number" data-testid="num-input" />);
    const input = screen.getByTestId("num-input") as HTMLInputElement;
    expect(input.type).toBe("number");
  });

  it("is disabled when disabled prop is set", () => {
    render(<SInput disabled data-testid="dis-input" />);
    expect(screen.getByTestId("dis-input")).toBeDisabled();
  });

  it("merges extra className", () => {
    render(<SInput className="custom-class" data-testid="cls-input" />);
    const input = screen.getByTestId("cls-input");
    expect(input.className).toContain("custom-class");
  });

  it("fires onChange when user types", () => {
    const onChange = vi.fn();
    render(<SInput onChange={onChange} data-testid="type-input" />);
    fireEvent.change(screen.getByTestId("type-input"), { target: { value: "test" } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* SSelect                                                          */
/* ─────────────────────────────────────────────────────────────── */
describe("SSelect", () => {
  const opts = [
    { value: 'a', label: 'خيار أ' },
    { value: 'b', label: 'خيار ب' },
  ];

  it("renders a combobox with options", () => {
    render(
      <SSelect options={opts} value="a" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it("reflects value prop by showing selected label", () => {
    const onChange = vi.fn();
    render(
      <SSelect options={opts} value="b" onChange={onChange} />,
    );
    expect(screen.getByText('خيار ب')).toBeInTheDocument();
  });

  it("calls onChange with string value when selection changes", () => {
    const onChange = vi.fn();
    render(
      <SSelect options={opts} value="a" onChange={onChange} />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* FieldLabel                                                       */
/* ─────────────────────────────────────────────────────────────── */
describe("FieldLabel", () => {
  it("renders children text", () => {
    render(<FieldLabel>اسم المستخدم</FieldLabel>);
    expect(screen.getByText("اسم المستخدم")).toBeTruthy();
  });

  it("renders as a label element", () => {
    render(<FieldLabel>البريد الإلكتروني</FieldLabel>);
    const el = screen.getByText("البريد الإلكتروني");
    expect(el.tagName.toLowerCase()).toBe("label");
  });
});
