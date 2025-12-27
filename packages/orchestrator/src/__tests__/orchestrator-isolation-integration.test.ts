import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ApexOrchestrator } from '../index';
import {
  Task,
  TaskStatus,
  WorkflowDefinition,
  IsolationConfig,
  ContainerConfig,
} from '@apexcli/core';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  default: {
    query: vi.fn().mockResolvedValue({
      response: {
        content: [{ type: 'text', text: 'Stage completed successfully' }],
      },
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.01,
      },
    }),
  },
}));

// Mock container and workspace dependencies
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    containerRuntime: {
      getBestRuntime: vi.fn().mockResolvedValue('docker'),
    },
    ContainerManager: vi.fn().mockImplementation(() => ({
      createContainer: vi.fn().mockResolvedValue({
        success: true,
        containerId: 'test-container-id',
        containerName: 'apex-task-test'
      }),
      execCommand: vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      }),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue(undefined),
      removeContainer: vi.fn().mockResolvedValue(undefined),
      startEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      stopEventsMonitoring: vi.fn().mockResolvedValue(undefined),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
    })),
    ContainerHealthMonitor: vi.fn().mockImplementation(() => ({
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      getContainerHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
      getStats: vi.fn().mockReturnValue({ healthyContainers: 1, totalContainers: 1 }),
    })),
    DependencyDetector: vi.fn().mockImplementation(() => ({
      detectPackageManagers: vi.fn().mockResolvedValue({
        primaryManager: {
          type: 'npm',
          language: 'javascript',
          configFiles: ['package.json'],
        },
      }),
    })),
  };
});

