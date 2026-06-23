/** purchases/index.ts */
import { Router, type IRouter } from 'express';
import listRouter from './list';
import createRouter from './create';
import detailRouter from './detail';
import postRouter from './post';
import cancelRouter from './cancel';

const router: IRouter = Router();

router.use(listRouter);
router.use(createRouter);
router.use(detailRouter);
router.use(postRouter);
router.use(cancelRouter);

export default router;
