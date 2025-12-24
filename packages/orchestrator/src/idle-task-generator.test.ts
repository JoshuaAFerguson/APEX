import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  IdleTaskGenerator,
  MaintenanceAnalyzer,
  RefactoringAnalyzer,
  DocsAnalyzer,
  TestsAnalyzer,
  TaskCandidate,
  StrategyAnalyzer,
} from './idle-task-generator';
import { IdleTaskType, StrategyWeights } from '@apex/core';
import type { ProjectAnalysis } from './idle-processor';

// Mock generateTaskId to produce predictable IDs
vi.mock('@apex/core', async () => {
  const actual = await vi.importActual('@apex/core');
  let counter = 0;
  return {
    ...actual,
    generateTaskId: () => `test-id-${++counter}`,
  };
});

describe('IdleTaskGenerator', () => {
  let generator: IdleTaskGenerator;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    mockAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { ts: 40, js: 10 } },
      testCoverage: { percentage: 45, uncoveredFiles: ['src/utils.ts', 'src/service.ts'] },
      dependencies: {
        outdated: ['old-lib@^0.1.0', 'legacy@^0.5.0'],
        security: [],
      },
      codeQuality: {
        lintIssues: 25,
        duplicatedCode: [],
        complexityHotspots: [{
          file: 'src/complex.ts',
          cyclomaticComplexity: 15,
          cognitiveComplexity: 20,
          lineCount: 300
        }],
        codeSmells: []
      },
      documentation: { coverage: 35, missingDocs: ['src/core.ts', 'src/api/index.ts'] },
      performance: { slowTests: [], bottlenecks: [] },
    };
  });

  describe('constructor', () => {
    it('should use default weights when none provided', () => {
      generator = new IdleTaskGenerator();
      const weights = generator.getWeights();

      expect(weights.maintenance).toBe(0.25);
      expect(weights.refactoring).toBe(0.25);
      expect(weights.docs).toBe(0.25);
      expect(weights.tests).toBe(0.25);
    });

    it('should merge provided weights with defaults', () => {
      generator = new IdleTaskGenerator({ maintenance: 0.5 });
      const weights = generator.getWeights();

      expect(weights.maintenance).toBe(0.5);
      expect(weights.refactoring).toBe(0.25);
      expect(weights.docs).toBe(0.25);
      expect(weights.tests).toBe(0.25);
    });

    it('should use custom analyzers when provided', () => {
      const mockAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => [],
        prioritize: () => null,
      };
      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', mockAnalyzer],
      ]);

      generator = new IdleTaskGenerator(undefined, analyzers);
      // Should not throw when using the generator
      const task = generator.generateTask(mockAnalysis);
      // Task will be null since mock analyzer returns empty array
      expect(task).toBeNull();
    });
  });

  describe('selectTaskType', () => {
    it('should select based on weights (statistical test)', () => {
      // High weight for maintenance, zero for others
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      // Run many selections
      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      for (let i = 0; i < 100; i++) {
        const type = generator.selectTaskType();
        counts[type]++;
      }

      // Maintenance should be selected 100% of the time
      expect(counts.maintenance).toBe(100);
      expect(counts.refactoring).toBe(0);
      expect(counts.docs).toBe(0);
      expect(counts.tests).toBe(0);
    });

    it('should distribute selections according to weights', () => {
      // Equal weights for two types, zero for others
      generator = new IdleTaskGenerator({
        maintenance: 0.5,
        refactoring: 0.5,
        docs: 0,
        tests: 0,
      });

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      // Run many selections
      for (let i = 0; i < 1000; i++) {
        const type = generator.selectTaskType();
        counts[type]++;
      }

      // Both should have roughly 50% (with tolerance)
      expect(counts.maintenance).toBeGreaterThan(400);
      expect(counts.maintenance).toBeLessThan(600);
      expect(counts.refactoring).toBeGreaterThan(400);
      expect(counts.refactoring).toBeLessThan(600);
      expect(counts.docs).toBe(0);
      expect(counts.tests).toBe(0);
    });

    it('should fall back to uniform distribution when all weights are zero', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      // Run many selections
      for (let i = 0; i < 1000; i++) {
        const type = generator.selectTaskType();
        counts[type]++;
      }

      // Each type should have roughly 25% (with tolerance)
      for (const type of ['maintenance', 'refactoring', 'docs', 'tests'] as IdleTaskType[]) {
        expect(counts[type]).toBeGreaterThan(150);
        expect(counts[type]).toBeLessThan(350);
      }
    });
  });

  describe('generateTask', () => {
    it('should generate a maintenance task when maintenance issues exist', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      const task = generator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
    });

    it('should generate a tests task when test coverage is low', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 1.0,
      });

      const task = generator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('improvement'); // tests maps to improvement
      expect(task?.suggestedWorkflow).toBe('testing');
    });

    it('should generate a docs task when documentation coverage is low', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 1.0,
        tests: 0,
      });

      const task = generator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('documentation');
    });

    it('should generate a refactoring task when complexity issues exist', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 1.0,
        docs: 0,
        tests: 0,
      });

      const task = generator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization'); // refactoring maps to optimization
    });

    it('should try other types when selected type has no candidates', () => {
      // Create analysis with only maintenance issues
      const analysisWithOnlyMaintenance: ProjectAnalysis = {
        ...mockAnalysis,
        testCoverage: { percentage: 95, uncoveredFiles: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coverage: 90, missingDocs: [] },
      };

      // Weight towards tests, but it should fall back to maintenance
      generator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 1.0,
      });

      const task = generator.generateTask(analysisWithOnlyMaintenance);

      // Should generate maintenance task since tests has no candidates
      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
    });

    it('should return null when no valid tasks can be generated', () => {
      // Create analysis with no issues
      const healthyAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        testCoverage: { percentage: 95, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coverage: 90, missingDocs: [] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      generator = new IdleTaskGenerator();
      const task = generator.generateTask(healthyAnalysis);

      expect(task).toBeNull();
    });

    it('should not generate duplicate tasks', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      const task1 = generator.generateTask(mockAnalysis);
      const task2 = generator.generateTask(mockAnalysis);

      expect(task1).not.toBeNull();
      // Second task should be different (or null if no more candidates)
      if (task2) {
        expect(task2.title).not.toBe(task1?.title);
      }
    });

    it('should always generate tasks with low priority regardless of candidate priority', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      const task = generator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.priority).toBe('low');
    });
  });

  describe('reset', () => {
    it('should clear used candidates and allow regeneration', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      // Analysis with only one maintenance issue
      const limitedAnalysis: ProjectAnalysis = {
        ...mockAnalysis,
        dependencies: {
          outdated: ['single-dep@^0.1.0'],
          security: [],
        },
      };

      const task1 = generator.generateTask(limitedAnalysis);
      const task2 = generator.generateTask(limitedAnalysis);

      // First should succeed, second might fail due to dedup
      expect(task1).not.toBeNull();

      // Reset and try again
      generator.reset();
      const task3 = generator.generateTask(limitedAnalysis);

      // Should be able to generate again after reset
      expect(task3).not.toBeNull();
    });
  });

  describe('getUsedCandidates', () => {
    it('should track used candidates', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      expect(generator.getUsedCandidates().size).toBe(0);

      generator.generateTask(mockAnalysis);

      expect(generator.getUsedCandidates().size).toBeGreaterThan(0);
    });
  });
});

