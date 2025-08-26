import { type SystemMetrics, type InsertSystemMetrics, type SystemLogs, type InsertSystemLogs } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Metrics operations
  updateMetrics(responseTime: number): Promise<void>;
  getLatestMetrics(): Promise<SystemMetrics | undefined>;
  getTodayRequestCount(): Promise<number>;
  
  // Logs operations  
  addLog(log: InsertSystemLogs): Promise<SystemLogs>;
  getRecentLogs(limit: number): Promise<SystemLogs[]>;
}

export class MemStorage implements IStorage {
  private metrics: Map<string, SystemMetrics>;
  private logs: Map<string, SystemLogs>;
  private dailyRequestCount: number;
  private lastResetDate: string;

  constructor() {
    this.metrics = new Map();
    this.logs = new Map();
    this.dailyRequestCount = 0;
    this.lastResetDate = new Date().toDateString();
  }

  private resetDailyCountIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyRequestCount = 0;
      this.lastResetDate = today;
    }
  }

  async updateMetrics(responseTime: number): Promise<void> {
    this.resetDailyCountIfNeeded();
    this.dailyRequestCount++;
    
    const id = randomUUID();
    const metrics: SystemMetrics = {
      id,
      responseTime,
      requestsToday: this.dailyRequestCount,
      timestamp: new Date(),
    };
    
    this.metrics.set(id, metrics);
    
    // Keep only the latest 1000 metrics entries
    if (this.metrics.size > 1000) {
      const entries = Array.from(this.metrics.entries());
      entries.sort((a, b) => (b[1].timestamp?.getTime() || 0) - (a[1].timestamp?.getTime() || 0));
      this.metrics.clear();
      entries.slice(0, 1000).forEach(([key, value]) => {
        this.metrics.set(key, value);
      });
    }
  }

  async getLatestMetrics(): Promise<SystemMetrics | undefined> {
    this.resetDailyCountIfNeeded();
    
    const entries = Array.from(this.metrics.values());
    if (entries.length === 0) {
      return {
        id: randomUUID(),
        responseTime: 0,
        requestsToday: this.dailyRequestCount,
        timestamp: new Date(),
      };
    }
    
    entries.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    return entries[0];
  }

  async getTodayRequestCount(): Promise<number> {
    this.resetDailyCountIfNeeded();
    return this.dailyRequestCount;
  }

  async addLog(insertLog: InsertSystemLogs): Promise<SystemLogs> {
    const id = randomUUID();
    const log: SystemLogs = {
      ...insertLog,
      id,
      timestamp: new Date(),
    };
    
    this.logs.set(id, log);
    
    // Keep only the latest 500 log entries
    if (this.logs.size > 500) {
      const entries = Array.from(this.logs.entries());
      entries.sort((a, b) => (b[1].timestamp?.getTime() || 0) - (a[1].timestamp?.getTime() || 0));
      this.logs.clear();
      entries.slice(0, 500).forEach(([key, value]) => {
        this.logs.set(key, value);
      });
    }
    
    return log;
  }

  async getRecentLogs(limit: number = 50): Promise<SystemLogs[]> {
    const entries = Array.from(this.logs.values());
    entries.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    return entries.slice(0, limit);
  }
}

export const storage = new MemStorage();
