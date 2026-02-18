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
   * Test permission boundary conditions with exact scope matching
   */
  testPermissionBoundary(
    tool: string,
    scope: string,
    testCases: Array<{
      testScope: string;
      expectedAllowed: boolean;
      description: string;
    }>
  ): Array<{
    testCase: {
      testScope: string;
      expectedAllowed: boolean;
      description: string;
    };
    result: ToolPermissionResult;
    matches: boolean;
  }> {
    // Configure base permission
    this.mockManager.configurePermissionCheck(tool, scope, {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    });

    return testCases.map(testCase => {
      const result = this.mockManager.checkPermission(tool, { scope: testCase.testScope });
      const matches = result.allowed === testCase.expectedAllowed;

      return {
        testCase,
        result,
        matches,
      };
    });
  }

  /**
   * Simulate permission denial with escalation workflow
   */
  simulatePermissionDenialEscalation(
    tool: string,
    scope?: string,
    escalationSteps?: Array<{
      escalationLevel: 'supervisor' | 'admin' | 'security-team';
      autoApprove: boolean;
      timeout?: number;
      reason?: string;
    }>
  ): {
    initialDenial: ToolPermissionResult;
    escalationSteps: Array<{
      level: string;
      approved: boolean;
      reason: string;
      responseTime: number;
    }>;
    finalDecision: 'approved' | 'denied' | 'escalated-further';
  } {
    const initialDenial = this.simulatePermissionDenial(
      tool,
      scope,
      'Permission denied - escalation required'
    );

    const defaultEscalationSteps = escalationSteps || [
      { escalationLevel: 'supervisor', autoApprove: false, timeout: 30 },
      { escalationLevel: 'admin', autoApprove: false, timeout: 60 },
      { escalationLevel: 'security-team', autoApprove: true, timeout: 120 },
    ];

    const escalationResults = defaultEscalationSteps.map(step => {
      const approved = step.autoApprove || Math.random() > 0.3; // 70% approval rate for testing
      return {
        level: step.escalationLevel,
        approved,
        reason: approved
          ? `Approved by ${step.escalationLevel} after review`
          : `Denied by ${step.escalationLevel} - insufficient justification`,
        responseTime: (step.timeout || 30) * 1000,
      };
    });

    const finalApproval = escalationResults.find(step => step.approved);
    const finalDecision = finalApproval
      ? 'approved'
      : escalationResults.length >= 3
      ? 'escalated-further'
      : 'denied';

    return {
      initialDenial,
      escalationSteps: escalationResults,
      finalDecision,
    };
  }

  /**
   * Test dangerous operation denial with context
   */
  testDangerousOperationDenial(
    operation: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    context?: {
      affectedFiles?: string[];
      reversible?: boolean;
      requiresBackup?: boolean;
      productionSystem?: boolean;
    }
  ): {
    riskAssessment: {
      level: string;
      factors: string[];
      score: number;
      recommendation: 'allow' | 'warn' | 'deny' | 'escalate';
    };
    permissionResult: ToolPermissionResult;
    requiredApprovals?: Array<{
      approver: string;
      reason: string;
    }>;
  } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Calculate risk score
    switch (riskLevel) {
      case 'low':
        riskScore = 25;
        break;
      case 'medium':
        riskScore = 50;
        break;
      case 'high':
        riskScore = 75;
        break;
      case 'critical':
        riskScore = 100;
        break;
    }

    if (context) {
      if (context.productionSystem) {
        riskScore += 25;
        riskFactors.push('Production system impact');
      }
      if (!context.reversible) {
        riskScore += 20;
        riskFactors.push('Irreversible operation');
      }
      if (context.affectedFiles && context.affectedFiles.length > 10) {
        riskScore += 15;
        riskFactors.push('Large number of affected files');
      }
      if (!context.requiresBackup) {
        riskScore += 10;
        riskFactors.push('No backup required - high data loss risk');
      }
    }

    // Determine recommendation
    let recommendation: 'allow' | 'warn' | 'deny' | 'escalate';
    if (riskScore >= 90) {
      recommendation = 'deny';
    } else if (riskScore >= 70) {
      recommendation = 'escalate';
    } else if (riskScore >= 40) {
      recommendation = 'warn';
    } else {
      recommendation = 'allow';
    }

    // Generate permission result
    let permissionResult: ToolPermissionResult;
    let requiredApprovals: Array<{ approver: string; reason: string }> | undefined;

    switch (recommendation) {
      case 'allow':
        permissionResult = this.simulatePermissionApproval(operation);
        break;
      case 'warn':
        permissionResult = this.simulatePermissionRequiringConfirmation(operation);
        break;
      case 'deny':
        permissionResult = this.simulatePermissionDenial(
          operation,
          undefined,
          `Dangerous operation blocked: risk score ${riskScore}`
        );
        break;
      case 'escalate':
        permissionResult = this.simulatePermissionRequiringConfirmation(operation);
        requiredApprovals = [
          { approver: 'tech-lead', reason: 'Technical review required' },
          { approver: 'security-team', reason: 'Security assessment required' },
        ];
        if (context?.productionSystem) {
          requiredApprovals.push({
            approver: 'production-manager',
            reason: 'Production system change approval',
          });
        }
        break;
    }

    return {
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors,
        score: Math.min(riskScore, 100),
        recommendation,
      },
      permissionResult,
      requiredApprovals,
    };
  }

  /**
   * Test permission conflicts between overlapping rules
   */
  testPermissionConflicts(
    tool: string,
    conflictingRules: Array<{
      scope: string;
      level: PermissionLevel;
      priority?: number;
    }>
  ): {
    conflicts: Array<{
      scope1: string;
      scope2: string;
      level1: PermissionLevel;
      level2: PermissionLevel;
      conflictType: 'overlapping-scopes' | 'contradictory-levels' | 'priority-conflict';
    }>;
    resolution: {
      resolvedScope: string;
      resolvedLevel: PermissionLevel;
      resolutionStrategy: 'most-restrictive' | 'highest-priority' | 'most-specific-scope';
      explanation: string;
    };
  } {
    const conflicts: Array<{
      scope1: string;
      scope2: string;
      level1: PermissionLevel;
      level2: PermissionLevel;
      conflictType: 'overlapping-scopes' | 'contradictory-levels' | 'priority-conflict';
    }> = [];

    // Detect conflicts
    for (let i = 0; i < conflictingRules.length; i++) {
      for (let j = i + 1; j < conflictingRules.length; j++) {
        const rule1 = conflictingRules[i];
        const rule2 = conflictingRules[j];

        // Check for overlapping scopes
        const scopesOverlap = rule1.scope.includes(rule2.scope) || rule2.scope.includes(rule1.scope);
        const levelsContradict = (rule1.level === 'allow-always' && rule2.level === 'deny') ||
                                (rule1.level === 'deny' && rule2.level === 'allow-always');

        if (scopesOverlap || levelsContradict) {
          let conflictType: 'overlapping-scopes' | 'contradictory-levels' | 'priority-conflict';

          if (levelsContradict) {
            conflictType = 'contradictory-levels';
          } else if (scopesOverlap) {
            conflictType = 'overlapping-scopes';
          } else {
            conflictType = 'priority-conflict';
          }

          conflicts.push({
            scope1: rule1.scope,
            scope2: rule2.scope,
            level1: rule1.level,
            level2: rule2.level,
            conflictType,
          });
        }
      }
    }

    // Resolve conflicts (most restrictive wins)
    const sortedRules = [...conflictingRules].sort((a, b) => {
      // Priority order: deny > allow-once > allow-always
      const levelPriority = { deny: 3, 'allow-once': 2, 'allow-always': 1 };
      return levelPriority[b.level] - levelPriority[a.level];
    });

    const resolvedRule = sortedRules[0];
    const resolution = {
      resolvedScope: resolvedRule.scope,
      resolvedLevel: resolvedRule.level,
      resolutionStrategy: 'most-restrictive' as const,
      explanation: `Applied most restrictive rule: ${resolvedRule.level} for scope ${resolvedRule.scope}`,
    };

    return { conflicts, resolution };
  }

  /**
   * Simulate scoped wildcard denial patterns
   */
  simulateScopedWildcardDenial(
    tool: string,
    patterns: Array<{
      pattern: string;
      level: PermissionLevel;
    }>,
    testPaths: string[]
  ): Array<{
    path: string;
    matchedPattern?: string;
    result: ToolPermissionResult;
    reason: string;
  }> {
    return testPaths.map(path => {
      // Find matching pattern (first match wins)
      const matchedRule = patterns.find(rule => {
        const regex = new RegExp(rule.pattern.replace(/\*/g, '.*'));
        return regex.test(path);
      });

      if (matchedRule) {
        const result = matchedRule.level === 'deny'
          ? this.simulatePermissionDenial(tool, path, `Blocked by pattern: ${matchedRule.pattern}`)
          : this.simulatePermissionApproval(tool, path);

        return {
          path,
          matchedPattern: matchedRule.pattern,
          result,
          reason: `Matched pattern: ${matchedRule.pattern}`,
        };
      } else {
        // No pattern matched - default to allowing
        const result = this.simulatePermissionApproval(tool, path);
        return {
          path,
          result,
          reason: 'No pattern matched - default allow',
        };
      }
    });
  }

  /**
   * Verify permission audit trail with comprehensive tracking
   */
  verifyPermissionAuditTrail(
    tool: string,
    scope: string,
    actions: Array<{
      action: 'request' | 'approve' | 'deny' | 'consume' | 'expire';
      timestamp: Date;
      actor: string;
      reason?: string;
    }>
  ): {
    auditTrail: Array<{
      action: string;
      timestamp: Date;
      actor: string;
      reason?: string;
      valid: boolean;
      issues?: string[];
    }>;
    isCompliant: boolean;
    missingEntries: string[];
    suspiciousActivity: Array<{
      issue: string;
      severity: 'low' | 'medium' | 'high';
      actions: Array<{ action: string; actor: string; timestamp: Date }>;
    }>;
  } {
    const auditTrail = actions.map(action => {
      const issues: string[] = [];
      let valid = true;

      // Validate timestamp order
      const previousAction = actions[actions.indexOf(action) - 1];
      if (previousAction && action.timestamp < previousAction.timestamp) {
        issues.push('Timestamp out of order');
        valid = false;
      }

      // Validate required fields
      if (!action.actor) {
        issues.push('Missing actor');
        valid = false;
      }

      // Validate action sequences
      if (action.action === 'consume' && !actions.some(a => a.action === 'approve' && a.timestamp < action.timestamp)) {
        issues.push('Consume action without prior approval');
        valid = false;
      }

      return {
        action: action.action,
        timestamp: action.timestamp,
        actor: action.actor,
        reason: action.reason,
        valid,
        issues: issues.length > 0 ? issues : undefined,
      };
    });

    // Check for missing entries
    const missingEntries: string[] = [];
    const hasRequest = actions.some(a => a.action === 'request');
    const hasResponse = actions.some(a => a.action === 'approve' || a.action === 'deny');

    if (!hasRequest) {
      missingEntries.push('Initial permission request');
    }
    if (hasRequest && !hasResponse) {
      missingEntries.push('Approval or denial response');
    }

    // Detect suspicious activity
    const suspiciousActivity: Array<{
      issue: string;
      severity: 'low' | 'medium' | 'high';
      actions: Array<{ action: string; actor: string; timestamp: Date }>;
    }> = [];

    // Check for rapid-fire approvals
    const approvals = actions.filter(a => a.action === 'approve');
    if (approvals.length > 1) {
      const timeDiffs = approvals.slice(1).map((approval, i) =>
        approval.timestamp.getTime() - approvals[i].timestamp.getTime()
      );
      if (timeDiffs.some(diff => diff < 1000)) { // Less than 1 second apart
        suspiciousActivity.push({
          issue: 'Rapid consecutive approvals',
          severity: 'medium',
          actions: approvals.map(a => ({ action: a.action, actor: a.actor, timestamp: a.timestamp })),
        });
      }
    }

    // Check for self-approval
    const selfApprovals = actions.filter(a =>
      a.action === 'approve' &&
      actions.some(req => req.action === 'request' && req.actor === a.actor)
    );
    if (selfApprovals.length > 0) {
      suspiciousActivity.push({
        issue: 'Self-approval detected',
        severity: 'high',
        actions: selfApprovals.map(a => ({ action: a.action, actor: a.actor, timestamp: a.timestamp })),
      });
    }

    const isCompliant = auditTrail.every(entry => entry.valid) &&
                       missingEntries.length === 0 &&
                       suspiciousActivity.filter(s => s.severity === 'high').length === 0;

    return {
      auditTrail,
      isCompliant,
      missingEntries,
      suspiciousActivity,
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