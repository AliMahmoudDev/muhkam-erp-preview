/**
 * Devices router — entry point.
 *
 * Applies the "maintenance" feature guard to the entire /devices namespace,
 * then mounts the three sub-routers:
 *   - crud.ts    → GET/POST/PATCH/DELETE /devices + lookup endpoints
 *   - sales.ts   → POST /devices/purchase
 *   - returns.ts → POST /devices/:id/sell|return|maintenance|available
 *
 * Import path for routes/index.ts stays unchanged:
 *   import devicesRouter from "./devices";
 */
import { Router } from "express";
import { requireFeature } from "../../middleware/feature-guard";
import crudRouter    from "./crud";
import salesRouter   from "./sales";
import returnsRouter from "./returns";

const router = Router();

router.use("/devices", requireFeature("maintenance"));

router.use(crudRouter);
router.use(salesRouter);
router.use(returnsRouter);

export default router;
