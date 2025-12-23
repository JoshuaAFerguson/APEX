import { describe, it, expect } from 'vitest';
import { DaemonConfigSchema, ApexConfigSchema, getEffectiveConfig } from '../types';

describe.skip('Daemon Configuration Performance Tests', () => {
  describe('Schema validation performance', () => {
    it('should parse daemon config quickly for typical values', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        DaemonConfigSchema.parse({
          pollInterval: 5000 + (i % 10) * 1000,
          autoStart: i % 2 === 0,
          logLevel: ['debug', 'info', 'warn', 'error'][i % 4] as 'debug' | 'info' | 'warn' | 'error'
        });
      }

      const elapsed = Date.now() - start;

      // Should parse 1000 configs in under 100ms (very generous threshold)
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle large pollInterval values without performance degradation', () => {
      const start = Date.now();

      const largeValues = [
        Number.MAX_SAFE_INTEGER,
        2147483647, // 32-bit max
        3600000, // 1 hour in ms
        86400000, // 1 day in ms
        604800000, // 1 week in ms
      ];

      for (const value of largeValues) {
        DaemonConfigSchema.parse({ pollInterval: value });
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it('should validate logLevel enum efficiently', () => {
      const start = Date.now();
      const levels = ['debug', 'info', 'warn', 'error'] as const;

      for (let i = 0; i < 1000; i++) {
        DaemonConfigSchema.parse({ logLevel: levels[i % 4] });
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('getEffectiveConfig performance with daemon', () => {
    it('should apply daemon defaults quickly', () => {
      const baseConfig = {
        version: '1.0' as const,
        project: {
          name: 'performance-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        }
      };

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        getEffectiveConfig(baseConfig);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('should handle complex configs with daemon efficiently', () => {
      const complexConfig = {
        version: '1.0' as const,
        project: {
          name: 'complex-performance-test',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-merge' as const,
          overrides: {
            docs: 'full' as const,
            tests: 'review-before-commit' as const
          }
        },
        agents: {
          enabled: ['planner', 'developer', 'tester', 'reviewer'],
          disabled: ['devops']
        },
        models: {
          planning: 'opus' as const,
          implementation: 'sonnet' as const,
          review: 'haiku' as const
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional' as const,
          autoPush: true,
          defaultBranch: 'main'
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 25.0,
          dailyBudget: 150.0,
          maxTurns: 100,
          maxConcurrentTasks: 3
        },
        daemon: {
          pollInterval: 8000,
          autoStart: true,
          logLevel: 'debug' as const
        }
      };

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        getEffectiveConfig(complexConfig);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe('Memory usage with daemon configuration', () => {
    it('should not leak memory during repeated parsing', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Parse many daemon configurations
      for (let i = 0; i < 10000; i++) {
        DaemonConfigSchema.parse({
          pollInterval: i % 60000,
          autoStart: i % 2 === 0,
          logLevel: ['debug', 'info', 'warn', 'error'][i % 4] as 'debug' | 'info' | 'warn' | 'error'
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 10k parses)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle rapid config object creation/destruction', () => {
      const configs = [];

      // Create many config objects
      for (let i = 0; i < 1000; i++) {
        configs.push(ApexConfigSchema.parse({
          project: { name: `test-${i}` },
          daemon: {
            pollInterval: i * 100,
            autoStart: i % 2 === 0,
            logLevel: ['debug', 'info', 'warn', 'error'][i % 4] as 'debug' | 'info' | 'warn' | 'error'
          }
        }));
      }

      // Clear the array to allow GC
      configs.length = 0;

      // This test mainly ensures no exceptions are thrown during rapid allocation
      expect(true).toBe(true);
    });
  });

  describe('Edge case performance', () => {
    it('should handle boundary values efficiently', () => {
      const boundaryValues = [
        { pollInterval: 0, autoStart: false, logLevel: 'debug' as const },
        { pollInterval: 1, autoStart: true, logLevel: 'info' as const },
        { pollInterval: Number.MAX_SAFE_INTEGER, autoStart: false, logLevel: 'warn' as const },
        { pollInterval: -1, autoStart: true, logLevel: 'error' as const }
      ];

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        for (const config of boundaryValues) {
          DaemonConfigSchema.parse(config);
        }
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle schema validation errors efficiently', () => {
      const invalidConfigs = [
        { pollInterval: 'invalid' },
        { autoStart: 'not-boolean' },
        { logLevel: 'invalid-level' },
        { pollInterval: null },
        { autoStart: 42 },
        { unknownField: 'value' }
      ];

      const start = Date.now();
      let errorCount = 0;

      for (let i = 0; i < 100; i++) {
        for (const config of invalidConfigs) {
          try {
            DaemonConfigSchema.parse(config);
          } catch {
            errorCount++;
          }
        }
      }

      const elapsed = Date.now() - start;

      // Should catch all 600 errors (6 invalid configs * 100 iterations)
      expect(errorCount).toBe(600);
      // Should do so efficiently
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Concurrent access simulation', () => {
    it('should handle simulated concurrent daemon config parsing', async () => {
      const parseConfig = (index: number) => {
        return DaemonConfigSchema.parse({
          pollInterval: index * 1000,
          autoStart: index % 2 === 0,
          logLevel: ['debug', 'info', 'warn', 'error'][index % 4] as 'debug' | 'info' | 'warn' | 'error'
        });
      };

      const start = Date.now();

      // Simulate concurrent parsing with Promise.all
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => parseConfig(i))
      );

      const results = await Promise.all(promises);

      const elapsed = Date.now() - start;

      expect(results).toHaveLength(100);
      expect(results[0].pollInterval).toBe(0);
      expect(results[99].pollInterval).toBe(99000);
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle concurrent getEffectiveConfig calls', async () => {
      const configs = Array.from({ length: 50 }, (_, i) => ({
        version: '1.0' as const,
        project: {
          name: `concurrent-test-${i}`,
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        daemon: {
          pollInterval: i * 500,
          autoStart: i % 3 === 0,
          logLevel: ['debug', 'info', 'warn', 'error'][i % 4] as 'debug' | 'info' | 'warn' | 'error'
        }
      }));

      const start = Date.now();

      const promises = configs.map(config =>
        Promise.resolve().then(() => getEffectiveConfig(config))
      );

      const results = await Promise.all(promises);

      const elapsed = Date.now() - start;

      expect(results).toHaveLength(50);
      expect(results[0].daemon.pollInterval).toBe(0);
      expect(results[49].daemon.pollInterval).toBe(24500);
      expect(elapsed).toBeLessThan(50);
    });
  });
});