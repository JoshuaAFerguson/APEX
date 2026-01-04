/**
 * Comprehensive test suite for approval resolution and task resume mechanism
 *
 * This test suite focuses on verifying the acceptance criteria:
 * 1. ApexOrchestrator can receive approval/rejection via method call or event
 * 2. On approval, task resumes from paused state
 * 3. Approval decision is logged and associated with the task
 *
 * Tests cover:
 * - Direct method call approval resolution
 * - Event-based approval resolution
 * - Task resume from paused state
 * - Approval logging and association
 * - Error handling and edge cases
 * - Multiple approval scenarios
 * - Timeout handling
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

describe('Approval Resolution and Task Resume - Comprehensive Tests', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test project path
    projectPath = '/tmp/test-approval-task-resume';

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
description: Comprehensive workflow with multiple approval gates
stages:
  - name: planning
    agent: planner
    description: Plan the feature implementation
  - name: architecture
    agent: architect
    description: Design the architecture
    gate: design-review-gate
  - name: implementation
    agent: developer
    description: Implement the feature
    gate: code-review-gate
  - name: testing
    agent: tester
    description: Test the implementation

gates:
  - id: design-review-gate
    name: Design Review Gate
    description: Architecture review before implementation
    required: true
    autoApprove: false
    approvers: ["architect", "tech-lead"]
    timeout: 30
  - id: code-review-gate
    name: Code Review Gate
    description: Code review before testing
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

  describe('Method Call Approval Resolution', () => {
    it('should resolve approval via direct method call and resume task', async () => {
      const taskId = await orchestrator.createTask('Test method call approval', 'feature');

      // Mock successful stage completions up to gated stage
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
      orchestrator.on('approval:approved', (event) => {
        events.push({ type: 'approval:approved', data: event });
      });
      orchestrator.on('task:resumed', (task) => {
        events.push({ type: 'task:resumed', data: task });
      });

      // Start the task
      await orchestrator.runTask(taskId);

      // Verify approval required
      expect(events.filter(e => e.type === 'approval:required')).toHaveLength(1);
      const approvalId = events[0].data.approvalId;

      // Verify task is paused
      const pausedTask = await orchestrator.getTask(taskId);
      expect(pausedTask?.status).toBe('awaiting-approval');

      // Resolve approval via direct method call
      await orchestrator.grantApproval(approvalId, 'architect', 'Design approved via method call');

      // Verify approval approved event
      expect(events.filter(e => e.type === 'approval:approved')).toHaveLength(1);
      const approvalEvent = events.find(e => e.type === 'approval:approved');
      expect(approvalEvent.data.approver).toBe('architect');
      expect(approvalEvent.data.comment).toBe('Design approved via method call');

      // Verify approval state in database
      const approvalState = await orchestrator.getApprovalStateById(approvalId);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.approver).toBe('architect');
      expect(approvalState?.comment).toBe('Design approved via method call');

      // Verify task resumed
      expect(events.filter(e => e.type === 'task:resumed')).toHaveLength(1);
      const resumedTask = events.find(e => e.type === 'task:resumed');
      expect(resumedTask.data.id).toBe(taskId);

      // Verify logging
      const logs = await orchestrator.getTaskLogs(taskId);
      const approvalLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(approvalLog).toBeDefined();
      expect(approvalLog?.metadata?.approvalId).toBe(approvalId);
      expect(approvalLog?.metadata?.approver).toBe('architect');
    });

    it('should handle approval denial via direct method call', async () => {
      const taskId = await orchestrator.createTask('Test method call denial', 'feature');

      // Mock successful stage completions up to gated stage
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
      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });
      orchestrator.on('approval:denied', (event) => {
        expect(event.approvalId).toBe(approvalId);
      });
      orchestrator.on('task:failed', (task) => {
        expect(task.id).toBe(taskId);
      });

      await orchestrator.runTask(taskId);

      // Deny approval via direct method call
      await orchestrator.denyApproval(approvalId!, 'architect', 'Design needs major revisions');

      // Verify approval state
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('denied');
      expect(approvalState?.approver).toBe('architect');
      expect(approvalState?.reason).toBe('Design needs major revisions');

      // Verify task failed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toContain('Approval denied by architect');
    });
  });

  describe('Event-Based Approval Resolution', () => {
    it('should handle complex task resume scenarios with multiple gates', async () => {
      const taskId = await orchestrator.createTask('Test multiple gates', 'feature');

      // Mock all stage completions
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
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-3',
          content: [{ type: 'text', text: 'Implementation completed successfully' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          requestId: 'test-request-4',
          content: [{ type: 'text', text: 'Testing completed successfully' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        });

      // Track all approval events
      const approvalEvents: string[] = [];
      orchestrator.on('approval:required', (event) => {
        approvalEvents.push(event.approvalId);
      });

      // Start the task
      await orchestrator.runTask(taskId);

      // Should hit first gate (design-review-gate)
      expect(approvalEvents).toHaveLength(1);
      const firstApprovalId = approvalEvents[0];

      // Approve first gate via event
      orchestrator.emit('approval:decision', {
        approvalId: firstApprovalId,
        decision: 'approved' as const,
        approver: 'tech-lead',
        comment: 'Design looks good, proceed to implementation'
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Continue task execution to hit second gate
      await orchestrator.runTask(taskId);

      // Should hit second gate (code-review-gate)
      expect(approvalEvents).toHaveLength(2);
      const secondApprovalId = approvalEvents[1];

      // Verify first approval was resolved
      const firstApprovalState = await orchestrator.getApprovalStateById(firstApprovalId);
      expect(firstApprovalState?.status).toBe('approved');

      // Verify task is waiting at second gate
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('awaiting-approval');

      // Approve second gate via event
      orchestrator.emit('approval:decision', {
        approvalId: secondApprovalId,
        decision: 'approved' as const,
        approver: 'senior-dev',
        comment: 'Code review passed'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify second approval was resolved
      const secondApprovalState = await orchestrator.getApprovalStateById(secondApprovalId);
      expect(secondApprovalState?.status).toBe('approved');

      // Verify both approvals are logged
      const logs = await orchestrator.getTaskLogs(taskId);
      const approvalLogs = logs.filter(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(approvalLogs).toHaveLength(2);
    });
  });

  describe('Task Resume Mechanism', () => {
    it('should properly restore task state after approval', async () => {
      const taskId = await orchestrator.createTask('Test task state restoration', 'feature');

      // Mock initial stages
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Planning completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Verify task paused state
      const pausedTask = await orchestrator.getTask(taskId);
      expect(pausedTask?.status).toBe('awaiting-approval');
      expect(pausedTask?.pauseReason).toBe('approval_gate');

      // Verify task metadata preserved
      const originalMetadata = pausedTask?.metadata;

      // Grant approval
      await orchestrator.grantApproval(approvalId!, 'approver', 'Approved');

      // Verify task resumed with preserved state
      const resumedTask = await orchestrator.getTask(taskId);
      expect(resumedTask?.status).toBe('in-progress');
      expect(resumedTask?.metadata).toEqual(originalMetadata);
      expect(resumedTask?.pauseReason).toBeUndefined();

      // Verify resume log entry
      const logs = await orchestrator.getTaskLogs(taskId);
      const resumeLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(resumeLog).toBeDefined();
      expect(resumeLog?.level).toBe('info');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle approval for non-existent approval ID', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(orchestrator.grantApproval('non-existent-id', 'user', 'comment'))
        .rejects.toThrow('Approval request not found: non-existent-id');

      consoleErrorSpy.mockRestore();
    });

    it('should handle double approval gracefully', async () => {
      const taskId = await orchestrator.createTask('Test double approval', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Planning completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // First approval
      await orchestrator.grantApproval(approvalId!, 'user1', 'First approval');

      // Second approval attempt should fail
      await expect(orchestrator.grantApproval(approvalId!, 'user2', 'Second approval'))
        .rejects.toThrow('Approval request is not pending');
    });

    it('should handle event-based approval with invalid data', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Test invalid approval ID
      orchestrator.emit('approval:decision', {
        approvalId: 'invalid-id',
        decision: 'approved' as const,
        approver: 'test-user',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error processing approval decision event/),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle task resume failures gracefully', async () => {
      const taskId = await orchestrator.createTask('Test resume failure', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Planning completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Mock runTask to fail on resume
      const originalRunTask = orchestrator.runTask.bind(orchestrator);
      orchestrator.runTask = vi.fn().mockRejectedValueOnce(new Error('Resume failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await orchestrator.grantApproval(approvalId!, 'user', 'Approved');

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to resume task/),
        expect.any(Error)
      );

      // Restore original method
      orchestrator.runTask = originalRunTask;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Logging and Association', () => {
    it('should properly log approval decisions with full context', async () => {
      const taskId = await orchestrator.createTask('Test logging context', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Planning completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      const approvalComment = 'Approved with detailed context';
      await orchestrator.grantApproval(approvalId!, 'senior-dev', approvalComment);

      // Verify comprehensive logging
      const logs = await orchestrator.getTaskLogs(taskId);

      // Check approval grant log
      const approvalLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(approvalLog).toBeDefined();
      expect(approvalLog?.metadata?.approvalId).toBe(approvalId);
      expect(approvalLog?.metadata?.approver).toBe('senior-dev');
      expect(approvalLog?.metadata?.comment).toBe(approvalComment);
      expect(approvalLog?.timestamp).toBeInstanceOf(Date);

      // Check that approval is associated with correct task
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.taskId).toBe(taskId);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.respondedAt).toBeInstanceOf(Date);
    });
  });
});