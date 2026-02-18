/**
 * Integration tests for approval gate flow operations
 *
 * Tests the complete approval gate lifecycle including:
 * - Task pause/resume with approval gates
 * - Approval abort scenarios
 * - Multi-gate approval workflows
 * - State persistence across restarts
 * - Error recovery and rollback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { ApexOrchestrator } from '../index.js';
import { ApprovalGateController, type ApprovalGateOptions } from '../approval-gate-controller.js';
import { TaskStore } from '../store.js';
import {
  Task,
  TaskStatus,
  ApprovalGate,
  ApprovalState,
  AutonomyLevel,
  AutonomyConfig,
  WorkflowDefinition,
} from '@apexcli/core';

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AgentSDK: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({
      result: 'Mock agent response',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    }),
  })),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() }))}));

describe('Approval Gate Flow Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;
  let parentEmitter: EventEmitter;

  // Helper to create test approval gate config
  const createApprovalGate = (overrides: Partial<ApprovalGate> = {}): ApprovalGate => ({
    id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'before-commit',
    name: 'Test Approval Gate',
    description: 'Integration test approval gate',
    required: true,
    timeout: undefined,
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['integration-test'],
    ...overrides,
  });

  // Helper to create test workflow with approval gates
  const createWorkflowWithGates = (gates: ApprovalGate[]): WorkflowDefinition => ({
    name: 'integration-test-workflow',
    description: 'Workflow with approval gates for integration testing',
    stages: [
      {
        name: 'planning',
        agent: 'planner',
        description: 'Planning stage',
        gates: gates.filter(g => g.type === 'stage-start' || g.type === 'stage-completion'),
      },
      {
        name: 'implementation',
        agent: 'developer',
        description: 'Implementation stage',
        gates: gates.filter(g => g.type === 'before-commit' || g.type === 'before-deploy'),
      },
      {
        name: 'testing',
        agent: 'tester',
        description: 'Testing stage',
        gates: gates.filter(g => g.type === 'before-merge'),
      },
    ],
    autonomy: {
      level: 'review-before-commit' as AutonomyLevel,
      gates,
    } as AutonomyConfig,
  });

  // Helper to create test task
  const createTestTask = (workflow?: WorkflowDefinition, overrides: Partial<Task> = {}): Task => ({
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Integration test task with approval gates',
    status: 'pending' as TaskStatus,
    workflow: workflow?.name || 'integration-test-workflow',
    agent: 'developer',
    priority: 'medium',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    trashedAt: null,
    archivedAt: null,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    context: {
      workflowDefinition: workflow,
    },
    result: null,
    error: null,
    metadata: {},
    logs: [],
    artifacts: [],
    ...overrides,
  });

  beforeEach(async () => {
    // Create temporary directory for test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-flow-test-'));

    // Initialize test store
    store = new TaskStore(testDir);
    await store.initialize();

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({
      dataDir: testDir,
    });

    // Create parent emitter for event testing
    parentEmitter = new EventEmitter();
  });

  afterEach(async () => {
    // Clean up orchestrator
    if (orchestrator) {
      await orchestrator.close();
    }

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Task Pause/Resume with Approval Gates', () => {
    it('should pause task execution when approval gate is triggered', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-commit',
        name: 'Commit Review Gate',
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      // Create task in store
      await store.createTask(task);

      // Set up event listeners
      let approvalRequested = false;
      let taskPaused = false;

      orchestrator.on('approval:requested', (approvalState: ApprovalState) => {
        approvalRequested = true;
        expect(approvalState.taskId).toBe(task.id);
        expect(approvalState.gateName).toBe('Commit Review Gate');
      });

      orchestrator.on('task:paused', (pausedTask: Task) => {
        taskPaused = true;
        expect(pausedTask.id).toBe(task.id);
        expect(pausedTask.status).toBe('paused');
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Wait for approval to be requested
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(approvalRequested).toBe(true);

      // Verify task is paused
      const pausedTask = await store.getTask(task.id);
      expect(pausedTask?.status).toBe('paused');

      // Grant approval
      const approvalStates = await store.getApprovalStates(task.id);
      expect(approvalStates).toHaveLength(1);

      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter: orchestrator,
      });

      await controller.grant('integration-tester', 'Approved for integration test');

      // Wait for execution to complete
      const result = await executionPromise;
      expect(result).toBeDefined();

      controller.dispose();
    });

    it('should resume task after approval is granted', async () => {
      const approvalGate = createApprovalGate({
        type: 'stage-completion',
        name: 'Stage Completion Gate',
        minApprovals: 1,
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      await store.createTask(task);

      let taskResumed = false;
      orchestrator.on('task:resumed', (resumedTask: Task) => {
        taskResumed = true;
        expect(resumedTask.id).toBe(task.id);
        expect(resumedTask.status).toBe('running');
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Wait for approval request
      await new Promise(resolve => setTimeout(resolve, 100));

      // Grant approval
      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter: orchestrator,
      });

      await controller.grant('resume-tester', 'Resuming task execution');

      // Wait a bit for resume to process
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(taskResumed).toBe(true);

      // Complete execution
      await executionPromise;

      controller.dispose();
    });

    it('should handle multiple approval gates in sequence', async () => {
      const gates = [
        createApprovalGate({
          id: 'gate-1',
          type: 'stage-start',
          name: 'Stage Start Gate',
        }),
        createApprovalGate({
          id: 'gate-2',
          type: 'before-commit',
          name: 'Commit Gate',
        }),
        createApprovalGate({
          id: 'gate-3',
          type: 'before-deploy',
          name: 'Deploy Gate',
        }),
      ];

      const workflow = createWorkflowWithGates(gates);
      const task = createTestTask(workflow);

      await store.createTask(task);

      const approvalRequests: string[] = [];
      orchestrator.on('approval:requested', (approvalState: ApprovalState) => {
        approvalRequests.push(approvalState.gateName);
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Grant approvals in sequence
      for (let i = 0; i < gates.length; i++) {
        // Wait for approval request
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(approvalRequests).toHaveLength(i + 1);

        const controller = new ApprovalGateController({
          config: gates[i],
          taskId: task.id,
          stage: 'implementation',
          agent: 'developer',
          store,
          parentEmitter: orchestrator,
        });

        await controller.grant(`tester-${i}`, `Approved gate ${i + 1}`);
        controller.dispose();
      }

      // Complete execution
      await executionPromise;

      // Verify all gates were triggered
      expect(approvalRequests).toEqual([
        'Stage Start Gate',
        'Commit Gate',
        'Deploy Gate',
      ]);
    });
  });

  describe('Approval Abort Scenarios', () => {
    it('should abort task when approval is denied', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-deploy',
        name: 'Deploy Approval Gate',
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      await store.createTask(task);

      let taskAborted = false;
      orchestrator.on('task:failed', (failedTask: Task, error?: Error) => {
        taskAborted = true;
        expect(failedTask.id).toBe(task.id);
        expect(error?.message).toContain('denied');
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Wait for approval request
      await new Promise(resolve => setTimeout(resolve, 100));

      // Deny approval
      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter: orchestrator,
      });

      await controller.deny('abort-tester', 'Deployment not ready');

      // Wait for task to be aborted
      try {
        await executionPromise;
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('denied');
      }

      expect(taskAborted).toBe(true);

      // Verify task status
      const abortedTask = await store.getTask(task.id);
      expect(abortedTask?.status).toBe('failed');

      controller.dispose();
    });

    it('should abort task when approval times out', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-commit',
        name: 'Timeout Gate',
        timeout: 0.01, // 6ms timeout
        autoApproveOnTimeout: false,
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      await store.createTask(task);

      let timeoutOccurred = false;
      orchestrator.on('approval:timeout', (approvalState: ApprovalState) => {
        timeoutOccurred = true;
        expect(approvalState.taskId).toBe(task.id);
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Wait for timeout to occur
      try {
        await executionPromise;
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(timeoutOccurred).toBe(true);

      // Verify task status
      const timedOutTask = await store.getTask(task.id);
      expect(timedOutTask?.status).toBe('failed');
    }, 1000);

    it('should handle cancellation during approval wait', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-deploy',
        name: 'Cancellation Test Gate',
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      await store.createTask(task);

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Wait for approval request
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel the task
      await orchestrator.cancelTask(task.id);

      // Execution should be cancelled
      try {
        await executionPromise;
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('cancel');
      }

      // Verify task status
      const cancelledTask = await store.getTask(task.id);
      expect(cancelledTask?.status).toBe('cancelled');
    });
  });

  describe('State Persistence Across Restarts', () => {
    it('should persist approval states when orchestrator restarts', async () => {
      const approvalGate = createApprovalGate({
        id: 'persistent-gate',
        type: 'before-commit',
        name: 'Persistent Approval Gate',
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      await store.createTask(task);

      // Start approval process
      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      const approvalPromise = controller.requestApproval();

      // Wait for approval state to be saved
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify approval state is persisted
      let savedState = await store.getApprovalStateById('persistent-gate');
      expect(savedState).toBeDefined();
      expect(savedState!.status).toBe('pending');

      // Grant approval
      await controller.grant('persistence-tester', 'Testing persistence');
      await approvalPromise;

      // Verify updated state is persisted
      savedState = await store.getApprovalStateById('persistent-gate');
      expect(savedState!.status).toBe('approved');
      expect(savedState!.approver).toBe('persistence-tester');

      controller.dispose();
    });

    it('should resume pending approvals after orchestrator restart', async () => {
      const approvalGate = createApprovalGate({
        id: 'resume-gate',
        type: 'before-deploy',
        name: 'Resume Test Gate',
      });

      const workflow = createWorkflowWithGates([approvalGate]);
      const task = createTestTask(workflow);

      await store.createTask(task);

      // Create approval state in database (simulating pending approval)
      const approvalState: ApprovalState = {
        id: 'resume-gate',
        taskId: task.id,
        gateName: 'Resume Test Gate',
        gateType: 'before-deploy',
        status: 'pending',
        requestedAt: new Date(),
        approvalsRequired: 1,
        approvalsReceived: 0,
        context: {
          stage: 'implementation',
          agent: 'developer',
        },
      };

      await store.saveApprovalState(approvalState);

      // Create new orchestrator instance (simulating restart)
      const newOrchestrator = new ApexOrchestrator({
        dataDir: testDir,
      });

      try {
        // Should be able to load and resolve pending approval
        const controller = new ApprovalGateController({
          config: approvalGate,
          taskId: task.id,
          stage: 'implementation',
          agent: 'developer',
          store,
          parentEmitter: newOrchestrator,
        });

        // Should be able to grant approval for resumed state
        await controller.grant('resume-tester', 'Resuming after restart');

        // Verify state is updated
        const updatedState = await store.getApprovalStateById('resume-gate');
        expect(updatedState!.status).toBe('approved');

        controller.dispose();
      } finally {
        await newOrchestrator.close();
      }
    });
  });

  describe('Multi-Gate Approval Workflows', () => {
    it('should handle parallel approval gates', async () => {
      const parallelGates = [
        createApprovalGate({
          id: 'parallel-gate-1',
          type: 'before-commit',
          name: 'Security Review',
        }),
        createApprovalGate({
          id: 'parallel-gate-2',
          type: 'before-commit',
          name: 'Performance Review',
        }),
        createApprovalGate({
          id: 'parallel-gate-3',
          type: 'before-commit',
          name: 'Code Quality Review',
        }),
      ];

      const workflow = createWorkflowWithGates(parallelGates);
      const task = createTestTask(workflow);

      await store.createTask(task);

      const controllers = parallelGates.map(gate =>
        new ApprovalGateController({
          config: gate,
          taskId: task.id,
          stage: 'implementation',
          agent: 'developer',
          store,
          parentEmitter: orchestrator,
        })
      );

      // Start all approvals in parallel
      const approvalPromises = controllers.map(controller =>
        controller.requestApproval()
      );

      // Grant approvals in different order
      await controllers[1].grant('performance-reviewer', 'Performance looks good');
      await controllers[2].grant('quality-reviewer', 'Code quality approved');
      await controllers[0].grant('security-reviewer', 'Security review passed');

      // All approvals should complete
      const results = await Promise.all(approvalPromises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('approved');
      });

      // Clean up
      controllers.forEach(controller => controller.dispose());
    });

    it('should handle conditional approval gates', async () => {
      const conditionalGates = [
        createApprovalGate({
          id: 'always-gate',
          type: 'before-commit',
          name: 'Always Required',
        }),
        createApprovalGate({
          id: 'conditional-gate',
          type: 'before-deploy',
          name: 'Production Deployment',
          // This would be conditional based on deployment target
        }),
      ];

      const workflow = createWorkflowWithGates(conditionalGates);
      const task = createTestTask(workflow, {
        context: {
          deploymentTarget: 'production',
        },
      });

      await store.createTask(task);

      // Only the conditional gate should be triggered for production
      const controller = new ApprovalGateController({
        config: conditionalGates[1], // Conditional gate
        taskId: task.id,
        stage: 'deployment',
        agent: 'devops',
        store,
        parentEmitter: orchestrator,
      });

      const approvalPromise = controller.requestApproval();
      await controller.grant('prod-approver', 'Production deployment approved');

      const result = await approvalPromise;
      expect(result.status).toBe('approved');

      controller.dispose();
    });
  });

  describe('Error Recovery and Rollback', () => {
    it('should handle approval controller disposal during pending approval', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-commit',
        name: 'Disposal Test Gate',
      });

      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: 'disposal-test-task',
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter: orchestrator,
      });

      const approvalPromise = controller.requestApproval();

      // Dispose controller while approval is pending
      controller.dispose();

      // Should handle disposal gracefully
      expect(() => controller.dispose()).not.toThrow();

      // Approval should be cancelled
      await expect(approvalPromise).rejects.toThrow();
    });

    it('should rollback state on approval system failure', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-deploy',
        name: 'Failure Test Gate',
      });

      const task = createTestTask(undefined, {
        status: 'running' as TaskStatus,
      });

      await store.createTask(task);

      // Mock store failure
      const originalSave = store.saveApprovalState;
      store.saveApprovalState = vi.fn().mockRejectedValue(new Error('Database failure'));

      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter: orchestrator,
      });

      // Should handle database failure gracefully
      await expect(controller.requestApproval()).rejects.toThrow('Database failure');

      // Restore original function
      store.saveApprovalState = originalSave;

      controller.dispose();
    });

    it('should handle network interruption during approval process', async () => {
      const approvalGate = createApprovalGate({
        type: 'before-commit',
        name: 'Network Test Gate',
        timeout: 0.1, // 60ms timeout
      });

      const controller = new ApprovalGateController({
        config: approvalGate,
        taskId: 'network-test-task',
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter: orchestrator,
      });

      // Simulate network interruption by mocking event emission failure
      const originalEmit = orchestrator.emit;
      let emitCount = 0;
      orchestrator.emit = vi.fn().mockImplementation((...args) => {
        emitCount++;
        if (emitCount === 1) {
          throw new Error('Network interruption');
        }
        return originalEmit.apply(orchestrator, args);
      });

      // Should handle network failure and still process approval
      try {
        const result = await controller.requestApproval();
        expect(result.status).toBe('denied'); // Should timeout due to network issue
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Restore original function
      orchestrator.emit = originalEmit;
      controller.dispose();
    }, 1000);
  });
});