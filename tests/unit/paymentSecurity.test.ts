import request from 'supertest';
import { app, prisma } from '../../src/server';
import { PortOneService } from '../../src/services/payment/portoneService';
import { PORTONE_WEBHOOK_FIXTURES } from '../fixtures/portoneWebhooks';

describe('[Jules Compliant] PortOne Payment Security & Webhook Rules', () => {
  beforeAll(async () => {
    // 테스트용 모의 주문 데이터 생성
    await prisma.user.upsert({
      where: { id: 'test-user-pay-1' },
      update: {},
      create: {
        id: 'test-user-pay-1',
        email: 'paytest@example.com',
        name: '결제 테스트 유저',
      },
    });

    // 1) 정상 주문 레코드 (29,000원)
    await prisma.payment.upsert({
      where: { orderId: 'ord_test_success_123' },
      update: { status: 'PENDING' },
      create: {
        userId: 'test-user-pay-1',
        orderId: 'ord_test_success_123',
        planId: 'plan_unlimited_pro',
        amount: 29000,
        status: 'PENDING',
        idempotencyKey: 'idemp_test_success_123',
      },
    });

    // 2) 위변조 공격 대상 주문 레코드 (29,000원)
    await prisma.payment.upsert({
      where: { orderId: 'ord_test_tampered_123' },
      update: { status: 'PENDING' },
      create: {
        userId: 'test-user-pay-1',
        orderId: 'ord_test_tampered_123',
        planId: 'plan_unlimited_pro',
        amount: 29000,
        status: 'PENDING',
        idempotencyKey: 'idemp_test_tampered_123',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── RULE 1 & 4: Zero-Trust Pricing & Auto-Cancellation on Tampering ──
  test('Rule 1 & 4: 29,000원 플랜을 100원으로 결제 시도(위변조) 시 400 거부 및 DB에 TAMPERED_FAILED 기록', async () => {
    const cancelSpy = jest.spyOn(PortOneService, 'cancelTamperedPayment');

    const res = await request(app)
      .post('/api/payment/webhook')
      .send(PORTONE_WEBHOOK_FIXTURES.AMOUNT_TAMPERED);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AMOUNT_TAMPERING_DETECTED');

    // DB 상태 확인
    const record = await prisma.payment.findUnique({
      where: { orderId: 'ord_test_tampered_123' },
    });
    expect(record?.status).toBe('TAMPERED_FAILED');

    // Auto-Cancellation API가 호출되었는지 검증
    expect(cancelSpy).toHaveBeenCalledWith(
      'pay_attack_tampered_002',
      expect.stringContaining('결제 금액 불일치')
    );

    cancelSpy.mockRestore();
  });

  // ── RULE 1: 정상 결제 승인 ──
  test('Rule 1: 금액이 정확히 일치하는 정상 웹훅 수신 시 200 OK 및 DB PAID 갱신', async () => {
    const res = await request(app)
      .post('/api/payment/webhook')
      .send(PORTONE_WEBHOOK_FIXTURES.SUCCESS_PAID);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const record = await prisma.payment.findUnique({
      where: { orderId: 'ord_test_success_123' },
    });
    expect(record?.status).toBe('PAID');
  });

  // ── RULE 3: Idempotency Guard (중복 웹훅 차단) ──
  test('Rule 3: 이미 PAID 처리된 동일 주문 웹훅이 재수신되면 중복 충전 없이 200 OK 반환 (멱등성)', async () => {
    const res = await request(app)
      .post('/api/payment/webhook')
      .send(PORTONE_WEBHOOK_FIXTURES.SUCCESS_PAID);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('already_processed');
  });

  // ── RULE 2: Signature Verification 단위 테스트 ──
  test('Rule 2: 웹훅 시그니처 해시 검증 로직이 위조된 서명을 정확히 거부하는지 확인', () => {
    const payload = JSON.stringify({ test: 'data' });
    const isValid = PortOneService.verifyWebhookSignature(payload, 'invalid_fake_signature_hash');
    expect(isValid).toBe(false);
  });
});
