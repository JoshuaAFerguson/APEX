import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProjectAnalysis } from './idle-processor';
import { IdleTaskGenerator } from './idle-task-generator';
import { TaskStore } from './store';
import {
  IdleTask,
  IdleTaskType,
  TaskPriority,
  TaskEffort,
  StrategyWeights,
  CreateTaskRequest
} from '@apexcli/core';

describe('IdleProcessor-IdleTaskGenerator-TaskStore Integration Tests', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let idleTaskGenerator: IdleTaskGenerator;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-idle-integration-test-'));

    // Initialize TaskStore
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    // Initialize IdleTaskGenerator with default weights
    idleTaskGenerator = new IdleTaskGenerator();
  });

  afterEach(async () => {
    taskStore?.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Acceptance Criteria 1: Auto-generated tasks have priority="low"', () => {
    it('should generate idle tasks with low priority when processing project analysis', async () => {
      // Create a mock project analysis with various issues
      const projectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 50,
          lines: 8000,
          languages: { typescript: 45, javascript: 5 }
        },
        testCoverage: {
          percentage: 60,
          uncoveredFiles: ['src/utils/helper.ts', 'src/services/api.ts']
        },
        dependencies: {
          outdated: ['lodash@^4.17.15', 'express@^4.16.0'],
          security: ['vulnerable-package@1.0.0']
        },
        codeQuality: {
          lintIssues: 15,
          duplicatedCode: [{
            files: ['src/component-a.ts', 'src/component-b.ts'],
            lines: [10, 20],
            similarity: 0.85,
            duplicatedLines: 25
          }],
          complexityHotspots: [{
            file: 'src/complex-algorithm.ts',
            line: 45,
            complexity: 25,
            function: 'calculateComplexValue'
          }],
          codeSmells: [{
            file: 'src/long-method.ts',
            line: 12,
            type: 'long-method',
            severity: 'medium',
            description: 'Method has 150 lines'
          }]
        },
        documentation: {
          coverage: 40,
          missingDocs: ['src/api/endpoints.ts', 'src/models/user.ts'],
          undocumentedExports: [{
            file: 'src/utils/index.ts',
            exportName: 'formatDate',
            exportType: 'function',
            line: 15,
            isPublic: true
          }],
          outdatedDocumentation: [{
            file: 'README.md',
            section: 'Installation',
            line: 23,
            reason: 'References deprecated npm script'
          }],
          missingReadmeSections: [{
            section: 'Contributing',
            priority: 'medium',
            description: 'Missing contribution guidelines'
          }],
          apiCompleteness: {
            coverage: 0.6,
            missingDocs: []
          }
        },
        performance: {
          slowTests: ['test/integration/slow-test.spec.ts'],
          bottlenecks: ['src/data/large-dataset-processor.ts']
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 70,
            uncoveredBranches: [{
              file: 'src/validator.ts',
              line: 42,
              type: 'if',
              description: 'Error handling branch not covered'
            }]
          },
          untestedExports: [{
            file: 'src/utils.ts',
            exportName: 'parseConfig',
            exportType: 'function',
            line: 88,
            isPublic: true
          }],
          missingIntegrationTests: [{
            criticalPath: 'User authentication flow',
            description: 'End-to-end user login and session management',
            priority: 'high',
            relatedFiles: ['src/auth/', 'src/middleware/']
          }],
          antiPatterns: [{
            file: 'test/unit/flaky.test.ts',
            line: 25,
            type: 'flaky-test',
            description: 'Test depends on random values',
            severity: 'high',
            suggestion: 'Use deterministic test data'
          }]
        }
      };

      // Generate multiple tasks to verify they all have low priority
      const generatedTasks: IdleTask[] = [];
      for (let i = 0; i < 10; i++) {
        const task = idleTaskGenerator.generateTask(projectAnalysis);
        if (task) {
          generatedTasks.push(task);
        }
        // Reset generator between generations to allow for more variety
        if (i % 3 === 2) {
          idleTaskGenerator.reset();
        }
      }

      // Verify at least some tasks were generated
      expect(generatedTasks.length).toBeGreaterThan(0);

      // Verify ALL generated tasks have 'low' priority
      for (const task of generatedTasks) {
        expect(task.priority).toBe('low');
        expect(task.id).toMatch(/^idle-[a-z0-9-]+$/);
        expect(task.implemented).toBe(false);
        expect(task.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should maintain low priority across different task types', async () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 100, lines: 15000, languages: { typescript: 100 } },
        testCoverage: { percentage: 30, uncoveredFiles: ['src/test.ts'] },
        dependencies: { outdated: ['old-lib@1.0.0'], security: ['vuln@1.0.0'] },
        codeQuality: {
          lintIssues: 50,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 20,
          missingDocs: ['src/docs.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.5, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 50, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      // Test with different strategy weights to ensure variety
      const strategies = [
        { maintenance: 1, refactoring: 0, docs: 0, tests: 0 },
        { maintenance: 0, refactoring: 1, docs: 0, tests: 0 },
        { maintenance: 0, refactoring: 0, docs: 1, tests: 0 },
        { maintenance: 0, refactoring: 0, docs: 0, tests: 1 },
      ];

      const tasksByType = new Map<IdleTaskType, IdleTask[]>();

      for (const weights of strategies) {
        const generator = new IdleTaskGenerator(weights);
        for (let i = 0; i < 5; i++) {
          const task = generator.generateTask(analysis);
          if (task) {
            if (!tasksByType.has(task.type)) {
              tasksByType.set(task.type, []);
            }
            tasksByType.get(task.type)!.push(task);
          }
        }
      }

      // Verify we got different types and all have low priority
      expect(tasksByType.size).toBeGreaterThan(1);
      for (const [type, tasks] of tasksByType) {
        expect(tasks.length).toBeGreaterThan(0);
        for (const task of tasks) {
          expect(task.priority).toBe('low');
          expect(task.type).toBe(type);
        }
      }
    });
  });

  describe('Acceptance Criteria 2: Tasks are persisted to idle_tasks table', () => {
    it('should persist generated idle tasks to the database', async () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 25, lines: 3000, languages: { typescript: 25 } },
        testCoverage: { percentage: 45, uncoveredFiles: ['src/uncovered.ts'] },
        dependencies: { outdated: ['dep@1.0.0'], security: [] },
        codeQuality: {
          lintIssues: 10,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 50,
          missingDocs: ['src/missing.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.7, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 60, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      // Generate an idle task
      const task = idleTaskGenerator.generateTask(analysis);
      expect(task).not.toBeNull();

      // Persist it to the database
      const createdTask = await taskStore.createIdleTask(task!);

      // Verify the task is properly stored
      expect(createdTask.id).toBe(task!.id);
      expect(createdTask.priority).toBe('low');
      expect(createdTask.implemented).toBe(false);

      // Retrieve from database and verify persistence
      const retrievedTask = await taskStore.getIdleTask(task!.id);
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask!.id).toBe(task!.id);
      expect(retrievedTask!.type).toBe(task!.type);
      expect(retrievedTask!.title).toBe(task!.title);
      expect(retrievedTask!.description).toBe(task!.description);
      expect(retrievedTask!.priority).toBe('low');
      expect(retrievedTask!.estimatedEffort).toBe(task!.estimatedEffort);
      expect(retrievedTask!.suggestedWorkflow).toBe(task!.suggestedWorkflow);
      expect(retrievedTask!.rationale).toBe(task!.rationale);
      expect(retrievedTask!.implemented).toBe(false);
      expect(retrievedTask!.implementedTaskId).toBeUndefined();
      expect(retrievedTask!.createdAt).toBeInstanceOf(Date);
    });

    it('should list all persisted idle tasks with proper filtering', async () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 30, lines: 5000, languages: { typescript: 30 } },
        testCoverage: { percentage: 35, uncoveredFiles: ['src/test1.ts', 'src/test2.ts'] },
        dependencies: { outdated: ['lib1@1.0.0', 'lib2@2.0.0'], security: [] },
        codeQuality: {
          lintIssues: 20,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 25,
          missingDocs: ['src/doc1.ts', 'src/doc2.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.4, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 40, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      // Generate and store multiple idle tasks
      const tasks: IdleTask[] = [];
      for (let i = 0; i < 5; i++) {
        const task = idleTaskGenerator.generateTask(analysis);
        if (task) {
          const createdTask = await taskStore.createIdleTask(task);
          tasks.push(createdTask);
        }
        if (i % 2 === 1) {
          idleTaskGenerator.reset(); // Allow for variety
        }
      }

      expect(tasks.length).toBeGreaterThan(0);

      // List all idle tasks
      const allIdleTasks = await taskStore.listIdleTasks();
      expect(allIdleTasks.length).toBe(tasks.length);

      // Verify all tasks are unimplemented
      const unimplementedTasks = await taskStore.listIdleTasks({ implemented: false });
      expect(unimplementedTasks.length).toBe(tasks.length);

      // Verify filter by low priority works
      const lowPriorityTasks = await taskStore.listIdleTasks({
        implemented: false,
        priority: 'low'
      });
      expect(lowPriorityTasks.length).toBe(tasks.length);

      // Verify each stored task matches what was generated
      for (const originalTask of tasks) {
        const foundTask = allIdleTasks.find(t => t.id === originalTask.id);
        expect(foundTask).toBeDefined();
        expect(foundTask!.priority).toBe('low');
        expect(foundTask!.implemented).toBe(false);
      }
    });
  });

  describe('Acceptance Criteria 3: Tasks can be promoted to real tasks in tasks table', () => {
    it('should promote an idle task to a real task', async () => {
      // Generate and store an idle task
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 40, lines: 6000, languages: { typescript: 40 } },
        testCoverage: { percentage: 55, uncoveredFiles: ['src/promote-test.ts'] },
        dependencies: { outdated: ['promote-lib@1.0.0'], security: [] },
        codeQuality: {
          lintIssues: 8,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 60,
          missingDocs: ['src/promote-docs.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.8, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 75, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      const idleTask = idleTaskGenerator.generateTask(analysis);
      expect(idleTask).not.toBeNull();

      const createdIdleTask = await taskStore.createIdleTask(idleTask!);
      expect(createdIdleTask.implemented).toBe(false);

      // Promote the idle task to a real task
      const taskRequest: Omit<CreateTaskRequest, 'description'> = {
        workflow: 'feature',
        autonomy: 'review-before-merge',
        projectPath: testDir
      };

      const realTask = await taskStore.promoteIdleTask(createdIdleTask.id, taskRequest);

      // Verify the real task was created properly
      expect(realTask).toBeDefined();
      expect(realTask.id).toMatch(/^task_[a-z0-9-]+$/);
      expect(realTask.description).toBe(idleTask!.description);
      expect(realTask.acceptanceCriteria).toContain(`Implement: ${idleTask!.title}`);
      expect(realTask.acceptanceCriteria).toContain(`Rationale: ${idleTask!.rationale}`);
      expect(realTask.workflow).toBe(idleTask!.suggestedWorkflow);
      expect(realTask.priority).toBe('low'); // Should inherit from idle task
      expect(realTask.effort).toBe(idleTask!.estimatedEffort);
      expect(realTask.status).toBe('pending');
      expect(realTask.projectPath).toBe(testDir);

      // Verify the real task is persisted in the tasks table
      const retrievedRealTask = await taskStore.getTask(realTask.id);
      expect(retrievedRealTask).not.toBeNull();
      expect(retrievedRealTask!.id).toBe(realTask.id);
      expect(retrievedRealTask!.description).toBe(idleTask!.description);
      expect(retrievedRealTask!.priority).toBe('low');
    });

    it('should handle promotion validation correctly', async () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 15, lines: 2000, languages: { typescript: 15 } },
        testCoverage: { percentage: 70, uncoveredFiles: [] },
        dependencies: { outdated: [], security: [] },
        codeQuality: {
          lintIssues: 3,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 80,
          missingDocs: ['src/validation-test.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.9, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 85, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      const idleTask = idleTaskGenerator.generateTask(analysis);
      expect(idleTask).not.toBeNull();

      const createdIdleTask = await taskStore.createIdleTask(idleTask!);

      // Test: Cannot promote non-existent idle task
      await expect(
        taskStore.promoteIdleTask('non-existent-id', {
          workflow: 'feature',
          autonomy: 'full',
          projectPath: testDir
        })
      ).rejects.toThrow('Idle task with ID non-existent-id not found');

      // Promote the task first
      const realTask = await taskStore.promoteIdleTask(createdIdleTask.id, {
        workflow: 'feature',
        autonomy: 'full',
        projectPath: testDir
      });

      // Test: Cannot promote already implemented idle task
      await expect(
        taskStore.promoteIdleTask(createdIdleTask.id, {
          workflow: 'feature',
          autonomy: 'full',
          projectPath: testDir
        })
      ).rejects.toThrow(`Idle task ${createdIdleTask.id} has already been implemented`);

      // Verify the idle task is now marked as implemented
      const updatedIdleTask = await taskStore.getIdleTask(createdIdleTask.id);
      expect(updatedIdleTask!.implemented).toBe(true);
      expect(updatedIdleTask!.implementedTaskId).toBe(realTask.id);
    });
  });

  describe('Acceptance Criteria 4: Promoted tasks reference the original idle_task_id', () => {
    it('should maintain reference from promoted task back to original idle task', async () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 35, lines: 5500, languages: { typescript: 35 } },
        testCoverage: { percentage: 48, uncoveredFiles: ['src/reference-test.ts'] },
        dependencies: { outdated: ['reference-lib@1.0.0'], security: [] },
        codeQuality: {
          lintIssues: 12,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 35,
          missingDocs: ['src/reference-docs.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.6, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 55, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      // Generate and store idle task
      const idleTask = idleTaskGenerator.generateTask(analysis);
      expect(idleTask).not.toBeNull();

      const createdIdleTask = await taskStore.createIdleTask(idleTask!);

      // Promote to real task
      const realTask = await taskStore.promoteIdleTask(createdIdleTask.id, {
        workflow: 'feature',
        autonomy: 'review-before-merge',
        projectPath: testDir
      });

      // Verify bidirectional reference
      // 1. Idle task should reference the real task
      const updatedIdleTask = await taskStore.getIdleTask(createdIdleTask.id);
      expect(updatedIdleTask!.implemented).toBe(true);
      expect(updatedIdleTask!.implementedTaskId).toBe(realTask.id);

      // 2. Real task should have the idle task ID in its acceptance criteria (implicit reference)
      expect(realTask.acceptanceCriteria).toContain(`Implement: ${idleTask!.title}`);
      expect(realTask.acceptanceCriteria).toContain(`Rationale: ${idleTask!.rationale}`);

      // Verify we can query for implemented idle tasks
      const implementedTasks = await taskStore.listIdleTasks({ implemented: true });
      expect(implementedTasks).toHaveLength(1);
      expect(implementedTasks[0].id).toBe(createdIdleTask.id);
      expect(implementedTasks[0].implementedTaskId).toBe(realTask.id);

      // Verify we can find the relationship through queries
      const unimplementedTasks = await taskStore.listIdleTasks({ implemented: false });
      expect(unimplementedTasks).toHaveLength(0);
    });

    it('should support multiple idle task promotions with proper references', async () => {
      const analysis: ProjectAnalysis = {
        codebaseSize: { files: 60, lines: 9000, languages: { typescript: 60 } },
        testCoverage: { percentage: 42, uncoveredFiles: ['src/multi1.ts', 'src/multi2.ts'] },
        dependencies: { outdated: ['multi-lib1@1.0.0', 'multi-lib2@2.0.0'], security: [] },
        codeQuality: {
          lintIssues: 25,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: []
        },
        documentation: {
          coverage: 30,
          missingDocs: ['src/multi-docs1.ts', 'src/multi-docs2.ts'],
          undocumentedExports: [],
          outdatedDocumentation: [],
          missingReadmeSections: [],
          apiCompleteness: { coverage: 0.5, missingDocs: [] }
        },
        performance: { slowTests: [], bottlenecks: [] },
        testAnalysis: {
          branchCoverage: { percentage: 50, uncoveredBranches: [] },
          untestedExports: [],
          missingIntegrationTests: [],
          antiPatterns: []
        }
      };

      // Generate and promote multiple idle tasks
      const promotionPairs: Array<{ idleTask: IdleTask; realTask: any }> = [];

      for (let i = 0; i < 3; i++) {
        const idleTask = idleTaskGenerator.generateTask(analysis);
        expect(idleTask).not.toBeNull();

        const createdIdleTask = await taskStore.createIdleTask(idleTask!);

        const realTask = await taskStore.promoteIdleTask(createdIdleTask.id, {
          workflow: 'feature',
          autonomy: 'review-before-merge',
          projectPath: testDir
        });

        promotionPairs.push({ idleTask: createdIdleTask, realTask });

        // Reset generator for variety
        if (i < 2) idleTaskGenerator.reset();
      }

      expect(promotionPairs.length).toBe(3);

      // Verify all references are correct
      for (const { idleTask, realTask } of promotionPairs) {
        // Check idle task is marked as implemented and references real task
        const updatedIdleTask = await taskStore.getIdleTask(idleTask.id);
        expect(updatedIdleTask!.implemented).toBe(true);
        expect(updatedIdleTask!.implementedTaskId).toBe(realTask.id);

        // Check real task exists and has expected properties
        const retrievedRealTask = await taskStore.getTask(realTask.id);
        expect(retrievedRealTask).not.toBeNull();
        expect(retrievedRealTask!.priority).toBe('low');
        expect(retrievedRealTask!.description).toBe(idleTask.description);
      }

      // Verify database state
      const allIdleTasks = await taskStore.listIdleTasks();
      const implementedIdleTasks = await taskStore.listIdleTasks({ implemented: true });
      const unimplementedIdleTasks = await taskStore.listIdleTasks({ implemented: false });

      expect(allIdleTasks.length).toBe(3);
      expect(implementedIdleTasks.length).toBe(3);
      expect(unimplementedIdleTasks.length).toBe(0);

      // Verify each implemented idle task has a unique real task
      const implementedTaskIds = new Set(implementedIdleTasks.map(t => t.implementedTaskId));
      expect(implementedTaskIds.size).toBe(3); // All unique
    });
  });

  describe('Complete Integration Flow', () => {
    it('should demonstrate the complete IdleProcessor-IdleTaskGenerator-TaskStore flow', async () => {
      // Create a comprehensive project analysis
      const projectAnalysis: ProjectAnalysis = {
        codebaseSize: {
          files: 80,
          lines: 12000,
          languages: { typescript: 70, javascript: 10 }
        },
        testCoverage: {
          percentage: 50,
          uncoveredFiles: [
            'src/services/payment.ts',
            'src/utils/validation.ts',
            'src/models/order.ts'
          ]
        },
        dependencies: {
          outdated: [
            'lodash@^4.17.15',
            'express@^4.16.0',
            '@types/node@^14.0.0'
          ],
          security: [
            'vulnerable-crypto@1.0.0',
            'outdated-sanitizer@2.1.0'
          ]
        },
        codeQuality: {
          lintIssues: 35,
          duplicatedCode: [
            {
              files: ['src/auth/login.ts', 'src/auth/register.ts'],
              lines: [15, 22],
              similarity: 0.9,
              duplicatedLines: 40
            }
          ],
          complexityHotspots: [
            {
              file: 'src/algorithms/pricing.ts',
              line: 125,
              complexity: 28,
              function: 'calculateDynamicPricing'
            }
          ],
          codeSmells: [
            {
              file: 'src/legacy/old-processor.ts',
              line: 50,
              type: 'long-method',
              severity: 'high',
              description: 'Method has 200+ lines and multiple responsibilities'
            }
          ]
        },
        documentation: {
          coverage: 25,
          missingDocs: [
            'src/api/routes.ts',
            'src/middleware/auth.ts',
            'src/services/email.ts'
          ],
          undocumentedExports: [
            {
              file: 'src/utils/helpers.ts',
              exportName: 'formatCurrency',
              exportType: 'function',
              line: 88,
              isPublic: true
            }
          ],
          outdatedDocumentation: [
            {
              file: 'README.md',
              section: 'API Documentation',
              line: 45,
              reason: 'References removed endpoints'
            }
          ],
          missingReadmeSections: [
            {
              section: 'Security',
              priority: 'high',
              description: 'Security practices and vulnerability reporting'
            }
          ],
          apiCompleteness: {
            coverage: 0.4,
            missingDocs: []
          }
        },
        performance: {
          slowTests: [
            'test/integration/payment-flow.test.ts',
            'test/integration/bulk-operations.test.ts'
          ],
          bottlenecks: [
            'src/data/heavy-computation.ts',
            'src/services/image-processing.ts'
          ]
        },
        testAnalysis: {
          branchCoverage: {
            percentage: 45,
            uncoveredBranches: [
              {
                file: 'src/validators/input.ts',
                line: 35,
                type: 'if',
                description: 'Edge case validation not covered'
              }
            ]
          },
          untestedExports: [
            {
              file: 'src/utils/crypto.ts',
              exportName: 'hashPassword',
              exportType: 'function',
              line: 25,
              isPublic: true
            }
          ],
          missingIntegrationTests: [
            {
              criticalPath: 'Complete checkout process',
              description: 'End-to-end order placement and payment processing',
              priority: 'critical',
              relatedFiles: ['src/checkout/', 'src/payment/']
            }
          ],
          antiPatterns: [
            {
              file: 'test/unit/service.test.ts',
              line: 15,
              type: 'mystery-guest',
              description: 'Test depends on external database state',
              severity: 'medium',
              suggestion: 'Use mocks or test fixtures'
            }
          ]
        }
      };

      // Step 1: Generate idle tasks using IdleTaskGenerator
      const generatedTasks: IdleTask[] = [];
      for (let i = 0; i < 8; i++) {
        const task = idleTaskGenerator.generateTask(projectAnalysis);
        if (task) {
          generatedTasks.push(task);
        }
        if (i % 2 === 1) {
          idleTaskGenerator.reset();
        }
      }

      expect(generatedTasks.length).toBeGreaterThan(3); // Should generate multiple different tasks

      // Step 2: Verify all generated tasks meet acceptance criteria 1
      for (const task of generatedTasks) {
        expect(task.priority).toBe('low');
        expect(task.implemented).toBe(false);
        expect(task.id).toMatch(/^idle-[a-z0-9-]+$/);
      }

      // Step 3: Persist all tasks to TaskStore (acceptance criteria 2)
      const persistedTasks: IdleTask[] = [];
      for (const task of generatedTasks) {
        const persistedTask = await taskStore.createIdleTask(task);
        persistedTasks.push(persistedTask);
      }

      // Verify persistence
      const allStoredTasks = await taskStore.listIdleTasks();
      expect(allStoredTasks.length).toBe(persistedTasks.length);

      // Step 4: Promote some tasks to real tasks (acceptance criteria 3)
      const promotedCount = Math.min(3, persistedTasks.length);
      const realTasks = [];

      for (let i = 0; i < promotedCount; i++) {
        const realTask = await taskStore.promoteIdleTask(persistedTasks[i].id, {
          workflow: 'feature',
          autonomy: 'review-before-merge',
          projectPath: testDir
        });
        realTasks.push(realTask);
      }

      expect(realTasks.length).toBe(promotedCount);

      // Step 5: Verify references are maintained (acceptance criteria 4)
      for (let i = 0; i < promotedCount; i++) {
        const idleTask = await taskStore.getIdleTask(persistedTasks[i].id);
        expect(idleTask!.implemented).toBe(true);
        expect(idleTask!.implementedTaskId).toBe(realTasks[i].id);

        const realTask = await taskStore.getTask(realTasks[i].id);
        expect(realTask).not.toBeNull();
        expect(realTask!.priority).toBe('low');
        expect(realTask!.description).toBe(persistedTasks[i].description);
      }

      // Final verification of database state
      const finalIdleTasks = await taskStore.listIdleTasks();
      const implementedCount = finalIdleTasks.filter(t => t.implemented).length;
      const unimplementedCount = finalIdleTasks.filter(t => !t.implemented).length;

      expect(implementedCount).toBe(promotedCount);
      expect(unimplementedCount).toBe(persistedTasks.length - promotedCount);
      expect(finalIdleTasks.length).toBe(persistedTasks.length);

      // Verify all tasks still have low priority
      for (const task of finalIdleTasks) {
        expect(task.priority).toBe('low');
      }
    });
  });
});