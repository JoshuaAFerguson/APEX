/**
 * @apexcli/browser - Performance Testing Utilities
 *
 * Migrated from __tests__/test-utils.ts
 */

/**
 * Performance testing utilities
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    const duration = Date.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, val) => sum + val, 0) / this.measurements.length;
  }

  getMedian(): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  getMin(): number {
    return this.measurements.length > 0 ? Math.min(...this.measurements) : 0;
  }

  getMax(): number {
    return this.measurements.length > 0 ? Math.max(...this.measurements) : 0;
  }

  reset(): void {
    this.measurements = [];
  }

  getStats(): {
    count: number;
    average: number;
    median: number;
    min: number;
    max: number;
  } {
    return {
      count: this.measurements.length,
      average: this.getAverage(),
      median: this.getMedian(),
      min: this.getMin(),
      max: this.getMax()
    };
  }
}