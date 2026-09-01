import { Request, Response, NextFunction } from 'express';
import '../types/auth';

/**
 * 사용자 인증 및 식별 미들웨어
 * Authorization 헤더 (Bearer <token>) 또는 x-user-id 헤더를 통해 req.user에 주입합니다.
 */
export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const xUserId = req.headers['x-user-id'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]?.trim();
    if (token) {
      req.user = { id: token };
      return next();
    }
  }

  if (xUserId && xUserId.trim() !== '') {
    req.user = { id: xUserId.trim() };
    return next();
  }

  // 개발 및 데모 환경 지원 (Query 또는 Body의 userId 활용)
  if (process.env.NODE_ENV !== 'production') {
    const fallbackUserId = (req.query.userId as string) || (req.body && req.body.userId) || 'demo-user-id';
    req.user = { id: fallbackUserId };
    return next();
  }

  res.status(401).json({
    error: 'UNAUTHORIZED',
    message: '인증 정보가 필요합니다.',
  });
}
