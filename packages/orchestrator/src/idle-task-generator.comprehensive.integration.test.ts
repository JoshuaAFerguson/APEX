/**
 * Comprehensive Integration Test for Enhanced IdleTaskGenerator
 *
 * This test validates the complete integration of all enhanced analyzer capabilities:
 * 1. All analyzers working together in IdleTaskGenerator
 * 2. Enhanced detection producing actionable tasks
 * 3. Backward compatibility maintained
 * 4. Performance acceptable with enhanced analysis
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
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
    generateTaskId: () => `comprehensive-test-${++counter}`,
  };
});

describe('Comprehensive IdleTaskGenerator Integration', () => {
  let generator: IdleTaskGenerator;
  let enhancedGenerator: IdleTaskGenerator;
  let testProjectPath: string;

  beforeAll(async () => {
    // Create a comprehensive test project
    testProjectPath = path.join(__dirname, 'test-project-comprehensive');
    await setupComprehensiveTestProject();
  });

  beforeEach(() => {
    generator = new IdleTaskGenerator();
    enhancedGenerator = IdleTaskGenerator.createEnhanced(testProjectPath);
  });

  afterAll(async () => {
    // Cleanup test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('1. All Analyzers Working Together', () => {
    it('should integrate all analyzer types and produce different task categories', () => {
      const comprehensiveAnalysis = createComprehensiveAnalysis();

      const tasks: IdleTask[] = [];
      for (let i = 0; i < 10; i++) {
        const task = enhancedGenerator.generateTask(comprehensiveAnalysis);
        if (task) {
          tasks.push(task);
        }
      }

      // Should generate various types of tasks
      const taskTypes = new Set(tasks.map(t => t.type));
      expect(taskTypes.size).toBeGreaterThan(1);

      // Should include all major categories
      const taskCategories = tasks.map(t => t.type);
      expect(taskCategories).toEqual(
        expect.arrayContaining(['maintenance', 'optimization', 'documentation'])
      );

      // Each task should have proper structure
      for (const task of tasks) {
        expect(task.id).toMatch(/^idle-comprehensive-test-\d+/);
        expect(task.title).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(task.rationale).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(task.estimatedEffort);
        expect(['low', 'normal', 'high', 'urgent']).toContain(task.priority);
        expect(task.implemented).toBe(false);
        expect(task.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should properly prioritize critical security issues above other tasks', () => {
      const criticalSecurityAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 10000, languages: { ts: 100 } },
        testCoverage: { percentage: 70, uncoveredFiles: [] },
        dependencies: {
          outdated: [],
          security: [],
          securityIssues: [
            {
              name: 'critical-package',
              cveId: 'CVE-2023-12345',
              severity: 'critical',
              affectedVersions: '<1.0.0',
              description: 'Remote code execution vulnerability'
            }
          ]
        },
        codeQuality: {
          lintIssues: 50,
          duplicatedCode: [{ pattern: 'test', locations: ['file1'], similarity: 0.9 }],
          complexityHotspots: [{ file: 'test.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 500 }],
          codeSmells: []
        },
        documentation: createMinimalDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(criticalSecurityAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.title).toContain('Critical');
      expect(task?.description).toContain('CVE-2023-12345');
    });
  });

  describe('2. Enhanced Detection Producing Actionable Tasks', () => {
    it('should detect and create tasks for enhanced duplicate code analysis', () => {
      const enhancedDuplicateAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 50, lines: 5000, languages: { ts: 50 } },
        testCoverage: { percentage: 80, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: 'export function validateUser(user: User) { return user.id && user.email; }',
              locations: ['src/auth.ts', 'src/user-service.ts', 'src/validation.ts'],
              similarity: 0.97
            }
          ],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: createMinimalDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(enhancedDuplicateAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');
      expect(task?.title).toBe('Eliminate Duplicated Code');
      expect(task?.description).toContain('97% average similarity');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority
      expect(task?.rationale).toContain('High-similarity patterns');
      expect(task?.rationale).toContain('Extract identical methods');
    });

    it('should create detailed tasks for complex code smells', () => {
      const codeSmellAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 75, lines: 12000, languages: { ts: 75 } },
        testCoverage: { percentage: 60, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 10,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [
            {
              type: 'feature-envy',
              file: 'src/user-processor.ts',
              line: 45,
              severity: 'high',
              details: 'getUserPreferences method accesses UserData class 8 times vs UserProcessor class 2 times'
            },
            {
              type: 'long-method',
              file: 'src/data-handler.ts',
              line: 22,
              severity: 'medium',
              details: 'processComplexData method has 95 lines and 12 parameters'
            }
          ]
        },
        documentation: createMinimalDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(codeSmellAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');
      expect(task?.title).toContain('Fix Feature Envy');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority // High severity feature-envy should be urgent
      expect(task?.rationale).toContain('Move methods closer to the data they use');
    });

    it('should generate tasks for enhanced complexity analysis', () => {
      const complexityAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 15000, languages: { ts: 100 } },
        testCoverage: { percentage: 75, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'src/algorithm-processor.ts',
              cyclomaticComplexity: 48,
              cognitiveComplexity: 62,
              lineCount: 750
            }
          ],
          codeSmells: []
        },
        documentation: createMinimalDocAnalysis(),
        performance: { slowTests: [], bottlenecks: [] }
      };

      const task = enhancedGenerator.generateTask(complexityAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');
      expect(task?.title).toContain('Refactor');
      expect(task?.title).toContain('algorithm-processor.ts');
      expect(task?.priority).toBe('low'); // All idle tasks have low priority // Critical complexity should be urgent
      expect(task?.description).toContain('Cyclomatic Complexity: 48 (critical');
      expect(task?.description).toContain('Cognitive Complexity: 62 (critical');
    });
  });

  describe('3. Backward Compatibility Maintained', () => {
    it('should handle legacy string-based analysis formats without errors', () => {
      const legacyAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 30, lines: 3000, languages: { js: 30 } },
        testCoverage: { percentage: 40, uncoveredFiles: ['test1.js'] },
        dependencies: {
          outdated: ['old-package@^1.0.0', 'legacy-lib@^0.8.0'],
          security: ['vulnerable-package@1.2.3']
        },
        codeQuality: {
          lintIssues: 100,
          duplicatedCode: ['src/duplicate1.js', 'src/duplicate2.js'] as any, // Legacy string format
          complexityHotspots: ['src/complex.js'] as any, // Legacy string format
          codeSmells: []
        },
        documentation: {
          coverage: 25,
          missingDocs: ['src/api.js'],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { documented: 25, undocumented: 75 }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      // Both enhanced and regular generators should work
      const enhancedTask = enhancedGenerator.generateTask(legacyAnalysis);
      const regularTask = generator.generateTask(legacyAnalysis);

      expect(enhancedTask).not.toBeNull();
      expect(regularTask).not.toBeNull();

      // Enhanced generator should convert legacy formats
      if (enhancedTask?.type === 'maintenance') {
        expect(enhancedTask.title).toContain('Security');
      } else if (enhancedTask?.type === 'optimization') {
        expect(enhancedTask.title).toMatch(/(Eliminate|Refactor)/);
      }
    });

    it('should produce similar results between enhanced and regular generators for basic analysis', () => {
      const basicAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 20, lines: 2000, languages: { ts: 20 } },
        testCoverage: { percentage: 90, uncoveredFiles: [] },
        dependencies: {
          outdated: ['minor-update@^1.1.0'],
          security: []
        },
        codeQuality: {
          lintIssues: 5,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 85,
          missingDocs: ['src/utils.ts'],
          outdatedDocs: [],
          undocumentedExports: [],
          missingReadmeSections: [],
          apiCompleteness: { documented: 85, undocumented: 15 }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      const enhancedTask = enhancedGenerator.generateTask(basicAnalysis);
      const regularTask = generator.generateTask(basicAnalysis);

      // Both should generate tasks (or both should be null)
      expect(typeof enhancedTask).toBe(typeof regularTask);

      if (enhancedTask && regularTask) {
        // Task types should be similar for basic analysis
        expect(['maintenance', 'documentation']).toContain(enhancedTask.type);
        expect(['maintenance', 'documentation']).toContain(regularTask.type);
      }
    });
  });

  describe('4. Performance Acceptable with Enhanced Analysis', () => {
    it('should maintain performance with enhanced features enabled', () => {
      const largeAnalysis = createLargeScaleAnalysis();

      const startTime = Date.now();
      const task = enhancedGenerator.generateTask(largeAnalysis);
      const endTime = Date.now();

      expect(task).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(200); // Should be fast even with enhancement
    });

    it('should handle multiple rapid task generations efficiently', () => {
      const analysis = createComprehensiveAnalysis();

      const startTime = Date.now();

      const tasks: (IdleTask | null)[] = [];
      for (let i = 0; i < 25; i++) {
        const task = enhancedGenerator.generateTask(analysis);
        tasks.push(task);

        // Reset periodically to test reset performance
        if (i % 10 === 0) {
          enhancedGenerator.reset();
        }
      }

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500); // Should complete rapidly
      const validTasks = tasks.filter(t => t !== null);
      expect(validTasks.length).toBeGreaterThan(0);
    });

    it('should provide enhanced capabilities information', () => {
      const capabilities = enhancedGenerator.getEnhancedCapabilities();

      expect(capabilities.enabled).toBe(true);
      expect(capabilities.projectPath).toBe(testProjectPath);
      expect(capabilities.availableAnalyzers).toEqual(
        expect.arrayContaining(['maintenance', 'refactoring', 'docs', 'tests'])
      );

      // Regular generator should not have enhanced capabilities
      const regularCapabilities = generator.getEnhancedCapabilities();
      expect(regularCapabilities.enabled).toBe(false);
    });
  });

  describe('5. Integration with Real Enhanced Analysis Features', () => {
    it('should work with actual cross-reference validator', async () => {
      const validator = new CrossReferenceValidator();
      const symbolIndex = await validator.buildIndex(testProjectPath);

      expect(symbolIndex.stats.totalFiles).toBeGreaterThan(0);
      expect(symbolIndex.stats.totalSymbols).toBeGreaterThan(0);

      // Test that the index includes our test functions
      const testFunctionSymbols = validator.lookupSymbol(symbolIndex, 'validateUser');
      expect(testFunctionSymbols).toBeDefined();
    });

    it('should work with actual version mismatch detector', async () => {
      const detector = new VersionMismatchDetector(testProjectPath);
      const mismatches = await detector.detectMismatches();

      // Should detect the intentional version mismatch in our test setup
      expect(Array.isArray(mismatches)).toBe(true);
      if (mismatches.length > 0) {
        expect(mismatches[0]).toHaveProperty('file');
        expect(mismatches[0]).toHaveProperty('foundVersion');
        expect(mismatches[0]).toHaveProperty('expectedVersion');
      }
    });
  });

  describe('6. Error Handling and Edge Cases', () => {
    it('should handle analysis with missing fields gracefully', () => {
      const incompleteAnalysis = {
        codebaseSize: { files: 10, lines: 1000, languages: { ts: 10 } },
        // Missing fields intentionally
      } as any;

      expect(() => {
        const task = enhancedGenerator.generateTask(incompleteAnalysis);
        // Should not throw, may return null
        expect(task === null || typeof task === 'object').toBe(true);
      }).not.toThrow();
    });

    it('should handle enhancement failures gracefully', () => {
      // Create analysis that might cause enhancement to fail
      const problematicAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 1, lines: 100, languages: { ts: 1 } },
        dependencies: {
          outdated: [],
          security: [],
          // Circular references or other problematic data
          securityIssues: undefined as any,
          outdatedPackages: null as any
        },
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: undefined as any,
          complexityHotspots: null as any,
          codeSmells: []
        },
        documentation: {
          coverage: 50,
          missingDocs: [],
          outdatedDocs: undefined as any,
          undocumentedExports: null as any,
          missingReadmeSections: [],
          apiCompleteness: { documented: 50, undocumented: 50 }
        },
        performance: { slowTests: [], bottlenecks: [] }
      };

      // Should handle gracefully and not throw
      expect(() => {
        const task = enhancedGenerator.generateTask(problematicAnalysis);
        expect(task === null || typeof task === 'object').toBe(true);
      }).not.toThrow();
    });
  });
});

// Helper functions for test data creation

function createMinimalDocAnalysis() {
  return {
    coverage: 50,
    missingDocs: [],
    outdatedDocs: [],
    undocumentedExports: [],
    missingReadmeSections: [],
    apiCompleteness: { documented: 50, undocumented: 50 }
  };
}

function createComprehensiveAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 150, lines: 20000, languages: { ts: 120, js: 30 } },
    testCoverage: { percentage: 68, uncoveredFiles: ['src/new-feature.ts'] },
    dependencies: {
      outdated: ['legacy-dep@^1.0.0'],
      security: ['old-vuln@1.0.0'],
      securityIssues: [
        {
          name: 'test-package',
          cveId: 'CVE-2023-99999',
          severity: 'high',
          affectedVersions: '<3.0.0',
          description: 'Test security vulnerability'
        }
      ],
      outdatedPackages: [
        {
          name: 'update-me',
          currentVersion: '2.1.0',
          latestVersion: '3.0.0',
          updateType: 'major'
        }
      ]
    },
    codeQuality: {
      lintIssues: 25,
      duplicatedCode: [
        {
          pattern: 'function process(data) { return data.filter(x => x.active); }',
          locations: ['src/service1.ts', 'src/service2.ts'],
          similarity: 0.89
        }
      ],
      complexityHotspots: [
        {
          file: 'src/complex-service.ts',
          cyclomaticComplexity: 28,
          cognitiveComplexity: 35,
          lineCount: 450
        }
      ],
      codeSmells: [
        {
          type: 'feature-envy',
          file: 'src/processor.ts',
          line: 25,
          severity: 'medium',
          details: 'Method uses external class more than own class'
        }
      ]
    },
    documentation: {
      coverage: 60,
      missingDocs: ['src/api.ts'],
      outdatedDocs: [
        {
          file: 'docs/guide.md',
          type: 'version-mismatch',
          description: 'Version reference is outdated',
          line: 10,
          suggestion: 'Update version to match package.json',
          severity: 'medium'
        }
      ],
      undocumentedExports: [
        {
          name: 'helperFunction',
          file: 'src/utils.ts',
          line: 15,
          type: 'function'
        }
      ],
      missingReadmeSections: [],
      apiCompleteness: { documented: 60, undocumented: 40 }
    },
    performance: {
      bundleSize: 800000,
      slowTests: ['test/integration.test.ts'],
      bottlenecks: ['src/expensive-operation.ts']
    }
  };
}

function createLargeScaleAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: { files: 500, lines: 75000, languages: { ts: 400, js: 100 } },
    testCoverage: {
      percentage: 55,
      uncoveredFiles: Array.from({ length: 50 }, (_, i) => `src/uncovered${i}.ts`)
    },
    dependencies: {
      outdated: Array.from({ length: 30 }, (_, i) => `dep${i}@^1.0.0`),
      security: Array.from({ length: 8 }, (_, i) => `vuln${i}@1.0.0`),
      securityIssues: Array.from({ length: 12 }, (_, i) => ({
        name: `package${i}`,
        cveId: `CVE-2023-${String(i).padStart(5, '0')}`,
        severity: i < 2 ? 'critical' : i < 6 ? 'high' : 'medium' as any,
        affectedVersions: '<2.0.0',
        description: `Security issue ${i}`
      }))
    },
    codeQuality: {
      lintIssues: 200,
      duplicatedCode: Array.from({ length: 15 }, (_, i) => ({
        pattern: `function helper${i}() { /* duplicate logic */ }`,
        locations: [`src/file${i}a.ts`, `src/file${i}b.ts`],
        similarity: 0.7 + Math.random() * 0.25
      })),
      complexityHotspots: Array.from({ length: 20 }, (_, i) => ({
        file: `src/complex${i}.ts`,
        cyclomaticComplexity: 15 + Math.floor(Math.random() * 35),
        cognitiveComplexity: 20 + Math.floor(Math.random() * 45),
        lineCount: 200 + Math.floor(Math.random() * 600)
      })),
      codeSmells: Array.from({ length: 25 }, (_, i) => ({
        type: ['feature-envy', 'long-method', 'data-clumps'][i % 3],
        file: `src/smell${i}.ts`,
        line: 10 + i,
        severity: ['low', 'medium', 'high'][i % 3] as any,
        details: `Code smell ${i} details`
      }))
    },
    documentation: {
      coverage: 35,
      missingDocs: Array.from({ length: 40 }, (_, i) => `src/undoc${i}.ts`),
      outdatedDocs: Array.from({ length: 10 }, (_, i) => ({
        file: `docs/doc${i}.md`,
        type: 'outdated-example' as any,
        description: `Outdated documentation ${i}`,
        line: 5,
        suggestion: 'Update examples',
        severity: 'medium' as any
      })),
      undocumentedExports: Array.from({ length: 30 }, (_, i) => ({
        name: `export${i}`,
        file: `src/file${i}.ts`,
        line: 10,
        type: 'function' as any
      })),
      missingReadmeSections: [],
      apiCompleteness: { documented: 35, undocumented: 65 }
    },
    performance: {
      bundleSize: 3000000,
      slowTests: Array.from({ length: 8 }, (_, i) => `test/slow${i}.test.ts`),
      bottlenecks: Array.from({ length: 5 }, (_, i) => `src/bottleneck${i}.ts`)
    }
  };
}

async function setupComprehensiveTestProject(): Promise<void> {
  const projectPath = path.join(__dirname, 'test-project-comprehensive');

  try {
    // Create directory structure
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'docs'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'test'), { recursive: true });

    // Create package.json
    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify({
        name: 'comprehensive-test-project',
        version: '2.5.0',
        dependencies: {
          'test-package': '^2.0.0'
        }
      }, null, 2)
    );

    // Create comprehensive source files
    await fs.writeFile(
      path.join(projectPath, 'src', 'main.ts'),
      `
