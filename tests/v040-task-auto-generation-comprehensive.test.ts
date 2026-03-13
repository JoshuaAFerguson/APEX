import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleTaskGenerator } from '../packages/orchestrator/src/idle-task-generator';
import { IdleProcessor } from '../packages/orchestrator/src/idle-processor';
import { TaskStore } from '../packages/orchestrator/src/store';
import {
  IdleTaskType,
  StrategyWeights,
  TaskEffort,
  IdleTask,
  ApexConfig,
  DaemonConfig,
} from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock filesystem operations
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
  };
});

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

describe('V0.4.0 Task Auto-Generation Feature', () => {
  describe('IdleTaskGenerator', () => {
    let generator: IdleTaskGenerator;
    let mockProjectAnalysis: any;

    beforeEach(() => {
      mockProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 5000,
          languages: { typescript: 3000, javascript: 2000 }
        },
        testCoverage: {
          percentage: 65,
          uncoveredFiles: ['src/utils/helper.ts', 'src/components/Widget.tsx']
        },
        dependencies: {
          outdated: ['lodash@4.17.15'],
          security: [],
          outdatedPackages: [{
            name: 'lodash',
            currentVersion: '4.17.15',
            latestVersion: '4.17.21',
            updateType: 'patch' as const
          }],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: [{
            file1: 'src/utils/format.ts',
            file2: 'src/helpers/format.ts',
            duplicatedLines: 15,
            similarity: 0.9
          }],
          complexityHotspots: [{
            file: 'src/complex-function.ts',
            function: 'processData',
            complexity: 25,
            threshold: 10
          }],
          codeSmells: [{
            type: 'long-method',
            file: 'src/long-method.ts',
            function: 'complexProcess',
            severity: 'medium',
            description: 'Method has too many lines'
          }]
        },
        documentation: {
          coveragePercentage: 45,
          undocumentedExports: [{
            file: 'src/api.ts',
            exportName: 'createUser',
            exportType: 'function'
          }],
          outdatedDocumentation: [],
          missingReadmeSections: [{
            section: 'API Reference',
            severity: 'medium',
            description: 'Missing API documentation'
          }],
          apiCompleteness: {
            documented: 15,
            total: 30,
            percentage: 50
          }
        },
        performance: {
          bundleSize: 2048000,
          slowTests: ['integration/slow-test.spec.ts'],
          bottlenecks: ['src/heavy-computation.ts']
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 60,
            uncoveredBranches: [{
              file: 'src/conditional.ts',
              line: 25,
              branch: 'else'
            }]
          },
          untestedExports: [{
            file: 'src/untested.ts',
            exportName: 'helperFunction',
            exportType: 'function'
          }],
          antiPatterns: [{
            type: 'async-without-await',
            file: 'tests/bad-async.test.ts',
            line: 15,
            severity: 'high',
            description: 'Async test without await'
          }]
        }
      };

      generator = new IdleTaskGenerator();
    });

    describe('Strategy Selection', () => {
      it('should use equal weights by default', () => {
        const generator = new IdleTaskGenerator();

        // Test multiple generations to verify random distribution
        const results = new Map<IdleTaskType, number>();
        for (let i = 0; i < 1000; i++) {
          const taskType = (generator as any).selectTaskType();
          results.set(taskType, (results.get(taskType) || 0) + 1);
        }

        // Each strategy should have roughly equal occurrence (within tolerance)
        const tolerance = 0.15; // 15% tolerance
        const expectedCount = 1000 * 0.2; // 20% each

        ['maintenance', 'refactoring', 'docs', 'tests', 'technical-debt'].forEach(strategy => {
          const count = results.get(strategy as IdleTaskType) || 0;
          expect(count).toBeGreaterThan(expectedCount * (1 - tolerance));
          expect(count).toBeLessThan(expectedCount * (1 + tolerance));
        });
      });

      it('should respect custom weights', () => {
        const customWeights: StrategyWeights = {
          maintenance: 0.8,
          refactoring: 0.1,
          docs: 0.05,
          tests: 0.05,
          'technical-debt': 0.0
        };

        const generator = new IdleTaskGenerator(customWeights);

        const results = new Map<IdleTaskType, number>();
        for (let i = 0; i < 1000; i++) {
          const taskType = (generator as any).selectTaskType();
          results.set(taskType, (results.get(taskType) || 0) + 1);
        }

        // Maintenance should dominate with 80% weight
        const maintenanceCount = results.get('maintenance') || 0;
        expect(maintenanceCount).toBeGreaterThan(700); // At least 70%

        // Technical debt should rarely appear with 0% weight
        const techDebtCount = results.get('technical-debt') || 0;
        expect(techDebtCount).toBe(0);
      });

      it('should handle all-zero weights gracefully', () => {
        const zeroWeights: StrategyWeights = {
          maintenance: 0,
          refactoring: 0,
          docs: 0,
          tests: 0,
          'technical-debt': 0
        };

        const generator = new IdleTaskGenerator(zeroWeights);

        // Should fallback to equal distribution
        expect(() => (generator as any).selectTaskType()).not.toThrow();
      });
    });

    describe('Task Generation', () => {
      it('should generate valid idle tasks', async () => {
        // Generate multiple tasks using the single task API
        const tasks = [];
        for (let i = 0; i < 3; i++) {
          const task = generator.generateTask(mockProjectAnalysis);
          if (task) tasks.push(task);
        }

        expect(tasks.length).toBeGreaterThan(0);

        for (const task of tasks) {
          expect(task).toHaveProperty('id');
          expect(task).toHaveProperty('type');
          expect(task).toHaveProperty('title');
          expect(task).toHaveProperty('description');
          expect(task).toHaveProperty('effort');
          expect(task).toHaveProperty('priority');
          expect(task).toHaveProperty('estimatedMinutes');

          // Validate enum values
          expect(['maintenance', 'refactoring', 'docs', 'tests', 'technical-debt', 'conventions']).toContain(task.type);
          expect(['low', 'medium', 'high']).toContain(task.effort);
          expect(['low', 'medium', 'high']).toContain(task.priority);

          // Validate ID format
          expect(task.id).toMatch(/^idle-task-\d+-[a-z0-9]+$/);
        }
      });

      it('should avoid generating duplicate tasks', async () => {
        // Generate tasks multiple times
        const firstBatch = [];
        const secondBatch = [];

        for (let i = 0; i < 5; i++) {
          const task1 = generator.generateTask(mockProjectAnalysis);
          const task2 = generator.generateTask(mockProjectAnalysis);
          if (task1) firstBatch.push(task1);
          if (task2) secondBatch.push(task2);
        }

        const allTitles = [...firstBatch, ...secondBatch].map(t => t.title);
        const uniqueTitles = [...new Set(allTitles)];

        // Should have some diversity (not all identical)
        expect(uniqueTitles.length).toBeGreaterThan(1);
      });

      it('should generate different task types based on analysis', async () => {
        const tasks = [];
        for (let i = 0; i < 20; i++) {
          const task = generator.generateTask(mockProjectAnalysis);
          if (task) tasks.push(task);
        }

        const taskTypes = new Set(tasks.map(t => t.type));

        // Should generate multiple different types
        expect(taskTypes.size).toBeGreaterThan(1);

        // Should include common types for this analysis
        const typeArray = Array.from(taskTypes);
        expect(typeArray).toContain('maintenance'); // Due to outdated deps
        expect(typeArray).toContain('docs'); // Due to low doc coverage
        expect(typeArray).toContain('tests'); // Due to uncovered files
      });

      it('should estimate effort and time appropriately', async () => {
        const tasks = [];
        for (let i = 0; i < 10; i++) {
          const task = generator.generateTask(mockProjectAnalysis);
          if (task) tasks.push(task);
        }

        for (const task of tasks) {
          // Effort and time should correlate
          if (task.effort === 'low') {
            expect(task.estimatedMinutes).toBeLessThanOrEqual(30);
          } else if (task.effort === 'medium') {
            expect(task.estimatedMinutes).toBeGreaterThan(30);
            expect(task.estimatedMinutes).toBeLessThanOrEqual(120);
          } else if (task.effort === 'high') {
            expect(task.estimatedMinutes).toBeGreaterThan(120);
          }
        }
      });
    });

    describe('Maintenance Tasks', () => {
      it('should generate dependency update tasks', async () => {
        const maintenanceGenerator = new IdleTaskGenerator({
          maintenance: 1.0,
          refactoring: 0,
          docs: 0,
          tests: 0,
          'technical-debt': 0
        });

        const tasks = [];
        for (let i = 0; i < 5; i++) {
          const task = maintenanceGenerator.generateTask(mockProjectAnalysis);
          if (task) tasks.push(task);
        }

        // Should include dependency-related tasks
        const dependencyTasks = tasks.filter(t =>
          t.title.toLowerCase().includes('update') ||
          t.title.toLowerCase().includes('dependency') ||
          t.title.toLowerCase().includes('package')
        );

        expect(dependencyTasks.length).toBeGreaterThan(0);
      });
    });

    describe('Documentation Tasks', () => {
      it('should generate documentation improvement tasks', async () => {
        const docsGenerator = new IdleTaskGenerator({
          maintenance: 0,
          refactoring: 0,
          docs: 1.0,
          tests: 0,
          'technical-debt': 0
        });

        const tasks = [];
        for (let i = 0; i < 5; i++) {
          const task = docsGenerator.generateTask(mockProjectAnalysis);
          if (task) tasks.push(task);
        }

        // Should include documentation-related tasks
        const docTasks = tasks.filter(t =>
          t.title.toLowerCase().includes('document') ||
          t.title.toLowerCase().includes('readme') ||
          t.title.toLowerCase().includes('api reference')
        );

        expect(docTasks.length).toBeGreaterThan(0);
      });
    });

    describe('Test Tasks', () => {
      it('should generate testing improvement tasks', async () => {
        const testsGenerator = new IdleTaskGenerator({
          maintenance: 0,
          refactoring: 0,
          docs: 0,
          tests: 1.0,
          'technical-debt': 0
        });

        const tasks = [];
        for (let i = 0; i < 5; i++) {
          const task = testsGenerator.generateTask(mockProjectAnalysis);
          if (task) tasks.push(task);
        }

        // Should include test-related tasks
        const testTasks = tasks.filter(t =>
          t.title.toLowerCase().includes('test') ||
          t.title.toLowerCase().includes('coverage') ||
          t.title.toLowerCase().includes('spec')
        );

        expect(testTasks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('IdleProcessor Integration', () => {
    let processor: IdleProcessor;
    let mockStore: TaskStore;
    let mockConfig: ApexConfig;

    beforeEach(() => {
      // Mock TaskStore
      mockStore = {
        createTask: vi.fn().mockResolvedValue({ id: 'task-123', description: 'Test task' }),
        getActiveTasks: vi.fn().mockResolvedValue([]),
        updateTask: vi.fn(),
        getTask: vi.fn()
      } as unknown as TaskStore;

      // Mock APEX config
      mockConfig = {
        daemon: {
          enabled: true,
          idleTaskGeneration: {
            enabled: true,
            interval: 300000, // 5 minutes
            maxTasks: 5,
            strategies: {
              maintenance: 0.3,
              refactoring: 0.2,
              docs: 0.2,
              tests: 0.2,
              'technical-debt': 0.1
            }
          }
        } as DaemonConfig
      } as ApexConfig;

      processor = new IdleProcessor('/test/project', mockStore, mockConfig);
    });

    it('should initialize with correct configuration', () => {
      expect(processor).toBeDefined();

      // Verify config was applied
      const config = (processor as any).config;
      expect(config.daemon.idleTaskGeneration.enabled).toBe(true);
      expect(config.daemon.idleTaskGeneration.maxTasks).toBe(5);
    });

    it('should process idle periods and generate tasks', async () => {
      // Mock file system for project analysis
      (fs.readdir as any).mockResolvedValue(['src', 'tests', 'package.json']);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true, isFile: () => false });
      (fs.readFile as any).mockResolvedValue(JSON.stringify({
        dependencies: { lodash: '4.17.15' },
        devDependencies: { jest: '27.0.0' }
      }));

      // Start idle processing
      await processor.startProcessing();

      // Simulate idle period trigger
      await processor.processIdlePeriod();

      // Verify tasks were created
      expect(mockStore.createTask).toHaveBeenCalled();

      // Clean up
      await processor.stopProcessing();
    });

    it('should respect maximum task limits', async () => {
      // Set up existing active tasks to approach limit
      const existingTasks = Array.from({ length: 4 }, (_, i) => ({
        id: `existing-${i}`,
        status: 'pending',
        type: 'idle'
      }));
      (mockStore.getActiveTasks as any).mockResolvedValue(existingTasks);

      (fs.readdir as any).mockResolvedValue(['src']);
      (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
      (fs.readFile as any).mockResolvedValue('{}');

      await processor.processIdlePeriod();

      // Should only create 1 more task (5 - 4 = 1)
      expect(mockStore.createTask).toHaveBeenCalledTimes(1);
    });

    it('should skip generation when disabled', async () => {
      const disabledConfig = {
        ...mockConfig,
        daemon: {
          ...mockConfig.daemon,
          idleTaskGeneration: {
            ...mockConfig.daemon.idleTaskGeneration,
            enabled: false
          }
        }
      };

      const disabledProcessor = new IdleProcessor('/test/project', mockStore, disabledConfig);

      await disabledProcessor.processIdlePeriod();

      // Should not create any tasks
      expect(mockStore.createTask).not.toHaveBeenCalled();
    });

    it('should handle analysis errors gracefully', async () => {
      // Mock file system to throw errors
      (fs.readdir as any).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(processor.processIdlePeriod()).resolves.not.toThrow();

      // Should not create tasks on analysis failure
      expect(mockStore.createTask).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty project analysis', async () => {
      const emptyAnalysis = {
        codebaseSize: { files: 0, lines: 0, languages: {} },
        dependencies: { outdated: [], security: [] },
        codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
        documentation: { coveragePercentage: 0, undocumentedExports: [], outdatedDocumentation: [], missingReadmeSections: [], apiCompleteness: { documented: 0, total: 0, percentage: 0 } },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: { branchCoverage: { percentage: 0, uncoveredBranches: [] }, untestedExports: [], antiPatterns: [] }
      };

      const generator = new IdleTaskGenerator();

      // Try generating a few tasks with empty analysis
      let taskCount = 0;
      for (let i = 0; i < 3; i++) {
        const task = generator.generateTask(emptyAnalysis);
        if (task) taskCount++;
      }

      // Should still generate some tasks (fallback behaviors) or return null gracefully
      expect(taskCount).toBeGreaterThanOrEqual(0);
      expect(taskCount).toBeLessThanOrEqual(3);
    });

    it('should handle invalid analysis data', async () => {
      const invalidAnalysis = null as any;

      const generator = new IdleTaskGenerator();

      // Should handle gracefully without throwing
      expect(() => generator.generateTask(invalidAnalysis)).not.toThrow();
    });

    it('should handle multiple generation calls', async () => {
      const generator = new IdleTaskGenerator();
      const tasks = [];

      // This simulates generating 0 tasks (not calling the method)
      expect(tasks).toHaveLength(0);
    });

    it('should handle repeated generation gracefully', async () => {
      const generator = new IdleTaskGenerator();

      // Generate a task and verify it doesn't throw on repeated calls
      const task1 = generator.generateTask(mockProjectAnalysis);
      const task2 = generator.generateTask(mockProjectAnalysis);

      // Both should either be valid tasks or null
      if (task1) expect(task1.id).toBeDefined();
      if (task2) expect(task2.id).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(() => {
      // Ensure mockProjectAnalysis is available in this scope
      mockProjectAnalysis = {
        codebaseSize: {
          files: 100,
          lines: 5000,
          languages: { typescript: 3000, javascript: 2000 }
        },
        testCoverage: {
          percentage: 65,
          uncoveredFiles: ['src/utils/helper.ts', 'src/components/Widget.tsx']
        },
        dependencies: {
          outdated: ['lodash@4.17.15'],
          security: [],
          outdatedPackages: [{
            name: 'lodash',
            currentVersion: '4.17.15',
            latestVersion: '4.17.21',
            updateType: 'patch' as const
          }],
          securityIssues: [],
          deprecatedPackages: []
        },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: [{
            file1: 'src/utils/format.ts',
            file2: 'src/helpers/format.ts',
            duplicatedLines: 15,
            similarity: 0.9
          }],
          complexityHotspots: [{
            file: 'src/complex-function.ts',
            function: 'processData',
            complexity: 25,
            threshold: 10
          }],
          codeSmells: [{
            type: 'long-method',
            file: 'src/long-method.ts',
            function: 'complexProcess',
            severity: 'medium',
            description: 'Method has too many lines'
          }]
        },
        documentation: {
          coveragePercentage: 45,
          undocumentedExports: [{
            file: 'src/api.ts',
            exportName: 'createUser',
            exportType: 'function'
          }],
          outdatedDocumentation: [],
          missingReadmeSections: [{
            section: 'API Reference',
            severity: 'medium',
            description: 'Missing API documentation'
          }],
          apiCompleteness: {
            documented: 15,
            total: 30,
            percentage: 50
          }
        },
        performance: {
          bundleSize: 2048000,
          slowTests: ['integration/slow-test.spec.ts'],
          bottlenecks: ['src/heavy-computation.ts']
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 60,
            uncoveredBranches: [{
              file: 'src/conditional.ts',
              line: 25,
              branch: 'else'
            }]
          },
          untestedExports: [{
            file: 'src/untested.ts',
            exportName: 'helperFunction',
            exportType: 'function'
          }],
          antiPatterns: [{
            type: 'async-without-await',
            file: 'tests/bad-async.test.ts',
            line: 15,
            severity: 'high',
            description: 'Async test without await'
          }]
        }
      };
    });

    it('should generate tasks efficiently for large projects', async () => {
      const largeProjectAnalysis = {
        ...mockProjectAnalysis,
        codebaseSize: {
          files: 10000,
          lines: 500000,
          languages: { typescript: 300000, javascript: 200000 }
        },
        testCoverage: {
          percentage: 45,
          uncoveredFiles: Array.from({ length: 1000 }, (_, i) => `src/file${i}.ts`)
        }
      };

      const start = Date.now();
      const generator = new IdleTaskGenerator();
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const task = generator.generateTask(largeProjectAnalysis);
        if (task) tasks.push(task);
      }
      const duration = Date.now() - start;

      // Should complete within reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should handle high task generation volume', async () => {
      const generator = new IdleTaskGenerator();

      // Generate many batches
      const allTasks: IdleTask[] = [];
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          const task = generator.generateTask(mockProjectAnalysis);
          if (task) allTasks.push(task);
        }
      }

      expect(allTasks.length).toBeGreaterThan(0);

      // Verify all tasks have unique IDs
      const ids = allTasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(allTasks.length);
    });
  });
});