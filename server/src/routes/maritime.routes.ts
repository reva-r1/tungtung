import { Router } from 'express';
import { MaritimeService } from '../services/maritime/maritime.service.js';
import { MaritimePatternDetector } from '../services/maritime/patternDetector.service.js';
import { MaritimeReasoningService } from '../services/maritime/maritimeReasoning.service.js';

export const maritimeRouter = Router();

// GET /api/maritime/status - AIS provider connectivity & feed metrics
maritimeRouter.get('/status', (req, res) => {
  const status = MaritimeService.getProviderStatus();
  res.json(status);
});

// GET /api/maritime/vessels - All active moving vessels
maritimeRouter.get('/vessels', (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 300));
  const vessels = MaritimeService.getAllVessels(limit);
  res.json({
    total: vessels.length,
    vessels,
  });
});

// GET /api/maritime/vessels/:id - Single vessel detail
maritimeRouter.get('/vessels/:id', (req, res) => {
  const vessel = MaritimeService.getVesselById(req.params.id);
  if (!vessel) {
    return res.status(404).json({ error: `Vessel "${req.params.id}" not found.` });
  }
  res.json(vessel);
});

// GET /api/maritime/vessels/:id/track - Historical position trail
maritimeRouter.get('/vessels/:id/track', (req, res) => {
  const limit = Math.min(200, Math.max(2, Number(req.query.limit) || 64));
  const track = MaritimeService.getVesselTrack(req.params.id, limit);
  res.json({
    entity_id: req.params.id,
    point_count: track.length,
    track,
  });
});

// GET /api/maritime/patterns - Detected geographic and temporal patterns
maritimeRouter.get('/patterns', (req, res) => {
  // Run live deterministic detection pass
  MaritimePatternDetector.runDetection();
  const patterns = MaritimePatternDetector.getPatterns();
  res.json({
    total: patterns.length,
    patterns,
  });
});

// GET /api/maritime/patterns/:id - Single pattern details
maritimeRouter.get('/patterns/:id', (req, res) => {
  const pattern = MaritimePatternDetector.getPatternById(req.params.id);
  if (!pattern) {
    return res.status(404).json({ error: `Pattern "${req.params.id}" not found.` });
  }
  res.json(pattern);
});

// POST /api/maritime/patterns/:id/investigate - Trigger Revana AI hypothesis reasoning
maritimeRouter.post('/patterns/:id/investigate', async (req, res) => {
  try {
    const result = await MaritimeReasoningService.investigatePattern(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to analyze pattern.' });
  }
});

// GET /api/maritime/events/stream - Real-Time Server-Sent Events (SSE) for Live Map
maritimeRouter.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  MaritimeService.addSseClient(res);
});
