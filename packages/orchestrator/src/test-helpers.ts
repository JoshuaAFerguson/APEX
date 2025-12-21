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
    dependencies: {
      outdated: [],
      security: [],
      outdatedPackages: [],
      securityIssues: [],
      deprecatedPackages: []
    },
    codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
    documentation: {
      coverage: 50,
      missingDocs: [],
      undocumentedExports: [],
      outdatedDocs: [],
      missingReadmeSections: [],
      apiCompleteness: {
        percentage: 57.5,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 11,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      }
    },
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
          outdatedPackages: [],
          securityIssues: [],
          deprecatedPackages: []
        },
      };

    case 'refactoring':
      return {
        ...base,
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: [{
            pattern: 'if (user) { return user.name; }',
            locations: ['src/user.ts:42', 'src/profile.ts:18'],
            similarity: 0.95
          }],
          complexityHotspots: [{
            file: 'src/complex.ts',
            cyclomaticComplexity: 15,
            cognitiveComplexity: 22,
            lineCount: 120
          }],
          codeSmells: [{
            file: 'src/smelly.ts',
            type: 'long-method',
            severity: 'high',
            details: 'Method has 85 lines and 12 parameters'
          }]
        },
      };

    case 'docs':
      return {
        ...base,
        documentation: {
          coverage: 20,
          missingDocs: ['src/undocumented.ts'],
          undocumentedExports: [{
            file: 'src/undocumented.ts',
            exportName: 'MyFunction',
            type: 'function',
            line: 42
          }],
          outdatedDocs: [],
          missingReadmeSections: [{
            file: 'README.md',
            section: 'API Reference',
            reason: 'No API documentation found'
          }],
          apiCompleteness: {
            percentage: 32.5,
            details: {
              totalEndpoints: 40,
              documentedEndpoints: 13,
              undocumentedItems: [],
              wellDocumentedExamples: [],
              commonIssues: []
            }
          }
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
    dependencies: {
      outdated: [],
      security: [],
      outdatedPackages: [],
      securityIssues: [],
      deprecatedPackages: []
    },
    codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
    documentation: {
      coverage: 90,
      missingDocs: [],
      undocumentedExports: [],
      outdatedDocs: [],
      missingReadmeSections: [],
      apiCompleteness: {
        percentage: 90,
        details: {
          totalEndpoints: 10,
          documentedEndpoints: 9,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      }
    },
    performance: { slowTests: [], bottlenecks: [] },
  };
}

/**
 * Creates a project analysis with rich dependency data for testing
 */
export function createAnalysisWithRichDependencies(): ProjectAnalysis {
  return {
    codebaseSize: { files: 20, lines: 3000, languages: { ts: 20 } },
    testCoverage: { percentage: 75, uncoveredFiles: [] },
    dependencies: {
      outdated: ['lodash@4.17.15'],
      security: ['vulnerable-pkg@1.0.0'],
      outdatedPackages: [
        {
          name: 'lodash',
          currentVersion: '4.17.15',
          latestVersion: '4.17.21',
          updateType: 'patch',
        },
        {
          name: 'react',
          currentVersion: '16.14.0',
          latestVersion: '18.2.0',
          updateType: 'major',
        },
      ],
      securityIssues: [
        {
          name: 'vulnerable-pkg',
          cveId: 'CVE-2024-12345',
          severity: 'high',
          affectedVersions: '<2.0.0',
          description: 'Remote code execution vulnerability',
        },
        {
          name: 'insecure-lib',
          cveId: 'CVE-2023-98765',
          severity: 'critical',
          affectedVersions: '<=1.5.0',
          description: 'Authentication bypass vulnerability',
        },
      ],
      deprecatedPackages: [
        {
          name: 'old-library',
          currentVersion: '1.2.3',
          replacement: 'new-library',
          reason: 'Unmaintained since 2022',
        },
        {
          name: 'legacy-utils',
          currentVersion: '2.1.0',
          replacement: null,
          reason: 'Functionality moved to native ES2022',
        },
      ],
    },
    codeQuality: { lintIssues: 15, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
    documentation: {
      coverage: 60,
      missingDocs: [],
      undocumentedExports: [],
      outdatedDocs: [],
      missingReadmeSections: [],
      apiCompleteness: {
        percentage: 60,
        details: {
          totalEndpoints: 25,
          documentedEndpoints: 15,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      }
    },
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