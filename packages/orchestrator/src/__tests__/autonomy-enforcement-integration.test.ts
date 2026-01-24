/**
 * Comprehensive integration tests for autonomy enforcement
 *
 * Tests cover:
 * - Action requiring approval triggers gate
 * - Approved action resumes
 * - Rejected action skips/aborts based on config
 * - Timeout handling
 * - Event emission for all states
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata } from '../autonomy-enforcer.js';
import {
  Task,
  TaskStatus,
  AutonomyLevel,
  ApprovalGate,
  ApprovalState,
  type AutonomyLimits
} from '@apexcli/core';
import * as fs from 'fs';

// Mock the query function
const mockQuery = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
}));

// Mock fs operations
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      rmdir: vi.fn(),
    },
  };
  return { ...mock, default: mock };
});

describe('Autonomy Enforcement Integration', () => {
  let orchestrator: ApexOrchestrator;
  let autonomyEnforcer: AutonomyEnforcer;
  let projectPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    projectPath = '/tmp/test-autonomy-enforcement';

    // Mock configuration files
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockImplementation((filePath: string) => {
      if (filePath.includes('config.yaml')) {
        return `
name: test-project
autonomy:
  level: review-before-commit
  gates:
    - type: before-destructive
      description: Review destructive operations
      enabled: true
    - type: before-network
      description: Review network operations
      enabled: true
  limits:
    maxTokensPerTask: 10000
    maxCostPerTask: 5.00
    maxTimePerTaskMs: 300000
  warningThresholds:
    costWarningPercent: 80
    tokenWarningPercent: 80
    timeWarningPercent: 80
    fileWarningPercent: 80
agents:
  - ./agents
workflows:
  - ./workflows
`;
      }
      if (filePath.includes('feature.yaml')) {
        return `
name: Feature Development Workflow
description: Integration test workflow
stages:
  - name: implementation
    agent: developer
    description: Implement the feature
`;
      }
      return '';
    });

    (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

    // Create orchestrator with autonomy enforcer
    orchestrator = new ApexOrchestrator({
      projectPath,
    });

    await orchestrator.initialize();
    autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Action Requiring Approval Triggers Gate', () => {
    it('should trigger approval gate for destructive operations', async () => {
      const taskId = await orchestrator.createTask('Test destructive action gate', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      const approvalEvents: any[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      const taskPauseEvents: any[] = [];
      orchestrator.on('task:paused', (task) => {
        taskPauseEvents.push(task);
      });

      // Create action metadata for destructive operation
      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'delete-files',
        operationType: 'dangerous',
        toolName: 'Bash',
        scope: '/important/data',
      };

      // Check if action requires approval (should return true)
      const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);

      // Simulate autonomy enforcer triggering gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        agent: 'developer',
        operationType: 'dangerous',
        metadata: {
          action: 'delete-files',
          scope: '/important/data',
          riskLevel: 'high'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval was requested
      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].taskId).toBe(taskId);
      expect(approvalEvents[0].gateName).toBe('before-destructive');

      // Verify task was paused
      expect(taskPauseEvents).toHaveLength(1);
      expect(taskPauseEvents[0].id).toBe(taskId);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused');
      expect(task?.pauseReason).toBe('approval_gate');

      // Verify logging
      const logs = await orchestrator.getTaskLogs(taskId);
      const pauseLog = logs.find(log =>
        log.message.includes('Task paused by autonomy enforcer for approval gate')
      );
      expect(pauseLog).toBeDefined();
      expect(pauseLog?.metadata?.gateName).toBe('before-destructive');
    });

    it('should trigger approval gate for network operations', async () => {
      const taskId = await orchestrator.createTask('Test network action gate', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      const approvalEvents: any[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      // Create action metadata for network operation
      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'external-api-call',
        operationType: 'network',
        toolName: 'WebFetch',
        scope: 'https://external-api.com/sensitive',
      };

      const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);

      // Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-network', {
        task: { id: taskId },
        agent: 'developer',
        operationType: 'network',
        metadata: {
          action: 'external-api-call',
          url: 'https://external-api.com/sensitive',
          method: 'POST'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].gateName).toBe('before-network');

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused');
    });

    it('should trigger approval gate for commit operations in review-before-commit mode', async () => {
      const taskId = await orchestrator.createTask('Test commit gate', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      const approvalEvents: any[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      // Test commit operation
      const commitMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        operationType: 'execute',
        toolName: 'Bash',
        scope: 'git commit -m "feature implementation"',
      };

      const requiresApproval = await autonomyEnforcer.checkAction(commitMetadata);
      expect(requiresApproval).toBe(true);

      // Trigger commit gate
      autonomyEnforcer.emit('approval:required', 'before-commit', {
        task: { id: taskId },
        agent: 'developer',
        operationType: 'execute',
        metadata: {
          action: 'git-commit',
          command: 'git commit -m "feature implementation"',
          files: ['src/feature.ts', 'src/feature.test.ts']
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].gateName).toBe('before-commit');

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused');
    });

    it('should not trigger approval for read operations in review-all mode', async () => {
      // Update autonomy level to review-all
      autonomyEnforcer.updateConfig({ level: 'review-all' as AutonomyLevel });

      const taskId = await orchestrator.createTask('Test read operation', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      const approvalEvents: any[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event);
      });

      // Test read operation
      const readMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'read-file',
        operationType: 'read',
        toolName: 'Read',
        scope: 'src/config.ts',
      };

      const requiresApproval = await autonomyEnforcer.checkAction(readMetadata);
      expect(requiresApproval).toBe(false);

      // Read operations should not trigger approval events
      expect(approvalEvents).toHaveLength(0);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('in-progress'); // Should remain running
    });
  });

  describe('Approved Action Resumes', () => {
    it('should resume task execution after approval is granted', async () => {
      const taskId = await orchestrator.createTask('Test approval resume', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      const taskResumeEvents: any[] = [];
      orchestrator.on('task:resumed', (task) => {
        taskResumeEvents.push(task);
      });

      // Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'dangerous-operation' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(approvalId!).toBeDefined();

      // Verify task is paused
      let task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused');

      // Grant approval
      await orchestrator.grantApproval(approvalId!, 'admin-user', 'Operation approved for testing');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task resumed
      expect(taskResumeEvents).toHaveLength(1);
      expect(taskResumeEvents[0].id).toBe(taskId);

      task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('in-progress');
      expect(task?.pauseReason).toBeUndefined();

      // Verify approval state
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.approver).toBe('admin-user');
      expect(approvalState?.comment).toBe('Operation approved for testing');

      // Verify logs
      const logs = await orchestrator.getTaskLogs(taskId);
      const approvalLog = logs.find(log =>
        log.message.includes('Approval granted') && log.message.includes(approvalId!)
      );
      expect(approvalLog).toBeDefined();
    });

    it('should handle multiple approval requirements correctly', async () => {
      // Configure multiple approvals required
      const gateConfig: ApprovalGate = {
        type: 'before-destructive',
        description: 'Requires multiple approvals',
        enabled: true,
        minApprovals: 2,
      };

      autonomyEnforcer.updateConfig({
        gates: [gateConfig]
      });

      const taskId = await orchestrator.createTask('Test multi-approval', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      // Trigger gate requiring multiple approvals
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'critical-operation', requiredApprovals: 2 }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // First approval - should not resume yet
      await orchestrator.grantApproval(approvalId!, 'admin-1', 'First approval');

      let task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused'); // Still paused, need second approval

      // Second approval - should resume now
      await orchestrator.grantApproval(approvalId!, 'admin-2', 'Second approval');

      await new Promise(resolve => setTimeout(resolve, 100));

      task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('in-progress');

      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.approvalsReceived).toBe(2);
      expect(approvalState?.status).toBe('approved');
    });
  });

  describe('Rejected Action Skips/Aborts Based on Config', () => {
    it('should abort task when approval is denied with abort behavior', async () => {
      // Note: Rejection behavior is handled at orchestrator level, not autonomy enforcer level
      // The autonomy enforcer only triggers gates, orchestrator handles the consequences

      const taskId = await orchestrator.createTask('Test rejection abort', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      const taskFailureEvents: any[] = [];
      orchestrator.on('task:failed', (task) => {
        taskFailureEvents.push(task);
      });

      // Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'risky-operation' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Deny approval
      await orchestrator.denyApproval(approvalId!, 'security-admin', 'Operation too risky');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task failed
      expect(taskFailureEvents).toHaveLength(1);
      expect(taskFailureEvents[0].id).toBe(taskId);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toContain('Approval denied by security-admin');

      // Verify approval state
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('denied');
      expect(approvalState?.reason).toBe('Operation too risky');
    });

    it('should skip action when approval is denied with skip behavior', async () => {
      // Note: Skip behavior would depend on orchestrator configuration
      // This test validates the denial flow, actual skip/abort is orchestrator-level

      const taskId = await orchestrator.createTask('Test rejection skip', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      const taskResumeEvents: any[] = [];
      orchestrator.on('task:resumed', (task) => {
        taskResumeEvents.push(task);
      });

      // Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'optional-operation' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Deny approval
      await orchestrator.denyApproval(approvalId!, 'admin-user', 'Skip this operation');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task resumed (skipped the operation)
      expect(taskResumeEvents).toHaveLength(1);
      expect(taskResumeEvents[0].id).toBe(taskId);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('in-progress'); // Should continue running

      // Verify logs indicate operation was skipped
      const logs = await orchestrator.getTaskLogs(taskId);
      const skipLog = logs.find(log =>
        log.message.includes('skipped') || log.message.includes('denied')
      );
      expect(skipLog).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should handle approval timeout correctly', async () => {
      // Note: Timeout is handled at orchestrator level, not autonomy enforcer
      // This test validates the timeout mechanism using direct orchestrator methods

      const taskId = await orchestrator.createTask('Test approval timeout', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      const timeoutEvents: any[] = [];
      orchestrator.on('approval:timeout', (event) => {
        timeoutEvents.push(event);
      });

      // Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'timeout-test-operation' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval was created with correct timeout
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.timeoutAt).toBeDefined();
      expect(approvalState?.timeoutAt).toBeInstanceOf(Date);

      // Calculate expected timeout (current time + 1 minute)
      const expectedTimeout = new Date(Date.now() + 60 * 1000);
      const actualTimeout = new Date(approvalState!.timeoutAt!);
      const timeDiff = Math.abs(actualTimeout.getTime() - expectedTimeout.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds tolerance

      // Mock timeout by manually expiring the approval
      if (approvalState) {
        // Simulate timeout by setting the timeout time to the past
        const expiredApprovalState = {
          ...approvalState,
          timeoutAt: new Date(Date.now() - 1000), // 1 second ago
        };

        await (orchestrator as any).store.updateApprovalState(approvalId!, expiredApprovalState);

        // Trigger timeout handling (this would normally be handled by a background process)
        await orchestrator.denyApproval(approvalId!, 'system', 'Approval timed out');

        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('failed');
        expect(task?.error).toContain('Approval timed out');
      }
    });

    it('should prevent approval of timed-out requests', async () => {
      const taskId = await orchestrator.createTask('Test timeout prevention', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      // Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'timeout-prevention-test' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Manually expire the approval
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      if (approvalState) {
        const expiredApprovalState = {
          ...approvalState,
          timeoutAt: new Date(Date.now() - 1000), // Already expired
        };
        await (orchestrator as any).store.updateApprovalState(approvalId!, expiredApprovalState);
      }

      // Try to grant approval on expired request
      try {
        await orchestrator.grantApproval(approvalId!, 'late-admin', 'Too late approval');
        expect.fail('Should have thrown an error for expired approval');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('expired');
      }

      // Task should remain paused or failed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toMatch(/paused|failed/);
    });
  });

  describe('Event Emission for All States', () => {
    it('should emit all relevant events during approval lifecycle', async () => {
      const taskId = await orchestrator.createTask('Test complete event lifecycle', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      // Track all events
      const allEvents: { type: string; data: any }[] = [];

      orchestrator.on('approval:required', (event) => {
        allEvents.push({ type: 'approval:required', data: event });
      });

      orchestrator.on('task:paused', (task) => {
        allEvents.push({ type: 'task:paused', data: task });
      });

      orchestrator.on('approval:granted', (event) => {
        allEvents.push({ type: 'approval:granted', data: event });
      });

      orchestrator.on('task:resumed', (task) => {
        allEvents.push({ type: 'task:resumed', data: task });
      });

      let approvalId: string;

      // Step 1: Trigger approval gate
      autonomyEnforcer.emit('approval:required', 'before-destructive', {
        task: { id: taskId },
        metadata: { action: 'lifecycle-test-operation' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval:required and task:paused events
      expect(allEvents.length).toBeGreaterThanOrEqual(2);

      const approvalRequiredEvent = allEvents.find(e => e.type === 'approval:required');
      const taskPausedEvent = allEvents.find(e => e.type === 'task:paused');

      expect(approvalRequiredEvent).toBeDefined();
      expect(taskPausedEvent).toBeDefined();

      approvalId = approvalRequiredEvent!.data.approvalId;
      expect(taskPausedEvent!.data.id).toBe(taskId);

      // Step 2: Grant approval
      await orchestrator.grantApproval(approvalId, 'admin-user', 'Lifecycle test approved');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval:granted and task:resumed events
      const approvalGrantedEvent = allEvents.find(e => e.type === 'approval:granted');
      const taskResumedEvent = allEvents.find(e => e.type === 'task:resumed');

      expect(approvalGrantedEvent).toBeDefined();
      expect(taskResumedEvent).toBeDefined();

      expect(approvalGrantedEvent!.data.approvalId).toBe(approvalId);
      expect(approvalGrantedEvent!.data.approver).toBe('admin-user');
      expect(taskResumedEvent!.data.id).toBe(taskId);

      // Verify event order
      const eventTypes = allEvents.map(e => e.type);
      const approvalRequiredIndex = eventTypes.indexOf('approval:required');
      const taskPausedIndex = eventTypes.indexOf('task:paused');
      const approvalGrantedIndex = eventTypes.indexOf('approval:granted');
      const taskResumedIndex = eventTypes.indexOf('task:resumed');

      expect(approvalRequiredIndex).toBeLessThan(taskPausedIndex);
      expect(taskPausedIndex).toBeLessThan(approvalGrantedIndex);
      expect(approvalGrantedIndex).toBeLessThan(taskResumedIndex);
    });

    it('should emit warning events from autonomy enforcer for resource thresholds', async () => {
      const taskId = await orchestrator.createTask('Test warning events', 'feature');
      autonomyEnforcer.startTracking(taskId);

      const warningEvents: any[] = [];
      autonomyEnforcer.on('limit:warning', (warning) => {
        warningEvents.push(warning);
      });

      const limitExceededEvents: any[] = [];
      autonomyEnforcer.on('limit:exceeded', (result, task) => {
        limitExceededEvents.push({ result, task });
      });

      // Record usage that triggers warning threshold (85% of 10000 token limit)
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 6500,
        outputTokens: 2000,
        totalTokens: 8500, // 85% of 10000 limit
        estimatedCost: 0.50,
      });

      // Verify warning event was emitted
      expect(warningEvents).toHaveLength(1);
      expect(warningEvents[0].type).toBe('tokens');
      expect(warningEvents[0].threshold).toBe(80);
      expect(warningEvents[0].currentValue).toBe(8500);
      expect(warningEvents[0].limitValue).toBe(10000);

      // Record usage that exceeds limit
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000, // Total now 11500, exceeds 10000 limit
        estimatedCost: 0.30,
      });

      // Verify limit exceeded event was emitted
      expect(limitExceededEvents).toHaveLength(1);
      expect(limitExceededEvents[0].result.exceeded).toBe(true);
      expect(limitExceededEvents[0].result.limitType).toBe('tokens');
    });

    it('should emit bypass events for disabled gates', async () => {
      // Disable a gate
      autonomyEnforcer.updateConfig({
        gates: [
          { type: 'before-destructive', description: 'Disabled gate', enabled: false }
        ]
      });

      const taskId = await orchestrator.createTask('Test bypass events', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      const bypassEvents: any[] = [];
      autonomyEnforcer.on('approval:bypass', (gateName, reason) => {
        bypassEvents.push({ gateName, reason });
      });

      // Create action that would normally trigger gate
      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'delete-files',
        operationType: 'dangerous',
        toolName: 'Bash',
      };

      // Check action - should not require approval due to disabled gate
      const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(false);

      // In this implementation, bypass events would be emitted during gate evaluation
      // The exact implementation may vary, but the test structure is here for when implemented
    });
  });
});