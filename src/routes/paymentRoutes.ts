import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authGuard } from '../middlewares/authGuard';

const router = Router();

// 1. 결제 인텐트 발급 (인증 필요)
router.post('/intent', authGuard, PaymentController.createPaymentIntent);

// 2. PortOne Webhook 수신 엔드포인트
router.post('/webhook', PaymentController.handlePortOneWebhook);

export default router;
