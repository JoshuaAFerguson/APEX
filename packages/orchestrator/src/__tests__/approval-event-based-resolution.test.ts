/**
 * Test suite for event-based approval resolution mechanism
 *
 * Tests the implementation of approval resolution via events in addition to direct method calls.
 * Validates the acceptance criteria:
 * - ApexOrchestrator can receive approval/rejection via method call or event
 * - On approval, task resumes from paused state
 * - Approval decision is logged and associated with the task
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import * as fs from 'fs';
import * as path from 'path';

// Mock the query function
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Mock fs operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
  readdirSync: vi.fn(() => []),
}));

describe('Event-Based Approval Resolution', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test project path
    projectPath = '/tmp/test-approval-events';

    // Mock configuration files
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockImplementation((filePath: string) => {
      if (filePath.includes('config.yaml')) {
        return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
`;
      }
      if (filePath.includes('feature.yaml')) {
        return `
name: Feature Development Workflow
description: Standard feature development workflow with approval gates
stages:
  - name: planning
    agent: planner
    description: Plan the feature implementation
  - name: architecture
    agent: architect
    description: Design the architecture
  - name: implementation
    agent: developer
    description: Implement the feature
    gate: code-review-gate

gates:
  - id: code-review-gate
    name: Code Review Gate
    description: Requires code review before implementation
    required: true
    autoApprove: false
    approvers: ["senior-dev", "tech-lead"]
    timeout: 60
`;
      }
      return '';
    });

    (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      projectPath,
    });

    await orchestrator.initialize();
  });

  describe('Event-Based Approval Resolution', () => {
    it('should handle approval decisions via approval:decision events', async () => {
      // Create a task that will hit an approval gate
      const taskId = await orchestrator.createTask('Test approval event resolution', 'feature');

      // Mock successful stage completions up to the gated stage
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          content: [{ type: 'text', text: 'Planning completed successfully' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          content: [{ type: 'text', text: 'Architecture completed successfully' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        });

      // Track approval events
      const approvalEvents: any[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push({ type: 'approval:required', data: event });
      });
      orchestrator.on('approval:approved', (event) => {
        approvalEvents.push({ type: 'approval:approved', data: event });
      });

      // Start the task to trigger approval gate
      await orchestrator.runTask(taskId);

      // Verify that approval:required was emitted
      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].type).toBe('approval:required');

      const approvalId = approvalEvents[0].data.approvalId;
      expect(approvalId).toBeDefined();

      // Get task before approval
      const taskBeforeApproval = await orchestrator.getTask(taskId);
      expect(taskBeforeApproval?.status).toBe('awaiting-approval');

      // Resolve approval via event (instead of direct method call)
      orchestrator.emit('approval:decision', {
        approvalId,
        decision: 'approved' as const,
        approver: 'tech-lead',
        comment: 'Code looks good, approved via event'
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval:approved event was emitted
      expect(approvalEvents).toHaveLength(2);
      expect(approvalEvents[1].type).toBe('approval:approved');
      expect(approvalEvents[1].data.approvalId).toBe(approvalId);
      expect(approvalEvents[1].data.approver).toBe('tech-lead');
      expect(approvalEvents[1].data.comment).toBe('Code looks good, approved via event');

      // Verify approval state was updated in database
      const approvalState = await orchestrator.getApprovalStateById(approvalId);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.approver).toBe('tech-lead');
      expect(approvalState?.comment).toBe('Code looks good, approved via event');
    });

    it('should handle approval denials via approval:decision events', async () => {
      const taskId = await orchestrator.createTask('Test approval denial event', 'feature');

      // Mock successful stage completions up to the gated stage
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          content: [{ type: 'text', text: 'Planning completed successfully' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          content: [{ type: 'text', text: 'Architecture completed successfully' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        });

      // Track events
      const events: any[] = [];
      orchestrator.on('approval:required', (event) => {
        events.push({ type: 'approval:required', data: event });
      });
      orchestrator.on('approval:denied', (event) => {
        events.push({ type: 'approval:denied', data: event });
      });
      orchestrator.on('task:failed', (task) => {
        events.push({ type: 'task:failed', data: task });
      });

      // Start the task
      await orchestrator.runTask(taskId);

      // Get the approval ID
      const approvalId = events[0].data.approvalId;

      // Deny approval via event
      orchestrator.emit('approval:decision', {
        approvalId,
        decision: 'denied' as const,
        approver: 'senior-dev',
        reason: 'Code needs refactoring before approval'
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify events were emitted correctly
      expect(events.filter(e => e.type === 'approval:denied')).toHaveLength(1);
      expect(events.filter(e => e.type === 'task:failed')).toHaveLength(1);

      const deniedEvent = events.find(e => e.type === 'approval:denied');
      expect(deniedEvent.data.approvalId).toBe(approvalId);
      expect(deniedEvent.data.approver).toBe('senior-dev');
      expect(deniedEvent.data.reason).toBe('Code needs refactoring before approval');

      // Verify task failed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toContain('Approval denied by senior-dev');
    });

    it('should handle invalid approval decision events gracefully', async () => {
      // Test with invalid approval ID
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      orchestrator.emit('approval:decision', {
        approvalId: 'non-existent-approval-id',
        decision: 'approved' as const,
        approver: 'test-user',
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have logged an error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error processing approval decision event/),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should log approval decisions to the associated task', async () => {
      const taskId = await orchestrator.createTask('Test approval logging', 'feature');

      // Mock successful stage completions
      mockQuery
        .mockResolvedValueOnce({
          requestId: 'test-request-1',
          content: [{ type: 'text', text: 'Planning completed' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-2',
          content: [{ type: 'text', text: 'Architecture completed' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        });

      // Track approval required event
      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Approve via event
      orchestrator.emit('approval:decision', {
        approvalId: approvalId!,
        decision: 'approved' as const,
        approver: 'test-approver',
        comment: 'Approved with logging test'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify approval was logged to the task
      const logs = await orchestrator.getTaskLogs(taskId);
      const approvalLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );

      expect(approvalLog).toBeDefined();
      expect(approvalLog?.metadata?.approvalId).toBe(approvalId);
      expect(approvalLog?.metadata?.approver).toBe('test-approver');
      expect(approvalLog?.metadata?.comment).toBe('Approved with logging test');
    });
  });

  describe('Autonomy Enforcer Integration', () => {
    it('should handle approval:required events from autonomy enforcer', async () => {
      const taskId = await orchestrator.createTask('Test autonomy enforcer integration', 'feature');

      // Mock task in progress
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      // Track pause events
      const pauseEvents: any[] = [];
      orchestrator.on('task:paused', (task) => {
        pauseEvents.push(task);
      });

      // Simulate autonomy enforcer approval:required event
      (orchestrator as any).autonomyEnforcer.emit('approval:required', 'test-gate', {
        task: { id: taskId },
        metadata: { action: 'test-action' }
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task was paused
      expect(pauseEvents).toHaveLength(1);
      expect(pauseEvents[0].id).toBe(taskId);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused');
      expect(task?.pauseReason).toBe('approval_gate');

      // Verify log was created
      const logs = await orchestrator.getTaskLogs(taskId);
      const pauseLog = logs.find(log =>
        log.message.includes('Task paused by autonomy enforcer for approval gate')
      );
      expect(pauseLog).toBeDefined();
      expect(pauseLog?.metadata?.gateName).toBe('test-gate');
    });
  });
});