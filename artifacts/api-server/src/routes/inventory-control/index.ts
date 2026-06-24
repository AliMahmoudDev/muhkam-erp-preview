/** inventory-control/index.ts */
import { Router, type IRouter } from 'express';
import countSessionsRouter from './count_sessions';
import transfersRouter from './transfers';
import enrichedRouter from './enriched';

const router: IRouter = Router();

router.use(countSessionsRouter);
router.use(transfersRouter);
router.use(enrichedRouter);

export default router;
