/**
 * Test suite for autonomy enforcer approval integration
 *
 * Tests the setupAutonomyEnforcerEvents implementation to verify:
 * - Proper event handling from autonomy enforcer
 * - Task pausing and resuming via autonomy enforcer events
 * - Event forwarding and logging
 * - Error handling in autonomy enforcer integration
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

describe('Autonomy Enforcer Approval Integration', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    projectPath = '/tmp/test-autonomy-enforcer-approval';

    // Mock configuration files
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockImplementation((filePath: string) => {
      if (filePath.includes('config.yaml')) {
        return `
name: test-project
autonomy:
  level: supervised
  enforcer:
    enabled: true
    gates:
      - action: file_write
        threshold: high
      - action: api_call
        threshold: medium
agents:
  - ./agents
workflows:
  - ./workflows
`;
      }
      if (filePath.includes('feature.yaml')) {
        return `
name: Feature Development Workflow
description: Workflow with autonomy enforcer integration
stages:
  - name: implementation
    agent: developer
    description: Implement the feature
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

  describe('Autonomy Enforcer Event Handling', () => {
    it('should handle approval:required events from autonomy enforcer', async () => {
      const taskId = await orchestrator.createTask('Test autonomy enforcer approval', 'feature');

      // Set task to in-progress to simulate ongoing execution
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      // Track pause events
      const events: any[] = [];
      orchestrator.on('task:paused', (task) => {
        events.push({ type: 'task:paused', data: task });
      });

      // Simulate autonomy enforcer emitting approval:required event
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const context = {
        task: { id: taskId },
        metadata: {
          action: 'file_write',
          file: 'src/important-file.ts',
          riskLevel: 'high'
        }
      };

      autonomyEnforcer.emit('approval:required', 'high-risk-file-write', context);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify task was paused
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task:paused');
      expect(events[0].data.id).toBe(taskId);

      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('paused');
      expect(task?.pauseReason).toBe('approval_gate');

      // Verify log was created
      const logs = await orchestrator.getTaskLogs(taskId);
      const pauseLog = logs.find(log =>
        log.message.includes('Task paused by autonomy enforcer for approval gate')
      );
      expect(pauseLog).toBeDefined();
      expect(pauseLog?.level).toBe('info');
      expect(pauseLog?.metadata?.gateName).toBe('high-risk-file-write');
      expect(pauseLog?.metadata?.action).toBe('file_write');
    });

    it('should handle multiple autonomy enforcer approval requests', async () => {
      const taskId1 = await orchestrator.createTask('Test task 1', 'feature');
      const taskId2 = await orchestrator.createTask('Test task 2', 'feature');

      await orchestrator.updateTaskStatus(taskId1, 'in-progress');
      await orchestrator.updateTaskStatus(taskId2, 'in-progress');

      const events: any[] = [];
      orchestrator.on('task:paused', (task) => {
        events.push(task);
      });

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Emit approval required for first task
      autonomyEnforcer.emit('approval:required', 'api-call-gate', {
        task: { id: taskId1 },
        metadata: { action: 'api_call', endpoint: '/sensitive/endpoint' }
      });

      // Emit approval required for second task
      autonomyEnforcer.emit('approval:required', 'file-delete-gate', {
        task: { id: taskId2 },
        metadata: { action: 'file_delete', path: '/critical/file' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both tasks paused
      expect(events).toHaveLength(2);
      expect(events.map(e => e.id)).toContain(taskId1);
      expect(events.map(e => e.id)).toContain(taskId2);

      const task1 = await orchestrator.getTask(taskId1);
      const task2 = await orchestrator.getTask(taskId2);

      expect(task1?.status).toBe('paused');
      expect(task2?.status).toBe('paused');
      expect(task1?.pauseReason).toBe('approval_gate');
      expect(task2?.pauseReason).toBe('approval_gate');
    });

    it('should forward approval:required events from autonomy enforcer', async () => {
      const taskId = await orchestrator.createTask('Test event forwarding', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      // Track forwarded events
      const forwardedEvents: any[] = [];
      orchestrator.on('approval:required', (event) => {
        forwardedEvents.push(event);
      });

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const context = {
        task: { id: taskId },
        metadata: { action: 'database_delete', table: 'users' }
      };

      autonomyEnforcer.emit('approval:required', 'database-delete-gate', context);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event was forwarded
      expect(forwardedEvents).toHaveLength(1);
      const forwardedEvent = forwardedEvents[0];

      expect(forwardedEvent.taskId).toBe(taskId);
      expect(forwardedEvent.gateName).toBe('database-delete-gate');
      expect(forwardedEvent.context).toEqual(context);
      expect(forwardedEvent.approvalId).toBeDefined();
      expect(typeof forwardedEvent.approvalId).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle autonomy enforcer events with missing task ID', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Emit event with missing task ID
      autonomyEnforcer.emit('approval:required', 'test-gate', {
        metadata: { action: 'test_action' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error handling autonomy enforcer approval/),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle autonomy enforcer events with invalid task ID', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Emit event with non-existent task ID
      autonomyEnforcer.emit('approval:required', 'test-gate', {
        task: { id: 'non-existent-task-id' },
        metadata: { action: 'test_action' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error handling autonomy enforcer approval/),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle autonomy enforcer events when task update fails', async () => {
      const taskId = await orchestrator.createTask('Test update failure', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      // Mock updateTaskStatus to fail
      const originalUpdateTaskStatus = orchestrator.updateTaskStatus.bind(orchestrator);
      orchestrator.updateTaskStatus = vi.fn().mockRejectedValueOnce(new Error('Update failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      autonomyEnforcer.emit('approval:required', 'test-gate', {
        task: { id: taskId },
        metadata: { action: 'test_action' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error handling autonomy enforcer approval/),
        expect.any(Error)
      );

      // Restore original method
      orchestrator.updateTaskStatus = originalUpdateTaskStatus;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration with Approval Resolution', () => {
    it('should integrate autonomy enforcer pauses with approval resolution system', async () => {
      const taskId = await orchestrator.createTask('Test integration', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      // Trigger autonomy enforcer pause
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      autonomyEnforcer.emit('approval:required', 'integration-test-gate', {
        task: { id: taskId },
        metadata: { action: 'critical_operation' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(approvalId!).toBeDefined();

      // Verify task paused
      const pausedTask = await orchestrator.getTask(taskId);
      expect(pausedTask?.status).toBe('paused');

      // Track resume events
      const resumeEvents: any[] = [];
      orchestrator.on('task:resumed', (task) => {
        resumeEvents.push(task);
      });

      // Resolve approval
      await orchestrator.grantApproval(approvalId!, 'admin-user', 'Critical operation approved');

      // Verify task resumed
      expect(resumeEvents).toHaveLength(1);
      expect(resumeEvents[0].id).toBe(taskId);

      const resumedTask = await orchestrator.getTask(taskId);
      expect(resumedTask?.status).toBe('in-progress');
      expect(resumedTask?.pauseReason).toBeUndefined();

      // Verify approval state
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('approved');
      expect(approvalState?.approver).toBe('admin-user');
      expect(approvalState?.comment).toBe('Critical operation approved');
    });

    it('should handle autonomy enforcer approval denial properly', async () => {
      const taskId = await orchestrator.createTask('Test denial integration', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      let approvalId: string;
      orchestrator.on('approval:required', (event) => {
        approvalId = event.approvalId;
      });

      // Track task failure
      const failureEvents: any[] = [];
      orchestrator.on('task:failed', (task) => {
        failureEvents.push(task);
      });

      // Trigger autonomy enforcer pause
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      autonomyEnforcer.emit('approval:required', 'dangerous-operation-gate', {
        task: { id: taskId },
        metadata: { action: 'dangerous_operation', risk: 'critical' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Deny approval
      await orchestrator.denyApproval(
        approvalId!,
        'security-admin',
        'Operation too risky - alternative approach required'
      );

      // Verify task failed
      expect(failureEvents).toHaveLength(1);
      expect(failureEvents[0].id).toBe(taskId);

      const failedTask = await orchestrator.getTask(taskId);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toContain('Approval denied by security-admin');

      // Verify approval state
      const approvalState = await orchestrator.getApprovalStateById(approvalId!);
      expect(approvalState?.status).toBe('denied');
      expect(approvalState?.approver).toBe('security-admin');
      expect(approvalState?.reason).toBe('Operation too risky - alternative approach required');
    });
  });

  describe('Logging and Traceability', () => {
    it('should provide comprehensive logging for autonomy enforcer integration', async () => {
      const taskId = await orchestrator.createTask('Test comprehensive logging', 'feature');
      await orchestrator.updateTaskStatus(taskId, 'in-progress');

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const context = {
        task: { id: taskId },
        metadata: {
          action: 'system_config_change',
          file: '/etc/critical/config',
          changeType: 'security_settings'
        }
      };

      autonomyEnforcer.emit('approval:required', 'system-config-gate', context);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify detailed logging
      const logs = await orchestrator.getTaskLogs(taskId);

      const pauseLog = logs.find(log =>
        log.message.includes('Task paused by autonomy enforcer for approval gate')
      );

      expect(pauseLog).toBeDefined();
      expect(pauseLog?.level).toBe('info');
      expect(pauseLog?.metadata?.gateName).toBe('system-config-gate');
      expect(pauseLog?.metadata?.action).toBe('system_config_change');
      expect(pauseLog?.metadata?.context).toEqual(context);
      expect(pauseLog?.timestamp).toBeInstanceOf(Date);

      // Verify event forwarding log exists
      const forwardLog = logs.find(log =>
        log.message.includes('Forwarding autonomy enforcer approval')
      );

      expect(forwardLog).toBeDefined();
      expect(forwardLog?.level).toBe('debug');
      expect(forwardLog?.metadata?.gateName).toBe('system-config-gate');
    });
  });
});