import { Router, Request, Response } from 'express';
import { simulationService } from '../services/simulation/simulation.service.js';

export const simulationRouter = Router();

// GET /simulation
simulationRouter.get('/', (req: Request, res: Response) => {
  try {
    const list = simulationService.listSimulations();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /simulation/create
simulationRouter.post('/create', (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Simulation name is required' });
    }
    const sim = simulationService.createSimulation(name, description);
    res.status(201).json(sim);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /simulation/:id/modify
simulationRouter.post('/:id/modify', (req: Request, res: Response) => {
  try {
    const { modifications } = req.body;
    if (!Array.isArray(modifications)) {
      return res.status(400).json({ error: 'modifications array is required: [{ entity_id, properties }]' });
    }
    const result = simulationService.modifySimulation(req.params.id, modifications);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /simulation/:id/state
simulationRouter.get('/:id/state', (req: Request, res: Response) => {
  try {
    const state = simulationService.getSimulationState(req.params.id);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /simulation/:id/reset
simulationRouter.post('/:id/reset', (req: Request, res: Response) => {
  try {
    const result = simulationService.resetSimulation(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /simulation/:id
simulationRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = simulationService.deleteSimulation(req.params.id);
    res.json({ deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
