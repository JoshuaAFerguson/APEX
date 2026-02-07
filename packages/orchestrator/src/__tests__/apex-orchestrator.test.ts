import { describe, it as test, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, OrchestratorOptions, OrchestratorEvents } from '../index.js';
import { Task, TaskStatus, ApexConfig, CreateTaskRequest } from '@apexcli/core';

describe('ApexOrchestrator', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let defaultOptions: OrchestratorOptions;

  beforeAll(() => {
    // Mock the Claude Agent SDK to prevent actual API calls during tests
    vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
      query: vi.fn().mockResolvedValue({
        messages: ['Mock agent response'],
        inputTokens: 100,
        outputTokens: 50
      })
    }));
  });

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));

    // Set up default orchestrator options
    defaultOptions = {
      projectPath: testDir,
      apiUrl: 'http://localhost:3000'
    };

    // Create minimal project structure
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    await fs.mkdir(path.join(testDir, '.apex', 'agents'), { recursive: true });
    await fs.mkdir(path.join(testDir, '.apex', 'workflows'), { recursive: true });

    // Write minimal config file
    const minimalConfig: ApexConfig = {
      version: '0.1.0',
      project: {
        name: 'test-project',
        language: 'typescript',
        framework: 'node'
      },
      autonomy: {
        level: 'supervised',
        gates: [],
        stageOverrides: {},
        agentOverrides: {}
      },
      agents: {
        enabled: ['developer'],
        disabled: []
      },
      workflows: {
        enabled: ['feature'],
        disabled: []
      },
      limits: {
        maxTokensPerTask: 50000,
        maxCostPerTask: 5.0,
        maxExecutionTime: 1800000,
        maxConcurrentTasks: 3,
        maxFileChanges: 50
      },
      git: {
        commitAfterTask: false,
        pushAfterTask: false,
        createPR: 'never',
        commitFormat: 'conventional'
      },
      workspace: {
        strategy: 'local',
        cleanupOnComplete: false,
        preserveOnFailure: false
      }
    };

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "0.1.0"
project:
  name: "test-project"
  language: "typescript"
  framework: "node"
autonomy:
  level: "supervised"
  gates: []
agents:
  enabled: ["developer"]
  disabled: []
workflows:
  enabled: ["feature"]
  disabled: []
limits:
  maxTokensPerTask: 50000
  maxCostPerTask: 5.0
  maxExecutionTime: 1800000
  maxConcurrentTasks: 3
  maxFileChanges: 50
git:
  commitAfterTask: false
  pushAfterTask: false
  createPR: "never"
  commitFormat: "conventional"
workspace:
  strategy: "local"
  cleanupOnComplete: false
  preserveOnFailure: false`
    );

    // Write minimal agent definition
    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      `# Developer Agent

You are a software developer.

## Role
Write code and implement features.

## Instructions
1. Write clean, maintainable code
2. Follow best practices
3. Test your implementations`
    );

    // Write minimal workflow definition
    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'feature.yaml'),
      `name: "feature"
