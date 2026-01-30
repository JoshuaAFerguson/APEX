import { describe, it, expect } from 'vitest';
import {
  PermissionChangeTypeSchema,
  PermissionDetailsSchema,
  PermissionChangeEventSchema,
  type PermissionChangeType,
  type PermissionDetails,
  type PermissionChangeEvent
} from '../types';

describe('Permission Change Event Types', () => {
  describe('PermissionChangeTypeSchema', () => {
    it('should validate valid permission change types', () => {
      const validTypes = ['granted', 'revoked', 'modified'] as const;

      validTypes.forEach(type => {
        expect(() => PermissionChangeTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('should reject invalid permission change types', () => {
      const invalidTypes = ['deleted', 'created', 'updated', '', null, undefined, 123];

      invalidTypes.forEach(type => {
        expect(() => PermissionChangeTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('PermissionDetailsSchema', () => {
    it('should validate complete permission details', () => {
      const validDetails = {
        category: 'filesystem',
        permission: 'read',
        previousLevel: 'deny',
        newLevel: 'allow-always',
        reason: 'User granted read access to project files',
        agentName: 'developer',
        taskId: 'task-123'
      };

      expect(() => PermissionDetailsSchema.parse(validDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(validDetails);
      expect(parsed.category).toBe('filesystem');
      expect(parsed.permission).toBe('read');
      expect(parsed.previousLevel).toBe('deny');
      expect(parsed.newLevel).toBe('allow-always');
      expect(parsed.reason).toBe('User granted read access to project files');
      expect(parsed.agentName).toBe('developer');
      expect(parsed.taskId).toBe('task-123');
    });

    it('should validate minimal permission details', () => {
      const minimalDetails = {
        category: 'browser',
        permission: 'execute',
        previousLevel: null,
        newLevel: 'allow-once'
      };

      expect(() => PermissionDetailsSchema.parse(minimalDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(minimalDetails);
      expect(parsed.category).toBe('browser');
      expect(parsed.permission).toBe('execute');
      expect(parsed.previousLevel).toBeNull();
      expect(parsed.newLevel).toBe('allow-once');
      expect(parsed.reason).toBeUndefined();
      expect(parsed.agentName).toBeUndefined();
      expect(parsed.taskId).toBeUndefined();
    });

    it('should handle revoked permissions (null newLevel)', () => {
      const revokedDetails = {
        category: 'web',
        permission: 'network',
        previousLevel: 'allow-always',
        newLevel: null,
        reason: 'Security policy violation'
      };

      expect(() => PermissionDetailsSchema.parse(revokedDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(revokedDetails);
      expect(parsed.newLevel).toBeNull();
      expect(parsed.previousLevel).toBe('allow-always');
    });

    it('should reject invalid category values', () => {
      const invalidDetails = {
        category: 'invalid_category',
        permission: 'read',
        previousLevel: null,
        newLevel: 'allow-always'
      };

      expect(() => PermissionDetailsSchema.parse(invalidDetails)).toThrow();
    });

    it('should reject invalid permission values', () => {
      const invalidDetails = {
        category: 'filesystem',
        permission: 'invalid_permission',
        previousLevel: null,
        newLevel: 'allow-always'
      };

      expect(() => PermissionDetailsSchema.parse(invalidDetails)).toThrow();
    });

    it('should reject invalid permission level values', () => {
      const invalidDetails = {
        category: 'filesystem',
        permission: 'read',
        previousLevel: 'invalid_level',
        newLevel: 'allow-always'
      };

      expect(() => PermissionDetailsSchema.parse(invalidDetails)).toThrow();
    });

    it('should trim and validate string fields', () => {
      const detailsWithWhitespace = {
        category: 'filesystem',
        permission: 'read',
        previousLevel: null,
        newLevel: 'allow-always',
        reason: '  User requested access  ',
        agentName: '  developer  ',
        taskId: '  task-123  '
      };

      const parsed = PermissionDetailsSchema.parse(detailsWithWhitespace);
      expect(parsed.reason).toBe('User requested access');
      expect(parsed.agentName).toBe('developer');
      expect(parsed.taskId).toBe('task-123');
    });

    it('should reject empty string values after trimming', () => {
      const invalidDetails = {
        category: 'filesystem',
        permission: 'read',
        previousLevel: null,
        newLevel: 'allow-always',
        agentName: '   '  // Only whitespace, should fail after trimming
      };

      expect(() => PermissionDetailsSchema.parse(invalidDetails)).toThrow();
    });
  });

  describe('PermissionChangeEventSchema', () => {
    it('should validate complete permission change event', () => {
      const validEvent = {
        changeType: 'granted' as const,
        permission: {
          category: 'filesystem',
          permission: 'write',
          previousLevel: null,
          newLevel: 'allow-once',
          reason: 'Agent requested write access for code generation',
          agentName: 'developer',
          taskId: 'task-456'
        },
        timestamp: new Date('2024-01-15T10:30:00Z'),
        message: 'Write permission granted to developer agent for file system access. User approval required for each write operation.',
        metadata: {
          source: 'permission-manager',
          requestId: 'req-789'
        }
      };

      expect(() => PermissionChangeEventSchema.parse(validEvent)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(validEvent);
      expect(parsed.changeType).toBe('granted');
      expect(parsed.permission.category).toBe('filesystem');
      expect(parsed.timestamp).toEqual(new Date('2024-01-15T10:30:00Z'));
      expect(parsed.message).toBe('Write permission granted to developer agent for file system access. User approval required for each write operation.');
      expect(parsed.metadata?.source).toBe('permission-manager');
    });

    it('should validate minimal permission change event', () => {
      const minimalEvent = {
        changeType: 'revoked' as const,
        permission: {
          category: 'network',
          permission: 'network',
          previousLevel: 'allow-always',
          newLevel: null
        },
        timestamp: new Date(),
        message: 'Network outbound permission revoked due to policy violation'
      };

      expect(() => PermissionChangeEventSchema.parse(minimalEvent)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(minimalEvent);
      expect(parsed.changeType).toBe('revoked');
      expect(parsed.permission.newLevel).toBeNull();
      expect(parsed.metadata).toBeUndefined();
    });

    it('should reject events with missing required fields', () => {
      const invalidEvents = [
        // Missing changeType
        {
          permission: {
            category: 'filesystem',
            permission: 'read',
            previousLevel: null,
            newLevel: 'allow-always'
          },
          timestamp: new Date(),
          message: 'Test message'
        },
        // Missing permission
        {
          changeType: 'granted',
          timestamp: new Date(),
          message: 'Test message'
        },
        // Missing timestamp
        {
          changeType: 'granted',
          permission: {
            category: 'filesystem',
            permission: 'read',
            previousLevel: null,
            newLevel: 'allow-always'
          },
          message: 'Test message'
        },
        // Missing message
        {
          changeType: 'granted',
          permission: {
            category: 'filesystem',
            permission: 'read',
            previousLevel: null,
            newLevel: 'allow-always'
          },
          timestamp: new Date()
        }
      ];

      invalidEvents.forEach(invalidEvent => {
        expect(() => PermissionChangeEventSchema.parse(invalidEvent)).toThrow();
      });
    });

    it('should reject empty or whitespace-only message', () => {
      const eventWithEmptyMessage = {
        changeType: 'granted' as const,
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always'
        },
        timestamp: new Date(),
        message: '   '  // Only whitespace
      };

      expect(() => PermissionChangeEventSchema.parse(eventWithEmptyMessage)).toThrow();
    });

    it('should trim message field', () => {
      const eventWithWhitespace = {
        changeType: 'modified' as const,
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: 'deny',
          newLevel: 'allow-once'
        },
        timestamp: new Date(),
        message: '  Permission level changed from denied to ask_user  '
      };

      const parsed = PermissionChangeEventSchema.parse(eventWithWhitespace);
      expect(parsed.message).toBe('Permission level changed from denied to ask_user');
    });

    it('should handle complex metadata objects', () => {
      const eventWithMetadata = {
        changeType: 'granted' as const,
        permission: {
          category: 'browser',
          permission: 'navigate',
          previousLevel: null,
          newLevel: 'allow-always'
        },
        timestamp: new Date(),
        message: 'Browser navigation permission granted',
        metadata: {
          userAgent: 'Mozilla/5.0',
          browserVersion: '121.0',
          requestSource: {
            component: 'task-executor',
            version: '1.0.0'
          },
          permissions: ['navigate', 'cookies'],
          config: {
            autoApprove: false,
            timeout: 30000
          }
        }
      };

      expect(() => PermissionChangeEventSchema.parse(eventWithMetadata)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(eventWithMetadata);
      expect(parsed.metadata?.userAgent).toBe('Mozilla/5.0');
      expect(parsed.metadata?.requestSource.component).toBe('task-executor');
      expect(parsed.metadata?.permissions).toEqual(['navigate', 'cookies']);
    });
  });

  describe('Type inference and usage', () => {
    it('should properly infer TypeScript types', () => {
      // This test ensures that the inferred types work correctly
      const changeType: PermissionChangeType = 'granted';

      const permissionDetails: PermissionDetails = {
        category: 'filesystem',
        permission: 'read',
        previousLevel: null,
        newLevel: 'allow-always',
        reason: 'Test reason'
      };

      const event: PermissionChangeEvent = {
        changeType,
        permission: permissionDetails,
        timestamp: new Date(),
        message: 'Test message'
      };

      expect(changeType).toBe('granted');
      expect(permissionDetails.category).toBe('filesystem');
      expect(event.changeType).toBe('granted');
    });
  });
});