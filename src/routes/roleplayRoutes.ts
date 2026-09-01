import { Router } from 'express';
import { handleRoleplayChat } from '../controllers/roleplayController';
import { authGuard } from '../middlewares/authGuard';
import { roleplayRateLimiter } from '../middlewares/rateLimiter';

const router = Router();
router.post('/chat', authGuard, roleplayRateLimiter, handleRoleplayChat);

export default router;