describe('MaintenanceAnalyzer', () => {
  let analyzer: MaintenanceAnalyzer;

  beforeEach(() => {
    analyzer = new MaintenanceAnalyzer();
  });

  it('should have correct type', () => {
    expect(analyzer.type).toBe('maintenance');
  });

  it('should generate security task for security vulnerabilities', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: {
        outdated: [],
        security: ['vulnerable-lib@1.0.0', 'another-vuln@2.0.0'],
      },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    expect(candidates.length).toBeGreaterThan(0);
    const securityTask = candidates.find((c) => c.title.includes('Security'));
    expect(securityTask).toBeDefined();
    expect(securityTask?.priority).toBe('urgent');
    expect(securityTask?.score).toBe(1.0);
  });

  it('should generate outdated deps task', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: {
        outdated: ['old-lib@^1.0.0', 'legacy@^2.0.0'],
        security: [],
      },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    expect(candidates.length).toBeGreaterThan(0);
    const outdatedTask = candidates.find((c) => c.title.includes('Outdated'));
    expect(outdatedTask).toBeDefined();
  });

  it('should prioritize pre-1.0 dependencies', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: {
        outdated: ['beta-lib@^0.1.0', 'alpha-lib@~0.5.0', 'stable@^2.0.0'],
        security: [],
      },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const pre1Task = candidates.find((c) => c.title.includes('Pre-1.0'));
    expect(pre1Task).toBeDefined();
    expect(pre1Task?.priority).toBe('high');
  });

  it('should return empty array when no issues', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    expect(candidates).toHaveLength(0);
  });
});

