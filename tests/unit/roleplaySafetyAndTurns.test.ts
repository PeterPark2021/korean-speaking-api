import { processRoleplayTurn, MAX_ROLEPLAY_TURNS } from '../../src/services/learning/roleplayService';

describe('Roleplay Moderation, Safety Guardrails & Turn Limits Test', () => {
  it(`최대 턴 수(${MAX_ROLEPLAY_TURNS}턴) 도달 시 세션을 정상 종료하고 isSessionEnded=true를 반환해야 함`, async () => {
    // 7턴 이전 대화 기록 생성
    const mockHistory = Array.from({ length: 7 }, (_, i) => [
      { role: 'user' as const, text: `학습자 발화 ${i + 1}` },
      { role: 'model' as const, text: `AI 페르소나 응답 ${i + 1}` },
    ]).flat();

    const response = await processRoleplayTurn({
      topicId: 'cafe_order',
      topicTitle: '카페에서 주문하기',
      persona: '친절한 카페 바리스타',
      situation: '점심시간에 붐비는 카페에서 음료 주문하기',
      missions: ['음료 주문하기', '사이즈 및 온도 선택하기'],
      history: mockHistory,
      userUtterance: '영수증도 같이 챙겨주세요.',
      nativeLanguage: 'CHINESE',
    });

    expect(response.isSessionEnded).toBe(true);
    expect(response.turnCount).toBe(MAX_ROLEPLAY_TURNS);
    expect(response.aiResponse).toContain('성공적으로 마쳤습니다');
  });

  it('기본 턴 진행 시 turnCount와 maxTurns 정보를 정확히 포함해야 함', async () => {
    const response = await processRoleplayTurn({
      topicId: 'cafe_order',
      topicTitle: '카페에서 주문하기',
      persona: '친절한 카페 바리스타',
      situation: '점심시간에 붐비는 카페에서 음료 주문하기',
      missions: ['음료 주문하기'],
      history: [],
      userUtterance: '따뜻한 아메리카노 한 잔 주세요.',
      nativeLanguage: 'CHINESE',
    });

    expect(response.turnCount).toBe(1);
    expect(response.maxTurns).toBe(MAX_ROLEPLAY_TURNS);
    expect(response.isSessionEnded).toBe(false);
    expect(typeof response.isSafetyRedirect).toBe('boolean');
  });
});
