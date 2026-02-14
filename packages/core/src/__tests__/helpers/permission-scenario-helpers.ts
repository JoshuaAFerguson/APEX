/**
 * @fileoverview Permission Scenario Test Helpers - Utilities for testing permission boundary conditions and scenarios in APEX
 *
 * This module provides specialized test helpers for simulating different permission scenarios,
 * including edge cases, boundary conditions, and complex permission state combinations. It
 * complements the existing permission-test-helpers with more focused scenario testing.
 *
 * @example
 * ```typescript
 * import { PermissionScenarioHelpers } from './permission-scenario-helpers';
 *
 * const scenarios = new PermissionScenarioHelpers();
 *
 * // Create a permission boundary test scenario
 * const boundaryTest = scenarios.createPermissionBoundaryScenario('Write', '/src/**');
 *
 * // Simulate a permission denial with escalation path
 * const denialScenario = scenarios.simulatePermissionDenialScenario('Bash', {
 *   initialDenial: true,
 *   escalationPath: ['supervisor', 'admin'],
 *   finalOutcome: 'approved'
 * });
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
  ToolCategory,
  ToolPermission,
  PermissionDetails,
  PermissionChangeEvent,
  PermissionChangeType,
} from '../../types.js';

/**
 * Configuration for permission boundary testing scenarios
 */
export interface PermissionBoundaryConfig {
  /** Tool name to test */
  tool: string;
  /** Base scope for the permission */
  baseScope: string;
  /** Test cases with different scopes to check boundaries */
  testCases: Array<{
    scope: string;
    expectedAllowed: boolean;
    description: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  /** Whether to include wildcard pattern testing */
  includeWildcardTests?: boolean;
  /** Whether to include nested scope testing */
  includeNestedScopeTests?: boolean;
}

/**
 * Configuration for permission denial simulation scenarios
 */
export interface PermissionDenialScenarioConfig {
  /** Tool name being denied */
  tool: string;
  /** Optional scope for the denial */
  scope?: string;
  /** Whether the denial is initial or after some checks */
  initialDenial: boolean;
  /** Escalation path for denial handling */
  escalationPath?: Array<'supervisor' | 'admin' | 'security-team' | 'custom'>;
  /** Final outcome after escalation process */
  finalOutcome: 'approved' | 'denied' | 'timeout' | 'escalated-further';
  /** Reason for the denial */
  denialReason?: string;
  /** Time taken for escalation process (in milliseconds) */
  escalationTimeMs?: number;
  /** Whether audit trail should be generated */
  generateAuditTrail?: boolean;
}

/**
 * Configuration for permission grant simulation scenarios
 */
export interface PermissionGrantScenarioConfig {
  /** Tool name being granted */
  tool: string;
  /** Optional scope for the grant */
  scope?: string;
  /** Permission level being granted */
  level: PermissionLevel;
  /** Whether grant is immediate or requires approval */
  requiresApproval: boolean;
  /** Time-based expiration for the permission */
  expirationMs?: number;
  /** Context for why permission is being granted */
  grantContext?: {
    taskId?: string;
    agentName?: string;
    reason?: string;
    riskAssessment?: {
      level: 'low' | 'medium' | 'high' | 'critical';
      factors: string[];
      mitigations: string[];
    };
  };
  /** Whether to generate audit events */
  generateAuditEvents?: boolean;
}

/**
 * Configuration for tool permission mocking scenarios
 */
export interface ToolPermissionMockConfig {
  /** Tool name to mock */
  tool: string;
  /** Default permission level for the tool */
  defaultLevel: PermissionLevel;
  /** Scope-specific permission overrides */
  scopeOverrides?: Record<string, PermissionLevel>;
  /** File access patterns and their permissions */
  fileAccessPatterns?: Array<{
    pattern: string;
    level: PermissionLevel;
    description: string;
  }>;
  /** Agent capability restrictions */
  agentCapabilities?: Record<string, {
    allowed: boolean;
    level?: PermissionLevel;
    restrictions?: string[];
  }>;
  /** Mock behavior for permission checks */
  mockBehavior?: {
    delayMs?: number;
    errorRate?: number;
    timeoutRate?: number;
  };
}

/**
 * Results from permission boundary testing
 */
export interface PermissionBoundaryResult {
  /** Original test configuration */
  config: PermissionBoundaryConfig;
  /** Results for each test case */
  testResults: Array<{
    testCase: {
      scope: string;
      expectedAllowed: boolean;
      description: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    };
    actualResult: ToolPermissionResult;
    matches: boolean;
    details: {
      scopeMatched: boolean;
      wildcardMatched: boolean;
      nestedScopeMatched: boolean;
    };
  }>;
  /** Summary statistics */
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    boundaryViolations: number;
  };
  /** Detected boundary issues */
  boundaryIssues: Array<{
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedScopes: string[];
    recommendation: string;
  }>;
}

