/**
 * @fileoverview Permission Notification and Event System Tests
 *
 * Comprehensive tests for permission notification schemas, permission change events,
 * and related event system components that may not have complete test coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  PermissionNotificationSchema,
  PermissionChangeEventSchema,
  PermissionChangeTypeSchema,
  PermissionDetailsSchema,
  ToolPermissionSchema,
  PermissionLevelSchema,
  type PermissionNotification,
  type PermissionChangeEvent,
  type PermissionChangeType,
  type PermissionDetails,
  type PermissionLevel,
} from '../types';

describe('PermissionNotificationSchema Validation', () => {
  describe('Basic Permission Notification', () => {
    it('should validate complete permission notification', () => {
      const notification: PermissionNotification = {
        id: 'perm-notif-123',
        type: 'permission_request',
        title: 'Permission Required',
        message: 'Agent requests permission to read files in /src directory',
        timestamp: new Date(),
        priority: 'high',
        category: 'security',
        toolName: 'Read',
        toolScope: '/src/**/*.ts',
        permissionLevel: 'read',
        dangerLevel: 'medium',
        autoApprove: false,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes
        context: {
          agentId: 'agent-dev-001',
          taskId: 'task-123',
          reason: 'Development workflow requires reading TypeScript files',
          requestedBy: 'developer-agent',
          workflowStage: 'analysis',
        },
        actions: [
          { id: 'allow-always', label: 'Allow Always', type: 'approve', dangerous: false },
          { id: 'allow-once', label: 'Allow Once', type: 'approve', dangerous: false },
          { id: 'deny', label: 'Deny', type: 'deny', dangerous: false },
        ],
        metadata: {
          requestCount: 1,
          similarRequestsCount: 0,
          lastRequestTime: new Date(Date.now() - 86400000),
          source: 'permission-manager',
        },
      };

      const result = PermissionNotificationSchema.parse(notification);
      expect(result.id).toBe('perm-notif-123');
      expect(result.type).toBe('permission_request');
      expect(result.title).toBe('Permission Required');
      expect(result.toolName).toBe('Read');
      expect(result.toolScope).toBe('/src/**/*.ts');
      expect(result.permissionLevel).toBe('read');
      expect(result.dangerLevel).toBe('medium');
      expect(result.autoApprove).toBe(false);
      expect(result.context?.agentId).toBe('agent-dev-001');
      expect(result.actions).toHaveLength(3);
      expect(result.metadata?.requestCount).toBe(1);
    });

    it('should validate permission notification with minimal fields', () => {
      const minimalNotification = {
        id: 'perm-notif-min',
        type: 'permission_request',
        title: 'Permission Required',
        message: 'Agent requests permission',
        timestamp: new Date(),
        priority: 'medium',
        category: 'security',
        toolName: 'Bash',
        permissionLevel: 'execute',
        dangerLevel: 'high',
        autoApprove: false,
        actions: [
          { id: 'deny', label: 'Deny', type: 'deny', dangerous: false },
        ],
      };

      const result = PermissionNotificationSchema.parse(minimalNotification);
      expect(result.id).toBe('perm-notif-min');
      expect(result.toolScope).toBeUndefined();
      expect(result.context).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();
    });

    it('should validate different notification types', () => {
      const notificationTypes = [
        'permission_request',
        'permission_granted',
        'permission_denied',
        'permission_revoked',
        'permission_expired',
      ];

      notificationTypes.forEach(type => {
        const notification = {
          id: `notif-${type}`,
          type,
          title: `Test ${type}`,
          message: 'Test message',
          timestamp: new Date(),
          priority: 'medium' as const,
          category: 'security' as const,
          toolName: 'TestTool',
          permissionLevel: 'read' as const,
          dangerLevel: 'low' as const,
          autoApprove: false,
          actions: [],
        };

        expect(() => PermissionNotificationSchema.parse(notification)).not.toThrow();
      });
    });

    it('should validate different priority levels', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];

      priorities.forEach(priority => {
        const notification = {
          id: 'test-id',
          type: 'permission_request',
          title: 'Test',
          message: 'Test',
          timestamp: new Date(),
          priority,
          category: 'security' as const,
          toolName: 'Test',
          permissionLevel: 'read' as const,
          dangerLevel: 'low' as const,
          autoApprove: false,
          actions: [],
        };

        expect(() => PermissionNotificationSchema.parse(notification)).not.toThrow();
      });
    });

    it('should validate different danger levels', () => {
      const dangerLevels = ['low', 'medium', 'high', 'critical'];

      dangerLevels.forEach(dangerLevel => {
        const notification = {
          id: 'test-id',
          type: 'permission_request',
          title: 'Test',
          message: 'Test',
          timestamp: new Date(),
          priority: 'medium' as const,
          category: 'security' as const,
          toolName: 'Test',
          permissionLevel: 'read' as const,
          dangerLevel,
          autoApprove: false,
          actions: [],
        };

        expect(() => PermissionNotificationSchema.parse(notification)).not.toThrow();
      });
    });

    it('should validate complex action configurations', () => {
      const complexActions = [
        {
          id: 'allow-with-restrictions',
          label: 'Allow with Restrictions',
          type: 'approve',
          dangerous: false,
          description: 'Allow with additional security constraints',
          confirmationRequired: true,
          metadata: { restrictions: ['rate-limit', 'audit-log'] },
        },
        {
          id: 'temporary-allow',
          label: 'Allow for 1 hour',
          type: 'approve',
          dangerous: false,
          description: 'Temporary permission grant',
          expiresIn: 3600000,
        },
        {
          id: 'escalate',
          label: 'Escalate to Admin',
          type: 'escalate',
          dangerous: false,
          escalationLevel: 'admin',
        },
        {
          id: 'deny-permanent',
          label: 'Deny Permanently',
          type: 'deny',
          dangerous: true,
          description: 'Permanently block this permission',
          confirmationRequired: true,
        },
      ];

      const notification = {
        id: 'complex-actions',
        type: 'permission_request',
        title: 'Complex Permission Request',
        message: 'Request with multiple action options',
        timestamp: new Date(),
        priority: 'high' as const,
        category: 'security' as const,
        toolName: 'Bash',
        permissionLevel: 'execute' as const,
        dangerLevel: 'high' as const,
        autoApprove: false,
        actions: complexActions,
      };

      const result = PermissionNotificationSchema.parse(notification);
      expect(result.actions).toHaveLength(4);
      expect(result.actions?.[0]?.confirmationRequired).toBe(true);
      expect(result.actions?.[1]?.expiresIn).toBe(3600000);
      expect(result.actions?.[2]?.escalationLevel).toBe('admin');
      expect(result.actions?.[3]?.dangerous).toBe(true);
    });

    it('should handle complex context and metadata', () => {
      const complexNotification = {
        id: 'complex-context',
        type: 'permission_request',
        title: 'Complex Permission Request',
        message: 'Request with rich context information',
        timestamp: new Date(),
        priority: 'high' as const,
        category: 'automation' as const,
        toolName: 'Browser',
        toolScope: 'https://api.example.com/*',
        permissionLevel: 'network' as const,
        dangerLevel: 'medium' as const,
        autoApprove: false,
        context: {
          agentId: 'automation-agent-v2',
          taskId: 'web-scraping-task-456',
          reason: 'Automated data collection for market analysis',
          requestedBy: 'data-science-team',
          workflowStage: 'data-collection',
          previousAttempts: 2,
          similarTasks: ['task-123', 'task-124'],
          userIntent: 'Market research automation',
          riskAssessment: {
            score: 6.5,
            factors: ['new-domain', 'bulk-operations'],
          },
        },
        actions: [],
        metadata: {
          requestCount: 3,
          similarRequestsCount: 15,
          lastRequestTime: new Date(Date.now() - 3600000),
          source: 'workflow-orchestrator',
          category: 'automation',
          tags: ['web-scraping', 'market-analysis', 'bulk-operation'],
          performance: {
            averageResponseTime: 250,
            successRate: 0.95,
          },
          compliance: {
            dataPrivacyApproved: true,
            termsOfServiceAccepted: true,
            robotsTxtCompliant: true,
          },
        },
      };

      const result = PermissionNotificationSchema.parse(complexNotification);
      expect(result.context?.riskAssessment?.score).toBe(6.5);
      expect(result.metadata?.tags).toContain('web-scraping');
      expect(result.metadata?.compliance?.dataPrivacyApproved).toBe(true);
    });
  });

  describe('Permission Notification Error Cases', () => {
    it('should reject notification with invalid required fields', () => {
      const invalidNotifications = [
        // Missing ID
        {
          type: 'permission_request',
          title: 'Test',
          message: 'Test',
          timestamp: new Date(),
          priority: 'medium',
          category: 'security',
          toolName: 'Test',
          permissionLevel: 'read',
          dangerLevel: 'low',
          autoApprove: false,
          actions: [],
        },
        // Invalid type
        {
          id: 'test',
          type: 'invalid_type',
          title: 'Test',
          message: 'Test',
          timestamp: new Date(),
          priority: 'medium',
          category: 'security',
          toolName: 'Test',
          permissionLevel: 'read',
          dangerLevel: 'low',
          autoApprove: false,
          actions: [],
        },
        // Invalid priority
        {
          id: 'test',
          type: 'permission_request',
          title: 'Test',
          message: 'Test',
          timestamp: new Date(),
          priority: 'invalid_priority',
          category: 'security',
          toolName: 'Test',
          permissionLevel: 'read',
          dangerLevel: 'low',
          autoApprove: false,
          actions: [],
        },
      ];

      invalidNotifications.forEach((notification, index) => {
        expect(() => PermissionNotificationSchema.parse(notification as any))
          .toThrow(`Notification ${index} should be invalid`);
      });
    });
  });
});

