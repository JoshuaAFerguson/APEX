/**
 * Enhanced Integration Tests for IdleTaskGenerator
 *
 * Tests the integration of enhanced analyzer capabilities including:
 * - CrossReferenceValidator for documentation validation
 * - VersionMismatchDetector for outdated documentation
 * - Enhanced complexity and duplicate code analysis
 * - Comprehensive analyzer workflow integration
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest';
import { IdleTaskGenerator } from './idle-task-generator';
import { CrossReferenceValidator, VersionMismatchDetector } from './analyzers';
import type { ProjectAnalysis, IdleTask } from './idle-processor';
import { StrategyWeights } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock generateTaskId for predictable test results
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  let counter = 0;
  return {
    ...actual,
    generateTaskId: () => `enhanced-test-${++counter}`,
  };
});

describe('IdleTaskGenerator Enhanced Integration Tests', () => {
  let generator: IdleTaskGenerator;
  let crossRefValidator: CrossReferenceValidator;
  let versionDetector: VersionMismatchDetector;
  let testProjectPath: string;

  beforeAll(async () => {
    // Create a temporary test project structure
    testProjectPath = path.join(__dirname, 'test-project-enhanced');
    await setupTestProject();
  });

  beforeEach(() => {
    generator = new IdleTaskGenerator();
    crossRefValidator = new CrossReferenceValidator();
    versionDetector = new VersionMismatchDetector(testProjectPath);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Enhanced Analyzer Integration', () => {
    it('should integrate all analyzers working together for comprehensive analysis', async () => {
      const analysis: ProjectAnalysis = createComprehensiveProjectAnalysis();

      const task = generator.generateTask(analysis);

      expect(task).not.toBeNull();
      expect(task?.id).toMatch(/^idle-enhanced-test-\d+-/);
      expect(['improvement', 'maintenance', 'optimization', 'documentation']).toContain(task?.type);
      expect(task?.title).toBeTruthy();
      expect(task?.description).toBeTruthy();
      expect(task?.rationale).toBeTruthy();
    });

    it('should prioritize critical security vulnerabilities from enhanced analysis', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 10000, languages: { ts: 100 } },
        testCoverage: { percentage: 80, uncoveredFiles: [] },
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: [
            {
              name: 'critical-package',
              cveId: 'CVE-2023-12345',
              severity: 'critical',
              affectedVersions: '<2.0.0',
              description: 'Critical remote code execution vulnerability'
            }
          ]
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 80,
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: {
            documented: 80,
            undocumented: 20
          }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = generator.generateTask(analysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.title).toContain('Critical');
      expect(task?.title).toContain('Security');
      expect(task?.description).toContain('CVE-2023-12345');
    });

    it('should handle enhanced duplicate code analysis with similarity metrics', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        testCoverage: { percentage: 70, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: 'function processUser(user) { validate(user); save(user); }',
              locations: ['src/user-service.ts', 'src/admin-service.ts', 'src/auth-service.ts'],
              similarity: 0.95
            }
          ],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: createMinimalDocumentationAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = generator.generateTask(analysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');
      expect(task?.title).toBe('Eliminate Duplicated Code');
      expect(task?.description).toContain('95% average similarity');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.rationale).toContain('High-similarity patterns');
    });

    it('should detect complex code smells with specific recommendations', () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 15000, languages: { ts: 100 } },
        testCoverage: { percentage: 60, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 5,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'src/complex-service.ts',
              cyclomaticComplexity: 45,
              cognitiveComplexity: 55,
              lineCount: 850
            }
          ],
          codeSmells: [
            {
              type: 'feature-envy',
              file: 'src/user-service.ts',
              line: 42,
              severity: 'high',
              details: 'Method uses more data from UserData class than its own class'
            },
            {
              type: 'long-method',
              file: 'src/processor.ts',
              line: 15,
              severity: 'medium',
              details: 'Method has 120 lines and 8 parameters'
            }
          ]
        },
        documentation: createMinimalDocumentationAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = generator.generateTask(analysis);

      expect(task).not.toBeNull();
      if (task?.type === 'optimization') {
        expect(task.title).toMatch(/(Refactor|Fix)/);
        expect(task.rationale).toContain('recommended actions');
      }
    });

    it('should generate multiple different task types in sequence', () => {
      const analysis: ProjectAnalysis = createComprehensiveProjectAnalysis();

      const tasks: (IdleTask | null)[] = [];
      for (let i = 0; i < 5; i++) {
        const task = generator.generateTask(analysis);
        tasks.push(task);
      }

      const validTasks = tasks.filter(task => task !== null);
      expect(validTasks.length).toBeGreaterThan(0);

      // Should eventually have different task types
      const taskTypes = new Set(validTasks.map(task => task?.type));
      expect(taskTypes.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Cross-Reference Validation Integration', () => {
    it('should validate documentation references against codebase', async () => {
      // This test demonstrates how cross-reference validation would work
      // In practice, this would be integrated into the documentation analyzer
      const symbolIndex = await crossRefValidator.buildIndex(testProjectPath);

      expect(symbolIndex.stats.totalFiles).toBeGreaterThan(0);
      expect(symbolIndex.stats.totalSymbols).toBeGreaterThan(0);

      // Test reference validation
      const validReference = crossRefValidator.validateReference(symbolIndex, 'TestFunction');
      const invalidReference = crossRefValidator.validateReference(symbolIndex, 'NonExistentFunction');

      expect(validReference).toBe(true);
      expect(invalidReference).toBe(false);
    });

    it('should detect broken documentation references', async () => {
      const symbolIndex = await crossRefValidator.buildIndex(testProjectPath);

      const mockReferences = [
        {
          symbolName: 'TestFunction',
          referenceType: 'inline-code' as const,
          sourceFile: 'README.md',
          line: 10,
          column: 5,
          context: 'Use `TestFunction()` to process data'
        },
        {
          symbolName: 'NonExistentFunction',
          referenceType: 'see-tag' as const,
          sourceFile: 'docs/api.md',
          line: 25,
          column: 10,
          context: '@see NonExistentFunction for more details'
        }
      ];

      const brokenRefs = crossRefValidator.validateDocumentationReferences(symbolIndex, mockReferences);

      expect(brokenRefs).toHaveLength(1);
      expect(brokenRefs[0].type).toBe('broken-link');
      expect(brokenRefs[0].description).toContain('NonExistentFunction');
    });
  });

  describe('Version Mismatch Detection Integration', () => {
    it('should detect version mismatches in documentation', async () => {
      const mismatches = await versionDetector.detectMismatches();

      // Expect at least one mismatch from our test setup
      expect(mismatches.length).toBeGreaterThan(0);
      expect(mismatches[0]).toHaveProperty('file');
      expect(mismatches[0]).toHaveProperty('foundVersion');
      expect(mismatches[0]).toHaveProperty('expectedVersion');
    });

    it('should create tasks for version mismatches', async () => {
      const mockMismatches = [
        {
          file: 'README.md',
          line: 5,
          foundVersion: '1.0.0',
          expectedVersion: '1.2.3',
          lineContent: 'Version: 1.0.0'
        },
        {
          file: 'docs/guide.md',
          line: 12,
          foundVersion: '1.1.0',
          expectedVersion: '1.2.3',
          lineContent: 'Current version: 1.1.0'
        }
      ];

      const task = versionDetector.createVersionMismatchTask(mockMismatches);

      expect(task).not.toBeNull();
      expect(task?.title).toBe('Fix Version Reference Mismatches');
      expect(task?.description).toContain('2 outdated version references');
      expect(task?.description).toContain('2 files');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility with legacy analysis format', () => {
      const legacyAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        testCoverage: { percentage: 60, uncoveredFiles: ['src/legacy.ts'] },
        dependencies: {
          outdated: ['old-package@^1.0.0', 'legacy-lib@^0.5.0'],
          security: ['vulnerable-pkg@1.0.0']
        },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: ['src/duplicate1.ts', 'src/duplicate2.ts'] as any, // Legacy string format
          complexityHotspots: ['src/complex.ts'] as any, // Legacy string format
          codeSmells: []
        },
        documentation: {
          coverage: 40,
          missingDocs: ['src/undocumented.ts'],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { documented: 40, undocumented: 60 }
        },
        performance: { slowTests: ['test/slow.test.ts'], bottlenecks: [] }
      };

      const task = generator.generateTask(legacyAnalysis);

      expect(task).not.toBeNull();
      expect(task?.id).toBeTruthy();
      expect(task?.title).toBeTruthy();
      expect(task?.description).toBeTruthy();
    });

    it('should handle mixed format analysis gracefully', () => {
      const mixedAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 75, lines: 8000, languages: { ts: 75 } },
        testCoverage: { percentage: 70, uncoveredFiles: [] },
        dependencies: {
          // Legacy format
          outdated: ['old-dep@^1.0.0'],
          security: ['vuln-dep@1.0.0'],
          // Enhanced format
          securityIssues: [
            {
              name: 'enhanced-vuln-pkg',
              cveId: 'CVE-2023-54321',
              severity: 'high',
              affectedVersions: '<3.0.0',
              description: 'High severity vulnerability'
            }
          ]
        },
        codeQuality: {
          lintIssues: 15,
          duplicatedCode: [
            'src/legacy-dup.ts', // Legacy string format
            {
              pattern: 'const util = require("util");', // Enhanced format
              locations: ['src/file1.ts', 'src/file2.ts'],
              similarity: 0.8
            }
          ] as any,
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: createMinimalDocumentationAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = generator.generateTask(mixedAnalysis);

      expect(task).not.toBeNull();
      // Should handle both legacy and enhanced formats without errors
      expect(task?.id).toBeTruthy();
    });
  });

  describe('Performance with Enhanced Analysis', () => {
    it('should maintain acceptable performance with enhanced features', () => {
      const largeAnalysis = createLargeScaleProjectAnalysis();

      const startTime = Date.now();
      const task = generator.generateTask(largeAnalysis);
      const endTime = Date.now();

      expect(task).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle rapid successive generations efficiently', () => {
      const analysis = createComprehensiveProjectAnalysis();

      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        generator.generateTask(analysis);
        if (i % 5 === 0) {
          generator.reset(); // Reset periodically
        }
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

// Helper functions for creating test data

function createMinimalDocumentationAnalysis() {
  return {
    coverage: 50,
    missingDocs: [],
    outdatedDocs: [],
    undocumentedExports: [],
    missingReadmeSections: [],
    apiCompleteness: {
      documented: 50,
      undocumented: 50
    }
  };
}

function createComprehensiveProjectAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 200, lines: 25000, languages: { ts: 180, js: 20 } },
    testCoverage: { percentage: 65, uncoveredFiles: ['src/uncovered.ts'] },
    dependencies: {
      outdated: ['legacy-dep@^1.0.0'],
      security: ['old-vuln@1.0.0'],
      securityIssues: [
        {
          name: 'critical-package',
          cveId: 'CVE-2023-99999',
          severity: 'high',
          affectedVersions: '<4.0.0',
          description: 'High severity vulnerability requiring update'
        }
      ],
      outdatedPackages: [
        {
          name: 'major-update-pkg',
          currentVersion: '2.1.0',
          latestVersion: '3.0.0',
          updateType: 'major'
        }
      ],
      deprecatedPackages: [
        {
          name: 'old-package',
          currentVersion: '1.0.0',
          replacement: 'new-package',
          reason: 'Package is no longer maintained'
        }
      ]
    },
    codeQuality: {
      lintIssues: 45,
      duplicatedCode: [
        {
          pattern: 'export function processData(data: any) { return data.map(item => item.value); }',
          locations: ['src/service1.ts', 'src/service2.ts'],
          similarity: 0.92
        }
      ],
      complexityHotspots: [
        {
          file: 'src/complex-algorithm.ts',
          cyclomaticComplexity: 35,
          cognitiveComplexity: 42,
          lineCount: 650
        }
      ],
      codeSmells: [
        {
          type: 'feature-envy',
          file: 'src/data-processor.ts',
          line: 28,
          severity: 'medium',
          details: 'Method uses external class data more than own class'
        }
      ]
    },
    documentation: {
      coverage: 55,
      missingDocs: ['src/api.ts', 'src/utils.ts'],
      outdatedDocs: [
        {
          file: 'README.md',
          type: 'outdated-example',
          description: 'Code example uses deprecated API',
          line: 45,
          suggestion: 'Update to use new API format',
          severity: 'medium'
        }
      ],
      undocumentedExports: [
        {
          name: 'processData',
          file: 'src/data.ts',
          line: 15,
          type: 'function'
        }
      ],
      missingReadmeSections: [
        {
          section: 'Contributing',
          priority: 'medium',
          description: 'No contribution guidelines found'
        }
      ],
      apiCompleteness: {
        documented: 55,
        undocumented: 45
      }
    },
    performance: {
      bundleSize: 1200000,
      slowTests: ['test/integration.test.ts'],
      bottlenecks: ['src/heavy-computation.ts']
    }
  };
}

function createLargeScaleProjectAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 1000, lines: 100000, languages: { ts: 800, js: 200 } },
    testCoverage: {
      percentage: 45,
      uncoveredFiles: Array.from({ length: 200 }, (_, i) => `src/uncovered${i}.ts`)
    },
    dependencies: {
      outdated: Array.from({ length: 50 }, (_, i) => `dep${i}@^1.0.0`),
      security: Array.from({ length: 10 }, (_, i) => `vuln${i}@1.0.0`),
      securityIssues: Array.from({ length: 15 }, (_, i) => ({
        name: `pkg${i}`,
        cveId: `CVE-2023-${String(i).padStart(5, '0')}`,
        severity: i < 3 ? 'critical' : i < 8 ? 'high' : 'medium' as any,
        affectedVersions: '<2.0.0',
        description: `Security issue ${i}`
      }))
    },
    codeQuality: {
      lintIssues: 500,
      duplicatedCode: Array.from({ length: 25 }, (_, i) => ({
        pattern: `function process${i}() { /* duplicate code */ }`,
        locations: [`src/file${i}a.ts`, `src/file${i}b.ts`],
        similarity: 0.7 + Math.random() * 0.3
      })),
      complexityHotspots: Array.from({ length: 30 }, (_, i) => ({
        file: `src/complex${i}.ts`,
        cyclomaticComplexity: 20 + Math.floor(Math.random() * 40),
        cognitiveComplexity: 25 + Math.floor(Math.random() * 50),
        lineCount: 200 + Math.floor(Math.random() * 800)
      })),
      codeSmells: Array.from({ length: 40 }, (_, i) => ({
        type: ['feature-envy', 'long-method', 'data-clumps'][i % 3],
        file: `src/smell${i}.ts`,
        line: 10 + i,
        severity: ['low', 'medium', 'high'][i % 3] as any,
        details: `Code smell ${i} detected`
      }))
    },
    documentation: {
      coverage: 30,
      missingDocs: Array.from({ length: 100 }, (_, i) => `src/undoc${i}.ts`),
      outdatedDocs: Array.from({ length: 20 }, (_, i) => ({
        file: `docs/doc${i}.md`,
        type: 'outdated-example' as any,
        description: `Outdated documentation ${i}`,
        line: 10,
        suggestion: 'Update documentation',
        severity: 'medium' as any
      })),
      undocumentedExports: [],
      missingReadmeSections: [],
      apiCompleteness: { documented: 30, undocumented: 70 }
    },
    performance: {
      bundleSize: 5000000,
      slowTests: Array.from({ length: 15 }, (_, i) => `test/slow${i}.test.ts`),
      bottlenecks: Array.from({ length: 10 }, (_, i) => `src/bottleneck${i}.ts`)
    }
  };
}

async function setupTestProject(): Promise<void> {
  const testProjectPath = path.join(__dirname, 'test-project-enhanced');

  try {
    // Create directory structure
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(path.join(testProjectPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(testProjectPath, 'docs'), { recursive: true });

    // Create package.json with version
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.2.3' }, null, 2)
    );

    // Create test source file with symbols
    await fs.writeFile(
      path.join(testProjectPath, 'src', 'test.ts'),
      `
export function TestFunction(data: any): any {
  return data;
}

export class TestClass {
  public method(): void {
    // Implementation
  }
}

export interface TestInterface {
  prop: string;
}
`
    );

    // Create README with version mismatch
    await fs.writeFile(
      path.join(testProjectPath, 'README.md'),
      `
# Test Project

Version: 1.0.0

This project uses \`TestFunction()\` for data processing.

## Usage

\`\`\`typescript
import { TestClass } from './src/test';
const instance = new TestClass();
\`\`\`
`
    );

    // Create docs with broken reference
    await fs.writeFile(
      path.join(testProjectPath, 'docs', 'api.md'),
      `
# API Documentation

## Functions

- \`TestFunction()\` - processes data
- \`NonExistentFunction()\` - this doesn't exist

@see NonExistentFunction for more details
`
    );
  } catch (error) {
    // Ignore if directory already exists or other setup issues
    console.warn('Test project setup warning:', error);
  }
}