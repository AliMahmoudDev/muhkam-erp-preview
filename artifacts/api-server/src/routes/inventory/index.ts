/** inventory/index.ts */
import { Router, type IRouter } from 'express';
import auditRouter from './audit';
import writeRouter from './write';
import summaryRouter from './summary';
import analyticsRouter from './analytics';

const router: IRouter = Router();

router.use(auditRouter);
router.use(writeRouter);
router.use(summaryRouter);
router.use(analyticsRouter);

export default router;