describe('PermissionChangeEventSchema Validation', () => {
  describe('Permission Change Types', () => {
    it('should validate all permission change types', () => {
      const changeTypes: PermissionChangeType[] = [
        'granted',
        'revoked',
        'modified',
        'expired',
      ];

      changeTypes.forEach(changeType => {
        expect(() => PermissionChangeTypeSchema.parse(changeType)).not.toThrow();
      });
    });

    it('should reject invalid change types', () => {
      const invalidTypes = ['created', 'deleted', 'updated', 'invalid'];

      invalidTypes.forEach(type => {
        expect(() => PermissionChangeTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('Permission Details Validation', () => {
    it('should validate permission details with level changes', () => {
      const details: PermissionDetails = {
        tool: 'Read',
        scope: '/src/**/*.ts',
        permission: 'read',
        previousLevel: 'deny',
        newLevel: 'allow-always',
        grantedBy: 'user@example.com',
        reason: 'Development work requires file access',
        context: {
          agentId: 'dev-agent',
          taskId: 'development-task',
          timestamp: new Date(),
        },
      };

      const result = PermissionDetailsSchema.parse(details);
      expect(result.tool).toBe('Read');
      expect(result.scope).toBe('/src/**/*.ts');
      expect(result.permission).toBe('read');
      expect(result.previousLevel).toBe('deny');
      expect(result.newLevel).toBe('allow-always');
      expect(result.grantedBy).toBe('user@example.com');
      expect(result.reason).toBe('Development work requires file access');
    });

    it('should validate permission details with null previous level (new permission)', () => {
      const details: PermissionDetails = {
        tool: 'Bash',
        scope: 'npm install',
        permission: 'execute',
        previousLevel: null,
        newLevel: 'allow-once',
        grantedBy: 'system',
        reason: 'First-time permission grant',
      };

      const result = PermissionDetailsSchema.parse(details);
      expect(result.previousLevel).toBeNull();
      expect(result.newLevel).toBe('allow-once');
    });

    it('should validate permission details with null new level (revocation)', () => {
      const details: PermissionDetails = {
        tool: 'WebFetch',
        scope: 'https://suspicious.com/*',
        permission: 'network',
        previousLevel: 'allow-always',
        newLevel: null,
        grantedBy: 'security-system',
        reason: 'Security policy violation detected',
      };

      const result = PermissionDetailsSchema.parse(details);
      expect(result.previousLevel).toBe('allow-always');
      expect(result.newLevel).toBeNull();
      expect(result.reason).toBe('Security policy violation detected');
    });
  });

  describe('Complete Permission Change Event', () => {
    it('should validate complete permission change event', () => {
      const changeEvent: PermissionChangeEvent = {
        id: 'perm-change-123',
        changeType: 'granted',
        permission: {
          tool: 'Edit',
          scope: '/src/components/**/*.tsx',
          permission: 'write',
          previousLevel: null,
          newLevel: 'allow-always',
          grantedBy: 'lead-developer@team.com',
          reason: 'Component development requires edit access',
          context: {
            agentId: 'react-dev-agent',
            taskId: 'component-refactor-789',
            timestamp: new Date(),
            workflowStage: 'implementation',
            requestOrigin: 'automatic-workflow',
          },
        },
        timestamp: new Date(),
        source: 'permission-manager',
        metadata: {
          triggeredBy: 'workflow-automation',
          affectedAgents: ['react-dev-agent'],
          notificationsSent: ['developer-team', 'security-team'],
          auditTrail: {
            requestId: 'req-456',
            approvalProcess: 'automatic',
            reviewers: [],
          },
        },
      };

      const result = PermissionChangeEventSchema.parse(changeEvent);
      expect(result.id).toBe('perm-change-123');
      expect(result.changeType).toBe('granted');
      expect(result.permission.tool).toBe('Edit');
      expect(result.permission.newLevel).toBe('allow-always');
      expect(result.source).toBe('permission-manager');
      expect(result.metadata?.triggeredBy).toBe('workflow-automation');
    });

    it('should validate permission modification event', () => {
      const modificationEvent: PermissionChangeEvent = {
        id: 'perm-mod-456',
        changeType: 'modified',
        permission: {
          tool: 'Bash',
          scope: 'git commit',
          permission: 'execute',
          previousLevel: 'allow-always',
          newLevel: 'allow-once',
          grantedBy: 'security-policy-engine',
          reason: 'Reduced permission level due to security policy update',
          context: {
            agentId: 'git-automation-agent',
            timestamp: new Date(),
            policyVersion: 'v2.1.0',
            securityLevel: 'enhanced',
          },
        },
        timestamp: new Date(),
        source: 'security-policy-engine',
        metadata: {
          policyChangeId: 'policy-update-789',
          affectedPermissions: 15,
          rollbackPlan: 'available',
        },
      };

      const result = PermissionChangeEventSchema.parse(modificationEvent);
      expect(result.changeType).toBe('modified');
      expect(result.permission.previousLevel).toBe('allow-always');
      expect(result.permission.newLevel).toBe('allow-once');
      expect(result.source).toBe('security-policy-engine');
    });

    it('should validate permission revocation event', () => {
      const revocationEvent: PermissionChangeEvent = {
        id: 'perm-revoke-789',
        changeType: 'revoked',
        permission: {
          tool: 'Browser',
          scope: 'https://blocked-domain.com/*',
          permission: 'network',
          previousLevel: 'allow-once',
          newLevel: null,
          grantedBy: 'security-incident-response',
          reason: 'Domain flagged by threat intelligence feed',
          context: {
            agentId: 'web-scraper-agent',
            timestamp: new Date(),
            incidentId: 'inc-2024-001',
            threatLevel: 'high',
            immediateRevocation: true,
          },
        },
        timestamp: new Date(),
        source: 'threat-intelligence-system',
        metadata: {
          alertId: 'alert-789',
          responseTime: 45000, // 45 seconds
          automaticRevocation: true,
          affectedSessions: ['session-123', 'session-124'],
        },
      };

      const result = PermissionChangeEventSchema.parse(revocationEvent);
      expect(result.changeType).toBe('revoked');
      expect(result.permission.newLevel).toBeNull();
      expect(result.permission.context?.immediateRevocation).toBe(true);
      expect(result.metadata?.automaticRevocation).toBe(true);
    });

    it('should validate permission expiration event', () => {
      const expirationEvent: PermissionChangeEvent = {
        id: 'perm-expire-101',
        changeType: 'expired',
        permission: {
          tool: 'Read',
          scope: '/tmp/temp-files/**',
          permission: 'read',
          previousLevel: 'allow-once',
          newLevel: null,
          grantedBy: 'temporary-permission-system',
          reason: 'Temporary permission expired after timeout',
          context: {
            agentId: 'file-processor-agent',
            timestamp: new Date(),
            originalGrantTime: new Date(Date.now() - 3600000), // 1 hour ago
            expirationPolicy: 'automatic-cleanup',
          },
        },
        timestamp: new Date(),
        source: 'permission-expiration-service',
        metadata: {
          cleanupJobId: 'cleanup-456',
          totalExpiredPermissions: 23,
          nextCleanupSchedule: new Date(Date.now() + 86400000), // 24 hours
        },
      };

      const result = PermissionChangeEventSchema.parse(expirationEvent);
      expect(result.changeType).toBe('expired');
      expect(result.permission.reason).toContain('expired after timeout');
      expect(result.source).toBe('permission-expiration-service');
    });
  });

  describe('Event System Error Handling', () => {
    it('should reject events with invalid change types', () => {
      const invalidEvent = {
        id: 'invalid-event',
        changeType: 'created', // Invalid change type
        permission: {
          tool: 'Test',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-once',
        },
        timestamp: new Date(),
        source: 'test',
      };

      expect(() => PermissionChangeEventSchema.parse(invalidEvent)).toThrow();
    });

    it('should reject events with missing required fields', () => {
      const incompleteEvent = {
        changeType: 'granted',
        permission: {
          tool: 'Test',
          permission: 'read',
          previousLevel: null,
          newLevel: 'allow-once',
        },
        timestamp: new Date(),
        // Missing id and source
      };

      expect(() => PermissionChangeEventSchema.parse(incompleteEvent)).toThrow();
    });

    it('should handle complex nested metadata structures', () => {
      const complexEvent = {
        id: 'complex-event',
        changeType: 'granted',
        permission: {
          tool: 'MultiEdit',
          permission: 'write',
          previousLevel: null,
          newLevel: 'allow-always',
        },
        timestamp: new Date(),
        source: 'advanced-workflow-system',
        metadata: {
          workflow: {
            id: 'workflow-456',
            stage: 'implementation',
            totalStages: 5,
            dependencies: ['task-1', 'task-2'],
            parallelExecution: true,
          },
          performance: {
            decisionTime: 125.5,
            cpuUsage: 0.15,
            memoryUsage: 234567890,
          },
          auditTrail: {
            events: [
              { action: 'requested', timestamp: new Date(Date.now() - 1000) },
              { action: 'evaluated', timestamp: new Date(Date.now() - 500) },
              { action: 'approved', timestamp: new Date() },
            ],
            reviewChain: ['automated-check', 'policy-engine', 'risk-assessment'],
          },
        },
      };

      expect(() => PermissionChangeEventSchema.parse(complexEvent)).not.toThrow();
    });
  });
});

describe('Integration Tests for Permission Events', () => {
  it('should support permission lifecycle through events', () => {
    // Grant permission
    const grantEvent = {
      id: 'lifecycle-grant',
      changeType: 'granted' as const,
      permission: {
        tool: 'Write',
        scope: '/data/output.json',
        permission: 'write' as const,
        previousLevel: null,
        newLevel: 'allow-once' as const,
        grantedBy: 'user',
        reason: 'Data export task',
      },
      timestamp: new Date(),
      source: 'user-interface',
    };

    // Modify permission
    const modifyEvent = {
      id: 'lifecycle-modify',
      changeType: 'modified' as const,
      permission: {
        tool: 'Write',
        scope: '/data/output.json',
        permission: 'write' as const,
        previousLevel: 'allow-once' as const,
        newLevel: 'allow-always' as const,
        grantedBy: 'user',
        reason: 'Extended to always allow',
      },
      timestamp: new Date(),
      source: 'user-interface',
    };

    // Revoke permission
    const revokeEvent = {
      id: 'lifecycle-revoke',
      changeType: 'revoked' as const,
      permission: {
        tool: 'Write',
        scope: '/data/output.json',
        permission: 'write' as const,
        previousLevel: 'allow-always' as const,
        newLevel: null,
        grantedBy: 'security-system',
        reason: 'Task completed, permission no longer needed',
      },
      timestamp: new Date(),
      source: 'automatic-cleanup',
    };

    // All events should validate
    expect(() => PermissionChangeEventSchema.parse(grantEvent)).not.toThrow();
    expect(() => PermissionChangeEventSchema.parse(modifyEvent)).not.toThrow();
    expect(() => PermissionChangeEventSchema.parse(revokeEvent)).not.toThrow();

    // Events should maintain consistency
    expect(grantEvent.permission.tool).toBe(modifyEvent.permission.tool);
    expect(modifyEvent.permission.tool).toBe(revokeEvent.permission.tool);
    expect(modifyEvent.permission.previousLevel).toBe(grantEvent.permission.newLevel);
    expect(revokeEvent.permission.previousLevel).toBe(modifyEvent.permission.newLevel);
  });
});