/**
 * routes/reports.ts — compatibility shim
 *
 * The actual implementation has been split into focused sub-routers under
 * routes/reports/ (see routes/reports/index.ts).
 *
 * TypeScript resolves `import from "./reports"` to this file first (before
 * the directory index), so we simply re-export the default router from the
 * new location.
 */
export { default } from "./reports/index";
