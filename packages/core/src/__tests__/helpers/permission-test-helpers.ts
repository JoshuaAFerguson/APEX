/**
 * @fileoverview Permission Test Helpers - Utilities for testing permission scenarios in APEX
 *
 * This module provides comprehensive test helpers for simulating different permission levels,
 * approval flows, permission denials, and autonomy boundary conditions. It enables thorough
 * testing of the permission system across all autonomy levels.
 *
 * @example
 * ```typescript
 * import { PermissionTestHelpers } from './permission-test-helpers';
 *
 * const helpers = new PermissionTestHelpers();
 *
 * // Create a mock permission that always allows
 * const allowPermission = helpers.createPermission('Write', 'allow-always');
 *
 * // Simulate a permission denial scenario
 * const deniedResult = helpers.simulatePermissionDenial('Write', '/sensitive/file');
 * expect(deniedResult.allowed).toBe(false);
 * ```
 */

import {
  Permission,
  PermissionLevel,
  PermissionQuery,
  ToolPermissionResult,
  ToolPermissionCheckOptions,
  ExtendedPermission,
  ApprovalRequest,
  ApprovalResponse,
  ApprovalStatus,
  AutonomyLevel,
  ApprovalGate,
  ApprovalCheckpointType,
  AutonomyConfig,
} from '../../types';

/**
 * Configuration for creating test permissions with various scenarios
 */
export interface TestPermissionConfig {
  /** Tool name for the permission */
  tool: string;
  /** Permission level to grant */
  level: PermissionLevel;
  /** Optional scope for the permission */
  scope?: string;
  /** Optional expiration date */
  expiry?: Date;
  /** Whether to include extended metadata */
  includeExtendedData?: boolean;
  /** Grant reason for extended permissions */
  grantReason?: string;
  /** Who granted the permission */
  grantedBy?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Configuration for simulating permission check scenarios
 */
export interface PermissionCheckScenario {
  /** Whether the permission should be allowed */
  allowed: boolean;
  /** The permission level to return */
  level: PermissionLevel | null;
  /** Whether to require confirmation */
  requiresConfirmation: boolean;
  /** Optional reason for denial */
  reason?: string;
  /** Whether to consume allow-once permissions */
  consumed?: boolean;
}

/**
 * Configuration for approval flow scenarios
 */
export interface ApprovalFlowConfig {
  /** ID of the approval request */
  requestId: string;
  /** Task ID requiring approval */
  taskId: string;
  /** Gate name triggering the approval */
  gateName: string;
  /** Type of approval checkpoint */
  gateType: ApprovalCheckpointType;
  /** Description of what needs approval */
  description?: string;
  /** Timeout in minutes */
  timeoutMinutes?: number;
  /** Minimum approvals required */
  minApprovals?: number;
  /** List of authorized approvers */
  approvers?: string[];
}

/**
 * Mock permission manager for testing permission scenarios
 */
export class MockPermissionManager {
  private permissions: Map<string, Permission> = new Map();
  private permissionResults: Map<string, PermissionCheckScenario> = new Map();

  /**
   * Set a mock permission for testing
   */
  setPermission(tool: string, scope: string | undefined, permission: Permission): void {
    const key = this.getPermissionKey(tool, scope);
    this.permissions.set(key, permission);
  }

  /**
   * Configure what a permission check should return
   */
  configurePermissionCheck(
    tool: string,
    scope: string | undefined,
    scenario: PermissionCheckScenario
  ): void {
    const key = this.getPermissionKey(tool, scope);
    this.permissionResults.set(key, scenario);
  }

  /**
   * Mock permission check that returns configured results
   */
  checkPermission(tool: string, options?: ToolPermissionCheckOptions): ToolPermissionResult {
    const key = this.getPermissionKey(tool, options?.scope);
    const scenario = this.permissionResults.get(key);

    if (scenario) {
      return {
        allowed: scenario.allowed,
        level: scenario.level,
        requiresConfirmation: scenario.requiresConfirmation,
        reason: scenario.reason,
        consumed: scenario.consumed || false,
      };
    }

    // Default: no permission found
    return {
      allowed: false,
      level: null,
      requiresConfirmation: true,
      reason: 'No permission found',
      consumed: false,
    };
  }

  /**
   * Get all stored permissions
   */
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Clear all stored permissions and configurations
   */
  reset(): void {
    this.permissions.clear();
    this.permissionResults.clear();
  }

