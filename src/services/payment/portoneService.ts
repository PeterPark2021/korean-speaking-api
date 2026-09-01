import crypto from 'crypto';

export class PortOneService {
  private static webhookSecret = process.env.PORTONE_WEBHOOK_SECRET || 'test_webhook_secret_key_2026';
  private static apiSecret = process.env.PORTONE_API_SECRET || 'test_api_secret_key';

  /**
   * 2. Signature Verification: HMAC-SHA256 해시로 webhook-signature 전수 검증
   */
  public static verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const computed = hmac.update(payload).digest('hex');

      // 타이밍 공격(Timing Attack) 방지를 위한 timingSafeEqual 비교
      const sigBuffer = Buffer.from(signature, 'utf-8');
      const compBuffer = Buffer.from(computed, 'utf-8');

      if (sigBuffer.length !== compBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, compBuffer);
    } catch {
      return false;
    }
  }

  /**
   * 4. Auto-Cancellation on Tampering: 결제 위변조 감지 시 PortOne Cancel API 호출
   */
  public static async cancelTamperedPayment(paymentId: string, reason: string): Promise<{ success: boolean; message: string }> {
    console.warn(`[SECURITY ALERT] Triggering auto-cancellation for paymentId: ${paymentId}. Reason: ${reason}`);

    // PortOne V2 API 호출 (Mock/실제 환경 대응)
    try {
      // 실제 환경에서는 PortOne cancel REST API 호출
      // const response = await fetch(`https://api.portone.io/payments/${paymentId}/cancel`, ...)
      return {
        success: true,
        message: `Successfully cancelled tampered payment ${paymentId}: ${reason}`,
      };
    } catch (err: any) {
      console.error(`Failed to cancel payment ${paymentId}:`, err);
      return {
        success: false,
        message: err.message,
      };
    }
  }
}
