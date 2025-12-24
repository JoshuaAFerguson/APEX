/**
 * Acceptance Integration Tests for Enhanced IdleTaskGenerator
 *
 * This test suite validates the specific acceptance criteria for the enhanced IdleTaskGenerator:
 * 1. All analyzers work together in IdleTaskGenerator
 * 2. Enhanced detection produces actionable tasks
 * 3. Backward compatibility maintained
 * 4. Performance acceptable with enhanced analysis
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { IdleTaskGenerator } from './idle-task-generator';
import { CrossReferenceValidator, VersionMismatchDetector } from './analyzers';
import type { ProjectAnalysis, IdleTask } from './idle-processor';
import { StrategyWeights } from '@apex/core';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock generateTaskId for predictable test results
vi.mock('@apex/core', async () => {
  const actual = await vi.importActual('@apex/core');
  let counter = 0;
  return {
    ...actual,
    generateTaskId: () => `acceptance-test-${++counter}`,
  };
});

describe('IdleTaskGenerator Acceptance Criteria Integration Tests', () => {
  let generator: IdleTaskGenerator;
  let enhancedGenerator: IdleTaskGenerator;
  let testProjectPath: string;

  beforeAll(async () => {
    // Create test project structure
    testProjectPath = path.join(__dirname, 'test-project-acceptance');
    await setupAcceptanceTestProject();
  });

  beforeEach(() => {
    generator = new IdleTaskGenerator();
    enhancedGenerator = IdleTaskGenerator.createEnhanced(testProjectPath);
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('AC1: All analyzers work together in IdleTaskGenerator', () => {
    it('should successfully integrate all analyzer types and produce diverse tasks', () => {
      const comprehensiveAnalysis = createFullAnalysisData();

      const tasks: IdleTask[] = [];
      // Generate multiple tasks to see different analyzer outputs
      for (let i = 0; i < 15; i++) {
        const task = enhancedGenerator.generateTask(comprehensiveAnalysis);
        if (task) {
          tasks.push(task);
        }

        // Reset occasionally to allow task regeneration
        if (i % 5 === 0) {
          enhancedGenerator.reset();
        }
      }

      // Verify we have tasks from different analyzers
      expect(tasks.length).toBeGreaterThan(5);

      const taskTypes = new Set(tasks.map(t => t.type));
      expect(taskTypes.size).toBeGreaterThanOrEqual(2);

      // Should include multiple analyzer categories
      const categories = tasks.map(t => t.type);
      expect(categories).toEqual(
        expect.arrayContaining(['maintenance', 'optimization'])
      );

      // Verify task structure quality
      for (const task of tasks) {
        expect(task.id).toMatch(/^idle-acceptance-test-\d+/);
        expect(task.title).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(task.rationale).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(task.estimatedEffort);
        expect(task.priority).toBe('low'); // All idle tasks have low priority by default
        expect(task.implemented).toBe(false);
        expect(task.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should handle analyzer integration when some analyzers have no candidates', () => {
      // Analysis with only security issues (maintenance analyzer)
      const limitedAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
        testCoverage: { percentage: 100, uncoveredFiles: [] }, // Perfect coverage
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: [
            {
              name: 'vulnerable-package',
              cveId: 'CVE-2023-00001',
              severity: 'critical',
              affectedVersions: '<2.0.0',
              description: 'Critical security vulnerability requiring immediate attention'
            }
          ]
        },
        codeQuality: {
          lintIssues: 0, // Perfect code quality
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 100, // Perfect documentation
          missingDocs: [],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { documented: 100, undocumented: 0 }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(limitedAnalysis);

      // Should still produce a task from the maintenance analyzer
      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.title).toContain('Critical');
    });

    it('should demonstrate weighted strategy selection across analyzers', () => {
      const analysis = createFullAnalysisData();

      // Test with maintenance-heavy weights
      const maintenanceGenerator = new IdleTaskGenerator({
        maintenance: 0.8,
        refactoring: 0.1,
        docs: 0.05,
        tests: 0.05
      });

      const maintenanceTasks: string[] = [];
      for (let i = 0; i < 20; i++) {
        const task = maintenanceGenerator.generateTask(analysis);
        if (task) {
          maintenanceTasks.push(task.type);
        }
        maintenanceGenerator.reset();
      }

      // Should generate predominantly maintenance tasks
      const maintenanceCount = maintenanceTasks.filter(t => t === 'maintenance').length;
      const totalTasks = maintenanceTasks.length;

      expect(totalTasks).toBeGreaterThan(10);
      expect(maintenanceCount / totalTasks).toBeGreaterThan(0.5); // Should favor maintenance
    });
  });

  describe('AC2: Enhanced detection produces actionable tasks', () => {
    it('should create actionable tasks with enhanced duplicate code analysis', () => {
      const duplicateAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        testCoverage: { percentage: 80, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: 'export function processUser(user: User) { validateUser(user); saveUser(user); return user; }',
              locations: ['src/user-service.ts', 'src/admin-service.ts', 'src/auth-service.ts'],
              similarity: 0.96
            }
          ],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: createBasicDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(duplicateAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');
      expect(task?.title).toBe('Eliminate Duplicated Code');
      expect(task?.description).toContain('96% average similarity');
      expect(task?.description).toContain('3 locations');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.rationale).toContain('High-similarity patterns');

      // Should be actionable
      expect(task?.suggestedWorkflow).toBeTruthy();
      expect(task?.estimatedEffort).toBeOneOf(['low', 'medium', 'high']);
    });

    it('should create actionable tasks with enhanced security vulnerability analysis', () => {
      const securityAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 15000, languages: { ts: 100 } },
        testCoverage: { percentage: 70, uncoveredFiles: [] },
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: [
            {
              name: 'critical-lib',
              cveId: 'CVE-2023-12345',
              severity: 'critical',
              affectedVersions: '<3.0.0',
              description: 'Remote code execution vulnerability in critical library'
            },
            {
              name: 'high-risk-pkg',
              cveId: 'CVE-2023-54321',
              severity: 'high',
              affectedVersions: '<2.5.0',
              description: 'Data exposure vulnerability requiring update'
            }
          ]
        },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: createBasicDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(securityAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.title).toContain('Critical');
      expect(task?.description).toContain('CVE-2023-12345');
      expect(task?.description).toContain('Remote code execution');

      // Should be highly actionable with specific guidance
      expect(task?.suggestedWorkflow).toBe('maintenance');
      expect(task?.rationale).toContain('Security');
    });

    it('should create actionable tasks with enhanced complexity analysis', () => {
      const complexityAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 75, lines: 10000, languages: { ts: 75 } },
        testCoverage: { percentage: 65, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'src/business-logic-processor.ts',
              cyclomaticComplexity: 52,
              cognitiveComplexity: 68,
              lineCount: 800
            }
          ],
          codeSmells: [
            {
              type: 'feature-envy',
              file: 'src/data-processor.ts',
              line: 35,
              severity: 'high',
              details: 'getProcessingRules method accesses ConfigurationManager 12 times vs DataProcessor 3 times'
            }
          ]
        },
        documentation: createBasicDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(complexityAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');

      if (task?.title.includes('Refactor')) {
        // Complexity-based refactoring task
        expect(task.title).toContain('business-logic-processor.ts');
        expect(task.description).toContain('Cyclomatic Complexity: 52');
        expect(task.description).toContain('Cognitive Complexity: 68');
        expect(task.priority).toBe('low'); // All idle tasks have low priority
      } else {
        // Feature envy task
        expect(task.title).toContain('Feature Envy');
        expect(task.priority).toBe('low'); // All idle tasks have low priority
        expect(task.rationale).toContain('Move methods closer to the data they use');
      }
    });
  });

  describe('AC3: Backward compatibility maintained', () => {
    it('should handle legacy string-based analysis without errors', () => {
      const legacyAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 25, lines: 2500, languages: { js: 25 } },
        testCoverage: { percentage: 30, uncoveredFiles: ['test1.js', 'test2.js'] },
        dependencies: {
          // Legacy format
          outdated: ['old-package@^1.0.0', 'legacy-dep@^0.8.0'],
          security: ['vuln-package@1.2.3', 'old-lib@0.5.0']
        },
        codeQuality: {
          lintIssues: 50,
          duplicatedCode: ['src/legacy1.js', 'src/legacy2.js'] as any, // Legacy string format
          complexityHotspots: ['src/complex.js', 'src/massive.js'] as any, // Legacy string format
          codeSmells: []
        },
        documentation: {
          coverage: 20,
          missingDocs: ['src/api.js', 'src/utils.js'],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { documented: 20, undocumented: 80 }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      // Both enhanced and regular generators should handle this
      const enhancedTask = enhancedGenerator.generateTask(legacyAnalysis);
      const regularTask = generator.generateTask(legacyAnalysis);

      expect(enhancedTask).not.toBeNull();
      expect(regularTask).not.toBeNull();

      // Both should produce valid task structure
      expect(enhancedTask?.id).toBeTruthy();
      expect(regularTask?.id).toBeTruthy();

      // Enhanced generator should convert and handle legacy formats gracefully
      expect(typeof enhancedTask?.title).toBe('string');
      expect(typeof regularTask?.title).toBe('string');
    });

    it('should produce similar results for basic analysis between enhanced and regular', () => {
      const basicAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 15, lines: 1500, languages: { ts: 15 } },
        testCoverage: { percentage: 85, uncoveredFiles: [] },
        dependencies: {
          outdated: ['minor-update@^2.0.0'],
          security: []
        },
        codeQuality: {
          lintIssues: 3,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 90,
          missingDocs: ['src/helper.ts'],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { documented: 90, undocumented: 10 }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const enhancedTask = enhancedGenerator.generateTask(basicAnalysis);
      const regularTask = generator.generateTask(basicAnalysis);

      // Both should generate tasks or both should be null
      expect(typeof enhancedTask).toBe(typeof regularTask);

      if (enhancedTask && regularTask) {
        // Should generate similar categories for basic analysis
        expect(enhancedTask.type).toBeOneOf(['maintenance', 'documentation']);
        expect(regularTask.type).toBeOneOf(['maintenance', 'documentation']);

        // Task quality should be similar
        expect(enhancedTask.title).toBeTruthy();
        expect(regularTask.title).toBeTruthy();
      }
    });
  });

  describe('AC4: Performance acceptable with enhanced analysis', () => {
    it('should maintain performance under 200ms for standard analysis', () => {
      const standardAnalysis = createStandardAnalysisData();

      const startTime = Date.now();
      const task = enhancedGenerator.generateTask(standardAnalysis);
      const endTime = Date.now();

      expect(task).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle rapid task generation efficiently', () => {
      const analysis = createStandardAnalysisData();

      const startTime = Date.now();

      const tasks: (IdleTask | null)[] = [];
      for (let i = 0; i < 30; i++) {
        const task = enhancedGenerator.generateTask(analysis);
        tasks.push(task);

        if (i % 8 === 0) {
          enhancedGenerator.reset();
        }
      }

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(600); // 30 generations in under 600ms

      const validTasks = tasks.filter(t => t !== null);
      expect(validTasks.length).toBeGreaterThan(10);
    });

    it('should scale with large-scale project analysis', () => {
      const largeAnalysis = createLargeScaleAnalysisData();

      const startTime = Date.now();
      const task = enhancedGenerator.generateTask(largeAnalysis);
      const endTime = Date.now();

      expect(task).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(1000); // Even large projects under 1s
    });

    it('should demonstrate enhanced capabilities are properly configured', () => {
      const capabilities = enhancedGenerator.getEnhancedCapabilities();

      expect(capabilities.enabled).toBe(true);
      expect(capabilities.projectPath).toBe(testProjectPath);
      expect(capabilities.availableAnalyzers).toEqual(
        expect.arrayContaining(['maintenance', 'refactoring', 'docs', 'tests'])
      );

      // Regular generator should not have enhanced capabilities
      const regularCapabilities = generator.getEnhancedCapabilities();
      expect(regularCapabilities.enabled).toBe(false);
      expect(regularCapabilities.projectPath).toBeUndefined();
    });
  });

  describe('Enhanced Analyzer Integration Validation', () => {
    it('should successfully work with CrossReferenceValidator', async () => {
      const validator = new CrossReferenceValidator();
      const symbolIndex = await validator.buildIndex(testProjectPath);

      expect(symbolIndex.stats.totalFiles).toBeGreaterThan(0);
      expect(symbolIndex.stats.totalSymbols).toBeGreaterThan(0);

      // Test validation of references
      const validRef = validator.validateReference(symbolIndex, 'TestClass');
      const invalidRef = validator.validateReference(symbolIndex, 'NonExistentClass');

      expect(validRef).toBe(true);
      expect(invalidRef).toBe(false);
    });

    it('should successfully work with VersionMismatchDetector', async () => {
      const detector = new VersionMismatchDetector(testProjectPath);
      const mismatches = await detector.detectMismatches();

      expect(Array.isArray(mismatches)).toBe(true);

      if (mismatches.length > 0) {
        expect(mismatches[0]).toHaveProperty('file');
        expect(mismatches[0]).toHaveProperty('foundVersion');
        expect(mismatches[0]).toHaveProperty('expectedVersion');

        const task = detector.createVersionMismatchTask(mismatches);
        expect(task).not.toBeNull();
        expect(task?.title).toContain('Version');
      }
    });
  });
});

// Helper functions for creating test data

function createBasicDocAnalysis() {
  return {
    coverage: 60,
    missingDocs: [],
    outdatedDocs: [],
    undocumentedExports: [],
    missingReadmeSections: [],
    apiCompleteness: { documented: 60, undocumented: 40 }
  };
}

function createFullAnalysisData(): ProjectAnalysis {
  return {
    codebaseSize: { files: 200, lines: 30000, languages: { ts: 160, js: 40 } },
    testCoverage: { percentage: 60, uncoveredFiles: ['src/new-feature.ts', 'src/beta.ts'] },
    dependencies: {
      outdated: ['update-me@^2.0.0'],
      security: ['vulnerable-old@1.0.0'],
      securityIssues: [
        {
          name: 'security-lib',
          cveId: 'CVE-2023-99998',
          severity: 'high',
          affectedVersions: '<4.0.0',
          description: 'High severity security issue requiring attention'
        }
      ],
      outdatedPackages: [
        {
          name: 'major-upgrade',
          currentVersion: '3.2.0',
          latestVersion: '4.0.0',
          updateType: 'major'
        }
      ]
    },
    codeQuality: {
      lintIssues: 30,
      duplicatedCode: [
        {
          pattern: 'function validate(input) { if (!input) throw new Error(); return true; }',
          locations: ['src/validation.ts', 'src/auth.ts'],
          similarity: 0.88
        }
      ],
      complexityHotspots: [
        {
          file: 'src/complex-algorithm.ts',
          cyclomaticComplexity: 32,
          cognitiveComplexity: 38,
          lineCount: 500
        }
      ],
      codeSmells: [
        {
          type: 'feature-envy',
          file: 'src/service.ts',
          line: 20,
          severity: 'medium',
          details: 'Method accesses external data more than own data'
        }
      ]
    },
    documentation: {
      coverage: 55,
      missingDocs: ['src/new-api.ts'],
      outdatedDocs: [
        {
          file: 'README.md',
          type: 'outdated-example',
          description: 'Example uses deprecated API',
          line: 35,
          suggestion: 'Update to new API syntax',
          severity: 'medium'
        }
      ],
      undocumentedExports: [
        {
          name: 'helperFunction',
          file: 'src/utils.ts',
          line: 10,
          type: 'function'
        }
      ],
      missingReadmeSections: [],
      apiCompleteness: { documented: 55, undocumented: 45 }
    },
    performance: {
      bundleSize: 1500000,
      slowTests: ['test/slow-integration.test.ts'],
      bottlenecks: ['src/expensive-operation.ts']
    }
  };
}

function createStandardAnalysisData(): ProjectAnalysis {
  return {
    codebaseSize: { files: 80, lines: 8000, languages: { ts: 70, js: 10 } },
    testCoverage: { percentage: 75, uncoveredFiles: ['src/util.ts'] },
    dependencies: {
      outdated: ['minor-update@^1.5.0'],
      security: []
    },
    codeQuality: {
      lintIssues: 10,
      duplicatedCode: [],
      complexityHotspots: [
        {
          file: 'src/processor.ts',
          cyclomaticComplexity: 18,
          cognitiveComplexity: 22,
          lineCount: 250
        }
      ],
      codeSmells: []
    },
    documentation: {
      coverage: 70,
      missingDocs: ['src/api-helpers.ts'],
      outdatedDocs: [],
      undocumentedExports: [],
      missingReadmeSections: [],
      apiCompleteness: { documented: 70, undocumented: 30 }
    },
    performance: { slowTests: [], bottlenecks: [] }
  };
}

function createLargeScaleAnalysisData(): ProjectAnalysis {
  return {
    codebaseSize: { files: 800, lines: 120000, languages: { ts: 600, js: 200 } },
    testCoverage: {
      percentage: 40,
      uncoveredFiles: Array.from({ length: 300 }, (_, i) => `src/uncovered${i}.ts`)
    },
    dependencies: {
      outdated: Array.from({ length: 40 }, (_, i) => `dep${i}@^1.0.0`),
      security: Array.from({ length: 8 }, (_, i) => `vuln${i}@1.0.0`),
      securityIssues: Array.from({ length: 20 }, (_, i) => ({
        name: `package${i}`,
        cveId: `CVE-2023-${String(i).padStart(5, '0')}`,
        severity: i < 5 ? 'critical' : i < 12 ? 'high' : 'medium' as any,
        affectedVersions: '<2.0.0',
        description: `Security vulnerability ${i}`
      }))
    },
    codeQuality: {
      lintIssues: 400,
      duplicatedCode: Array.from({ length: 30 }, (_, i) => ({
        pattern: `function helper${i}() { /* common logic */ }`,
        locations: [`src/file${i}a.ts`, `src/file${i}b.ts`],
        similarity: 0.75 + Math.random() * 0.2
      })),
      complexityHotspots: Array.from({ length: 35 }, (_, i) => ({
        file: `src/complex${i}.ts`,
        cyclomaticComplexity: 15 + Math.floor(Math.random() * 40),
        cognitiveComplexity: 20 + Math.floor(Math.random() * 50),
        lineCount: 200 + Math.floor(Math.random() * 600)
      })),
      codeSmells: Array.from({ length: 50 }, (_, i) => ({
        type: ['feature-envy', 'long-method', 'data-clumps'][i % 3],
        file: `src/smell${i}.ts`,
        line: 10 + i,
        severity: ['low', 'medium', 'high'][i % 3] as any,
        details: `Code smell ${i} requiring attention`
      }))
    },
    documentation: {
      coverage: 25,
      missingDocs: Array.from({ length: 200 }, (_, i) => `src/undoc${i}.ts`),
      outdatedDocs: Array.from({ length: 15 }, (_, i) => ({
        file: `docs/old${i}.md`,
        type: 'outdated-example' as any,
        description: `Outdated documentation ${i}`,
        line: 8,
        suggestion: 'Update examples and references',
        severity: 'medium' as any
      })),
      undocumentedExports: [],
      missingReadmeSections: [],
      apiCompleteness: { documented: 25, undocumented: 75 }
    },
    performance: {
      bundleSize: 8000000,
      slowTests: Array.from({ length: 20 }, (_, i) => `test/slow${i}.test.ts`),
      bottlenecks: Array.from({ length: 12 }, (_, i) => `src/bottleneck${i}.ts`)
    }
  };
}

async function setupAcceptanceTestProject(): Promise<void> {
  const projectPath = path.join(__dirname, 'test-project-acceptance');

  try {
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'docs'), { recursive: true });

    // Create package.json
    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify({
        name: 'acceptance-test-project',
        version: '3.1.0',
        dependencies: {
          'test-lib': '^2.0.0'
        }
      }, null, 2)
    );

    // Create test source files
    await fs.writeFile(
      path.join(projectPath, 'src', 'main.ts'),
      `
export class TestClass {
  public process(data: any): any {
    return this.transform(data);
  }

  private transform(data: any): any {
    return data;
  }
}

export function validateInput(input: any): boolean {
  return input != null && typeof input === 'object';
}

export interface TestInterface {
  id: string;
  value: number;
}
`
    );

    // Create README with version mismatch
    await fs.writeFile(
      path.join(projectPath, 'README.md'),
      `
# Acceptance Test Project

Version: 2.8.0

This project demonstrates enhanced analyzer capabilities.

## API Reference

- \`TestClass\` - main processing class
- \`validateInput()\` - input validation function
- \`MissingFunction()\` - this doesn't exist in code

See TestClass for more details.
`
    );

    console.log('Acceptance test project setup completed');
  } catch (error) {
    console.warn('Acceptance test project setup warning:', error);
  }
}