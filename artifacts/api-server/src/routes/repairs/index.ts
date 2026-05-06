import { Router, type IRouter } from "express";
import { requireFeature } from "../../middleware/feature-guard";
import jobsRouter from "./jobs";
import partsRouter from "./parts";
import paymentsRouter from "./payments";
import deliveryRouter from "./delivery";

const router: IRouter = Router();

/* Feature-gate maintenance module on all repair-related path prefixes.
   Must be registered BEFORE the sub-routers so it intercepts every request. */
router.use(
  ["/repair-jobs", "/repair-statuses", "/repair-customers", "/repair-checklist-items", "/scrap-items"],
  requireFeature("maintenance"),
);

router.use(jobsRouter);
router.use(partsRouter);
router.use(paymentsRouter);
router.use(deliveryRouter);

export default router;
