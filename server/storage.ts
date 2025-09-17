import { 
  type SystemMetrics, 
  type InsertSystemMetrics, 
  type SystemLogs, 
  type InsertSystemLogs,
  type UserFeedback,
  type InsertUserFeedback,
  type PatternLearning,
  type InsertPatternLearning,
  type SignalQualityMetrics,
  type InsertSignalQualityMetrics
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Metrics operations
  updateMetrics(responseTime: number): Promise<void>;
  getLatestMetrics(): Promise<SystemMetrics | undefined>;
  getTodayRequestCount(): Promise<number>;
  
  // Logs operations  
  addLog(log: InsertSystemLogs): Promise<SystemLogs>;
  getRecentLogs(limit: number): Promise<SystemLogs[]>;
  
  // Feedback operations
  addFeedback(feedback: InsertUserFeedback): Promise<UserFeedback>;
  getFeedbackByRefId(refId: string): Promise<UserFeedback | undefined>;
  getFeedbackBatch(limit?: number, offset?: number): Promise<UserFeedback[]>;
  getFeedbackStats(days?: number): Promise<{
    total: number;
    positive: number;
    negative: number;
    net_sentiment: number;
    avg_response_time?: number;
  }>;
  
  // Pattern learning operations
  getPatternLearning(patternName: string): Promise<PatternLearning | undefined>;
  upsertPatternLearning(pattern: InsertPatternLearning): Promise<PatternLearning>;
  getAllPatterns(): Promise<PatternLearning[]>;
  
  // Signal quality operations
  addSignalQuality(quality: InsertSignalQualityMetrics): Promise<SignalQualityMetrics>;
  getSignalQuality(refId: string): Promise<SignalQualityMetrics | undefined>;
  updateSignalFeedback(refId: string, rating: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private metrics: Map<string, SystemMetrics>;
  private logs: Map<string, SystemLogs>;
  private dailyRequestCount: number;
  private lastResetDate: string;
  
  // Feedback & Learning storage
  private feedback: Map<string, UserFeedback>;
  private patterns: Map<string, PatternLearning>;
  private signalQuality: Map<string, SignalQualityMetrics>;

  constructor() {
    this.metrics = new Map();
    this.logs = new Map();
    this.dailyRequestCount = 0;
    this.lastResetDate = new Date().toDateString();
    
    // Initialize feedback & learning storage
    this.feedback = new Map();
    this.patterns = new Map();
    this.signalQuality = new Map();
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
      id,
      level: insertLog.level,
      message: insertLog.message,
      details: insertLog.details ?? null,
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

  // Feedback operations implementation
  async addFeedback(insertFeedback: InsertUserFeedback): Promise<UserFeedback> {
    const id = randomUUID();
    const feedback: UserFeedback = {
      id,
      ref_id: insertFeedback.ref_id,
      user_id: insertFeedback.user_id ?? null,
      signal_type: insertFeedback.signal_type,
      rating: insertFeedback.rating,
      response_time_seconds: insertFeedback.response_time_seconds ?? null,
      metadata: insertFeedback.metadata ?? null,
      timestamp: new Date(),
    };
    
    this.feedback.set(id, feedback);
    
    // Keep only the latest 1000 feedback entries
    if (this.feedback.size > 1000) {
      const entries = Array.from(this.feedback.entries());
      entries.sort((a, b) => (b[1].timestamp?.getTime() || 0) - (a[1].timestamp?.getTime() || 0));
      this.feedback.clear();
      entries.slice(0, 1000).forEach(([key, value]) => {
        this.feedback.set(key, value);
      });
    }
    
    return feedback;
  }

  async getFeedbackByRefId(refId: string): Promise<UserFeedback | undefined> {
    const entries = Array.from(this.feedback.values());
    return entries.find(f => f.ref_id === refId);
  }

  async getFeedbackBatch(limit: number = 50, offset: number = 0): Promise<UserFeedback[]> {
    const entries = Array.from(this.feedback.values());
    entries.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    return entries.slice(offset, offset + limit);
  }

  async getFeedbackStats(days: number = 7): Promise<{
    total: number;
    positive: number;
    negative: number;
    net_sentiment: number;
    avg_response_time?: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentFeedback = Array.from(this.feedback.values())
      .filter(f => (f.timestamp?.getTime() || 0) >= cutoffDate.getTime());
    
    const positive = recentFeedback.filter(f => f.rating > 0).length;
    const negative = recentFeedback.filter(f => f.rating < 0).length;
    const total = recentFeedback.length;
    
    const responseTimes = recentFeedback
      .map(f => f.response_time_seconds)
      .filter(t => t !== null && t !== undefined) as number[];
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length 
      : undefined;
    
    return {
      total,
      positive,
      negative,
      net_sentiment: total > 0 ? (positive - negative) / total : 0,
      avg_response_time: avgResponseTime,
    };
  }

  // Pattern learning operations implementation
  async getPatternLearning(patternName: string): Promise<PatternLearning | undefined> {
    return this.patterns.get(patternName);
  }

  async upsertPatternLearning(insertPattern: InsertPatternLearning): Promise<PatternLearning> {
    const existingPattern = this.patterns.get(insertPattern.pattern_name);
    
    const pattern: PatternLearning = {
      id: existingPattern?.id || randomUUID(),
      pattern_name: insertPattern.pattern_name,
      pattern_type: insertPattern.pattern_type,
      base_weight: insertPattern.base_weight ?? null,
      current_weight: insertPattern.current_weight ?? null,
      min_confidence: insertPattern.min_confidence ?? null,
      feedback_stats: insertPattern.feedback_stats ?? null,
      performance_history: insertPattern.performance_history ?? null,
      last_adjustment: new Date(),
      created_at: existingPattern?.created_at || new Date(),
    };
    
    this.patterns.set(insertPattern.pattern_name, pattern);
    return pattern;
  }

  async getAllPatterns(): Promise<PatternLearning[]> {
    return Array.from(this.patterns.values());
  }

  // Signal quality operations implementation
  async addSignalQuality(insertQuality: InsertSignalQualityMetrics): Promise<SignalQualityMetrics> {
    const id = randomUUID();
    const quality: SignalQualityMetrics = {
      id,
      ref_id: insertQuality.ref_id,
      signal_type: insertQuality.signal_type,
      patterns_used: insertQuality.patterns_used ?? null,
      confidence_score: insertQuality.confidence_score,
      adjusted_weights: insertQuality.adjusted_weights ?? null,
      feedback_received: insertQuality.feedback_received ?? null,
      final_rating: insertQuality.final_rating ?? null,
      learning_impact: insertQuality.learning_impact ?? null,
      created_at: new Date(),
    };
    
    this.signalQuality.set(insertQuality.ref_id, quality);
    
    // Keep only the latest 1000 quality entries
    if (this.signalQuality.size > 1000) {
      const entries = Array.from(this.signalQuality.entries());
      entries.sort((a, b) => (b[1].created_at?.getTime() || 0) - (a[1].created_at?.getTime() || 0));
      this.signalQuality.clear();
      entries.slice(0, 1000).forEach(([key, value]) => {
        this.signalQuality.set(key, value);
      });
    }
    
    return quality;
  }

  async getSignalQuality(refId: string): Promise<SignalQualityMetrics | undefined> {
    return this.signalQuality.get(refId);
  }

  async updateSignalFeedback(refId: string, rating: number): Promise<boolean> {
    const quality = this.signalQuality.get(refId);
    if (!quality) return false;
    
    quality.feedback_received = true;
    quality.final_rating = rating;
    this.signalQuality.set(refId, quality);
    
    return true;
  }
}

export const storage = new MemStorage();
