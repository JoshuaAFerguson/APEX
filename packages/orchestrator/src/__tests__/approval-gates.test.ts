/**
 * Integration tests for approval gate flow: pause/resume/abort
 * Tests the complete approval gate lifecycle including task pausing,
 * resumption after approval, abortion on rejection, and proper event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '../index';
import {
  ApprovalGateController,
  type ApprovalGateOptions,
  type ApprovalGateEvents,
} from '../approval-gate-controller';
import { TaskStore } from '../store';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  ApprovalState,
  ApprovalStatus,
  generateTaskId,
  generateApprovalId,
  Task,
  TaskStatus,
  initializeApex,
  ApprovalGate as ApprovalGateConfig,
} from '@apexcli/core';

// Mock the Claude Agent SDK query function
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

// Mock child_process for git operations
vi.mock('child_process', () => {
  const mock = {
    exec: vi.fn(),
    execSync: vi.fn(),
    spawn: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
  return { ...mock, default: mock };
});

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

describe('Approval Gates Integration Tests - Pause/Resume/Abort Flow', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let parentEmitter: EventEmitter;

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: generateTaskId(),
    description: 'Test task for approval gate flow',
    status: 'in-progress',
    priority: 'normal',
    createdAt: new Date(),
    workflowName: 'test-workflow',
    agent: 'developer',
    stage: 'implementation',
    context: {},
    ...overrides,
  });

  const createApprovalGate = (overrides?: Partial<ApprovalGateConfig>): ApprovalGateConfig => ({
    id: generateApprovalId(),
    type: 'stage-completion',
    name: 'Implementation Gate',
    description: 'Approve implementation stage completion',
    required: true,
    timeout: 60, // 1 hour timeout
    autoApprove: false,
    autoApproveOnTimeout: false,
    minApprovals: 1,
    tags: ['implementation'],
    ...overrides,
  });

  beforeEach(async () => {
    // Create temporary directory for test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-gates-test-'));

    // Initialize APEX project structure
    await initializeApex(testDir, {
      projectName: 'approval-gates-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create basic workflow and agent files
    const workflowContent = `
name: test-workflow
description: Test workflow for approval gates
stages:
  - name: implementation
    agent: developer
    description: Implement the feature
  - name: testing
    agent: tester
    description: Test the implementation
`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'test-workflow.yaml'),
      workflowContent
    );

    const agentContent = `---
name: developer
description: Developer agent for testing
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent for testing approval gates.`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'agents', 'developer.md'),
      agentContent
    );

    // Initialize orchestrator and store
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    store = orchestrator.store;
    parentEmitter = new EventEmitter();

    // Mock the query function
    mockQuery.mockImplementation(async () => ({
      content: [{ type: 'text', text: 'Stage completed successfully.' }],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      stop_reason: 'end_turn',
      inputMessages: [],
      outputMessages: [],
    }));
  });

  afterEach(async () => {
    // Cleanup orchestrator
    if (orchestrator) {
      try {
        orchestrator.store?.close();
      } catch {
        // Ignore if already closed
      }
    }

    // Clean up temp directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    vi.clearAllMocks();
  });

  describe('Task pausing at approval gate', () => {
    it('should pause task when approval gate is encountered', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track events
      const requestedEvents: ApprovalState[] = [];
      parentEmitter.on('approval:requested', (state) => {
        requestedEvents.push(state);
      });

      // Start approval process (this should pause the task)
      const approvalPromise = controller.requestApproval();

      // Verify task is in pending approval state
      expect(controller.isPending).toBe(true);
      expect(controller.isResolved).toBe(false);

      // Verify approval:requested event was emitted
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for event emission
      expect(requestedEvents).toHaveLength(1);
      expect(requestedEvents[0].status).toBe('pending');
      expect(requestedEvents[0].taskId).toBe(task.id);
      expect(requestedEvents[0].stage).toBe('implementation');

      // Verify state is persisted in store
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState).toBeDefined();
      expect(savedState!.status).toBe('pending');
      expect(savedState!.taskId).toBe(task.id);

      // Clean up
      await controller.grant('test-approver', 'Test cleanup');
      await approvalPromise;
      controller.dispose();
    });

    it('should pause task with correct reason when using orchestrator pauseTask', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      // Track task status changes
      const taskUpdates: Task[] = [];
      const originalUpdateTask = store.updateTask.bind(store);
      vi.spyOn(store, 'updateTask').mockImplementation(async (taskId, updates) => {
        const result = await originalUpdateTask(taskId, updates);
        const updatedTask = await store.getTaskById(taskId);
        if (updatedTask) {
          taskUpdates.push(updatedTask);
        }
        return result;
      });

      // Pause task with approval_gate reason
      await orchestrator.pauseTask(task.id, 'approval_gate');

      // Verify task was paused
      const pausedTask = await store.getTaskById(task.id);
      expect(pausedTask!.status).toBe('paused');

      // Verify task update was recorded
      expect(taskUpdates.length).toBeGreaterThan(0);
      const finalUpdate = taskUpdates[taskUpdates.length - 1];
      expect(finalUpdate.status).toBe('paused');
    });

    it('should handle approval gate timeout correctly', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate({
        timeout: 0.01, // Very short timeout (0.6 seconds)
        autoApproveOnTimeout: false,
      });

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track timeout events
      const timeoutEvents: ApprovalState[] = [];
      parentEmitter.on('approval:timeout', (state) => {
        timeoutEvents.push(state);
      });

      // Start approval process and wait for timeout
      const result = await controller.requestApproval();

      // Verify timeout occurred
      expect(result.status).toBe('denied');
      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0].status).toBe('denied');

      // Verify state is updated in store
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('denied');
      expect(savedState!.comment).toBe('Approval timed out');

      controller.dispose();
    });
  });

  describe('Task resumption after approval', () => {
    it('should resume task after approval is granted', async () => {
      const task = createMockTask({ status: 'paused' });
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track resolved events
      const resolvedEvents: Array<{ state: ApprovalState; decision: string }> = [];
      parentEmitter.on('approval:resolved', (state, decision) => {
        resolvedEvents.push({ state, decision });
      });

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Grant approval
      await controller.grant('approver-1', 'Implementation looks good');
      const result = await approvalPromise;

      // Verify approval was granted
      expect(result.status).toBe('approved');
      expect(result.approver).toBe('approver-1');
      expect(result.comment).toBe('Implementation looks good');

      // Verify approval:resolved event was emitted
      expect(resolvedEvents).toHaveLength(1);
      expect(resolvedEvents[0].state.status).toBe('approved');
      expect(resolvedEvents[0].decision).toBe('approved');

      // Verify state is updated in store
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('approved');
      expect(savedState!.approver).toBe('approver-1');

      controller.dispose();
    });

    it('should resume task from checkpoint using orchestrator resumeTask', async () => {
      const task = createMockTask({ status: 'paused' });
      await store.saveTask(task);

      // Create a checkpoint for the task
      const checkpoint = await store.saveCheckpoint({
        id: 'test-checkpoint',
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        createdAt: new Date(),
        conversationState: [],
        metadata: { stage: 'implementation', agent: 'developer' },
      });

      // Mock the runWorkflow to prevent actual workflow execution
      const runWorkflowSpy = vi.spyOn(orchestrator, 'runWorkflow').mockResolvedValue();

      // Resume task from checkpoint
      const resumed = await orchestrator.resumeTask(task.id, { checkpointId: checkpoint.id });

      // Verify task was resumed
      expect(resumed).toBe(true);

      // Verify runWorkflow was called to continue execution
      expect(runWorkflowSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: task.id,
          checkpointId: checkpoint.id,
        })
      );

      runWorkflowSpy.mockRestore();
    });

    it('should handle multi-approval gate scenario', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate({
        minApprovals: 3,
        name: 'Multi-Reviewer Gate',
      });

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // First approval
      await controller.grant('reviewer-1', 'Code structure looks good');
      expect(controller.isPending).toBe(true);

      // Second approval
      await controller.grant('reviewer-2', 'Tests are comprehensive');
      expect(controller.isPending).toBe(true);

      // Third approval (should complete)
      await controller.grant('reviewer-3', 'Documentation is clear');
      const result = await approvalPromise;

      // Verify all approvals were collected
      expect(result.status).toBe('approved');
      expect(result.approvalsReceived).toBe(3);
      expect(result.approvalsRequired).toBe(3);
      expect(controller.isResolved).toBe(true);

      controller.dispose();
    });
  });

  describe('Task abort on rejection', () => {
    it('should abort task when approval is denied', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track resolved events
      const resolvedEvents: Array<{ state: ApprovalState; decision: string }> = [];
      parentEmitter.on('approval:resolved', (state, decision) => {
        resolvedEvents.push({ state, decision });
      });

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Deny approval
      await controller.deny('reviewer', 'Implementation does not meet quality standards');
      const result = await approvalPromise;

      // Verify approval was denied
      expect(result.status).toBe('denied');
      expect(result.approver).toBe('reviewer');
      expect(result.comment).toBe('Implementation does not meet quality standards');

      // Verify approval:resolved event was emitted with 'denied'
      expect(resolvedEvents).toHaveLength(1);
      expect(resolvedEvents[0].state.status).toBe('denied');
      expect(resolvedEvents[0].decision).toBe('denied');

      // Verify state is updated in store
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('denied');
      expect(savedState!.approver).toBe('reviewer');
      expect(savedState!.comment).toBe('Implementation does not meet quality standards');

      controller.dispose();
    });

    it('should handle approval cancellation correctly', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Cancel approval (e.g., task was cancelled)
      await controller.cancel();

      // Verify promise is rejected
      await expect(approvalPromise).rejects.toThrow('Approval was cancelled');

      // Verify state is updated in store
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('denied');
      expect(savedState!.comment).toBe('Cancelled');

      controller.dispose();
    });

    it('should abort task when timeout occurs without auto-approval', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate({
        timeout: 0.01, // Very short timeout
        autoApproveOnTimeout: false, // Explicit denial on timeout
      });

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track timeout events
      const timeoutEvents: ApprovalState[] = [];
      parentEmitter.on('approval:timeout', (state) => {
        timeoutEvents.push(state);
      });

      // Start approval process and wait for timeout
      const result = await controller.requestApproval();

      // Verify timeout resulted in denial
      expect(result.status).toBe('denied');
      expect(timeoutEvents).toHaveLength(1);
      expect(timeoutEvents[0].status).toBe('denied');

      // Verify final state in store
      const savedState = await store.getApprovalStateById(controller.id);
      expect(savedState!.status).toBe('denied');
      expect(savedState!.approver).toBe('system');
      expect(savedState!.comment).toBe('Approval timed out');

      controller.dispose();
    });
  });

  describe('Proper event emission during pause/resume/abort', () => {
    it('should emit correct sequence of events during approval lifecycle', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track all events
      const events: Array<{ type: string; data: any }> = [];

      parentEmitter.on('approval:requested', (state) => {
        events.push({ type: 'approval:requested', data: state });
      });

      parentEmitter.on('approval:resolved', (state, decision) => {
        events.push({ type: 'approval:resolved', data: { state, decision } });
      });

      parentEmitter.on('approval:timeout', (state) => {
        events.push({ type: 'approval:timeout', data: state });
      });

      // Start approval process
      const approvalPromise = controller.requestApproval();

      // Allow event emission
      await new Promise(resolve => setTimeout(resolve, 10));

      // Grant approval
      await controller.grant('approver', 'Approved');
      await approvalPromise;

      // Verify event sequence
      expect(events).toHaveLength(2);

      // First event: approval:requested
      expect(events[0].type).toBe('approval:requested');
      expect(events[0].data.status).toBe('pending');
      expect(events[0].data.taskId).toBe(task.id);

      // Second event: approval:resolved
      expect(events[1].type).toBe('approval:resolved');
      expect(events[1].data.state.status).toBe('approved');
      expect(events[1].data.decision).toBe('approved');

      controller.dispose();
    });

    it('should emit events when approval is denied', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track events
      const events: Array<{ type: string; data: any }> = [];

      parentEmitter.on('approval:requested', (state) => {
        events.push({ type: 'approval:requested', data: state });
      });

      parentEmitter.on('approval:resolved', (state, decision) => {
        events.push({ type: 'approval:resolved', data: { state, decision } });
      });

      // Start approval process and deny
      const approvalPromise = controller.requestApproval();
      await new Promise(resolve => setTimeout(resolve, 10));

      await controller.deny('reviewer', 'Quality standards not met');
      await approvalPromise;

      // Verify event sequence for denial
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('approval:requested');
      expect(events[1].type).toBe('approval:resolved');
      expect(events[1].data.decision).toBe('denied');

      controller.dispose();
    });

    it('should emit timeout events correctly', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate({
        timeout: 0.01, // Very short timeout
      });

      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Track events
      const events: Array<{ type: string; data: any }> = [];

      parentEmitter.on('approval:requested', (state) => {
        events.push({ type: 'approval:requested', data: state });
      });

      parentEmitter.on('approval:timeout', (state) => {
        events.push({ type: 'approval:timeout', data: state });
      });

      parentEmitter.on('approval:resolved', (state, decision) => {
        events.push({ type: 'approval:resolved', data: { state, decision } });
      });

      // Start approval process and wait for timeout
      await controller.requestApproval();

      // Verify timeout events
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some(e => e.type === 'approval:timeout')).toBe(true);
      expect(events.some(e => e.type === 'approval:resolved' && e.data.decision === 'timeout')).toBe(true);

      controller.dispose();
    });

    it('should handle event listener errors gracefully', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      const gateConfig = createApprovalGate();
      const controller = new ApprovalGateController({
        config: gateConfig,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      // Add event listener that throws error
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      parentEmitter.on('approval:requested', () => {
        throw new Error('Event listener error');
      });

      // Should not throw despite listener error
      const approvalPromise = controller.requestApproval();
      await controller.grant('approver', 'Test');
      const result = await approvalPromise;

      expect(result.status).toBe('approved');

      errorSpy.mockRestore();
      controller.dispose();
    });

    it('should emit events for concurrent approval scenarios', async () => {
      const task = createMockTask();
      await store.saveTask(task);

      // Create multiple gates for the same task
      const gate1Config = createApprovalGate({ id: 'gate-1', name: 'Gate 1' });
      const gate2Config = createApprovalGate({ id: 'gate-2', name: 'Gate 2' });

      const controller1 = new ApprovalGateController({
        config: gate1Config,
        taskId: task.id,
        stage: 'implementation',
        agent: 'developer',
        store,
        parentEmitter,
      });

      const controller2 = new ApprovalGateController({
        config: gate2Config,
        taskId: task.id,
        stage: 'testing',
        agent: 'tester',
        store,
        parentEmitter,
      });

      // Track events
      const events: Array<{ type: string; gateId: string }> = [];

      parentEmitter.on('approval:requested', (state) => {
        events.push({ type: 'approval:requested', gateId: state.id });
      });

      parentEmitter.on('approval:resolved', (state) => {
        events.push({ type: 'approval:resolved', gateId: state.id });
      });

      // Start both approval processes concurrently
      const approval1Promise = controller1.requestApproval();
      const approval2Promise = controller2.requestApproval();

      await new Promise(resolve => setTimeout(resolve, 10));

      // Grant both approvals
      await Promise.all([
        controller1.grant('approver-1', 'Gate 1 approved'),
        controller2.grant('approver-2', 'Gate 2 approved'),
      ]);

      await Promise.all([approval1Promise, approval2Promise]);

      // Verify events for both gates
      const requestedEvents = events.filter(e => e.type === 'approval:requested');
      const resolvedEvents = events.filter(e => e.type === 'approval:resolved');

      expect(requestedEvents).toHaveLength(2);
      expect(resolvedEvents).toHaveLength(2);

      expect(requestedEvents.map(e => e.gateId)).toContain('gate-1');
      expect(requestedEvents.map(e => e.gateId)).toContain('gate-2');

      controller1.dispose();
      controller2.dispose();
    });
  });
});