/**
 * Results from permission denial simulation
 */
export interface PermissionDenialResult {
  /** Original configuration */
  config: PermissionDenialScenarioConfig;
  /** Initial denial result */
  initialDenial: ToolPermissionResult;
  /** Escalation steps and their outcomes */
  escalationSteps: Array<{
    level: string;
    approved: boolean;
    timeMs: number;
    reason: string;
    approver?: string;
    additionalRequirements?: string[];
  }>;
  /** Final outcome */
  finalDecision: {
    outcome: 'approved' | 'denied' | 'timeout' | 'escalated-further';
    finalApprover?: string;
    totalTimeMs: number;
    finalReason: string;
  };
  /** Generated audit trail if requested */
  auditTrail?: Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details: Record<string, unknown>;
  }>;
}

/**
 * Results from permission grant simulation
 */
export interface PermissionGrantResult {
  /** Original configuration */
  config: PermissionGrantScenarioConfig;
  /** Grant approval result */
  grantResult: ToolPermissionResult;
  /** Created permission object */
  permission: Permission | ExtendedPermission;
  /** Approval workflow if required */
  approvalWorkflow?: {
    required: boolean;
    steps: Array<{
      gate: string;
      approver: string;
      approved: boolean;
      timeMs: number;
    }>;
    totalApprovalTimeMs: number;
  };
  /** Generated audit events if requested */
  auditEvents?: Array<PermissionChangeEvent>;
  /** Risk assessment results */
  riskAssessment?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: string[];
    mitigations: string[];
    recommendation: 'grant' | 'deny' | 'escalate' | 'grant-with-conditions';
  };
}

/**
 * Permission scenario test helpers for complex testing scenarios
 */
export class PermissionScenarioHelpers {
  private mockPermissions: Map<string, Permission> = new Map();
  private mockResults: Map<string, ToolPermissionResult> = new Map();
  private auditTrail: Array<{ timestamp: Date; action: string; actor: string; details: Record<string, unknown> }> = [];

  /**
   * Create a comprehensive permission boundary testing scenario
   * Tests various scope patterns to ensure permissions work correctly at boundaries
   */
  createPermissionBoundaryScenario(
    tool: string,
    baseScope: string,
    options?: Partial<PermissionBoundaryConfig>
  ): PermissionBoundaryResult {
    const config: PermissionBoundaryConfig = {
      tool,
      baseScope,
      includeWildcardTests: true,
      includeNestedScopeTests: true,
      testCases: [
        // Basic boundary cases
        { scope: baseScope, expectedAllowed: true, description: 'Exact scope match' },
        { scope: baseScope + '/subfolder', expectedAllowed: true, description: 'Nested subfolder' },
        { scope: '/outside' + baseScope, expectedAllowed: false, description: 'Outside scope' },
        { scope: baseScope.slice(0, -1), expectedAllowed: false, description: 'Partial scope match' },

        // Wildcard cases (if enabled)
        ...(options?.includeWildcardTests ? [
          { scope: baseScope.replace('**', 'specific'), expectedAllowed: true, description: 'Wildcard expansion' },
          { scope: baseScope + '/*', expectedAllowed: true, description: 'Single level wildcard' },
          { scope: baseScope + '/**/*', expectedAllowed: true, description: 'Recursive wildcard' },
        ] : []),

        // Nested scope cases (if enabled)
        ...(options?.includeNestedScopeTests ? [
          { scope: baseScope + '/a/b/c/d/e', expectedAllowed: true, description: 'Deep nested path' },
          { scope: baseScope + '/../../escape', expectedAllowed: false, description: 'Path traversal attempt' },
          { scope: baseScope + '/symlink/../target', expectedAllowed: false, description: 'Symlink traversal', riskLevel: 'high' },
        ] : []),

        // Edge cases
        { scope: '', expectedAllowed: false, description: 'Empty scope' },
        { scope: '/', expectedAllowed: false, description: 'Root scope', riskLevel: 'critical' },
        { scope: baseScope + '/node_modules', expectedAllowed: true, description: 'Common directory' },
        { scope: baseScope + '/.env', expectedAllowed: false, description: 'Sensitive file', riskLevel: 'high' },
      ],
      ...options,
    };

    // Run the boundary tests
    const testResults = config.testCases.map(testCase => {
      const actualResult = this.simulatePermissionCheck(tool, testCase.scope);
      const matches = actualResult.allowed === testCase.expectedAllowed;

      return {
        testCase,
        actualResult,
        matches,
        details: {
          scopeMatched: this.checkScopeMatch(baseScope, testCase.scope),
          wildcardMatched: this.checkWildcardMatch(baseScope, testCase.scope),
          nestedScopeMatched: testCase.scope.startsWith(baseScope),
        },
      };
    });

    // Calculate summary statistics
    const totalTests = testResults.length;
    const passed = testResults.filter(r => r.matches).length;
    const failed = totalTests - passed;
    const successRate = (passed / totalTests) * 100;
    const boundaryViolations = testResults.filter(r => !r.matches && r.testCase.riskLevel).length;

    // Detect boundary issues
    const boundaryIssues = testResults
      .filter(r => !r.matches)
      .map(r => ({
        issue: `Permission boundary violation: ${r.testCase.description}`,
        severity: (r.testCase.riskLevel as 'low' | 'medium' | 'high' | 'critical') || 'medium',
        affectedScopes: [r.testCase.scope],
        recommendation: r.testCase.expectedAllowed
          ? `Grant permission to ${r.testCase.scope}`
          : `Ensure permission is properly denied for ${r.testCase.scope}`,
      }));

    return {
      config,
      testResults,
      summary: {
        totalTests,
        passed,
        failed,
        successRate,
        boundaryViolations,
      },
      boundaryIssues,
    };
  }

