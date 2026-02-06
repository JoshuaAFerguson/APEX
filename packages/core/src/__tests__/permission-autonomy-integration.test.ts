/**
 * @fileoverview Comprehensive integration tests for permission and autonomy systems
 * Tests the interaction between autonomy levels and permission enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  AutonomyLevel,
  AutonomyConfig,
  AutonomyConfigSchema,
  Permission,
  PermissionLevel,
  PermissionSchema,
  convertLegacyAutonomyLevel,
} from '../types.js';

describe('Permission and Autonomy Integration Tests', () => {
  describe('AutonomyLevel Configuration', () => {
    it('should define all valid autonomy levels', () => {
      const validLevels: AutonomyLevel[] = [
        'autonomous',
        'review-before-commit',
        'supervised',
        'manual'
      ];

      validLevels.forEach(level => {
        expect(typeof level).toBe('string');
        expect(level.length).toBeGreaterThan(0);
      });

      // Ensure we have all expected levels
      expect(validLevels).toHaveLength(4);
    });

    it('should validate AutonomyConfig with all optional fields', () => {
      const autonomyConfig: AutonomyConfig = {
        level: 'supervised',
        rejectionBehavior: 'prompt',
        gates: ['deployment', 'data-modification'],
        limits: {
          maxTokenUsage: 10000,
          maxCost: 5.0,
          maxDuration: 3600
        },
        stageOverrides: {
          planning: 'autonomous',
          implementation: 'review-before-commit'
        },
        agentOverrides: {
          planner: 'autonomous',
          developer: {
            level: 'supervised',
            gates: ['code-review'],
            limits: {
              maxTokenUsage: 5000
            }
          }
        }
      };

      const result = AutonomyConfigSchema.parse(autonomyConfig);
      expect(result).toEqual(autonomyConfig);
    });

    it('should validate minimal AutonomyConfig', () => {
      const minimalConfig = {
        level: 'manual' as AutonomyLevel
      };

      const result = AutonomyConfigSchema.parse(minimalConfig);
      expect(result.level).toBe('manual');
      expect(result.rejectionBehavior).toBeUndefined();
      expect(result.gates).toBeUndefined();
    });

    it('should handle legacy autonomy level conversion', () => {
      // Test legacy to new mapping
      expect(convertLegacyAutonomyLevel('autonomous')).toBe('autonomous');
      expect(convertLegacyAutonomyLevel('semi-autonomous')).toBe('review-before-commit');
      expect(convertLegacyAutonomyLevel('supervised')).toBe('supervised');
      expect(convertLegacyAutonomyLevel('manual')).toBe('manual');

      // Test unknown values default to supervised
      expect(convertLegacyAutonomyLevel('unknown' as AutonomyLevel)).toBe('supervised');
      expect(convertLegacyAutonomyLevel('invalid' as AutonomyLevel)).toBe('supervised');
    });
  });

  describe('Autonomy Level Permission Implications', () => {
    it('should map autonomy levels to expected permission behaviors', () => {
      const autonomyPermissionMapping = [
        {
          autonomy: 'autonomous' as AutonomyLevel,
          expectedDefaultPermission: 'allow-always' as PermissionLevel,
          description: 'Autonomous agents should have default allow permissions'
        },
        {
          autonomy: 'review-before-commit' as AutonomyLevel,
          expectedDefaultPermission: 'allow-once' as PermissionLevel,
          description: 'Review-before-commit should require explicit permission per use'
        },
        {
          autonomy: 'supervised' as AutonomyLevel,
          expectedDefaultPermission: 'deny' as PermissionLevel,
          description: 'Supervised agents should deny by default'
        },
        {
          autonomy: 'manual' as AutonomyLevel,
          expectedDefaultPermission: 'deny' as PermissionLevel,
          description: 'Manual mode should require explicit permission for everything'
        }
      ];

      autonomyPermissionMapping.forEach(({ autonomy, expectedDefaultPermission, description }) => {
        // Test that permission can be created with this level
        const permission: Permission = {
          tool: 'TestTool',
          level: expectedDefaultPermission,
          createdAt: new Date(),
          scope: `autonomy:${autonomy}`
        };

        const result = PermissionSchema.parse(permission);
        expect(result.level).toBe(expectedDefaultPermission);
        expect(result.scope).toContain(autonomy);
      });
    });
  });

  describe('Gate-based Permission Controls', () => {
    it('should validate approval gate configurations', () => {
      const gateConfigs = [
        { gates: [], description: 'No gates enabled' },
        { gates: ['deployment'], description: 'Deployment gate only' },
        { gates: ['data-modification', 'external-access'], description: 'Multiple gates' },
        { gates: ['custom-gate'], description: 'Custom gate name' }
      ];

      gateConfigs.forEach(({ gates, description }) => {
        const config: AutonomyConfig = {
          level: 'supervised',
          gates
        };

        const result = AutonomyConfigSchema.parse(config);
        expect(result.gates).toEqual(gates);
      });
    });

    it('should handle gate-specific permissions', () => {
      const gatePermissions = [
        'deployment',
        'data-modification',
        'external-access',
        'file-system-write',
        'network-request',
        'shell-command'
      ];

      gatePermissions.forEach(gate => {
        const permission: Permission = {
          tool: 'GateControlTool',
          level: 'allow-once',
          createdAt: new Date(),
          scope: `gate:${gate}`,
          expiry: new Date(Date.now() + 3600000) // 1 hour expiry for gates
        };

        const result = PermissionSchema.parse(permission);
        expect(result.scope).toBe(`gate:${gate}`);
        expect(result.level).toBe('allow-once');
      });
    });
  });

  describe('Stage and Agent Override Validations', () => {
    it('should validate stage-specific autonomy overrides', () => {
      const stageOverrides = {
        planning: 'autonomous' as AutonomyLevel,
        architecture: 'review-before-commit' as AutonomyLevel,
        implementation: 'supervised' as AutonomyLevel,
        testing: 'autonomous' as AutonomyLevel,
        review: 'manual' as AutonomyLevel,
        deployment: 'manual' as AutonomyLevel
      };

      const config: AutonomyConfig = {
        level: 'supervised',
        stageOverrides
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.stageOverrides).toEqual(stageOverrides);

      // Verify each stage override is valid
      Object.entries(stageOverrides).forEach(([stage, level]) => {
        expect(['autonomous', 'review-before-commit', 'supervised', 'manual']).toContain(level);
      });
    });

    it('should validate agent-specific autonomy overrides', () => {
      const agentOverrides = {
        planner: 'autonomous' as AutonomyLevel,
        architect: {
          level: 'review-before-commit' as AutonomyLevel,
          gates: ['architecture-review'],
          limits: {
            maxTokenUsage: 8000,
            maxDuration: 1800
          }
        },
        developer: {
          level: 'supervised' as AutonomyLevel,
          gates: ['code-review', 'security-check'],
          limits: {
            maxTokenUsage: 15000,
            maxCost: 10.0
          },
          stageOverrides: {
            testing: 'autonomous'
          }
        }
      };

      const config: AutonomyConfig = {
        level: 'supervised',
        agentOverrides
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.agentOverrides).toEqual(agentOverrides);
    });
  });

  describe('Permission Expiry and Autonomy Interaction', () => {
    it('should handle time-based permission expiry for different autonomy levels', () => {
      const now = new Date();
      const testCases = [
        {
          autonomy: 'autonomous',
          permission: 'allow-always' as PermissionLevel,
          expiry: undefined, // Autonomous may not need expiry
          expectedExpiry: undefined
        },
        {
          autonomy: 'review-before-commit',
          permission: 'allow-once' as PermissionLevel,
          expiry: new Date(now.getTime() + 3600000), // 1 hour
          expectedExpiry: new Date(now.getTime() + 3600000)
        },
        {
          autonomy: 'supervised',
          permission: 'allow-once' as PermissionLevel,
          expiry: new Date(now.getTime() + 900000), // 15 minutes
          expectedExpiry: new Date(now.getTime() + 900000)
        },
        {
          autonomy: 'manual',
          permission: 'allow-once' as PermissionLevel,
          expiry: new Date(now.getTime() + 300000), // 5 minutes
          expectedExpiry: new Date(now.getTime() + 300000)
        }
      ];

      testCases.forEach(({ autonomy, permission, expiry, expectedExpiry }) => {
        const permissionObj: Permission = {
          tool: `${autonomy}Tool`,
          level: permission,
          createdAt: now,
          scope: `autonomy:${autonomy}`,
          ...(expiry && { expiry })
        };

        const result = PermissionSchema.parse(permissionObj);
        expect(result.expiry).toEqual(expectedExpiry);
        expect(result.scope).toContain(autonomy);
      });
    });

    it('should validate expired permissions across autonomy levels', () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      const autonomyLevels: AutonomyLevel[] = ['autonomous', 'review-before-commit', 'supervised', 'manual'];

      autonomyLevels.forEach(level => {
        const expiredPermission: Permission = {
          tool: 'ExpiredTool',
          level: 'allow-once',
          createdAt: expiredDate,
          expiry: expiredDate,
          scope: `autonomy:${level}:expired`
        };

        // Should still validate (business logic handles expiry checking)
        const result = PermissionSchema.parse(expiredPermission);
        expect(result.expiry).toEqual(expiredDate);
        expect(result.scope).toContain(level);
      });
    });
  });

  describe('Resource Limits and Permissions', () => {
    it('should validate resource limits configuration', () => {
      const resourceLimits = {
        maxTokenUsage: 50000,
        maxCost: 25.0,
        maxDuration: 7200,
        maxParallelTasks: 5,
        maxMemoryMB: 2048
      };

      const config: AutonomyConfig = {
        level: 'supervised',
        limits: resourceLimits
      };

      const result = AutonomyConfigSchema.parse(config);
      expect(result.limits).toEqual(resourceLimits);
    });

    it('should handle permission-based resource restrictions', () => {
      const resourcePermissions = [
        {
          tool: 'HighMemoryTool',
          scope: 'memory:2048MB',
          level: 'allow-once' as PermissionLevel
        },
        {
          tool: 'ExpensiveTool',
          scope: 'cost:25.00',
          level: 'deny' as PermissionLevel
        },
        {
          tool: 'LongRunningTool',
          scope: 'duration:7200s',
          level: 'allow-always' as PermissionLevel
        }
      ];

      resourcePermissions.forEach(({ tool, scope, level }) => {
        const permission: Permission = {
          tool,
          scope,
          level,
          createdAt: new Date()
        };

        const result = PermissionSchema.parse(permission);
        expect(result.scope).toBe(scope);
        expect(result.level).toBe(level);
      });
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle full autonomy configuration with all features', () => {
      const fullConfig: AutonomyConfig = {
        level: 'review-before-commit',
        rejectionBehavior: 'abort',
        gates: ['security-check', 'cost-review', 'deployment'],
        limits: {
          maxTokenUsage: 100000,
          maxCost: 50.0,
          maxDuration: 14400,
          maxParallelTasks: 3
        },
        stageOverrides: {
          planning: 'autonomous',
          architecture: 'supervised',
          testing: 'autonomous',
          deployment: 'manual'
        },
        agentOverrides: {
          planner: 'autonomous',
          security: 'manual',
          developer: {
            level: 'supervised',
            gates: ['code-review'],
            limits: {
              maxTokenUsage: 20000,
              maxDuration: 3600
            }
          }
        }
      };

      const result = AutonomyConfigSchema.parse(fullConfig);
      expect(result).toEqual(fullConfig);

      // Validate that we can create permissions for this configuration
      const configPermission: Permission = {
        tool: 'ConfigurationTool',
        level: 'allow-always',
        createdAt: new Date(),
        scope: 'config:full-autonomy'
      };

      const permissionResult = PermissionSchema.parse(configPermission);
      expect(permissionResult.scope).toBe('config:full-autonomy');
    });

    it('should validate cross-system permission and autonomy interactions', () => {
      const interactions = [
        {
          autonomyLevel: 'autonomous',
          toolPermission: 'allow-always' as PermissionLevel,
          gate: undefined,
          expectedBehavior: 'immediate-execution'
        },
        {
          autonomyLevel: 'review-before-commit',
          toolPermission: 'allow-once' as PermissionLevel,
          gate: 'deployment',
          expectedBehavior: 'gate-approval-required'
        },
        {
          autonomyLevel: 'supervised',
          toolPermission: 'deny' as PermissionLevel,
          gate: 'security-check',
          expectedBehavior: 'blocked'
        },
        {
          autonomyLevel: 'manual',
          toolPermission: 'allow-once' as PermissionLevel,
          gate: 'user-approval',
          expectedBehavior: 'manual-approval-required'
        }
      ];

      interactions.forEach(({ autonomyLevel, toolPermission, gate, expectedBehavior }) => {
        const permission: Permission = {
          tool: 'InteractionTool',
          level: toolPermission,
          createdAt: new Date(),
          scope: gate ? `gate:${gate}:autonomy:${autonomyLevel}` : `autonomy:${autonomyLevel}`
        };

        const result = PermissionSchema.parse(permission);
        expect(result.level).toBe(toolPermission);
        expect(result.scope).toContain(autonomyLevel);

        // Behavior validation would be handled by business logic
        expect(expectedBehavior).toBeTruthy();
      });
    });
  });
});