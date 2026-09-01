import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import examRoutes from './routes/examRoutes';
import roleplayRoutes from './routes/roleplayRoutes';
import paymentRoutes from './routes/paymentRoutes';

dotenv.config();

export const prisma = new PrismaClient();
export const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/exam', examRoutes);
app.use('/api/learning/roleplay', roleplayRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    rules: 'Jules Compliant: Zero-Trust Pricing, Webhook Signature, Idempotency, Auto-Cancel',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 [K-Speaking API] 서버가 포트 ${PORT}에서 정상 실행 중입니다.`);
  });
}