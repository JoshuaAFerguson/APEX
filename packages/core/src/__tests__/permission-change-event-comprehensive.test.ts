/**
 * @fileoverview Comprehensive test suite for PermissionChangeEvent types
 *
 * This file provides additional test coverage beyond the basic permission-change-event.test.ts,
 * focusing on edge cases, boundary conditions, performance, and integration scenarios.
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
} from '../types';

describe('PermissionChangeEvent - Comprehensive Coverage', () => {
  describe('Schema Validation - Boundary Conditions', () => {
    it('should handle maximum length strings correctly', () => {
      const longString = 'a'.repeat(10000);
      const event = {
        changeType: 'granted' as const,
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always',
          reason: longString,
          agentName: longString,
          taskId: longString,
        },
        timestamp: new Date(),
        message: longString,
        metadata: {
          longKey: longString,
          nestedData: {
            deepString: longString,
          },
        },
      };

      expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
      const parsed = PermissionChangeEventSchema.parse(event);
      expect(parsed.permission.reason).toBe(longString);
      expect(parsed.message).toBe(longString);
    });

    it('should handle empty optional fields correctly', () => {
      const minimalEvent = {
        changeType: 'revoked' as const,
        permission: {
          category: 'web',
          permission: 'network',
          previousLevel: 'allow-once',
          newLevel: null,
        },
        timestamp: new Date(),
        message: 'Permission revoked',
      };

      const parsed = PermissionChangeEventSchema.parse(minimalEvent);
      expect(parsed.permission.reason).toBeUndefined();
      expect(parsed.permission.agentName).toBeUndefined();
      expect(parsed.permission.taskId).toBeUndefined();
      expect(parsed.metadata).toBeUndefined();
    });

    it('should validate date boundaries correctly', () => {
      const dates = [
        new Date('1970-01-01T00:00:00.000Z'), // Unix epoch
        new Date('2000-01-01T12:00:00.000Z'), // Y2K
        new Date('2024-02-29T23:59:59.999Z'), // Leap year
        new Date('2038-01-19T03:14:07.999Z'), // Near Y2038 problem
      ];

      dates.forEach((date, index) => {
        const event = {
          changeType: 'modified' as const,
          permission: {
            category: 'filesystem',
            permission: 'write',
            previousLevel: 'deny',
            newLevel: 'allow-once',
          },
          timestamp: date,
          message: `Test message ${index}`,
        };

        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
        const parsed = PermissionChangeEventSchema.parse(event);
        expect(parsed.timestamp).toEqual(date);
      });
    });
  });

  describe('Schema Validation - All Enum Combinations', () => {
    it('should validate all ToolCategory values', () => {
      const categories = [
        'filesystem',
        'search',
        'shell',
        'web',
        'browser',
        'lsp',
        'custom',
      ] as const;

      categories.forEach(category => {
        const event = {
          changeType: 'granted' as const,
          permission: {
            category,
            permission: 'read',
            previousLevel: null,
            newLevel: 'allow-always',
          },
          timestamp: new Date(),
          message: `Testing ${category} category`,
        };

        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
        const parsed = PermissionChangeEventSchema.parse(event);
        expect(parsed.permission.category).toBe(category);
      });
    });

    it('should validate all ToolPermission values', () => {
      const permissions = [
        'read',
        'write',
        'execute',
        'network',
        'admin',
      ] as const;

      permissions.forEach(permission => {
        const event = {
          changeType: 'granted' as const,
          permission: {
            category: 'filesystem',
            permission,
            previousLevel: null,
            newLevel: 'allow-always',
          },
          timestamp: new Date(),
          message: `Testing ${permission} permission`,
        };

        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
        const parsed = PermissionChangeEventSchema.parse(event);
        expect(parsed.permission.permission).toBe(permission);
      });
    });

    it('should validate all PermissionLevel combinations', () => {
      const levels = ['allow-always', 'allow-once', 'deny'] as const;

      levels.forEach(previousLevel => {
        levels.forEach(newLevel => {
          const event = {
            changeType: 'modified' as const,
            permission: {
              category: 'filesystem',
              permission: 'read',
              previousLevel,
              newLevel,
            },
            timestamp: new Date(),
            message: `Changed from ${previousLevel} to ${newLevel}`,
          };

          expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
          const parsed = PermissionChangeEventSchema.parse(event);
          expect(parsed.permission.previousLevel).toBe(previousLevel);
          expect(parsed.permission.newLevel).toBe(newLevel);
        });
      });
    });
  });

  describe('Schema Validation - Error Messages', () => {
    it('should provide meaningful error messages for invalid changeType', () => {
      const invalidEvent = {
        changeType: 'invalid',
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always',
        },
        timestamp: new Date(),
        message: 'Test message',
      };

      expect(() => PermissionChangeEventSchema.parse(invalidEvent)).toThrow(
        /Invalid enum value/
      );
    });

    it('should provide meaningful error messages for missing required fields', () => {
      const invalidEvent = {
        changeType: 'granted',
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always',
        },
        timestamp: new Date(),
        // Missing message field
      };

      expect(() => PermissionChangeEventSchema.parse(invalidEvent)).toThrow(
        /Required/
      );
    });

    it('should provide meaningful error messages for invalid date types', () => {
      const invalidEvent = {
        changeType: 'granted',
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always',
        },
        timestamp: 'not-a-date',
        message: 'Test message',
      };

      expect(() => PermissionChangeEventSchema.parse(invalidEvent)).toThrow(
        /Expected date/
      );
    });
  });

  describe('Real-world Permission Scenarios', () => {
    it('should handle filesystem permission escalation scenario', () => {
      const events: PermissionChangeEvent[] = [
        {
          changeType: 'granted',
          permission: {
            category: 'filesystem',
            permission: 'read',
            previousLevel: null,
            newLevel: 'allow-once',
            reason: 'Initial access for project analysis',
            agentName: 'analyzer',
            taskId: 'task-001',
          },
          timestamp: new Date('2024-01-15T10:00:00Z'),
          message: 'Read permission granted for project analysis',
        },
        {
          changeType: 'modified',
          permission: {
            category: 'filesystem',
            permission: 'write',
            previousLevel: 'deny',
            newLevel: 'allow-once',
            reason: 'User approved write access for code generation',
            agentName: 'generator',
            taskId: 'task-002',
          },
          timestamp: new Date('2024-01-15T10:30:00Z'),
          message: 'Write permission upgraded for code generation',
        },
        {
          changeType: 'revoked',
          permission: {
            category: 'filesystem',
            permission: 'write',
            previousLevel: 'allow-once',
            newLevel: null,
            reason: 'Task completed, write access no longer needed',
            agentName: 'generator',
            taskId: 'task-002',
          },
          timestamp: new Date('2024-01-15T11:00:00Z'),
          message: 'Write permission revoked after task completion',
        },
      ];

      events.forEach(event => {
        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
      });

      // Verify the logical flow
      expect(events[0].permission.newLevel).toBe('allow-once');
      expect(events[1].permission.newLevel).toBe('allow-once');
      expect(events[2].permission.newLevel).toBeNull();
    });

    it('should handle network security incident scenario', () => {
      const securityEvent = {
        changeType: 'revoked' as const,
        permission: {
          category: 'web',
          permission: 'network',
          previousLevel: 'allow-always',
          newLevel: null,
          reason: 'Security incident detected: malicious domain access attempt',
          agentName: 'web-scraper-v2',
          taskId: 'market-research-456',
        },
        timestamp: new Date(),
        message: 'Network permission immediately revoked due to security policy violation',
        metadata: {
          incidentId: 'sec-2024-001',
          threatLevel: 'high',
          automaticRevocation: true,
          blockedDomains: ['malicious.example.com', 'phishing.test.net'],
          affectedSessions: ['session-123', 'session-456'],
          responseTime: 1250, // milliseconds
        },
      };

      expect(() => PermissionChangeEventSchema.parse(securityEvent)).not.toThrow();
      const parsed = PermissionChangeEventSchema.parse(securityEvent);
      expect(parsed.metadata?.threatLevel).toBe('high');
      expect(parsed.metadata?.automaticRevocation).toBe(true);
      expect(parsed.metadata?.blockedDomains).toHaveLength(2);
    });

    it('should handle browser automation permission workflow', () => {
      const browserEvent = {
        changeType: 'granted' as const,
        permission: {
          category: 'browser',
          permission: 'execute',
          previousLevel: null,
          newLevel: 'allow-always',
          reason: 'Automated testing requires browser navigation and interaction',
          agentName: 'qa-automation-bot',
          taskId: 'e2e-test-suite-789',
        },
        timestamp: new Date(),
        message: 'Browser automation permission granted for end-to-end testing',
        metadata: {
          testSuite: 'e2e-regression',
          browserVersion: 'Chrome 121.0',
          testEnvironment: 'staging',
          expectedDuration: 1800000, // 30 minutes
          screenshots: true,
          videoRecording: true,
          maxConcurrency: 3,
        },
      };

      expect(() => PermissionChangeEventSchema.parse(browserEvent)).not.toThrow();
      const parsed = PermissionChangeEventSchema.parse(browserEvent);
      expect(parsed.permission.category).toBe('browser');
      expect(parsed.metadata?.testSuite).toBe('e2e-regression');
      expect(parsed.metadata?.maxConcurrency).toBe(3);
    });
  });

  describe('Metadata Flexibility and Type Safety', () => {
    it('should handle deeply nested metadata structures', () => {
      const complexEvent = {
        changeType: 'modified' as const,
        permission: {
          category: 'custom',
          permission: 'admin',
          previousLevel: 'allow-once',
          newLevel: 'allow-always',
        },
        timestamp: new Date(),
        message: 'Admin permission elevated',
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: {
                  deepData: 'test',
                  arrays: [1, 2, 3, { nested: true }],
                  nullValue: null,
                  boolValue: false,
                },
              },
            },
          },
          mixedTypes: {
            string: 'value',
            number: 42,
            boolean: true,
            date: new Date(),
            array: ['a', 'b', 'c'],
            object: { key: 'value' },
          },
        },
      };

      expect(() => PermissionChangeEventSchema.parse(complexEvent)).not.toThrow();
      const parsed = PermissionChangeEventSchema.parse(complexEvent);
      expect(parsed.metadata?.level1?.level2?.level3?.level4?.deepData).toBe('test');
      expect(parsed.metadata?.mixedTypes?.number).toBe(42);
    });

    it('should handle array-based metadata', () => {
      const eventWithArrays = {
        changeType: 'granted' as const,
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-once',
        },
        timestamp: new Date(),
        message: 'Batch permission grant',
        metadata: {
          batchOperation: true,
          affectedFiles: [
            '/src/component1.tsx',
            '/src/component2.tsx',
            '/src/utils/helper.ts',
          ],
          permissions: [
            { file: '/src/component1.tsx', level: 'allow-once' },
            { file: '/src/component2.tsx', level: 'allow-always' },
          ],
          statistics: {
            totalFiles: 3,
            permissions: [
              { type: 'read', count: 3 },
              { type: 'write', count: 0 },
            ],
          },
        },
      };

      expect(() => PermissionChangeEventSchema.parse(eventWithArrays)).not.toThrow();
      const parsed = PermissionChangeEventSchema.parse(eventWithArrays);
      expect(parsed.metadata?.affectedFiles).toHaveLength(3);
      expect(parsed.metadata?.permissions[0]?.file).toBe('/src/component1.tsx');
    });
  });

  describe('Performance and Validation Speed', () => {
    it('should validate events efficiently with large metadata', () => {
      const largeMetadata = Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`])
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      const event = {
        changeType: 'granted' as const,
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always',
        },
        timestamp: new Date(),
        message: 'Large metadata test',
        metadata: largeMetadata,
      };

      const startTime = performance.now();
      expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
      const endTime = performance.now();

      // Validation should complete in reasonable time (< 100ms for this test)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle batch validation efficiently', () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        changeType: 'granted' as const,
        permission: {
          category: 'filesystem',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-always',
          agentName: `agent-${i}`,
          taskId: `task-${i}`,
        },
        timestamp: new Date(),
        message: `Batch event ${i}`,
      }));

      const startTime = performance.now();
      events.forEach(event => {
        expect(() => PermissionChangeEventSchema.parse(event)).not.toThrow();
      });
      const endTime = performance.now();

      // Batch validation should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('Type Inference and Development Experience', () => {
    it('should properly infer types for TypeScript usage', () => {
      const event: PermissionChangeEvent = {
        changeType: 'granted',
        permission: {
          category: 'filesystem',
          permission: 'write',
          previousLevel: null,
          newLevel: 'allow-always',
          reason: 'Development workflow',
          agentName: 'dev-agent',
          taskId: 'dev-task-123',
        },
        timestamp: new Date(),
        message: 'Write permission granted for development',
        metadata: {
          environment: 'development',
          approved: true,
        },
      };

      // These should all compile correctly due to proper type inference
      expect(event.changeType).toBe('granted');
      expect(event.permission.category).toBe('filesystem');
      expect(event.permission.newLevel).toBe('allow-always');
      expect(event.metadata?.environment).toBe('development');
    });

    it('should support all valid PermissionChangeType values in types', () => {
      const changeTypes: PermissionChangeType[] = ['granted', 'revoked', 'modified'];

      changeTypes.forEach(changeType => {
        const event: PermissionChangeEvent = {
          changeType,
          permission: {
            category: 'filesystem',
            permission: 'read',
            previousLevel: null,
            newLevel: 'allow-once',
          },
          timestamp: new Date(),
          message: `Test ${changeType}`,
        };

        expect(event.changeType).toBe(changeType);
      });
    });
  });
});