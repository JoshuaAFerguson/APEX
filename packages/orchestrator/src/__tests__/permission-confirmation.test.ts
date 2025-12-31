/**
 * @fileoverview Tests for permission confirmation handling in ApexOrchestrator
 *
 * This test suite verifies the new permission and dangerous operation confirmation
 * functionality added in v0.5.0:
 * 1. Permission request generation and event emission
 * 2. Permission granting and denial workflows
 * 3. Dangerous operation detection and confirmation
 * 4. Event data structure compliance
 * 5. Integration with PermissionManager
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  PermissionLevel
} from '@apexcli/core';

describe('Permission Confirmation Functionality', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let eventSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-confirmation-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create minimal config
    const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: guided
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

    await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

    orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
    await orchestrator.initialize();

    // Set up event spy
    eventSpy = vi.fn();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Permission Request Workflow', () => {
    it('should generate permission request with proper event data', async () => {
      orchestrator.on('permission:request', eventSpy);

      const taskId = 'test-task-001';
      const tool = 'Bash';
      const scope = '/home/user/project';
      const description = 'Execute git status command';
      const agent = 'developer';
      const metadata = { command: 'git status' };

      const requestId = await orchestrator.requestPermission(
        taskId,
        tool,
        scope,
        description,
        false, // not dangerous
        agent,
        metadata
      );

      expect(requestId).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
      expect(eventSpy).toHaveBeenCalledOnce();

      const eventData = eventSpy.mock.calls[0][0] as PermissionRequestEventData;
      expect(eventData).toMatchObject({
        requestId,
        tool,
        scope,
        description,
        isDangerous: false,
        agent,
        metadata
      });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should handle dangerous operation requests', async () => {
      orchestrator.on('permission:request', eventSpy);

      const taskId = 'test-task-002';
      const requestId = await orchestrator.requestPermission(
        taskId,
        'Bash',
        '/etc',
        'Modify system configuration files',
        true, // dangerous
        'developer'
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0] as PermissionRequestEventData;
      expect(eventData.isDangerous).toBe(true);
    });

    it('should generate unique request IDs', async () => {
      const requestId1 = await orchestrator.requestPermission(
        'task-1', 'Bash', undefined, 'Command 1', false, 'agent1'
      );

      const requestId2 = await orchestrator.requestPermission(
        'task-2', 'Write', undefined, 'Write file', false, 'agent2'
      );

      expect(requestId1).not.toBe(requestId2);
    });
  });

  describe('Permission Grant Workflow', () => {
    it('should grant permission and emit proper event', async () => {
      orchestrator.on('permission:granted', eventSpy);

      const requestId = 'test-request-001';
      const taskId = 'test-task-001';
      const tool = 'Write';
      const scope = '/home/user/project/src';
      const level: PermissionLevel = 'allow-once';
      const grantedBy = 'user';
      const reason = 'User approved file write operation';

      await orchestrator.grantPermissionConfirmation(
        requestId,
        taskId,
        tool,
        scope,
        level,
        grantedBy,
        reason
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0] as PermissionGrantedEventData;
      expect(eventData).toMatchObject({
        requestId,
        tool,
        scope,
        level,
        grantedBy,
        reason
      });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should persist permission in PermissionManager', async () => {
      const tool = 'Read';
      const scope = '/home/user/project';
      const level: PermissionLevel = 'allow-always';

      await orchestrator.grantPermissionConfirmation(
        'req-001',
        'task-001',
        tool,
        scope,
        level,
        'user'
      );

      // Verify permission was stored (this would normally be tested through
      // the permission manager, but we're testing the integration)
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(true);
    });
  });

  describe('Permission Denial Workflow', () => {
    it('should deny permission and emit proper event', async () => {
      orchestrator.on('permission:denied', eventSpy);

      const requestId = 'test-request-002';
      const taskId = 'test-task-002';
      const tool = 'Bash';
      const scope = '/system';
      const deniedBy = 'user';
      const reason = 'Access to system directory denied for security';

      await orchestrator.denyPermissionConfirmation(
        requestId,
        taskId,
        tool,
        scope,
        deniedBy,
        reason
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0] as PermissionDeniedEventData;
      expect(eventData).toMatchObject({
        requestId,
        tool,
        scope,
        deniedBy,
        reason
      });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should persist deny permission in PermissionManager', async () => {
      const tool = 'Bash';
      const scope = '/system';

      await orchestrator.denyPermissionConfirmation(
        'req-002',
        'task-002',
        tool,
        scope,
        'user',
        'Security restriction'
      );

      // Verify deny permission was stored
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Dangerous Operation Detection', () => {
    it('should flag dangerous operation and emit detection event', async () => {
      orchestrator.on('dangerous:detected', eventSpy);

      const taskId = 'test-task-003';
      const tool = 'Bash';
      const operation = 'rm -rf /important-data/*';
      const riskLevel = 'critical';
      const riskDescription = 'Permanent deletion of important data';
      const agent = 'developer';
      const context = { command: operation, workingDir: '/home/user' };

      const operationId = await orchestrator.flagDangerousOperation(
        taskId,
        tool,
        operation,
        riskLevel,
        riskDescription,
        agent,
        context
      );

      expect(operationId).toMatch(/^danger-op-\d+-[a-z0-9]+$/);
      expect(eventSpy).toHaveBeenCalledOnce();

      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationDetectedEventData;
      expect(eventData).toMatchObject({
        operationId,
        tool,
        operation,
        riskLevel,
        riskDescription,
        agent,
        context
      });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different risk levels', async () => {
      orchestrator.on('dangerous:detected', eventSpy);

      const riskLevels = ['low', 'medium', 'high', 'critical'] as const;

      for (const riskLevel of riskLevels) {
        await orchestrator.flagDangerousOperation(
          'task',
          'Bash',
          'test operation',
          riskLevel,
          `${riskLevel} risk operation`,
          'agent'
        );
      }

      expect(eventSpy).toHaveBeenCalledTimes(4);
      riskLevels.forEach((level, index) => {
        const eventData = eventSpy.mock.calls[index][0] as DangerousOperationDetectedEventData;
        expect(eventData.riskLevel).toBe(level);
      });
    });
  });

  describe('Dangerous Operation Confirmation', () => {
    it('should confirm dangerous operation and emit confirmation event', async () => {
      orchestrator.on('dangerous:confirmed', eventSpy);

      const operationId = 'danger-op-001';
      const taskId = 'test-task-004';
      const tool = 'Bash';
      const operation = 'sudo systemctl restart nginx';
      const confirmedBy = 'admin';
      const reason = 'Required for deployment update';

      await orchestrator.confirmDangerousOperation(
        operationId,
        taskId,
        tool,
        operation,
        confirmedBy,
        reason
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationConfirmedEventData;
      expect(eventData).toMatchObject({
        operationId,
        tool,
        operation,
        confirmedBy,
        reason
      });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Dangerous Operation Blocking', () => {
    it('should block dangerous operation and emit blocking event', async () => {
      orchestrator.on('dangerous:blocked', eventSpy);

      const operationId = 'danger-op-002';
      const taskId = 'test-task-005';
      const tool = 'Bash';
      const operation = 'rm -rf /';
      const blockedBy = 'user';
      const reason = 'Extremely dangerous operation blocked';

      await orchestrator.blockDangerousOperation(
        operationId,
        taskId,
        tool,
        operation,
        blockedBy,
        reason
      );

      expect(eventSpy).toHaveBeenCalledOnce();
      const eventData = eventSpy.mock.calls[0][0] as DangerousOperationBlockedEventData;
      expect(eventData).toMatchObject({
        operationId,
        tool,
        operation,
        blockedBy,
        reason
      });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Event Integration', () => {
    it('should emit events in proper sequence for complete permission workflow', async () => {
      const events: string[] = [];

      orchestrator.on('permission:request', () => events.push('request'));
      orchestrator.on('permission:granted', () => events.push('granted'));
      orchestrator.on('dangerous:detected', () => events.push('dangerous'));
      orchestrator.on('dangerous:confirmed', () => events.push('confirmed'));

      // Simulate complete workflow
      const requestId = await orchestrator.requestPermission(
        'task-001', 'Bash', '/etc', 'Edit config', true, 'agent'
      );

      await orchestrator.grantPermissionConfirmation(
        requestId, 'task-001', 'Bash', '/etc', 'allow-once', 'user'
      );

      const operationId = await orchestrator.flagDangerousOperation(
        'task-001', 'Bash', 'edit /etc/passwd', 'critical', 'System file modification', 'agent'
      );

      await orchestrator.confirmDangerousOperation(
        operationId, 'task-001', 'Bash', 'edit /etc/passwd', 'admin', 'Authorized by admin'
      );

      expect(events).toEqual(['request', 'granted', 'dangerous', 'confirmed']);
    });

    it('should handle multiple concurrent permission requests', async () => {
      const requestPromises = [];

      for (let i = 0; i < 5; i++) {
        requestPromises.push(
          orchestrator.requestPermission(
            `task-${i}`,
            'Write',
            `/path/${i}`,
            `Operation ${i}`,
            false,
            'agent'
          )
        );
      }

      const requestIds = await Promise.all(requestPromises);

      // All request IDs should be unique
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing orchestrator initialization gracefully', async () => {
      const uninitializedOrchestrator = new ApexOrchestrator(tempDir);

      // Should throw or handle gracefully when not initialized
      await expect(
        uninitializedOrchestrator.requestPermission(
          'task-001', 'Bash', undefined, 'Test', false, 'agent'
        )
      ).rejects.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce proper PermissionLevel types', async () => {
      // This is more of a compile-time test, but we can verify runtime behavior
      const validLevels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];

      for (const level of validLevels) {
        await expect(
          orchestrator.grantPermissionConfirmation(
            'req-001', 'task-001', 'Write', undefined, level, 'user'
          )
        ).resolves.toBeUndefined();
      }
    });

    it('should enforce proper risk level types', async () => {
      const validRiskLevels = ['low', 'medium', 'high', 'critical'] as const;

      for (const riskLevel of validRiskLevels) {
        await expect(
          orchestrator.flagDangerousOperation(
            'task-001', 'Bash', 'test', riskLevel, 'test risk', 'agent'
          )
        ).resolves.toMatch(/^danger-op-\d+-[a-z0-9]+$/);
      }
    });
  });
});