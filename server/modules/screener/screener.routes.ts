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

// GET /api/screener/supported-symbols - Daftar symbols yang didukung (harus di atas runId)
screenerRouter.get('/supported-symbols', getSupportedSymbols);

// GET /api/screener - Jalankan screening on-demand
screenerRouter.get('/', getScreener);

// POST /api/screener/run - Jalankan run terjadwal/custom
screenerRouter.post('/run', postScreenerRun);

// GET /api/screener/:runId - Hasil cached run (harus di bawah route spesifik lainnya)
screenerRouter.get('/:runId', getScreenerRun);

export default screenerRouter;