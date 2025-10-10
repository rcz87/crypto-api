/**
 * 🔬 Component Memory Tracker
 * Track memory usage per component to identify leak sources
 * 
 * Monitors:
 * - CoinAPI WebSocket message buffers
 * - Enhanced Sniper GPT responses
 * - Python bridge data accumulation
 * - Smart Cache sizes
 */

import { memoryUsage } from 'process';
import client from 'prom-client';

interface ComponentMetrics {
  name: string;
  heapUsedMB: number;
  objectCount: number;
  lastUpdated: number;
}

interface ComponentSnapshot {
  timestamp: number;
  totalHeapMB: number;
  components: Map<string, ComponentMetrics>;
}

export class ComponentMemoryTracker {
  private snapshots: ComponentSnapshot[] = [];
  private maxSnapshots = 20;
  private componentData: Map<string, any[]> = new Map();
  
  // Prometheus metrics per component
  private gaugeComponentHeap: client.Gauge;
  private gaugeComponentObjects: client.Gauge;
  
  constructor() {
    // Initialize Prometheus metrics
    this.gaugeComponentHeap = new client.Gauge({
      name: 'component_heap_mb',
      help: 'Heap usage per component in MB',
      labelNames: ['component']
    });
    
    this.gaugeComponentObjects = new client.Gauge({
      name: 'component_object_count',
      help: 'Object count per component',
      labelNames: ['component']
    });
  }

  /**
   * Register data for a component (to track accumulation)
   */
  registerData(component: string, data: any): void {
    if (!this.componentData.has(component)) {
      this.componentData.set(component, []);
    }
    
    const componentArray = this.componentData.get(component)!;
    componentArray.push(data);
    
    // Keep max 1000 items per component (prevent unbounded growth during tracking)
    if (componentArray.length > 1000) {
      componentArray.shift();
    }
  }

  /**
   * Clear data for a component (for testing eviction)
   */
  clearComponent(component: string): void {
    this.componentData.delete(component);
  }

  /**
   * Take snapshot of current memory state per component
   */
  takeSnapshot(): ComponentSnapshot {
    const memStats = memoryUsage();
    const totalHeapMB = memStats.heapUsed / 1024 / 1024;
    
    const components = new Map<string, ComponentMetrics>();
    
    // Track each component's data size
    for (const [name, data] of Array.from(this.componentData.entries())) {
      const objectCount = data.length;
      
      // Rough estimate: each object ~1KB average
      const estimatedHeapMB = (objectCount * 1024) / 1024 / 1024;
      
      const metrics: ComponentMetrics = {
        name,
        heapUsedMB: estimatedHeapMB,
        objectCount,
        lastUpdated: Date.now()
      };
      
      components.set(name, metrics);
      
      // Update Prometheus
      this.gaugeComponentHeap.labels(name).set(estimatedHeapMB);
      this.gaugeComponentObjects.labels(name).set(objectCount);
    }
    
    const snapshot: ComponentSnapshot = {
      timestamp: Date.now(),
      totalHeapMB,
      components
    };
    
    // Store snapshot
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    
    return snapshot;
  }

