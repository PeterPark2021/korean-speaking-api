import { SpeechClient } from '@google-cloud/speech';

let speechClient: SpeechClient | null = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    speechClient = new SpeechClient();
  }
} catch (e) {
  console.warn('[STT] Google Speech Client Mock 모드로 동작');
}

export interface WordTimestamp {
  word: string;
  startOffset: number;
  endOffset: number;
  confidence: number;
}

export interface STTAnalysisResult {
  transcript: string;
  wordTimestamps: WordTimestamp[];
  wpm: number;
  pauseRatio: number;
  longPauseCount: number;
}

export async function transcribeAndAnalyzeAudio(audioBuffer: Buffer): Promise<STTAnalysisResult> {
  if (!speechClient || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {
      transcript: '안녕하세요 한국어 말하기 시험 연습 중입니다',
      wordTimestamps: [
        { word: '안녕하세요', startOffset: 0, endOffset: 800, confidence: 0.95 },
        { word: '한국어', startOffset: 1100, endOffset: 1500, confidence: 0.92 },
        { word: '말하기', startOffset: 1600, endOffset: 1900, confidence: 0.90 },
        { word: '시험', startOffset: 2000, endOffset: 2300, confidence: 0.93 },
        { word: '연습', startOffset: 2500, endOffset: 2800, confidence: 0.89 },
        { word: '중입니다', startOffset: 2900, endOffset: 3400, confidence: 0.94 },
      ],
      wpm: 105.8,
      pauseRatio: 0.22,
      longPauseCount: 0,
    };
  }

  const audioBytes = audioBuffer.toString('base64');
  const request = {
    audio: { content: audioBytes },
    config: {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: 16000,
      languageCode: 'ko-KR',
      enableWordTimeOffsets: true,
      enableWordConfidence: true,
    },
  };

  const [response] = await speechClient.recognize(request);
  const result = response.results?.[0];
  const alternative = result?.alternatives?.[0];

  const transcript = alternative?.transcript || '';
  const words = alternative?.words || [];

  const wordTimestamps: WordTimestamp[] = words.map((w) => {
    const startSec = Number(w.startTime?.seconds || 0) + Number(w.startTime?.nanos || 0) / 1e9;
    const endSec = Number(w.endTime?.seconds || 0) + Number(w.endTime?.nanos || 0) / 1e9;
    return {
      word: w.word || '',
      startOffset: Math.round(startSec * 1000),
      endOffset: Math.round(endSec * 1000),
      confidence: w.confidence || 0.85,
    };
  });

  let longPauseCount = 0;
  let totalPauseTimeMs = 0;
  for (let i = 0; i < wordTimestamps.length - 1; i++) {
    const gap = wordTimestamps[i + 1].startOffset - wordTimestamps[i].endOffset;
    if (gap >= 500) {
      longPauseCount++;
      totalPauseTimeMs += gap;
    }
  }

  const totalDurationSec = wordTimestamps.length > 0
    ? (wordTimestamps[wordTimestamps.length - 1].endOffset - wordTimestamps[0].startOffset) / 1000
    : 1;
  const totalDurationMs = Math.max(1000, totalDurationSec * 1000);
  const wpm = totalDurationSec > 0 ? (wordTimestamps.length / totalDurationSec) * 60 : 0;
  const pauseRatio = Math.min(1.0, totalPauseTimeMs / totalDurationMs);

  return {
    transcript,
    wordTimestamps,
    wpm: Math.round(wpm * 10) / 10,
    pauseRatio: Math.round(pauseRatio * 100) / 100,
    longPauseCount,
  };
}