describe('RefactoringAnalyzer', () => {
  let analyzer: RefactoringAnalyzer;

  beforeEach(() => {
    analyzer = new RefactoringAnalyzer();
  });

  it('should have correct type', () => {
    expect(analyzer.type).toBe('refactoring');
  });

  it('should generate duplicated code task', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: ['src/utils.ts', 'src/helpers.ts'],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const dupTask = candidates.find((c) => c.title.includes('Duplicated'));
    expect(dupTask).toBeDefined();
    expect(dupTask?.priority).toBe('high');
  });

  it('should generate complexity hotspot tasks', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [
          { file: 'src/complex1.ts', cyclomaticComplexity: 18, cognitiveComplexity: 25, lineCount: 400 },
          { file: 'src/complex2.ts', cyclomaticComplexity: 22, cognitiveComplexity: 28, lineCount: 350 }
        ],
        codeSmells: []
      },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const complexTasks = candidates.filter((c) => c.title.includes('Refactor'));
    expect(complexTasks.length).toBe(2);

    // Verify the tasks contain complexity scores
    const firstTask = complexTasks[0];
    expect(firstTask.description).toContain('Cyclomatic Complexity:');
    expect(firstTask.description).toContain('Cognitive Complexity:');
    expect(firstTask.rationale).toContain('Recommended actions:');
  });

  it('should generate lint issues task for high issue count', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: {
        lintIssues: 100,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const lintTask = candidates.find((c) => c.title.includes('Linting'));
    expect(lintTask).toBeDefined();
  });

  it('should prioritize critical complexity hotspots', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [
          { file: 'src/critical.ts', cyclomaticComplexity: 60, cognitiveComplexity: 70, lineCount: 2500 },
          { file: 'src/medium.ts', cyclomaticComplexity: 15, cognitiveComplexity: 20, lineCount: 300 }
        ],
        codeSmells: []
      },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const complexTasks = candidates.filter((c) => c.title.includes('Refactor'));
    expect(complexTasks.length).toBe(2);

    // First task should be the critical one and have urgent priority
    const criticalTask = complexTasks[0];
    expect(criticalTask.title).toContain('critical.ts');
    expect(criticalTask.priority).toBe('urgent');
    expect(criticalTask.description).toContain('critical');
    expect(criticalTask.description).toContain('immediate attention');
  });

  it('should handle legacy string format complexity hotspots', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: ['src/legacy.ts', 'src/old.ts'] as any, // Legacy string format
        codeSmells: []
      },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const complexTasks = candidates.filter((c) => c.title.includes('Refactor'));
    expect(complexTasks.length).toBe(2);

    // Should generate tasks with default complexity values
    const firstTask = complexTasks[0];
    expect(firstTask.description).toContain('Cyclomatic Complexity: 15');
    expect(firstTask.description).toContain('Cognitive Complexity: 20');
  });

  it('should generate sweep task for many hotspots', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [
          { file: 'src/file1.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 400 },
          { file: 'src/file2.ts', cyclomaticComplexity: 20, cognitiveComplexity: 25, lineCount: 350 },
          { file: 'src/file3.ts', cyclomaticComplexity: 18, cognitiveComplexity: 22, lineCount: 300 },
          { file: 'src/file4.ts', cyclomaticComplexity: 22, cognitiveComplexity: 28, lineCount: 380 }
        ],
        codeSmells: []
      },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const sweepTask = candidates.find((c) => c.title.includes('Address Codebase Complexity'));
    expect(sweepTask).toBeDefined();
    expect(sweepTask?.description).toContain('4 complexity hotspots');
  });
});

