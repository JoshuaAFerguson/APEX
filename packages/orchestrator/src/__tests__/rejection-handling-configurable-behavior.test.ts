/**
 * Test suite for configurable rejection handling behavior
 *
 * Tests the implementation of configurable rejection behavior:
 * - Skip action: Continue to next action when rejection occurs
 * - Abort task: Terminate task with 'rejected' status when rejection occurs
 * - Configuration reading from autonomy config
 * - Proper event emission for both rejection modes
 *
 * Acceptance Criteria:
 * - On rejection, ApexOrchestrator reads config to determine behavior
 * - Skip action continues to next action in the workflow
 * - Abort task terminates task with 'rejected' status
 * - Both behaviors emit appropriate events
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

describe('Configurable Rejection Handling Behavior', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  describe('Skip Action Behavior', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      projectPath = '/tmp/test-rejection-skip';

      // Mock configuration files with 'skip' rejection behavior
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: skip
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Multi-Stage Feature Workflow
stages:
  - name: planning
    agent: planner
    gate: planning-gate
  - name: architecture
    agent: architect
    gate: architecture-gate
  - name: implementation
    agent: developer
  - name: testing
    agent: tester

gates:
  - id: planning-gate
    name: Planning Review Gate
    required: true
    autoApprove: false
    timeout: 60
  - id: architecture-gate
    name: Architecture Review Gate
    required: true
    autoApprove: false
    timeout: 60
`;
        }
        return '';
      });

      (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

      orchestrator = new ApexOrchestrator({ projectPath });
      await orchestrator.initialize();
    });

    it('should skip to next action when rejection occurs with skip behavior', async () => {
      const taskId = await orchestrator.createTask('Test skip behavior on rejection', 'feature');

      // Mock successful planning stage
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Planning completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      // Mock successful architecture stage (after skip)
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-2',
        content: [{ type: 'text', text: 'Architecture completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      // Mock remaining stages
      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-3',
        content: [{ type: 'text', text: 'Implementation completed successfully' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-4',
        content: [{ type: 'text', text: 'Testing completed successfully' }],
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
      orchestrator.on('action:skipped', (event) => {
        events.push({ type: 'action:skipped', data: event });
      });
      orchestrator.on('task:stage-completed', (event) => {
        events.push({ type: 'task:stage-completed', data: event });
      });
      orchestrator.on('task:completed', (task) => {
        events.push({ type: 'task:completed', data: task });
      });
      orchestrator.on('task:failed', (task) => {
        events.push({ type: 'task:failed', data: task });
      });

      // Start the task
      await orchestrator.runTask(taskId);

      // Should hit planning gate
      expect(events.filter(e => e.type === 'approval:required')).toHaveLength(1);

      const planningApprovalId = events.find(e => e.type === 'approval:required')!.data.approvalId;

      // Deny the planning approval
      await orchestrator.denyApproval(planningApprovalId, 'reviewer', 'Planning needs more detail');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify denial was processed but action was skipped
      expect(events.filter(e => e.type === 'approval:denied')).toHaveLength(1);
      expect(events.filter(e => e.type === 'action:skipped')).toHaveLength(1);

      // Should not fail the task
      expect(events.filter(e => e.type === 'task:failed')).toHaveLength(0);

      // Should continue to next stage (architecture)
      expect(events.filter(e => e.type === 'approval:required')).toHaveLength(2);

      // Get the architecture approval ID and deny it too
      const architectureApprovalId = events.filter(e => e.type === 'approval:required')[1].data.approvalId;
      await orchestrator.denyApproval(architectureApprovalId, 'reviewer', 'Architecture needs revision');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have 2 denials and 2 skips
      expect(events.filter(e => e.type === 'approval:denied')).toHaveLength(2);
      expect(events.filter(e => e.type === 'action:skipped')).toHaveLength(2);

      // Task should continue and complete the remaining stages
      expect(events.filter(e => e.type === 'task:completed')).toHaveLength(1);

      // Verify task status is completed, not failed or rejected
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('completed');
    });

    it('should emit action:skipped event with correct metadata when skip behavior is triggered', async () => {
      const taskId = await orchestrator.createTask('Test skip event emission', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Planning completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      let skippedEvent: any;

      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      orchestrator.on('action:skipped', (event) => {
        skippedEvent = event;
      });

      await orchestrator.runTask(taskId);

      // Deny approval to trigger skip
      await orchestrator.denyApproval(approvalId!, 'reviewer', 'Skip this stage');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify skip event was emitted with correct data
      expect(skippedEvent).toBeDefined();
      expect(skippedEvent.taskId).toBe(taskId);
      expect(skippedEvent.actionType).toBe('stage');
      expect(skippedEvent.actionName).toBe('planning');
      expect(skippedEvent.reason).toBe('rejection_skip');
      expect(skippedEvent.rejectionReason).toBe('Skip this stage');
      expect(skippedEvent.approvalId).toBe(approvalId);
    });

    it('should log skip actions appropriately', async () => {
      const taskId = await orchestrator.createTask('Test skip action logging', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      await orchestrator.denyApproval(approvalId!, 'reviewer', 'Needs revision');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check logs contain skip information
      const logs = await orchestrator.getTaskLogs(taskId);
      const skipLog = logs.find(log =>
        log.message.includes('Action skipped due to rejection') ||
        log.message.includes('Stage skipped')
      );

      expect(skipLog).toBeDefined();
      expect(skipLog?.level).toBe('info');
      expect(skipLog?.metadata?.rejectionBehavior).toBe('skip');
      expect(skipLog?.metadata?.approvalId).toBe(approvalId);
      expect(skipLog?.metadata?.actionSkipped).toBe('planning');
    });
  });

  describe('Abort Task Behavior', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      projectPath = '/tmp/test-rejection-abort';

      // Mock configuration files with 'abort' rejection behavior
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: abort
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Code Review Gate
    required: true
    autoApprove: false
    timeout: 60
`;
        }
        return '';
      });

      (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

      orchestrator = new ApexOrchestrator({ projectPath });
      await orchestrator.initialize();
    });

    it('should abort task with rejected status when rejection occurs with abort behavior', async () => {
      const taskId = await orchestrator.createTask('Test abort behavior on rejection', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
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
      orchestrator.on('task:rejected', (task) => {
        events.push({ type: 'task:rejected', data: task });
      });
      orchestrator.on('task:failed', (task) => {
        events.push({ type: 'task:failed', data: task });
      });
      orchestrator.on('task:completed', (task) => {
        events.push({ type: 'task:completed', data: task });
      });

      await orchestrator.runTask(taskId);

      // Should hit approval gate
      expect(events.filter(e => e.type === 'approval:required')).toHaveLength(1);

      const approvalId = events.find(e => e.type === 'approval:required')!.data.approvalId;

      // Deny the approval
      await orchestrator.denyApproval(approvalId, 'reviewer', 'Code does not meet standards');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task was aborted with rejected status
      expect(events.filter(e => e.type === 'approval:denied')).toHaveLength(1);
      expect(events.filter(e => e.type === 'task:rejected')).toHaveLength(1);
      expect(events.filter(e => e.type === 'task:failed')).toHaveLength(0);
      expect(events.filter(e => e.type === 'task:completed')).toHaveLength(0);

      // Verify task status is 'rejected', not 'failed'
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('rejected');
      expect(task?.error).toContain('Task rejected due to approval denial');
      expect(task?.error).toContain('Code does not meet standards');
    });

    it('should emit task:rejected event with correct metadata when abort behavior is triggered', async () => {
      const taskId = await orchestrator.createTask('Test reject event emission', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      let rejectedEvent: any;

      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      orchestrator.on('task:rejected', (event) => {
        rejectedEvent = event;
      });

      await orchestrator.runTask(taskId);

      // Deny approval to trigger abort
      await orchestrator.denyApproval(approvalId!, 'tech-lead', 'Major security issues found');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify rejection event was emitted with correct data
      expect(rejectedEvent).toBeDefined();
      expect(rejectedEvent.id).toBe(taskId);
      expect(rejectedEvent.status).toBe('rejected');
      expect(rejectedEvent.error).toContain('Task rejected due to approval denial');
      expect(rejectedEvent.error).toContain('Major security issues found');
      expect(rejectedEvent.rejectionMetadata).toBeDefined();
      expect(rejectedEvent.rejectionMetadata.approvalId).toBe(approvalId);
      expect(rejectedEvent.rejectionMetadata.approver).toBe('tech-lead');
      expect(rejectedEvent.rejectionMetadata.reason).toBe('Major security issues found');
    });

    it('should log rejection appropriately with abort behavior', async () => {
      const taskId = await orchestrator.createTask('Test abort logging', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Stage completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      await orchestrator.denyApproval(approvalId!, 'reviewer', 'Critical issues identified');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check logs contain rejection information
      const logs = await orchestrator.getTaskLogs(taskId);
      const rejectionLog = logs.find(log =>
        log.message.includes('Task rejected due to approval denial') ||
        log.message.includes('Task aborted')
      );

      expect(rejectionLog).toBeDefined();
      expect(rejectionLog?.level).toBe('error');
      expect(rejectionLog?.metadata?.rejectionBehavior).toBe('abort');
      expect(rejectionLog?.metadata?.approvalId).toBe(approvalId);
      expect(rejectionLog?.metadata?.rejectionReason).toBe('Critical issues identified');
    });
  });

  describe('Configuration Reading', () => {
    it('should default to abort behavior when no rejectionBehavior is specified', async () => {
      projectPath = '/tmp/test-default-behavior';

      // Mock config without explicit rejectionBehavior
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Code Review Gate
    required: true
    autoApprove: false
`;
        }
        return '';
      });

      const defaultOrchestrator = new ApexOrchestrator({ projectPath });
      await defaultOrchestrator.initialize();

      const taskId = await defaultOrchestrator.createTask('Test default behavior', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      let taskRejected = false;

      defaultOrchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      defaultOrchestrator.on('task:rejected', () => {
        taskRejected = true;
      });

      await defaultOrchestrator.runTask(taskId);
      await defaultOrchestrator.denyApproval(approvalId!, 'reviewer', 'Denial test');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should use default behavior (abort)
      expect(taskRejected).toBe(true);
      const task = await defaultOrchestrator.getTask(taskId);
      expect(task?.status).toBe('rejected');
    });

    it('should handle invalid rejectionBehavior config gracefully', async () => {
      projectPath = '/tmp/test-invalid-behavior';

      // Mock config with invalid rejectionBehavior
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: invalid-behavior
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Review Gate
    required: true
    autoApprove: false
`;
        }
        return '';
      });

      // Should fall back to default behavior without throwing
      await expect(async () => {
        const invalidOrchestrator = new ApexOrchestrator({ projectPath });
        await invalidOrchestrator.initialize();
      }).not.toThrow();
    });

    it('should read rejectionBehavior from per-stage autonomy overrides', async () => {
      projectPath = '/tmp/test-stage-override';

      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: abort
  stageOverrides:
    implementation:
      level: review
      rejectionBehavior: skip
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Review Gate
    required: true
    autoApprove: false
`;
        }
        return '';
      });

      const stageOrchestrator = new ApexOrchestrator({ projectPath });
      await stageOrchestrator.initialize();

      const taskId = await stageOrchestrator.createTask('Test stage override', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      let actionSkipped = false;
      let taskRejected = false;

      stageOrchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      stageOrchestrator.on('action:skipped', () => {
        actionSkipped = true;
      });

      stageOrchestrator.on('task:rejected', () => {
        taskRejected = true;
      });

      await stageOrchestrator.runTask(taskId);
      await stageOrchestrator.denyApproval(approvalId!, 'reviewer', 'Stage-specific denial');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should use stage override (skip), not global behavior (abort)
      expect(actionSkipped).toBe(true);
      expect(taskRejected).toBe(false);
    });
  });

  describe('Event-Based Rejection Handling', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      projectPath = '/tmp/test-event-rejection';

      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: skip
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Review Gate
    required: true
    autoApprove: false
`;
        }
        return '';
      });

      (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

      orchestrator = new ApexOrchestrator({ projectPath });
      await orchestrator.initialize();
    });

    it('should handle event-based rejection with skip behavior', async () => {
      const taskId = await orchestrator.createTask('Test event-based rejection skip', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      let actionSkipped = false;

      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      orchestrator.on('action:skipped', () => {
        actionSkipped = true;
      });

      await orchestrator.runTask(taskId);

      // Reject via event
      orchestrator.emit('approval:decision', {
        approvalId: approvalId!,
        decision: 'denied' as const,
        approver: 'event-reviewer',
        reason: 'Event-based rejection test'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should skip action based on config
      expect(actionSkipped).toBe(true);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).not.toBe('rejected');
      expect(task?.status).not.toBe('failed');
    });

    it('should handle event-based rejection with abort behavior', async () => {
      // Reconfigure for abort behavior
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: abort
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Review Gate
    required: true
    autoApprove: false
`;
        }
        return '';
      });

      const abortOrchestrator = new ApexOrchestrator({ projectPath });
      await abortOrchestrator.initialize();

      const taskId = await abortOrchestrator.createTask('Test event-based rejection abort', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      let taskRejected = false;

      abortOrchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      abortOrchestrator.on('task:rejected', () => {
        taskRejected = true;
      });

      await abortOrchestrator.runTask(taskId);

      // Reject via event
      abortOrchestrator.emit('approval:decision', {
        approvalId: approvalId!,
        decision: 'denied' as const,
        approver: 'event-reviewer',
        reason: 'Event-based abort test'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should abort task based on config
      expect(taskRejected).toBe(true);

      const task = await abortOrchestrator.getTask(taskId);
      expect(task?.status).toBe('rejected');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      projectPath = '/tmp/test-rejection-edge-cases';

      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation((filePath: string) => {
        if (filePath.includes('config.yaml')) {
          return `
name: test-project
agents:
  - ./agents
workflows:
  - ./workflows
autonomy:
  level: manual
  rejectionBehavior: skip
`;
        }
        if (filePath.includes('feature.yaml')) {
          return `
name: Feature Workflow
stages:
  - name: implementation
    agent: developer
    gate: review-gate

gates:
  - id: review-gate
    name: Review Gate
    required: true
    autoApprove: false
`;
        }
        return '';
      });

      (fs.readdirSync as any).mockReturnValue(['feature.yaml']);

      orchestrator = new ApexOrchestrator({ projectPath });
      await orchestrator.initialize();
    });

    it('should handle rejection when no more stages to skip to', async () => {
      const taskId = await orchestrator.createTask('Test end-of-workflow rejection', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;

      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // This is the last stage, so skipping should complete the workflow
      await orchestrator.denyApproval(approvalId!, 'reviewer', 'Skip final stage');

      await new Promise(resolve => setTimeout(resolve, 100));

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('completed'); // Workflow completes with skipped final stage
    });

    it('should handle database errors during rejection processing gracefully', async () => {
      const taskId = await orchestrator.createTask('Test DB error during rejection', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Mock database failure during status update
      const originalUpdateTaskStatus = orchestrator.updateTaskStatus.bind(orchestrator);
      orchestrator.updateTaskStatus = vi.fn().mockRejectedValueOnce(new Error('DB connection failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(orchestrator.denyApproval(approvalId!, 'reviewer', 'DB error test'))
        .rejects.toThrow('DB connection failed');

      // Restore original method
      orchestrator.updateTaskStatus = originalUpdateTaskStatus;
      consoleErrorSpy.mockRestore();
    });

    it('should maintain consistent state when rejection behavior changes mid-task', async () => {
      // This tests the edge case where configuration might change during task execution
      const taskId = await orchestrator.createTask('Test behavior change mid-task', 'feature');

      mockQuery.mockResolvedValueOnce({
        requestId: 'test-request-1',
        content: [{ type: 'text', text: 'Implementation completed' }],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      await orchestrator.runTask(taskId);

      // Simulate config reload with different rejection behavior
      // This would require the orchestrator to re-read config, which is an implementation detail
      // For now, we test that the behavior is consistent with the config read at task start
      await orchestrator.denyApproval(approvalId!, 'reviewer', 'Consistency test');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should maintain skip behavior even if config theoretically changed
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).not.toBe('rejected'); // Should have skipped, not aborted
    });
  });
});