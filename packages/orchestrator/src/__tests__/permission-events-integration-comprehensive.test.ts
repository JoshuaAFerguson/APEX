import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData
} from '../index.js';
import { PermissionLevel } from '@apexcli/core';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

/**
 * Comprehensive integration tests for orchestrator permission event emission
 *
 * This test suite verifies that:
 * 1. Permission change events are triggered correctly with accurate payload structure
 * 2. Events are properly emitted via EventEmitter interface
 * 3. Event data structure matches type definitions
 * 4. Multiple listeners work correctly
 * 5. Events are emitted in proper sequence during permission workflows
 */
describe('Orchestrator Permission Event Integration', () => {
  let orchestrator: ApexOrchestrator;
  let testDbPath: string;
  let emittedEvents: Array<{ type: string; data: any; timestamp: number }> = [];

  beforeEach(async () => {
    // Create temporary SQLite database for testing
    testDbPath = join(tmpdir(), `apex-permission-integration-test-${Date.now()}.db`);

    // Initialize orchestrator with minimal test configuration
    orchestrator = new ApexOrchestrator({
      projectPath: '/tmp/test-project'
    });
    await orchestrator.initialize();

    // Clear event tracking array
    emittedEvents = [];

    // Set up comprehensive event listeners to capture all permission events
    const eventTypes = [
      'permission:request',
      'permission:granted',
      'permission:denied',
      'dangerous:detected',
      'dangerous:confirmed',
      'dangerous:blocked'
    ] as const;

    eventTypes.forEach(eventType => {
      orchestrator.on(eventType, (data) => {
        emittedEvents.push({
          type: eventType,
          data,
          timestamp: Date.now()
        });
      });
    });
  });

  afterEach(async () => {
    // Clean up
    await orchestrator.shutdown();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Permission Request Event Integration', () => {
    it('should emit permission:request event when requesting tool permission', async () => {
      // Use orchestrator's built-in method to request permission
      const requestId = await orchestrator.requestPermission(
        'test-task-123',
        'Write',
        '/project/src/test.ts',
        'Need to write test file',
        false,
        'developer'
      );

      // Verify event was emitted
      const requestEvents = emittedEvents.filter(e => e.type === 'permission:request');
      expect(requestEvents).toHaveLength(1);

      const eventData = requestEvents[0].data as PermissionRequestEventData;
      expect(eventData.requestId).toBe(requestId);
      expect(eventData.tool).toBe('Write');
      expect(eventData.scope).toBe('/project/src/test.ts');
      expect(eventData.description).toBe('Need to write test file');
      expect(eventData.isDangerous).toBe(false);
      expect(eventData.agent).toBe('developer');
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should emit permission:request event for dangerous operations', async () => {
      const requestId = await orchestrator.requestPermission(
        'test-task-dangerous',
        'Bash',
        '/system',
        'Need to run system command',
        true,
        'admin-agent'
      );

      const requestEvents = emittedEvents.filter(e => e.type === 'permission:request');
      expect(requestEvents).toHaveLength(1);

      const eventData = requestEvents[0].data as PermissionRequestEventData;
      expect(eventData.requestId).toBe(requestId);
      expect(eventData.tool).toBe('Bash');
      expect(eventData.scope).toBe('/system');
      expect(eventData.isDangerous).toBe(true);
      expect(eventData.agent).toBe('admin-agent');
    });
  });

  describe('Permission Grant Event Integration', () => {
    it('should emit permission:granted event when granting permission', async () => {
      const requestId = 'grant-test-123';

      await orchestrator.grantPermissionConfirmation(
        requestId,
        'test-task-grant',
        'Read',
        '/project/config',
        'allow-once',
        'user',
        'Approved for configuration read'
      );

      const grantEvents = emittedEvents.filter(e => e.type === 'permission:granted');
      expect(grantEvents).toHaveLength(1);

      const eventData = grantEvents[0].data as PermissionGrantedEventData;
      expect(eventData.requestId).toBe(requestId);
      expect(eventData.tool).toBe('Read');
      expect(eventData.scope).toBe('/project/config');
      expect(eventData.level).toBe('allow-once');
      expect(eventData.grantedBy).toBe('user');
      expect(eventData.reason).toBe('Approved for configuration read');
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should emit permission:granted event for allow-always grants', async () => {
      const requestId = 'grant-always-test';

      await orchestrator.grantPermissionConfirmation(
        requestId,
        'test-task-grant-always',
        'Glob',
        '/project/**/*.ts',
        'allow-always',
        'admin'
      );

      const grantEvents = emittedEvents.filter(e => e.type === 'permission:granted');
      expect(grantEvents).toHaveLength(1);

      const eventData = grantEvents[0].data as PermissionGrantedEventData;
      expect(eventData.requestId).toBe(requestId);
      expect(eventData.level).toBe('allow-always');
      expect(eventData.grantedBy).toBe('admin');
      expect(eventData.reason).toBeUndefined(); // No reason provided
    });
  });

  describe('Permission Denial Event Integration', () => {
    it('should emit permission:denied event when denying permission', async () => {
      const requestId = 'deny-test-456';

      await orchestrator.denyPermissionConfirmation(
        requestId,
        'test-task-deny',
        'Edit',
        '/protected/system.conf',
        'system-policy',
        'Access to system configuration denied'
      );

      const denyEvents = emittedEvents.filter(e => e.type === 'permission:denied');
      expect(denyEvents).toHaveLength(1);

      const eventData = denyEvents[0].data as PermissionDeniedEventData;
      expect(eventData.requestId).toBe(requestId);
      expect(eventData.tool).toBe('Edit');
      expect(eventData.scope).toBe('/protected/system.conf');
      expect(eventData.deniedBy).toBe('system-policy');
      expect(eventData.reason).toBe('Access to system configuration denied');
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Dangerous Operation Event Integration', () => {
    it('should emit dangerous:detected event when detecting dangerous operations', async () => {
      const operationId = await orchestrator.flagDangerousOperation(
        'dangerous-task-123',
        'Bash',
        'file-deletion',
        'high',
        'Detected rm -rf command',
        'security-agent',
        { command: 'rm -rf /tmp/*' }
      );

      const detectedEvents = emittedEvents.filter(e => e.type === 'dangerous:detected');
      expect(detectedEvents).toHaveLength(1);

      const eventData = detectedEvents[0].data as DangerousOperationDetectedEventData;
      expect(eventData.operationId).toBe(operationId);
      expect(eventData.tool).toBe('Bash');
      expect(eventData.operation).toBe('file-deletion');
      expect(eventData.riskLevel).toBe('high');
      expect(eventData.riskDescription).toBe('Detected rm -rf command');
      expect(eventData.agent).toBe('security-agent');
      expect(eventData.context).toEqual({ command: 'rm -rf /tmp/*' });
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should emit dangerous:confirmed event when confirming dangerous operation', async () => {
      const operationId = 'dangerous-confirm-789';

      await orchestrator.confirmDangerousOperation(
        operationId,
        'confirm-task',
        'Write',
        'data-modification',
        'admin-user',
        'User manually reviewed and approved operation'
      );

      const confirmEvents = emittedEvents.filter(e => e.type === 'dangerous:confirmed');
      expect(confirmEvents).toHaveLength(1);

      const eventData = confirmEvents[0].data as DangerousOperationConfirmedEventData;
      expect(eventData.operationId).toBe(operationId);
      expect(eventData.tool).toBe('Write');
      expect(eventData.operation).toBe('data-modification');
      expect(eventData.confirmedBy).toBe('admin-user');
      expect(eventData.reason).toBe('User manually reviewed and approved operation');
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });

    it('should emit dangerous:blocked event when blocking dangerous operation', async () => {
      const operationId = 'dangerous-block-abc';

      await orchestrator.blockDangerousOperation(
        operationId,
        'block-task',
        'Bash',
        'privilege-escalation',
        'security-policy',
        'Operation exceeds maximum risk threshold'
      );

      const blockEvents = emittedEvents.filter(e => e.type === 'dangerous:blocked');
      expect(blockEvents).toHaveLength(1);

      const eventData = blockEvents[0].data as DangerousOperationBlockedEventData;
      expect(eventData.operationId).toBe(operationId);
      expect(eventData.tool).toBe('Bash');
      expect(eventData.operation).toBe('privilege-escalation');
      expect(eventData.blockedBy).toBe('security-policy');
      expect(eventData.reason).toBe('Operation exceeds maximum risk threshold');
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Event Payload Structure Validation', () => {
    it('should validate all required fields are present in permission events', async () => {
      // Request permission
      const requestId = await orchestrator.requestPermission(
        'validation-task',
        'TestTool',
        '/test/path',
        'Test description',
        false
      );

      // Grant permission
      await orchestrator.grantPermissionConfirmation(
        requestId,
        'validation-task',
        'TestTool',
        '/test/path',
        'allow-once',
        'test-user'
      );

      // Deny another permission
      await orchestrator.denyPermissionConfirmation(
        'deny-validation-task',
        'deny-validation-task',
        'DeniedTool',
        '/denied/path',
        'test-policy',
        'Test denial reason'
      );

      // Verify all events have required fields
      const events = emittedEvents;
      expect(events).toHaveLength(3);

      events.forEach(event => {
        const { data } = event;

        // All events should have these common fields
        expect(typeof data.requestId === 'string' || typeof data.operationId === 'string').toBe(true);
        expect(typeof data.tool).toBe('string');
        expect(data.timestamp).toBeInstanceOf(Date);

        // Event-specific validations
        if (event.type === 'permission:request') {
          const reqData = data as PermissionRequestEventData;
          expect(typeof reqData.description).toBe('string');
          expect(typeof reqData.isDangerous).toBe('boolean');
        }

        if (event.type === 'permission:granted') {
          const grantData = data as PermissionGrantedEventData;
          expect(['allow-always', 'allow-once', 'deny']).toContain(grantData.level);
          expect(typeof grantData.grantedBy).toBe('string');
        }

        if (event.type === 'permission:denied') {
          const denyData = data as PermissionDeniedEventData;
          expect(typeof denyData.reason).toBe('string');
          expect(typeof denyData.deniedBy).toBe('string');
        }
      });
    });
  });

  describe('Event Listener Management Integration', () => {
    it('should support multiple listeners for permission events', async () => {
      const listener1Events: any[] = [];
      const listener2Events: any[] = [];
      const listener3Events: any[] = [];

      // Add multiple listeners for the same event type
      orchestrator.on('permission:request', (data) => listener1Events.push(data));
      orchestrator.on('permission:request', (data) => listener2Events.push(data));
      orchestrator.on('permission:request', (data) => listener3Events.push(data));

      // Emit event
      await orchestrator.requestPermission(
        'multi-listener-test',
        'MultiTool',
        '/multi/path',
        'Multi-listener test',
        false
      );

      // All listeners should receive the event
      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener3Events).toHaveLength(1);

      // All should receive the same data
      expect(listener1Events[0].requestId).toBe('multi-listener-test');
      expect(listener2Events[0].requestId).toBe('multi-listener-test');
      expect(listener3Events[0].requestId).toBe('multi-listener-test');
    });

    it('should support once() listeners for one-time event handling', async () => {
      const onceListener = vi.fn();
      const regularListener = vi.fn();

      orchestrator.once('permission:granted', onceListener);
      orchestrator.on('permission:granted', regularListener);

      // First grant
      await orchestrator.grantPermissionConfirmation('once-test-1', 'once-test-task-1', 'Tool1', undefined, 'allow-once', 'user1');

      // Second grant
      await orchestrator.grantPermissionConfirmation('once-test-2', 'once-test-task-2', 'Tool2', undefined, 'allow-always', 'user2');

      // Once listener should only be called once
      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(regularListener).toHaveBeenCalledTimes(2);
    });

    it('should handle event listener removal correctly', async () => {
      const listener = vi.fn();

      orchestrator.on('permission:denied', listener);

      // Emit event - should be handled
      await orchestrator.denyPermissionConfirmation('removal-test-1', 'removal-test-task-1', 'Tool1', undefined, 'test', 'Test denial');
      expect(listener).toHaveBeenCalledTimes(1);

      // Remove listener
      orchestrator.off('permission:denied', listener);

      // Emit again - should not be handled
      await orchestrator.denyPermissionConfirmation('removal-test-2', 'removal-test-task-2', 'Tool2', undefined, 'test', 'Test denial 2');
      expect(listener).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe('Permission Workflow Event Sequence Integration', () => {
    it('should emit events in correct sequence during full permission workflow', async () => {
      const taskId = 'workflow-test-task';

      // Clear existing events
      emittedEvents = [];

      // 1. Request permission for safe operation
      const requestId1 = await orchestrator.requestPermission(
        taskId,
        'Read',
        '/project/data.json',
        'Need to read configuration',
        false,
        'data-agent'
      );

      // 2. Grant the permission
      await orchestrator.grantPermissionConfirmation(
        requestId1,
        taskId,
        'Read',
        '/project/data.json',
        'allow-once',
        'user',
        'Approved for data read'
      );

      // 3. Request permission for dangerous operation
      const requestId2 = await orchestrator.requestPermission(
        taskId + '-dangerous',
        'Bash',
        '/system/critical',
        'Need to run system maintenance',
        true,
        'maintenance-agent'
      );

      // 4. Detect dangerous operation
      const operationId = await orchestrator.flagDangerousOperation(
        requestId2,
        'Bash',
        'system-modification',
        'critical',
        'System file modification detected',
        'maintenance-agent',
        { target: '/system/critical/config.sys' }
      );

      // 5. Block the dangerous operation
      await orchestrator.blockDangerousOperation(
        operationId,
        taskId + '-dangerous',
        'Bash',
        'system-modification',
        'security-system',
        'Critical system modification blocked'
      );

      // 6. Deny the original permission request
      await orchestrator.denyPermissionConfirmation(
        requestId2,
        taskId + '-dangerous',
        'Bash',
        '/system/critical',
        'security-system',
        'Dangerous operation detected and blocked'
      );

      // Verify complete workflow sequence
      expect(emittedEvents).toHaveLength(6);

      // Check event sequence
      expect(emittedEvents[0].type).toBe('permission:request');
      expect(emittedEvents[0].data.requestId).toBe(requestId1);

      expect(emittedEvents[1].type).toBe('permission:granted');
      expect(emittedEvents[1].data.requestId).toBe(requestId1);

      expect(emittedEvents[2].type).toBe('permission:request');
      expect(emittedEvents[2].data.requestId).toBe(requestId2);

      expect(emittedEvents[3].type).toBe('dangerous:detected');
      expect(emittedEvents[3].data.operationId).toBe(operationId);

      expect(emittedEvents[4].type).toBe('dangerous:blocked');
      expect(emittedEvents[4].data.operationId).toBe(operationId);

      expect(emittedEvents[5].type).toBe('permission:denied');
      expect(emittedEvents[5].data.requestId).toBe(requestId2);

      // Verify timestamps are in chronological order
      for (let i = 1; i < emittedEvents.length; i++) {
        expect(emittedEvents[i].timestamp).toBeGreaterThanOrEqual(emittedEvents[i - 1].timestamp);
      }
    });

    it('should handle concurrent permission requests with correct event emission', async () => {
      // Clear existing events
      emittedEvents = [];

      // Make concurrent permission requests
      const promises = [
        orchestrator.requestPermission('concurrent-1', 'Tool1', '/path1', 'Description 1', false),
        orchestrator.requestPermission('concurrent-2', 'Tool2', '/path2', 'Description 2', false),
        orchestrator.requestPermission('concurrent-3', 'Tool3', '/path3', 'Description 3', true)
      ];

      const requestIds = await Promise.all(promises);

      // Should have 3 request events
      const requestEvents = emittedEvents.filter(e => e.type === 'permission:request');
      expect(requestEvents).toHaveLength(3);

      // Verify each request has unique ID and correct data
      requestIds.forEach((id, index) => {
        const event = requestEvents.find(e => e.data.requestId === id);
        expect(event).toBeDefined();
        expect(event!.data.tool).toBe(`Tool${index + 1}`);
        expect(event!.data.scope).toBe(`/path${index + 1}`);
      });

      // Grant/deny permissions concurrently
      await Promise.all([
        orchestrator.grantPermissionConfirmation(requestIds[0], 'concurrent-1', 'Tool1', '/path1', 'allow-once', 'user'),
        orchestrator.grantPermissionConfirmation(requestIds[1], 'concurrent-2', 'Tool2', '/path2', 'allow-always', 'admin'),
        orchestrator.denyPermissionConfirmation(requestIds[2], 'concurrent-3', 'Tool3', '/path3', 'security', 'Dangerous operation')
      ]);

      // Should now have 6 events total (3 requests + 2 grants + 1 denial)
      expect(emittedEvents).toHaveLength(6);

      const grantEvents = emittedEvents.filter(e => e.type === 'permission:granted');
      const denyEvents = emittedEvents.filter(e => e.type === 'permission:denied');

      expect(grantEvents).toHaveLength(2);
      expect(denyEvents).toHaveLength(1);
    });
  });

  describe('TaskStore Integration with Permission Events', () => {
    it('should emit permission events for tasks stored in TaskStore', async () => {
      // Create a test task in the store
      const testTask = {
        id: 'permission-store-task',
        type: 'feature' as const,
        title: 'Test permission with TaskStore',
        description: 'Testing permission event integration with TaskStore',
        status: 'pending' as const,
        stage: 'planning',
        agent: 'test-agent',
        branch: 'test-branch',
        workflow: 'test-workflow',
        created: new Date(),
        priority: 'medium' as const,
        usage: { cost: 0, tokens: 0 }
      };

      await orchestrator.store.createTask(testTask);

      // Request permission for the stored task
      const requestId = await orchestrator.requestPermission(
        testTask.id,
        'Write',
        '/project/test.ts',
        'Task needs to write test file',
        false,
        testTask.agent
      );

      // Verify the task exists in store
      const storedTask = await orchestrator.store.getTask(testTask.id);
      expect(storedTask).toBeDefined();
      expect(storedTask?.id).toBe(testTask.id);

      // Verify permission event was emitted
      const requestEvents = emittedEvents.filter(e => e.type === 'permission:request');
      expect(requestEvents).toHaveLength(1);
      expect(requestEvents[0].data.requestId).toBe(requestId);
      expect(requestEvents[0].data.agent).toBe(testTask.agent);

      // Grant permission and verify event
      await orchestrator.grantPermissionConfirmation(
        requestId,
        testTask.id,
        'Write',
        '/project/test.ts',
        'allow-once',
        'user',
        'Approved for task execution'
      );

      const grantEvents = emittedEvents.filter(e => e.type === 'permission:granted');
      expect(grantEvents).toHaveLength(1);
      expect(grantEvents[0].data.requestId).toBe(requestId);

      // Verify task still exists after permission workflow
      const taskAfterPermission = await orchestrator.store.getTask(testTask.id);
      expect(taskAfterPermission).toBeDefined();
      expect(taskAfterPermission?.id).toBe(testTask.id);
    });
  });

  describe('Event Error Handling Integration', () => {
    it('should handle permission event emission errors gracefully', async () => {
      // Add a listener that throws an error
      orchestrator.on('permission:request', () => {
        throw new Error('Simulated listener error');
      });

      // Add a normal listener that should still work
      const normalListener = vi.fn();
      orchestrator.on('permission:request', normalListener);

      // Request permission - should not throw despite error listener
      expect(async () => {
        await orchestrator.requestPermission(
          'error-handling-test',
          'ErrorTool',
          '/error/path',
          'Testing error handling',
          false
        );
      }).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalledTimes(1);
    });

    it('should validate event data structure before emission', async () => {
      const invalidListener = vi.fn();
      orchestrator.on('permission:request', invalidListener);

      // Request with valid data
      await orchestrator.requestPermission(
        'validation-test',
        'ValidTool',
        '/valid/path',
        'Valid description',
        false
      );

      // Verify listener was called with valid data
      expect(invalidListener).toHaveBeenCalledTimes(1);
      const eventData = invalidListener.mock.calls[0][0] as PermissionRequestEventData;

      // Validate required fields
      expect(typeof eventData.requestId).toBe('string');
      expect(typeof eventData.tool).toBe('string');
      expect(typeof eventData.description).toBe('string');
      expect(typeof eventData.isDangerous).toBe('boolean');
      expect(eventData.timestamp).toBeInstanceOf(Date);
    });
  });
});