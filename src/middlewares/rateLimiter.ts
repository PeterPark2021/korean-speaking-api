import rateLimit from 'express-rate-limit';

/**
 * 롤플레잉 대화 API 비용 폭주 방지 Rate Limiter
 * 15분당 유저/IP별 최대 40턴 대화 허용
 */
export const roleplayRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: '대화 요청 한도를 초과했습니다. 잠시 후(15분 뒤) 다시 이용해 주세요.',
  },
});

/**
 * CBT 시험 평가 제출 API Rate Limiter
 */
export const examRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: '시험 요청 횟수가 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  },
});
