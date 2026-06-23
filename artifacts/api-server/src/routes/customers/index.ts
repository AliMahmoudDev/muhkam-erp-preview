/**
 * customers/index.ts — re-exports all customer sub-routers
 */
import { Router, type IRouter } from 'express';
import listCreateRouter from './list_create';
import crudRouter from './crud';
import paymentsRouter from './payments';
import classificationsRouter from './classifications';
import reportsRouter from './reports';

const router: IRouter = Router();

router.use(listCreateRouter);
router.use(crudRouter);
router.use(paymentsRouter);
router.use(classificationsRouter);
router.use(reportsRouter);

export { normalizeName, getNextCustomerCode } from './_helpers';
export default router;