  /**
   * Simulate a permission denial scenario with escalation workflow
   */
  simulatePermissionDenialScenario(
    tool: string,
    config: PermissionDenialScenarioConfig
  ): PermissionDenialResult {
    // Initial denial
    const initialDenial: ToolPermissionResult = {
      allowed: false,
      level: 'deny',
      requiresConfirmation: config.initialDenial,
      denialReason: config.denialReason || `Permission denied for ${tool}`,
    };

    if (config.generateAuditTrail) {
      this.addToAuditTrail('permission-denial', 'system', {
        tool,
        scope: config.scope,
        reason: initialDenial.denialReason || 'Permission denied',
      });
    }

    // Escalation process
    const escalationSteps: Array<{
      level: string;
      approved: boolean;
      timeMs: number;
      reason: string;
      approver?: string;
      additionalRequirements?: string[];
    }> = [];

    if (config.escalationPath) {
      for (const escalationLevel of config.escalationPath) {
        const stepTimeMs = this.simulateEscalationTime(escalationLevel);
        const approved = this.simulateEscalationDecision(escalationLevel, config.finalOutcome);
        const approver = `${escalationLevel}-user@example.com`;
        const reason = approved
          ? `Approved by ${escalationLevel} after review`
          : `Denied by ${escalationLevel} - insufficient justification`;

        escalationSteps.push({
          level: escalationLevel,
          approved,
          timeMs: stepTimeMs,
          reason,
          approver,
          additionalRequirements: escalationLevel === 'security-team' ? ['Risk assessment', 'Backup plan'] : [],
        });

        if (config.generateAuditTrail) {
          this.addToAuditTrail(`escalation-${approved ? 'approved' : 'denied'}`, approver, {
            escalationLevel,
            tool,
            scope: config.scope,
            reason,
          });
        }

        // If approved at this level and final outcome allows it, stop escalation
        if (approved && config.finalOutcome === 'approved') {
          break;
        }
      }
    }

    // Calculate final decision
    const totalTimeMs = escalationSteps.reduce((total, step) => total + step.timeMs, 0);
    const lastApproval = escalationSteps.reverse().find(step => step.approved);
    const finalApprover = lastApproval?.approver || 'system';

    let finalReason: string;
    switch (config.finalOutcome) {
      case 'approved':
        finalReason = lastApproval?.reason || 'Approved through escalation process';
        break;
      case 'denied':
        finalReason = 'All escalation levels denied the request';
        break;
      case 'timeout':
        finalReason = 'Request timed out during escalation process';
        break;
      case 'escalated-further':
        finalReason = 'Escalated beyond available approval levels';
        break;
    }

    return {
      config,
      initialDenial,
      escalationSteps: escalationSteps.reverse(), // Restore original order
      finalDecision: {
        outcome: config.finalOutcome,
        finalApprover,
        totalTimeMs,
        finalReason,
      },
      auditTrail: config.generateAuditTrail ? [...this.auditTrail] : undefined,
    };
  }

