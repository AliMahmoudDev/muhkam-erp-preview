// Minimal ambient declarations so TypeScript recognises Node globals
// used in Playwright test files without requiring @types/node.
declare const process: {
  env: Record<string, string | undefined>;
};
