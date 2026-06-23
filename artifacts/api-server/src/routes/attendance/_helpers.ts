
export function fmt(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}
