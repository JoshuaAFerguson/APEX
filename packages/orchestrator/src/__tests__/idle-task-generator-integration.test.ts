/**
 * Integration tests for IdleTaskGenerator end-to-end workflows
 *
 * This test suite focuses on testing complete integration scenarios
 * involving real analyzers working together with the generator.
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
import { IdleTaskType, StrategyWeights, IdleTask } from '@apexcli/core';
import type { ProjectAnalysis } from '../idle-processor';

// Mock generateIdleTaskId to produce predictable IDs
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  let counter = 0;
  return {
    ...actual,
    generateIdleTaskId: () => `integration-${++counter}`,
  };
});

describe('IdleTaskGenerator Integration Tests', () => {
  let generator: IdleTaskGenerator;
  let complexProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    // Create a comprehensive project analysis that would trigger all analyzer types
    complexProjectAnalysis = {
      codebaseSize: { files: 250, lines: 25000, languages: { ts: 180, js: 50, json: 20 } },
      testCoverage: { percentage: 35, uncoveredFiles: [
        'src/auth/service.ts',
        'src/payment/gateway.ts',
        'src/utils/crypto.ts',
        'src/api/middleware.ts',
        'src/database/connection.ts'
      ] },
      dependencies: {
        outdated: [
          'express@^4.17.0',  // Should be updated
          'lodash@^0.10.0',   // Pre-1.0 version
          'moment@^2.29.0'    // Has newer versions
        ],
        security: [
          'axios@0.21.0',     // Known vulnerabilities
          'serialize-javascript@3.0.0'  // Security issues
        ],
        // Enhanced dependency analysis
        securityIssues: [
          {
            name: 'axios',
            cveId: 'CVE-2021-3749',
            severity: 'high',
            affectedVersions: '0.21.0',
            description: 'Prototype pollution vulnerability in axios request handling'
          },
          {
            name: 'serialize-javascript',
            cveId: 'CVE-2019-16769',
            severity: 'critical',
            affectedVersions: '3.0.0',
            description: 'Code injection vulnerability in serialize-javascript'
          }
        ],
        outdatedPackages: [
          {
            name: 'express',
            currentVersion: '4.17.0',
            latestVersion: '4.18.2',
            updateType: 'minor'
          },
          {
            name: 'lodash',
            currentVersion: '0.10.0',
            latestVersion: '4.17.21',
            updateType: 'major'
          }
        ],
        deprecatedPackages: [
          {
            name: 'request',
            currentVersion: '2.88.2',
            reason: 'Package is deprecated and no longer maintained',
            replacement: 'axios'
          }
        ]
      },
      codeQuality: {
        lintIssues: 156,
        duplicatedCode: [
          {
            pattern: 'User authentication logic',
            locations: ['src/auth/login.ts', 'src/auth/register.ts', 'src/auth/reset.ts'],
            similarity: 0.85
          },
          {
            pattern: 'Database query patterns',
            locations: ['src/users/repository.ts', 'src/orders/repository.ts'],
            similarity: 0.92
          }
        ],
        complexityHotspots: [
          {
            file: 'src/payment/processor.ts',
            cyclomaticComplexity: 45,
            cognitiveComplexity: 52,
            lineCount: 850
          },
          {
            file: 'src/auth/middleware.ts',
            cyclomaticComplexity: 35,
            cognitiveComplexity: 41,
            lineCount: 420
          },
          {
            file: 'src/utils/validation.ts',
            cyclomaticComplexity: 28,
            cognitiveComplexity: 33,
            lineCount: 320
          }
        ],
        codeSmells: [
          'Long parameter list in src/api/handlers.ts',
          'God class in src/core/application.ts',
          'Feature envy in src/utils/helpers.ts'
        ]
      },
      documentation: {
        coverage: 25,
        missingDocs: [
          'src/core/application.ts',
          'src/api/routes.ts',
          'src/payment/processor.ts',
          'src/auth/service.ts',
          'src/utils/validation.ts'
        ],
        // Enhanced documentation analysis
        outdatedDocs: ['README.md', 'API.md', 'CHANGELOG.md'],
        undocumentedExports: [
          'src/core/application.ts:Application',
          'src/utils/validation.ts:validateEmail',
          'src/auth/service.ts:AuthService'
        ],
        missingReadmeSections: ['Installation', 'Configuration', 'Testing', 'Contributing'],
        apiCompleteness: {
          documented: 25,
          undocumented: 75
        }
      },
      performance: {
        slowTests: [
          'test/integration/payment.test.ts',
          'test/integration/auth.test.ts'
        ],
        bottlenecks: [
          'src/database/queries.ts',
          'src/api/middleware.ts'
        ]
      },
      // Enhanced test analysis
      testAnalysis: {
        branchCoverage: {
          percentage: 45,
          uncoveredBranches: [
            {
              file: 'src/auth/service.ts',
              branch: 'error handling for invalid tokens',
              lineNumber: 125,
              severity: 'high'
            },
            {
              file: 'src/payment/processor.ts',
              branch: 'fallback payment method selection',
              lineNumber: 67,
              severity: 'critical'
            }
          ]
        },
        untestedExports: [
          {
            file: 'src/utils/crypto.ts',
            export: 'encryptData',
            riskLevel: 'high',
            reason: 'Security-critical function'
          },
          {
            file: 'src/auth/service.ts',
            export: 'validateToken',
            riskLevel: 'high',
            reason: 'Authentication critical path'
          }
        ],
        missingIntegrationTests: [
          {
            area: 'payment flow',
            priority: 'critical',
            components: ['PaymentProcessor', 'PaymentGateway', 'OrderService']
          },
          {
            area: 'user authentication',
            priority: 'high',
            components: ['AuthService', 'UserService', 'SessionManager']
          }
        ],
        antiPatterns: [
          {
            type: 'fixture overuse',
            files: ['test/auth.test.ts', 'test/users.test.ts'],
            severity: 'medium',
            description: 'Tests rely heavily on shared fixtures instead of focused setup'
          },
          {
            type: 'assertion roulette',
            files: ['test/payment.test.ts'],
            severity: 'high',
            description: 'Multiple assertions without clear failure messages'
          }
        ]
      }
    };

    generator = new IdleTaskGenerator();
  });

  describe('End-to-End Task Generation', () => {
    it('should generate tasks from all analyzer types in a complex project', () => {
      const generatedTasks: IdleTask[] = [];
      const taskTypes = new Set<string>();

      // Generate multiple tasks to exercise all analyzers
      for (let i = 0; i < 20; i++) {
        const task = generator.generateTask(complexProjectAnalysis);
        if (task) {
          generatedTasks.push(task);
          taskTypes.add(task.type);
        }
      }

      // Should generate tasks from multiple types
      expect(generatedTasks.length).toBeGreaterThan(0);
      expect(taskTypes.size).toBeGreaterThan(1);

      // All tasks should have the required structure
      generatedTasks.forEach(task => {
        expect(task.id).toMatch(/^integration-\d+$/);
        expect(task.type).toBeDefined();
        expect(task.title).toBeTruthy();
        expect(task.description).toBeTruthy();
        expect(task.priority).toBe('low');
        expect(task.estimatedEffort).toMatch(/^(low|medium|high)$/);
        expect(task.suggestedWorkflow).toBeTruthy();
        expect(task.rationale).toBeTruthy();
        expect(task.createdAt).toBeInstanceOf(Date);
        expect(task.implemented).toBe(false);
      });

      // Should cover different task types
      const expectedTypes = ['maintenance', 'optimization', 'documentation', 'improvement'];
      const actualTypes = Array.from(taskTypes);
      const overlap = expectedTypes.filter(type => actualTypes.includes(type));
      expect(overlap.length).toBeGreaterThan(0);
    });

    it('should prioritize critical security issues first', () => {
      // Set high weight for maintenance to prioritize security
      const securityFocusedGenerator = new IdleTaskGenerator({
        maintenance: 1.0,
        refactoring: 0,
        docs: 0,
        tests: 0
      });

      const task = securityFocusedGenerator.generateTask(complexProjectAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.title).toContain('Critical Security Vulnerability');
      expect(task?.description).toContain('serialize-javascript');
      expect(task?.description).toContain('CVE-2019-16769');
    });

    it('should handle complexity hotspots when focused on refactoring', () => {
      const refactoringFocusedGenerator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 1.0,
        docs: 0,
        tests: 0
      });

      const task = refactoringFocusedGenerator.generateTask(complexProjectAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('optimization');
      expect(task?.title).toContain('Refactor');
      expect(task?.description).toContain('payment/processor.ts');
      expect(task?.description).toContain('Cyclomatic Complexity: 45');
    });

    it('should generate documentation tasks for core modules', () => {
      const docsFocusedGenerator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 1.0,
        tests: 0
      });

      const task = docsFocusedGenerator.generateTask(complexProjectAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('documentation');
      expect(
        task?.title.includes('Document Core Modules') ||
        task?.title.includes('Critical Documentation Gap')
      ).toBe(true);
    });

    it('should generate test coverage tasks for critical paths', () => {
      const testsFocusedGenerator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 0,
        tests: 1.0
      });

      const task = testsFocusedGenerator.generateTask(complexProjectAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBe('improvement');
      expect(task?.suggestedWorkflow).toBe('testing');
      expect(
        task?.title.includes('Test Coverage') ||
        task?.title.includes('Critical Code Paths') ||
        task?.title.includes('Branch Coverage')
      ).toBe(true);
    });
  });

  describe('Multi-Round Task Generation', () => {
    it('should generate diverse tasks across multiple rounds', () => {
      const taskTypes: string[] = [];
      const taskTitles: string[] = [];

      // Generate tasks across multiple rounds
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 4; i++) {
          const task = generator.generateTask(complexProjectAnalysis);
          if (task) {
            taskTypes.push(task.type);
            taskTitles.push(task.title);
          }
        }
        // Reset between rounds to allow regeneration
        generator.reset();
      }

      // Should have generated diverse task types
      const uniqueTypes = new Set(taskTypes);
      expect(uniqueTypes.size).toBeGreaterThan(1);

      // Should have generated diverse titles
      const uniqueTitles = new Set(taskTitles);
      expect(uniqueTitles.size).toBeGreaterThan(3);
    });

    it('should maintain deduplication within a round', () => {
      const tasksInRound: IdleTask[] = [];

      // Generate multiple tasks in same round
      for (let i = 0; i < 10; i++) {
        const task = generator.generateTask(complexProjectAnalysis);
        if (task) {
          tasksInRound.push(task);
        }
      }

      // All tasks in the round should be unique
      const usedCandidates = generator.getUsedCandidates();
      expect(usedCandidates.size).toBe(tasksInRound.length);

      // Task titles should be unique within the round
      const titleCounts = new Map<string, number>();
      tasksInRound.forEach(task => {
        titleCounts.set(task.title, (titleCounts.get(task.title) || 0) + 1);
      });

      // No duplicate titles within the round
      Array.from(titleCounts.values()).forEach(count => {
        expect(count).toBe(1);
      });
    });

    it('should allow regeneration after reset', () => {
      // Generate task and record used candidates
      const firstTask = generator.generateTask(complexProjectAnalysis);
      const firstRoundUsed = generator.getUsedCandidates().size;

      expect(firstTask).not.toBeNull();
      expect(firstRoundUsed).toBeGreaterThan(0);

      // Reset and generate again
      generator.reset();
      const secondTask = generator.generateTask(complexProjectAnalysis);
      const secondRoundUsed = generator.getUsedCandidates().size;

      expect(secondTask).not.toBeNull();
      expect(secondRoundUsed).toBeGreaterThan(0);

      // Used candidates should be reset
      expect(secondRoundUsed).toBeLessThanOrEqual(firstRoundUsed);
    });
  });

  describe('Weighted Strategy Distribution', () => {
    it('should distribute tasks according to weights over multiple generations', () => {
      const weights = {
        maintenance: 0.1,
        refactoring: 0.3,
        docs: 0.5,
        tests: 0.1
      };

      const weightedGenerator = new IdleTaskGenerator(weights);
      const taskCounts: Record<string, number> = {};

      // Generate many tasks to test distribution
      for (let i = 0; i < 100; i++) {
        const task = weightedGenerator.generateTask(complexProjectAnalysis);
        if (task) {
          taskCounts[task.type] = (taskCounts[task.type] || 0) + 1;
        }
        weightedGenerator.reset(); // Allow regeneration
      }

      const totalTasks = Object.values(taskCounts).reduce((sum, count) => sum + count, 0);

      if (totalTasks > 0) {
        // Documentation should be most common (50% weight)
        const docTasks = taskCounts['documentation'] || 0;
        const docRatio = docTasks / totalTasks;

        // Should be roughly proportional to weight with some tolerance
        expect(docRatio).toBeGreaterThan(0.3); // At least 30% of expected weight

        // Optimization (refactoring) should be second most common (30% weight)
        const optTasks = taskCounts['optimization'] || 0;
        const optRatio = optTasks / totalTasks;

        if (optTasks > 0) {
          expect(optRatio).toBeGreaterThan(0.1); // Should have some representation
        }
      }
    });

    it('should handle zero weights by skipping those strategies', () => {
      const zeroWeightGenerator = new IdleTaskGenerator({
        maintenance: 0,
        refactoring: 0,
        docs: 1.0,
        tests: 0
      });

      const taskTypes = new Set<string>();

      // Generate multiple tasks
      for (let i = 0; i < 20; i++) {
        const task = zeroWeightGenerator.generateTask(complexProjectAnalysis);
        if (task) {
          taskTypes.add(task.type);
        }
        zeroWeightGenerator.reset();
      }

      // Should only generate documentation tasks
      expect(taskTypes.size).toBe(1);
      expect(taskTypes.has('documentation')).toBe(true);
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle a typical startup codebase scenario', () => {
      const startupAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 45, lines: 4500, languages: { ts: 30, js: 15 } },
        testCoverage: { percentage: 15, uncoveredFiles: ['src/auth.ts', 'src/api.ts', 'src/utils.ts'] },
        dependencies: {
          outdated: ['express@^0.18.0', 'mongodb@^0.2.0'],
          security: ['lodash@4.17.15'],
        },
        codeQuality: {
          lintIssues: 89,
          duplicatedCode: ['src/controllers.ts'],
          complexityHotspots: [{ file: 'src/app.ts', cyclomaticComplexity: 25, cognitiveComplexity: 30, lineCount: 400 }],
          codeSmells: []
        },
        documentation: { coverage: 5, missingDocs: ['src/app.ts', 'src/auth.ts', 'README.md'] },
        performance: { slowTests: [], bottlenecks: [] },
      };

      const task = generator.generateTask(startupAnalysis);

      expect(task).not.toBeNull();
      expect(task?.priority).toBe('low');

      // Should identify critical areas (likely pre-1.0 deps, low test coverage, or no docs)
      expect(
        task?.title.includes('Pre-1.0') ||
        task?.title.includes('Critical') ||
        task?.title.includes('Test') ||
        task?.title.includes('Document')
      ).toBe(true);
    });

    it('should handle a mature enterprise codebase scenario', () => {
      const enterpriseAnalysis: ProjectAnalysis = {
        codebaseSize: { files: 1500, lines: 150000, languages: { ts: 1200, js: 200, java: 100 } },
        testCoverage: { percentage: 78, uncoveredFiles: ['src/legacy/old-module.ts'] },
        dependencies: {
          outdated: ['moment@^2.29.0', 'webpack@^4.46.0'],
          security: [],
        },
        codeQuality: {
          lintIssues: 45,
          duplicatedCode: [],
          complexityHotspots: [
            { file: 'src/legacy/processor.ts', cyclomaticComplexity: 55, cognitiveComplexity: 62, lineCount: 1200 }
          ],
          codeSmells: []
        },
        documentation: { coverage: 65, missingDocs: ['src/new-feature.ts'] },
        performance: { slowTests: ['test/integration/full-flow.test.ts'], bottlenecks: [] },
      };

      const task = generator.generateTask(enterpriseAnalysis);

      expect(task).not.toBeNull();
      expect(task?.priority).toBe('low');

      // Should identify optimization opportunities (likely complexity hotspots)
      expect(
        task?.title.includes('Refactor') ||
        task?.title.includes('Update') ||
        task?.title.includes('Document')
      ).toBe(true);
    });
  });

  describe('Integration with Enhanced Analyzers', () => {
    it('should work with enhanced maintenance analyzer capabilities', () => {
      const enhancedGenerator = IdleTaskGenerator.createEnhanced('/project/path');

      const task = enhancedGenerator.generateTask(complexProjectAnalysis);

      expect(task).not.toBeNull();
      expect(task?.type).toBeDefined();

      // Enhanced capabilities should be enabled
      const capabilities = enhancedGenerator.getEnhancedCapabilities();
      expect(capabilities.enabled).toBe(true);
      expect(capabilities.projectPath).toBe('/project/path');
    });

    it('should maintain consistent task quality with enhanced features', () => {
      const standardGenerator = new IdleTaskGenerator();
      const enhancedGenerator = IdleTaskGenerator.createEnhanced('/project/path');

      const standardTask = standardGenerator.generateTask(complexProjectAnalysis);
      const enhancedTask = enhancedGenerator.generateTask(complexProjectAnalysis);

      // Both should generate valid tasks
      expect(standardTask).not.toBeNull();
      expect(enhancedTask).not.toBeNull();

      // Both should maintain the same quality standards
      expect(standardTask?.priority).toBe('low');
      expect(enhancedTask?.priority).toBe('low');

      // Both should have complete task structure
      [standardTask, enhancedTask].forEach(task => {
        if (task) {
          expect(task.id).toBeTruthy();
          expect(task.title).toBeTruthy();
          expect(task.description).toBeTruthy();
          expect(task.rationale).toBeTruthy();
          expect(task.estimatedEffort).toMatch(/^(low|medium|high)$/);
          expect(task.createdAt).toBeInstanceOf(Date);
          expect(task.implemented).toBe(false);
        }
      });
    });
  });
});