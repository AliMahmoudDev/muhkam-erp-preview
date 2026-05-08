/**
 * /api/auth/* — assembles all auth sub-routers.
 */
import { Router } from 'express';
import loginRouter from './login';
import registerRouter from './register';
import totpRouter from './totp';

const router = Router();

router.use(loginRouter);
router.use(registerRouter);
router.use(totpRouter);

export default router;
