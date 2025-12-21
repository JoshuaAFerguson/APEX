import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdleTaskGenerator } from './idle-task-generator';
import type { ProjectAnalysis, IdleTask } from './idle-processor';
import { StrategyWeights, IdleTaskType } from '@apex/core';

// Mock generateTaskId to produce predictable IDs
vi.mock('@apex/core', async () => {
  const actual = await vi.importActual('@apex/core');
  let counter = 0;
  return {
    ...actual,
    generateTaskId: () => `integration-test-${++counter}`,
  };
});

describe('IdleTaskGenerator Integration Tests', () => {
  let generator: IdleTaskGenerator;

  beforeEach(() => {
    generator = new IdleTaskGenerator();
  });

  describe('Real-world project scenarios', () => {
    it('should handle a new project with minimal setup', () => {
      const newProjectAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 5, lines: 200, languages: { ts: 5 } },
        testCoverage: { percentage: 0, uncoveredFiles: ['src/index.ts', 'src/utils.ts'] },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coverage: 0, missingDocs: ['src/index.ts', 'src/utils.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const task = generator.generateTask(newProjectAnalysis);

      expect(task).not.toBeNull();
      // Should prioritize critical missing test coverage or documentation
      expect(['improvement', 'documentation']).toContain(task?.type);
      expect(task?.priority).toBeOneOf(['high', 'urgent']);
    });

    it('should handle a legacy project with many issues', () => {
      const legacyProjectAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 500, lines: 50000, languages: { js: 300, ts: 200 } },
        testCoverage: { percentage: 15, uncoveredFiles: Array.from({ length: 400 }, (_, i) => `src/legacy${i}.js`) },
        dependencies: {
          outdated: [
            'lodash@^3.0.0',
            'express@^3.0.0',
            'jquery@^1.12.0',
            'moment@^2.10.0',
            'underscore@^0.8.0',
          ],
          security: [
            'vulnerable-lib@1.0.0',
            'old-crypto@0.5.0',
          ],
        },
        codeQuality: {
          lintIssues: 2000,
          duplicatedCode: Array.from({ length: 50 }, (_, i) => `src/dup${i}.js`),
          complexityHotspots: Array.from({ length: 30 }, (_, i) => `src/complex${i}.js`),
        },
        documentation: { coverage: 5, missingDocs: Array.from({ length: 450 }, (_, i) => `src/missing${i}.js`) },
        performance: {
          slowTests: Array.from({ length: 20 }, (_, i) => `test/slow${i}.test.js`),
          bottlenecks: Array.from({ length: 10 }, (_, i) => `src/bottleneck${i}.js`),
        },
      };

      const task = generator.generateTask(legacyProjectAnalysis);

      expect(task).not.toBeNull();
      // Should prioritize security vulnerabilities first
      if (task?.type === 'maintenance') {
        expect(task.title).toContain('Security');
        expect(task.priority).toBe('urgent');
      }
    });

    it('should handle a well-maintained project with minor issues', () => {
      const wellMaintainedAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 10000, languages: { ts: 100 } },
        testCoverage: { percentage: 85, uncoveredFiles: ['src/edge-case.ts'] },
        dependencies: { outdated: ['minor-update@^2.1.0'], security: [] },
        codeQuality: { lintIssues: 5, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 80, missingDocs: ['src/utils.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const task = generator.generateTask(wellMaintainedAnalysis);

      expect(task).not.toBeNull();
      // Should generate lower priority tasks for minor improvements
      expect(['normal', 'low']).toContain(task?.priority);
    });
  });

  describe('Strategy weight preferences in realistic scenarios', () => {
    it('should prioritize security-focused maintenance for enterprise project', () => {
      const enterpriseWeights: StrategyWeights = {
        maintenance: 0.6,
        refactoring: 0.1,
        docs: 0.2,
        tests: 0.1,
      };

      generator = new IdleTaskGenerator(enterpriseWeights);

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 200, lines: 25000, languages: { ts: 200 } },
        testCoverage: { percentage: 40, uncoveredFiles: ['src/feature.ts'] },
        dependencies: {
          outdated: ['react@^17.0.0', 'typescript@^4.5.0'],
          security: ['vulnerable-package@1.0.0'],
        },
        codeQuality: { lintIssues: 50, duplicatedCode: [], complexityHotspots: ['src/complex.ts'] },
        documentation: { coverage: 60, missingDocs: ['src/api.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      // Generate multiple tasks and verify maintenance is preferred
      const taskTypes: string[] = [];
      for (let i = 0; i < 20; i++) {
        generator.reset();
        const task = generator.generateTask(analysis);
        if (task) {
          taskTypes.push(task.type);
        }
      }

      const maintenanceCount = taskTypes.filter(type => type === 'maintenance').length;
      expect(maintenanceCount).toBeGreaterThan(10); // Should be majority
    });

    it('should prioritize documentation for open source project', () => {
      const openSourceWeights: StrategyWeights = {
        maintenance: 0.2,
        refactoring: 0.2,
        docs: 0.5,
        tests: 0.1,
      };

      generator = new IdleTaskGenerator(openSourceWeights);

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 8000, languages: { ts: 50 } },
        testCoverage: { percentage: 70, uncoveredFiles: [] },
        dependencies: { outdated: ['dep@^1.0.0'], security: [] },
        codeQuality: { lintIssues: 10, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 30, missingDocs: ['src/core.ts', 'src/utils.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const taskTypes: string[] = [];
      for (let i = 0; i < 20; i++) {
        generator.reset();
        const task = generator.generateTask(analysis);
        if (task) {
          taskTypes.push(task.type);
        }
      }

      const docCount = taskTypes.filter(type => type === 'documentation').length;
      expect(docCount).toBeGreaterThan(8); // Should be majority
    });

    it('should prioritize testing for test-driven development project', () => {
      const tddWeights: StrategyWeights = {
        maintenance: 0.1,
        refactoring: 0.2,
        docs: 0.2,
        tests: 0.5,
      };

      generator = new IdleTaskGenerator(tddWeights);

      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 80, lines: 12000, languages: { ts: 80 } },
        testCoverage: { percentage: 60, uncoveredFiles: ['src/service.ts', 'src/controller.ts'] },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 15, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 70, missingDocs: [] },
        performance: { slowTests: ['test/slow.test.ts'], bottlenecks: [] },
      };

      const taskTypes: string[] = [];
      for (let i = 0; i < 20; i++) {
        generator.reset();
        const task = generator.generateTask(analysis);
        if (task) {
          taskTypes.push(task.type);
        }
      }

      const testCount = taskTypes.filter(type => type === 'improvement').length;
      expect(testCount).toBeGreaterThan(8); // Should be majority
    });
  });

  describe('Task generation lifecycle', () => {
    it('should avoid duplicate tasks in a session', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 20, lines: 3000, languages: { ts: 20 } },
        testCoverage: { percentage: 30, uncoveredFiles: ['src/a.ts', 'src/b.ts'] },
        dependencies: { outdated: ['dep1@^1.0.0', 'dep2@^1.0.0'], security: [] },
        codeQuality: { lintIssues: 20, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 40, missingDocs: ['src/c.ts', 'src/d.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const generatedTasks: IdleTask[] = [];

      // Generate multiple tasks in one session
      for (let i = 0; i < 10; i++) {
        const task = generator.generateTask(analysis);
        if (task) {
          generatedTasks.push(task);
        }
      }

      // Check for unique candidates (by title/description similarity)
      const uniqueTitles = new Set(generatedTasks.map(task => task.title));
      expect(uniqueTitles.size).toBe(generatedTasks.length);
    });

    it('should allow regeneration after reset', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 10, lines: 1500, languages: { ts: 10 } },
        testCoverage: { percentage: 20, uncoveredFiles: ['src/test.ts'] },
        dependencies: { outdated: ['old-dep@^1.0.0'], security: [] },
        codeQuality: { lintIssues: 10, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 30, missingDocs: ['src/docs.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      // Generate first task
      const task1 = generator.generateTask(analysis);
      expect(task1).not.toBeNull();

      // Try to generate second task (might be null if no more candidates)
      const task2 = generator.generateTask(analysis);

      // Reset and generate again
      generator.reset();
      const task3 = generator.generateTask(analysis);
      expect(task3).not.toBeNull();

      // Should be able to regenerate similar tasks after reset
      if (task1 && task3) {
        // They might be the same type but should have different IDs
        expect(task1.id).not.toBe(task3.id);
      }
    });

    it('should handle exhausted candidate pools gracefully', () => {
      // Create analysis with limited issues
      const limitedAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 5, lines: 500, languages: { ts: 5 } },
        testCoverage: { percentage: 95, uncoveredFiles: [] },
        dependencies: { outdated: ['single-dep@^1.0.0'], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coverage: 90, missingDocs: [] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const tasks: (IdleTask | null)[] = [];

      // Try to generate many tasks
      for (let i = 0; i < 10; i++) {
        const task = generator.generateTask(limitedAnalysis);
        tasks.push(task);
      }

      // Should get fewer tasks as candidates are exhausted
      const validTasks = tasks.filter(task => task !== null);
      const nullTasks = tasks.filter(task => task === null);

      expect(validTasks.length).toBeGreaterThan(0);
      expect(nullTasks.length).toBeGreaterThan(0); // Should eventually return null
    });
  });

  describe('Cross-analyzer interactions', () => {
    it('should maintain consistency across different analyzers', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 15000, languages: { ts: 100 } },
        testCoverage: { percentage: 40, uncoveredFiles: ['src/untested.ts'] },
        dependencies: { outdated: ['old-lib@^1.0.0'], security: ['vuln-lib@1.0.0'] },
        codeQuality: { lintIssues: 100, duplicatedCode: ['src/dup.ts'], complexityHotspots: ['src/complex.ts'] },
        documentation: { coverage: 35, missingDocs: ['src/undoc.ts'] },
        performance: { slowTests: ['test/slow.test.ts'], bottlenecks: ['src/bottleneck.ts'] },
      };

      // Generate tasks with different weight configurations
      const strategies = [
        { maintenance: 1, refactoring: 0, docs: 0, tests: 0 },
        { maintenance: 0, refactoring: 1, docs: 0, tests: 0 },
        { maintenance: 0, refactoring: 0, docs: 1, tests: 0 },
        { maintenance: 0, refactoring: 0, docs: 0, tests: 1 },
      ];

      for (const weights of strategies) {
        const strategyGenerator = new IdleTaskGenerator(weights);
        const task = strategyGenerator.generateTask(analysis);

        expect(task).not.toBeNull();
        expect(task?.id).toMatch(/^idle-.*$/);
        expect(task?.createdAt).toBeInstanceOf(Date);
        expect(task?.implemented).toBe(false);
        expect(['low', 'medium', 'high']).toContain(task?.estimatedEffort);
        expect(['low', 'normal', 'high', 'urgent']).toContain(task?.priority);
      }
    });
  });

  describe('Configuration validation', () => {
    it('should handle partial weight configurations', () => {
      const partialWeights = {
        maintenance: 0.8,
        tests: 0.2,
        // Missing refactoring and docs weights
      } as StrategyWeights;

      generator = new IdleTaskGenerator(partialWeights);
      const weights = generator.getWeights();

      expect(weights.maintenance).toBe(0.8);
      expect(weights.tests).toBe(0.2);
      expect(weights.refactoring).toBe(0.25); // Should use default
      expect(weights.docs).toBe(0.25); // Should use default
    });

    it('should handle empty weight configurations', () => {
      generator = new IdleTaskGenerator({} as StrategyWeights);
      const weights = generator.getWeights();

      expect(weights.maintenance).toBe(0.25);
      expect(weights.refactoring).toBe(0.25);
      expect(weights.docs).toBe(0.25);
      expect(weights.tests).toBe(0.25);
    });
  });

  describe('Performance characteristics', () => {
    it('should maintain consistent performance across different project sizes', () => {
      const testSizes = [
        { files: 10, lines: 1000 },
        { files: 100, lines: 10000 },
        { files: 1000, lines: 100000 },
      ];

      for (const size of testSizes) {
        const analysis: ProjectAnalysis = {
          codebaseSize: { files: size.files, lines: size.lines, languages: { ts: size.files } },
          testCoverage: { percentage: 50, uncoveredFiles: [`src/test${size.files}.ts`] },
          dependencies: { outdated: [`dep${size.files}@^1.0.0`], security: [] },
          codeQuality: { lintIssues: size.files, duplicatedCode: [], complexityHotspots: [] },
          documentation: { coverage: 50, missingDocs: [`src/doc${size.files}.ts`] },
          performance: { slowTests: [], bottlenecks: [] },
        };

        const startTime = Date.now();
        const task = generator.generateTask(analysis);
        const endTime = Date.now();

        expect(task).not.toBeNull();
        expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      }
    });

    it('should handle rapid successive generations efficiently', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        testCoverage: { percentage: 30, uncoveredFiles: ['src/test.ts'] },
        dependencies: { outdated: ['dep@^1.0.0'], security: [] },
        codeQuality: { lintIssues: 25, duplicatedCode: [], complexityHotspots: [] },
        documentation: { coverage: 40, missingDocs: ['src/doc.ts'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        generator.generateTask(analysis);
        if (i % 10 === 0) {
          generator.reset();
        }
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time
    });
  });
});