  /**
   * Simulate a permission grant scenario with approval workflow
   */
  simulatePermissionGrantScenario(
    tool: string,
    config: PermissionGrantScenarioConfig
  ): PermissionGrantResult {
    // Risk assessment
    const riskAssessment = this.performRiskAssessment(tool, config);

    // Grant result
    const grantResult: ToolPermissionResult = {
      allowed: true,
      level: config.level,
      requiresConfirmation: config.requiresApproval,
    };

    // Create permission object
    const now = new Date();
    const permission: ExtendedPermission = {
      tool,
      level: config.level,
      scope: config.scope,
      createdAt: now,
      expiry: config.expirationMs ? new Date(now.getTime() + config.expirationMs) : undefined,
      grantedBy: config.grantContext?.agentName || 'test-system',
      grantReason: config.grantContext?.reason || `Granted for testing purposes`,
      context: {
        taskId: config.grantContext?.taskId,
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
      },
      usageCount: 0,
      lastUsed: undefined,
      tags: ['test', 'scenario'],
    };

    // Approval workflow simulation
    let approvalWorkflow: PermissionGrantResult['approvalWorkflow'];
    if (config.requiresApproval) {
      approvalWorkflow = {
        required: true,
        steps: [
          {
            gate: 'permission-review',
            approver: 'security-team@example.com',
            approved: true,
            timeMs: 30000, // 30 seconds
          },
        ],
        totalApprovalTimeMs: 30000,
      };
    }

    // Generate audit events
    let auditEvents: Array<PermissionChangeEvent> | undefined;
    if (config.generateAuditEvents) {
      auditEvents = [
        {
          changeType: 'granted',
          permission: {
            category: this.getToolCategory(tool),
            permission: this.getToolPermission(tool),
            previousLevel: null,
            newLevel: config.level,
            reason: config.grantContext?.reason || 'Permission granted for testing',
            agentName: config.grantContext?.agentName || 'test-agent',
            taskId: config.grantContext?.taskId || 'test-task',
          },
          timestamp: now,
          message: `${tool} permission granted with level ${config.level}`,
          metadata: {
            source: 'test-scenario',
            riskAssessment: riskAssessment,
            autoGranted: !config.requiresApproval,
          },
        },
      ];
    }

    return {
      config,
      grantResult,
      permission,
      approvalWorkflow,
      auditEvents,
      riskAssessment,
    };
  }

  /**
   * Create mock permission states for comprehensive tool testing
   */
  createToolPermissionMock(config: ToolPermissionMockConfig): {
    mockManager: MockToolPermissionManager;
    testScenarios: Array<{
      name: string;
      testCase: () => ToolPermissionResult;
      expectedResult: Partial<ToolPermissionResult>;
    }>;
  } {
    const mockManager = new MockToolPermissionManager(config);

    const testScenarios = [
      {
        name: 'default-permission-check',
        testCase: () => mockManager.checkPermission(config.tool),
        expectedResult: { allowed: config.defaultLevel !== 'deny', level: config.defaultLevel },
      },
      {
        name: 'scoped-permission-check',
        testCase: () => mockManager.checkPermission(config.tool, { scope: '/test/scope' }),
        expectedResult: {
          allowed: this.getScopePermissionLevel('/test/scope', config) !== 'deny',
          level: this.getScopePermissionLevel('/test/scope', config),
        },
      },
      {
        name: 'file-access-pattern-check',
        testCase: () => mockManager.checkFileAccess('/test/file.ts'),
        expectedResult: {
          allowed: this.getFileAccessLevel('/test/file.ts', config) !== 'deny',
        },
      },
      {
        name: 'agent-capability-check',
        testCase: () => mockManager.checkAgentCapability('read-files'),
        expectedResult: {
          allowed: config.agentCapabilities?.['read-files']?.allowed ?? true,
        },
      },
      ...(config.mockBehavior?.delayMs ? [{
        name: 'delayed-permission-check',
        testCase: () => mockManager.checkPermissionWithDelay(config.tool, config.mockBehavior!.delayMs!),
        expectedResult: { allowed: config.defaultLevel !== 'deny' },
      }] : []),
      ...(config.mockBehavior?.errorRate && config.mockBehavior.errorRate > 0 ? [{
        name: 'error-simulation-check',
        testCase: () => mockManager.checkPermissionWithError(config.tool, config.mockBehavior!.errorRate!),
        expectedResult: { allowed: false, denialReason: 'Simulated error' },
      }] : []),
    ];

    return {
      mockManager,
      testScenarios,
    };
  }