describe('DocsAnalyzer', () => {
  let analyzer: DocsAnalyzer;

  beforeEach(() => {
    analyzer = new DocsAnalyzer();
  });

  it('should have correct type', () => {
    expect(analyzer.type).toBe('docs');
  });

  it('should generate critical docs task for very low coverage', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 10, missingDocs: ['src/index.ts'] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const criticalTask = candidates.find((c) => c.title.includes('Critical'));
    expect(criticalTask).toBeDefined();
    expect(criticalTask?.priority).toBe('high');
  });

  it('should prioritize core module documentation', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: {
        coverage: 40,
        missingDocs: ['src/core.ts', 'src/api/index.ts', 'src/utils.ts'],
      },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const coreTask = candidates.find((c) => c.title.includes('Core Modules'));
    expect(coreTask).toBeDefined();
  });
});

describe('TestsAnalyzer', () => {
  let analyzer: TestsAnalyzer;

  beforeEach(() => {
    analyzer = new TestsAnalyzer();
  });

  it('should have correct type', () => {
    expect(analyzer.type).toBe('tests');
  });

  it('should generate critical coverage task for very low coverage', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      testCoverage: { percentage: 15, uncoveredFiles: [] },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const criticalTask = candidates.find((c) => c.title.includes('Critical'));
    expect(criticalTask).toBeDefined();
    expect(criticalTask?.priority).toBe('high');
  });

  it('should prioritize critical code paths', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      testCoverage: {
        percentage: 50,
        uncoveredFiles: ['src/service.ts', 'src/controller.ts', 'src/utils.ts'],
      },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const criticalPathsTask = candidates.find((c) => c.title.includes('Critical Code Paths'));
    expect(criticalPathsTask).toBeDefined();
    expect(criticalPathsTask?.priority).toBe('high');
  });

  it('should generate slow tests task', () => {
    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: {} },
      testCoverage: { percentage: 80, uncoveredFiles: [] },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: { coverage: 50, missingDocs: [] },
      performance: { slowTests: ['test/slow.test.ts'], bottlenecks: [] },
    };

    const candidates = analyzer.analyze(analysis);

    const slowTestsTask = candidates.find((c) => c.title.includes('Slow Tests'));
    expect(slowTestsTask).toBeDefined();
  });
});

describe('Analyzer prioritize', () => {
  it('should select candidate with highest score', () => {
    const analyzer = new MaintenanceAnalyzer();

    const candidates: TaskCandidate[] = [
      {
        candidateId: '1',
        title: 'Low priority',
        description: 'Low',
        priority: 'low',
        estimatedEffort: 'low',
        suggestedWorkflow: 'maintenance',
        rationale: 'Test',
        score: 0.3,
      },
      {
        candidateId: '2',
        title: 'High priority',
        description: 'High',
        priority: 'high',
        estimatedEffort: 'medium',
        suggestedWorkflow: 'maintenance',
        rationale: 'Test',
        score: 0.9,
      },
    ];

    const best = analyzer.prioritize(candidates);

    expect(best?.candidateId).toBe('2');
    expect(best?.title).toBe('High priority');
  });

  it('should return null for empty candidates', () => {
    const analyzer = new MaintenanceAnalyzer();
    const best = analyzer.prioritize([]);

    expect(best).toBeNull();
  });

  it('should handle candidates with equal scores', () => {
    const analyzer = new MaintenanceAnalyzer();

    const candidates: TaskCandidate[] = [
      {
        candidateId: '1',
        title: 'Task A',
        description: 'First task',
        priority: 'normal',
        estimatedEffort: 'medium',
        suggestedWorkflow: 'maintenance',
        rationale: 'Test',
        score: 0.5,
      },
      {
        candidateId: '2',
        title: 'Task B',
        description: 'Second task',
        priority: 'normal',
        estimatedEffort: 'medium',
        suggestedWorkflow: 'maintenance',
        rationale: 'Test',
        score: 0.5,
      },
    ];

    const best = analyzer.prioritize(candidates);

    expect(best).toBeDefined();
    expect(['1', '2']).toContain(best?.candidateId);
  });
});

