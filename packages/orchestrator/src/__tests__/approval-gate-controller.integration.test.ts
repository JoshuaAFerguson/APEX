/**
 * Integration tests for ApprovalGateController
 *
 * Tests integration with orchestrator, task store, and real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import {
  ApprovalGateController,
  type ApprovalGateOptions,
  type ApprovalGateEvents,
} from '../approval-gate-controller';
import { TaskStore } from '../store';
import type {
  ApprovalGate as ApprovalGateConfig,
  ApprovalState,
  Task,
} from '@apexcli/core';

describe('ApprovalGateController - Integration', () => {
  let testDir: string;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  const createMockTask = (): Task => ({
    id: 'integration-task-789',
    description: 'Integration test task',
    status: 'running',
    priority: 'normal',
    createdAt: new Date(),
    workflowName: 'integration-workflow',
    agent: 'tester',
    stage: 'implementation',
    context: {},
  });

  const createGateConfig = (overrides?: Partial<ApprovalGateConfig>): ApprovalGateConfig => ({
    id: 'integration-gate',
    type: 'stage-completion',
    name: 'Integration Gate',
    description: 'Gate for integration testing',
    required: true,
    timeout: undefined,
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['integration'],
    ...overrides,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-integration-'));
    store = new TaskStore(path.join(testDir, 'integration.db'));
    parentEmitter = new EventEmitter();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('task store integration', () => {
    it('should persist approval state throughout lifecycle', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const options: ApprovalGateOptions = {
        config: createGateConfig(),
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
        context: { workflowName: 'feature' },
      };

      const controller = new ApprovalGateController(options);

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Verify initial state is saved
      let savedState = await store.getApprovalStateById(controller.id);
      expect(savedState).toBeDefined();
      expect(savedState!.status).toBe('pending');
      expect(savedState!.taskId).toBe(task.id);

      // Grant approval
      await controller.grant('integration-tester', 'Approved after thorough testing');
      const result = await approvalPromise;

      // Verify final state is persisted
      savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('approved');
      expect(savedState!.approver).toBe('integration-tester');
      expect(savedState!.comment).toBe('Approved after thorough testing');
      expect(savedState!.respondedAt).toBeDefined();

      // Verify result matches persisted state
      expect(result.status).toBe('approved');
      expect(result.approver).toBe('integration-tester');
      expect(result.comment).toBe('Approved after thorough testing');

      controller.dispose();
    });

    it('should handle multiple approval states for same task', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      // Create two different gates for the same task
      const gate1Options: ApprovalGateOptions = {
        config: createGateConfig({ id: 'gate-1', name: 'First Gate' }),
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
      };

      const gate2Options: ApprovalGateOptions = {
        config: createGateConfig({ id: 'gate-2', name: 'Second Gate' }),
        taskId: task.id,
        stage: 'testing',
        agent: 'tester',
        store,
      };

      const controller1 = new ApprovalGateController(gate1Options);
      const controller2 = new ApprovalGateController(gate2Options);

      // Start both approval processes
      const approval1Promise = controller1.requestApproval();
      const approval2Promise = controller2.requestApproval();

      // Approve first gate
      await controller1.grant('developer', 'Implementation complete');
      await approval1Promise;

      // Approve second gate
      await controller2.grant('tester', 'Testing complete');
      await approval2Promise;

      // Verify both states are persisted
      const states = await store.getApprovalStatesByTask(task.id);
      expect(states).toHaveLength(2);

      const state1 = states.find(s => s.id === 'gate-1');
      const state2 = states.find(s => s.id === 'gate-2');

      expect(state1!.status).toBe('approved');
      expect(state1!.stage).toBe('implementation');
      expect(state2!.status).toBe('approved');
      expect(state2!.stage).toBe('testing');

      controller1.dispose();
      controller2.dispose();
    });

    it('should properly query approval states by gate name', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createGateConfig({ name: 'Unique Gate Name' });
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'review',
        agent: 'reviewer',
        store,
      });

      await controller.requestApproval();
      await controller.grant('reviewer', 'Looks good');

      // Query by gate name
      const gateStates = await store.getApprovalStatesByGate('Unique Gate Name');
      expect(gateStates).toHaveLength(1);
      expect(gateStates[0].status).toBe('approved');

      // Query by gate name and task ID
      const taskGateStates = await store.getApprovalStatesByGate('Unique Gate Name', task.id);
      expect(taskGateStates).toHaveLength(1);
      expect(taskGateStates[0].taskId).toBe(task.id);

      controller.dispose();
    });
  });

  describe('event emitter integration', () => {
    it('should forward all events to parent emitter', async () => {
      const requestedEvents: ApprovalState[] = [];
      const resolvedEvents: Array<{ state: ApprovalState; decision: string }> = [];
      const timeoutEvents: ApprovalState[] = [];

      parentEmitter.on('approval:requested', (state) => {
        requestedEvents.push(state);
      });

      parentEmitter.on('approval:resolved', (state, decision) => {
        resolvedEvents.push({ state, decision });
      });

      parentEmitter.on('approval:timeout', (state) => {
        timeoutEvents.push(state);
      });

      const controller = new ApprovalGateController({
        config: createGateConfig(),
        taskId: createMockTask().id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      const approvalPromise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for event emission

      await controller.grant('event-tester', 'Event test approval');
      await approvalPromise;

      expect(requestedEvents).toHaveLength(1);
      expect(requestedEvents[0].status).toBe('pending');

      expect(resolvedEvents).toHaveLength(1);
      expect(resolvedEvents[0].state.status).toBe('approved');
      expect(resolvedEvents[0].decision).toBe('approved');

      expect(timeoutEvents).toHaveLength(0);

      controller.dispose();
    });

    it('should emit timeout events correctly', async () => {
      const timeoutEvents: ApprovalState[] = [];
      parentEmitter.on('approval:timeout', (state) => {
        timeoutEvents.push(state);
      });

      const controller = new ApprovalGateController({
        config: createGateConfig({
          timeout: 0.01, // Very short timeout
          autoApproveOnTimeout: false,
        }),
        taskId: createMockTask().id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      await controller.requestApproval(); // Will timeout immediately

      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0].status).toBe('denied');

      controller.dispose();
    });

    it('should handle event listener errors gracefully', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parentEmitter.on('approval:requested', () => {
        throw new Error('Event listener error');
      });

      const controller = new ApprovalGateController({
        config: createGateConfig(),
        taskId: createMockTask().id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Should not throw despite listener error
      const approvalPromise = controller.requestApproval();
      await controller.grant('error-tester', 'Test');
      await approvalPromise;

      errorSpy.mockRestore();
      controller.dispose();
    });
  });

  describe('workflow integration scenarios', () => {
    it('should handle stage-completion approval workflow', async () => {
      const task = createMockTask();
      task.stage = 'implementation';
      task.status = 'waiting_approval';
      await store.saveTask(task);

      const stageGate = createGateConfig({
        type: 'stage-completion',
        name: 'Implementation Complete',
        description: 'Approve implementation stage completion',
      });

      const controller = new ApprovalGateController({
        config: stageGate,
        taskId: task.id,
        stage: task.stage,
        agent: task.agent,
        store,
        parentEmitter,
      });

      const approvalPromise = controller.requestApproval();

      // Simulate stage completion approval
      await controller.grant('stage-approver', 'Implementation meets requirements');
      const result = await approvalPromise;

      expect(result.status).toBe('approved');

      // Update task status to reflect approval
      task.status = 'completed';
      task.stage = 'testing';
      await store.updateTask(task.id, task);

      const updatedTask = await store.getTaskById(task.id);
      expect(updatedTask!.status).toBe('completed');
      expect(updatedTask!.stage).toBe('testing');

      controller.dispose();
    });

    it('should handle multi-reviewer approval workflow', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const reviewGate = createGateConfig({
        type: 'manual-review',
        name: 'Code Review',
        description: 'Requires approval from multiple reviewers',
        minApprovals: 3,
      });

      const controller = new ApprovalGateController({
        config: reviewGate,
        taskId: task.id,
        stage: 'review',
        agent: 'developer',
        store,
        parentEmitter,
      });

      const resolvedSpy = vi.fn();
      controller.on('approval:resolved', resolvedSpy);

      const approvalPromise = controller.requestApproval();

      // First two approvals
      await controller.grant('reviewer-1', 'Code structure looks good');
      expect(controller.isPending).toBe(true);
      expect(resolvedSpy).not.toHaveBeenCalled();

      await controller.grant('reviewer-2', 'Tests are comprehensive');
      expect(controller.isPending).toBe(true);
      expect(resolvedSpy).not.toHaveBeenCalled();

      // Third approval should complete
      await controller.grant('reviewer-3', 'Documentation is clear');
      const result = await approvalPromise;

      expect(controller.isResolved).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.approvalsReceived).toBe(3);
      expect(result.approvalsRequired).toBe(3);
      expect(resolvedSpy).toHaveBeenCalled();

      controller.dispose();
    });

    it('should handle approval denial workflow', async () => {
      const task = createMockTask();
      task.status = 'waiting_approval';
      await store.saveTask(task);

      const qualityGate = createGateConfig({
        type: 'quality-check',
        name: 'Quality Gate',
        description: 'Quality standards check',
      });

      const controller = new ApprovalGateController({
        config: qualityGate,
        taskId: task.id,
        stage: 'quality-check',
        agent: 'qa-agent',
        store,
        parentEmitter,
      });

      const approvalPromise = controller.requestApproval();

      // Deny approval
      await controller.deny('qa-reviewer', 'Quality standards not met - missing unit tests');
      const result = await approvalPromise;

      expect(result.status).toBe('denied');

      // Update task status to reflect denial
      task.status = 'failed';
      await store.updateTask(task.id, task);

      const updatedTask = await store.getTaskById(task.id);
      expect(updatedTask!.status).toBe('failed');

      const finalState = await store.getApprovalStateById(controller.id);
      expect(finalState!.status).toBe('denied');
      expect(finalState!.comment).toBe('Quality standards not met - missing unit tests');

      controller.dispose();
    });
  });

  describe('concurrent approval scenarios', () => {
    it('should handle multiple gates for different stages concurrently', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gates = [
        { config: createGateConfig({ id: 'impl-gate', name: 'Implementation Gate' }), stage: 'implementation' },
        { config: createGateConfig({ id: 'test-gate', name: 'Testing Gate' }), stage: 'testing' },
        { config: createGateConfig({ id: 'review-gate', name: 'Review Gate' }), stage: 'review' },
      ];

      const controllers = gates.map(gate => new ApprovalGateController({
        config: gate.config,
        taskId: task.id,
        stage: gate.stage,
        agent: `${gate.stage}-agent`,
        store,
        parentEmitter,
      }));

      // Start all approval processes concurrently
      const approvalPromises = controllers.map(controller => controller.requestApproval());

      // Approve all gates concurrently
      const approvePromises = controllers.map((controller, index) =>
        controller.grant(`approver-${index}`, `Approved ${gates[index].stage}`)
      );

      await Promise.all(approvePromises);
      const results = await Promise.all(approvalPromises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('approved');
      });

      // Verify all states are persisted
      const allStates = await store.getApprovalStatesByTask(task.id);
      expect(allStates).toHaveLength(3);
      allStates.forEach(state => {
        expect(state.status).toBe('approved');
      });

      controllers.forEach(controller => controller.dispose());
    });

    it('should handle concurrent approval and timeout correctly', async () => {
      vi.useFakeTimers();

      const controller = new ApprovalGateController({
        config: createGateConfig({
          timeout: 1, // 1 minute
          autoApproveOnTimeout: false,
        }),
        taskId: createMockTask().id,
        stage: 'implementation',
        agent: 'developer',
        store,
      });

      const approvalPromise = controller.requestApproval();

      // Try to approve after 30 seconds (before timeout)
      setTimeout(async () => {
        await controller.grant('fast-approver', 'Quick approval');
      }, 30 * 1000);

      // Advance time to 30 seconds
      vi.advanceTimersByTime(30 * 1000);

      const result = await approvalPromise;

      expect(result.status).toBe('approved'); // Should be approved, not timed out
      expect(result.approver).toBe('fast-approver');

      vi.useRealTimers();
      controller.dispose();
    });
  });

  describe('error recovery scenarios', () => {
    it('should recover from temporary database errors', async () => {
      const controller = new ApprovalGateController({
        config: createGateConfig(),
        taskId: createMockTask().id,
        stage: 'implementation',
        agent: 'developer',
        store,
      });

      // Mock temporary failure then success
      let callCount = 0;
      const originalSave = store.saveApprovalState.bind(store);
      const saveSpy = vi.spyOn(store, 'saveApprovalState').mockImplementation((state) => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary database error'));
        }
        return originalSave(state);
      });

      // First call should fail
      await expect(controller.requestApproval()).rejects.toThrow('Temporary database error');

      saveSpy.mockRestore();

      // Second call should succeed
      const approvalPromise = controller.requestApproval();
      await controller.grant('recovery-tester', 'Recovered successfully');
      const result = await approvalPromise;

      expect(result.status).toBe('approved');

      controller.dispose();
    });

    it('should handle store inconsistencies gracefully', async () => {
      const controller = new ApprovalGateController({
        config: createGateConfig(),
        taskId: 'non-existent-task',
        stage: 'implementation',
        agent: 'developer',
        store,
      });

      // Should still work even if task doesn't exist
      const approvalPromise = controller.requestApproval();
      await controller.grant('orphan-approver', 'Approved orphan gate');
      const result = await approvalPromise;

      expect(result.status).toBe('approved');

      // Verify state was still saved
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState).toBeDefined();
      expect(savedState!.taskId).toBe('non-existent-task');

      controller.dispose();
    });
  });
});