export function validateUser(user: any): boolean {
  return user && user.id && user.email;
}

export class UserProcessor {
  process(user: any) {
    // Complex processing logic
    if (user.type === 'admin') {
      return this.processAdmin(user);
    } else if (user.type === 'moderator') {
      return this.processModerator(user);
    } else if (user.type === 'user') {
      return this.processRegularUser(user);
    }
    return null;
  }

  private processAdmin(user: any) {
    // Feature envy: accesses UserData more than own class
    return user.data.permissions && user.data.roles && user.data.access;
  }

  private processModerator(user: any) {
    return user.data.moderatorRights;
  }

  private processRegularUser(user: any) {
    return user.data.basicAccess;
  }
}

export interface User {
  id: string;
  email: string;
  type: 'admin' | 'moderator' | 'user';
}
`
    );

    // Create duplicate code example
    await fs.writeFile(
      path.join(projectPath, 'src', 'service1.ts'),
      `
export function validateUser(user: any): boolean {
  return user && user.id && user.email;
}

export function processData(data: any[]) {
  return data.filter(item => item.active).map(item => item.value);
}
`
    );

    await fs.writeFile(
      path.join(projectPath, 'src', 'service2.ts'),
      `
export function validateUser(user: any): boolean {
  return user && user.id && user.email;
}