describe('Edge Cases and Error Handling', () => {
  let generator: IdleTaskGenerator;
  let mockAnalysis: ProjectAnalysis;

  beforeEach(() => {
    mockAnalysis = {
      codebaseSize: { files: 50, lines: 5000, languages: { ts: 40, js: 10 } },
      testCoverage: { percentage: 45, uncoveredFiles: ['src/utils.ts'] },
      dependencies: { outdated: ['old-lib@^0.1.0'], security: [] },
      codeQuality: {
        lintIssues: 25,
        duplicatedCode: [],
        complexityHotspots: [{ file: 'src/complex.ts', cyclomaticComplexity: 20, cognitiveComplexity: 24, lineCount: 380 }],
        codeSmells: []
      },
      documentation: { coverage: 35, missingDocs: ['src/core.ts'] },
      performance: { slowTests: [], bottlenecks: [] },
    };
  });

  describe('Weighted Selection Edge Cases', () => {
    it('should handle very small weight differences', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.000001,
        refactoring: 0.000002,
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
        const type = generator.selectTaskType();
        counts[type]++;
      }

      expect(counts.refactoring).toBeGreaterThan(counts.maintenance);
    });

    it('should handle floating point precision issues', () => {
      generator = new IdleTaskGenerator({
        maintenance: 0.1,
        refactoring: 0.2,
        docs: 0.3,
        tests: 0.4000000000000001, // floating point precision issue
      });

      // Should not throw errors or produce NaN
      for (let i = 0; i < 100; i++) {
        const type = generator.selectTaskType();
        expect(typeof type).toBe('string');
        expect(['maintenance', 'refactoring', 'docs', 'tests']).toContain(type);
      }
    });

    it('should handle negative weights by treating them as zero', () => {
      generator = new IdleTaskGenerator({
        maintenance: -0.5, // Invalid negative weight
        refactoring: 0.5,
        docs: 0.5,
        tests: 0,
      });

      const counts: Record<IdleTaskType, number> = {
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      };

      for (let i = 0; i < 1000; i++) {
        const type = generator.selectTaskType();
        counts[type]++;
      }

      // Maintenance should have very few selections due to negative weight
      expect(counts.maintenance).toBeLessThan(100);
      expect(counts.refactoring + counts.docs).toBeGreaterThan(800);
    });

    it('should handle extremely large weight values', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1000000,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      for (let i = 0; i < 100; i++) {
        const type = generator.selectTaskType();
        expect(type).toBe('maintenance');
      }
    });
  });

  describe('Analyzer Error Scenarios', () => {
    it('should handle analyzer that returns invalid candidates', () => {
      const brokenAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => [
          // Missing required fields
          {
            candidateId: 'broken',
            title: 'Broken Task',
            description: '',
            priority: 'normal',
            estimatedEffort: 'medium',
            suggestedWorkflow: 'maintenance',
            rationale: '',
            score: NaN, // Invalid score
          },
        ],
        prioritize: (candidates) => candidates[0] || null,
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', brokenAnalyzer],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);

      generator = new IdleTaskGenerator({ maintenance: 1.0, refactoring: 0, docs: 0, tests: 0 }, analyzers);

      // Should handle gracefully and try other analyzers
      const task = generator.generateTask(mockAnalysis);
      expect(task).not.toBeNull(); // Should fall back to other analyzers
    });

    it('should handle analyzer that throws exceptions', () => {
      const throwingAnalyzer: StrategyAnalyzer = {
        type: 'maintenance',
        analyze: () => {
          throw new Error('Analyzer error');
        },
        prioritize: () => null,
      };

      const analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', throwingAnalyzer],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);

      generator = new IdleTaskGenerator({ maintenance: 1.0, refactoring: 0, docs: 0, tests: 0 }, analyzers);

      // Should handle exception and try other analyzers
      expect(() => {
        generator.generateTask(mockAnalysis);
      }).not.toThrow();
    });
  });

  describe('Memory and Performance', () => {
    it('should not accumulate memory with repeated reset/generate cycles', () => {
      generator = new IdleTaskGenerator();

      // Simulate many cycles
      for (let cycle = 0; cycle < 100; cycle++) {
        generator.reset();

        // Generate a few tasks
        for (let i = 0; i < 5; i++) {
          generator.generateTask(mockAnalysis);
        }
      }

      // Used candidates should not grow indefinitely
      const usedCount = generator.getUsedCandidates().size;
      expect(usedCount).toBeLessThan(50); // Should be reasonable
    });

    it('should handle analysis with large amounts of data', () => {
      const largeAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 10000, lines: 1000000, languages: { ts: 8000, js: 2000 } },
        testCoverage: {
          percentage: 30,
          uncoveredFiles: Array.from({ length: 5000 }, (_, i) => `src/file${i}.ts`)
        },
        dependencies: {
          outdated: Array.from({ length: 200 }, (_, i) => `dep${i}@^1.0.0`),
          security: Array.from({ length: 50 }, (_, i) => `vuln${i}@^2.0.0`),
        },
        codeQuality: {
          lintIssues: 1000,
          duplicatedCode: Array.from({ length: 100 }, (_, i) => `src/dup${i}.ts`),
          complexityHotspots: Array.from({ length: 50 }, (_, i) => `src/complex${i}.ts`),
        },
        documentation: {
          coverage: 20,
          missingDocs: Array.from({ length: 1000 }, (_, i) => `src/missing${i}.ts`),
        },
        performance: {
          slowTests: Array.from({ length: 100 }, (_, i) => `test/slow${i}.test.ts`),
          bottlenecks: Array.from({ length: 20 }, (_, i) => `src/bottleneck${i}.ts`),
        },
      };

      generator = new IdleTaskGenerator();

      // Should handle large datasets without performance issues
      const startTime = Date.now();
      const task = generator.generateTask(largeAnalysis);
      const endTime = Date.now();

      expect(task).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time
    });
  });

  describe('Task ID Generation and Uniqueness', () => {
    it('should generate unique task IDs across multiple generations', () => {
      generator = new IdleTaskGenerator();
      const taskIds = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const task = generator.generateTask(mockAnalysis);
        if (task) {
          expect(taskIds.has(task.id)).toBe(false);
          taskIds.add(task.id);
        }
        generator.reset(); // Allow regeneration
      }

      expect(taskIds.size).toBeGreaterThan(0);
    });

    it('should include task type in generated ID', () => {
      generator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0,
      });

      const task = generator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.id).toMatch(/idle-.*-maintenance/);
    });
  });
});