  private getPermissionKey(tool: string, scope?: string): string {
    return `${tool}:${scope || '*'}`;
  }
}

/**
 * Comprehensive test helpers for permission and autonomy level testing
 */
export class PermissionTestHelpers {
  private mockManager = new MockPermissionManager();

  /**
   * Create a basic permission with the specified level
   */
  createPermission(tool: string, level: PermissionLevel, config?: Partial<TestPermissionConfig>): Permission {
    const now = new Date();
    return {
      tool,
      level,
      scope: config?.scope,
      expiry: config?.expiry,
      createdAt: config?.includeExtendedData ? now : now,
    };
  }

  /**
   * Create an extended permission with additional metadata
   */
  createExtendedPermission(
    tool: string,
    level: PermissionLevel,
    config?: Partial<TestPermissionConfig>
  ): ExtendedPermission {
    const basePermission = this.createPermission(tool, level, config);
    return {
      ...basePermission,
      grantReason: config?.grantReason || `Test permission for ${tool}`,
      grantedBy: config?.grantedBy || 'test-user',
      tags: config?.tags || ['test'],
    };
  }

  /**
   * Create a permission query object
   */
  createPermissionQuery(tool: string, scope?: string): PermissionQuery {
    return { tool, scope };
  }

  /**
   * Simulate a permission approval scenario
   */
  simulatePermissionApproval(tool: string, scope?: string): ToolPermissionResult {
    return {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
      reason: 'Permission granted for testing',
      consumed: false,
    };
  }

  /**
   * Simulate a permission denial scenario
   */
  simulatePermissionDenial(tool: string, scope?: string, reason?: string): ToolPermissionResult {
    return {
      allowed: false,
      level: 'deny',
      requiresConfirmation: false,
      reason: reason || `Permission denied for ${tool}`,
      consumed: false,
    };
  }

  /**
   * Simulate a permission scenario requiring confirmation
   */
  simulatePermissionRequiringConfirmation(tool: string, scope?: string): ToolPermissionResult {
    return {
      allowed: false,
      level: null,
      requiresConfirmation: true,
      reason: 'User confirmation required',
      consumed: false,
    };
  }

  /**
   * Simulate an allow-once permission that gets consumed
   */
  simulateAllowOnceConsumption(tool: string, scope?: string): ToolPermissionResult {
    return {
      allowed: true,
      level: 'allow-once',
      requiresConfirmation: false,
      reason: 'Allow-once permission consumed',
      consumed: true,
    };
  }

  /**
   * Create an approval request for testing approval flows
   */
  createApprovalRequest(config: ApprovalFlowConfig): ApprovalRequest {
    const now = new Date();
    const expiresAt = config.timeoutMinutes
      ? new Date(now.getTime() + config.timeoutMinutes * 60 * 1000)
      : undefined;

    return {
      requestId: config.requestId,
      id: config.requestId, // Legacy field
      taskId: config.taskId,
      gateName: config.gateName,
      gateType: config.gateType,
      description: config.description || `Approval required for ${config.gateName}`,
      approvers: config.approvers,
      minApprovals: config.minApprovals || 1,
      requestedAt: now,
      timeoutMinutes: config.timeoutMinutes,
      expiresAt,
      priority: 'normal',
    };
  }

  /**
   * Create an approval response (approved)
   */
  createApprovalResponse(
    requestId: string,
    taskId: string,
    gateName: string,
    approved: boolean = true,
    reason?: string
  ): ApprovalResponse {
    const now = new Date();
    return {
      requestId,
      approvalId: requestId, // Legacy field
      taskId,
      gateName,
      action: approved ? 'approve' : 'deny',
      response: approved ? 'approved' : 'denied',
      approver: 'test-user',
      reason: reason || (approved ? 'Approved by test' : 'Denied by test'),
      timestamp: now,
      requestedAt: new Date(now.getTime() - 60000), // 1 minute ago
      responseTimeMs: 60000,
    };
  }

  /**
   * Create an approval gate configuration
   */
  createApprovalGate(
    id: string,
    name: string,
    type: ApprovalCheckpointType,
    config?: {
      required?: boolean;
      autoApprove?: boolean;
      approvers?: string[];
      timeout?: number;
    }
  ): ApprovalGate {
    return {
      id,
      name,
      type,
      description: `Test approval gate: ${name}`,
      required: config?.required ?? true,
      autoApprove: config?.autoApprove ?? false,
      approvers: config?.approvers,
      timeout: config?.timeout,
    };
  }

