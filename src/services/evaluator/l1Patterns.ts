export interface L1Pattern {
  id: string;
  category: 'VOWEL' | 'CONSONANT' | 'PHONOLOGY' | 'INTONATION';
  errorFeature: string;
  example: string;
  articulatoryGuide: string;
}

export const L1_ERROR_PATTERNS_CHINESE: L1Pattern[] = [
  {
    id: 'CN_V_01',
    category: 'VOWEL',
    errorFeature: 'ㅡ / ㅓ 모음 혼동',
    example: "'어른'을 '으른'으로 발음",
    articulatoryGuide: "'ㅓ' 발음 시 턱을 아래로 내리고 입을 더 크게 벌려야 합니다 (후설 저모음).",
  },
  {
    id: 'CN_V_02',
    category: 'VOWEL',
    errorFeature: 'ㅓ / ㅗ 모음 혼동',
    example: "'서울'을 '소울'로 발음",
    articulatoryGuide: "'ㅓ'는 입술을 둥글게 모으지 않고 평평하게 유지해야 합니다.",
  },
  {
    id: 'CN_C_01',
    category: 'CONSONANT',
    errorFeature: '평음/격음/경음 (ㄱ/ㅋ/ㄲ, ㄷ/ㅌ/ㄸ, ㅂ/ㅍ/ㅃ) 구분 혼선',
    example: "'달'을 '탈' 또는 '딸'로 발음",
    articulatoryGuide: "평음은 목에 힘을 빼고 부드럽게, 격음은 강한 기식(바람)을 내뿜고, 경음은 목을 긴장시켜 숨을 참았다가 발음합니다.",
  },
  {
    id: 'CN_C_02',
    category: 'CONSONANT',
    errorFeature: '어말 종성 ㄹ(받침) 탈락 또는 [r]화',
    example: "'물'을 '무' 또는 [mur]로 발음",
    articulatoryGuide: "받침 'ㄹ'은 혀끝을 윗잇몸 뒤(치경)에 단단히 붙이고 공기를 혀 양옆으로 흘려보내야 합니다.",
  },
  {
    id: 'CN_P_01',
    category: 'PHONOLOGY',
    errorFeature: '비음화/유음화 음운 규칙 미적용',
    example: "'국물'을 [궁물]이 아닌 [국물]로 단절 발음",
    articulatoryGuide: "받침 'ㄱ' 뒤에 'ㅁ'이 오면 자연스럽게 코로 소리를 내어 [ㅇ]으로 동화시켜 발음하세요.",
  }
];

export const L1_ERROR_PATTERNS_VIETNAMESE: L1Pattern[] = [
  {
    id: 'VN_V_01',
    category: 'VOWEL',
    errorFeature: 'ㅡ / ㅜ / ㅗ 모음 변별 혼동',
    example: "'음식'을 '움식'으로 발음",
    articulatoryGuide: "'ㅡ'는 입술을 양옆으로 길게 찢고 혀의 뒤쪽을 올려 발음합니다.",
  },
  {
    id: 'VN_C_01',
    category: 'CONSONANT',
    errorFeature: '어두 자음 ㄹ을 [z] 또는 [d]로 치환',
    example: "'라면'을 '자면' 또는 '다면'으로 발음",
    articulatoryGuide: "시작하는 'ㄹ'은 혀끝을 윗잇몸에 가볍게 튕기며 [l]/[ɾ]로 시작해야 합니다.",
  },
  {
    id: 'VN_C_02',
    category: 'CONSONANT',
    errorFeature: '종성(받침) ㄱ/ㄷ/ㅂ의 불파음화 과도 폐쇄 및 성문파열음화',
    example: "'밥' 발음 시 입술을 급격히 닫아 호흡 차단",
    articulatoryGuide: "한국어 폐쇄음 받침은 소리를 끊되 목에 과도한 압력을 주지 않고 부드럽게 닫습니다.",
  },
  {
    id: 'VN_I_01',
    category: 'INTONATION',
    errorFeature: '성조 습관으로 인한 어휘 내 불필요한 고저 굴곡',
    example: "문장 중간 단어에서 음조가 급상승",
    articulatoryGuide: "한국어는 성조 언어가 아니므로 문장 전체를 평탄하고 완만한 억양 곡선으로 유지하세요.",
  }
];