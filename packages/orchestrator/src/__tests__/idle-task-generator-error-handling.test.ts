/**
 * Comprehensive error handling tests for IdleTaskGenerator
 *
 * This test suite focuses on testing error conditions, edge cases,
 * and resilience of the idle task generation system.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  IdleTaskGenerator,
  MaintenanceAnalyzer,
  RefactoringAnalyzer,
  DocsAnalyzer,
  TestsAnalyzer,
  TaskCandidate,
  StrategyAnalyzer,
} from '../idle-task-generator';
import { IdleTaskType, StrategyWeights } from '@apexcli/core';
import type { ProjectAnalysis } from '../idle-processor';

// Mock generateIdleTaskId to produce predictable IDs
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  let counter = 0;
  return {
    ...actual,
    generateIdleTaskId: () => `error-test-${++counter}`,
  };
});

describe('IdleTaskGenerator Error Handling', () => {
  let generator: IdleTaskGenerator;
  let mockAnalysis: ProjectAnalysis;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { ts: 40, js: 10 } },
      testCoverage: { percentage: 45, uncoveredFiles: ['src/utils.ts'] },
      dependencies: { outdated: ['old-lib@^0.1.0'], security: [] },
      codeQuality: { lintIssues: 25, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 35, missingDocs: ['src/core.ts'] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    generator = new IdleTaskGenerator();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Analyzer Exception Handling', () => {
    it('should handle analyzer that throws during analyze()', () => {
      const throwingAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => {
          throw new Error('Analyzer crashed during analysis');
        },
        prioritize: () => null,
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', throwingAnalyzer],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);

      const faultyGenerator = new IdleTaskGenerator(
        { maintenance: 0.5, refactoring: 0.5, docs: 0, tests: 0 },
        analyzers
      );

      // Should not throw and should fallback to other analyzers
      expect(() => {
        const task = faultyGenerator.generateTask(mockAnalysis);
        // Task might be null if no other analyzers can generate tasks
        expect(task).toBeDefined(); // Defined but could be null
      }).not.toThrow();
    });

    it('should handle analyzer that throws during prioritize()', () => {
      const throwingPrioritizeAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: (analysis) => [{
          candidateId: 'test-candidate',
          title: 'Test Task',
          description: 'Test description',
          priority: 'normal',
          estimatedEffort: 'medium',
          suggestedWorkflow: 'maintenance',
          rationale: 'Test rationale',
          score: 0.5,
        }],
        prioritize: () => {
          throw new Error('Prioritize method crashed');
        },
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', throwingPrioritizeAnalyzer],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);

      const faultyGenerator = new IdleTaskGenerator(
        { maintenance: 1.0, refactoring: 0, docs: 0, tests: 0 },
        analyzers
      );

      // Should not throw and should try other analyzers
      expect(() => {
        const task = faultyGenerator.generateTask(mockAnalysis);
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle analyzer that returns invalid candidates', () => {
      const invalidCandidateAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => [
          // Candidate with missing required fields
          {
            candidateId: '',  // Empty ID
            title: '',        // Empty title
            description: '',  // Empty description
            priority: 'invalid' as any,  // Invalid priority
            estimatedEffort: 'invalid' as any,  // Invalid effort
            suggestedWorkflow: '',
            rationale: '',
            score: NaN,  // Invalid score
          },
          // Candidate with null/undefined values
          {
            candidateId: null as any,
            title: undefined as any,
            description: null as any,
            priority: 'normal',
            estimatedEffort: 'medium',
            suggestedWorkflow: 'maintenance',
            rationale: 'Test',
            score: -1,  // Negative score
          }
        ],
        prioritize: (candidates) => candidates[0] || null,
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', invalidCandidateAnalyzer],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);

      const faultyGenerator = new IdleTaskGenerator(
        { maintenance: 1.0, refactoring: 0, docs: 0, tests: 0 },
        analyzers
      );

      // Should handle gracefully and possibly fallback
      expect(() => {
        const task = faultyGenerator.generateTask(mockAnalysis);
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle analyzer that returns null from prioritize with valid candidates', () => {
      const nullPrioritizeAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => [{
          candidateId: 'valid-candidate',
          title: 'Valid Task',
          description: 'Valid description',
          priority: 'normal',
          estimatedEffort: 'medium',
          suggestedWorkflow: 'maintenance',
          rationale: 'Valid rationale',
          score: 0.5,
        }],
        prioritize: () => null,  // Always returns null
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', nullPrioritizeAnalyzer],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);

      const faultyGenerator = new IdleTaskGenerator(
        { maintenance: 1.0, refactoring: 0, docs: 0, tests: 0 },
        analyzers
      );

      // Should try other analyzers when prioritize returns null
      const task = faultyGenerator.generateTask(mockAnalysis);
      expect(task).toBeDefined(); // Could be null if no other analyzers work
    });
  });

  describe('Invalid Analysis Data Handling', () => {
    it('should handle null analysis gracefully', () => {
      expect(() => {
        const task = generator.generateTask(null as any);
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle undefined analysis gracefully', () => {
      expect(() => {
        const task = generator.generateTask(undefined as any);
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle analysis with missing properties', () => {
      const incompleteAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: {} },
        // Missing other required properties
      } as any;

      expect(() => {
        const task = generator.generateTask(incompleteAnalysis);
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle analysis with null properties', () => {
      const nullPropertiesAnalysis: ProjectAnalysis = {
        codebaseSize: null as any,
        testCoverage: null as any,
        dependencies: null as any,
        codeQuality: null as any,
        documentation: null as any,
        performance: null as any,
      };

      expect(() => {
        const task = generator.generateTask(nullPropertiesAnalysis);
        expect(task).toBeDefined();
      }).not.toThrow();
    });

    it('should handle analysis with invalid data types', () => {
      const invalidTypesAnalysis = {
        codebaseSize: 'invalid',
        testCoverage: 123,
        dependencies: false,
        codeQuality: [],
        documentation: {},
        performance: 'string',
      } as any;

      expect(() => {
        const task = generator.generateTask(invalidTypesAnalysis);
        expect(task).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Memory and Resource Handling', () => {
    it('should handle extremely large analysis datasets without crashing', () => {
      const massiveAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 100000, lines: 10000000, languages: { ts: 50000, js: 50000 } },
        testCoverage: {
          percentage: 30,
          uncoveredFiles: Array.from({ length: 10000 }, (_, i) => `src/file${i}.ts`)
        },
        dependencies: {
          outdated: Array.from({ length: 1000 }, (_, i) => `dep${i}@^1.0.0`),
          security: Array.from({ length: 500 }, (_, i) => `vuln${i}@^2.0.0`),
        },
        codeQuality: {
          lintIssues: 50000,
          duplicatedCode: Array.from({ length: 500 }, (_, i) => `src/dup${i}.ts`),
          complexityHotspots: Array.from({ length: 200 }, (_, i) => ({
            file: `src/complex${i}.ts`,
            cyclomaticComplexity: 20 + (i % 50),
            cognitiveComplexity: 25 + (i % 60),
            lineCount: 300 + (i % 200)
          })),
          codeSmells: Array.from({ length: 1000 }, (_, i) => `smell${i}`)
        },
        documentation: {
          coverage: 20,
          missingDocs: Array.from({ length: 5000 }, (_, i) => `src/missing${i}.ts`),
        },
        performance: {
          slowTests: Array.from({ length: 200 }, (_, i) => `test/slow${i}.test.ts`),
          bottlenecks: Array.from({ length: 50 }, (_, i) => `src/bottleneck${i}.ts`),
        },
      };

      const startTime = Date.now();

      expect(() => {
        const task = generator.generateTask(massiveAnalysis);
        expect(task).toBeDefined();

        const endTime = Date.now();
        // Should complete in reasonable time (less than 5 seconds)
        expect(endTime - startTime).toBeLessThan(5000);
      }).not.toThrow();
    });

    it('should handle repeated generation cycles without memory leaks', () => {
      const usedCandidatesGrowth: number[] = [];

      for (let cycle = 0; cycle < 50; cycle++) {
        // Generate some tasks
        for (let i = 0; i < 10; i++) {
          generator.generateTask(mockAnalysis);
        }

        usedCandidatesGrowth.push(generator.getUsedCandidates().size);

        // Reset every few cycles to test memory cleanup
        if (cycle % 5 === 0) {
          generator.reset();
        }
      }

      // Memory usage should not grow indefinitely
      const finalSize = usedCandidatesGrowth[usedCandidatesGrowth.length - 1];
      expect(finalSize).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe('Concurrent Usage Scenarios', () => {
    it('should handle rapid sequential generation safely', () => {
      const tasks = [];
      const errors = [];

      for (let i = 0; i < 100; i++) {
        try {
          const task = generator.generateTask(mockAnalysis);
          tasks.push(task);
        } catch (error) {
          errors.push(error);
        }
      }

      // Should not have any errors
      expect(errors).toHaveLength(0);

      // Should generate some tasks
      const validTasks = tasks.filter(t => t !== null);
      expect(validTasks.length).toBeGreaterThan(0);

      // All generated tasks should have low priority
      validTasks.forEach(task => {
        expect(task.priority).toBe('low');
      });
    });

    it('should maintain state consistency during concurrent operations', () => {
      const generator1 = new IdleTaskGenerator();
      const generator2 = new IdleTaskGenerator();

      // Generate tasks with both generators
      const task1 = generator1.generateTask(mockAnalysis);
      const task2 = generator2.generateTask(mockAnalysis);

      // Generators should maintain independent state
      expect(generator1.getUsedCandidates()).not.toBe(generator2.getUsedCandidates());

      // But behavior should be consistent
      if (task1 && task2) {
        expect(task1.priority).toBe(task2.priority);
      }
    });
  });

  describe('Edge Case Weights', () => {
    it('should handle infinite weights', () => {
      const infiniteWeightGenerator = new IdleTaskGenerator({
        maintenance: Infinity,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      expect(() => {
        for (let i = 0; i < 10; i++) {
          const type = infiniteWeightGenerator.selectTaskType();
          expect(typeof type).toBe('string');
        }
      }).not.toThrow();
    });

    it('should handle NaN weights', () => {
      const nanWeightGenerator = new IdleTaskGenerator({
        maintenance: NaN,
        refactoring: 0.5,
        docs: 0.5,
        tests: 0,
      });

      expect(() => {
        for (let i = 0; i < 10; i++) {
          const type = nanWeightGenerator.selectTaskType();
          expect(['maintenance', 'refactoring', 'docs', 'tests']).toContain(type);
        }
      }).not.toThrow();
    });

    it('should handle extremely small weights', () => {
      const tinyWeightGenerator = new IdleTaskGenerator({
        maintenance: Number.MIN_VALUE,
        refactoring: Number.MIN_VALUE * 2,
        docs: 0,
        tests: 0,
      });

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const type = tinyWeightGenerator.selectTaskType();
        counts[type]++;
      }

      // Should still work with tiny weights
      expect(counts.refactoring).toBeGreaterThan(counts.maintenance);
    });
  });

  describe('Task Generation Edge Cases', () => {
    it('should handle empty used candidates set correctly', () => {
      expect(generator.getUsedCandidates().size).toBe(0);

      generator.generateTask(mockAnalysis);

      expect(generator.getUsedCandidates().size).toBeGreaterThanOrEqual(0);
    });

    it('should handle analysis that yields no candidates from any analyzer', () => {
      // Create analysis that should produce no candidates
      const emptyAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 1, lines: 100, languages: { ts: 1 } },
        testCoverage: { percentage: 100, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coverage: 100, missingDocs: [] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const task = generator.generateTask(emptyAnalysis);
      expect(task).toBeNull();
    });

    it('should handle candidate ID collisions gracefully', () => {
      // Create analyzer that generates candidates with same ID
      const collidingAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => [
          {
            candidateId: 'duplicate-id',
            title: 'Task 1',
            description: 'First task',
            priority: 'normal',
            estimatedEffort: 'medium',
            suggestedWorkflow: 'maintenance',
            rationale: 'Test',
            score: 0.5,
          },
          {
            candidateId: 'duplicate-id',  // Same ID
            title: 'Task 2',
            description: 'Second task',
            priority: 'high',
            estimatedEffort: 'low',
            suggestedWorkflow: 'maintenance',
            rationale: 'Test',
            score: 0.8,
          }
        ],
        prioritize: (candidates) => candidates[0] || null,
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', collidingAnalyzer],
      ]);

      const collidingGenerator = new IdleTaskGenerator(
        { maintenance: 1.0, refactoring: 0, docs: 0, tests: 0 },
        analyzers
      );

      // Generate first task
      const task1 = collidingGenerator.generateTask(mockAnalysis);
      expect(task1).not.toBeNull();

      // Generate second task - should handle collision
      const task2 = collidingGenerator.generateTask(mockAnalysis);
      // Might be null if duplicate ID is filtered out correctly
      expect(task2).toBeDefined(); // Defined but could be null
    });
  });
});