/**
 * @fileoverview Comprehensive test suite for PermissionChangeEvent types
 *
 * This file tests the PermissionChangeEvent schemas that were implemented
 * to validate event structure including changeType, permission details,
 * timestamp, and actionable message.
 */

import { describe, it, expect } from 'vitest';
import {
  PermissionChangeTypeSchema,
  PermissionDetailsSchema,
  PermissionChangeEventSchema,
  ToolCategorySchema,
  ToolPermissionSchema,
  PermissionLevelSchema,
  type PermissionChangeEvent,
  type PermissionDetails,
  type PermissionChangeType,
  type ToolCategory,
  type ToolPermission,
  type PermissionLevel,
} from '../types';

describe('PermissionChangeEvent - Final Validation Tests', () => {
  describe('PermissionChangeTypeSchema', () => {
    it('should validate all valid permission change types', () => {
      const validTypes: PermissionChangeType[] = ['granted', 'revoked', 'modified'];

      validTypes.forEach(type => {
        expect(() => PermissionChangeTypeSchema.parse(type)).not.toThrow();
        const parsed = PermissionChangeTypeSchema.parse(type);
        expect(parsed).toBe(type);
      });
    });

    it('should reject invalid permission change types', () => {
      const invalidTypes = [
        'expired',     // This was in some test files but not in actual schema
        'created',
        'updated',
        'deleted',
        'suspended',
        '',
        null,
        undefined,
        123,
        {}
      ];

      invalidTypes.forEach(type => {
        expect(() => PermissionChangeTypeSchema.parse(type)).toThrow();
      });
    });

    it('should provide clear error messages for invalid types', () => {
      try {
        PermissionChangeTypeSchema.parse('invalid');
      } catch (error) {
        expect(error.message).toMatch(/Invalid enum value/i);
      }
    });
  });

  describe('PermissionDetailsSchema', () => {
    it('should validate complete permission details with all required fields', () => {
      const validDetails = {
        category: 'filesystem' as ToolCategory,
        permission: 'read' as ToolPermission,
        previousLevel: 'deny' as PermissionLevel,
        newLevel: 'allow-always' as PermissionLevel,
        reason: 'User granted read access for project analysis',
        agentName: 'code-analyzer',
        taskId: 'task-123'
      };

      expect(() => PermissionDetailsSchema.parse(validDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(validDetails);
      expect(parsed.category).toBe('filesystem');
      expect(parsed.permission).toBe('read');
      expect(parsed.previousLevel).toBe('deny');
      expect(parsed.newLevel).toBe('allow-always');
      expect(parsed.reason).toBe('User granted read access for project analysis');
      expect(parsed.agentName).toBe('code-analyzer');
      expect(parsed.taskId).toBe('task-123');
    });

    it('should validate minimal permission details (only required fields)', () => {
      const minimalDetails = {
        category: 'web' as ToolCategory,
        permission: 'network' as ToolPermission,
        previousLevel: null,
        newLevel: 'allow-once' as PermissionLevel
      };

      expect(() => PermissionDetailsSchema.parse(minimalDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(minimalDetails);
      expect(parsed.category).toBe('web');
      expect(parsed.permission).toBe('network');
      expect(parsed.previousLevel).toBeNull();
      expect(parsed.newLevel).toBe('allow-once');
      expect(parsed.reason).toBeUndefined();
      expect(parsed.agentName).toBeUndefined();
      expect(parsed.taskId).toBeUndefined();
    });

    it('should handle revoked permissions with null newLevel', () => {
      const revokedDetails = {
        category: 'shell' as ToolCategory,
        permission: 'execute' as ToolPermission,
        previousLevel: 'allow-always' as PermissionLevel,
        newLevel: null,
        reason: 'Security policy violation detected'
      };

      expect(() => PermissionDetailsSchema.parse(revokedDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(revokedDetails);
      expect(parsed.previousLevel).toBe('allow-always');
      expect(parsed.newLevel).toBeNull();
      expect(parsed.reason).toBe('Security policy violation detected');
    });

    it('should handle newly granted permissions with null previousLevel', () => {
      const newGrantDetails = {
        category: 'browser' as ToolCategory,
        permission: 'execute' as ToolPermission,
        previousLevel: null,
        newLevel: 'allow-once' as PermissionLevel,
        reason: 'First-time browser access request'
      };

      expect(() => PermissionDetailsSchema.parse(newGrantDetails)).not.toThrow();

      const parsed = PermissionDetailsSchema.parse(newGrantDetails);
      expect(parsed.previousLevel).toBeNull();
      expect(parsed.newLevel).toBe('allow-once');
    });

    it('should validate all ToolCategory enum values', () => {
      const categories: ToolCategory[] = [
        'filesystem',
        'search',
        'shell',
        'web',
        'browser',
        'system',
        'custom'
      ];

      categories.forEach(category => {
        const details = {
          category,
          permission: 'read' as ToolPermission,
          previousLevel: null,
          newLevel: 'allow-once' as PermissionLevel
        };

        expect(() => PermissionDetailsSchema.parse(details)).not.toThrow();
        const parsed = PermissionDetailsSchema.parse(details);
        expect(parsed.category).toBe(category);
      });
    });

    it('should validate all ToolPermission enum values', () => {
      const permissions: ToolPermission[] = [
        'read',
        'write',
        'execute',
        'network',
        'admin'
      ];

      permissions.forEach(permission => {
        const details = {
          category: 'filesystem' as ToolCategory,
          permission,
          previousLevel: null,
          newLevel: 'allow-once' as PermissionLevel
        };

        expect(() => PermissionDetailsSchema.parse(details)).not.toThrow();
        const parsed = PermissionDetailsSchema.parse(details);
        expect(parsed.permission).toBe(permission);
      });
    });

    it('should validate all PermissionLevel enum values', () => {
      const levels: PermissionLevel[] = [
        'allow-always',
        'allow-once',
        'deny'
      ];

      levels.forEach(level => {
        const details = {
          category: 'filesystem' as ToolCategory,
          permission: 'read' as ToolPermission,
          previousLevel: level,
          newLevel: 'allow-once' as PermissionLevel
        };

        expect(() => PermissionDetailsSchema.parse(details)).not.toThrow();
        const parsed = PermissionDetailsSchema.parse(details);
        expect(parsed.previousLevel).toBe(level);
      });
    });

    it('should trim whitespace from string fields', () => {
      const detailsWithWhitespace = {
        category: 'filesystem' as ToolCategory,
        permission: 'read' as ToolPermission,
        previousLevel: null,
        newLevel: 'allow-always' as PermissionLevel,
        reason: '   User approval granted   ',
        agentName: '   test-agent   ',
        taskId: '   task-456   '
      };

      const parsed = PermissionDetailsSchema.parse(detailsWithWhitespace);
      expect(parsed.reason).toBe('User approval granted');
      expect(parsed.agentName).toBe('test-agent');
      expect(parsed.taskId).toBe('task-456');
    });

    it('should reject empty strings after trimming', () => {
      const invalidDetails = {
        category: 'filesystem' as ToolCategory,
        permission: 'read' as ToolPermission,
        previousLevel: null,
        newLevel: 'allow-always' as PermissionLevel,
        agentName: '   '  // Only whitespace
      };

      expect(() => PermissionDetailsSchema.parse(invalidDetails)).toThrow();
    });

    it('should reject invalid enum values', () => {
      // Invalid category
      const invalidCategory = {
        category: 'invalid_category',
        permission: 'read' as ToolPermission,
        previousLevel: null,
        newLevel: 'allow-always' as PermissionLevel
      };
      expect(() => PermissionDetailsSchema.parse(invalidCategory)).toThrow();

      // Invalid permission
      const invalidPermission = {
        category: 'filesystem' as ToolCategory,
        permission: 'invalid_permission',
        previousLevel: null,
        newLevel: 'allow-always' as PermissionLevel
      };
      expect(() => PermissionDetailsSchema.parse(invalidPermission)).toThrow();

      // Invalid permission level
      const invalidLevel = {
        category: 'filesystem' as ToolCategory,
        permission: 'read' as ToolPermission,
        previousLevel: 'invalid_level',
        newLevel: 'allow-always' as PermissionLevel
      };
      expect(() => PermissionDetailsSchema.parse(invalidLevel)).toThrow();
    });
  });

  describe('PermissionChangeEventSchema', () => {
    it('should validate complete permission change event', () => {
      const validEvent = {
        changeType: 'granted' as PermissionChangeType,
        permission: {
          category: 'filesystem' as ToolCategory,
          permission: 'write' as ToolPermission,
          previousLevel: null,
          newLevel: 'allow-once' as PermissionLevel,
          reason: 'Code generation requires file write access',
          agentName: 'developer-agent',
          taskId: 'dev-task-789'
        },
        timestamp: new Date('2024-01-15T10:30:00Z'),
        message: 'Write permission granted to developer agent for code generation',
        metadata: {
          requestId: 'req-456',
          source: 'permission-manager',
          userApproval: true
        }
      };

      expect(() => PermissionChangeEventSchema.parse(validEvent)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(validEvent);
      expect(parsed.changeType).toBe('granted');
      expect(parsed.permission.category).toBe('filesystem');
      expect(parsed.permission.permission).toBe('write');
      expect(parsed.permission.newLevel).toBe('allow-once');
      expect(parsed.timestamp).toEqual(new Date('2024-01-15T10:30:00Z'));
      expect(parsed.message).toBe('Write permission granted to developer agent for code generation');
      expect(parsed.metadata?.requestId).toBe('req-456');
      expect(parsed.metadata?.userApproval).toBe(true);
    });

    it('should validate minimal permission change event (no metadata)', () => {
      const minimalEvent = {
        changeType: 'revoked' as PermissionChangeType,
        permission: {
          category: 'web' as ToolCategory,
          permission: 'network' as ToolPermission,
          previousLevel: 'allow-always' as PermissionLevel,
          newLevel: null
        },
        timestamp: new Date(),
        message: 'Network permission revoked due to security policy'
      };

      expect(() => PermissionChangeEventSchema.parse(minimalEvent)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(minimalEvent);
      expect(parsed.changeType).toBe('revoked');
      expect(parsed.permission.newLevel).toBeNull();
      expect(parsed.metadata).toBeUndefined();
    });

    it('should validate all changeType values', () => {
      const changeTypes: PermissionChangeType[] = ['granted', 'revoked', 'modified'];

      changeTypes.forEach(changeType => {
        const event = {
          changeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'read' as ToolPermission,
            previousLevel: null,
            newLevel: 'allow-once' as PermissionLevel
          },
          timestamp: new Date(),
          message: `Test ${changeType} event`
        };

        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
        const parsed = PermissionChangeEventSchema.parse(event);
        expect(parsed.changeType).toBe(changeType);
      });
    });

    it('should reject events with missing required fields', () => {
      const requiredFieldTests = [
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

      requiredFieldTests.forEach((invalidEvent, index) => {
        expect(() => PermissionChangeEventSchema.parse(invalidEvent))
          .toThrow(`Test case ${index} should fail validation`);
      });
    });

    it('should reject empty or whitespace-only message', () => {
      const invalidMessages = ['', '   ', '\t\n  '];

      invalidMessages.forEach(message => {
        const event = {
          changeType: 'granted' as PermissionChangeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'read' as ToolPermission,
            previousLevel: null,
            newLevel: 'allow-always' as PermissionLevel
          },
          timestamp: new Date(),
          message
        };

        expect(() => PermissionChangeEventSchema.parse(event)).toThrow();
      });
    });

    it('should trim message field', () => {
      const eventWithWhitespace = {
        changeType: 'modified' as PermissionChangeType,
        permission: {
          category: 'browser' as ToolCategory,
          permission: 'execute' as ToolPermission,
          previousLevel: 'deny' as PermissionLevel,
          newLevel: 'allow-once' as PermissionLevel
        },
        timestamp: new Date(),
        message: '   Permission level changed from deny to allow-once   '
      };

      const parsed = PermissionChangeEventSchema.parse(eventWithWhitespace);
      expect(parsed.message).toBe('Permission level changed from deny to allow-once');
    });

    it('should handle complex metadata structures', () => {
      const eventWithComplexMetadata = {
        changeType: 'granted' as PermissionChangeType,
        permission: {
          category: 'custom' as ToolCategory,
          permission: 'admin' as ToolPermission,
          previousLevel: null,
          newLevel: 'allow-always' as PermissionLevel
        },
        timestamp: new Date(),
        message: 'Admin permission granted',
        metadata: {
          // Simple types
          requestId: 'req-123',
          approved: true,
          priority: 1,

          // Nested objects
          user: {
            id: 'user-456',
            role: 'admin',
            department: 'engineering'
          },

          // Arrays
          approvers: ['alice@company.com', 'bob@company.com'],
          tags: ['security', 'admin', 'elevated'],

          // Complex nesting
          workflow: {
            id: 'wf-789',
            steps: [
              { name: 'request', completed: true },
              { name: 'review', completed: true },
              { name: 'approve', completed: true }
            ],
            metadata: {
              duration: 120000,
              automation: false
            }
          }
        }
      };

      expect(() => PermissionChangeEventSchema.parse(eventWithComplexMetadata)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(eventWithComplexMetadata);
      expect(parsed.metadata?.requestId).toBe('req-123');
      expect(parsed.metadata?.approved).toBe(true);
      expect(parsed.metadata?.user?.id).toBe('user-456');
      expect(parsed.metadata?.approvers).toHaveLength(2);
      expect(parsed.metadata?.workflow?.steps).toHaveLength(3);
    });

    it('should validate timestamp is a Date object', () => {
      const validTimestamps = [
        new Date(),
        new Date('2024-01-01T00:00:00Z'),
        new Date(Date.now())
      ];

      validTimestamps.forEach(timestamp => {
        const event = {
          changeType: 'granted' as PermissionChangeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'read' as ToolPermission,
            previousLevel: null,
            newLevel: 'allow-once' as PermissionLevel
          },
          timestamp,
          message: 'Test message'
        };

        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
      });

      // Invalid timestamps
      const invalidTimestamps = [
        '2024-01-01T00:00:00Z',  // String instead of Date
        1642766400000,           // Number timestamp
        null,
        undefined
      ];

      invalidTimestamps.forEach(timestamp => {
        const event = {
          changeType: 'granted' as PermissionChangeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'read' as ToolPermission,
            previousLevel: null,
            newLevel: 'allow-once' as PermissionLevel
          },
          timestamp,
          message: 'Test message'
        };

        expect(() => PermissionChangeEventSchema.parse(event)).toThrow();
      });
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle filesystem permission workflow', () => {
      const events = [
        // Initial read permission grant
        {
          changeType: 'granted' as PermissionChangeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'read' as ToolPermission,
            previousLevel: null,
            newLevel: 'allow-once' as PermissionLevel,
            reason: 'Code analysis requires reading source files',
            agentName: 'code-analyzer',
            taskId: 'analysis-001'
          },
          timestamp: new Date('2024-01-15T09:00:00Z'),
          message: 'Read permission granted for code analysis'
        },

        // Permission escalation to write
        {
          changeType: 'modified' as PermissionChangeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'write' as ToolPermission,
            previousLevel: 'deny' as PermissionLevel,
            newLevel: 'allow-once' as PermissionLevel,
            reason: 'Code refactoring requires write access',
            agentName: 'code-refactor',
            taskId: 'refactor-002'
          },
          timestamp: new Date('2024-01-15T09:30:00Z'),
          message: 'Write permission granted for code refactoring'
        },

        // Permission revocation after completion
        {
          changeType: 'revoked' as PermissionChangeType,
          permission: {
            category: 'filesystem' as ToolCategory,
            permission: 'write' as ToolPermission,
            previousLevel: 'allow-once' as PermissionLevel,
            newLevel: null,
            reason: 'Task completed, write access no longer needed',
            agentName: 'code-refactor',
            taskId: 'refactor-002'
          },
          timestamp: new Date('2024-01-15T10:00:00Z'),
          message: 'Write permission revoked after task completion'
        }
      ];

      events.forEach((event, index) => {
        expect(() => PermissionChangeEventSchema.parse(event))
          .not.toThrow(`Event ${index} should be valid`);

        const parsed = PermissionChangeEventSchema.parse(event);
        expect(parsed.permission.category).toBe('filesystem');
      });

      // Verify logical flow
      expect(events[0].permission.newLevel).toBe('allow-once');
      expect(events[1].permission.newLevel).toBe('allow-once');
      expect(events[2].permission.newLevel).toBeNull();
    });

    it('should handle network security incident', () => {
      const securityEvent = {
        changeType: 'revoked' as PermissionChangeType,
        permission: {
          category: 'web' as ToolCategory,
          permission: 'network' as ToolPermission,
          previousLevel: 'allow-always' as PermissionLevel,
          newLevel: null,
          reason: 'Suspicious activity detected: attempting to connect to blacklisted domain',
          agentName: 'web-crawler',
          taskId: 'data-collection-999'
        },
        timestamp: new Date(),
        message: 'Network permission immediately revoked due to security violation',
        metadata: {
          securityAlert: {
            id: 'alert-2024-001',
            severity: 'high',
            blockedDomain: 'malicious.example.com',
            detectionTime: new Date(),
            automaticAction: true
          },
          incident: {
            id: 'inc-2024-001',
            investigationRequired: true,
            quarantineLevel: 'full'
          }
        }
      };

      expect(() => PermissionChangeEventSchema.parse(securityEvent)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(securityEvent);
      expect(parsed.changeType).toBe('revoked');
      expect(parsed.permission.newLevel).toBeNull();
      expect(parsed.metadata?.securityAlert?.severity).toBe('high');
    });

    it('should handle browser automation permission grant', () => {
      const browserEvent = {
        changeType: 'granted' as PermissionChangeType,
        permission: {
          category: 'browser' as ToolCategory,
          permission: 'execute' as ToolPermission,
          previousLevel: null,
          newLevel: 'allow-always' as PermissionLevel,
          reason: 'E2E testing requires browser automation capabilities',
          agentName: 'qa-automation',
          taskId: 'e2e-test-suite'
        },
        timestamp: new Date(),
        message: 'Browser execute permission granted for automated testing',
        metadata: {
          testSuite: 'regression-tests',
          environment: 'staging',
          expectedDuration: 30 * 60 * 1000, // 30 minutes
          browserConfig: {
            headless: true,
            viewport: { width: 1280, height: 720 },
            timeout: 30000
          }
        }
      };

      expect(() => PermissionChangeEventSchema.parse(browserEvent)).not.toThrow();

      const parsed = PermissionChangeEventSchema.parse(browserEvent);
      expect(parsed.permission.category).toBe('browser');
      expect(parsed.permission.permission).toBe('execute');
      expect(parsed.metadata?.testSuite).toBe('regression-tests');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should provide informative error messages', () => {
      const invalidEvent = {
        changeType: 'invalid-type',
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-once'
        },
        timestamp: new Date(),
        message: 'Test'
      };

      try {
        PermissionChangeEventSchema.parse(invalidEvent);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toMatch(/Invalid enum value/i);
      }
    });

    it('should handle null and undefined values correctly', () => {
      // Test null previousLevel (valid for new permissions)
      const newPermissionEvent = {
        changeType: 'granted' as PermissionChangeType,
        permission: {
          category: 'filesystem' as ToolCategory,
          permission: 'read' as ToolPermission,
          previousLevel: null,
          newLevel: 'allow-once' as PermissionLevel
        },
        timestamp: new Date(),
        message: 'New permission granted'
      };

      expect(() => PermissionChangeEventSchema.parse(newPermissionEvent)).not.toThrow();

      // Test null newLevel (valid for revoked permissions)
      const revokedEvent = {
        changeType: 'revoked' as PermissionChangeType,
        permission: {
          category: 'web' as ToolCategory,
          permission: 'network' as ToolPermission,
          previousLevel: 'allow-always' as PermissionLevel,
          newLevel: null
        },
        timestamp: new Date(),
        message: 'Permission revoked'
      };

      expect(() => PermissionChangeEventSchema.parse(revokedEvent)).not.toThrow();
    });

    it('should validate large metadata objects', () => {
      const largeMetadata = Array.from({ length: 100 }, (_, i) => ({
        [`key${i}`]: {
          value: `value${i}`,
          timestamp: new Date(),
          nested: {
            data: Array.from({ length: 10 }, (_, j) => `item${j}`)
          }
        }
      })).reduce((acc, item) => ({ ...acc, ...item }), {});

      const eventWithLargeMetadata = {
        changeType: 'granted' as PermissionChangeType,
        permission: {
          category: 'custom' as ToolCategory,
          permission: 'admin' as ToolPermission,
          previousLevel: null,
          newLevel: 'allow-once' as PermissionLevel
        },
        timestamp: new Date(),
        message: 'Large metadata test',
        metadata: largeMetadata
      };

      expect(() => PermissionChangeEventSchema.parse(eventWithLargeMetadata)).not.toThrow();
    });
  });

  describe('Type Inference and TypeScript Integration', () => {
    it('should properly infer TypeScript types', () => {
      // Test type inference works correctly
      const event: PermissionChangeEvent = {
        changeType: 'granted',
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-once'
        },
        timestamp: new Date(),
        message: 'Type inference test'
      };

      // These should compile without errors and have correct types
      const changeType: PermissionChangeType = event.changeType;
      const permission: PermissionDetails = event.permission;
      const timestamp: Date = event.timestamp;
      const message: string = event.message;

      expect(changeType).toBe('granted');
      expect(permission.category).toBe('filesystem');
      expect(timestamp).toBeInstanceOf(Date);
      expect(typeof message).toBe('string');
    });

    it('should support optional metadata typing', () => {
      const event: PermissionChangeEvent = {
        changeType: 'granted',
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-once'
        },
        timestamp: new Date(),
        message: 'Optional metadata test',
        metadata: {
          source: 'test',
          custom: { nested: true }
        }
      };

      // Optional metadata should be correctly typed
      expect(event.metadata?.source).toBe('test');
      expect(event.metadata?.custom?.nested).toBe(true);
    });
  });
});