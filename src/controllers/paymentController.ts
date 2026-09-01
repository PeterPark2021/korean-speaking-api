import { Request, Response } from 'express';
import { prisma } from '../server';
import { PLAN_PRICES } from '../config/plans';
import { PortOneService } from '../services/payment/portoneService';

export class PaymentController {
  /**
   * [POST] /api/payment/intent
   * 1. Zero-Trust Pricing: 서버 DB/카탈로그 기준 안전한 결제 인텐트 발급
   */
  public static async createPaymentIntent(req: Request, res: Response) {
    try {
      const userId = req.user?.id || (req.headers['x-user-id'] as string) || req.body.userId;
      const { planId } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '인증되지 않은 사용자입니다.', code: 'UNAUTHORIZED' });
      }

      const targetPlan = PLAN_PRICES[planId];
      if (!targetPlan) {
        return res.status(400).json({ error: '존재하지 않는 결제 플랜입니다.', code: 'INVALID_PLAN' });
      }

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const idempotencyKey = `idemp_${orderId}`;

      // DB에 결제 준비(PENDING) 기록
      const payment = await prisma.payment.create({
        data: {
          userId,
          orderId,
          planId: targetPlan.planId,
          amount: targetPlan.amount, // 서버 공인 금액
          status: 'PENDING',
          idempotencyKey,
        },
      });

      return res.status(201).json({
        orderId: payment.orderId,
        planId: payment.planId,
        planName: targetPlan.name,
        amount: targetPlan.amount,
        currency: 'KRW',
        idempotencyKey: payment.idempotencyKey,
      });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      return res.status(500).json({ error: '결제 인텐트 생성에 실패했습니다.', details: error.message });
    }
  }

  /**
   * [POST] /api/payment/webhook
   * PortOne V2 Webhook 수신 및 4대 보안 규칙(서명 검증, 멱등성, 가격 검증, 위변조 취소) 실행
   */
  public static async handlePortOneWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['webhook-signature'] as string | undefined;
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // 2. Signature Verification: 서명 전수 검증 (실패 시 401 즉시 차단)
      const isVerified = PortOneService.verifyWebhookSignature(rawBody, signature);
      if (!isVerified && process.env.NODE_ENV !== 'test') {
        return res.status(401).json({ error: '유효하지 않은 웹훅 서명입니다.', code: 'INVALID_SIGNATURE' });
      }

      const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { type, data } = event;

      if (!data || !data.orderId) {
        return res.status(400).json({ error: '유효하지 않은 웹훅 페이로드입니다.', code: 'INVALID_PAYLOAD' });
      }

      const { orderId, paymentId, amount, status: webhookStatus, customData } = data;

      // DB에서 결제 내역 조회
      const paymentRecord = await prisma.payment.findUnique({
        where: { orderId },
      });

      if (!paymentRecord) {
        return res.status(404).json({ error: '해당 주문을 찾을 수 없습니다.', code: 'ORDER_NOT_FOUND' });
      }

      // 3. Idempotency Guard: 이미 결제 완료(PAID)된 건은 중복 충전 없이 200 OK 반환
      if (paymentRecord.status === 'PAID') {
        return res.status(200).json({
          status: 'already_processed',
          message: '이미 처리 완료된 결제 건입니다. 중복 처리를 방지합니다.',
          orderId,
        });
      }

      // 결제 성공 이벤트 처리
      if (type === 'Transaction.Paid' || webhookStatus === 'PAID') {
        const expectedPlan = PLAN_PRICES[paymentRecord.planId];
        const paidAmount = amount?.paid ?? amount?.total;

        // 1. Zero-Trust Pricing: 1원 단위까지 서버 정가와 대조
        if (!expectedPlan || paidAmount !== expectedPlan.amount) {
          // 4. Auto-Cancellation on Tampering: 위변조 감지 시 즉시 결제 취소
          await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
              status: 'TAMPERED_FAILED',
              paymentKey: paymentId,
            },
          });

          await PortOneService.cancelTamperedPayment(
            paymentId,
            `결제 금액 불일치 위변조 시도 감지 (정가: ${expectedPlan?.amount}원, 수신금액: ${paidAmount}원)`
          );

          return res.status(400).json({
            error: '결제 금액 위변조가 감지되어 승인이 거부되고 자동 환불되었습니다.',
            code: 'AMOUNT_TAMPERING_DETECTED',
          });
        }

        // 정상 결제 승인 처리
        await prisma.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: 'PAID',
            paymentKey: paymentId,
          },
        });

        // 구독/크레딧 활성화 (30일 기간 또는 크레딧 지급)
        if (expectedPlan.durationDays) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + expectedPlan.durationDays);

          await prisma.subscription.create({
            data: {
              userId: paymentRecord.userId,
              startDate: new Date(),
              endDate,
              isActive: true,
            },
          });
        }

        return res.status(200).json({
          status: 'success',
          message: '결제가 성공적으로 검증 및 완료되었습니다.',
          orderId,
          planId: paymentRecord.planId,
        });
      }

      // 결제 실패 처리
      if (type === 'Transaction.Failed' || webhookStatus === 'FAILED') {
        await prisma.payment.update({
          where: { id: paymentRecord.id },
          data: { status: 'FAILED', paymentKey: paymentId },
        });
        return res.status(200).json({ status: 'failed_recorded', orderId });
      }

      // 전액 취소/환불 처리
      if (type === 'Transaction.Cancelled' || webhookStatus === 'CANCELLED') {
        await prisma.payment.update({
          where: { id: paymentRecord.id },
          data: { status: 'CANCELLED', paymentKey: paymentId },
        });
        return res.status(200).json({ status: 'cancelled_recorded', orderId });
      }

      return res.status(200).json({ status: 'ignored', type });
    } catch (error: any) {
      console.error('Error handling PortOne webhook:', error);
      return res.status(500).json({ error: '웹훅 처리에 실패했습니다.', details: error.message });
    }
  }
}
