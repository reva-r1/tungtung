import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { validateEnvironment } from './config/environment.js';
import { entitiesRouter } from './routes/entities.routes.js';
import { graphRouter } from './routes/graph.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { locationsRouter } from './routes/locations.routes.js';
import { anomaliesRouter } from './routes/anomalies.routes.js';
import { resolutionRouter } from './routes/resolution.routes.js';
import { ingestionRouter } from './routes/ingestion.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { investigationsRouter } from './routes/investigations.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { sourcesRouter } from './routes/sources.routes.js';
import { maritimeRouter } from './routes/maritime.routes.js';
import { MaritimeService } from './services/maritime/maritime.service.js';
import { SourceService } from './services/source.service.js';

import { worldRouter } from './routes/world.routes.js';
import { simulationRouter } from './routes/simulation.routes.js';
import { providersRouter } from './routes/providers.routes.js';
import { aviationRouter } from './routes/aviation.routes.js';
import { aviationService } from './services/aviation/aviation.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OPERATIONAL',
    system: 'REVANA TECHNOLOGIES PLATFORM',
    version: '2.0.0-MULTI-SOURCE',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes (Legacy & Core Revana)
app.use('/api/sources', sourcesRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/graph', graphRouter);
app.use('/api/events', eventsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/resolution', resolutionRouter);
app.use('/api/ingestion', ingestionRouter);
app.use('/api/ai', aiRouter);
app.use('/api/investigations', investigationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/maritime', maritimeRouter);
app.use('/api/aviation', aviationRouter);

// World Model & Connector Layer Routes (accessible via /world, /simulation, /providers and /api/*)
app.use('/world', worldRouter);
app.use('/api/world', worldRouter);
app.use('/simulation', simulationRouter);
app.use('/api/simulation', simulationRouter);
app.use('/providers', providersRouter);
app.use('/api/providers', providersRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Bootstrapping
validateEnvironment();
initDatabase();
MaritimeService.initialize().catch((err) => console.error('Failed to init Maritime Service:', err));

// Start background aviation ingestion with single scheduler
const pollIntervalMs = Number(process.env.OPENSKY_POLL_INTERVAL_MS || 60000);
aviationService.startPolling(pollIntervalMs);

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('[Revana Server] Shutting down background schedulers...');
  aviationService.stopPolling();
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.listen(PORT, () => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('your_'));
  console.log(`=======================================================`);
  console.log(`  REVANA TECHNOLOGIES // INTELLIGENCE PLATFORM`);
  console.log(`  Port: http://localhost:${PORT}`);
  console.log(`  AI Engine: Groq (${hasGroq ? '✔ API Key Verified & Active' : 'Offline Grounded Mode'})`);
  console.log(`  Digital Mirror: http://localhost:${PORT}/world/state`);
  console.log(`=======================================================`);
});