description: "Feature development workflow"
stages:
  - name: "implementation"
    agent: "developer"
    description: "Implement the feature"`
    );

    orchestrator = new ApexOrchestrator(defaultOptions);
  });

  afterEach(async () => {
    // Clean up orchestrator if it was initialized
    if (orchestrator && orchestrator['initialized']) {
      orchestrator.close();
    }

    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    test('should create ApexOrchestrator with valid options', () => {
      const options: OrchestratorOptions = {
        projectPath: '/test/path',
        apiUrl: 'http://localhost:3000'
      };

      const orchestratorInstance = new ApexOrchestrator(options);

      expect(orchestratorInstance).toBeInstanceOf(ApexOrchestrator);
      expect(orchestratorInstance['projectPath']).toBe('/test/path');
      expect(orchestratorInstance['apiUrl']).toBe('http://localhost:3000');
    });

    test('should use default API URL when not provided', () => {
      const options: OrchestratorOptions = {
        projectPath: '/test/path'
      };

      const orchestratorInstance = new ApexOrchestrator(options);

      expect(orchestratorInstance['apiUrl']).toBe('http://localhost:3000');
    });

    test('should accept custom autonomy enforcer', () => {
      const mockAutonomyEnforcer = {} as any;
      const options: OrchestratorOptions = {
        projectPath: '/test/path',
        autonomyEnforcer: mockAutonomyEnforcer
      };

      const orchestratorInstance = new ApexOrchestrator(options);

      expect(orchestratorInstance['options'].autonomyEnforcer).toBe(mockAutonomyEnforcer);
    });

    test('should accept custom policy engine', () => {
      const mockPolicyEngine = {} as any;
      const options: OrchestratorOptions = {
        projectPath: '/test/path',
        policyEngine: mockPolicyEngine
      };

      const orchestratorInstance = new ApexOrchestrator(options);

      expect(orchestratorInstance['policyEngine']).toBe(mockPolicyEngine);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid project structure', async () => {
      await expect(orchestrator.initialize()).resolves.toBeUndefined();
      expect(orchestrator['initialized']).toBe(true);
    });

    test('should initialize with fallback config when config file is missing', async () => {
      // Remove config file
      await fs.unlink(path.join(testDir, '.apex', 'config.yaml'));

      await expect(orchestrator.initialize()).resolves.toBeUndefined();
      expect(orchestrator['initialized']).toBe(true);
    });

    test('should not reinitialize if already initialized', async () => {
      await orchestrator.initialize();
      const firstInitTime = Date.now();

      await orchestrator.initialize();
      const secondInitTime = Date.now();

      expect(secondInitTime - firstInitTime).toBeLessThan(100); // Should be immediate
    });

    test('should load configuration during initialization', async () => {
      await orchestrator.initialize();

      const config = await orchestrator.getConfig();
      expect(config).toBeDefined();
      expect(config.project.name).toBe('test-project');
    });

    test('should load agents during initialization', async () => {
      await orchestrator.initialize();

      const agents = await orchestrator.getAgents();
      expect(agents).toBeDefined();
      expect(agents.developer).toBeDefined();
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should create a new task', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Test task',
        workflow: 'feature'
      };

      const taskId = await orchestrator.createTask(taskRequest);

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      const task = await orchestrator.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.description).toBe('Test task');
      expect(task?.workflow).toBe('feature');
    });

    test('should create task with all options', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Complex test task',
        acceptanceCriteria: 'Should work correctly',
        workflow: 'feature',
        autonomy: 'autonomous',
        priority: 'high',
        effort: 'large',
        maxRetries: 5
      };

      const taskId = await orchestrator.createTask(taskRequest);
      const task = await orchestrator.getTask(taskId);

      expect(task?.acceptanceCriteria).toBe('Should work correctly');
      expect(task?.autonomy).toBe('autonomous');
      expect(task?.priority).toBe('high');
      expect(task?.effort).toBe('large');
      expect(task?.maxRetries).toBe(5);
    });

    test('should get task by ID', async () => {
      const taskRequest: CreateTaskRequest = {
        description: 'Get task test',
        workflow: 'feature'
      };

      const taskId = await orchestrator.createTask(taskRequest);
      const task = await orchestrator.getTask(taskId);

      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
      expect(task?.description).toBe('Get task test');
    });

    test('should return null for non-existent task', async () => {
      const task = await orchestrator.getTask('non-existent-id');
      expect(task).toBeNull();
    });

    test('should list tasks', async () => {
      // Create multiple tasks
      const task1Id = await orchestrator.createTask({
        description: 'Task 1',
        workflow: 'feature'
      });

      const task2Id = await orchestrator.createTask({
        description: 'Task 2',
        workflow: 'feature'
      });

      const tasks = await orchestrator.listTasks();

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      const taskIds = tasks.map(t => t.id);
      expect(taskIds).toContain(task1Id);
      expect(taskIds).toContain(task2Id);
    });

    test('should get task statistics', async () => {
      await orchestrator.createTask({
        description: 'Stats task',
        workflow: 'feature'
      });

      const stats = await orchestrator.getTaskStats();

      expect(stats).toBeDefined();
      expect(stats.byStatus).toBeDefined();
      expect(stats.totalCost).toBeGreaterThanOrEqual(0);
      expect(stats.totalTokens).toBeGreaterThanOrEqual(0);
    });

    test('should count tasks', async () => {
      await orchestrator.createTask({
        description: 'Count task',
        workflow: 'feature'
      });

      const count = await orchestrator.countTasks();

      expect(count).toBeDefined();
      expect(count.total).toBeGreaterThan(0);
      expect(count.byStatus).toBeDefined();
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should execute task and handle completion', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Execution test task',
        workflow: 'feature'
      });

      // Mock the Claude SDK query to simulate task completion
      const mockQuery = vi.fn().mockResolvedValue({
        messages: ['### Stage Summary: implementation\n**Status**: completed\n**Summary**: Task completed successfully'],
        inputTokens: 100,
        outputTokens: 50
      });

      // Replace the query function temporarily
      const originalQuery = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(originalQuery.query).mockImplementation(mockQuery);

      try {
        await orchestrator.executeTask(taskId);

        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('completed');
      } finally {
        // Restore original query function
        vi.restoreAllMocks();
      }
    });

    test('should handle task execution errors gracefully', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Error test task',
        workflow: 'feature'
      });

      // Mock the Claude SDK to throw an error
      const mockQuery = vi.fn().mockRejectedValue(new Error('Test execution error'));
      const originalQuery = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(originalQuery.query).mockImplementation(mockQuery);

      try {
        await expect(orchestrator.executeTask(taskId)).rejects.toThrow();

        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('failed');
      } finally {
        vi.restoreAllMocks();
      }
    });

    test('should track running tasks', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Running task test',
        workflow: 'feature'
      });

      expect(orchestrator.getRunningTaskCount()).toBe(0);
      expect(orchestrator.isTaskRunning(taskId)).toBe(false);

      // Start task execution in background
      const executionPromise = orchestrator.executeTask(taskId);

      // Check if task is tracked as running
      expect(orchestrator.isTaskRunning(taskId)).toBe(true);
      expect(orchestrator.getRunningTaskCount()).toBe(1);
      expect(orchestrator.getRunningTaskIds()).toContain(taskId);

      // Wait for completion
      await executionPromise;
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should emit task:created event', async () => {
      const eventPromise = new Promise<Task>((resolve) => {
        orchestrator.once('task:created', resolve);
      });

      const taskId = await orchestrator.createTask({
        description: 'Event test task',
        workflow: 'feature'
      });

      const emittedTask = await eventPromise;
      expect(emittedTask.id).toBe(taskId);
      expect(emittedTask.description).toBe('Event test task');
    });

    test('should emit task:started event on execution', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Started event test',
        workflow: 'feature'
      });

      const eventPromise = new Promise<string>((resolve) => {
        orchestrator.once('task:started', resolve);
      });

      orchestrator.executeTask(taskId).catch(() => {
        // Ignore execution errors for this test
      });

      const emittedTaskId = await eventPromise;
      expect(emittedTaskId).toBe(taskId);
    });

    test('should emit task:failed event on execution error', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Failed event test',
        workflow: 'feature'
      });

      const eventPromise = new Promise<{ taskId: string; error: string }>((resolve) => {
        orchestrator.once('task:failed', resolve);
      });

      // Mock execution to fail
      const mockQuery = vi.fn().mockRejectedValue(new Error('Test failure'));
      const originalQuery = await import('@anthropic-ai/claude-agent-sdk');
      vi.mocked(originalQuery.query).mockImplementation(mockQuery);

      try {
        await orchestrator.executeTask(taskId).catch(() => {
          // Expected to fail
        });

        const emittedData = await eventPromise;
        expect(emittedData.taskId).toBe(taskId);
        expect(emittedData.error).toContain('Test failure');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('Configuration and State', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should get current configuration', async () => {
      const config = await orchestrator.getConfig();

      expect(config).toBeDefined();
      expect(config.version).toBe('0.1.0');
      expect(config.project.name).toBe('test-project');
      expect(config.autonomy.level).toBe('supervised');
    });

    test('should get available agents', async () => {
      const agents = await orchestrator.getAgents();

      expect(agents).toBeDefined();
      expect(agents.developer).toBeDefined();
      expect(agents.developer.name).toBe('developer');
    });

    test('should handle current task tracking', async () => {
      // Initially no current task
      const initialTask = await orchestrator.getCurrentTask();
      expect(initialTask).toBeNull();
    });

    test('should get linter service', async () => {
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should throw error when accessing uninitialized orchestrator', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator(defaultOptions);

      await expect(uninitializedOrchestrator.createTask({
        description: 'Test',
        workflow: 'feature'
      })).rejects.toThrow();
    });

    test('should handle invalid workflow gracefully', async () => {
      await orchestrator.initialize();

      await expect(orchestrator.createTask({
        description: 'Invalid workflow test',
        workflow: 'non-existent-workflow'
      })).rejects.toThrow();
    });

    test('should handle file system errors during initialization', async () => {
      // Create orchestrator with non-existent path
      const invalidOrchestrator = new ApexOrchestrator({
        projectPath: '/non/existent/path'
      });

      // Should still initialize with fallback config
      await expect(invalidOrchestrator.initialize()).resolves.toBeUndefined();
      invalidOrchestrator.close();
    });
  });

  describe('Task Runner', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should start and stop task runner', async () => {
      expect(orchestrator.isTaskRunnerActive()).toBe(false);

      await orchestrator.startTaskRunner({ pollIntervalMs: 100 });
      expect(orchestrator.isTaskRunnerActive()).toBe(true);

      orchestrator.stopTaskRunner();
      expect(orchestrator.isTaskRunnerActive()).toBe(false);
    });

    test('should get max concurrent tasks limit', () => {
      const limit = orchestrator.getMaxConcurrentTasks();
      expect(limit).toBe(3); // From our test config
    });

    test('should queue task for execution', async () => {
      const taskId = await orchestrator.createTask({
        description: 'Queue test task',
        workflow: 'feature'
      });

      await orchestrator.queueTask(taskId);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('pending');
    });
  });

  describe('JSDoc Examples', () => {
    test('should work as documented in class JSDoc example', async () => {
      // This tests the example from the class-level JSDoc
      const testOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await testOrchestrator.initialize();

      // Create a task similar to the example
      const taskId = await testOrchestrator.createTask({
        description: 'Add user authentication',
        workflow: 'feature'
      });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      const task = await testOrchestrator.getTask(taskId);
      expect(task?.description).toBe('Add user authentication');

      testOrchestrator.close();
    });

    test('should work as documented in initialize method JSDoc example', async () => {
      // This tests the example from the initialize method JSDoc
      const testOrchestrator = new ApexOrchestrator({ projectPath: testDir });
      await testOrchestrator.initialize();

      // After initialization, orchestrator should be ready
      expect(testOrchestrator['initialized']).toBe(true);

      testOrchestrator.close();
    });
  });

  describe('Resource Cleanup', () => {
    test('should close orchestrator and cleanup resources', async () => {
      await orchestrator.initialize();

      // Verify orchestrator is initialized
      expect(orchestrator['initialized']).toBe(true);

      // Close should not throw
      expect(() => orchestrator.close()).not.toThrow();
    });

    test('should handle close when not initialized', () => {
      const uninitializedOrchestrator = new ApexOrchestrator(defaultOptions);

      // Should not throw even if not initialized
      expect(() => uninitializedOrchestrator.close()).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should handle full task lifecycle', async () => {
      // Create task
      const taskId = await orchestrator.createTask({
        description: 'Lifecycle test task',
        acceptanceCriteria: 'Should complete successfully',
        workflow: 'feature',
        priority: 'normal'
      });

      // Verify task creation
      const createdTask = await orchestrator.getTask(taskId);
      expect(createdTask).toBeDefined();
      expect(createdTask?.status).toBe('pending');

      // Queue task
      await orchestrator.queueTask(taskId);

      // Verify task is queued
      const queuedTask = await orchestrator.getTask(taskId);
      expect(queuedTask?.status).toBe('pending');

      // Task should exist in task list
      const tasks = await orchestrator.listTasks();
      expect(tasks.some(t => t.id === taskId)).toBe(true);
    });

    test('should handle multiple tasks concurrently', async () => {
      const task1Id = await orchestrator.createTask({
        description: 'Concurrent task 1',
        workflow: 'feature'
      });

      const task2Id = await orchestrator.createTask({
        description: 'Concurrent task 2',
        workflow: 'feature'
      });

      // Both tasks should be created successfully
      const task1 = await orchestrator.getTask(task1Id);
      const task2 = await orchestrator.getTask(task2Id);

      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      expect(task1?.id).not.toBe(task2?.id);
    });
  });
});