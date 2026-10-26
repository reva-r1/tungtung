import { Router, Request, Response } from 'express';
import { AiService } from '../services/ai.service.js';
import { NlService } from '../services/nl.service.js';
import dotenv from 'dotenv';

dotenv.config();

export const aiRouter = Router();

// AI investigation assistant query
aiRouter.post('/investigate', async (req: Request, res: Response) => {
  try {
    const { prompt, entityId, investigationId, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await AiService.investigate(prompt, { entityId, investigationId, history });
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
aiRouter.post('/tool', async (req: Request, res: Response) => {
  try {
    const { toolName, args } = req.body;
    const output = await AiService.executeTool(toolName, args || {});
    res.json({ toolName, output });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Omni-Sensor AI Reasoning Space Chat Endpoint (With Perpetual SQLite Memory)
aiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, entityId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message string is required' });
    }

    const result = await AiService.chatReasoning(message, sessionId, entityId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Chat History for Session
aiRouter.get('/chat/history/:sessionId', (req: Request, res: Response) => {
  try {
    const history = AiService.getChatHistory(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear Chat History for Session
aiRouter.delete('/chat/history/:sessionId', (req: Request, res: Response) => {
  try {
    const cleared = AiService.clearChatHistory(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, cleared });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check AI status & configuration
aiRouter.get('/status', async (req: Request, res: Response) => {
  const model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
  res.json({
    provider: `Revana Technologies AI Engine (Ollama ${model} / Grounded Sensors)`,
    model,
    isLiveKeyConfigured: true,
    mode: 'LOCAL_OLLAMA_LLAMA',
    capabilities: [
      'Real-Time Multi-Sensor Telemetry Reasoning',
      'Open-Meteo Weather & Air Quality Live Analysis',
      'USGS Earthquakes & GDACS Alerts Synthesis',
      'Hydro Basin Gauges & Reservoir Monitoring',
      'Grid Power & Substation Load Traversal',
      'Digital Twin Simulation Cascading Reasoning',
      'Perpetual Multi-Turn Chat Memory',
    ],
  });
});