  /**
   * Test permission boundary conditions with comprehensive edge case coverage
   */
  testPermissionBoundaryConditions(
    tool: string,
    basePermissions: Array<{ scope: string; level: PermissionLevel }>
  ): {
    boundaryTests: Array<{
      testName: string;
      scope: string;
      expected: ToolPermissionResult;
      actual: ToolPermissionResult;
      passed: boolean;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    }>;
    edgeCaseResults: {
      pathTraversalProtection: boolean;
      wildcardExpansionSafe: boolean;
      nestedScopeHandling: boolean;
      emptyStringHandling: boolean;
      specialCharacterHandling: boolean;
    };
    securityIssues: Array<{
      issue: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      testCase: string;
      recommendation: string;
    }>;
  } {
    const boundaryTestCases = [
      // Basic boundary cases
      { testName: 'exact-match', scope: basePermissions[0]?.scope || '/test', expected: { allowed: true }, riskLevel: 'low' as const },
      { testName: 'case-sensitivity', scope: (basePermissions[0]?.scope || '/test').toUpperCase(), expected: { allowed: false }, riskLevel: 'medium' as const },

      // Path traversal tests
      { testName: 'path-traversal-dots', scope: '/test/../../../etc/passwd', expected: { allowed: false }, riskLevel: 'critical' as const },
      { testName: 'path-traversal-encoded', scope: '/test/%2E%2E/%2E%2E/etc/passwd', expected: { allowed: false }, riskLevel: 'critical' as const },
      { testName: 'symlink-traversal', scope: '/test/symlink/../sensitive', expected: { allowed: false }, riskLevel: 'high' as const },

      // Wildcard expansion tests
      { testName: 'wildcard-normal', scope: '/test/*.ts', expected: { allowed: true }, riskLevel: 'low' as const },
      { testName: 'wildcard-recursive', scope: '/test/**/*.ts', expected: { allowed: true }, riskLevel: 'low' as const },
      { testName: 'wildcard-escape', scope: '/test/*/../../../etc', expected: { allowed: false }, riskLevel: 'critical' as const },

      // Special character tests
      { testName: 'unicode-normalization', scope: '/test/café.ts', expected: { allowed: true }, riskLevel: 'medium' as const },
      { testName: 'null-bytes', scope: '/test/file.ts\0.hidden', expected: { allowed: false }, riskLevel: 'high' as const },
      { testName: 'control-characters', scope: '/test/file\r\n.ts', expected: { allowed: false }, riskLevel: 'high' as const },

      // Edge cases
      { testName: 'empty-string', scope: '', expected: { allowed: false }, riskLevel: 'medium' as const },
      { testName: 'very-long-path', scope: '/test/' + 'a'.repeat(1000), expected: { allowed: false }, riskLevel: 'medium' as const },
      { testName: 'root-access', scope: '/', expected: { allowed: false }, riskLevel: 'critical' as const },
    ];

    const boundaryTests = boundaryTestCases.map(testCase => {
      const actual = this.simulatePermissionCheck(tool, testCase.scope);
      const expected = {
        allowed: testCase.expected.allowed,
        level: testCase.expected.allowed ? 'allow-always' as const : 'deny' as const,
        requiresConfirmation: false,
        denialReason: testCase.expected.allowed ? undefined : 'Denied',
      };

      const passed = actual.allowed === expected.allowed;

      return {
        testName: testCase.testName,
        scope: testCase.scope,
        expected,
        actual,
        passed,
        riskLevel: testCase.riskLevel,
      };
    });

    // Analyze edge case handling
    const edgeCaseResults = {
      pathTraversalProtection: boundaryTests
        .filter(t => t.testName.includes('path-traversal'))
        .every(t => t.passed),
      wildcardExpansionSafe: boundaryTests
        .filter(t => t.testName.includes('wildcard'))
        .every(t => t.passed),
      nestedScopeHandling: boundaryTests
        .filter(t => t.scope.includes('/'))
        .every(t => t.passed),
      emptyStringHandling: boundaryTests
        .filter(t => t.testName === 'empty-string')
        .every(t => t.passed),
      specialCharacterHandling: boundaryTests
        .filter(t => t.testName.includes('unicode') || t.testName.includes('null') || t.testName.includes('control'))
        .every(t => t.passed),
    };

    // Identify security issues
    const securityIssues = boundaryTests
      .filter(t => !t.passed && (t.riskLevel === 'high' || t.riskLevel === 'critical'))
      .map(t => ({
        issue: `Security boundary violation in ${t.testName}`,
        severity: t.riskLevel,
        testCase: t.scope,
        recommendation: t.riskLevel === 'critical'
          ? 'Immediately implement path traversal protection'
          : 'Review and strengthen permission boundary checks',
      }));

    return {
      boundaryTests,
      edgeCaseResults,
      securityIssues,
    };
  }

