import { Router, type IRouter } from "express";
import { requireFeature } from "../../middleware/feature-guard";
import jobsRouter from "./jobs";
import partsRouter from "./parts";
import paymentsRouter from "./payments";
import deliveryRouter from "./delivery";
import techReceiptsRouter from "./technician-receipts";
import photosRouter from "./photos";
import serviceTypesRouter from "./service-types";
import jobServicesRouter from "./job-services";

const router: IRouter = Router();

/* Feature-gate maintenance module on all repair-related path prefixes.
   Must be registered BEFORE the sub-routers so it intercepts every request. */
router.use(
  ["/repair-jobs", "/repair-statuses", "/repair-customers", "/repair-checklist-items", "/scrap-items", "/repair-service-types"],
  requireFeature("maintenance"),
);

router.use(jobsRouter);
router.use(partsRouter);
router.use(paymentsRouter);
router.use(deliveryRouter);
router.use(techReceiptsRouter);
router.use(photosRouter);
router.use(serviceTypesRouter);
router.use(jobServicesRouter);

export default router;
