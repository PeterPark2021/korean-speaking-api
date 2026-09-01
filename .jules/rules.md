# Jules Backend Rules & Constraints (Zero-Defect Standard)

1. **Audio Guard**: Multer로 3MB 이하, WAV/WebM 형식 오디오만 수신 처리. VAD를 통해 무음 구간 사전 트리밍.
2. **STT Pipeline**: Google Cloud STT v2(16kHz mono ko-KR) 사용, 500ms 이상 지연을 Pause로 감지하고 WPM 계산.
3. **AI Schema Validation**: Gemini 응답은 반드시 Zod 스키마로 검증하고 점수(발음 0~20, 문법/정확성 0~40, 내용 0~40)를 강제 클램프.
4. **Server Pricing Intent**: 결제 금액은 클라이언트 파라미터를 신뢰하지 않고 서버 가격표(`PLAN_PRICES`)를 기준으로 `/api/payment/intent`에서 발급. PortOne Webhook 이중화 처리.
5. **CBT Session Recovery**: 서버가 발급한 `expiresAt` 기준으로 만료 검증, 중복 제출 방지 `@@unique([sessionId, questionId])` 준수 및 `/resume` API 제공.
6. **Data Retention**: STT 원본 및 오디오 메타데이터는 90일 후 자동 NULL 처리/파기 배치 가동.
