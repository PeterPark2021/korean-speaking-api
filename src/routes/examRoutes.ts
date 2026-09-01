import { Router } from 'express';
import { startExamSession, submitSpeakingAnswer, resumeExamSession } from '../controllers/examController';
import { audioUpload } from '../middlewares/uploadGuard';
import { authGuard } from '../middlewares/authGuard';

const router = Router();

router.post('/start', authGuard, startExamSession);
router.post('/submit', authGuard, audioUpload.single('audio'), submitSpeakingAnswer);
router.get('/session/:sessionId/resume', authGuard, resumeExamSession);

export default router;