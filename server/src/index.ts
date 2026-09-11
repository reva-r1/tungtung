import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { seedDatabase } from './db/seedData.js';
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
import { SourceService } from './services/source.service.js';

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
    system: 'AEGIS INTEL PLATFORM',
    version: '2.0.0-MULTI-SOURCE',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
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

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Bootstrapping
initDatabase();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  AEGIS INTEL // INTELLIGENCE PLATFORM`);
  console.log(`  Port: http://localhost:${PORT}`);
  console.log(`  AI Engine: Groq Tool-Calling Agent / Local Grounded`);
  console.log(`=======================================================`);
});