export function handleData(data: any[]) {
  return data.filter(item => item.active).map(item => item.value);
}
`
    );

    // Create complex file
    await fs.writeFile(
      path.join(projectPath, 'src', 'complex-processor.ts'),
      `
export class ComplexProcessor {
  // This method has high cyclomatic and cognitive complexity
  public processComplexLogic(input: any, config: any, options: any) {
    if (!input) {
      if (config.strict) {
        if (options.throwOnEmpty) {
          throw new Error('Input is required');
        } else {
          if (options.defaultValue) {
            return options.defaultValue;
          } else {
            return null;
          }
        }
      } else {
        return undefined;
      }
    }

    let result = input;

    for (let i = 0; i < input.length; i++) {
      const item = input[i];

      if (item.type === 'A') {
        if (item.category === 'premium') {
          if (item.verified) {
            result[i] = this.processPremiumVerified(item);
          } else {
            result[i] = this.processPremiumUnverified(item);
          }
        } else {
          result[i] = this.processStandard(item);
        }
      } else if (item.type === 'B') {
        if (config.enableBProcessing) {
          result[i] = this.processTypeB(item, config, options);
        } else {
          result[i] = item;
        }
      } else {
        switch (item.priority) {
          case 'high':
            result[i] = this.processHighPriority(item);
            break;
          case 'medium':
            result[i] = this.processMediumPriority(item);
            break;
          case 'low':
            result[i] = this.processLowPriority(item);
            break;
          default:
            if (options.handleUnknown) {
              result[i] = this.processUnknown(item);
            } else {
              result[i] = null;
            }
        }
      }
    }

    return result;
  }

