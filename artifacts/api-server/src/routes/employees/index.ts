/**
 * HR — employees, departments, job-titles
 * Entry point: assembles sub-routers under requireFeature("hr")
 */
import { Router } from 'express';
import { requireFeature } from '../../middleware/feature-guard';
import profileRouter   from './profile';
import contractsRouter from './contracts';
import leavesRouter    from './leaves';

const router = Router();

router.use(["/employees", "/departments", "/job-titles"], requireFeature("hr"));

router.use(profileRouter);
router.use(contractsRouter);
router.use(leavesRouter);

export default router;
