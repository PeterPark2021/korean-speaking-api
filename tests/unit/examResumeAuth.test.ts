import { resumeExamSession } from '../../src/controllers/examController';
import { prisma } from '../../src/config/prisma';
import { Request, Response } from 'express';

// Mock prisma
jest.mock('../../src/config/prisma', () => ({
  prisma: {
    examSession: {
      findUnique: jest.fn(),
    },
  },
}));

describe('CBT Session Resume Authorization Test (Session Hijacking Prevention)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('404를 반환해야 함: 세션이 존재하지 않는 경우', async () => {
    mockReq = {
      params: { sessionId: 'non-existent-id' },
      user: { id: 'user-1' },
      headers: {},
    };

    (prisma.examSession.findUnique as jest.Mock).mockResolvedValue(null);

    await resumeExamSession(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'SESSION_NOT_FOUND' })
    );
  });

  it('403 Forbidden을 반환해야 함: 다른 사용자의 sessionId를 가로채 접근(Session Hijacking)하는 경우', async () => {
    mockReq = {
      params: { sessionId: 'victim-session-id' },
      user: { id: 'attacker-user-id' },
      headers: {},
    };

    (prisma.examSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'victim-session-id',
      userId: 'victim-user-id', // 소유자 불일치
      expiresAt: new Date(Date.now() + 60000),
      submissions: [],
    });

    await resumeExamSession(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'FORBIDDEN',
      })
    );
  });

  it('200 OK 및 세션 복구 정보를 반환해야 함: 본인의 세션(session.userId === req.user.id)에 접근하는 경우', async () => {
    const validUserId = 'valid-owner-id';
    mockReq = {
      params: { sessionId: 'valid-session-id' },
      user: { id: validUserId },
      headers: {},
    };

    (prisma.examSession.findUnique as jest.Mock).mockResolvedValue({
      id: 'valid-session-id',
      userId: validUserId,
      expiresAt: new Date(Date.now() + 60000),
      submissions: [
        { questionId: 1, scorePron: 18, scoreAcc: 35, scoreContent: 36 },
        { questionId: 2, scorePron: 19, scoreAcc: 38, scoreContent: 37 },
      ],
    });

    await resumeExamSession(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'valid-session-id',
        userId: validUserId,
        currentQIndex: 2, // 3번째 문항(인덱스 2)부터 이어보기
        completedCount: 2,
      })
    );
  });
});
