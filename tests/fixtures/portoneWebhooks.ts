export const PORTONE_WEBHOOK_FIXTURES = {
  // 1. 정상 결제 완료 페이로드
  SUCCESS_PAID: {
    type: 'Transaction.Paid',
    timestamp: '2026-09-01T09:30:00.000Z',
    data: {
      paymentId: 'pay_live_test_001',
      transactionId: 'tx_test_001',
      orderId: 'ord_test_success_123',
      amount: {
        total: 29000,
        paid: 29000,
      },
      currency: 'KRW',
      status: 'PAID',
    },
  },

  // 2. 금액 위변조 공격 페이로드 (29,000원 플랜인데 100원 결제)
  AMOUNT_TAMPERED: {
    type: 'Transaction.Paid',
    timestamp: '2026-09-01T09:30:00.000Z',
    data: {
      paymentId: 'pay_attack_tampered_002',
      transactionId: 'tx_attack_002',
      orderId: 'ord_test_tampered_123',
      amount: {
        total: 100,
        paid: 100,
      },
      currency: 'KRW',
      status: 'PAID',
    },
  },

  // 3. 결제 실패 페이로드
  FAILED_CARD_DECLINE: {
    type: 'Transaction.Failed',
    timestamp: '2026-09-01T09:30:00.000Z',
    data: {
      paymentId: 'pay_fail_003',
      transactionId: 'tx_fail_003',
      orderId: 'ord_test_failed_123',
      amount: {
        total: 29000,
        paid: 0,
      },
      currency: 'KRW',
      status: 'FAILED',
    },
  },
};
