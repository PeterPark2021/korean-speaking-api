# Jules Backend Rules & Constraints (Zero-Defect Standard)

1. **Audio Guard**: Multer로 3MB 이하, WAV/WebM 형식 오디오만 수신 처리. VAD를 통해 무음 구간 사전 트리밍.
2. **STT Pipeline**: Google Cloud STT v2(16kHz mono ko-KR) 사용, 500ms 이상 지연을 Pause로 감지하고 WPM 계산.
3. **AI Schema Validation**: Gemini 응답은 반드시 Zod 스키마로 검증하고 점수(발음 0~20, 문법/정확성 0~40, 내용 0~40)를 강제 클램프.
4. **PortOne Payment Security & 4대 결제 보안 규칙**:
   - **Zero-Trust Pricing**: 결제 완료 승인 시 클라이언트 전달 금액이 아닌 서버 DB의 `PLAN_PRICES` 카탈로그와 1원 단위까지 대조.
   - **Signature Verification**: `webhook-signature` 헤더를 `PORTONE_WEBHOOK_SECRET` 기반 HMAC-SHA256 해시로 전수 검증.
   - **Idempotency Guard**: `Payment.idempotencyKey` / `orderId` 조회를 통해 중복 결제 및 중복 크레딧 충전을 물리적으로 차단(이미 처리된 건은 `already_processed`로 200 OK 응답).
   - **Auto-Cancellation on Tampering**: 결제 금액 위변조 감지 즉시 고객 크레딧 충전을 중단하고 DB 상태를 `TAMPERED_FAILED`로 기록 후 PortOne Cancel API를 자동 호출하여 부정 결제를 즉시 환불 처리.
5. **CBT Session Recovery & Ownership Security**: 서버가 발급한 `expiresAt` 기준으로 만료 검증, 중복 제출 방지 `@@unique([sessionId, questionId])` 준수. 세션 이어보기(`/api/exam/session/:id/resume`) 및 제출(`/submit`) 처리 시 반드시 로그인된 사용자 소유권(`session.userId === req.user.id`)을 검증하고, 불일치 시 403 Forbidden(`FORBIDDEN`)을 반환하여 Session Hijacking 방지.
6. **Data Retention**: STT 원본 및 오디오 메타데이터는 90일 후 자동 NULL 처리/파기 배치 가동.
7. **Roleplay Safety & Rate Limiting**: 미성년 학습자 보호를 위해 Gemini `safetySettings`(HARASSMENT, HATE_SPEECH, SEXUALLY_EXPLICIT, DANGEROUS_CONTENT)를 필수로 활성화하고, 부적절 발화 시 공격적 대응 없이 페르소나 품위를 유지하며 본래 상황으로 리다이렉트(`isSafetyRedirect: true`)하도록 시스템 프롬프트 설계. 세션당 최대 7턴 및 `maxOutputTokens: 400` 강제, `express-rate-limit`(15분당 40회)을 통한 비용 폭주 차단.
8. **Demo Mode Data Isolation**: 장애/오프라인 환경용 데모 모드(`isDemo: true` 또는 `sessionId.startsWith('demo-')`) 요청은 데이터베이스 테이블(`ExamSession`, `QuestionSubmission` 등)에 일체 쓰기 작업을 하지 않고 순수 인메모리/시뮬레이션 응답으로 분리 처리하여 가짜 데이터의 DB 오염 방지.
