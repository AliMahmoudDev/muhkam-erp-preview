/**
 * Returns router — mounts sales-returns and purchase-returns sub-routers.
 */
import { Router, type IRouter } from "express";
import salesReturnsRouter    from "./sales-returns";
import purchaseReturnsRouter from "./purchase-returns";

const router: IRouter = Router();

router.use(salesReturnsRouter);
router.use(purchaseReturnsRouter);

export default router;
