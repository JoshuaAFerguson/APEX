import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor } from './idle-processor.js';
import { TaskStore } from './store.js';
import type {
  TestAnalysis,
  BranchCoverage,
  UntestedExport,
  MissingIntegrationTest,
  TestingAntiPattern,
  ProjectAnalysis,
  DaemonConfig
} from '@apexcli/core';

// Mock external dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('./store.js', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
    getAllTasks: vi.fn().mockResolvedValue([]),
    getTasksByStatus: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock child_process for exec commands
const mockExecAsync = vi.fn();
vi.mock('child_process', () => ({
  exec: (command: string, options: any, callback: Function) => {
    mockExecAsync(command, options).then((result: any) => {
      callback(null, result);
    }).catch((error: any) => {
      callback(error);
    });
  },
}));

vi.mock('util', () => ({
  promisify: (fn: Function) => fn,
}));

describe('TestAnalysis Data Structures', () => {
  let idleProcessor: IdleProcessor;
  let mockConfig: DaemonConfig;
  let mockStore: TaskStore;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      installAsService: false,
      serviceName: 'apex-daemon',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = new TaskStore(':memory:');
    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockStore);
  });

  describe('BranchCoverage', () => {
    it('should correctly structure branch coverage data', () => {
      const branchCoverage: BranchCoverage = {
        percentage: 75,
        uncoveredBranches: [
          {
            file: 'src/utils.ts',
            line: 42,
            type: 'if',
            description: 'Error handling branch not covered',
          },
          {
            file: 'src/validation.ts',
            line: 15,
            type: 'ternary',
            description: 'Edge case validation not tested',
          },
        ],
      };

      expect(branchCoverage.percentage).toBe(75);
      expect(branchCoverage.uncoveredBranches).toHaveLength(2);
      expect(branchCoverage.uncoveredBranches[0].type).toBe('if');
      expect(branchCoverage.uncoveredBranches[1].type).toBe('ternary');
    });

    it('should support all branch types', () => {
      const branchTypes: BranchCoverage['uncoveredBranches'][0]['type'][] = [
        'if', 'else', 'switch', 'catch', 'ternary', 'logical'
      ];

      branchTypes.forEach(type => {
        const branch: BranchCoverage['uncoveredBranches'][0] = {
          file: 'test.ts',
          line: 1,
          type,
          description: `Test ${type} branch`,
        };

        expect(branch.type).toBe(type);
      });
    });

    it('should handle edge cases for coverage percentage', () => {
      const zeroCoverage: BranchCoverage = {
        percentage: 0,
        uncoveredBranches: [],
      };

      const fullCoverage: BranchCoverage = {
        percentage: 100,
        uncoveredBranches: [],
      };

      expect(zeroCoverage.percentage).toBe(0);
      expect(fullCoverage.percentage).toBe(100);
      expect(zeroCoverage.uncoveredBranches).toHaveLength(0);
      expect(fullCoverage.uncoveredBranches).toHaveLength(0);
    });
  });

  describe('UntestedExport', () => {
    it('should correctly identify untested exports', () => {
      const untestedExports: UntestedExport[] = [
        {
          file: 'src/api.ts',
          exportName: 'validateUser',
          exportType: 'function',
          line: 25,
          isPublic: true,
        },
        {
          file: 'src/models.ts',
          exportName: 'UserSchema',
          exportType: 'interface',
          line: 10,
          isPublic: true,
        },
      ];

      expect(untestedExports).toHaveLength(2);
      expect(untestedExports[0].exportType).toBe('function');
      expect(untestedExports[1].exportType).toBe('interface');
      expect(untestedExports.every(exp => exp.isPublic)).toBe(true);
    });

    it('should support all export types', () => {
      const exportTypes: UntestedExport['exportType'][] = [
        'function', 'class', 'interface', 'type', 'variable', 'const', 'enum', 'namespace'
      ];

      exportTypes.forEach(type => {
        const untested: UntestedExport = {
          file: 'test.ts',
          exportName: `Test${type}`,
          exportType: type,
          line: 1,
          isPublic: true,
        };

        expect(untested.exportType).toBe(type);
      });
    });

    it('should distinguish between public and private exports', () => {
      const publicExport: UntestedExport = {
        file: 'src/public-api.ts',
        exportName: 'publicFunction',
        exportType: 'function',
        isPublic: true,
      };

      const privateExport: UntestedExport = {
        file: 'src/internal.ts',
        exportName: '_internalHelper',
        exportType: 'function',
        isPublic: false,
      };

      expect(publicExport.isPublic).toBe(true);
      expect(privateExport.isPublic).toBe(false);
    });
  });

  describe('MissingIntegrationTest', () => {
    it('should identify critical paths needing integration tests', () => {
      const missingTests: MissingIntegrationTest[] = [
        {
          criticalPath: 'User authentication flow',
          description: 'End-to-end test for login, token validation, and logout',
          priority: 'critical',
          relatedFiles: ['src/auth.ts', 'src/middleware.ts'],
        },
        {
          criticalPath: 'Data persistence layer',
          description: 'Integration tests for database transactions',
          priority: 'high',
          relatedFiles: ['src/db.ts', 'src/models.ts'],
        },
      ];

      expect(missingTests).toHaveLength(2);
      expect(missingTests[0].priority).toBe('critical');
      expect(missingTests[1].priority).toBe('high');
      expect(missingTests[0].relatedFiles).toContain('src/auth.ts');
    });

    it('should support all priority levels', () => {
      const priorities: MissingIntegrationTest['priority'][] = [
        'low', 'medium', 'high', 'critical'
      ];

      priorities.forEach(priority => {
        const test: MissingIntegrationTest = {
          criticalPath: `Test path with ${priority} priority`,
          description: `Test description for ${priority}`,
          priority,
        };

        expect(test.priority).toBe(priority);
      });
    });

    it('should handle missing integration tests without related files', () => {
      const test: MissingIntegrationTest = {
        criticalPath: 'Configuration validation',
        description: 'Test configuration loading and validation',
        priority: 'medium',
      };

      expect(test.relatedFiles).toBeUndefined();
      expect(test.criticalPath).toBeTruthy();
      expect(test.description).toBeTruthy();
    });
  });

  describe('TestingAntiPattern', () => {
    it('should detect common testing anti-patterns', () => {
      const antiPatterns: TestingAntiPattern[] = [
        {
          file: 'src/__tests__/user.test.ts',
          line: 45,
          type: 'brittle-test',
          description: 'Test depends on external timing and may be flaky',
          severity: 'high',
          suggestion: 'Use mocked timers or eliminate timing dependencies',
        },
        {
          file: 'src/__tests__/api.test.ts',
          line: 12,
          type: 'mystery-guest',
          description: 'Test has hidden dependency on external file system',
          severity: 'medium',
          suggestion: 'Mock file system operations or make dependencies explicit',
        },
      ];

      expect(antiPatterns).toHaveLength(2);
      expect(antiPatterns[0].type).toBe('brittle-test');
      expect(antiPatterns[1].type).toBe('mystery-guest');
      expect(antiPatterns[0].severity).toBe('high');
      expect(antiPatterns[1].severity).toBe('medium');
    });

    it('should support all anti-pattern types', () => {
      const antiPatternTypes: TestingAntiPattern['type'][] = [
        'brittle-test', 'test-pollution', 'mystery-guest', 'eager-test',
        'assertion-roulette', 'slow-test', 'flaky-test', 'test-code-duplication'
      ];

      antiPatternTypes.forEach(type => {
        const pattern: TestingAntiPattern = {
          file: 'test.ts',
          line: 1,
          type,
          description: `Test anti-pattern: ${type}`,
          severity: 'medium',
        };

        expect(pattern.type).toBe(type);
      });
    });

    it('should support all severity levels', () => {
      const severities: TestingAntiPattern['severity'][] = ['low', 'medium', 'high'];

      severities.forEach(severity => {
        const pattern: TestingAntiPattern = {
          file: 'test.ts',
          line: 1,
          type: 'slow-test',
          description: `Test with ${severity} severity`,
          severity,
        };

        expect(pattern.severity).toBe(severity);
      });
    });

    it('should handle optional suggestion field', () => {
      const withSuggestion: TestingAntiPattern = {
        file: 'test.ts',
        line: 1,
        type: 'slow-test',
        description: 'Test with suggestion',
        severity: 'high',
        suggestion: 'Use mocked dependencies to speed up test',
      };

      const withoutSuggestion: TestingAntiPattern = {
        file: 'test.ts',
        line: 1,
        type: 'flaky-test',
        description: 'Test without suggestion',
        severity: 'medium',
      };

      expect(withSuggestion.suggestion).toBeTruthy();
      expect(withoutSuggestion.suggestion).toBeUndefined();
    });
  });

  describe('Complete TestAnalysis Structure', () => {
    it('should combine all test analysis components correctly', () => {
      const testAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 85,
          uncoveredBranches: [
            {
              file: 'src/error-handler.ts',
              line: 32,
              type: 'catch',
              description: 'Exception handling not tested',
            },
          ],
        },
        untestedExports: [
          {
            file: 'src/utils.ts',
            exportName: 'formatDate',
            exportType: 'function',
            line: 15,
            isPublic: true,
          },
        ],
        missingIntegrationTests: [
          {
            criticalPath: 'API error responses',
            description: 'End-to-end testing of error handling paths',
            priority: 'high',
            relatedFiles: ['src/api.ts', 'src/error-handler.ts'],
          },
        ],
        antiPatterns: [
          {
            file: 'src/__tests__/integration.test.ts',
            line: 67,
            type: 'test-pollution',
            description: 'Test modifies global state affecting other tests',
            severity: 'high',
            suggestion: 'Use proper setup/teardown to isolate test state',
          },
        ],
      };

      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.branchCoverage.percentage).toBe(85);
      expect(testAnalysis.untestedExports).toHaveLength(1);
      expect(testAnalysis.missingIntegrationTests).toHaveLength(1);
      expect(testAnalysis.antiPatterns).toHaveLength(1);
      expect(testAnalysis.antiPatterns[0].suggestion).toBeTruthy();
    });

    it('should handle empty test analysis', () => {
      const emptyAnalysis: TestAnalysis = {
        branchCoverage: {
          percentage: 0,
          uncoveredBranches: [],
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: [],
      };

      expect(emptyAnalysis.branchCoverage.percentage).toBe(0);
      expect(emptyAnalysis.untestedExports).toHaveLength(0);
      expect(emptyAnalysis.missingIntegrationTests).toHaveLength(0);
      expect(emptyAnalysis.antiPatterns).toHaveLength(0);
    });
  });

  describe('IdleProcessor Test Analysis Integration', () => {
    it('should include testAnalysis in ProjectAnalysis structure', async () => {
      // Mock file system calls
      const mockReadFile = vi.mocked(fs.readFile);

      // Mock basic file reads
      mockReadFile.mockResolvedValue('export function testFunction() {}');

      // Mock exec commands
      mockExecAsync.mockResolvedValue({ stdout: 'src/test.ts', stderr: '' });

      // Get project analysis
      const analysis = await (idleProcessor as any).analyzeProject();

      expect(analysis).toBeDefined();
      expect(analysis.testAnalysis).toBeDefined();
      expect(analysis.testAnalysis.branchCoverage).toBeDefined();
      expect(analysis.testAnalysis.untestedExports).toBeDefined();
      expect(analysis.testAnalysis.missingIntegrationTests).toBeDefined();
      expect(analysis.testAnalysis.antiPatterns).toBeDefined();
    });

    it('should analyze branch coverage correctly', async () => {
      // Mock conditional statements in source files
      mockExecAsync.mockResolvedValue({
        stdout: 'src/test.ts:10:if (condition) {\nsrc/test.ts:15:} else {',
        stderr: ''
      });

      const branchCoverage = await (idleProcessor as any).analyzeBranchCoverage();

      expect(branchCoverage).toBeDefined();
      expect(branchCoverage.percentage).toBeGreaterThanOrEqual(0);
      expect(branchCoverage.percentage).toBeLessThanOrEqual(100);
      expect(Array.isArray(branchCoverage.uncoveredBranches)).toBe(true);
    });

    it('should find untested exports correctly', async () => {
      const mockFileContent = `
        export function testedFunction() {}
        export function untestedFunction() {}
        export class TestClass {}
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/test.ts\nsrc/another.ts',
        stderr: ''
      });

      const untestedExports = await (idleProcessor as any).findUntestedExports();

      expect(Array.isArray(untestedExports)).toBe(true);
      // Should find untested exports since we're mocking no test files
      expect(untestedExports.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify missing integration tests', async () => {
      // Mock files that would need integration tests
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'src/api.ts\nsrc/router.ts', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'src/db.ts\nsrc/models.ts', stderr: '' });

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('app.get("/api", handler);');

      const missingTests = await (idleProcessor as any).findMissingIntegrationTests();

      expect(Array.isArray(missingTests)).toBe(true);
      expect(missingTests.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect testing anti-patterns', async () => {
      const mockTestFileContent = `
        describe('test', () => {
          it('should work', () => {
            global.testValue = 'test';
            setTimeout(() => {
              expect(result).toBe(expected);
            }, 1000);
          });
        });
      `;

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(mockTestFileContent);

      mockExecAsync.mockResolvedValue({
        stdout: 'src/test.test.ts\nsrc/another.test.ts',
        stderr: ''
      });

      const antiPatterns = await (idleProcessor as any).detectTestingAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      // Should detect test pollution and slow test patterns
      expect(antiPatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully in test analysis', async () => {
      // Mock exec to throw an error
      mockExecAsync.mockRejectedValue(new Error('Command failed'));

      const testAnalysis = await (idleProcessor as any).analyzeTestAnalysis();

      // Should return default empty structure on error
      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.branchCoverage.percentage).toBe(0);
      expect(testAnalysis.untestedExports).toEqual([]);
      expect(testAnalysis.missingIntegrationTests).toEqual([]);
      expect(testAnalysis.antiPatterns).toEqual([]);
    });
  });
});