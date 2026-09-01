import { Request, Response } from 'express';
import { processRoleplayTurn } from '../services/learning/roleplayService';

export async function handleRoleplayChat(req: Request, res: Response): Promise<void> {
  try {
    const { topicId, topicTitle, persona, situation, missions, history, userUtterance, nativeLanguage } = req.body;

    const result = await processRoleplayTurn({
      topicId,
      topicTitle,
      persona,
      situation,
      missions: missions || [],
      history: history || [],
      userUtterance,
      nativeLanguage: nativeLanguage || 'CHINESE',
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}