/**
 * Bounded Queue with Backpressure
 * 
 * Prevents memory leaks by:
 * 1. Limiting queue size (max 500 items)
 * 2. Rejecting new items when full (backpressure)
 * 3. Batch processing for efficiency
 * 4. Metrics tracking for monitoring
 */

export interface QueueMetrics {
  size: number;
  maxSize: number;
  droppedCount: number;
  processedCount: number;
  utilizationPercent: number;
}

export class BoundedQueue<T> {
  private queue: T[] = [];
  private readonly maxSize: number;
  private droppedCount = 0;
  private processedCount = 0;
  
  constructor(maxSize: number = 500) {
    if (maxSize <= 0) {
      throw new Error('maxSize must be positive');
    }
    this.maxSize = maxSize;
  }
  
  /**
   * Add item to queue
   * @returns true if added, false if queue is full (backpressure)
   */
  enqueue(item: T): boolean {
    if (this.queue.length >= this.maxSize) {
      this.droppedCount++;
      return false; // Backpressure: reject new items
    }
    
    this.queue.push(item);
    return true;
  }
  
  /**
   * Remove and return batch of items
   * @param batchSize Number of items to dequeue
   * @returns Array of items (may be less than batchSize if queue is smaller)
   */
  dequeue(batchSize: number = 10): T[] {
    const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));
    this.processedCount += batch.length;
    return batch;
  }
  
  /**
   * Peek at next item without removing
   */
  peek(): T | undefined {
    return this.queue[0];
  }
  
  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }
  
  /**
   * Get number of dropped items (backpressure events)
   */
  getDroppedCount(): number {
    return this.droppedCount;
  }
  
  /**
   * Get number of processed items
   */
  getProcessedCount(): number {
    return this.processedCount;
  }
  
  /**
   * Get queue metrics for monitoring
   */
  getMetrics(): QueueMetrics {
    return {
      size: this.queue.length,
      maxSize: this.maxSize,
      droppedCount: this.droppedCount,
      processedCount: this.processedCount,
      utilizationPercent: (this.queue.length / this.maxSize) * 100
    };
  }
  
  /**
   * Clear all items from queue
   */
  clear(): void {
    this.queue = [];
  }
  
  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.droppedCount = 0;
    this.processedCount = 0;
  }
}