  /**
   * Create comprehensive permission state combinations for stress testing
   */
  createPermissionStateCombinations(): Array<{
    scenarioName: string;
    permissions: Array<Permission>;
    expectedConflicts: Array<{
      tools: string[];
      conflictType: 'level-conflict' | 'scope-overlap' | 'expiry-mismatch';
      resolution: PermissionLevel;
    }>;
    testCases: Array<{
      tool: string;
      scope?: string;
      expectedResult: ToolPermissionResult;
    }>;
  }> {
    return [
      // Scenario 1: Conflicting permission levels
      {
        scenarioName: 'conflicting-permission-levels',
        permissions: [
          { tool: 'Write', level: 'allow-always', scope: '/src/**', createdAt: new Date() },
          { tool: 'Write', level: 'deny', scope: '/src/sensitive/**', createdAt: new Date() },
        ],
        expectedConflicts: [{
          tools: ['Write'],
          conflictType: 'level-conflict',
          resolution: 'deny', // Most restrictive wins
        }],
        testCases: [
          { tool: 'Write', scope: '/src/app.ts', expectedResult: { allowed: true, level: 'allow-always' } },
          { tool: 'Write', scope: '/src/sensitive/secret.ts', expectedResult: { allowed: false, level: 'deny' } },
        ],
      },

      // Scenario 2: Scope overlap with different expiries
      {
        scenarioName: 'scope-overlap-different-expiries',
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: '/docs/**', createdAt: new Date() },
          { tool: 'Read', level: 'allow-once', scope: '/docs/api/**', createdAt: new Date(), expiry: new Date(Date.now() + 3600000) },
        ],
        expectedConflicts: [{
          tools: ['Read'],
          conflictType: 'scope-overlap',
          resolution: 'allow-once', // More specific scope wins
        }],
        testCases: [
          { tool: 'Read', scope: '/docs/readme.md', expectedResult: { allowed: true, level: 'allow-always' } },
          { tool: 'Read', scope: '/docs/api/endpoints.md', expectedResult: { allowed: true, level: 'allow-once' } },
        ],
      },

      // Scenario 3: Multiple tools with complex interactions
      {
        scenarioName: 'multi-tool-complex-interactions',
        permissions: [
          { tool: 'Read', level: 'allow-always', scope: '/**', createdAt: new Date() },
          { tool: 'Write', level: 'allow-once', scope: '/tmp/**', createdAt: new Date() },
          { tool: 'Bash', level: 'deny', scope: undefined, createdAt: new Date() },
          { tool: 'Git', level: 'allow-always', scope: 'status|diff', createdAt: new Date() },
        ],
        expectedConflicts: [],
        testCases: [
          { tool: 'Read', scope: '/any/file.ts', expectedResult: { allowed: true, level: 'allow-always' } },
          { tool: 'Write', scope: '/tmp/output.log', expectedResult: { allowed: true, level: 'allow-once' } },
          { tool: 'Write', scope: '/src/app.ts', expectedResult: { allowed: false, level: null } },
          { tool: 'Bash', expectedResult: { allowed: false, level: 'deny' } },
          { tool: 'Git', scope: 'status', expectedResult: { allowed: true, level: 'allow-always' } },
          { tool: 'Git', scope: 'push', expectedResult: { allowed: false, level: null } },
        ],
      },

