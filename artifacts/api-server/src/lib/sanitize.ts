import xss from "xss";

export function sanitizeString(input: string): string {
  if (typeof input !== "string") return input;
  return xss(input.trim());
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    // eslint-disable-next-line security/detect-object-injection
    if (typeof result[key] === "string") {
      // eslint-disable-next-line security/detect-object-injection
      (result as Record<string, unknown>)[key] = sanitizeString(result[key] as string);
    }
  }
  return result;
}