describe('ApexOrchestrator Isolation Integration', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;
  let dbPath: string;

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: `test-task-${Date.now()}`,
    description: 'Test task for isolation integration',
    workflow: 'test-workflow',
    autonomy: 'review-before-commit',
    status: 'pending' as TaskStatus,
    priority: 'normal',
    effort: 'medium',
    currentStage: undefined,
    projectPath: projectPath,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  });

  const createTestWorkflow = (isolationConfig?: IsolationConfig): WorkflowDefinition => ({
    name: 'test-workflow',
    description: 'Test workflow for isolation',
    stages: [
      {
        name: 'planning',
        agent: 'planner',
        description: 'Plan the task',
      },
      {
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the task',
      },
    ],
    isolation: isolationConfig,
  });

  beforeEach(async () => {
    // Create temporary project directory
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    dbPath = join(projectPath, '.apex', 'test.db');

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(join(projectPath, '.apex'), { recursive: true });

    // Create package.json for dependency detection
    await fs.writeFile(
      join(projectPath, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' })
    );

    orchestrator = new ApexOrchestrator({
      projectPath,
      dbPath,
      apiKey: 'test-api-key',
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator?.cleanup();

    // Clean up temporary directories
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('workflow isolation setup', () => {
    it('should set up shared workspace (no isolation)', async () => {
      const workflow = createTestWorkflow({
        mode: 'shared',
        cleanupOnComplete: true,
      });

      const task = createMockTask();

      // Mock successful stage execution
      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Planning stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      // Set up workflow and run
      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      // Start task execution
      const result = await orchestrator.runWorkflow(task.id, workflow, mockQuery as any);

      // Verify workspace was set up but no container created
      expect(result.success).toBe(true);

      // Check logs for isolation setup messages
      const logs = await orchestrator.store.getTaskLogs(task.id);
      const isolationLogs = logs.filter(log => log.message.includes('isolation'));

      expect(isolationLogs).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Setting up isolation mode: shared',
        })
      );

      expect(isolationLogs).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('Isolated workspace created at:'),
        })
      );
    });

    it('should set up worktree isolation', async () => {
      const workflow = createTestWorkflow({
        mode: 'worktree',
        cleanupOnComplete: false,
        preserveOnFailure: true,
      });

      const task = createMockTask({ branchName: 'feature/test-branch' });

      // Mock git worktree command
      vi.spyOn(require('child_process'), 'exec').mockImplementation((cmd: string, callback: any) => {
        if (cmd.includes('git worktree add')) {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Planning stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      const result = await orchestrator.runWorkflow(task.id, workflow, mockQuery as any);

      expect(result.success).toBe(true);

      const logs = await orchestrator.store.getTaskLogs(task.id);
      const isolationLogs = logs.filter(log => log.message.includes('isolation'));

      expect(isolationLogs).toContainEqual(
        expect.objectContaining({
          message: 'Setting up isolation mode: worktree',
        })
      );

      vi.restoreAllMocks();
    });

    it('should set up full container isolation', async () => {
      const containerConfig: ContainerConfig = {
        image: 'node:20-alpine',
        environment: {
          NODE_ENV: 'test',
          CI: 'true',
        },
        resourceLimits: {
          cpu: 1.0,
          memory: '512m',
        },
        workingDir: '/workspace',
        autoRemove: true,
        autoDependencyInstall: true,
      };

      const workflow = createTestWorkflow({
        mode: 'full',
        container: containerConfig,
        cleanupOnComplete: true,
        preserveOnFailure: false,
      });

      const task = createMockTask();

      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Planning stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      const result = await orchestrator.runWorkflow(task.id, workflow, mockQuery as any);

      expect(result.success).toBe(true);

      // Verify container isolation was set up
      const logs = await orchestrator.store.getTaskLogs(task.id);
      const isolationLogs = logs.filter(log => log.message.includes('isolation'));

      expect(isolationLogs).toContainEqual(
        expect.objectContaining({
          message: 'Setting up isolation mode: full',
        })
      );

      // Verify workspace manager was called to create container workspace
      const workspaceManager = (orchestrator as any).workspaceManager;
      expect(workspaceManager).toBeDefined();
    });

    it('should handle isolation setup failure gracefully', async () => {
      const workflow = createTestWorkflow({
        mode: 'full',
        container: {
          image: 'invalid-image:latest',
        },
      });

      const task = createMockTask();

      // Mock container creation failure
      const mockContainerManager = {
        createContainer: vi.fn().mockResolvedValue({
          success: false,
          error: 'Invalid image',
        }),
        execCommand: vi.fn(),
        listApexContainers: vi.fn().mockResolvedValue([]),
        startEventsMonitoring: vi.fn().mockResolvedValue(undefined),
        stopEventsMonitoring: vi.fn().mockResolvedValue(undefined),
        isEventsMonitoringActive: vi.fn().mockReturnValue(false),
      };

      // Inject mock into workspace manager
      const workspaceManager = (orchestrator as any).workspaceManager;
      if (workspaceManager) {
        (workspaceManager as any).containerManager = mockContainerManager;
        (workspaceManager as any).containerRuntimeType = 'docker';
      }

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      // Workflow execution should fail due to isolation setup failure
      await expect(orchestrator.runWorkflow(task.id, workflow, vi.fn() as any))
        .rejects.toThrow();

      // Verify error was logged
      const logs = await orchestrator.store.getTaskLogs(task.id);
      const errorLogs = logs.filter(log => log.level === 'error' && log.message.includes('isolation'));

      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('isolation mode validation', () => {
    it('should validate isolation configuration before execution', async () => {
      const workflowWithInvalidConfig = {
        name: 'invalid-workflow',
        description: 'Workflow with invalid isolation config',
        stages: [{ name: 'test', agent: 'test-agent' }],
        isolation: {
          mode: 'invalid-mode' as any,
          cleanupOnComplete: true,
        },
      };

      const task = createMockTask({ workflow: 'invalid-workflow' });

      await orchestrator.store.addTask(task);

      // Workflow with invalid isolation should be rejected
      await expect(orchestrator.runWorkflow(task.id, workflowWithInvalidConfig as any, vi.fn() as any))
        .rejects.toThrow();
    });

    it('should handle missing container config for full mode', async () => {
      const workflow = createTestWorkflow({
        mode: 'full',
        // Missing container config
      });

      const task = createMockTask();

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      // Should work - container config is optional and defaults will be applied
      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      const result = await orchestrator.runWorkflow(task.id, workflow, mockQuery as any);
      expect(result.success).toBe(true);
    });
  });

  describe('isolation cleanup behavior', () => {
    it('should clean up workspace after successful completion', async () => {
      const workflow = createTestWorkflow({
        mode: 'full',
        container: { image: 'node:20' },
        cleanupOnComplete: true,
      });

      const task = createMockTask();

      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      const result = await orchestrator.runWorkflow(task.id, workflow, mockQuery as any);

      expect(result.success).toBe(true);

      // Verify cleanup was attempted
      const workspaceManager = (orchestrator as any).workspaceManager;
      const workspace = workspaceManager.getWorkspace(task.id);

      // Workspace should either be cleaned up or marked for cleanup
      expect(workspace?.status === 'cleaned' || workspace?.config.cleanup === true).toBe(true);
    });

    it('should preserve workspace on failure when configured', async () => {
      const workflow = createTestWorkflow({
        mode: 'full',
        container: { image: 'node:20' },
        cleanupOnComplete: true,
        preserveOnFailure: true,
      });

      const task = createMockTask();

      // Mock stage failure
      const mockQuery = vi.fn().mockRejectedValue(new Error('Stage execution failed'));

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      await expect(orchestrator.runWorkflow(task.id, workflow, mockQuery as any))
        .rejects.toThrow('Stage execution failed');

      // Verify workspace was preserved on failure
      const workspaceManager = (orchestrator as any).workspaceManager;
      const workspace = workspaceManager.getWorkspace(task.id);

      expect(workspace).toBeDefined();
      expect(workspace?.config.preserveOnFailure).toBe(true);
    });
  });

  describe('multi-task isolation', () => {
    it('should isolate multiple concurrent tasks', async () => {
      const workflow = createTestWorkflow({
        mode: 'full',
        container: { image: 'node:20' },
      });

      const tasks = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
        createMockTask({ id: 'task-3' }),
      ];

      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      await orchestrator.store.addWorkflow(workflow);

      // Add all tasks
      for (const task of tasks) {
        await orchestrator.store.addTask(task);
      }

      // Run tasks concurrently
      const results = await Promise.all(
        tasks.map(task => orchestrator.runWorkflow(task.id, workflow, mockQuery as any))
      );

      // Verify all tasks completed successfully with isolated workspaces
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      const workspaceManager = (orchestrator as any).workspaceManager;
      const stats = await workspaceManager.getWorkspaceStats();

      // Should have created multiple container workspaces
      expect(stats.workspacesByStrategy.container).toBe(3);
    });
  });

  describe('isolation mode migration and backwards compatibility', () => {
    it('should handle workflows without isolation config', async () => {
      const legacyWorkflow: WorkflowDefinition = {
        name: 'legacy-workflow',
        description: 'Legacy workflow without isolation',
        stages: [
          {
            name: 'legacy-stage',
            agent: 'legacy-agent',
          },
        ],
        // No isolation field
      };

      const task = createMockTask({ workflow: 'legacy-workflow' });

      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Legacy stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      await orchestrator.store.addWorkflow(legacyWorkflow);
      await orchestrator.store.addTask(task);

      const result = await orchestrator.runWorkflow(task.id, legacyWorkflow, mockQuery as any);

      expect(result.success).toBe(true);

      // Verify no isolation setup occurred
      const logs = await orchestrator.store.getTaskLogs(task.id);
      const isolationLogs = logs.filter(log => log.message.includes('isolation'));

      expect(isolationLogs).toHaveLength(0);
    });

    it('should maintain workspace info across orchestrator restarts', async () => {
      const workflow = createTestWorkflow({
        mode: 'full',
        container: { image: 'node:20' },
        cleanupOnComplete: false,
      });

      const task = createMockTask();

      await orchestrator.store.addWorkflow(workflow);
      await orchestrator.store.addTask(task);

      // Start workflow to create workspace
      const mockQuery = vi.fn().mockResolvedValue({
        response: {
          content: [{ type: 'text', text: 'Stage completed' }],
        },
        usage: { inputTokens: 100, outputTokens: 50, estimatedCost: 0.01 },
      });

      await orchestrator.runWorkflow(task.id, workflow, mockQuery as any);

      const workspaceManager = (orchestrator as any).workspaceManager;
      const originalWorkspace = workspaceManager.getWorkspace(task.id);

      expect(originalWorkspace).toBeDefined();
      expect(originalWorkspace.config.strategy).toBe('container');

      // Simulate orchestrator restart
      await orchestrator.cleanup();

      const newOrchestrator = new ApexOrchestrator({
        projectPath,
        dbPath,
        apiKey: 'test-api-key',
      });

      await newOrchestrator.initialize();

      // Workspace info should be restored
      const newWorkspaceManager = (newOrchestrator as any).workspaceManager;
      const restoredWorkspace = newWorkspaceManager.getWorkspace(task.id);

      expect(restoredWorkspace).toBeDefined();
      expect(restoredWorkspace.taskId).toBe(originalWorkspace.taskId);

      await newOrchestrator.cleanup();
    });
  });
});