      // Scenario 4: Time-based permission expiry stress test
      {
        scenarioName: 'time-based-expiry-stress',
        permissions: [
          { tool: 'API', level: 'allow-always', scope: 'api.example.com', createdAt: new Date(), expiry: new Date(Date.now() - 1000) }, // Expired
          { tool: 'API', level: 'allow-once', scope: 'api.example.com', createdAt: new Date(), expiry: new Date(Date.now() + 1000) }, // Valid
          { tool: 'API', level: 'deny', scope: 'api.malicious.com', createdAt: new Date() }, // No expiry
        ],
        expectedConflicts: [{
          tools: ['API'],
          conflictType: 'expiry-mismatch',
          resolution: 'allow-once', // Valid permission wins
        }],
        testCases: [
          { tool: 'API', scope: 'api.example.com', expectedResult: { allowed: true, level: 'allow-once' } },
          { tool: 'API', scope: 'api.malicious.com', expectedResult: { allowed: false, level: 'deny' } },
          { tool: 'API', scope: 'api.unknown.com', expectedResult: { allowed: false, level: null } },
        ],
      },
    ];
  }

  // Private helper methods

  private simulatePermissionCheck(tool: string, scope?: string): ToolPermissionResult {
    const key = `${tool}:${scope || '*'}`;

    // Check if we have a predefined result
    if (this.mockResults.has(key)) {
      return this.mockResults.get(key)!;
    }

    // Default simulation logic
    const isSecurePath = scope?.includes('sensitive') || scope?.includes('etc') || scope?.includes('.env');
    const isPathTraversal = scope?.includes('..') || scope?.includes('\0');

    if (isPathTraversal || isSecurePath) {
      return {
        allowed: false,
        level: 'deny',
        requiresConfirmation: false,
        denialReason: isPathTraversal ? 'Path traversal detected' : 'Access to sensitive path denied',
      };
    }

    return {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    };
  }

  private checkScopeMatch(baseScope: string, testScope: string): boolean {
    return testScope === baseScope || testScope.startsWith(baseScope + '/');
  }

  private checkWildcardMatch(pattern: string, testPath: string): boolean {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(testPath);
  }

  private simulateEscalationTime(level: string): number {
    const baseTimes = {
      supervisor: 30000,    // 30 seconds
      admin: 60000,         // 1 minute
      'security-team': 120000, // 2 minutes
      custom: 45000,        // 45 seconds
    };

    const baseTime = baseTimes[level as keyof typeof baseTimes] || 60000;
    // Add some randomness (±20%)
    return baseTime + (Math.random() - 0.5) * baseTime * 0.4;
  }

  private simulateEscalationDecision(level: string, finalOutcome: string): boolean {
    // Simulate decision based on level and desired outcome
    if (finalOutcome === 'denied') return false;
    if (finalOutcome === 'approved') return Math.random() > 0.2; // 80% chance at each level
    if (finalOutcome === 'timeout') return Math.random() > 0.8; // 20% chance of approval before timeout
    return Math.random() > 0.5; // 50% chance for other outcomes
  }

  private performRiskAssessment(tool: string, config: PermissionGrantScenarioConfig): {
    level: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: string[];
    mitigations: string[];
    recommendation: 'grant' | 'deny' | 'escalate' | 'grant-with-conditions';
  } {
    const factors: string[] = [];
    let score = 20; // Base score

    // Tool-specific risk factors
    if (['Bash', 'Shell'].includes(tool)) {
      score += 30;
      factors.push('Shell access');
    }
    if (['Write', 'Edit'].includes(tool)) {
      score += 20;
      factors.push('File modification capability');
    }

    // Scope-specific risk factors
    if (config.scope?.includes('etc') || config.scope?.includes('system')) {
      score += 40;
      factors.push('System directory access');
    }
    if (config.scope?.includes('sensitive') || config.scope?.includes('secret')) {
      score += 35;
      factors.push('Sensitive file access');
    }

    // Context-specific risk factors
    if (config.grantContext?.riskAssessment) {
      const contextRisk = config.grantContext.riskAssessment.level;
      const riskScores = { low: 10, medium: 25, high: 40, critical: 60 };
      score += riskScores[contextRisk];
      factors.push(`Context risk level: ${contextRisk}`);
    }

    // Determine level and recommendation
    let level: 'low' | 'medium' | 'high' | 'critical';
    let recommendation: 'grant' | 'deny' | 'escalate' | 'grant-with-conditions';

    if (score >= 80) {
      level = 'critical';
      recommendation = 'deny';
    } else if (score >= 60) {
      level = 'high';
      recommendation = 'escalate';
    } else if (score >= 40) {
      level = 'medium';
      recommendation = 'grant-with-conditions';
    } else {
      level = 'low';
      recommendation = 'grant';
    }

    // Generate mitigations
    const mitigations = [
      ...(score >= 40 ? ['Require approval'] : []),
      ...(factors.includes('Shell access') ? ['Restrict command execution'] : []),
      ...(factors.includes('System directory access') ? ['Audit all operations'] : []),
      ...(config.expirationMs ? [] : ['Set expiration time']),
    ];

    return { level, score: Math.min(score, 100), factors, mitigations, recommendation };
  }

  private addToAuditTrail(action: string, actor: string, details: Record<string, unknown>): void {
    this.auditTrail.push({
      timestamp: new Date(),
      action,
      actor,
      details,
    });
  }

  private getToolCategory(tool: string): ToolCategory {
    const categoryMap: Record<string, ToolCategory> = {
      Read: 'filesystem',
      Write: 'filesystem',
      Edit: 'filesystem',
      Bash: 'execution',
      Shell: 'execution',
      Git: 'version-control',
      API: 'network',
      WebFetch: 'network',
    };
    return categoryMap[tool] || 'other';
  }

  private getToolPermission(tool: string): ToolPermission {
    const permissionMap: Record<string, ToolPermission> = {
      Read: 'read',
      Write: 'write',
      Edit: 'write',
      Bash: 'execute',
      Shell: 'execute',
      Git: 'version-control',
      API: 'network-access',
      WebFetch: 'network-access',
    };
    return permissionMap[tool] || 'other';
  }

  private getScopePermissionLevel(scope: string, config: ToolPermissionMockConfig): PermissionLevel {
    if (config.scopeOverrides && config.scopeOverrides[scope]) {
      return config.scopeOverrides[scope];
    }
    return config.defaultLevel;
  }

  private getFileAccessLevel(filePath: string, config: ToolPermissionMockConfig): PermissionLevel {
    if (config.fileAccessPatterns) {
      for (const pattern of config.fileAccessPatterns) {
        const regex = new RegExp(pattern.pattern);
        if (regex.test(filePath)) {
          return pattern.level;
        }
      }
    }
    return config.defaultLevel;
  }

  /**
   * Configure a specific permission check result for testing
   */
  configurePermissionResult(tool: string, scope: string | undefined, result: ToolPermissionResult): void {
    const key = `${tool}:${scope || '*'}`;
    this.mockResults.set(key, result);
  }

  /**
   * Reset all mock state for clean testing
   */
  reset(): void {
    this.mockPermissions.clear();
    this.mockResults.clear();
    this.auditTrail.length = 0;
  }
}

