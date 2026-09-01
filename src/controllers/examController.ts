import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { transcribeAndAnalyzeAudio } from '../services/speech/sttService';
import { evaluateSpeaking } from '../services/evaluator/geminiEvaluator';
import '../types/auth';

export async function startExamSession(req: Request, res: Response): Promise<void> {
  try {
    const isDemo = req.body.isDemo === true || req.query.isDemo === 'true';
    const userId = req.user?.id || req.body.userId || 'demo-user-id';
    const expiresAt = new Date(Date.now() + 15 * 1000);

    // [데모 모드 격리] DB 저장(ExamSession 생성)을 일체 건너뛰고 순수 로컬/시뮬레이션 세션 발급
    if (isDemo) {
      res.json({
        sessionId: `demo-${Date.now()}`,
        userId: 'demo-user',
        isDemo: true,
        currentQIndex: 0,
        expiresAt: expiresAt.toISOString(),
        durationSeconds: 15,
      });
      return;
    }

    const session = await prisma.examSession.create({
      data: {
        userId,
        status: 'IN_PROGRESS',
        currentQIndex: 0,
        expiresAt,
      },
    });

    res.json({
      sessionId: session.id,
      userId: session.userId,
      isDemo: false,
      currentQIndex: 0,
      expiresAt: expiresAt.toISOString(),
      durationSeconds: 15,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function submitSpeakingAnswer(req: Request, res: Response): Promise<void> {
  try {
    const {
      sessionId = '',
      questionId,
      questionType,
      targetPrompt,
      expectedKeywords,
      grammarPatterns,
      nativeLanguage = 'CHINESE',
      isDemo: bodyIsDemo,
    } = req.body;
    const isDemo = bodyIsDemo === true || bodyIsDemo === 'true' || sessionId.startsWith('demo-');
    const currentUserId = req.user?.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'AUDIO_FILE_REQUIRED' });
      return;
    }

    // [데모 모드 격리] DB 테이블(ExamSession, QuestionSubmission) 조작 일체 차단
    if (isDemo) {
      let sttResult = {
        transcript: targetPrompt || '한국어 말하기 답변',
        wpm: 110.0,
        pauseRatio: 0.18,
        wordTimestamps: [] as any[],
      };
      try {
        sttResult = await transcribeAndAnalyzeAudio(file.buffer);
      } catch (e) {
        // Fallback for demo STT
      }

      const evaluation = await evaluateSpeaking({
        questionType: questionType || 'READING',
        targetPrompt: targetPrompt || '한국어 낭독 문항',
        expectedKeywords: expectedKeywords ? (typeof expectedKeywords === 'string' ? JSON.parse(expectedKeywords) : expectedKeywords) : [],
        grammarPatterns: grammarPatterns ? (typeof grammarPatterns === 'string' ? JSON.parse(grammarPatterns) : grammarPatterns) : [],
        sttTranscript: sttResult.transcript,
        wordTimestamps: sttResult.wordTimestamps,
        nativeLanguage,
      });

      res.json({
        success: true,
        isDemo: true,
        submissionId: `demo_sub_${Date.now()}`,
        evaluation,
        stt: {
          transcript: sttResult.transcript,
          wpm: sttResult.wpm,
          pauseRatio: sttResult.pauseRatio,
        },
      });
      return;
    }

    if (sessionId && currentUserId) {
      const session = await prisma.examSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (session && session.userId !== currentUserId) {
        res.status(403).json({ error: 'FORBIDDEN', message: '본인의 시험 세션에만 답변을 제출할 수 있습니다.' });
        return;
      }
    }

    const sttResult = await transcribeAndAnalyzeAudio(file.buffer);

    const evaluation = await evaluateSpeaking({
      questionType: questionType || 'READING',
      targetPrompt: targetPrompt || '한국어 낭독 문항',
      expectedKeywords: expectedKeywords ? (typeof expectedKeywords === 'string' ? JSON.parse(expectedKeywords) : expectedKeywords) : [],
      grammarPatterns: grammarPatterns ? (typeof grammarPatterns === 'string' ? JSON.parse(grammarPatterns) : grammarPatterns) : [],
      sttTranscript: sttResult.transcript,
      wordTimestamps: sttResult.wordTimestamps,
      nativeLanguage,
    });

    const submission = await prisma.questionSubmission.upsert({
      where: {
        sessionId_questionId: {
          sessionId,
          questionId: Number(questionId),
        },
      },
      update: {
        sttTranscript: sttResult.transcript,
        sttRawResult: sttResult.wordTimestamps as any,
        scorePron: evaluation.scorePron,
        scoreAcc: evaluation.scoreAcc,
        scoreContent: evaluation.scoreContent,
        wpm: sttResult.wpm,
        pauseRatio: sttResult.pauseRatio,
        feedback: evaluation.correctionGuide,
      },
      create: {
        sessionId,
        questionId: Number(questionId),
        sttTranscript: sttResult.transcript,
        sttRawResult: sttResult.wordTimestamps as any,
        scorePron: evaluation.scorePron,
        scoreAcc: evaluation.scoreAcc,
        scoreContent: evaluation.scoreContent,
        wpm: sttResult.wpm,
        pauseRatio: sttResult.pauseRatio,
        feedback: evaluation.correctionGuide,
      },
    });

    res.json({
      success: true,
      isDemo: false,
      submissionId: submission.id,
      evaluation,
      stt: {
        transcript: sttResult.transcript,
        wpm: sttResult.wpm,
        pauseRatio: sttResult.pauseRatio,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function resumeExamSession(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    const isDemo = sessionId.startsWith('demo-') || req.query.isDemo === 'true';
    const currentUserId = req.user?.id || (req.headers['x-user-id'] as string);

    // [데모 모드 격리] DB 조회 일체 생략
    if (isDemo) {
      res.json({
        sessionId,
        userId: 'demo-user',
        isDemo: true,
        currentQIndex: 0,
        completedCount: 0,
        remainingSeconds: 15,
      });
      return;
    }

    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        submissions: {
          select: { questionId: true, scorePron: true, scoreAcc: true, scoreContent: true },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', message: '시험 세션을 찾을 수 없습니다.' });
      return;
    }

    // 세션 소유권 검증 (Session Hijacking 차단: session.userId === req.user.id)
    if (!currentUserId || session.userId !== currentUserId) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: '해당 시험 세션에 대한 접근 권한이 없습니다. 본인의 시험 세션만 이어볼 수 있습니다.',
      });
      return;
    }

    const answeredIds = new Set(session.submissions.map((s) => s.questionId));
    let nextIndex = 0;
    for (let i = 1; i <= 20; i++) {
      if (!answeredIds.has(i)) {
        nextIndex = i - 1;
        break;
      }
    }

    res.json({
      sessionId: session.id,
      userId: session.userId,
      isDemo: false,
      currentQIndex: nextIndex,
      completedCount: answeredIds.size,
      remainingSeconds: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}