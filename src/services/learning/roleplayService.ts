import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || 'MOCK_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

export const MAX_ROLEPLAY_TURNS = 7;

export interface RoleplayMessage {
  role: 'user' | 'model';
  text: string;
}

export interface RoleplayChatRequest {
  topicId: string;
  topicTitle: string;
  persona: string;
  situation: string;
  missions: string[];
  history: RoleplayMessage[];
  userUtterance: string;
  nativeLanguage: 'CHINESE' | 'VIETNAMESE' | 'OTHER';
}

export interface RoleplayChatResponse {
  aiResponse: string;
  correctionTip?: string;
  l1Feedback?: string;
  completedMissions: string[];
  isSessionEnded: boolean;
  isSafetyRedirect: boolean;
  turnCount: number;
  maxTurns: number;
}

// 안전 가드레일 (Safety Settings)
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export async function processRoleplayTurn(req: RoleplayChatRequest): Promise<RoleplayChatResponse> {
  const currentHistory = req.history || [];
  const previousUserTurns = currentHistory.filter((m) => m.role === 'user').length;
  const currentTurn = previousUserTurns + 1;

  // 1. 최대 턴 수(7턴) 초과 검증 및 세션 안전 종료
  if (currentTurn > MAX_ROLEPLAY_TURNS) {
    return {
      aiResponse: `오늘 [${req.topicTitle}] 상황에서의 롤플레잉 대화(총 ${MAX_ROLEPLAY_TURNS}턴)를 성공적으로 마쳤습니다! 수고 많으셨습니다. 이제 새로운 주제로 대화를 연습해 보세요!`,
      correctionTip: '전체 대화 흐름에 걸쳐 목표 표현을 적극적으로 사용하셨습니다.',
      l1Feedback: '성취한 미션 목록과 발음 가이드를 복습해 보세요.',
      completedMissions: req.missions || [],
      isSessionEnded: true,
      isSafetyRedirect: false,
      turnCount: MAX_ROLEPLAY_TURNS,
      maxTurns: MAX_ROLEPLAY_TURNS,
    };
  }

  // 2. 모의 응답 (API Key 미설정 시 안전 데모 모드)
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key' || process.env.GEMINI_API_KEY === 'MOCK_API_KEY') {
    const isLastTurn = currentTurn === MAX_ROLEPLAY_TURNS;
    return {
      aiResponse: isLastTurn
        ? `네, 손님! 요청하신 내역 모두 확인했습니다. 오늘 대화 연습 즐거웠습니다! (세션 완료)`
        : `네, 손님! 따뜻한 아메리카노 한 잔 준비해 드리겠습니다. 더 필요하신 것은 없으신가요?`,
      correctionTip: "'아메리카노 하나 주세요'라고 부드럽게 높임말을 잘 사용하셨습니다.",
      l1Feedback: "받침 'ㄹ'(달라/주세요) 발음 시 혀끝을 윗잇몸에 가볍게 밀착시켜 주세요.",
      completedMissions: [req.missions[0] || '음료 주문하기'],
      isSessionEnded: isLastTurn,
      isSafetyRedirect: false,
      turnCount: currentTurn,
      maxTurns: MAX_ROLEPLAY_TURNS,
    };
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 400, // 비용 폭주 방지 토큰 제한
      temperature: 0.7,
    },
  });

  const isLastTurn = currentTurn === MAX_ROLEPLAY_TURNS;

  const systemPrompt = `
당신은 한국어 어학연수생 및 유학생(미성년자 포함)을 위한 교육용 AI 롤플레잉 파트너입니다.

[상황 및 페르소나]
- 대화 주제: ${req.topicTitle}
- 당신의 역할: ${req.persona}
- 상황 설정: ${req.situation}
- 학습자가 완수해야 할 미션: ${JSON.stringify(req.missions)}
- 학습자 모국어: ${req.nativeLanguage}
- 현재 턴 진행도: ${currentTurn} / ${MAX_ROLEPLAY_TURNS} 턴 ${isLastTurn ? '(이번 턴이 마지막 마무리 턴입니다)' : ''}

[안전 가드레일 및 콘텐츠 모더레이션 지침 (CRITICAL)]
1. 미성년자 보호 및 안전: 욕설, 비속어, 성적 표현, 혐오 발언, 폭력, 불법 행위, 위험 행동 유도 등 부적절하거나 유해한 입력에 절대 동조하거나 긍정하지 마십시오.
2. 부적절 입력 시 자연스러운 리다이렉트: 학습자가 부적절하거나 맥락에 맞지 않는 말을 한 경우, 당황하거나 공격적으로 대응하지 말고 페르소나(${req.persona})의 품위를 유지하며 공손하고 자연스럽게 본래 학습 상황(${req.situation})으로 대화를 복귀시키세요. (예: "손님, 말씀하신 내용 대신 주문하실 음료 메뉴를 말씀해 주시겠어요?")
3. 부적절 입력으로 판단되어 주제를 전환한 경우 "isSafetyRedirect": true 로 출력하고, 정상 대화인 경우 false로 설정하세요.

[역할 수행 및 피드백 지침]
1. 당신의 페르소나에 100% 몰입하여 자연스러운 한국어(구어체)로 1~2문장의 대답과 역질문을 하세요. ${isLastTurn ? '마지막 턴이므로 대화를 자연스럽게 마무리하는 인사를 건네세요.' : ''}
2. 학습자의 문법이나 어색한 표현이 있다면 친절한 한국어 교정 팁을 제공하세요.
3. 모국어(${req.nativeLanguage}) 학습자 관점의 조음/발음 팁을 제공하세요.
4. 학습자가 이번 발화로 완수한 미션이 있다면 completedMissions 배열에 포함하세요.

[출력 JSON 규격]
{
  "aiResponse": string (페르소나의 한국어 답변),
  "correctionTip": string (문법/표현 교정 가이드),
  "l1Feedback": string (발음/억양 교정 가이드),
  "completedMissions": string[] (이번 턴까지 완수된 미션 목록),
  "isSafetyRedirect": boolean (부적절 입력 감지 및 주제 복귀 여부)
}
`;

  try {
    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n[이전 대화 기록]\n${JSON.stringify(currentHistory)}\n\n[학습자의 최근 발화]\n"${req.userUtterance}"` }],
        },
      ],
    });

    const candidate = response.response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      return {
        aiResponse: `${req.persona}로서 대화를 계속 진행할게요. ${req.topicTitle} 상황에 맞는 한국어로 편하게 말씀해 주시겠어요?`,
        correctionTip: '학습 상황에 맞는 올바르고 정중한 한국어 표현을 사용해 주세요.',
        l1Feedback: '상황에 적절한 어휘와 높임말을 연습해 보세요.',
        completedMissions: [],
        isSessionEnded: isLastTurn,
        isSafetyRedirect: true,
        turnCount: currentTurn,
        maxTurns: MAX_ROLEPLAY_TURNS,
      };
    }

    const rawText = response.response.text();
    const parsed = JSON.parse(rawText);

    return {
      aiResponse: parsed.aiResponse || '네, 알겠습니다. 말씀 계속해 주세요.',
      correctionTip: parsed.correctionTip,
      l1Feedback: parsed.l1Feedback,
      completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      isSessionEnded: isLastTurn,
      isSafetyRedirect: Boolean(parsed.isSafetyRedirect),
      turnCount: currentTurn,
      maxTurns: MAX_ROLEPLAY_TURNS,
    };
  } catch (error: any) {
    // 안전 필터 또는 기타 오류 시 안전 Fallback 응답
    return {
      aiResponse: `네, 이해했습니다. ${req.topicTitle} 상황에 맞춰 계속 말씀해 주세요!`,
      correctionTip: '부드럽고 자연스러운 어조로 말하는 연습을 해보세요.',
      l1Feedback: '문장의 끝억양을 자연스럽게 내려주세요.',
      completedMissions: [],
      isSessionEnded: isLastTurn,
      isSafetyRedirect: false,
      turnCount: currentTurn,
      maxTurns: MAX_ROLEPLAY_TURNS,
    };
  }
}