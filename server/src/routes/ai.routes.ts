import { Router, Request, Response } from 'express';
import { AiService } from '../services/ai.service.js';
import { NlService } from '../services/nl.service.js';
import dotenv from 'dotenv';

dotenv.config();

export const aiRouter = Router();

// AI investigation assistant query
aiRouter.post('/investigate', async (req: Request, res: Response) => {
  try {
    const { prompt, entityId, investigationId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await AiService.investigate(prompt, { entityId, investigationId });
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Natural Language Query translator & multi-modal investigation builder
aiRouter.post('/nl-query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const result = await NlService.query(query);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execute controlled backend tool on behalf of AI
aiRouter.post('/tool', (req: Request, res: Response) => {
  try {
    const { toolName, args } = req.body;
    const output = AiService.executeTool(toolName, args || {});
    res.json({ toolName, output });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check AI status & configuration
aiRouter.get('/status', (req: Request, res: Response) => {
  const hasKey = !!(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim() !== '' && !process.env.XAI_API_KEY.includes('your_xai_api_key'));
  res.json({
    provider: 'Grok / xAI API',
    model: process.env.XAI_MODEL || 'grok-2-latest',
    isLiveKeyConfigured: hasKey,
    mode: hasKey ? 'LIVE_GROK_API' : 'DETERMINISTIC_LOCAL_ENGINE',
    capabilities: [
      'Grounded Entity Graph Analysis',
      'Telemetry Speed Physics Verification',
      'Multi-Hop Path Traversal',
      'Anomaly Correlation',
      'Tactical Next-Step Generation',
    ],
  });
});
