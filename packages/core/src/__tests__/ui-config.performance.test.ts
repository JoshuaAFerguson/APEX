import { describe, it, expect } from 'vitest';
import { UIConfigSchema, ApexConfigSchema } from '../types';
import { getEffectiveConfig } from '../config';

describe('UI Config Performance Tests', () => {
  describe('Schema validation performance', () => {
    it('should validate UIConfig quickly in batch operations', () => {
      const testConfigs = Array.from({ length: 1000 }, (_, i) => ({
        previewMode: i % 2 === 0,
        previewConfidence: 0.1 + (i % 9) * 0.1, // 0.1 to 0.9
        autoExecuteHighConfidence: i % 3 === 0,
        previewTimeout: 1000 + (i % 10) * 1000, // 1000 to 10000
      }));

      const startTime = performance.now();

      for (const config of testConfigs) {
        const result = UIConfigSchema.parse(config);
        expect(result).toBeDefined();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 validations in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
      console.log(`UIConfig validation: ${testConfigs.length} validations in ${duration.toFixed(2)}ms`);
    });

    it('should handle repeated parsing of same config efficiently', () => {
      const config = {
        previewMode: true,
        previewConfidence: 0.8,
        autoExecuteHighConfidence: false,
        previewTimeout: 7500,
      };

      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = UIConfigSchema.parse(config);
        expect(result.previewMode).toBe(true);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete many repeated validations quickly
      expect(duration).toBeLessThan(50);
      console.log(`Repeated parsing: ${iterations} iterations in ${duration.toFixed(2)}ms`);
    });

    it('should validate full ApexConfig with UI section efficiently', () => {
      const fullConfig = {
        version: '1.0',
        project: {
          name: 'performance-test',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-merge',
          overrides: {
            testing: 'full',
            documentation: 'review-before-commit',
          },
        },
        agents: {
          enabled: ['planner', 'architect', 'developer', 'tester', 'reviewer'],
          disabled: ['devops'],
        },
        models: {
          planning: 'opus',
          architecture: 'sonnet',
          implementation: 'sonnet',
          testing: 'haiku',
          review: 'haiku',
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          autoPush: false,
          defaultBranch: 'main',
        },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        api: {
          url: 'http://localhost:4000',
          port: 4000,
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.85,
          autoExecuteHighConfidence: true,
          previewTimeout: 12000,
        },
      };

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = ApexConfigSchema.parse(fullConfig);
        expect(result.ui?.previewMode).toBe(true);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete full config validations in reasonable time
      expect(duration).toBeLessThan(200);
      console.log(`Full config validation: ${iterations} validations in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Effective config generation performance', () => {
    it('should generate effective config efficiently', () => {
      const baseConfigs = Array.from({ length: 100 }, (_, i) => ({
        version: '1.0' as const,
        project: {
          name: `test-project-${i}`,
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: i % 3 === 0 ? {
          previewMode: i % 2 === 0,
          previewConfidence: 0.5 + (i % 5) * 0.1,
        } : undefined,
      }));

      const startTime = performance.now();

      for (const config of baseConfigs) {
        const effective = getEffectiveConfig(config);
        expect(effective.ui).toBeDefined();
        expect(effective.ui.previewMode).toBeDefined();
        expect(effective.ui.previewConfidence).toBeDefined();
        expect(effective.ui.autoExecuteHighConfidence).toBeDefined();
        expect(effective.ui.previewTimeout).toBeDefined();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should generate effective configs quickly
      expect(duration).toBeLessThan(50);
      console.log(`Effective config generation: ${baseConfigs.length} configs in ${duration.toFixed(2)}ms`);
    });

    it('should handle deep merging of complex configs efficiently', () => {
      const complexConfig = {
        version: '1.0' as const,
        project: {
          name: 'complex-test',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-merge' as const,
          overrides: {
            feature: 'full' as const,
            bugfix: 'review-before-commit' as const,
            hotfix: 'review-before-merge' as const,
            documentation: 'full' as const,
            testing: 'review-before-commit' as const,
          },
        },
        agents: {
          enabled: ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'],
          disabled: [],
        },
        models: {
          planning: 'opus' as const,
          architecture: 'sonnet' as const,
          implementation: 'sonnet' as const,
          testing: 'haiku' as const,
          review: 'haiku' as const,
          devops: 'haiku' as const,
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional' as const,
          autoPush: false,
          defaultBranch: 'main',
        },
        limits: {
          maxTokensPerTask: 1000000,
          maxCostPerTask: 20.0,
          dailyBudget: 200.0,
          maxTurns: 200,
          maxConcurrentTasks: 5,
        },
        api: {
          url: 'http://localhost:4000',
          port: 4000,
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.9,
        },
      };

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const effective = getEffectiveConfig(complexConfig);
        expect(effective.ui.previewMode).toBe(true);
        expect(effective.ui.previewConfidence).toBe(0.9);
        expect(effective.ui.autoExecuteHighConfidence).toBe(false); // default
        expect(effective.ui.previewTimeout).toBe(5000); // default
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle complex config merging efficiently
      expect(duration).toBeLessThan(100);
      console.log(`Complex config merging: ${iterations} operations in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory usage optimization', () => {
    it('should not leak memory during repeated validations', () => {
      // This test helps ensure we don't have memory leaks in schema validation
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many validations
      for (let batch = 0; batch < 10; batch++) {
        const configs = Array.from({ length: 100 }, (_, i) => ({
          previewMode: i % 2 === 0,
          previewConfidence: Math.random(),
          autoExecuteHighConfidence: i % 3 === 0,
          previewTimeout: 1000 + Math.floor(Math.random() * 10000),
        }));

        for (const config of configs) {
          UIConfigSchema.parse(config);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle large batch operations without excessive memory usage', () => {
      const batchSize = 10000;
      const configs = Array.from({ length: batchSize }, (_, i) => ({
        previewMode: Boolean(i % 2),
        previewConfidence: (i % 100) / 100,
        autoExecuteHighConfidence: Boolean(i % 3),
        previewTimeout: 1000 + (i % 20) * 500,
      }));

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      // Process configs in batches to simulate real usage
      for (let i = 0; i < configs.length; i += 100) {
        const batch = configs.slice(i, i + 100);
        for (const config of batch) {
          UIConfigSchema.parse(config);
        }
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const duration = endTime - startTime;
      const memoryUsage = endMemory - startMemory;

      // Should process large batches efficiently
      expect(duration).toBeLessThan(1000); // Under 1 second for 10k items
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024); // Under 50MB increase

      console.log(`Large batch processing: ${batchSize} items in ${duration.toFixed(2)}ms, ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error handling performance', () => {
    it('should handle validation errors efficiently', () => {
      const invalidConfigs = [
        { previewConfidence: -0.5 }, // Invalid range
        { previewConfidence: 1.5 },  // Invalid range
        { previewTimeout: 500 },     // Invalid minimum
        { previewTimeout: -1000 },   // Invalid negative
        { previewMode: 'true' },     // Invalid type
        { autoExecuteHighConfidence: 1 }, // Invalid type
      ];

      const iterations = 1000;
      const startTime = performance.now();
      let errorCount = 0;

      for (let i = 0; i < iterations; i++) {
        const config = invalidConfigs[i % invalidConfigs.length];
        try {
          UIConfigSchema.parse(config);
        } catch {
          errorCount++;
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle errors quickly
      expect(duration).toBeLessThan(100);
      expect(errorCount).toBe(iterations); // All should fail

      console.log(`Error handling: ${iterations} validation errors in ${duration.toFixed(2)}ms`);
    });
  });
});