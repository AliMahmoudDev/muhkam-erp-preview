/**
 * Sales router — entry point.
 *
 * Mounts the three sub-routers that together handle the full sale lifecycle:
 *   - create.ts   → POST /sales
 *   - reports.ts  → GET /sales, GET /sales/:id, POST /sales/:id/post
 *   - returns.ts  → POST /sales/:id/cancel
 *
 * The file is the directory index so `import salesRouter from "./sales"` in
 * routes/index.ts resolves here automatically (Node directory resolution).
 */
import { Router, type IRouter } from "express";
import createRouter  from "./create";
import reportsRouter from "./reports";
import returnsRouter from "./returns";

const router: IRouter = Router();

router.use(createRouter);
router.use(reportsRouter);
router.use(returnsRouter);

export default router;
