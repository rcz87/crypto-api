/**
 * Screening Routes
 * Router configuration untuk screening endpoints
 */

import { Router } from 'express';
import { 
  getScreener, 
  postScreenerRun, 
  getScreenerRun,
  getSupportedSymbols 
} from './screener.controller.js';

export const screenerRouter = Router();

// GET /api/screener - Jalankan screening on-demand
screenerRouter.get('/', getScreener);

// POST /api/screener/run - Jalankan run terjadwal/custom
screenerRouter.post('/run', postScreenerRun);

// GET /api/screener/:runId - Hasil cached run
screenerRouter.get('/:runId', getScreenerRun);

// GET /api/screener/supported-symbols - Daftar symbols yang didukung
screenerRouter.get('/meta/supported-symbols', getSupportedSymbols);

export default screenerRouter;