describe('Type Mapping', () => {
  let generator: IdleTaskGenerator;

  beforeEach(() => {
    generator = new IdleTaskGenerator();
  });

  it('should correctly map IdleTaskType to IdleTask type field', () => {
    const mockAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
      testCoverage: { percentage: 20, uncoveredFiles: ['test.ts'] },
      dependencies: { outdated: ['dep@^1.0.0'], security: ['vuln@1.0.0'] },
      codeQuality: {
        lintIssues: 50,
        duplicatedCode: [{ pattern: 'duplicate pattern', locations: ['dup.ts'], similarity: 0.9 }],
        complexityHotspots: [{ file: 'complex.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 500 }],
        codeSmells: []
      },
      documentation: { coverage: 30, missingDocs: ['missing.ts'] },
      performance: { slowTests: [], bottlenecks: [] },
    };

    // Test each type mapping
    const typeMap = {
      maintenance: 'maintenance',
      refactoring: 'optimization',
      docs: 'documentation',
      tests: 'improvement',
    };

    for (const [idleTaskType, expectedType] of Object.entries(typeMap)) {
      const weights = { maintenance: 0, refactoring: 0, docs: 0, tests: 0 };
      weights[idleTaskType as keyof typeof weights] = 1.0;

      const typeGenerator = new IdleTaskGenerator(weights);
      const task = typeGenerator.generateTask(mockAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe(expectedType);
    }
  });
});