  /**
   * Compare two snapshots to find growing components
   */
  compareSnapshots(older: ComponentSnapshot, newer: ComponentSnapshot): {
    component: string;
    heapGrowthMB: number;
    objectGrowth: number;
    growthRate: number; // MB/sec
  }[] {
    const results: {
      component: string;
      heapGrowthMB: number;
      objectGrowth: number;
      growthRate: number;
    }[] = [];
    
    const timeDiffSec = (newer.timestamp - older.timestamp) / 1000;
    
    for (const [name, newMetrics] of Array.from(newer.components.entries())) {
      const oldMetrics = older.components.get(name);
      
      if (oldMetrics) {
        const heapGrowthMB = newMetrics.heapUsedMB - oldMetrics.heapUsedMB;
        const objectGrowth = newMetrics.objectCount - oldMetrics.objectCount;
        const growthRate = heapGrowthMB / timeDiffSec;
        
        // Only include components with significant growth
        if (heapGrowthMB > 0.1 || objectGrowth > 10) {
          results.push({
            component: name,
            heapGrowthMB,
            objectGrowth,
            growthRate
          });
        }
      }
    }
    
    // Sort by growth rate (highest first)
    return results.sort((a, b) => b.growthRate - a.growthRate);
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): ComponentSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): ComponentSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Analyze trend to identify leak sources
   */
  analyzeLeakTrend(): {
    suspectedLeaks: string[];
    analysis: string;
    recommendations: string[];
  } {
    if (this.snapshots.length < 3) {
      return {
        suspectedLeaks: [],
        analysis: 'Insufficient data - need at least 3 snapshots',
        recommendations: ['Continue monitoring']
      };
    }
    
    // Compare first and last snapshots
    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    
    const growthAnalysis = this.compareSnapshots(firstSnapshot, lastSnapshot);
    
    // Identify components with consistent growth
    const suspectedLeaks = growthAnalysis
      .filter(g => g.growthRate > 0.05) // Growing >50KB/sec
      .map(g => g.component);
    
    let analysis = `Analyzed ${this.snapshots.length} snapshots over ${
      ((lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000).toFixed(0)
    }s\n`;
    
    if (suspectedLeaks.length > 0) {
      analysis += `\nSuspected leak sources (${suspectedLeaks.length}):\n`;
      growthAnalysis.forEach(g => {
        if (g.growthRate > 0.05) {
          analysis += `  - ${g.component}: +${g.heapGrowthMB.toFixed(2)}MB (${g.objectGrowth} objects, ${(g.growthRate * 1000).toFixed(1)}KB/s)\n`;
        }
      });
    } else {
      analysis += '\nNo significant component-level leaks detected';
    }
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on findings
    if (suspectedLeaks.includes('coinapi_ws_messages')) {
      recommendations.push('Limit CoinAPI WebSocket message buffer size');
      recommendations.push('Add message TTL or max buffer limits');
    }
    
    if (suspectedLeaks.includes('enhanced_sniper_responses')) {
      recommendations.push('Clear Enhanced Sniper GPT response cache periodically');
      recommendations.push('Reduce GPT response retention time');
    }
    
    if (suspectedLeaks.includes('python_bridge_data')) {
      recommendations.push('Add response size limits to Python bridge');
      recommendations.push('Stream large responses instead of buffering');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring - leak may be in untracked area');
      recommendations.push('Consider enabling V8 heap snapshots for deeper analysis');
    }
    
    return {
      suspectedLeaks,
      analysis,
      recommendations
    };
  }

  /**
   * Get summary report
   */
  getSummaryReport(): string {
    const current = this.getCurrentSnapshot();
    if (!current) {
      return 'No data available';
    }
    
    let report = `📊 Component Memory Summary (${new Date().toISOString()})\n`;
    report += `Total Heap: ${current.totalHeapMB.toFixed(2)}MB\n\n`;
    
    const sorted = Array.from(current.components.entries())
      .sort((a, b) => b[1].heapUsedMB - a[1].heapUsedMB);
    
    report += 'Components (by heap usage):\n';
    sorted.forEach(([name, metrics]) => {
      report += `  - ${name}: ${metrics.heapUsedMB.toFixed(2)}MB (${metrics.objectCount} objects)\n`;
    });
    
    // Add leak analysis if enough data
    if (this.snapshots.length >= 3) {
      const leakAnalysis = this.analyzeLeakTrend();
      report += `\n${leakAnalysis.analysis}`;
      
      if (leakAnalysis.recommendations.length > 0) {
        report += '\n\n💡 Recommendations:\n';
        leakAnalysis.recommendations.forEach(rec => {
          report += `  - ${rec}\n`;
        });
      }
    }
    
    return report;
  }
}

// Export singleton
export const componentMemoryTracker = new ComponentMemoryTracker();
