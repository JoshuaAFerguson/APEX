/**
 * Test helpers for IdleTaskGenerator testing
 */
import type { ProjectAnalysis } from './idle-processor';

/**
 * Creates a minimal project analysis for testing
 */
export function createMinimalAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
    testCoverage: { percentage: 50, uncoveredFiles: [] },
    dependencies: { outdated: [], security: [] },
    codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [] },
    documentation: { coverage: 50, missingDocs: [] },
    performance: { slowTests: [], bottlenecks: [] },
  };
}

/**
 * Creates a project analysis with specific issue types for testing
 */
export function createAnalysisWithIssues(issueType: 'maintenance' | 'refactoring' | 'docs' | 'tests'): ProjectAnalysis {
  const base = createMinimalAnalysis();

  switch (issueType) {
    case 'maintenance':
      return {
        ...base,
        dependencies: {
          outdated: ['old-dep@^1.0.0'],
          security: ['vuln-dep@1.0.0'],
        },
      };

    case 'refactoring':
      return {
        ...base,
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: ['src/duplicate.ts'],
          complexityHotspots: ['src/complex.ts'],
        },
      };

    case 'docs':
      return {
        ...base,
        documentation: {
          coverage: 20,
          missingDocs: ['src/undocumented.ts'],
        },
      };

    case 'tests':
      return {
        ...base,
        testCoverage: {
          percentage: 30,
          uncoveredFiles: ['src/untested.ts'],
        },
      };

    default:
      return base;
  }
}

/**
 * Creates a "healthy" project analysis with minimal issues
 */
export function createHealthyAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 50, lines: 8000, languages: { ts: 50 } },
    testCoverage: { percentage: 95, uncoveredFiles: [] },
    dependencies: { outdated: [], security: [] },
    codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [] },
    documentation: { coverage: 90, missingDocs: [] },
    performance: { slowTests: [], bottlenecks: [] },
  };
}

/**
 * Assert helper for checking task properties
 */
export function assertValidTask(task: any): asserts task is NonNullable<typeof task> {
  expect(task).not.toBeNull();
  expect(task).toHaveProperty('id');
  expect(task).toHaveProperty('type');
  expect(task).toHaveProperty('title');
  expect(task).toHaveProperty('description');
  expect(task).toHaveProperty('priority');
  expect(task).toHaveProperty('estimatedEffort');
  expect(task).toHaveProperty('suggestedWorkflow');
  expect(task).toHaveProperty('rationale');
  expect(task).toHaveProperty('createdAt');
  expect(task).toHaveProperty('implemented');

  expect(typeof task.id).toBe('string');
  expect(typeof task.title).toBe('string');
  expect(typeof task.description).toBe('string');
  expect(['improvement', 'maintenance', 'optimization', 'documentation']).toContain(task.type);
  expect(['low', 'normal', 'high', 'urgent']).toContain(task.priority);
  expect(['low', 'medium', 'high']).toContain(task.estimatedEffort);
  expect(typeof task.suggestedWorkflow).toBe('string');
  expect(typeof task.rationale).toBe('string');
  expect(task.createdAt).toBeInstanceOf(Date);
  expect(task.implemented).toBe(false);
}

/**
 * Helper to run statistical tests on weighted selection
 */
export function runWeightedSelectionTest(
  generator: { selectTaskType(): string },
  iterations: number = 1000
): Record<string, number> {
  const counts: Record<string, number> = {
    maintenance: 0,
    refactoring: 0,
    docs: 0,
    tests: 0,
  };

  for (let i = 0; i < iterations; i++) {
    const type = generator.selectTaskType();
    counts[type] = (counts[type] || 0) + 1;
  }

  return counts;
}