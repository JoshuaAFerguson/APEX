import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import { WorkspaceManager } from './workspace-manager';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { WorkflowDefinition, WorkflowStage, AgentDefinition } from '@apexcli/core';

// Mock the query function
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Container Execution Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let workspaceManager: WorkspaceManager;

  beforeEach(async () => {
    const tempDir = '/tmp/apex-test-' + Math.random();

    store = new TaskStore(':memory:');
    workspaceManager = new WorkspaceManager({
      projectPath: tempDir,
      defaultStrategy: 'isolated',
    });

    orchestrator = new ApexOrchestrator(
      { path: tempDir },
      {
        limits: { maxTokens: 100000, maxCost: 10, maxTurns: 30 },
        autonomy: { taskDecomposition: { enable: false, maxSubtasks: 3, autoApproval: false } },
        agents: [],
        workflows: [],
      },
      store,
      workspaceManager
    );

    // Mock query to return simple response
    (query as any).mockImplementation(async function* () {
      yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
    });
  });

  describe('WorkspaceManager Integration', () => {
    it('should properly integrate with WorkspaceManager for container workspaces', async () => {
      const task = await orchestrator.createTask({
        description: 'Integration test with real WorkspaceManager',
      });

      // Create a container workspace through WorkspaceManager
      const workspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'container',
        baseImage: 'node:18-alpine',
      });

      // Mock the query function to capture options
      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Integration test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'integration-test-workflow',
        description: 'Integration test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Execute stage with real WorkspaceManager interaction
      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Verify proper integration
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.options.cwd).toBe(workspace.workspacePath);

      // Get the actual workspace info to verify container ID
      const workspaceInfo = workspaceManager.getWorkspace(task.id);
      if (workspaceInfo?.containerId) {
        expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBe(workspaceInfo.containerId);
      }
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe(workspace.workspacePath);

      // Cleanup
      await workspaceManager.cleanupWorkspace(task.id);
    });

    it('should handle workspace lifecycle during task execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Workspace lifecycle test',
      });

      // Initially no workspace exists
      expect(workspaceManager.getWorkspace(task.id)).toBeNull();

      // Create workspace
      const workspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'isolated',
      });

      expect(workspaceManager.getWorkspace(task.id)).toBeTruthy();

      // Mock query to track calls
      const queryCalls: any[] = [];
      (query as any).mockImplementation(async function* (opts: any) {
        queryCalls.push(opts);
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'lifecycle-test-workflow',
        description: 'Workspace lifecycle test workflow',
        stages: [
          { name: 'stage1', agent: 'developer', dependencies: [] },
          { name: 'stage2', agent: 'developer', dependencies: ['stage1'] },
        ],
      };

      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Execute multiple stages
      for (const stageConfig of workflow.stages) {
        await (orchestrator as any).executeWorkflowStage(task, stageConfig, agent, workflow, new Map());
      }

      // Verify both stages used the same workspace
      expect(queryCalls).toHaveLength(2);
      expect(queryCalls[0].options.cwd).toBe(workspace.workspacePath);
      expect(queryCalls[1].options.cwd).toBe(workspace.workspacePath);

      // Cleanup
      await workspaceManager.cleanupWorkspace(task.id);
      expect(workspaceManager.getWorkspace(task.id)).toBeNull();
    });

    it('should handle workspace strategy changes during execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Workspace strategy change test',
      });

      // Start with isolated workspace
      const isolatedWorkspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'isolated',
      });

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'strategy-change-workflow',
        description: 'Strategy change test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Execute with isolated workspace
      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      expect(capturedOptions.options.cwd).toBe(isolatedWorkspace.workspacePath);
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe(isolatedWorkspace.workspacePath);

      // Cleanup isolated workspace
      await workspaceManager.cleanupWorkspace(task.id);

      // Create container workspace
      const containerWorkspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'container',
        baseImage: 'node:18-alpine',
      });

      // Execute with container workspace
      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      expect(capturedOptions.options.cwd).toBe(containerWorkspace.workspacePath);
      const containerInfo = workspaceManager.getWorkspace(task.id);
      if (containerInfo?.containerId) {
        expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBe(containerInfo.containerId);
      }
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBe(containerWorkspace.workspacePath);

      // Cleanup
      await workspaceManager.cleanupWorkspace(task.id);
    });

    it('should handle concurrent workspace operations', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({ description: 'Concurrent test task 1' }),
        orchestrator.createTask({ description: 'Concurrent test task 2' }),
        orchestrator.createTask({ description: 'Concurrent test task 3' }),
      ]);

      // Create workspaces concurrently
      const workspaces = await Promise.all(
        tasks.map((task, index) =>
          workspaceManager.createWorkspace(task.id, {
            strategy: index % 2 === 0 ? 'isolated' : 'container',
            ...(index % 2 === 1 && { baseImage: 'node:18-alpine' }),
          })
        )
      );

      // Track query calls for each task
      const queryCallsByTask = new Map<string, any[]>();
      (query as any).mockImplementation(async function* (opts: any) {
        const taskId = opts.options.env.APEX_TASK_ID;
        if (!queryCallsByTask.has(taskId)) {
          queryCallsByTask.set(taskId, []);
        }
        queryCallsByTask.get(taskId)!.push(opts);
        yield { type: 'assistant', message: { content: [{ type: 'text', text: `Response for ${taskId}` }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'concurrent-test-workflow',
        description: 'Concurrent test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Execute stages concurrently
      await Promise.all(
        tasks.map(task =>
          (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map())
        )
      );

      // Verify each task used its own workspace
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const workspace = workspaces[i];
        const calls = queryCallsByTask.get(task.id);

        expect(calls).toHaveLength(1);
        expect(calls![0].options.cwd).toBe(workspace.workspacePath);
        expect(calls![0].options.env.APEX_TASK_ID).toBe(task.id);
        expect(calls![0].options.env.APEX_WORKSPACE_PATH).toBe(workspace.workspacePath);

        // Check container ID for container workspaces
        if (i % 2 === 1) { // Container workspaces
          const workspaceInfo = workspaceManager.getWorkspace(task.id);
          if (workspaceInfo?.containerId) {
            expect(calls![0].options.env.APEX_CONTAINER_ID).toBe(workspaceInfo.containerId);
          }
        } else { // Isolated workspaces
          expect(calls![0].options.env.APEX_CONTAINER_ID).toBeUndefined();
        }
      }

      // Cleanup all workspaces
      await Promise.all(tasks.map(task => workspaceManager.cleanupWorkspace(task.id)));
    });
  });

  describe('Environment Variable Propagation', () => {
    it('should properly propagate all APEX environment variables in container context', async () => {
      const task = await orchestrator.createTask({
        description: 'Environment variable propagation test',
        branchName: 'test-branch',
      });

      const workspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'container',
        baseImage: 'node:18-alpine',
      });

      let capturedEnv: Record<string, any>;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedEnv = opts.options.env;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'env-test-workflow',
        description: 'Environment test workflow',
        stages: [{ name: 'env-test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'env-test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Verify all APEX environment variables are set correctly
      expect(capturedEnv.APEX_TASK_ID).toBe(task.id);
      expect(capturedEnv.APEX_PROJECT).toBe((orchestrator as any).projectPath);
      expect(capturedEnv.APEX_BRANCH).toBe('test-branch');
      expect(capturedEnv.APEX_STAGE).toBe('env-test-stage');
      expect(capturedEnv.APEX_AGENT).toBe('developer');
      expect(capturedEnv.APEX_WORKSPACE_PATH).toBe(workspace.workspacePath);

      const workspaceInfo = workspaceManager.getWorkspace(task.id);
      if (workspaceInfo?.containerId) {
        expect(capturedEnv.APEX_CONTAINER_ID).toBe(workspaceInfo.containerId);
      }

      // Verify original environment variables are preserved
      expect(capturedEnv.PATH).toBeDefined();
      expect(capturedEnv.NODE_ENV).toBe(process.env.NODE_ENV);

      await workspaceManager.cleanupWorkspace(task.id);
    });

    it('should handle missing branch name gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task without branch name',
        // branchName is undefined
      });

      const workspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'isolated',
      });

      let capturedEnv: Record<string, any>;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedEnv = opts.options.env;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'no-branch-workflow',
        description: 'No branch test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      // Verify APEX_BRANCH is set to empty string when no branch name
      expect(capturedEnv.APEX_BRANCH).toBe('');
      expect(capturedEnv.APEX_TASK_ID).toBe(task.id);

      await workspaceManager.cleanupWorkspace(task.id);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle workspace creation failures gracefully', async () => {
      const task = await orchestrator.createTask({
        description: 'Workspace creation failure test',
      });

      // Mock workspace manager to simulate creation failure
      const originalCreateWorkspace = workspaceManager.createWorkspace.bind(workspaceManager);
      workspaceManager.createWorkspace = vi.fn().mockRejectedValue(new Error('Workspace creation failed'));

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'failure-test-workflow',
        description: 'Failure test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Should still execute successfully, falling back to project path
      await expect((orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map())).resolves.not.toThrow();

      expect(capturedOptions.options.cwd).toBe((orchestrator as any).projectPath);
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBeUndefined();

      // Restore original method
      workspaceManager.createWorkspace = originalCreateWorkspace;
    });

    it('should handle workspace cleanup during execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Workspace cleanup during execution test',
      });

      const workspace = await workspaceManager.createWorkspace(task.id, {
        strategy: 'isolated',
      });

      // Cleanup workspace before execution
      await workspaceManager.cleanupWorkspace(task.id);

      let capturedOptions: any;
      (query as any).mockImplementation(async function* (opts: any) {
        capturedOptions = opts;
        yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Test response' }] } };
      });

      const workflow: WorkflowDefinition = {
        name: 'cleanup-test-workflow',
        description: 'Cleanup test workflow',
        stages: [{ name: 'test-stage', agent: 'developer', dependencies: [] }],
      };

      const stage: WorkflowStage = { name: 'test-stage', agent: 'developer', dependencies: [] };
      const agent: AgentDefinition = {
        name: 'developer',
        role: 'Test Developer',
        model: 'haiku',
        instructions: 'Test instructions',
      };

      // Should fallback to project path when workspace no longer exists
      await (orchestrator as any).executeWorkflowStage(task, stage, agent, workflow, new Map());

      expect(capturedOptions.options.cwd).toBe((orchestrator as any).projectPath);
      expect(capturedOptions.options.env.APEX_CONTAINER_ID).toBeUndefined();
      expect(capturedOptions.options.env.APEX_WORKSPACE_PATH).toBeUndefined();
    });
  });
});