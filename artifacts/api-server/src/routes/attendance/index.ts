/** attendance/index.ts */
import { Router, type IRouter } from 'express';
import shiftsRouter from './shifts';
import recordsRouter from './records';
import summaryRouter from './summary';
import holidaysRouter from './holidays';

const router: IRouter = Router();

router.use(shiftsRouter);
router.use(recordsRouter);
router.use(summaryRouter);
router.use(holidaysRouter);

export default router;
