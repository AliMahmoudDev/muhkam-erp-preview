/**
 * Re-exports the employees router from the split directory.
 * The original monolithic file has been split into:
 *   employees/helpers.ts  — shared helpers + Zod schema
 *   employees/profile.ts  — main employee CRUD
 *   employees/contracts.ts — departments + job-titles
 *   employees/leaves.ts   — documents, contacts, status history
 *   employees/index.ts    — thin router that mounts all sub-routers
 */
export { default } from './employees/index';
