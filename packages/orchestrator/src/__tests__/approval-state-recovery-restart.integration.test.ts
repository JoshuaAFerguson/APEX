/**
 * Integration tests for approval state recovery after orchestrator restart
 * Tests that pending approvals persisted in SQLite are correctly recovered
 * and can still be approved/resumed after the orchestrator is restarted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  ApprovalState,
  ApprovalStatus,
  generateTaskId,
  generateApprovalId,
  Task,
  TaskStatus,
  initializeApex
} from '@apexcli/core';

// Mock the Claude Agent SDK query function
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process for git operations
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;

describe('Approval State Recovery After Restart Integration Tests', () => {
  let testDir: string;
  let orchestrator1: ApexOrchestrator;
  let orchestrator2: ApexOrchestrator;

  beforeEach(async () => {
    // Create temporary directory for test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-recovery-test-'));

    // Initialize APEX project structure in test directory
    await initializeApex(testDir, {
      projectName: 'approval-recovery-test',
      language: 'typescript',
      framework: 'node',
    });

    // Create a workflow with approval gate
    const workflowContent = `
name: test-approval-workflow
description: Workflow with approval gate for testing restart recovery
gates:
  - id: test-approval-gate
    name: Test Approval
    description: Test approval gate for restart recovery
    required: true
    autoApprove: false
    timeout: 3600
    minApprovals: 1

stages:
  - name: planning
    agent: planner
    description: Plan the implementation
  - name: development
    agent: developer
    description: Implement the feature
    dependsOn:
      - planning
    gate: test-approval-gate
  - name: testing
    agent: tester
    description: Test the implementation
    dependsOn:
      - development
`;

    await fs.writeFile(
      path.join(testDir, '.apex', 'workflows', 'test-approval-workflow.yaml'),
      workflowContent
    );

    // Create agent files
    const agents = ['planner', 'developer', 'tester'];
    for (const agent of agents) {
      const agentContent = `---
name: ${agent}
description: ${agent.charAt(0).toUpperCase() + agent.slice(1)} agent for testing
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a ${agent} agent for testing approval recovery.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', `${agent}.md`),
        agentContent
      );
    }

    // Mock the query function to simulate agent responses
    mockQuery.mockImplementation(async () => ({
      content: [{ type: 'text', text: 'Stage completed successfully.' }],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      stop_reason: 'end_turn',
      inputMessages: [],
      outputMessages: [],
    }));
  });

  afterEach(async () => {
    // Cleanup orchestrators
    if (orchestrator1) {
      try {
        orchestrator1.store?.close();
      } catch {
        // Ignore if already closed
      }
    }
    if (orchestrator2) {
      try {
        orchestrator2.store?.close();
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

  describe('Single approval recovery', () => {
    it('should recover pending approval after orchestrator restart', async () => {
      // Phase 1: Create orchestrator and setup approval state
      orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator1.initialize();

      // Create a task
      const taskId = generateTaskId();
      const approvalId = generateApprovalId();

      const task: Task = {
        id: taskId,
        title: 'Test Task for Approval Recovery',
        description: 'Testing approval state recovery after restart',
        workflow: 'test-approval-workflow',
        status: 'awaiting-approval' as TaskStatus,
        stage: 'development',
        createdAt: new Date(),
        updatedAt: new Date(),
        pauseReason: 'approval_gate',
        approvalState: {
          approvalId,
          gateName: 'test-approval-gate',
          stage: 'development',
        }
      };

      // Save task via orchestrator
      await orchestrator1.store.createTask(task);

      // Create approval state
      const approvalState: ApprovalState = {
        id: approvalId,
        taskId: taskId,
        gateName: 'test-approval-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        context: {
          stage: 'development',
          agent: 'developer',
          workflowName: 'test-approval-workflow'
        },
        stage: 'development',
        agent: 'developer',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 60,
      };

      // Save approval state
      await orchestrator1.store.saveApprovalState(approvalState);

      // Verify approval exists before restart
      const pendingApprovalsBeforeRestart = await orchestrator1.store.getPendingApprovals();
      expect(pendingApprovalsBeforeRestart).toHaveLength(1);
      expect(pendingApprovalsBeforeRestart[0].id).toBe(approvalId);
      expect(pendingApprovalsBeforeRestart[0].status).toBe('pending');

      // Phase 2: Simulate restart - close first orchestrator
      orchestrator1.store.close();

      // Phase 3: Create new orchestrator instance (same project path)
      orchestrator2 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator2.initialize();

      // Phase 4: Verify recovery - pending approval should be recovered
      const pendingApprovalsAfterRestart = await orchestrator2.store.getPendingApprovals();
      expect(pendingApprovalsAfterRestart).toHaveLength(1);

      const recoveredApproval = pendingApprovalsAfterRestart[0];
      expect(recoveredApproval.id).toBe(approvalId);
      expect(recoveredApproval.taskId).toBe(taskId);
      expect(recoveredApproval.gateName).toBe('test-approval-gate');
      expect(recoveredApproval.status).toBe('pending');
      expect(recoveredApproval.stage).toBe('development');
      expect(recoveredApproval.agent).toBe('developer');

      // Verify task is also recovered in paused state
      const recoveredTask = await orchestrator2.getTask(taskId);
      expect(recoveredTask).toBeDefined();
      expect(recoveredTask!.status).toBe('awaiting-approval');
      expect(recoveredTask!.pauseReason).toBe('approval_gate');
    });

    it('should grant approval on recovered pending approval and resume task', async () => {
      // Phase 1: Create orchestrator and setup approval state
      orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator1.initialize();

      const taskId = generateTaskId();
      const approvalId = generateApprovalId();

      // Create and save task
      const task: Task = {
        id: taskId,
        title: 'Test Task for Approval Grant After Restart',
        description: 'Testing approval grant after restart',
        workflow: 'test-approval-workflow',
        status: 'awaiting-approval' as TaskStatus,
        stage: 'development',
        createdAt: new Date(),
        updatedAt: new Date(),
        pauseReason: 'approval_gate',
        approvalState: {
          approvalId,
          gateName: 'test-approval-gate',
          stage: 'development',
        }
      };

      await orchestrator1.store.saveTask(task);

      // Create and save approval state
      const approvalState: ApprovalState = {
        id: approvalId,
        taskId: taskId,
        gateName: 'test-approval-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: new Date(),
        context: {
          stage: 'development',
          agent: 'developer',
        },
        stage: 'development',
        agent: 'developer',
        approvalsReceived: 0,
        approvalsRequired: 1,
      };

      await orchestrator1.store.saveApprovalState(approvalState);

      // Phase 2: Simulate restart
      orchestrator1.store.close();

      // Phase 3: Create new orchestrator
      orchestrator2 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator2.initialize();

      // Setup event tracking for approval events
      const events: Array<{ event: string; data: any }> = [];

      orchestrator2.on('approval:approved', (data) => {
        events.push({ event: 'approval:approved', data });
      });

      orchestrator2.on('task:session-resumed', (data) => {
        events.push({ event: 'task:session-resumed', data });
      });

      // Phase 4: Grant approval on recovered approval
      await orchestrator2.grantApproval(approvalId, 'test-approver@example.com', 'Approved after restart');

      // Verify approval was granted
      const grantedApproval = await orchestrator2.store.getApprovalStateById(approvalId);
      expect(grantedApproval).toBeDefined();
      expect(grantedApproval!.status).toBe('approved');
      expect(grantedApproval!.approver).toBe('test-approver@example.com');
      expect(grantedApproval!.comment).toBe('Approved after restart');
      expect(grantedApproval!.respondedAt).toBeDefined();

      // Verify task status was updated
      const resumedTask = await orchestrator2.getTask(taskId);
      expect(resumedTask).toBeDefined();
      expect(resumedTask!.status).toBe('in-progress');

      // Verify events were emitted
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('approval:approved');
      expect(events[0].data.approvalId).toBe(approvalId);
      expect(events[1].event).toBe('task:session-resumed');
      expect(events[1].data.taskId).toBe(taskId);
    });
  });

  describe('Multiple approval recovery', () => {
    it('should recover multiple pending approvals from different tasks', async () => {
      // Phase 1: Create orchestrator and multiple approval states
      orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator1.initialize();

      const taskIds = [generateTaskId(), generateTaskId()];
      const approvalIds = [generateApprovalId(), generateApprovalId()];

      // Create multiple tasks and approval states
      for (let i = 0; i < 2; i++) {
        const task: Task = {
          id: taskIds[i],
          title: `Test Task ${i + 1} for Multiple Approval Recovery`,
          description: `Testing multiple approval recovery task ${i + 1}`,
          workflow: 'test-approval-workflow',
          status: 'awaiting-approval' as TaskStatus,
          stage: 'development',
          createdAt: new Date(),
          updatedAt: new Date(),
          pauseReason: 'approval_gate',
          approvalState: {
            approvalId: approvalIds[i],
            gateName: 'test-approval-gate',
            stage: 'development',
          }
        };

        await orchestrator1.store.createTask(task);

        const approvalState: ApprovalState = {
          id: approvalIds[i],
          taskId: taskIds[i],
          gateName: 'test-approval-gate',
          status: 'pending' as ApprovalStatus,
          requestedAt: new Date(Date.now() + i * 1000), // Different timestamps
          context: {
            stage: 'development',
            agent: 'developer',
          },
          stage: 'development',
          agent: 'developer',
          approvalsReceived: 0,
          approvalsRequired: 1,
        };

        await orchestrator1.store.saveApprovalState(approvalState);
      }

      // Verify multiple approvals exist before restart
      const pendingApprovalsBeforeRestart = await orchestrator1.store.getPendingApprovals();
      expect(pendingApprovalsBeforeRestart).toHaveLength(2);

      // Phase 2: Simulate restart
      orchestrator1.store.close();

      // Phase 3: Create new orchestrator
      orchestrator2 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator2.initialize();

      // Phase 4: Verify recovery of multiple approvals
      const pendingApprovalsAfterRestart = await orchestrator2.store.getPendingApprovals();
      expect(pendingApprovalsAfterRestart).toHaveLength(2);

      // Verify all approval details are preserved
      for (let i = 0; i < 2; i++) {
        const recoveredApproval = pendingApprovalsAfterRestart.find(a => a.id === approvalIds[i]);
        expect(recoveredApproval).toBeDefined();
        expect(recoveredApproval!.taskId).toBe(taskIds[i]);
        expect(recoveredApproval!.gateName).toBe('test-approval-gate');
        expect(recoveredApproval!.status).toBe('pending');
        expect(recoveredApproval!.stage).toBe('development');
      }

      // Verify tasks are recovered in correct state
      for (let i = 0; i < 2; i++) {
        const recoveredTask = await orchestrator2.getTask(taskIds[i]);
        expect(recoveredTask).toBeDefined();
        expect(recoveredTask!.status).toBe('awaiting-approval');
        expect(recoveredTask!.pauseReason).toBe('approval_gate');
      }
    });
  });

  describe('Approval state integrity', () => {
    it('should preserve all approval fields after restart', async () => {
      // Phase 1: Create orchestrator with comprehensive approval state
      orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator1.initialize();

      const taskId = generateTaskId();
      const approvalId = generateApprovalId();
      const requestedAt = new Date('2024-01-15T10:30:00Z');
      const expiresAt = new Date('2024-01-15T11:30:00Z');

      // Create comprehensive approval state with all fields
      const comprehensiveApprovalState: ApprovalState = {
        id: approvalId,
        taskId: taskId,
        gateName: 'test-approval-gate',
        status: 'pending' as ApprovalStatus,
        requestedAt: requestedAt,
        context: {
          stage: 'development',
          agent: 'developer',
          workflowName: 'test-approval-workflow',
          customData: { priority: 'high', environment: 'production' }
        },
        stage: 'development',
        agent: 'developer',
        approvalsReceived: 0,
        approvalsRequired: 1,
        timeoutMinutes: 60,
        expiresAt: expiresAt,
      };

      // Create matching task
      const task: Task = {
        id: taskId,
        title: 'Comprehensive Approval Test Task',
        description: 'Testing comprehensive approval field preservation',
        workflow: 'test-approval-workflow',
        status: 'awaiting-approval' as TaskStatus,
        stage: 'development',
        createdAt: new Date(),
        updatedAt: new Date(),
        pauseReason: 'approval_gate',
        approvalState: {
          approvalId,
          gateName: 'test-approval-gate',
          stage: 'development',
        }
      };

      await orchestrator1.store.createTask(task);
      await orchestrator1.store.saveApprovalState(comprehensiveApprovalState);

      // Phase 2: Simulate restart
      orchestrator1.store.close();

      // Phase 3: Create new orchestrator
      orchestrator2 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator2.initialize();

      // Phase 4: Verify all fields are preserved
      const recoveredApproval = await orchestrator2.store.getApprovalStateById(approvalId);
      expect(recoveredApproval).toBeDefined();

      // Verify all primitive fields
      expect(recoveredApproval!.id).toBe(approvalId);
      expect(recoveredApproval!.taskId).toBe(taskId);
      expect(recoveredApproval!.gateName).toBe('test-approval-gate');
      expect(recoveredApproval!.status).toBe('pending');
      expect(recoveredApproval!.stage).toBe('development');
      expect(recoveredApproval!.agent).toBe('developer');
      expect(recoveredApproval!.approvalsReceived).toBe(0);
      expect(recoveredApproval!.approvalsRequired).toBe(1);
      expect(recoveredApproval!.timeoutMinutes).toBe(60);

      // Verify date fields are properly preserved
      expect(recoveredApproval!.requestedAt).toEqual(requestedAt);
      expect(recoveredApproval!.expiresAt).toEqual(expiresAt);

      // Verify context object is properly deserialized
      expect(recoveredApproval!.context).toBeDefined();
      expect(recoveredApproval!.context!.stage).toBe('development');
      expect(recoveredApproval!.context!.agent).toBe('developer');
      expect(recoveredApproval!.context!.workflowName).toBe('test-approval-workflow');
      expect(recoveredApproval!.context!.customData).toEqual({
        priority: 'high',
        environment: 'production'
      });
    });

    it('should correctly order recovered approvals by requestedAt', async () => {
      // Phase 1: Create multiple approvals with different timestamps
      orchestrator1 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator1.initialize();

      const approvalData = [
        { id: generateApprovalId(), taskId: generateTaskId(), requestedAt: new Date('2024-01-15T10:00:00Z') },
        { id: generateApprovalId(), taskId: generateTaskId(), requestedAt: new Date('2024-01-15T09:30:00Z') },
        { id: generateApprovalId(), taskId: generateTaskId(), requestedAt: new Date('2024-01-15T10:15:00Z') },
      ];

      // Create approvals with different timestamps (not in order)
      for (const data of approvalData) {
        const task: Task = {
          id: data.taskId,
          title: `Test Task for Order Test`,
          description: 'Testing approval order preservation',
          workflow: 'test-approval-workflow',
          status: 'awaiting-approval' as TaskStatus,
          stage: 'development',
          createdAt: new Date(),
          updatedAt: new Date(),
          pauseReason: 'approval_gate',
          approvalState: {
            approvalId: data.id,
            gateName: 'test-approval-gate',
            stage: 'development',
          }
        };

        const approvalState: ApprovalState = {
          id: data.id,
          taskId: data.taskId,
          gateName: 'test-approval-gate',
          status: 'pending' as ApprovalStatus,
          requestedAt: data.requestedAt,
          context: { stage: 'development' },
          stage: 'development',
          agent: 'developer',
          approvalsReceived: 0,
          approvalsRequired: 1,
        };

        await orchestrator1.store.createTask(task);
        await orchestrator1.store.saveApprovalState(approvalState);
      }

      // Phase 2: Simulate restart
      orchestrator1.store.close();

      // Phase 3: Create new orchestrator
      orchestrator2 = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator2.initialize();

      // Phase 4: Verify ordering is preserved (should be ordered by requestedAt ASC)
      const recoveredApprovals = await orchestrator2.store.getPendingApprovals();
      expect(recoveredApprovals).toHaveLength(3);

      // Verify ordering: earliest first
      const expectedOrder = [
        approvalData[1], // 09:30:00
        approvalData[0], // 10:00:00
        approvalData[2], // 10:15:00
      ];

      for (let i = 0; i < 3; i++) {
        expect(recoveredApprovals[i].id).toBe(expectedOrder[i].id);
        expect(recoveredApprovals[i].requestedAt).toEqual(expectedOrder[i].requestedAt);
      }
    });
  });
});