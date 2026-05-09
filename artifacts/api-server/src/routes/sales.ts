/**
 * Sales routes — compatibility re-export.
 *
 * The implementation has been split into the routes/sales/ folder:
 *   - sales/index.ts   (entry point, mounts sub-routers)
 *   - sales/create.ts  (POST /sales)
 *   - sales/reports.ts (GET /sales, GET /sales/:id, POST /sales/:id/post)
 *   - sales/returns.ts (POST /sales/:id/cancel)
 *   - sales/_helpers.ts (shared formatters and journal builder)
 *
 * This shim ensures that the existing import in routes/index.ts continues
 * to work without change:
 *   import salesRouter from "./sales";
 */
export { default } from "./sales/index";
