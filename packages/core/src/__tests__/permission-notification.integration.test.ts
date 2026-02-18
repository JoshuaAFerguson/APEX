/**
 * Integration tests for permission notification schema and types (INT-01, INT-02)
 * Tests the PermissionNotification schema validation and type safety
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionNotificationSchema, PermissionNotification } from '../types';
import { EventCollector, MockPermissionTrigger } from './helpers';
import { EventEmitter } from 'eventemitter3';

describe('Permission Notification Integration Tests (Core)', () => {
  let emitter: EventEmitter;
  let eventCollector: EventCollector;
  let mockTrigger: MockPermissionTrigger;

  beforeEach(() => {
    emitter = new EventEmitter();
    eventCollector = new EventCollector(emitter);
    mockTrigger = new MockPermissionTrigger();

    // Connect mock trigger to emitter
    mockTrigger.on('permission:notification', (data) => {
      emitter.emit('permission:notification', data);
    });
  });

  describe('INT-01: PermissionNotification Schema Validation', () => {
    it('should validate valid permission notification data', () => {
      const validNotification: PermissionNotification = {
        id: 'test-notification-1',
        type: 'permission:requested',
        taskId: 'task-123',
        agent: 'developer',
        tool: 'Bash',
        scope: '/tmp/test.txt',
        title: 'Permission Request',
        message: 'Agent requires permission to execute bash command',
        severity: 'warning',
        requiresAction: true,
        actions: ['approve', 'deny'],
        metadata: { command: 'ls -la' },
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        acknowledged: false
      };

      const result = PermissionNotificationSchema.safeParse(validNotification);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe('test-notification-1');
        expect(result.data.type).toBe('permission:requested');
        expect(result.data.taskId).toBe('task-123');
        expect(result.data.requiresAction).toBe(true);
        expect(result.data.actions).toEqual(['approve', 'deny']);
        expect(result.data.acknowledged).toBe(false);
      }
    });

    it('should validate notification with minimal required fields', () => {
      const minimalNotification = {
        id: 'min-test-1',
        type: 'permission:granted',
        taskId: 'task-456',
        agent: 'tester',
        tool: 'Write',
        title: 'Permission Granted',
        message: 'Write permission has been granted',
        timestamp: new Date()
      };

      const result = PermissionNotificationSchema.safeParse(minimalNotification);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.severity).toBe('info'); // default value
        expect(result.data.requiresAction).toBe(false); // default value
        expect(result.data.actions).toEqual([]); // default value
        expect(result.data.acknowledged).toBe(false); // default value
      }
    });

    it('should reject notification with invalid type', () => {
      const invalidNotification = {
        id: 'invalid-1',
        type: 'invalid:type',
        taskId: 'task-789',
        agent: 'agent',
        tool: 'Tool',
        title: 'Title',
        message: 'Message',
        timestamp: new Date()
      };

      const result = PermissionNotificationSchema.safeParse(invalidNotification);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ['type'],
              code: 'invalid_enum_value'
            })
          ])
        );
      }
    });

    it('should reject notification with missing required fields', () => {
      const incompleteNotification = {
        id: 'incomplete-1',
        type: 'permission:denied',
        // missing taskId
        agent: 'agent',
        tool: 'Tool',
        title: 'Title'
        // missing message and timestamp
      };

      const result = PermissionNotificationSchema.safeParse(incompleteNotification);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        expect(result.error.issues.map(issue => issue.path.join('.'))).toEqual(
          expect.arrayContaining(['taskId', 'message', 'timestamp'])
        );
      }
    });

    it('should validate all notification types', () => {
      const notificationTypes = [
        'permission:requested',
        'permission:granted',
        'permission:denied',
        'dangerous:detected',
        'dangerous:confirmed',
        'dangerous:blocked'
      ] as const;

      notificationTypes.forEach((type, index) => {
        const notification = {
          id: `test-${index}`,
          type,
          taskId: 'task-123',
          agent: 'agent',
          tool: 'tool',
          title: 'Title',
          message: 'Message',
          timestamp: new Date()
        };

        const result = PermissionNotificationSchema.safeParse(notification);
        expect(result.success).toBe(true);
      });
    });

    it('should validate all severity levels', () => {
      const severityLevels = ['info', 'warning', 'error', 'critical'] as const;

      severityLevels.forEach((severity, index) => {
        const notification = {
          id: `severity-test-${index}`,
          type: 'permission:requested',
          taskId: 'task-123',
          agent: 'agent',
          tool: 'tool',
          title: 'Title',
          message: 'Message',
          severity,
          timestamp: new Date()
        };

        const result = PermissionNotificationSchema.safeParse(notification);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.severity).toBe(severity);
        }
      });
    });
  });

  describe('INT-02: Permission Notification Event Flow', () => {
    it('should emit and collect permission notification events', async () => {
      const notificationId = mockTrigger.triggerPermissionNotification({
        taskId: 'test-task-1',
        agent: 'developer',
        tool: 'Bash',
        type: 'permission:requested',
        title: 'Bash Permission Request',
        message: 'Developer agent requests permission to use Bash tool',
        scope: '/home/user',
        severity: 'warning',
        requiresAction: true,
        actions: ['approve', 'deny'],
        metadata: { command: 'rm -rf /' }
      });

      // Wait for event to be processed
      const event = await eventCollector.waitForEvent('permission:notification', 1000);

      expect(event).toBeDefined();
      expect(event.type).toBe('permission:notification');

      const notification = event.data as PermissionNotification;
      expect(notification.id).toBe(notificationId);
      expect(notification.taskId).toBe('test-task-1');
      expect(notification.agent).toBe('developer');
      expect(notification.tool).toBe('Bash');
      expect(notification.type).toBe('permission:requested');
      expect(notification.requiresAction).toBe(true);
      expect(notification.actions).toEqual(['approve', 'deny']);
    });

    it('should collect multiple notification events', async () => {
      // Trigger multiple notifications
      const notificationIds = [
        mockTrigger.triggerPermissionNotification({
          taskId: 'task-1',
          agent: 'agent-1',
          tool: 'Write',
          type: 'permission:granted',
          title: 'Write Permission Granted',
          message: 'Agent can now write files',
          severity: 'info'
        }),
        mockTrigger.triggerPermissionNotification({
          taskId: 'task-2',
          agent: 'agent-2',
          tool: 'Read',
          type: 'dangerous:detected',
          title: 'Dangerous Read Operation',
          message: 'Agent attempting to read sensitive file',
          severity: 'error',
          requiresAction: true,
          actions: ['allow', 'block']
        })
      ];

      // Wait a bit for events to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      const notifications = eventCollector.getPermissionNotifications();
      expect(notifications.length).toBe(2);

      // Verify both notifications were captured
      expect(notifications.map(n => n.id)).toEqual(
        expect.arrayContaining(notificationIds)
      );

      // Verify specific notification details
      const grantedNotification = notifications.find(n => n.type === 'permission:granted');
      expect(grantedNotification).toBeDefined();
      expect(grantedNotification?.tool).toBe('Write');
      expect(grantedNotification?.severity).toBe('info');

      const dangerousNotification = notifications.find(n => n.type === 'dangerous:detected');
      expect(dangerousNotification).toBeDefined();
      expect(dangerousNotification?.tool).toBe('Read');
      expect(dangerousNotification?.severity).toBe('error');
      expect(dangerousNotification?.requiresAction).toBe(true);
    });

    it('should handle notification metadata correctly', async () => {
      const complexMetadata = {
        filePath: '/important/config.json',
        fileSize: 1024,
        checksum: 'sha256:abc123',
        permissions: { read: true, write: true, execute: false },
        nested: {
          level1: {
            level2: 'deep value'
          }
        }
      };

      mockTrigger.triggerPermissionNotification({
        taskId: 'metadata-test',
        agent: 'metadata-agent',
        tool: 'Edit',
        type: 'permission:requested',
        title: 'Edit Permission with Metadata',
        message: 'Complex metadata test',
        metadata: complexMetadata
      });

      const event = await eventCollector.waitForEvent('permission:notification', 1000);
      const notification = event.data as PermissionNotification;

      expect(notification.metadata).toEqual(complexMetadata);
    });

    it('should handle notification expiration timestamps', async () => {
      const expiresAt = new Date(Date.now() + 30000); // 30 seconds from now

      mockTrigger.triggerPermissionNotification({
        taskId: 'expiration-test',
        agent: 'expiration-agent',
        tool: 'Bash',
        type: 'dangerous:detected',
        title: 'Expiring Dangerous Operation',
        message: 'This operation will auto-deny in 30 seconds',
        expiresAt
      });

      const event = await eventCollector.waitForEvent('permission:notification', 1000);
      const notification = event.data as PermissionNotification;

      expect(notification.expiresAt).toEqual(expiresAt);
      expect(notification.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should validate that EventCollector can filter notifications correctly', async () => {
      // Generate notifications of different types
      mockTrigger.triggerPermissionNotification({
        taskId: 'filter-test',
        agent: 'filter-agent',
        tool: 'Bash',
        type: 'permission:requested',
        title: 'Request',
        message: 'Request message'
      });

      mockTrigger.triggerPermissionNotification({
        taskId: 'filter-test',
        agent: 'filter-agent',
        tool: 'Write',
        type: 'permission:granted',
        title: 'Granted',
        message: 'Granted message'
      });

      mockTrigger.triggerPermissionNotification({
        taskId: 'filter-test',
        agent: 'filter-agent',
        tool: 'Read',
        type: 'dangerous:detected',
        title: 'Dangerous',
        message: 'Dangerous message'
      });

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test filtering by type using EventCollector matcher
      const hasRequested = eventCollector.hasPermissionNotification({
        type: 'permission:requested',
        tool: 'Bash'
      });
      expect(hasRequested).toBe(true);

      const hasGranted = eventCollector.hasPermissionNotification({
        type: 'permission:granted',
        tool: 'Write'
      });
      expect(hasGranted).toBe(true);

      const hasDangerous = eventCollector.hasPermissionNotification({
        type: 'dangerous:detected',
        tool: 'Read'
      });
      expect(hasDangerous).toBe(true);

      // Test filtering for non-existent notification
      const hasNonExistent = eventCollector.hasPermissionNotification({
        type: 'permission:denied',
        tool: 'NonExistent'
      });
      expect(hasNonExistent).toBe(false);
    });
  });

  describe('INT-03: Type Safety and Integration', () => {
    it('should maintain type safety across notification pipeline', () => {
      // This test verifies TypeScript type safety at compile time
      const createTypedNotification = (
        type: PermissionNotification['type']
      ): PermissionNotification => {
        return {
          id: `typed-${type}`,
          type,
          taskId: 'typed-task',
          agent: 'typed-agent',
          tool: 'TypedTool',
          title: `Typed ${type}`,
          message: `Message for ${type}`,
          timestamp: new Date()
        };
      };

      // These should all compile and be valid
      const requestNotification = createTypedNotification('permission:requested');
      const grantedNotification = createTypedNotification('permission:granted');
      const deniedNotification = createTypedNotification('permission:denied');
      const dangerousNotification = createTypedNotification('dangerous:detected');

      expect(requestNotification.type).toBe('permission:requested');
      expect(grantedNotification.type).toBe('permission:granted');
      expect(deniedNotification.type).toBe('permission:denied');
      expect(dangerousNotification.type).toBe('dangerous:detected');
    });

    it('should validate schema consistency with TypeScript types', () => {
      // Create a notification using the TypeScript type
      const typedNotification: PermissionNotification = {
        id: 'consistency-test',
        type: 'permission:requested',
        taskId: 'consistency-task',
        agent: 'consistency-agent',
        tool: 'ConsistencyTool',
        title: 'Consistency Test',
        message: 'Testing schema/type consistency',
        timestamp: new Date()
      };

      // Schema should validate the TypeScript type
      const result = PermissionNotificationSchema.safeParse(typedNotification);
      expect(result.success).toBe(true);

      if (result.success) {
        // Schema result should match TypeScript type
        expect(result.data.id).toBe(typedNotification.id);
        expect(result.data.type).toBe(typedNotification.type);
        expect(result.data.taskId).toBe(typedNotification.taskId);
        expect(result.data.agent).toBe(typedNotification.agent);
        expect(result.data.tool).toBe(typedNotification.tool);
      }
    });
  });

  describe('Cleanup', () => {
    it('should properly cleanup resources', () => {
      expect(eventCollector.getEventCount()).toBeGreaterThanOrEqual(0);

      eventCollector.clear();
      expect(eventCollector.getEventCount()).toBe(0);

      mockTrigger.reset();
      expect(mockTrigger.listenerCount()).toBe(0);
    });
  });
});