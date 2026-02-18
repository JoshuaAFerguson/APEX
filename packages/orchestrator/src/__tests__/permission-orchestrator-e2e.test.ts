/**
 * @fileoverview End-to-End Integration Tests for Permission and Dangerous Operation Handling
 *
 * This test suite provides comprehensive end-to-end testing of the permission and dangerous
 * operation confirmation system in ApexOrchestrator, verifying:
 * 1. Complete permission request-to-resolution workflows
 * 2. Dangerous operation detection and confirmation flows
 * 3. Event emission and ordering across the entire system
 * 4. Integration between all permission-related components
 * 5. Real-world usage scenarios with multiple concurrent operations
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
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

describe('Permission System End-to-End Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-permission-e2e-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create comprehensive config for testing
    const configContent = `
project:
  name: test-permission-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  customRules:
    - toolName: "Read"
      behavior: "allow"
    - toolName: "TestTool"
      behavior: "prompt"

limits:
  maxRetries: 3
  maxConcurrentTasks: 5
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

    await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

    orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Complete Permission Workflow Scenarios', () => {
    it('should handle complete permission request-grant-execution flow', async () => {
      const eventLog: string[] = [];
      const eventData: Record<string, any> = {};

      // Set up event listeners
      orchestrator.on('permission:request', (data) => {
        eventLog.push('permission:request');
        eventData.request = data;
      });
      orchestrator.on('permission:granted', (data) => {
        eventLog.push('permission:granted');
        eventData.granted = data;
      });

      const taskId = 'task-complete-workflow-001';
      const tool = 'Write';
      const scope = '/home/user/project/src/newfile.ts';
      const description = 'Create new TypeScript file';
      const agent = 'developer';
      const metadata = {
        fileType: 'typescript',
        operation: 'create',
        estimatedSize: 1024
      };

      // Step 1: Request permission
      const requestId = await orchestrator.requestPermission(
        taskId,
        tool,
        scope,
        description,
        false,
        agent,
        metadata
      );

      // Verify request event
      expect(eventLog).toContain('permission:request');
      expect(eventData.request).toMatchObject({
        requestId,
        tool,
        scope,
        description,
        isDangerous: false,
        agent,
        metadata
      });

      // Step 2: Grant permission
      await orchestrator.grantPermissionConfirmation(
        requestId,
        taskId,
        tool,
        scope,
        'allow-once',
        'user',
        'Approved by user for file creation'
      );

      // Verify grant event
      expect(eventLog).toContain('permission:granted');
      expect(eventData.granted).toMatchObject({
        requestId,
        tool,
        scope,
        level: 'allow-once',
        grantedBy: 'user'
      });

      // Verify event order
      expect(eventLog).toEqual(['permission:request', 'permission:granted']);
    });

    it('should handle permission request-deny workflow', async () => {
      const eventLog: string[] = [];

      orchestrator.on('permission:request', () => eventLog.push('permission:request'));
      orchestrator.on('permission:denied', () => eventLog.push('permission:denied'));

      const requestId = await orchestrator.requestPermission(
        'task-deny-001',
        'Bash',
        '/system/critical',
        'Access system files',
        true,
        'agent'
      );

      await orchestrator.denyPermissionConfirmation(
        requestId,
        'task-deny-001',
        'Bash',
        '/system/critical',
        'security-admin',
        'Access to critical system files denied for security reasons'
      );

      expect(eventLog).toEqual(['permission:request', 'permission:denied']);
    });
  });

  describe('Dangerous Operation Complete Workflows', () => {
    it('should handle dangerous operation detection and confirmation flow', async () => {
      const eventLog: string[] = [];
      const eventData: Record<string, any> = {};

      orchestrator.on('dangerous:detected', (data) => {
        eventLog.push('dangerous:detected');
        eventData.detected = data;
      });
      orchestrator.on('dangerous:confirmed', (data) => {
        eventLog.push('dangerous:confirmed');
        eventData.confirmed = data;
      });

      const taskId = 'task-dangerous-workflow-001';
      const tool = 'Bash';
      const operation = 'sudo systemctl stop postgresql';
      const riskLevel = 'high';
      const riskDescription = 'Stopping critical database service';
      const agent = 'devops';
      const context = {
        service: 'postgresql',
        action: 'stop',
        impact: 'service-interruption'
      };

      // Step 1: Flag dangerous operation
      const operationId = await orchestrator.flagDangerousOperation(
        taskId,
        tool,
        operation,
        riskLevel,
        riskDescription,
        agent,
        context
      );

      expect(eventLog).toContain('dangerous:detected');
      expect(eventData.detected).toMatchObject({
        operationId,
        tool,
        operation,
        riskLevel,
        riskDescription,
        agent,
        context
      });

      // Step 2: Confirm dangerous operation
      await orchestrator.confirmDangerousOperation(
        operationId,
        taskId,
        tool,
        operation,
        'admin',
        'Maintenance window approved by admin'
      );

      expect(eventLog).toContain('dangerous:confirmed');
      expect(eventData.confirmed).toMatchObject({
        operationId,
        tool,
        operation,
        confirmedBy: 'admin'
      });

      expect(eventLog).toEqual(['dangerous:detected', 'dangerous:confirmed']);
    });

    it('should handle dangerous operation detection and blocking flow', async () => {
      const eventLog: string[] = [];

      orchestrator.on('dangerous:detected', () => eventLog.push('dangerous:detected'));
      orchestrator.on('dangerous:blocked', () => eventLog.push('dangerous:blocked'));

      const operationId = await orchestrator.flagDangerousOperation(
        'task-block-001',
        'Bash',
        'rm -rf /var/lib/postgresql',
        'critical',
        'Permanent deletion of database files',
        'agent'
      );

      await orchestrator.blockDangerousOperation(
        operationId,
        'task-block-001',
        'Bash',
        'rm -rf /var/lib/postgresql',
        'security-admin',
        'Extremely dangerous operation blocked by security policy'
      );

      expect(eventLog).toEqual(['dangerous:detected', 'dangerous:blocked']);
    });
  });

  describe('Complex Multi-Operation Scenarios', () => {
    it('should handle permission and dangerous operation workflows together', async () => {
      const eventLog: string[] = [];

      // Set up comprehensive event logging
      const eventTypes = [
        'permission:request', 'permission:granted', 'permission:denied',
        'dangerous:detected', 'dangerous:confirmed', 'dangerous:blocked'
      ];

      eventTypes.forEach(eventType => {
        orchestrator.on(eventType as any, () => eventLog.push(eventType));
      });

      const taskId = 'task-complex-001';

      // Scenario: Request permission first, then detect dangerous operation
      const requestId = await orchestrator.requestPermission(
        taskId,
        'Bash',
        '/etc/nginx',
        'Modify web server configuration',
        true,
        'devops'
      );

      await orchestrator.grantPermissionConfirmation(
        requestId,
        taskId,
        'Bash',
        '/etc/nginx',
        'allow-once',
        'admin',
        'Configuration change approved'
      );

      const operationId = await orchestrator.flagDangerousOperation(
        taskId,
        'Bash',
        'sudo nginx -s reload',
        'medium',
        'Service reload may cause brief interruption',
        'devops'
      );

      await orchestrator.confirmDangerousOperation(
        operationId,
        taskId,
        'Bash',
        'sudo nginx -s reload',
        'admin',
        'Service reload authorized for configuration update'
      );

      expect(eventLog).toEqual([
        'permission:request',
        'permission:granted',
        'dangerous:detected',
        'dangerous:confirmed'
      ]);
    });

    it('should handle multiple concurrent permission requests', async () => {
      const eventCounts = {
        'permission:request': 0,
        'permission:granted': 0,
        'permission:denied': 0
      };

      // Set up counters for each event type
      Object.keys(eventCounts).forEach(eventType => {
        orchestrator.on(eventType as any, () => {
          eventCounts[eventType as keyof typeof eventCounts]++;
        });
      });

      const tasks = [
        { taskId: 'concurrent-001', tool: 'Write', scope: '/path1', shouldGrant: true },
        { taskId: 'concurrent-002', tool: 'Read', scope: '/path2', shouldGrant: true },
        { taskId: 'concurrent-003', tool: 'Bash', scope: '/system', shouldGrant: false },
        { taskId: 'concurrent-004', tool: 'Edit', scope: '/path3', shouldGrant: true },
        { taskId: 'concurrent-005', tool: 'Delete', scope: '/sensitive', shouldGrant: false }
      ];

      // Make all permission requests concurrently
      const requestIds = await Promise.all(
        tasks.map(task =>
          orchestrator.requestPermission(
            task.taskId,
            task.tool,
            task.scope,
            `Operation for ${task.taskId}`,
            false,
            'test-agent'
          )
        )
      );

      // Process all confirmations
      await Promise.all(
        requestIds.map((requestId, index) => {
          const task = tasks[index];
          return task.shouldGrant
            ? orchestrator.grantPermissionConfirmation(
                requestId,
                task.taskId,
                task.tool,
                task.scope,
                'allow-once',
                'user'
              )
            : orchestrator.denyPermissionConfirmation(
                requestId,
                task.taskId,
                task.tool,
                task.scope,
                'user',
                'Denied by policy'
              );
        })
      );

      // Verify all events were processed
      expect(eventCounts['permission:request']).toBe(5);
      expect(eventCounts['permission:granted']).toBe(3);
      expect(eventCounts['permission:denied']).toBe(2);
    });

    it('should handle mixed dangerous operations with different risk levels', async () => {
      const eventCounts = {
        'dangerous:detected': 0,
        'dangerous:confirmed': 0,
        'dangerous:blocked': 0
      };

      Object.keys(eventCounts).forEach(eventType => {
        orchestrator.on(eventType as any, () => {
          eventCounts[eventType as keyof typeof eventCounts]++;
        });
      });

      const operations = [
        {
          taskId: 'risk-001',
          operation: 'service restart',
          riskLevel: 'low' as const,
          shouldConfirm: true
        },
        {
          taskId: 'risk-002',
          operation: 'file deletion',
          riskLevel: 'medium' as const,
          shouldConfirm: true
        },
        {
          taskId: 'risk-003',
          operation: 'system format',
          riskLevel: 'critical' as const,
          shouldConfirm: false
        },
        {
          taskId: 'risk-004',
          operation: 'permission change',
          riskLevel: 'high' as const,
          shouldConfirm: false
        }
      ];

      // Flag all dangerous operations
      const operationIds = await Promise.all(
        operations.map(op =>
          orchestrator.flagDangerousOperation(
            op.taskId,
            'Bash',
            op.operation,
            op.riskLevel,
            `Risk level: ${op.riskLevel}`,
            'test-agent'
          )
        )
      );

      // Process all confirmations/blocks
      await Promise.all(
        operationIds.map((operationId, index) => {
          const operation = operations[index];
          return operation.shouldConfirm
            ? orchestrator.confirmDangerousOperation(
                operationId,
                operation.taskId,
                'Bash',
                operation.operation,
                'admin',
                'Approved operation'
              )
            : orchestrator.blockDangerousOperation(
                operationId,
                operation.taskId,
                'Bash',
                operation.operation,
                'security',
                'Blocked high-risk operation'
              );
        })
      );

      expect(eventCounts['dangerous:detected']).toBe(4);
      expect(eventCounts['dangerous:confirmed']).toBe(2);
      expect(eventCounts['dangerous:blocked']).toBe(2);
    });
  });

  describe('Permission Store Integration', () => {
    it('should persist granted permissions across operations', async () => {
      const tool = 'Write';
      const scope = '/persistent/path';

      // Grant a persistent permission
      await orchestrator.grantPermissionConfirmation(
        'req-persistent-001',
        'task-001',
        tool,
        scope,
        'allow-always',
        'admin',
        'Persistent permission for development'
      );

      // Verify permission is stored
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(true);

      // Test with different scope - should not have permission
      const hasOtherPermission = await orchestrator['permissionManager'].hasPermission(tool, '/different/path');
      expect(hasOtherPermission).toBe(false);
    });

    it('should handle permission denials correctly', async () => {
      const tool = 'Bash';
      const scope = '/restricted/area';

      // Deny permission
      await orchestrator.denyPermissionConfirmation(
        'req-deny-001',
        'task-001',
        tool,
        scope,
        'security',
        'Access denied by security policy'
      );

      // Verify permission is explicitly denied
      const hasPermission = await orchestrator['permissionManager'].hasPermission(tool, scope);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rapid sequential operations correctly', async () => {
      const eventCounts: Record<string, number> = {};
      const eventTypes = [
        'permission:request', 'permission:granted',
        'dangerous:detected', 'dangerous:confirmed'
      ];

      eventTypes.forEach(type => {
        eventCounts[type] = 0;
        orchestrator.on(type as any, () => eventCounts[type]++);
      });

      // Rapid sequence of operations
      for (let i = 0; i < 10; i++) {
        const requestId = await orchestrator.requestPermission(
          `rapid-task-${i}`,
          'TestTool',
          `/path/${i}`,
          `Rapid operation ${i}`,
          false,
          'test-agent'
        );

        await orchestrator.grantPermissionConfirmation(
          requestId,
          `rapid-task-${i}`,
          'TestTool',
          `/path/${i}`,
          'allow-once',
          'user'
        );

        if (i % 3 === 0) {
          const opId = await orchestrator.flagDangerousOperation(
            `rapid-task-${i}`,
            'TestTool',
            `operation-${i}`,
            'low',
            'Test operation',
            'test-agent'
          );

          await orchestrator.confirmDangerousOperation(
            opId,
            `rapid-task-${i}`,
            'TestTool',
            `operation-${i}`,
            'admin',
            'Auto-approved'
          );
        }
      }

      expect(eventCounts['permission:request']).toBe(10);
      expect(eventCounts['permission:granted']).toBe(10);
      expect(eventCounts['dangerous:detected']).toBe(4);
      expect(eventCounts['dangerous:confirmed']).toBe(4);
    });

    it('should generate unique IDs for all operations', async () => {
      const requestIds: string[] = [];
      const operationIds: string[] = [];

      // Generate multiple IDs rapidly
      for (let i = 0; i < 20; i++) {
        const requestId = await orchestrator.requestPermission(
          `unique-test-${i}`,
          'TestTool',
          undefined,
          'Test operation',
          false,
          'agent'
        );
        requestIds.push(requestId);

        const operationId = await orchestrator.flagDangerousOperation(
          `unique-test-${i}`,
          'TestTool',
          'test-operation',
          'low',
          'Test',
          'agent'
        );
        operationIds.push(operationId);
      }

      // Verify all request IDs are unique
      const uniqueRequestIds = new Set(requestIds);
      expect(uniqueRequestIds.size).toBe(requestIds.length);

      // Verify all operation IDs are unique
      const uniqueOperationIds = new Set(operationIds);
      expect(uniqueOperationIds.size).toBe(operationIds.length);

      // Verify ID format compliance
      requestIds.forEach(id => {
        expect(id).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
      });

      operationIds.forEach(id => {
        expect(id).toMatch(/^danger-op-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('Permission Preset Integration', () => {
    it('should work correctly with different permission presets', async () => {
      const presets = ['autonomous', 'review-all', 'read-only'] as const;

      for (const preset of presets) {
        // Change to preset
        await orchestrator.setPreset(preset);
        const currentPreset = await orchestrator.getCurrentPreset();
        expect(currentPreset).toBe(preset);

        // Test permission operations still work
        const requestId = await orchestrator.requestPermission(
          `preset-test-${preset}`,
          'TestTool',
          `/test/${preset}`,
          `Test with ${preset} preset`,
          false,
          'test-agent'
        );

        expect(requestId).toMatch(/^perm-req-\d+-[a-z0-9]+$/);
      }
    });
  });

  describe('Event Data Integrity', () => {
    it('should maintain event data integrity across all operations', async () => {
      const collectedEvents: Array<{ type: string; data: any; timestamp: Date }> = [];

      // Collect all events with timestamps
      const eventTypes = [
        'permission:request', 'permission:granted', 'permission:denied',
        'dangerous:detected', 'dangerous:confirmed', 'dangerous:blocked'
      ];

      eventTypes.forEach(type => {
        orchestrator.on(type as any, (data: any) => {
          collectedEvents.push({
            type,
            data: { ...data },
            timestamp: new Date()
          });
        });
      });

      // Execute a comprehensive workflow
      const requestId = await orchestrator.requestPermission(
        'integrity-test',
        'ComplexTool',
        '/test/integrity',
        'Complex operation for integrity testing',
        true,
        'test-agent',
        { complexity: 'high', validation: true }
      );

      await orchestrator.grantPermissionConfirmation(
        requestId,
        'integrity-test',
        'ComplexTool',
        '/test/integrity',
        'allow-once',
        'admin',
        'Integrity test approved'
      );

      const operationId = await orchestrator.flagDangerousOperation(
        'integrity-test',
        'ComplexTool',
        'complex dangerous operation',
        'high',
        'High-risk operation for testing',
        'test-agent',
        { integrityCheck: true }
      );

      await orchestrator.confirmDangerousOperation(
        operationId,
        'integrity-test',
        'ComplexTool',
        'complex dangerous operation',
        'admin',
        'Confirmed for integrity testing'
      );

      // Verify event data integrity
      expect(collectedEvents).toHaveLength(4);

      const requestEvent = collectedEvents.find(e => e.type === 'permission:request');
      expect(requestEvent?.data).toMatchObject({
        tool: 'ComplexTool',
        scope: '/test/integrity',
        isDangerous: true,
        agent: 'test-agent',
        metadata: { complexity: 'high', validation: true }
      });

      const grantEvent = collectedEvents.find(e => e.type === 'permission:granted');
      expect(grantEvent?.data).toMatchObject({
        requestId,
        level: 'allow-once',
        grantedBy: 'admin'
      });

      const dangerousEvent = collectedEvents.find(e => e.type === 'dangerous:detected');
      expect(dangerousEvent?.data).toMatchObject({
        operationId,
        riskLevel: 'high',
        context: { integrityCheck: true }
      });

      const confirmEvent = collectedEvents.find(e => e.type === 'dangerous:confirmed');
      expect(confirmEvent?.data).toMatchObject({
        operationId,
        confirmedBy: 'admin'
      });

      // Verify all events have valid timestamps
      collectedEvents.forEach(event => {
        expect(event.data.timestamp).toBeInstanceOf(Date);
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});