/**
 * Mock tool permission manager for testing specific tool configurations
 */
class MockToolPermissionManager {
  constructor(private config: ToolPermissionMockConfig) {}

  checkPermission(tool: string, options?: ToolPermissionCheckOptions): ToolPermissionResult {
    const scope = options?.scope;

    // Simulate mock behavior
    if (this.config.mockBehavior?.errorRate && Math.random() < this.config.mockBehavior.errorRate) {
      return {
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Simulated error',
      };
    }

    // Check scope-specific overrides
    if (scope && this.config.scopeOverrides?.[scope]) {
      const level = this.config.scopeOverrides[scope];
      return {
        allowed: level !== 'deny',
        level,
        requiresConfirmation: level === null,
        denialReason: level === 'deny' ? 'Scope-specific denial' : undefined,
      };
    }

    // Return default level
    return {
      allowed: this.config.defaultLevel !== 'deny',
      level: this.config.defaultLevel,
      requiresConfirmation: this.config.defaultLevel === null,
      denialReason: this.config.defaultLevel === 'deny' ? 'Default permission level denial' : undefined,
    };
  }

  checkFileAccess(filePath: string): ToolPermissionResult {
    if (this.config.fileAccessPatterns) {
      for (const pattern of this.config.fileAccessPatterns) {
        const regex = new RegExp(pattern.pattern);
        if (regex.test(filePath)) {
          return {
            allowed: pattern.level !== 'deny',
            level: pattern.level,
            requiresConfirmation: false,
            denialReason: pattern.level === 'deny' ? pattern.description : undefined,
          };
        }
      }
    }

    // Default file access
    return this.checkPermission(this.config.tool, { scope: filePath });
  }

  checkAgentCapability(capability: string): ToolPermissionResult {
    const capabilityConfig = this.config.agentCapabilities?.[capability];

    if (capabilityConfig) {
      return {
        allowed: capabilityConfig.allowed,
        level: capabilityConfig.level || (capabilityConfig.allowed ? 'allow-always' : 'deny'),
        requiresConfirmation: false,
        denialReason: capabilityConfig.allowed ? undefined : 'Agent capability disabled',
      };
    }

    // Default: allow capability
    return {
      allowed: true,
      level: 'allow-always',
      requiresConfirmation: false,
    };
  }

  async checkPermissionWithDelay(tool: string, delayMs: number): Promise<ToolPermissionResult> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return this.checkPermission(tool);
  }

  checkPermissionWithError(tool: string, errorRate: number): ToolPermissionResult {
    if (Math.random() < errorRate) {
      return {
        allowed: false,
        level: null,
        requiresConfirmation: false,
        denialReason: 'Simulated error occurred',
      };
    }
    return this.checkPermission(tool);
  }
}

/**
 * Pre-configured permission scenario combinations for common testing patterns
 */
export const PermissionScenarioPatterns = {
  /**
   * Secure development environment with restricted access
   */
  secureDevEnvironment: () => {
    const helpers = new PermissionScenarioHelpers();
    return helpers.createPermissionStateCombinations()[0]; // Use first scenario as template
  },

  /**
   * High-trust environment with minimal restrictions
   */
  highTrustEnvironment: () => {
    const helpers = new PermissionScenarioHelpers();
    return {
      scenarioName: 'high-trust-environment',
      permissions: [
        { tool: 'Read', level: 'allow-always' as const, scope: '/**', createdAt: new Date() },
        { tool: 'Write', level: 'allow-always' as const, scope: '/src/**', createdAt: new Date() },
        { tool: 'Bash', level: 'allow-once' as const, scope: undefined, createdAt: new Date() },
      ],
    };
  },

  /**
   * Zero-trust environment with maximum security
   */
  zeroTrustEnvironment: () => {
    const helpers = new PermissionScenarioHelpers();
    return {
      scenarioName: 'zero-trust-environment',
      permissions: [
        { tool: 'Read', level: 'allow-once' as const, scope: '/src/**', createdAt: new Date() },
        { tool: 'Write', level: 'deny' as const, scope: undefined, createdAt: new Date() },
        { tool: 'Bash', level: 'deny' as const, scope: undefined, createdAt: new Date() },
        { tool: 'Git', level: 'allow-once' as const, scope: 'status|diff', createdAt: new Date() },
      ],
    };
  },
};

/**
 * Singleton instance for convenience
 */
export const permissionScenarioHelpers = new PermissionScenarioHelpers();