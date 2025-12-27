import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './health-monitor';
import type { DaemonRunner, DaemonMetrics } from './runner';

describe('HealthMonitor Memory Metrics Collection', () => {
  let healthMonitor: HealthMonitor;
  let mockDaemonRunner: DaemonRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    healthMonitor = new HealthMonitor();

    mockDaemonRunner = {
      getMetrics: vi.fn().mockReturnValue({
        startedAt: new Date('2023-01-01T00:00:00Z'),
        uptime: 1000,
        tasksProcessed: 10,
        tasksSucceeded: 8,
        tasksFailed: 2,
        activeTaskCount: 1,
        isRunning: true,
      } as DaemonMetrics),
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Memory usage collection accuracy', () => {
    it('should collect accurate memory metrics from process.memoryUsage()', () => {
      const mockMemoryUsage = {
        heapUsed: 52428800,     // 50MB
        heapTotal: 104857600,   // 100MB
        rss: 157286400,         // 150MB
        external: 10485760,     // 10MB
        arrayBuffers: 5242880,  // 5MB
      };

      vi.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);

      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.memoryUsage).toEqual({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
      });

      // Verify external and arrayBuffers are not included (not part of our interface)
      expect(report.memoryUsage).not.toHaveProperty('external');
      expect(report.memoryUsage).not.toHaveProperty('arrayBuffers');
    });

    it('should handle memory metrics at different scales', () => {
      const memoryScenarios = [
        {
          name: 'tiny-process',
          heapUsed: 1024,         // 1KB
          heapTotal: 2048,        // 2KB
          rss: 4096,              // 4KB
        },
        {
          name: 'small-process',
          heapUsed: 1048576,      // 1MB
          heapTotal: 2097152,     // 2MB
          rss: 4194304,           // 4MB
        },
        {
          name: 'medium-process',
          heapUsed: 134217728,    // 128MB
          heapTotal: 268435456,   // 256MB
          rss: 402653184,         // 384MB
        },
        {
          name: 'large-process',
          heapUsed: 2147483648,   // 2GB
          heapTotal: 4294967296,  // 4GB
          rss: 6442450944,        // 6GB
        },
        {
          name: 'huge-process',
          heapUsed: 17179869184,  // 16GB
          heapTotal: 34359738368, // 32GB
          rss: 51539607552,       // 48GB
        },
      ];

      memoryScenarios.forEach(scenario => {
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          heapUsed: scenario.heapUsed,
          heapTotal: scenario.heapTotal,
          rss: scenario.rss,
          external: 0,
          arrayBuffers: 0,
        });

        const report = healthMonitor.getHealthReport(mockDaemonRunner);

        expect(report.memoryUsage.heapUsed).toBe(scenario.heapUsed);
        expect(report.memoryUsage.heapTotal).toBe(scenario.heapTotal);
        expect(report.memoryUsage.rss).toBe(scenario.rss);
      });
    });

    it('should handle zero memory values', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0,
      });

      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.memoryUsage).toEqual({
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
      });
    });

    it('should handle maximum safe integer values', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: Number.MAX_SAFE_INTEGER,
        heapTotal: Number.MAX_SAFE_INTEGER,
        rss: Number.MAX_SAFE_INTEGER,
        external: 0,
        arrayBuffers: 0,
      });

      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.memoryUsage.heapUsed).toBe(Number.MAX_SAFE_INTEGER);
      expect(report.memoryUsage.heapTotal).toBe(Number.MAX_SAFE_INTEGER);
      expect(report.memoryUsage.rss).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Memory monitoring over time', () => {
    it('should capture memory changes during daemon operation', () => {
      const memoryStates = [
        { heapUsed: 10485760, heapTotal: 20971520, rss: 31457280 },  // 10MB/20MB/30MB
        { heapUsed: 20971520, heapTotal: 41943040, rss: 62914560 },  // 20MB/40MB/60MB
        { heapUsed: 41943040, heapTotal: 83886080, rss: 125829120 }, // 40MB/80MB/120MB
        { heapUsed: 83886080, heapTotal: 167772160, rss: 251658240 }, // 80MB/160MB/240MB
      ];

      const reports = memoryStates.map(state => {
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          ...state,
          external: 0,
          arrayBuffers: 0,
        });

        return healthMonitor.getHealthReport(mockDaemonRunner);
      });

      // Verify each state is captured accurately
      reports.forEach((report, index) => {
        expect(report.memoryUsage.heapUsed).toBe(memoryStates[index].heapUsed);
        expect(report.memoryUsage.heapTotal).toBe(memoryStates[index].heapTotal);
        expect(report.memoryUsage.rss).toBe(memoryStates[index].rss);
      });

      // Verify memory growth is captured
      expect(reports[3].memoryUsage.heapUsed).toBeGreaterThan(reports[0].memoryUsage.heapUsed);
      expect(reports[3].memoryUsage.heapTotal).toBeGreaterThan(reports[0].memoryUsage.heapTotal);
      expect(reports[3].memoryUsage.rss).toBeGreaterThan(reports[0].memoryUsage.rss);
    });

    it('should handle memory fluctuations realistically', () => {
      // Simulate realistic memory usage patterns
      const memoryPattern = [
        { phase: 'startup', heapUsed: 20971520, heapTotal: 41943040, rss: 62914560 },
        { phase: 'loading', heapUsed: 83886080, heapTotal: 104857600, rss: 157286400 },
        { phase: 'peak-load', heapUsed: 157286400, heapTotal: 209715200, rss: 314572800 },
        { phase: 'gc-cleanup', heapUsed: 52428800, heapTotal: 209715200, rss: 314572800 },
        { phase: 'steady-state', heapUsed: 67108864, heapTotal: 104857600, rss: 157286400 },
        { phase: 'memory-leak', heapUsed: 134217728, heapTotal: 167772160, rss: 251658240 },
        { phase: 'forced-gc', heapUsed: 41943040, heapTotal: 167772160, rss: 251658240 },
      ];

      const phaseReports = memoryPattern.map(phase => {
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          heapUsed: phase.heapUsed,
          heapTotal: phase.heapTotal,
          rss: phase.rss,
          external: 0,
          arrayBuffers: 0,
        });

        return {
          phase: phase.phase,
          report: healthMonitor.getHealthReport(mockDaemonRunner),
        };
      });

      // Verify memory patterns
      const startup = phaseReports.find(p => p.phase === 'startup')!.report;
      const peakLoad = phaseReports.find(p => p.phase === 'peak-load')!.report;
      const cleanup = phaseReports.find(p => p.phase === 'gc-cleanup')!.report;

      // Peak load should show higher usage than startup
      expect(peakLoad.memoryUsage.heapUsed).toBeGreaterThan(startup.memoryUsage.heapUsed);

      // Cleanup should show reduced heap usage but same total
      expect(cleanup.memoryUsage.heapUsed).toBeLessThan(peakLoad.memoryUsage.heapUsed);
      expect(cleanup.memoryUsage.heapTotal).toBe(peakLoad.memoryUsage.heapTotal);

      // RSS typically doesn't immediately shrink
      expect(cleanup.memoryUsage.rss).toBe(peakLoad.memoryUsage.rss);
    });

    it('should maintain consistent memory reporting frequency', () => {
      const reportCount = 100;
      const reports = [];

      // Mock consistent memory usage
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
        external: 0,
        arrayBuffers: 0,
      });

      const startTime = Date.now();

      for (let i = 0; i < reportCount; i++) {
        reports.push(healthMonitor.getHealthReport(mockDaemonRunner));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should generate reports efficiently
      expect(duration).toBeLessThan(50); // 50ms for 100 reports
      expect(reports).toHaveLength(reportCount);

      // All reports should have consistent memory data
      reports.forEach(report => {
        expect(report.memoryUsage.heapUsed).toBe(52428800);
        expect(report.memoryUsage.heapTotal).toBe(104857600);
        expect(report.memoryUsage.rss).toBe(157286400);
      });
    });
  });

  describe('Memory monitoring edge cases', () => {
    it('should handle process.memoryUsage() throwing errors', () => {
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory information unavailable');
      });

      expect(() => {
        healthMonitor.getHealthReport(mockDaemonRunner);
      }).toThrow('Memory information unavailable');
    });

    it('should handle process.memoryUsage() returning malformed data', () => {
      // Mock malformed memory usage
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 'not-a-number' as any,
        heapTotal: null as any,
        rss: undefined as any,
        external: Infinity,
        arrayBuffers: -1,
      });

      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      // Should still create a report (garbage in, garbage out principle)
      expect(report.memoryUsage).toEqual({
        heapUsed: 'not-a-number',
        heapTotal: null,
        rss: undefined,
      });
    });

    it('should handle heap used exceeding heap total', () => {
      // This can happen in real scenarios due to timing
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 104857600,    // 100MB
        heapTotal: 52428800,    // 50MB (smaller than used!)
        rss: 157286400,         // 150MB
        external: 0,
        arrayBuffers: 0,
      });

      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.memoryUsage.heapUsed).toBe(104857600);
      expect(report.memoryUsage.heapTotal).toBe(52428800);
      expect(report.memoryUsage.rss).toBe(157286400);

      // The values are preserved as-is, no validation
      expect(report.memoryUsage.heapUsed).toBeGreaterThan(report.memoryUsage.heapTotal);
    });

    it('should handle rapid memory changes during concurrent access', () => {
      const memoryValues = [
        { heapUsed: 10485760, heapTotal: 20971520, rss: 31457280 },
        { heapUsed: 20971520, heapTotal: 41943040, rss: 62914560 },
        { heapUsed: 41943040, heapTotal: 83886080, rss: 125829120 },
      ];

      let callCount = 0;
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        const values = memoryValues[callCount % memoryValues.length];
        callCount++;
        return {
          ...values,
          external: 0,
          arrayBuffers: 0,
        };
      });

      // Generate reports rapidly
      const reports = Array.from({ length: 9 }, () =>
        healthMonitor.getHealthReport(mockDaemonRunner)
      );

      // Should cycle through memory values
      expect(reports[0].memoryUsage.heapUsed).toBe(memoryValues[0].heapUsed);
      expect(reports[1].memoryUsage.heapUsed).toBe(memoryValues[1].heapUsed);
      expect(reports[2].memoryUsage.heapUsed).toBe(memoryValues[2].heapUsed);
      expect(reports[3].memoryUsage.heapUsed).toBe(memoryValues[0].heapUsed); // Cycles
      expect(reports[6].memoryUsage.heapUsed).toBe(memoryValues[0].heapUsed); // Cycles
    });

    it('should handle memory measurements with high precision', () => {
      // Very precise memory measurements
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 52428799,    // 1 byte less than 50MB
        heapTotal: 104857601,  // 1 byte more than 100MB
        rss: 157286401,        // 1 byte more than 150MB
        external: 0,
        arrayBuffers: 0,
      });

      const report = healthMonitor.getHealthReport(mockDaemonRunner);

      expect(report.memoryUsage.heapUsed).toBe(52428799);
      expect(report.memoryUsage.heapTotal).toBe(104857601);
      expect(report.memoryUsage.rss).toBe(157286401);
    });
  });

  describe('Memory monitoring with daemon integration', () => {
    it('should collect memory metrics independently of daemon state', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
        external: 0,
        arrayBuffers: 0,
      });

      // Memory should be collected whether daemon runner is provided or not
      const reportWithDaemon = healthMonitor.getHealthReport(mockDaemonRunner);
      const reportWithoutDaemon = healthMonitor.getHealthReport();

      expect(reportWithDaemon.memoryUsage).toEqual(reportWithoutDaemon.memoryUsage);
    });

    it('should collect memory metrics even when daemon metrics fail', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
        external: 0,
        arrayBuffers: 0,
      });

      // Mock daemon runner that throws error
      const errorDaemonRunner = {
        getMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Daemon metrics unavailable');
        }),
      } as any;

      expect(() => {
        healthMonitor.getHealthReport(errorDaemonRunner);
      }).toThrow('Daemon metrics unavailable');

      // Memory collection should work independently
      const reportWithoutDaemon = healthMonitor.getHealthReport();
      expect(reportWithoutDaemon.memoryUsage).toEqual({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
      });
    });

    it('should maintain memory monitoring performance during high task loads', () => {
      // Mock high task load in daemon
      const highLoadDaemon = {
        getMetrics: vi.fn().mockReturnValue({
          startedAt: new Date('2023-01-01T00:00:00Z'),
          uptime: 3600000,
          tasksProcessed: 10000,
          tasksSucceeded: 9500,
          tasksFailed: 500,
          activeTaskCount: 100,
          isRunning: true,
        } as DaemonMetrics),
      } as any;

      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 1073741824,   // 1GB
        heapTotal: 2147483648,  // 2GB
        rss: 3221225472,        // 3GB
        external: 0,
        arrayBuffers: 0,
      });

      const startTime = Date.now();

      // Generate many reports under high load
      const reports = Array.from({ length: 100 }, () =>
        healthMonitor.getHealthReport(highLoadDaemon)
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should maintain performance despite high task counts
      expect(duration).toBeLessThan(50);

      // All reports should have correct memory and task data
      reports.forEach(report => {
        expect(report.memoryUsage.heapUsed).toBe(1073741824);
        expect(report.taskCounts.processed).toBe(10000);
        expect(report.taskCounts.active).toBe(100);
      });
    });

    it('should track memory metrics across daemon restarts', () => {
      const memoryStates = [
        { heapUsed: 20971520, heapTotal: 41943040, rss: 62914560 },   // Before restart
        { heapUsed: 10485760, heapTotal: 20971520, rss: 31457280 },   // After restart (smaller)
        { heapUsed: 52428800, heapTotal: 104857600, rss: 157286400 }, // Recovery
      ];

      memoryStates.forEach((state, index) => {
        vi.spyOn(process, 'memoryUsage').mockReturnValue({
          ...state,
          external: 0,
          arrayBuffers: 0,
        });

        if (index === 1) {
          // Simulate daemon restart
          healthMonitor.recordRestart('memory-restart', 0, false);
        }

        const report = healthMonitor.getHealthReport(mockDaemonRunner);
        expect(report.memoryUsage).toEqual({
          heapUsed: state.heapUsed,
          heapTotal: state.heapTotal,
          rss: state.rss,
        });
      });

      // Restart should be recorded but not affect memory collection
      const finalReport = healthMonitor.getHealthReport();
      expect(finalReport.restartHistory).toHaveLength(1);
      expect(finalReport.restartHistory[0].reason).toBe('memory-restart');
    });
  });

  describe('Memory metrics immutability and consistency', () => {
    it('should return independent memory objects for each report', () => {
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 52428800,
        heapTotal: 104857600,
        rss: 157286400,
        external: 0,
        arrayBuffers: 0,
      });

      const report1 = healthMonitor.getHealthReport(mockDaemonRunner);
      const report2 = healthMonitor.getHealthReport(mockDaemonRunner);

      // Should be equal values but different objects
      expect(report1.memoryUsage).toEqual(report2.memoryUsage);
      expect(report1.memoryUsage).not.toBe(report2.memoryUsage);

      // Modifying one should not affect the other
      (report1.memoryUsage as any).heapUsed = 999;
      expect(report2.memoryUsage.heapUsed).toBe(52428800);
    });

    it('should collect fresh memory data for each report', () => {
      let memoryValue = 52428800; // Start at 50MB

      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        const result = {
          heapUsed: memoryValue,
          heapTotal: memoryValue * 2,
          rss: memoryValue * 3,
          external: 0,
          arrayBuffers: 0,
        };
        memoryValue += 1048576; // Increase by 1MB each call
        return result;
      });

      const reports = Array.from({ length: 5 }, () =>
        healthMonitor.getHealthReport(mockDaemonRunner)
      );

      // Each report should have different memory values
      reports.forEach((report, index) => {
        const expectedHeapUsed = 52428800 + (index * 1048576);
        expect(report.memoryUsage.heapUsed).toBe(expectedHeapUsed);
        expect(report.memoryUsage.heapTotal).toBe(expectedHeapUsed * 2);
        expect(report.memoryUsage.rss).toBe(expectedHeapUsed * 3);
      });

      // Values should be strictly increasing
      for (let i = 1; i < reports.length; i++) {
        expect(reports[i].memoryUsage.heapUsed).toBeGreaterThan(reports[i - 1].memoryUsage.heapUsed);
      }
    });
  });
});