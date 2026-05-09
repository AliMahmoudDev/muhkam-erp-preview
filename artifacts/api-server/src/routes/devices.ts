/**
 * Devices routes — compatibility re-export.
 *
 * The implementation has been split into the routes/devices/ folder:
 *   - devices/index.ts   (entry point, feature guard, mounts sub-routers)
 *   - devices/crud.ts    (GET/POST/PATCH/DELETE + lookup endpoints)
 *   - devices/sales.ts   (POST /devices/purchase)
 *   - devices/returns.ts (POST /devices/:id/sell|return|maintenance|available)
 *   - devices/_helpers.ts (ctx, nextDeviceNo, Zod schemas)
 *
 * This shim ensures that the existing import in routes/index.ts continues
 * to work without change:
 *   import devicesRouter from "./devices";
 */
export { default } from "./devices/index";