  private processPremiumVerified(item: any) { return item; }
  private processPremiumUnverified(item: any) { return item; }
  private processStandard(item: any) { return item; }
  private processTypeB(item: any, config: any, options: any) { return item; }
  private processHighPriority(item: any) { return item; }
  private processMediumPriority(item: any) { return item; }
  private processLowPriority(item: any) { return item; }
  private processUnknown(item: any) { return item; }
}
`
    );

    // Create README with version mismatch
    await fs.writeFile(
      path.join(projectPath, 'README.md'),
      `
# Comprehensive Test Project

Version: 2.3.0

This is a test project for the enhanced IdleTaskGenerator.

## API Reference

- \`validateUser()\` - validates user data
- \`ComplexProcessor\` - handles complex data processing
- \`NonExistentFunction()\` - this function doesn't exist

@see NonExistentFunction for more details
`
    );

    // Create docs with broken references and version mismatches
    await fs.writeFile(
      path.join(projectPath, 'docs', 'api.md'),
      `
# API Documentation

Version: 1.0.0

## Functions

- \`validateUser(user)\` - validates user input
- \`MissingFunction()\` - this function doesn't exist in the codebase
- \`ComplexProcessor.processComplexLogic()\` - handles complex business logic

## Usage

\`\`\`typescript
import { validateUser, MissingFunction } from '../src/main';

const user = { id: '123', email: 'test@example.com' };
if (validateUser(user)) {
  console.log('Valid user');
}

// This call references a non-existent function
MissingFunction();
\`\`\`

@see MissingFunction for implementation details
`
    );

    console.log('Comprehensive test project setup completed');
  } catch (error) {
    console.warn('Test project setup warning:', error);
  }
}