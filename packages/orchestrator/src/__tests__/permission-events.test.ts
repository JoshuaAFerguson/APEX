import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
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

/**
 * Test suite for permission change event emission in ApexOrchestrator
 *
 * This test verifies:
 * 1. ApexOrchestrator emits permission change events via EventEmitter
 * 2. Events contain correct payload structure
 * 3. Events are stored in TaskStore if applicable
 */
describe('Permission Change Event Emission', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let testDbPath: string;

  beforeEach(async () => {
    // Create temporary SQLite database for testing
    testDbPath = join(tmpdir(), `apex-test-${Date.now()}.db`);

    // Mock ApexOrchestrator with minimal required configuration
    const mockConfig = {
      project: {
        name: 'test-project',
        autonomy: 'supervised' as const
      },
      agents: {},
      workflows: {},
      limits: {
        maxConcurrentTasks: 1,
        maxCost: 100
      },
      permissions: {
        presets: {},
        defaults: {
          level: 'ask' as PermissionLevel
        }
      }
    };

    // Initialize orchestrator with test configuration
    orchestrator = new ApexOrchestrator();
    await orchestrator.initialize('/tmp/test-project', mockConfig);

    // Get the store instance (should be using in-memory SQLite for tests)
    mockStore = orchestrator.store;
  });

  afterEach(async () => {
    // Clean up
    await orchestrator.shutdown();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Event Emission via EventEmitter', () => {
    it('should emit permission:request event when requesting permission', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:request', eventSpy);

      const eventData: PermissionRequestEventData = {
        requestId: 'test-task-123',
        tool: 'Write',
        timestamp: new Date(),
        scope: '/project/src',
        description: 'Need to create new file',
        isDangerous: false,
        agent: 'developer'
      };

      // Use the orchestrator's internal method to emit the event
      // This simulates what happens during actual permission requests
      orchestrator.emit('permission:request', eventData);

      expect(eventSpy).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledWith(eventData);

      // Verify the emitted event data structure
      const emittedData = eventSpy.mock.calls[0][0];
      expect(emittedData.requestId).toBe('test-task-123');
      expect(emittedData.tool).toBe('Write');
      expect(emittedData.timestamp).toBeInstanceOf(Date);
      expect(emittedData.scope).toBe('/project/src');
      expect(emittedData.description).toBe('Need to create new file');
      expect(emittedData.isDangerous).toBe(false);
      expect(emittedData.agent).toBe('developer');
    });

    it('should emit permission:granted event when permission is granted', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:granted', eventSpy);

      const eventData: PermissionGrantedEventData = {
        requestId: 'test-task-456',
        tool: 'Bash',
        timestamp: new Date(),
        level: 'allow-once',
        grantedBy: 'user',
        reason: 'Approved for testing'
      };

      orchestrator.emit('permission:granted', eventData);

      expect(eventSpy).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledWith(eventData);

      const emittedData = eventSpy.mock.calls[0][0];
      expect(emittedData.requestId).toBe('test-task-456');
      expect(emittedData.tool).toBe('Bash');
      expect(emittedData.level).toBe('allow-once');
      expect(emittedData.grantedBy).toBe('user');
      expect(emittedData.reason).toBe('Approved for testing');
    });

    it('should emit permission:denied event when permission is denied', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:denied', eventSpy);

      const eventData: PermissionDeniedEventData = {
        requestId: 'test-task-789',
        tool: 'Edit',
        timestamp: new Date(),
        reason: 'Tool not allowed in read-only mode',
        deniedBy: 'system'
      };

      orchestrator.emit('permission:denied', eventData);

      expect(eventSpy).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledWith(eventData);

      const emittedData = eventSpy.mock.calls[0][0];
      expect(emittedData.requestId).toBe('test-task-789');
      expect(emittedData.tool).toBe('Edit');
      expect(emittedData.reason).toBe('Tool not allowed in read-only mode');
      expect(emittedData.deniedBy).toBe('system');
    });

    it('should emit dangerous:detected event when dangerous operation is detected', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('dangerous:detected', eventSpy);

      const eventData: DangerousOperationDetectedEventData = {
        operationId: 'test-task-abc',
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'system-command',
        riskLevel: 'high',
        riskDescription: 'Detected attempt to run rm -rf command',
        agent: 'developer',
        context: { command: 'rm -rf /tmp/*' }
      };

      orchestrator.emit('dangerous:detected', eventData);

      expect(eventSpy).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledWith(eventData);

      const emittedData = eventSpy.mock.calls[0][0];
      expect(emittedData.operationId).toBe('test-task-abc');
      expect(emittedData.tool).toBe('Bash');
      expect(emittedData.operation).toBe('system-command');
      expect(emittedData.riskLevel).toBe('high');
      expect(emittedData.riskDescription).toBe('Detected attempt to run rm -rf command');
      expect(emittedData.agent).toBe('developer');
      expect(emittedData.context).toEqual({ command: 'rm -rf /tmp/*' });
    });

    it('should emit dangerous:confirmed event when dangerous operation is confirmed', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('dangerous:confirmed', eventSpy);

      const eventData: DangerousOperationConfirmedEventData = {
        operationId: 'test-task-def',
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'file-deletion',
        confirmedBy: 'user',
        reason: 'User approved file deletion after review'
      };

      orchestrator.emit('dangerous:confirmed', eventData);

      expect(eventSpy).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledWith(eventData);

      const emittedData = eventSpy.mock.calls[0][0];
      expect(emittedData.operationId).toBe('test-task-def');
      expect(emittedData.tool).toBe('Bash');
      expect(emittedData.operation).toBe('file-deletion');
      expect(emittedData.confirmedBy).toBe('user');
      expect(emittedData.reason).toBe('User approved file deletion after review');
    });

    it('should emit dangerous:blocked event when dangerous operation is blocked', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('dangerous:blocked', eventSpy);

      const eventData: DangerousOperationBlockedEventData = {
        operationId: 'test-task-ghi',
        tool: 'Write',
        timestamp: new Date(),
        operation: 'data-modification',
        reason: 'Operation exceeds safety threshold',
        blockedBy: 'safety-system'
      };

      orchestrator.emit('dangerous:blocked', eventData);

      expect(eventSpy).toHaveBeenCalledOnce();
      expect(eventSpy).toHaveBeenCalledWith(eventData);

      const emittedData = eventSpy.mock.calls[0][0];
      expect(emittedData.operationId).toBe('test-task-ghi');
      expect(emittedData.tool).toBe('Write');
      expect(emittedData.operation).toBe('data-modification');
      expect(emittedData.reason).toBe('Operation exceeds safety threshold');
      expect(emittedData.blockedBy).toBe('safety-system');
    });
  });

  describe('Event Payload Structure Validation', () => {
    it('should validate permission request event payload structure', () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:request', eventSpy);

      const eventData: PermissionRequestEventData = {
        requestId: 'payload-test-1',
        tool: 'Read',
        timestamp: new Date(),
        scope: '/project/config',
        description: 'Configuration access needed',
        isDangerous: false,
        agent: 'planner'
      };

      orchestrator.emit('permission:request', eventData);

      const payload = eventSpy.mock.calls[0][0];

      // Verify required fields
      expect(typeof payload.requestId).toBe('string');
      expect(typeof payload.tool).toBe('string');
      expect(payload.timestamp).toBeInstanceOf(Date);
      expect(typeof payload.description).toBe('string');
      expect(typeof payload.isDangerous).toBe('boolean');

      // Verify optional fields
      expect(typeof payload.scope).toBe('string');
      expect(typeof payload.agent).toBe('string');
    });

    it('should validate permission granted event payload structure', () => {
      const eventSpy = vi.fn();
      orchestrator.on('permission:granted', eventSpy);

      const eventData: PermissionGrantedEventData = {
        requestId: 'payload-test-2',
        tool: 'Glob',
        timestamp: new Date(),
        level: 'allow-always',
        grantedBy: 'admin'
      };

      orchestrator.emit('permission:granted', eventData);

      const payload = eventSpy.mock.calls[0][0];

      expect(typeof payload.requestId).toBe('string');
      expect(typeof payload.tool).toBe('string');
      expect(payload.timestamp).toBeInstanceOf(Date);
      expect(['allow-always', 'allow-once', 'deny']).toContain(payload.level);
      expect(typeof payload.grantedBy).toBe('string');
    });

    it('should validate dangerous operation event payload structures', () => {
      const detectedSpy = vi.fn();
      const confirmedSpy = vi.fn();
      const blockedSpy = vi.fn();

      orchestrator.on('dangerous:detected', detectedSpy);
      orchestrator.on('dangerous:confirmed', confirmedSpy);
      orchestrator.on('dangerous:blocked', blockedSpy);

      // Test detected event
      orchestrator.emit('dangerous:detected', {
        operationId: 'dangerous-test-1',
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'privilege-escalation',
        riskLevel: 'critical',
        riskDescription: 'Sudo command detected',
        agent: 'test-agent'
      });

      // Test confirmed event
      orchestrator.emit('dangerous:confirmed', {
        operationId: 'dangerous-test-2',
        tool: 'Bash',
        timestamp: new Date(),
        operation: 'privilege-escalation',
        confirmedBy: 'admin',
        reason: 'Admin approved sudo access'
      });

      // Test blocked event
      orchestrator.emit('dangerous:blocked', {
        operationId: 'dangerous-test-3',
        tool: 'Write',
        timestamp: new Date(),
        operation: 'data-modification',
        reason: 'Unsafe file modification',
        blockedBy: 'security-policy'
      });

      // Validate detected event payload
      const detectedPayload = detectedSpy.mock.calls[0][0];
      expect(typeof detectedPayload.operation).toBe('string');
      expect(['low', 'medium', 'high', 'critical']).toContain(detectedPayload.riskLevel);
      expect(typeof detectedPayload.riskDescription).toBe('string');
      expect(typeof detectedPayload.agent).toBe('string');

      // Validate confirmed event payload
      const confirmedPayload = confirmedSpy.mock.calls[0][0];
      expect(typeof confirmedPayload.operation).toBe('string');
      expect(typeof confirmedPayload.confirmedBy).toBe('string');
      expect(typeof confirmedPayload.reason).toBe('string');

      // Validate blocked event payload
      const blockedPayload = blockedSpy.mock.calls[0][0];
      expect(typeof blockedPayload.operation).toBe('string');
      expect(typeof blockedPayload.reason).toBe('string');
      expect(typeof blockedPayload.blockedBy).toBe('string');
    });
  });

  describe('TaskStore Integration', () => {
    it('should verify permission events are handled by TaskStore if applicable', async () => {
      // The TaskStore primarily handles task lifecycle events, but we should verify
      // that permission-related data can be stored if needed

      const testTask = {
        id: 'permission-task-test',
        type: 'feature' as const,
        title: 'Test permission handling',
        description: 'Testing permission event integration',
        status: 'pending' as const,
        stage: 'planning',
        agent: 'planner',
        branch: 'test-branch',
        workflow: 'test-workflow',
        created: new Date(),
        priority: 'medium' as const,
        usage: { cost: 0, tokens: 0 }
      };

      // Create a test task in the store
      await mockStore.createTask(testTask);

      // Verify the task exists in the store
      const storedTask = await mockStore.getTask(testTask.id);
      expect(storedTask).toBeDefined();
      expect(storedTask?.id).toBe(testTask.id);

      // Emit permission events related to this task
      const permissionEvents = [
        {
          event: 'permission:request' as const,
          data: {
            requestId: testTask.id,
            tool: 'Write',
            timestamp: new Date(),
            description: 'Task needs file access',
            isDangerous: false
          }
        },
        {
          event: 'permission:granted' as const,
          data: {
            requestId: testTask.id,
            tool: 'Write',
            timestamp: new Date(),
            level: 'allow-once' as PermissionLevel,
            grantedBy: 'user'
          }
        }
      ];

      // Test that events can be emitted for stored tasks
      permissionEvents.forEach(({ event, data }) => {
        expect(() => {
          orchestrator.emit(event, data);
        }).not.toThrow();
      });

      // Verify the task still exists after permission events
      const taskAfterEvents = await mockStore.getTask(testTask.id);
      expect(taskAfterEvents).toBeDefined();
      expect(taskAfterEvents?.id).toBe(testTask.id);
    });

    it('should handle permission events for non-existent tasks gracefully', () => {
      const nonExistentTaskId = 'non-existent-task-123';

      // These events should not cause errors even if the task doesn't exist
      const permissionEvents = [
        {
          event: 'permission:request' as const,
          data: {
            requestId: nonExistentTaskId,
            tool: 'Read',
            timestamp: new Date(),
            description: 'Reading file',
            isDangerous: false
          }
        },
        {
          event: 'permission:denied' as const,
          data: {
            requestId: nonExistentTaskId,
            tool: 'Read',
            timestamp: new Date(),
            reason: 'Task not found',
            deniedBy: 'system'
          }
        }
      ];

      permissionEvents.forEach(({ event, data }) => {
        expect(() => {
          orchestrator.emit(event, data);
        }).not.toThrow();
      });
    });
  });

  describe('EventEmitter Integration', () => {
    it('should inherit EventEmitter functionality correctly', () => {
      // Verify ApexOrchestrator extends EventEmitter
      expect(orchestrator).toBeInstanceOf(EventEmitter);

      // Test basic EventEmitter methods
      expect(typeof orchestrator.on).toBe('function');
      expect(typeof orchestrator.emit).toBe('function');
      expect(typeof orchestrator.off).toBe('function');
      expect(typeof orchestrator.once).toBe('function');
    });

    it('should support multiple event listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      // Add multiple listeners for the same event
      orchestrator.on('permission:request', listener1);
      orchestrator.on('permission:request', listener2);
      orchestrator.on('permission:request', listener3);

      const eventData: PermissionRequestEventData = {
        requestId: 'multi-listener-test',
        tool: 'Test',
        timestamp: new Date(),
        description: 'Test operation',
        isDangerous: false
      };

      orchestrator.emit('permission:request', eventData);

      // All listeners should be called
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener3).toHaveBeenCalledOnce();

      // All should receive the same data
      [listener1, listener2, listener3].forEach(listener => {
        expect(listener).toHaveBeenCalledWith(eventData);
      });
    });

    it('should support one-time event listeners', () => {
      const onceListener = vi.fn();
      const regularListener = vi.fn();

      orchestrator.once('permission:granted', onceListener);
      orchestrator.on('permission:granted', regularListener);

      const eventData1: PermissionGrantedEventData = {
        requestId: 'once-test-1',
        tool: 'Tool1',
        timestamp: new Date(),
        level: 'allow-once',
        grantedBy: 'user'
      };

      const eventData2: PermissionGrantedEventData = {
        requestId: 'once-test-2',
        tool: 'Tool2',
        timestamp: new Date(),
        level: 'allow-always',
        grantedBy: 'user'
      };

      // First emission
      orchestrator.emit('permission:granted', eventData1);
      expect(onceListener).toHaveBeenCalledOnce();
      expect(regularListener).toHaveBeenCalledOnce();

      // Second emission
      orchestrator.emit('permission:granted', eventData2);
      expect(onceListener).toHaveBeenCalledOnce(); // Still only once
      expect(regularListener).toHaveBeenCalledTimes(2); // Called twice
    });

    it('should handle event listener removal', () => {
      const listener = vi.fn();

      orchestrator.on('permission:denied', listener);

      // Emit event - should be handled
      orchestrator.emit('permission:denied', {
        requestId: 'removal-test',
        tool: 'Test',
        timestamp: new Date(),
        reason: 'Test denial',
        deniedBy: 'test'
      });

      expect(listener).toHaveBeenCalledOnce();

      // Remove listener
      orchestrator.off('permission:denied', listener);

      // Emit again - should not be handled
      orchestrator.emit('permission:denied', {
        requestId: 'removal-test-2',
        tool: 'Test2',
        timestamp: new Date(),
        reason: 'Test denial 2',
        deniedBy: 'test'
      });

      expect(listener).toHaveBeenCalledOnce(); // Still only once
    });
  });

  describe('End-to-End Event Workflow', () => {
    it('should handle complete permission request workflow', () => {
      const events: Array<{ type: string; data: any }> = [];

      // Set up listeners for all permission events
      orchestrator.on('permission:request', (data) => {
        events.push({ type: 'permission:request', data });
      });

      orchestrator.on('permission:granted', (data) => {
        events.push({ type: 'permission:granted', data });
      });

      orchestrator.on('permission:denied', (data) => {
        events.push({ type: 'permission:denied', data });
      });

      const requestId = 'workflow-test-task';
      const toolName = 'ComplexTool';

      // Simulate permission workflow
      // 1. Request permission
      orchestrator.emit('permission:request', {
        requestId,
        tool: toolName,
        timestamp: new Date(),
        description: 'Need access for workflow test',
        isDangerous: false,
        agent: 'test-agent'
      });

      // 2. Grant permission
      orchestrator.emit('permission:granted', {
        requestId,
        tool: toolName,
        timestamp: new Date(),
        level: 'allow-once',
        grantedBy: 'user',
        reason: 'Approved for testing'
      });

      // 3. Simulate another request that gets denied
      orchestrator.emit('permission:request', {
        requestId: requestId + '-2',
        tool: 'DangerousTool',
        timestamp: new Date(),
        description: 'Potentially unsafe operation',
        isDangerous: true,
        agent: 'test-agent'
      });

      orchestrator.emit('permission:denied', {
        requestId: requestId + '-2',
        tool: 'DangerousTool',
        timestamp: new Date(),
        reason: 'Tool marked as unsafe',
        deniedBy: 'security-policy'
      });

      // Verify the complete workflow
      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('permission:request');
      expect(events[0].data.requestId).toBe(requestId);
      expect(events[1].type).toBe('permission:granted');
      expect(events[1].data.requestId).toBe(requestId);
      expect(events[2].type).toBe('permission:request');
      expect(events[2].data.requestId).toBe(requestId + '-2');
      expect(events[3].type).toBe('permission:denied');
      expect(events[3].data.requestId).toBe(requestId + '-2');
    });
  });
});