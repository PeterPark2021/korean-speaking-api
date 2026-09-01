import { startExamSession, submitSpeakingAnswer, resumeExamSession } from '../../src/controllers/examController';
import { prisma } from '../../src/config/prisma';
import { Request, Response } from 'express';

// Mock prisma
jest.mock('../../src/config/prisma', () => ({
  prisma: {
    examSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    questionSubmission: {
      upsert: jest.fn(),
    },
  },
}));

// Mock STT & Evaluator
jest.mock('../../src/services/speech/sttService', () => ({
  transcribeAndAnalyzeAudio: jest.fn().mockResolvedValue({
    transcript: '안녕하세요',
    wpm: 100,
    pauseRatio: 0.2,
    wordTimestamps: [],
  }),
}));

jest.mock('../../src/services/evaluator/geminiEvaluator', () => ({
  evaluateSpeaking: jest.fn().mockResolvedValue({
    scorePron: 18,
    scoreAcc: 36,
    scoreContent: 35,
    correctionGuide: '좋은 발음입니다.',
  }),
}));

describe('Demo Mode Database Isolation Test', () => {
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

  it('startExamSession: isDemo: true 일 때 Prisma create를 호출하지 않고 데모 세션을 반환해야 함', async () => {
    mockReq = {
      body: { isDemo: true, userId: 'test-user' },
      query: {},
      user: { id: 'test-user' },
      headers: {},
    };

    await startExamSession(mockReq as Request, mockRes as Response);

    // Prisma DB 생성이 호출되지 않아야 함
    expect(prisma.examSession.create).not.toHaveBeenCalled();
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isDemo: true,
        sessionId: expect.stringMatching(/^demo-/),
      })
    );
  });

  it('submitSpeakingAnswer: sessionId가 demo-로 시작할 때 DB upsert를 건너뛰어야 함', async () => {
    mockReq = {
      body: {
        sessionId: 'demo-session-12345',
        questionId: '1',
        isDemo: true,
      },
      file: { buffer: Buffer.from('mock audio') } as any,
      user: { id: 'demo-user' },
      headers: {},
    };

    await submitSpeakingAnswer(mockReq as Request, mockRes as Response);

    // QuestionSubmission 테이블에 upsert가 호출되지 않아야 함
    expect(prisma.questionSubmission.upsert).not.toHaveBeenCalled();
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        isDemo: true,
      })
    );
  });

  it('resumeExamSession: demo 세션 조회 시 DB를 쿼리하지 않고 즉시 로컬 데모 상태를 반환해야 함', async () => {
    mockReq = {
      params: { sessionId: 'demo-session-99999' },
      query: {},
      headers: {},
    };

    await resumeExamSession(mockReq as Request, mockRes as Response);

    expect(prisma.examSession.findUnique).not.toHaveBeenCalled();
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isDemo: true,
        sessionId: 'demo-session-99999',
      })
    );
  });
});