  /**
   * Get the mock permission manager for advanced testing scenarios
   */
  getMockPermissionManager(): MockPermissionManager {
    return this.mockManager;
  }

  /**
   * Create a test scenario where permissions are initially denied but then approved
   */
  createPermissionFlowScenario(tool: string, scope?: string) {
    return {
      initialDenial: this.simulatePermissionDenial(tool, scope),
      requiresApproval: this.simulatePermissionRequiringConfirmation(tool, scope),
      finalApproval: this.simulatePermissionApproval(tool, scope),
    };
  }

  /**
   * Create test permissions for common tool scenarios
   */
  createCommonPermissionScenarios() {
    return {
      // File operations
      fileWrite: this.createPermission('Write', 'allow-always'),
      fileRead: this.createPermission('Read', 'allow-always'),
      fileDelete: this.createPermission('Delete', 'deny'),

      // Git operations
      gitCommit: this.createPermission('Git', 'allow-once', { scope: 'commit' }),
      gitPush: this.createPermission('Git', 'deny', { scope: 'push' }),

      // Shell operations
      shellExec: this.createPermission('Shell', 'allow-always'),
      shellSudo: this.createPermission('Shell', 'deny', { scope: 'sudo' }),

      // Network operations
      httpRequest: this.createPermission('HTTP', 'allow-always'),
      httpSensitive: this.createPermission('HTTP', 'deny', { scope: 'sensitive-domain.com' }),
    };
  }

  /**
   * Reset all mock state for clean testing
   */
  reset(): void {
    this.mockManager.reset();
  }
}

/**
 * Pre-configured test scenarios for common permission testing patterns
 */
export const PermissionTestScenarios = {
  /**
   * Scenario: Full access granted to all tools
   */
  fullAccess: (helpers: PermissionTestHelpers) => {
    const manager = helpers.getMockPermissionManager();
    manager.configurePermissionCheck('Write', undefined, {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });
    manager.configurePermissionCheck('Read', undefined, {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });
    manager.configurePermissionCheck('Shell', undefined, {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });
  },

  /**
   * Scenario: All access denied
   */
  noAccess: (helpers: PermissionTestHelpers) => {
    const manager = helpers.getMockPermissionManager();
    const tools = ['Write', 'Read', 'Shell', 'Git', 'HTTP'];
    tools.forEach(tool => {
      manager.configurePermissionCheck(tool, undefined, {
        allowed: false,
        level: 'deny',
        requiresConfirmation: false,
        reason: `Access denied to ${tool}`,
      });
    });
  },

  /**
   * Scenario: Mixed permissions requiring various approval flows
   */
  mixedPermissions: (helpers: PermissionTestHelpers) => {
    const manager = helpers.getMockPermissionManager();

    // Allow file reading
    manager.configurePermissionCheck('Read', undefined, {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });

    // Require confirmation for file writing
    manager.configurePermissionCheck('Write', undefined, {
      allowed: false,
      level: null,
      requiresConfirmation: true,
    });

    // Deny shell access outright
    manager.configurePermissionCheck('Shell', undefined, {
      allowed: false,
      level: 'deny',
      requiresConfirmation: false,
      reason: 'Shell access not permitted',
    });

    // Allow-once for git operations
    manager.configurePermissionCheck('Git', undefined, {
      allowed: true,
      level: 'allow-once',
      requiresConfirmation: false,
      consumed: true,
    });
  },

  /**
   * Scenario: Scope-based permissions with different rules per scope
   */
  scopeBasedPermissions: (helpers: PermissionTestHelpers) => {
    const manager = helpers.getMockPermissionManager();

    // Allow writes to /tmp but deny to /etc
    manager.configurePermissionCheck('Write', '/tmp', {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });

    manager.configurePermissionCheck('Write', '/etc', {
      allowed: false,
      level: 'deny',
      requiresConfirmation: false,
      reason: 'System directory access denied',
    });

    // Allow HTTP to most domains but require approval for sensitive ones
    manager.configurePermissionCheck('HTTP', 'api.example.com', {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });

    manager.configurePermissionCheck('HTTP', 'internal.company.com', {
      allowed: false,
      level: null,
      requiresConfirmation: true,
    });
  },
};

/**
 * Export singleton instance for convenience
 */
export const permissionTestHelpers = new PermissionTestHelpers();