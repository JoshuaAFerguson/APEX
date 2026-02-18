/**
 * @apexcli/browser - Performance Test Suite
 *
 * Comprehensive tests for performance monitoring utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitor } from '../performance.js';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic timing functionality', () => {
    it('should start and stop measurements', () => {
      monitor.start();
      vi.advanceTimersByTime(100);
      const duration = monitor.stop();

      expect(duration).toBe(100);
    });

    it('should handle multiple measurements', () => {
      // First measurement: 100ms
      monitor.start();
      vi.advanceTimersByTime(100);
      const duration1 = monitor.stop();

      // Second measurement: 200ms
      monitor.start();
      vi.advanceTimersByTime(200);
      const duration2 = monitor.stop();

      expect(duration1).toBe(100);
      expect(duration2).toBe(200);

      const stats = monitor.getStats();
      expect(stats.count).toBe(2);
    });

    it('should handle zero duration measurement', () => {
      monitor.start();
      // No time advancement
      const duration = monitor.stop();

      expect(duration).toBe(0);
    });

    it('should handle very short durations', () => {
      monitor.start();
      vi.advanceTimersByTime(1);
      const duration = monitor.stop();

      expect(duration).toBe(1);
    });

    it('should handle long durations', () => {
      monitor.start();
      vi.advanceTimersByTime(5000);
      const duration = monitor.stop();

      expect(duration).toBe(5000);
    });
  });

  describe('getAverage', () => {
    it('should return 0 for no measurements', () => {
      expect(monitor.getAverage()).toBe(0);
    });

    it('should return correct average for single measurement', () => {
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      expect(monitor.getAverage()).toBe(100);
    });

    it('should return correct average for multiple measurements', () => {
      // Add measurements: 100, 200, 300
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(300);
      monitor.stop();

      expect(monitor.getAverage()).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should handle fractional averages', () => {
      // Add measurements: 1, 2
      monitor.start();
      vi.advanceTimersByTime(1);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(2);
      monitor.stop();

      expect(monitor.getAverage()).toBe(1.5);
    });

    it('should handle large numbers of measurements', () => {
      // Add 1000 measurements of 10ms each
      for (let i = 0; i < 1000; i++) {
        monitor.start();
        vi.advanceTimersByTime(10);
        monitor.stop();
      }

      expect(monitor.getAverage()).toBe(10);
      expect(monitor.getStats().count).toBe(1000);
    });
  });

  describe('getMedian', () => {
    it('should return 0 for no measurements', () => {
      expect(monitor.getMedian()).toBe(0);
    });

    it('should return correct median for single measurement', () => {
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      expect(monitor.getMedian()).toBe(100);
    });

    it('should return correct median for odd number of measurements', () => {
      // Add measurements: 100, 200, 300
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(300);
      monitor.stop();

      expect(monitor.getMedian()).toBe(200); // Middle value
    });

    it('should return correct median for even number of measurements', () => {
      // Add measurements: 100, 200, 300, 400
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(300);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(400);
      monitor.stop();

      expect(monitor.getMedian()).toBe(250); // (200 + 300) / 2
    });

    it('should handle unsorted measurements correctly', () => {
      // Add measurements in non-sorted order: 300, 100, 200
      monitor.start();
      vi.advanceTimersByTime(300);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getMedian()).toBe(200); // Should sort internally
    });

    it('should handle duplicate values', () => {
      // Add measurements: 100, 100, 100
      for (let i = 0; i < 3; i++) {
        monitor.start();
        vi.advanceTimersByTime(100);
        monitor.stop();
      }

      expect(monitor.getMedian()).toBe(100);
    });

    it('should handle two identical values (even count)', () => {
      // Add measurements: 150, 150
      monitor.start();
      vi.advanceTimersByTime(150);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(150);
      monitor.stop();

      expect(monitor.getMedian()).toBe(150);
    });
  });

  describe('getMin', () => {
    it('should return 0 for no measurements', () => {
      expect(monitor.getMin()).toBe(0);
    });

    it('should return correct minimum for single measurement', () => {
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      expect(monitor.getMin()).toBe(100);
    });

    it('should return correct minimum for multiple measurements', () => {
      // Add measurements: 300, 100, 200
      monitor.start();
      vi.advanceTimersByTime(300);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getMin()).toBe(100);
    });

    it('should handle zero minimum', () => {
      monitor.start();
      // No time advancement
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      expect(monitor.getMin()).toBe(0);
    });

    it('should handle duplicate minimums', () => {
      // Add measurements: 100, 100, 200
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getMin()).toBe(100);
    });
  });

  describe('getMax', () => {
    it('should return 0 for no measurements', () => {
      expect(monitor.getMax()).toBe(0);
    });

    it('should return correct maximum for single measurement', () => {
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      expect(monitor.getMax()).toBe(100);
    });

    it('should return correct maximum for multiple measurements', () => {
      // Add measurements: 100, 300, 200
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(300);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getMax()).toBe(300);
    });

    it('should handle duplicate maximums', () => {
      // Add measurements: 100, 200, 200
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getMax()).toBe(200);
    });
  });

  describe('reset', () => {
    it('should clear all measurements', () => {
      // Add some measurements
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getStats().count).toBe(2);

      monitor.reset();

      expect(monitor.getStats().count).toBe(0);
      expect(monitor.getAverage()).toBe(0);
      expect(monitor.getMedian()).toBe(0);
      expect(monitor.getMin()).toBe(0);
      expect(monitor.getMax()).toBe(0);
    });

    it('should allow new measurements after reset', () => {
      // Add and reset measurements
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      monitor.reset();

      // Add new measurements
      monitor.start();
      vi.advanceTimersByTime(200);
      monitor.stop();

      expect(monitor.getStats().count).toBe(1);
      expect(monitor.getAverage()).toBe(200);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for no measurements', () => {
      const stats = monitor.getStats();

      expect(stats).toEqual({
        count: 0,
        average: 0,
        median: 0,
        min: 0,
        max: 0
      });
    });

    it('should return correct stats for single measurement', () => {
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();

      const stats = monitor.getStats();

      expect(stats).toEqual({
        count: 1,
        average: 100,
        median: 100,
        min: 100,
        max: 100
      });
    });

    it('should return correct stats for multiple measurements', () => {
      // Add measurements: 100, 200, 300, 400
      for (let i = 1; i <= 4; i++) {
        monitor.start();
        vi.advanceTimersByTime(i * 100);
        monitor.stop();
      }

      const stats = monitor.getStats();

      expect(stats).toEqual({
        count: 4,
        average: 250, // (100 + 200 + 300 + 400) / 4
        median: 250,  // (200 + 300) / 2
        min: 100,
        max: 400
      });
    });

    it('should return consistent stats across multiple calls', () => {
      monitor.start();
      vi.advanceTimersByTime(150);
      monitor.stop();

      const stats1 = monitor.getStats();
      const stats2 = monitor.getStats();

      expect(stats1).toEqual(stats2);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle stop before start gracefully', () => {
      // This will use startTime = 0, so duration will be current time
      const duration = monitor.stop();

      expect(typeof duration).toBe('number');
      expect(monitor.getStats().count).toBe(1);
    });

    it('should handle multiple stops without start', () => {
      const duration1 = monitor.stop();
      const duration2 = monitor.stop();

      expect(typeof duration1).toBe('number');
      expect(typeof duration2).toBe('number');
      expect(monitor.getStats().count).toBe(2);
    });

    it('should handle start without stop', () => {
      monitor.start();
      monitor.start(); // Start again without stopping

      vi.advanceTimersByTime(100);
      const duration = monitor.stop();

      // Should use the most recent start time
      expect(duration).toBe(100);
    });

    it('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 100; i++) {
        monitor.start();
        vi.advanceTimersByTime(1);
        monitor.stop();
      }

      const stats = monitor.getStats();
      expect(stats.count).toBe(100);
      expect(stats.average).toBe(1);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(1);
    });

    it('should handle very large measurements', () => {
      monitor.start();
      vi.advanceTimersByTime(Number.MAX_SAFE_INTEGER - Date.now());
      const duration = monitor.stop();

      expect(typeof duration).toBe('number');
      expect(monitor.getStats().count).toBe(1);
    });
  });

  describe('real-world usage scenarios', () => {
    it('should measure performance of synchronous operations', () => {
      monitor.start();

      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }

      vi.advanceTimersByTime(10); // Simulate time passage
      const duration = monitor.stop();

      expect(duration).toBe(10);
      expect(sum).toBe(499500); // Sanity check the work was done
    });

    it('should track multiple operation types', () => {
      // Fast operations
      for (let i = 0; i < 3; i++) {
        monitor.start();
        vi.advanceTimersByTime(10);
        monitor.stop();
      }

      // Slow operations
      for (let i = 0; i < 2; i++) {
        monitor.start();
        vi.advanceTimersByTime(100);
        monitor.stop();
      }

      const stats = monitor.getStats();
      expect(stats.count).toBe(5);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.average).toBe(52); // (10+10+10+100+100)/5
    });

    it('should help identify performance outliers', () => {
      // Normal operations: 50ms each
      for (let i = 0; i < 10; i++) {
        monitor.start();
        vi.advanceTimersByTime(50);
        monitor.stop();
      }

      // Outlier: 500ms
      monitor.start();
      vi.advanceTimersByTime(500);
      monitor.stop();

      const stats = monitor.getStats();
      expect(stats.count).toBe(11);
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(500);
      expect(stats.median).toBe(50); // Median less affected by outliers
      expect(stats.average).toBeGreaterThan(stats.median);
    });

    it('should support performance regression testing', () => {
      const baselineMonitor = new PerformanceMonitor();

      // Baseline measurements
      for (let i = 0; i < 5; i++) {
        baselineMonitor.start();
        vi.advanceTimersByTime(100);
        baselineMonitor.stop();
      }

      // New measurements (performance regression)
      for (let i = 0; i < 5; i++) {
        monitor.start();
        vi.advanceTimersByTime(150); // 50% slower
        monitor.stop();
      }

      const baselineStats = baselineMonitor.getStats();
      const currentStats = monitor.getStats();

      expect(currentStats.average).toBe(150);
      expect(baselineStats.average).toBe(100);
      expect(currentStats.average / baselineStats.average).toBe(1.5);
    });
  });
});