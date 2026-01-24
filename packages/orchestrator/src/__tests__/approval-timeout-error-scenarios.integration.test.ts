/**
 * Integration tests for approval timeout and error scenarios
 *
 * Tests verify:
 * - Approval timeout handling with different timeout configurations
 * - Network/SDK errors during approval processing
 * - Invalid state transitions are properly rejected
 * - Orphaned approval requests are detected and handled
 * - Concurrent approval attempts are handled correctly
 * - Database consistency is maintained during error conditions
 * - Event emission occurs correctly during error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'eventemitter3';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import {
  initializeApex,
  type Task,
  type TaskStatus,
  type ApprovalState,
  type ApprovalGate as ApprovalGateConfig,
  generateApprovalId,
} from '@apexcli/core';
import { TaskStore } from '../store';
import { ApprovalGateController } from '../approval-gate-controller';

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

const { query } = await import('@anthropic-ai/claude-agent-sdk');

interface TestEvent {
  event: string;
  timestamp: Date;
  data: unknown;
  error?: Error;
}

describe('Approval Timeout and Error Scenarios - Integration', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let mockQuery: MockInstance;
  let emittedEvents: TestEvent[] = [];
  let eventEmitter: EventEmitter;

  beforeEach(async () => {
    // Clear events array for each test
    emittedEvents = [];

    // Create isolated temp directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-timeout-error-'));

    // Mock Claude Agent SDK
    mockQuery = vi.mocked(query);
    mockQuery.mockResolvedValue({
      requestId: 'mock-request-1',
      output: {
        success: true,
        messages: [{
          role: 'assistant',
          content: [{ type: 'text', text: 'Stage completed successfully.' }]
        }],
      },
      usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50 },
    });

    // Initialize APEX project with approval gates
    await initializeApex(testDir, {
      projectName: 'test-timeout-errors',
      language: 'typescript',
      framework: 'node',
    });

    // Create config with various timeout configurations
    const configContent = `
project:
  name: test-timeout-errors
  language: typescript
  framework: node

gates:
  - name: "short-timeout"
    type: "before-stage"
    description: "Gate with short timeout for testing"
    timeout: 0.1  # 6 seconds
    minApprovals: 1
    required: true
    autoApproveOnTimeout: false
  - name: "auto-approve-timeout"
    type: "before-stage"
    description: "Gate that auto-approves on timeout"
    timeout: 0.1  # 6 seconds
    minApprovals: 1
    required: true
    autoApproveOnTimeout: true
  - name: "multi-approval-timeout"
    type: "before-stage"
    description: "Gate requiring multiple approvals with timeout"
    timeout: 0.1  # 6 seconds
    minApprovals: 3
    required: true
    autoApproveOnTimeout: false
  - name: "no-timeout"
    type: "before-stage"
    description: "Gate without timeout"
    minApprovals: 1
    required: true
`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      configContent
    );

    // Create test workflows
    const workflowsDir = path.join(testDir, '.apex', 'workflows');

    // Workflow with short timeout
    await fs.writeFile(
      path.join(workflowsDir, 'timeout-test-workflow.yaml'),
      `name: timeout-test-workflow
description: Test workflow with timeout scenarios
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement with timeout gate
    gate: "short-timeout"
  - name: completion
    agent: reviewer
    dependsOn: [implementation]
    description: Complete the task
`
    );

    // Workflow with auto-approve timeout
    await fs.writeFile(
      path.join(workflowsDir, 'auto-approve-workflow.yaml'),
      `name: auto-approve-workflow
description: Test workflow with auto-approve timeout
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement with auto-approve gate
    gate: "auto-approve-timeout"
  - name: completion
    agent: reviewer
    dependsOn: [implementation]
    description: Complete the task
`
    );

    // Workflow with multi-approval timeout
    await fs.writeFile(
      path.join(workflowsDir, 'multi-approval-workflow.yaml'),
      `name: multi-approval-workflow
description: Test workflow with multiple approvals
stages:
  - name: planning
    agent: planner
    description: Plan the task
  - name: implementation
    agent: developer
    dependsOn: [planning]
    description: Implement with multi-approval gate
    gate: "multi-approval-timeout"
  - name: completion
    agent: reviewer
    dependsOn: [implementation]
    description: Complete the task
`
    );

    // Create required agents
    const agentsDir = path.join(testDir, '.apex', 'agents');

    await fs.writeFile(
      path.join(agentsDir, 'planner.md'),
      `---
name: planner
description: Plans tasks and creates implementation strategies
---
You are a planner agent. Create detailed implementation plans.`
    );

    await fs.writeFile(
      path.join(agentsDir, 'developer.md'),
      `---
name: developer
description: Implements features and writes code
---
You are a developer agent. Write production-quality code.`
    );

    await fs.writeFile(
      path.join(agentsDir, 'reviewer.md'),
      `---
name: reviewer
description: Reviews code and ensures quality
---
You are a reviewer agent. Perform thorough code reviews.`
    );

    // Create orchestrator and store
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    store = (orchestrator as any).store;
    eventEmitter = new EventEmitter();

    // Set up comprehensive event tracking
    setupEventTracking();
  });

  afterEach(async () => {
    vi.useRealTimers();

    if (orchestrator) {
      orchestrator.removeAllListeners();
    }

    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  function setupEventTracking() {
    const events = [
      'task:created', 'task:started', 'task:stage-changed', 'task:completed', 'task:failed',
      'approval:required', 'approval:timeout', 'approval:resolved', 'approval:granted', 'approval:denied',
      'error:approval', 'error:network', 'error:state-transition'
    ] as const;

    events.forEach(eventName => {
      orchestrator.on(eventName, (data, error) => {
        emittedEvents.push({
          event: eventName,
          timestamp: new Date(),
          data,
          error
        });
      });
    });

    // Track error events specifically
    orchestrator.on('error', (error, context) => {
      emittedEvents.push({
        event: 'error:generic',
        timestamp: new Date(),
        data: context,
        error
      });
    });
  }

  describe('Approval Timeout Handling', () => {
    it('should handle approval timeout with auto-deny configuration', async () => {
      vi.useFakeTimers();

      const task = await orchestrator.createTask({
        description: 'Test timeout with auto-deny',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      // Start execution and wait for approval gate
      let approvalId: string | undefined;
      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          approvalId = data.approvalId;
          resolve(data.approvalId);
        });
      });

      const executionPromise = orchestrator.executeTask(task.id);
      approvalId = await approvalPromise;

      expect(approvalId).toBeDefined();

      // Advance timers to trigger timeout (0.1 minutes = 6 seconds)
      vi.advanceTimersByTime(6 * 1000);

      try {
        await executionPromise;
      } catch (error) {
        // Task should fail due to approval denial on timeout
      }

      // Verify timeout event was emitted
      const timeoutEvent = emittedEvents.find(e => e.event === 'approval:timeout');
      expect(timeoutEvent).toBeDefined();

      // Verify resolved event was emitted with timeout decision
      const resolvedEvent = emittedEvents.find(e => e.event === 'approval:resolved');
      expect(resolvedEvent).toBeDefined();

      // Verify final task status
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask!.status).toBe('failed');

      // Verify approval state in database
      const approvalState = await store.getApprovalState(approvalId!);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('denied');
      expect(approvalState!.approver).toBe('system');
      expect(approvalState!.comment).toBe('Approval timed out');
    });

    it('should handle approval timeout with auto-approve configuration', async () => {
      vi.useFakeTimers();

      const task = await orchestrator.createTask({
        description: 'Test timeout with auto-approve',
        workflow: 'auto-approve-workflow',
        autonomy: 'supervised'
      });

      // Start execution and wait for approval gate
      let approvalId: string | undefined;
      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          approvalId = data.approvalId;
          resolve(data.approvalId);
        });
      });

      const executionPromise = orchestrator.executeTask(task.id);
      approvalId = await approvalPromise;

      expect(approvalId).toBeDefined();

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(6 * 1000);

      await executionPromise;

      // Verify timeout event was emitted
      const timeoutEvent = emittedEvents.find(e => e.event === 'approval:timeout');
      expect(timeoutEvent).toBeDefined();

      // Verify final task status - should complete successfully
      const finalTask = await orchestrator.getTask(task.id);
      expect(finalTask!.status).toBe('completed');

      // Verify approval state in database
      const approvalState = await store.getApprovalState(approvalId!);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('approved');
      expect(approvalState!.approver).toBe('system');
      expect(approvalState!.comment).toBe('Auto-approved due to timeout');
    });

    it('should handle partial approvals with timeout', async () => {
      vi.useFakeTimers();

      const task = await orchestrator.createTask({
        description: 'Test partial approvals with timeout',
        workflow: 'multi-approval-workflow',
        autonomy: 'supervised'
      });

      // Start execution and wait for approval gate
      let approvalId: string | undefined;
      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          approvalId = data.approvalId;
          resolve(data.approvalId);
        });
      });

      const executionPromise = orchestrator.executeTask(task.id);
      approvalId = await approvalPromise;

      expect(approvalId).toBeDefined();

      // Grant partial approvals (2 out of 3 required)
      await orchestrator.grantApproval(approvalId!, 'user1', 'First approval');
      await orchestrator.grantApproval(approvalId!, 'user2', 'Second approval');

      // Verify partial state
      const partialState = await store.getApprovalState(approvalId!);
      expect(partialState!.approvalsReceived).toBe(2);
      expect(partialState!.approvalsRequired).toBe(3);
      expect(partialState!.status).toBe('pending');

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(6 * 1000);

      try {
        await executionPromise;
      } catch (error) {
        // Expected failure due to insufficient approvals
      }

      // Verify timeout event includes partial approval context
      const timeoutEvent = emittedEvents.find(e => e.event === 'approval:timeout');
      expect(timeoutEvent).toBeDefined();

      // Verify final approval state preserves partial approvals
      const finalState = await store.getApprovalState(approvalId!);
      expect(finalState!.approvalsReceived).toBe(2); // Should preserve partial count
      expect(finalState!.status).toBe('denied');
    });
  });

  describe('Network/SDK Error Handling', () => {
    it('should handle Claude SDK errors during approval processing', async () => {
      // Mock SDK to fail
      mockQuery.mockRejectedValueOnce(new Error('Network timeout - Claude SDK unavailable'));

      const task = await orchestrator.createTask({
        description: 'Test SDK error handling',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      // Start execution - should fail at SDK call
      const executionPromise = orchestrator.executeTask(task.id);

      try {
        await executionPromise;
        // If it succeeds unexpectedly, fail the test
        expect.fail('Expected execution to fail due to SDK error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Network timeout');
      }

      // Verify task failure state
      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask!.status).toBe('failed');
      expect(failedTask!.error).toBeDefined();

      // Verify error event was emitted
      const errorEvents = emittedEvents.filter(e => e.event.startsWith('error:'));
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle database connection errors during approval state persistence', async () => {
      const task = await orchestrator.createTask({
        description: 'Test database error handling',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      // Mock database error during approval state save
      const saveApprovalStateSpy = vi.spyOn(store, 'saveApprovalState')
        .mockRejectedValueOnce(new Error('Database connection lost'));

      // Start execution and wait for approval gate
      const approvalPromise = new Promise<string>((resolve, reject) => {
        orchestrator.once('approval:required', (data: any) => {
          resolve(data.approvalId);
        });

        // Set timeout for the promise
        setTimeout(() => reject(new Error('Approval not requested within timeout')), 5000);
      });

      const executionPromise = orchestrator.executeTask(task.id);

      try {
        await approvalPromise;
        // Should fail when trying to save approval state
        expect.fail('Expected approval request to fail due to database error');
      } catch (error) {
        expect(error.message).toMatch(/Database connection lost|Approval not requested/);
      }

      try {
        await executionPromise;
      } catch (error) {
        // Expected failure
      }

      saveApprovalStateSpy.mockRestore();
    });

    it('should handle approval response network errors gracefully', async () => {
      vi.useFakeTimers();

      const task = await orchestrator.createTask({
        description: 'Test network error in approval response',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      // Start execution and wait for approval gate
      let approvalId: string | undefined;
      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          approvalId = data.approvalId;
          resolve(data.approvalId);
        });
      });

      const executionPromise = orchestrator.executeTask(task.id);
      approvalId = await approvalPromise;

      // Mock network error in grant approval
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValueOnce(new Error('Network error: Unable to reach approval service'));

      // Attempt to grant approval - should fail
      try {
        await orchestrator.grantApproval(approvalId!, 'user', 'Approval with network error');
        expect.fail('Expected grant approval to fail due to network error');
      } catch (error) {
        expect(error.message).toContain('Network error');
      }

      // Let timeout handle the approval instead
      vi.advanceTimersByTime(6 * 1000);

      try {
        await executionPromise;
      } catch (error) {
        // Expected failure due to timeout
      }

      grantApprovalSpy.mockRestore();
    });
  });

  describe('Invalid State Transition Rejection', () => {
    it('should reject approval operations on already resolved gates', async () => {
      const config: ApprovalGateConfig = {
        id: 'test-gate',
        type: 'before-stage',
        name: 'Test Gate',
        description: 'Test gate for invalid states',
        required: true,
        timeout: 10,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      // Request and immediately grant approval
      const approvalPromise = controller.requestApproval();
      await controller.grant('user1', 'First approval');
      const result = await approvalPromise;

      expect(result.status).toBe('approved');
      expect(controller.isResolved).toBe(true);

      // Attempt to grant again - should throw error
      await expect(controller.grant('user2', 'Second approval'))
        .rejects
        .toThrow('Cannot grant approval - gate is not pending');

      // Attempt to deny after approval - should throw error
      await expect(controller.deny('user3', 'Attempted denial'))
        .rejects
        .toThrow('Cannot deny approval - gate is not pending');

      controller.dispose();
    });

    it('should reject duplicate approval requests on same gate', async () => {
      const config: ApprovalGateConfig = {
        id: 'duplicate-test-gate',
        type: 'before-stage',
        name: 'Duplicate Test Gate',
        description: 'Test gate for duplicate requests',
        required: true,
        timeout: 10,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'duplicate-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      // First request should succeed
      const firstPromise = controller.requestApproval();

      // Second request should fail
      await expect(controller.requestApproval())
        .rejects
        .toThrow('Approval already requested for this gate');

      // Clean up first request
      await controller.grant('user', 'Cleanup approval');
      await firstPromise;

      controller.dispose();
    });

    it('should reject invalid approval counts', async () => {
      const config: ApprovalGateConfig = {
        id: 'count-test-gate',
        type: 'before-stage',
        name: 'Count Test Gate',
        description: 'Test gate for approval count validation',
        required: true,
        timeout: 10,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'count-test-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      const approvalPromise = controller.requestApproval();

      // First approval should succeed
      await controller.grant('user1', 'Valid approval');
      await approvalPromise;

      // Should be resolved now
      expect(controller.isResolved).toBe(true);

      // Attempt to grant additional approval should fail
      await expect(controller.grant('user2', 'Extra approval'))
        .rejects
        .toThrow('Cannot grant approval - gate is not pending');

      controller.dispose();
    });
  });

  describe('Orphaned Approval Request Handling', () => {
    it('should detect and clean up orphaned approval states', async () => {
      // Create orphaned approval state directly in database
      const orphanedState: ApprovalState = {
        id: 'orphaned-approval-123',
        taskId: 'non-existent-task',
        gateName: 'orphaned-gate',
        status: 'pending',
        requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        stage: 'orphaned-stage',
        agent: 'orphaned-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 60,
        expiresAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // Expired 23 hours ago
        context: { orphaned: true }
      };

      await store.saveApprovalState(orphanedState);

      // Verify orphaned state exists
      const storedOrphaned = await store.getApprovalState('orphaned-approval-123');
      expect(storedOrphaned).toBeDefined();
      expect(storedOrphaned!.taskId).toBe('non-existent-task');

      // Run orphaned cleanup (simulate background cleanup process)
      const orphanedStates = await store.getOrphanedApprovalStates();
      expect(orphanedStates.length).toBeGreaterThan(0);

      const orphanedFound = orphanedStates.find(state => state.id === 'orphaned-approval-123');
      expect(orphanedFound).toBeDefined();

      // Clean up orphaned state
      await store.cleanupOrphanedApprovalStates();

      // Verify orphaned state is marked as denied or removed
      const cleanedState = await store.getApprovalState('orphaned-approval-123');
      if (cleanedState) {
        expect(cleanedState.status).toBe('denied');
        expect(cleanedState.comment).toMatch(/orphaned|expired|cleaned/i);
      }
    });

    it('should handle task cancellation with pending approvals', async () => {
      const task = await orchestrator.createTask({
        description: 'Test task cancellation with pending approval',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      // Start execution and wait for approval gate
      let approvalId: string | undefined;
      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          approvalId = data.approvalId;
          resolve(data.approvalId);
        });
      });

      const executionPromise = orchestrator.executeTask(task.id);
      approvalId = await approvalPromise;

      expect(approvalId).toBeDefined();

      // Cancel task while approval is pending
      await orchestrator.cancelTask(task.id);

      // Verify task is cancelled
      const cancelledTask = await orchestrator.getTask(task.id);
      expect(cancelledTask!.status).toBe('cancelled');

      // Verify approval state is properly cleaned up
      const approvalState = await store.getApprovalState(approvalId!);
      expect(approvalState).toBeDefined();
      expect(approvalState!.status).toBe('denied');
      expect(approvalState!.comment).toBe('Cancelled');

      // Execution should fail or complete with cancellation
      try {
        await executionPromise;
      } catch (error) {
        // Expected behavior - execution fails due to cancellation
        expect(error.message).toMatch(/cancel|abort/i);
      }
    });

    it('should handle approval requests for non-existent tasks', async () => {
      const nonExistentTaskId = 'non-existent-task-id-12345';

      // Attempt to create approval state for non-existent task
      const invalidApprovalState: ApprovalState = {
        id: 'invalid-approval-123',
        taskId: nonExistentTaskId,
        gateName: 'invalid-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'invalid-stage',
        agent: 'invalid-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      // This should either fail or be detected as orphaned
      try {
        await store.saveApprovalState(invalidApprovalState);

        // If save succeeds, verify it's detected as orphaned
        const orphanedStates = await store.getOrphanedApprovalStates();
        const foundOrphaned = orphanedStates.find(state => state.id === 'invalid-approval-123');
        expect(foundOrphaned).toBeDefined();

      } catch (error) {
        // Expected behavior - foreign key constraint should prevent this
        expect(error.message).toMatch(/constraint|foreign key|invalid task/i);
      }
    });
  });

  describe('Concurrent Approval Attempts', () => {
    it('should handle multiple simultaneous grant attempts correctly', async () => {
      const config: ApprovalGateConfig = {
        id: 'concurrent-grant-gate',
        type: 'before-stage',
        name: 'Concurrent Grant Gate',
        description: 'Test gate for concurrent grant attempts',
        required: true,
        timeout: 30,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'concurrent-grant-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      const approvalPromise = controller.requestApproval();

      // Attempt multiple concurrent grants
      const grantPromises = [
        controller.grant('user1', 'First grant attempt'),
        controller.grant('user2', 'Second grant attempt'),
        controller.grant('user3', 'Third grant attempt')
      ];

      // One should succeed, others should fail
      const results = await Promise.allSettled(grantPromises);

      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);

      // Verify approval completed
      const result = await approvalPromise;
      expect(result.status).toBe('approved');

      // Verify state consistency
      expect(controller.isResolved).toBe(true);

      controller.dispose();
    });

    it('should handle concurrent grant and deny attempts', async () => {
      const config: ApprovalGateConfig = {
        id: 'grant-deny-race-gate',
        type: 'before-stage',
        name: 'Grant Deny Race Gate',
        description: 'Test gate for grant/deny race conditions',
        required: true,
        timeout: 30,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'grant-deny-race-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      const approvalPromise = controller.requestApproval();

      // Race between grant and deny
      const racePromises = [
        controller.grant('user1', 'Grant attempt'),
        controller.deny('user2', 'Deny attempt')
      ];

      const results = await Promise.allSettled(racePromises);

      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify approval completed with consistent state
      const result = await approvalPromise;
      expect(['approved', 'denied']).toContain(result.status);
      expect(controller.isResolved).toBe(true);

      controller.dispose();
    });

    it('should maintain database consistency under concurrent approval operations', async () => {
      const numConcurrentGates = 5;
      const controllers: ApprovalGateController[] = [];
      const promises: Promise<any>[] = [];

      try {
        // Create multiple approval gates concurrently
        for (let i = 0; i < numConcurrentGates; i++) {
          const config: ApprovalGateConfig = {
            id: `concurrent-db-gate-${i}`,
            type: 'before-stage',
            name: `Concurrent DB Gate ${i}`,
            description: `Test gate ${i} for database consistency`,
            required: true,
            timeout: 60,
            autoApprove: false,
            minApprovals: 1,
            tags: []
          };

          const controller = new ApprovalGateController({
            config,
            taskId: `concurrent-db-task-${i}`,
            stage: 'test-stage',
            agent: 'test-agent',
            store,
            context: { gateIndex: i }
          });

          controllers.push(controller);

          // Start approval and immediately grant
          const approvalPromise = controller.requestApproval();
          const grantPromise = controller.grant(`user-${i}`, `Grant for gate ${i}`);

          promises.push(Promise.all([approvalPromise, grantPromise]));
        }

        // Wait for all operations to complete
        const results = await Promise.allSettled(promises);

        // Verify all operations succeeded
        const successes = results.filter(r => r.status === 'fulfilled');
        expect(successes.length).toBe(numConcurrentGates);

        // Verify database consistency
        for (let i = 0; i < numConcurrentGates; i++) {
          const approvalState = await store.getApprovalState(`concurrent-db-gate-${i}`);
          expect(approvalState).toBeDefined();
          expect(approvalState!.status).toBe('approved');
          expect(approvalState!.approver).toBe(`user-${i}`);
        }

      } finally {
        // Clean up controllers
        controllers.forEach(controller => controller.dispose());
      }
    });
  });

  describe('Event Emission During Error Scenarios', () => {
    it('should emit appropriate events during timeout scenarios', async () => {
      vi.useFakeTimers();

      const task = await orchestrator.createTask({
        description: 'Test event emission during timeout',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      const approvalPromise = new Promise<string>((resolve) => {
        orchestrator.once('approval:required', (data: any) => {
          resolve(data.approvalId);
        });
      });

      const executionPromise = orchestrator.executeTask(task.id);
      await approvalPromise;

      // Clear existing events to focus on timeout events
      emittedEvents.length = 0;

      // Advance time to trigger timeout
      vi.advanceTimersByTime(6 * 1000);

      try {
        await executionPromise;
      } catch (error) {
        // Expected failure
      }

      // Verify timeout event was emitted
      const timeoutEvent = emittedEvents.find(e => e.event === 'approval:timeout');
      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent!.timestamp).toBeInstanceOf(Date);

      // Verify resolved event was emitted after timeout
      const resolvedEvent = emittedEvents.find(e => e.event === 'approval:resolved');
      expect(resolvedEvent).toBeDefined();

      // Verify events are in correct order
      const timeoutIndex = emittedEvents.findIndex(e => e.event === 'approval:timeout');
      const resolvedIndex = emittedEvents.findIndex(e => e.event === 'approval:resolved');
      expect(timeoutIndex).toBeLessThan(resolvedIndex);
    });

    it('should emit error events for network failures', async () => {
      // Mock SDK failure
      mockQuery.mockRejectedValueOnce(new Error('Network connection failed'));

      const task = await orchestrator.createTask({
        description: 'Test error event emission',
        workflow: 'timeout-test-workflow',
        autonomy: 'supervised'
      });

      try {
        await orchestrator.executeTask(task.id);
        expect.fail('Expected execution to fail');
      } catch (error) {
        // Expected failure
      }

      // Verify error events were emitted
      const errorEvents = emittedEvents.filter(e =>
        e.event.startsWith('error:') || e.error !== undefined
      );
      expect(errorEvents.length).toBeGreaterThan(0);

      // Verify error details
      const networkErrorEvent = errorEvents.find(e =>
        e.error?.message.includes('Network connection failed')
      );
      expect(networkErrorEvent).toBeDefined();
    });
  });

  describe('Database Consistency During Error Conditions', () => {
    it('should maintain database consistency when approval operations fail', async () => {
      const config: ApprovalGateConfig = {
        id: 'db-error-gate',
        type: 'before-stage',
        name: 'DB Error Gate',
        description: 'Test gate for database error handling',
        required: true,
        timeout: 60,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      const controller = new ApprovalGateController({
        config,
        taskId: 'db-error-task',
        stage: 'test-stage',
        agent: 'test-agent',
        store,
        context: {}
      });

      const approvalPromise = controller.requestApproval();

      // Mock database error during state update
      const updateSpy = vi.spyOn(store, 'updateApprovalState')
        .mockRejectedValueOnce(new Error('Database write failed'));

      try {
        await controller.grant('user', 'Grant with DB error');
        expect.fail('Expected grant to fail due to database error');
      } catch (error) {
        expect(error.message).toBe('Database write failed');
      }

      // Verify approval is still pending despite error
      expect(controller.isPending).toBe(true);

      // Restore database function and try again
      updateSpy.mockRestore();
      await controller.grant('user', 'Successful grant after error');

      const result = await approvalPromise;
      expect(result.status).toBe('approved');

      controller.dispose();
    });

    it('should handle database corruption recovery gracefully', async () => {
      const config: ApprovalGateConfig = {
        id: 'corruption-test-gate',
        type: 'before-stage',
        name: 'Corruption Test Gate',
        description: 'Test gate for corruption recovery',
        required: true,
        timeout: 60,
        autoApprove: false,
        minApprovals: 1,
        tags: []
      };

      // Create approval state
      const initialState: ApprovalState = {
        id: 'corruption-test-gate',
        taskId: 'corruption-test-task',
        gateName: 'Corruption Test Gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'test-stage',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(initialState);

      // Verify state was saved
      const savedState = await store.getApprovalState('corruption-test-gate');
      expect(savedState).toBeDefined();

      // Simulate corruption by directly modifying database state to invalid values
      const corruptedState = {
        ...initialState,
        approvalsReceived: -1, // Invalid value
        approvalsRequired: 0,  // Invalid value
        status: 'invalid-status' as any
      };

      // This should either fail or be corrected
      try {
        await store.updateApprovalState('corruption-test-gate', corruptedState);

        // If update succeeds, verify the system handles invalid data
        const retrievedState = await store.getApprovalState('corruption-test-gate');

        // System should either reject invalid data or sanitize it
        if (retrievedState) {
          expect(retrievedState.approvalsReceived).toBeGreaterThanOrEqual(0);
          expect(retrievedState.approvalsRequired).toBeGreaterThan(0);
          expect(['pending', 'approved', 'denied']).toContain(retrievedState.status);
        }

      } catch (error) {
        // Expected behavior - database constraints should prevent corruption
        expect(error.message).toMatch(/constraint|validation|invalid/i);
      }
    });
  });
});