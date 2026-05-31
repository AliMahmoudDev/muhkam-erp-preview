import { Router, type IRouter } from "express";
import warrantyRouter from "./warranty";
import customerReturnRouter from "./customer-return";
import qaChecklistRouter from "./qa-checklist";
import preDeliveryRouter from "./pre-delivery";
import shippingRouter from "./shipping";

const router: IRouter = Router();

router.use(warrantyRouter);
router.use(customerReturnRouter);
router.use(qaChecklistRouter);
router.use(preDeliveryRouter);
router.use(shippingRouter);

export default router;
