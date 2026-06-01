import { Router } from "express";
import usersRouter from "./users";
import safesRouter from "./safes";
import warehousesRouter from "./warehouses";
import periodRouter from "./period";
import generalRouter from "./general";

const router = Router();

router.use(usersRouter);
router.use(safesRouter);
router.use(warehousesRouter);
router.use(periodRouter);
router.use(generalRouter);

export default router;
