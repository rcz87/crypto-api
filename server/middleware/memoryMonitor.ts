/**
 * ⚙️ Express Middleware for Real-Time Memory Info
 * Endpoint: GET /health/memory
 */

import { Request, Response, NextFunction } from "express";
import { memoryGuard } from "../utils/memoryGuard.js";

export const memoryMonitor = (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = memoryGuard.getStats();
    
    // Determine health status based on heap usage
    let status = "healthy";
    let statusColor = "green";
    
    if (stats.heapPercent > 85 && stats.heapPercent <= 90) {
      status = "warning";
      statusColor = "yellow";
    } else if (stats.heapPercent > 90) {
      status = "critical";
      statusColor = "red";
    }

    res.json({
      status,
      statusColor,
      memory: stats,
      thresholds: {
        warning: 85,
        critical: 90,
        restart: 95
      },
      gc_enabled: typeof global.gc === "function",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to get memory stats",
      message: error?.message
    });
  }
};
