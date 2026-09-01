import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import pRetry from 'p-retry';
import { L1_ERROR_PATTERNS_CHINESE, L1_ERROR_PATTERNS_VIETNAMESE } from './l1Patterns';
import { WordTimestamp } from '../speech/sttService';

export const EvaluationResultSchema = z.object({
  scorePron: z.number().min(0).max(20),
  scoreAcc: z.number().min(0).max(40),
  scoreContent: z.number().min(0).max(40),
  isCorrect: z.boolean(),
  correctionGuide: z.string().max(1000),
  nativeSpecificFeedback: z.string().max(1000),
  phonemeIssues: z.array(z.string()).max(20),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

const apiKey = process.env.GEMINI_API_KEY || 'MOCK_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

export interface EvaluationPayload {
  questionType: 'READING' | 'FILL_BLANK' | 'DESCRIBE_IMAGE' | 'ANSWER_QUESTION';
  targetPrompt: string;
  expectedKeywords: string[];
  grammarPatterns: string[];
  sttTranscript: string;
  wordTimestamps: WordTimestamp[];
  nativeLanguage: 'CHINESE' | 'VIETNAMESE' | 'OTHER';
}

export async function evaluateSpeaking(payload: EvaluationPayload): Promise<EvaluationResult> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
    return {
      scorePron: 18,
      scoreAcc: 36,
      scoreContent: 35,
      isCorrect: true,
      correctionGuide: '문장 구조와 조사의 사용이 매우 자연스럽습니다.',
      nativeSpecificFeedback: '받침 ㄹ 발음 시 혀끝을 윗잇몸에 단단히 밀착시키면 더욱 원어민에 가까워집니다.',
      phonemeIssues: ['종성 ㄹ 폐쇄'],
    };
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const l1Ref = payload.nativeLanguage === 'CHINESE'
    ? L1_ERROR_PATTERNS_CHINESE
    : L1_ERROR_PATTERNS_VIETNAMESE;

  const prompt = `
당신은 국립국어원 표준 기반의 전문 한국어 말하기 공인 채점관입니다.
총 100점(발음 20, 문법/정확성 40, 내용 40) 기준으로 채점하세요.

[문항 정보]
- 유형: ${payload.questionType}
- 질문: ${payload.targetPrompt}
- 필수 어휘: ${payload.expectedKeywords.join(', ')}
- 문법 기준: ${payload.grammarPatterns.join(', ')}

[응시자 발화 데이터]
- 모국어: ${payload.nativeLanguage}
- STT 인식 텍스트: "${payload.sttTranscript}"
- 단어 타임스탬프: ${JSON.stringify(payload.wordTimestamps)}

[모국어 빈출 오류 DB]
${JSON.stringify(l1Ref)}

[출력 JSON 스키마 규격]
{
  "scorePron": number (0~20),
  "scoreAcc": number (0~40),
  "scoreContent": number (0~40),
  "isCorrect": boolean,
  "correctionGuide": string,
  "nativeSpecificFeedback": string,
  "phonemeIssues": string[]
}
`;

  const rawText = await pRetry(
    async () => {
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return response.response.text();
    },
    {
      retries: 2,
      minTimeout: 800,
    }
  );

  let rawJson: any;
  try {
    rawJson = JSON.parse(rawText || '{}');
  } catch (e) {
    throw new Error('FAILED_TO_PARSE_GEMINI_JSON');
  }

  const parseResult = EvaluationResultSchema.safeParse(rawJson);
  if (!parseResult.success) {
    return {
      scorePron: Math.min(20, Math.max(0, Number(rawJson?.scorePron) || 12)),
      scoreAcc: Math.min(40, Math.max(0, Number(rawJson?.scoreAcc) || 24)),
      scoreContent: Math.min(40, Math.max(0, Number(rawJson?.scoreContent) || 24)),
      isCorrect: Boolean(rawJson?.isCorrect),
      correctionGuide: String(rawJson?.correctionGuide || '평가 완료'),
      nativeSpecificFeedback: String(rawJson?.nativeSpecificFeedback || '발음 점검 권장'),
      phonemeIssues: Array.isArray(rawJson?.phonemeIssues) ? rawJson.phonemeIssues : [],
    };
  }

  return parseResult.data;
}