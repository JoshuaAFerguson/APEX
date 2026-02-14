/**
 * @fileoverview Advanced Permission and Autonomy Test Scenarios
 *
 * This test file demonstrates advanced usage patterns and edge cases for the
 * permission and autonomy test helpers, including complex approval workflows,
 * multi-step permission escalations, and real-world integration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PermissionTestHelpers,
  AutonomyTestHelpers,
  apexTestHelpers,
} from './helpers';
import type {
  PermissionLevel,
  AutonomyLevel,
  ApprovalCheckpointType,
  ToolPermissionResult,
} from '../types';

describe('Advanced Permission Scenarios', () => {
  let permissionHelpers: PermissionTestHelpers;

  beforeEach(() => {
    permissionHelpers = new PermissionTestHelpers();
  });

  afterEach(() => {
    permissionHelpers.reset();
  });

  describe('Permission Boundary Testing', () => {
    it('should test exact scope matching boundaries', () => {
      const testCases = [
        {
          testScope: '/project/src/file.ts',
          expectedAllowed: true,
          description: 'Exact match should be allowed',
        },
        {
          testScope: '/project/src',
          expectedAllowed: false,
          description: 'Parent directory should be denied',
        },
        {
          testScope: '/project/src/file.js',
          expectedAllowed: false,
          description: 'Different extension should be denied',
        },
        {
          testScope: '/different/path',
          expectedAllowed: false,
          description: 'Completely different path should be denied',
        },
      ];

      const results = permissionHelpers.testPermissionBoundary(
        'Write',
        '/project/src/file.ts',
        testCases
      );

      results.forEach((result, index) => {
        expect(result.matches).toBe(true);
        expect(result.result.allowed).toBe(testCases[index].expectedAllowed);
      });
    });

    it('should test wildcard pattern boundaries', () => {
      const patterns = [
        { pattern: '/tmp/*', level: 'allow-always' as PermissionLevel },
        { pattern: '/etc/*', level: 'deny' as PermissionLevel },
        { pattern: '/home/*/sensitive/*', level: 'deny' as PermissionLevel },
      ];

      const testPaths = [
        '/tmp/file.txt',           // Should be allowed
        '/tmp/subdir/file.txt',    // Should not match /tmp/* exactly
        '/etc/passwd',             // Should be denied
        '/home/user/sensitive/data', // Should be denied
        '/home/user/documents/file', // Should be allowed (no pattern match)
      ];

      const results = permissionHelpers.simulateScopedWildcardDenial('Write', patterns, testPaths);

      expect(results[0].result.allowed).toBe(true);   // /tmp/file.txt
      expect(results[0].matchedPattern).toBe('/tmp/*');

      expect(results[1].result.allowed).toBe(true);   // Default allow for no match
      expect(results[1].matchedPattern).toBeUndefined();

      expect(results[2].result.allowed).toBe(false);  // /etc/passwd
      expect(results[2].matchedPattern).toBe('/etc/*');

      expect(results[3].result.allowed).toBe(false);  // /home/user/sensitive/data
      expect(results[3].matchedPattern).toBe('/home/*/sensitive/*');

      expect(results[4].result.allowed).toBe(true);   // Default allow
    });
  });

  describe('Permission Escalation Workflows', () => {
    it('should simulate multi-level escalation with approval chain', () => {
      const escalationSteps = [
        { escalationLevel: 'supervisor' as const, autoApprove: false, timeout: 30, reason: 'Initial review' },
        { escalationLevel: 'admin' as const, autoApprove: false, timeout: 60, reason: 'Admin oversight required' },
        { escalationLevel: 'security-team' as const, autoApprove: true, timeout: 120, reason: 'Security clearance' },
      ];

      const result = permissionHelpers.simulatePermissionDenialEscalation(
        'Shell',
        'sudo rm -rf /important/data',
        escalationSteps
      );

      expect(result.initialDenial.allowed).toBe(false);
      expect(result.escalationSteps).toHaveLength(3);

      // Verify escalation chain
      expect(result.escalationSteps[0].level).toBe('supervisor');
      expect(result.escalationSteps[1].level).toBe('admin');
      expect(result.escalationSteps[2].level).toBe('security-team');

      // Security team auto-approves, so final decision should be approved
      expect(result.finalDecision).toBe('approved');
    });

    it('should test dangerous operation risk assessment', () => {
      const result = permissionHelpers.testDangerousOperationDenial(
        'rm -rf /production/database',
        'critical',
        {
          affectedFiles: Array.from({ length: 15 }, (_, i) => `/file${i}.db`),
          reversible: false,
          requiresBackup: false,
          productionSystem: true,
        }
      );

      expect(result.riskAssessment.level).toBe('critical');
      expect(result.riskAssessment.score).toBeGreaterThan(90);
      expect(result.riskAssessment.recommendation).toBe('deny');

      expect(result.riskAssessment.factors).toContain('Production system impact');
      expect(result.riskAssessment.factors).toContain('Irreversible operation');
      expect(result.riskAssessment.factors).toContain('Large number of affected files');

      expect(result.permissionResult.allowed).toBe(false);
      expect(result.permissionResult.reason).toContain('Dangerous operation blocked');
    });

    it('should test medium risk operation requiring approval', () => {
      const result = permissionHelpers.testDangerousOperationDenial(
        'modify config files',
        'medium',
        {
          affectedFiles: ['/etc/nginx.conf', '/etc/ssl/cert.pem'],
          reversible: true,
          requiresBackup: true,
          productionSystem: true,
        }
      );

      expect(result.riskAssessment.recommendation).toBe('escalate');
      expect(result.permissionResult.requiresConfirmation).toBe(true);
      expect(result.requiredApprovals).toBeDefined();
      expect(result.requiredApprovals!.some(a => a.approver === 'production-manager')).toBe(true);
    });
  });

  describe('Permission Conflict Resolution', () => {
    it('should resolve conflicting permission rules', () => {
      const conflictingRules = [
        { scope: '/project/src', level: 'allow-always' as PermissionLevel, priority: 1 },
        { scope: '/project', level: 'deny' as PermissionLevel, priority: 2 },
        { scope: '/project/src/important.ts', level: 'allow-once' as PermissionLevel, priority: 3 },
      ];

      const result = permissionHelpers.testPermissionConflicts('Write', conflictingRules);

      expect(result.conflicts).toHaveLength(2); // Two pairs of conflicting rules
      expect(result.resolution.resolutionStrategy).toBe('most-restrictive');
      expect(result.resolution.resolvedLevel).toBe('deny'); // Most restrictive wins
    });

    it('should handle contradictory permission levels', () => {
      const rules = [
        { scope: '/shared/file.txt', level: 'allow-always' as PermissionLevel },
        { scope: '/shared/file.txt', level: 'deny' as PermissionLevel },
      ];

      const result = permissionHelpers.testPermissionConflicts('Read', rules);

      expect(result.conflicts[0].conflictType).toBe('contradictory-levels');
      expect(result.resolution.resolvedLevel).toBe('deny'); // Deny wins over allow
    });
  });

  describe('Permission Audit Trail Validation', () => {
    it('should validate complete audit trail', () => {
      const auditActions = [
        { action: 'request' as const, timestamp: new Date('2024-01-01T10:00:00Z'), actor: 'user@example.com', reason: 'Need file access' },
        { action: 'approve' as const, timestamp: new Date('2024-01-01T10:05:00Z'), actor: 'admin@example.com', reason: 'Request approved' },
        { action: 'consume' as const, timestamp: new Date('2024-01-01T10:10:00Z'), actor: 'system', reason: 'Permission used' },
      ];

      const result = permissionHelpers.verifyPermissionAuditTrail('Write', '/project/file.txt', auditActions);

      expect(result.isCompliant).toBe(true);
      expect(result.missingEntries).toHaveLength(0);
      expect(result.auditTrail.every(entry => entry.valid)).toBe(true);
      expect(result.suspiciousActivity).toHaveLength(0);
    });

    it('should detect audit trail violations', () => {
      const suspiciousActions = [
        { action: 'request' as const, timestamp: new Date('2024-01-01T10:00:00Z'), actor: 'user@example.com' },
        { action: 'approve' as const, timestamp: new Date('2024-01-01T10:00:01Z'), actor: 'user@example.com' }, // Self-approval
        { action: 'approve' as const, timestamp: new Date('2024-01-01T10:00:02Z'), actor: 'admin@example.com' }, // Rapid approval
      ];

      const result = permissionHelpers.verifyPermissionAuditTrail('Shell', 'dangerous-command', suspiciousActions);

      expect(result.isCompliant).toBe(false);
      expect(result.suspiciousActivity.some(s => s.issue === 'Self-approval detected')).toBe(true);
      expect(result.suspiciousActivity.some(s => s.issue === 'Rapid consecutive approvals')).toBe(true);
    });

    it('should detect missing audit entries', () => {
      const incompleteActions = [
        { action: 'request' as const, timestamp: new Date('2024-01-01T10:00:00Z'), actor: 'user@example.com' },
        // Missing approval/denial response
      ];

      const result = permissionHelpers.verifyPermissionAuditTrail('Write', '/file.txt', incompleteActions);

      expect(result.isCompliant).toBe(false);
      expect(result.missingEntries).toContain('Approval or denial response');
    });
  });
});

describe('Advanced Autonomy Scenarios', () => {
  let autonomyHelpers: AutonomyTestHelpers;

  beforeEach(() => {
    autonomyHelpers = new AutonomyTestHelpers();
  });

  afterEach(() => {
    autonomyHelpers.reset();
  });

  describe('Sequential Approval Gates', () => {
    it('should test sequential approval flow with all gates passing', () => {
      const gates = [
        autonomyHelpers.createApprovalGate('code-review', 'Code Review', 'before-commit'),
        autonomyHelpers.createApprovalGate('security-scan', 'Security Scan', 'before-deploy'),
        autonomyHelpers.createApprovalGate('final-approval', 'Final Approval', 'before-destructive'),
      ];

      const outcomes = ['approved', 'approved', 'approved'] as const;
      const results = autonomyHelpers.simulateSequentialApprovals(gates, outcomes);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.completed)).toBe(true);
      expect(results.every(r => r.response.response === 'approved')).toBe(true);
    });

    it('should test sequential approval flow with early failure', () => {
      const gates = [
        autonomyHelpers.createApprovalGate('code-review', 'Code Review', 'before-commit'),
        autonomyHelpers.createApprovalGate('security-scan', 'Security Scan', 'before-deploy'),
        autonomyHelpers.createApprovalGate('final-approval', 'Final Approval', 'before-destructive'),
      ];

      const outcomes = ['approved', 'denied', 'approved'] as const; // Second gate fails
      const results = autonomyHelpers.simulateSequentialApprovals(gates, outcomes);

      expect(results[0].completed).toBe(true);  // First gate passes
      expect(results[1].completed).toBe(false); // Second gate fails
      expect(results[2].completed).toBe(false); // Third gate skipped due to failure
      expect(results[2].response.reason).toContain('Previous gate failed');
    });
  });

  describe('Parallel Approval Gates', () => {
    it('should test parallel approvals requiring all approvers', () => {
      const gates = [
        autonomyHelpers.createApprovalGate('tech-review', 'Technical Review', 'before-commit'),
        autonomyHelpers.createApprovalGate('security-review', 'Security Review', 'before-commit'),
        autonomyHelpers.createApprovalGate('business-review', 'Business Review', 'before-deploy'),
      ];

      const outcomes = ['approved', 'approved', 'approved'] as const;
      const result = autonomyHelpers.simulateParallelApprovals(gates, outcomes, {
        requireAllApprovals: true,
      });

      expect(result.overallResult).toBe('approved');
      expect(result.approvalCount).toBe(3);
    });

    it('should test partial parallel approvals with minimum threshold', () => {
      const gates = [
        autonomyHelpers.createApprovalGate('reviewer-1', 'Reviewer 1', 'before-commit'),
        autonomyHelpers.createApprovalGate('reviewer-2', 'Reviewer 2', 'before-commit'),
        autonomyHelpers.createApprovalGate('reviewer-3', 'Reviewer 3', 'before-commit'),
      ];

      const outcomes = ['approved', 'denied', 'approved'] as const;
      const result = autonomyHelpers.simulateParallelApprovals(gates, outcomes, {
        requireAllApprovals: false,
        minimumApprovals: 2,
      });

      expect(result.overallResult).toBe('approved');
      expect(result.approvalCount).toBe(2);
    });
  });

  describe('Approval Quorum Handling', () => {
    it('should test quorum met scenario', () => {
      const approverResponses = [
        { approver: 'alice', response: 'approve' as const, reason: 'Looks good' },
        { approver: 'bob', response: 'approve' as const, reason: 'LGTM' },
        { approver: 'carol', response: 'deny' as const, reason: 'Needs changes' },
      ];

      const result = autonomyHelpers.testApprovalQuorumHandling(2, approverResponses);

      expect(result.quorumMet).toBe(true);
      expect(result.totalApprovals).toBe(2);
      expect(result.finalDecision).toBe('approved');
    });

    it('should test quorum not reachable scenario', () => {
      const approverResponses = [
        { approver: 'alice', response: 'deny' as const },
        { approver: 'bob', response: 'deny' as const },
        { approver: 'carol', response: 'deny' as const },
      ];

      const result = autonomyHelpers.testApprovalQuorumHandling(3, approverResponses);

      expect(result.quorumMet).toBe(false);
      expect(result.totalDenials).toBe(3);
      expect(result.finalDecision).toBe('denied');
    });
  });

  describe('Resource Limit Boundary Testing', () => {
    it('should test resource usage within limits', () => {
      const limits = autonomyHelpers.createDefaultResourceLimits();
      const currentUsage = {
        maxExecutionTimeMs: 150000, // Half of limit
        maxMemoryMB: 256,           // Half of limit
        maxCpuPercent: 40,          // Half of limit
      };

      const result = autonomyHelpers.testResourceLimitBoundary(limits, currentUsage);

      expect(result.withinLimits).toBe(true);
      expect(result.exceedingLimits).toHaveLength(0);
      expect(result.recommendedAction).toBe('proceed');
    });

    it('should test resource usage exceeding limits', () => {
      const limits = autonomyHelpers.createDefaultResourceLimits();
      const currentUsage = {
        maxExecutionTimeMs: 400000, // Exceeds 300000 limit
        maxMemoryMB: 600,           // Exceeds 512 limit
        maxCpuPercent: 90,          // Exceeds 80 limit
      };

      const result = autonomyHelpers.testResourceLimitBoundary(limits, currentUsage);

      expect(result.withinLimits).toBe(false);
      expect(result.exceedingLimits).toContain('maxExecutionTimeMs');
      expect(result.exceedingLimits).toContain('maxMemoryMB');
      expect(result.exceedingLimits).toContain('maxCpuPercent');
      expect(result.recommendedAction).toBe('deny');
    });

    it('should test high utilization warning', () => {
      const limits = autonomyHelpers.createDefaultResourceLimits();
      const currentUsage = {
        maxMemoryMB: 450, // 87.9% of 512MB limit (above 80% warning threshold)
      };

      const result = autonomyHelpers.testResourceLimitBoundary(limits, currentUsage);

      expect(result.withinLimits).toBe(true);
      expect(result.recommendedAction).toBe('warn');
      expect(result.utilizationPercentage.maxMemoryMB).toBeCloseTo(87.9, 1);
    });
  });

  describe('Rejection Behavior Testing', () => {
    it('should test abort behavior with gate failure', () => {
      const result = autonomyHelpers.testRejectionBehaviorEffect('abort', {
        gatesFailed: 1,
        totalGates: 3,
        criticalGateFailed: false,
      });

      expect(result.workflowContinues).toBe(false);
      expect(result.nextAction).toBe('abort-workflow');
      expect(result.terminationReason).toContain('Approval gate failed');
    });

    it('should test skip behavior with non-critical gate failure', () => {
      const result = autonomyHelpers.testRejectionBehaviorEffect('skip', {
        gatesFailed: 2,
        totalGates: 4,
        criticalGateFailed: false,
      });

      expect(result.workflowContinues).toBe(true);
      expect(result.nextAction).toBe('skip-stage');
      expect(result.stepsSkipped).toBe(2);
    });

    it('should test skip behavior with critical gate failure', () => {
      const result = autonomyHelpers.testRejectionBehaviorEffect('skip', {
        gatesFailed: 1,
        totalGates: 2,
        criticalGateFailed: true,
      });

      expect(result.workflowContinues).toBe(false);
      expect(result.nextAction).toBe('abort-workflow');
      expect(result.terminationReason).toContain('Critical gate failed');
    });
  });

  describe('Agent Override Conflict Resolution', () => {
    it('should resolve conflicts between agent and stage overrides', () => {
      const baseConfig = autonomyHelpers.createAutonomyConfig('review-before-commit');
      const agentOverrides = {
        developer: 'full-auto' as AutonomyLevel,
        tester: 'supervised' as AutonomyLevel,
      };
      const stageOverrides = {
        implementation: 'supervised' as AutonomyLevel,
        testing: 'full-auto' as AutonomyLevel,
      };

      const result = autonomyHelpers.simulateAgentOverrideConflict(
        baseConfig,
        agentOverrides,
        stageOverrides
      );

      expect(result.conflicts).toHaveLength(2);

      // Developer agent override should take precedence over implementation stage
      const developerConflict = result.conflicts.find(c => c.agent === 'developer' && c.stage === 'implementation');
      expect(developerConflict?.resolution).toBe('full-auto');
      expect(developerConflict?.resolutionReason).toContain('Agent-specific override takes precedence');
    });
  });

  describe('Approval Retry Mechanisms', () => {
    it('should test retry sequence with eventual success', () => {
      const gate = autonomyHelpers.createApprovalGate('retry-test', 'Retry Test', 'before-commit');
      const failedAttempts = [
        { attempt: 1, failureReason: 'timeout' as const, retryDelay: 10000 },
        { attempt: 2, failureReason: 'denial' as const, retryDelay: 20000 },
        { attempt: 3, failureReason: 'insufficient-approvals' as const, retryDelay: 30000 },
      ];

      const result = autonomyHelpers.testApprovalRetry(gate, failedAttempts);

      expect(result.finalOutcome).toBe('success'); // Last attempt succeeds
      expect(result.totalRetryTime).toBe(60000); // 10s + 20s + 30s
      expect(result.retryResults[2].success).toBe(true); // Third attempt succeeds
    });

    it('should test retry sequence with escalation', () => {
      const gate = autonomyHelpers.createApprovalGate('escalation-test', 'Escalation Test', 'before-destructive');
      const failedAttempts = [
        { attempt: 1, failureReason: 'timeout' as const },
        { attempt: 2, failureReason: 'timeout' as const },
        { attempt: 3, failureReason: 'timeout' as const },
        { attempt: 4, failureReason: 'timeout' as const }, // Exceeds max retries
      ];

      const result = autonomyHelpers.testApprovalRetry(gate, failedAttempts);

      expect(result.finalOutcome).toBe('escalated');
      expect(result.retryResults[3].escalated).toBe(true);
      expect(result.retryResults[3].retryAllowed).toBe(false);
    });
  });
});

describe('Integration Testing Scenarios', () => {
  beforeEach(() => {
    apexTestHelpers.reset();
  });

  describe('Combined Permission and Autonomy Workflows', () => {
    it('should test full workflow with permission checks and autonomy gates', async () => {
      // Set up a review-before-commit scenario
      const scenario = apexTestHelpers.createIntegratedScenario('review-before-commit', 'allow-once');

      expect(scenario.autonomyConfig.level).toBe('review-before-commit');
      expect(scenario.permissionScenarios.Write.level).toBe('allow-once');

      // Simulate a workflow step requiring both permission and approval
      const permissionResult = scenario.permissionManager.checkPermission('Write', { scope: '/project/file.ts' });
      expect(permissionResult.allowed).toBe(true);
      expect(permissionResult.consumed).toBe(true); // allow-once should be consumed

      // Verify approval gate is configured
      const gates = scenario.autonomyConfig.gates || [];
      expect(gates.some(g => g.type === 'before-commit')).toBe(true);
    });

    it('should test permission escalation within autonomy boundaries', () => {
      // Create a complex scenario with multiple permission levels and autonomy constraints
      const permissionHelpers = apexTestHelpers.permission;
      const autonomyHelpers = apexTestHelpers.autonomy;

      // Set up graduated permissions
      const manager = permissionHelpers.getMockPermissionManager();
      manager.configurePermissionCheck('Read', undefined, {
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });
      manager.configurePermissionCheck('Write', '/safe', {
        allowed: true,
        level: 'allow-once',
        requiresConfirmation: true,
      });
      manager.configurePermissionCheck('Write', '/dangerous', {
        allowed: false,
        level: 'deny',
        requiresConfirmation: false,
        reason: 'Dangerous path denied',
      });

      // Test boundary conditions
      const safeWriteResult = autonomyHelpers.testAutonomyBoundary({
        autonomyLevel: 'review-before-commit',
        action: 'write-safe-file',
        shouldRequireApproval: false,
      });

      const dangerousWriteResult = autonomyHelpers.testAutonomyBoundary({
        autonomyLevel: 'review-before-commit',
        action: 'write-dangerous-file',
        shouldRequireApproval: true,
        expectedCheckpoint: 'before-commit',
      });

      expect(safeWriteResult.requiresApproval).toBe(false);
      expect(dangerousWriteResult.requiresApproval).toBe(true);
    });
  });

  describe('Real-world Simulation Scenarios', () => {
    it('should simulate a complete development workflow', async () => {
      const autonomyHelpers = apexTestHelpers.autonomy;

      // Set up a development workflow with multiple gates
      const workflowGates = [
        autonomyHelpers.createApprovalGate('lint-check', 'Lint Check', 'before-commit', { autoApprove: true }),
        autonomyHelpers.createApprovalGate('test-suite', 'Test Suite', 'before-commit', { autoApprove: true }),
        autonomyHelpers.createApprovalGate('code-review', 'Code Review', 'before-commit', { minApprovals: 1 }),
        autonomyHelpers.createApprovalGate('deployment', 'Deployment', 'before-deploy', { minApprovals: 2 }),
      ];

      // Simulate the workflow with some gates auto-approving and others requiring manual approval
      const outcomes = ['approved', 'approved', 'approved', 'approved'] as const;
      const results = autonomyHelpers.simulateSequentialApprovals(workflowGates, outcomes);

      // Verify all gates passed
      expect(results.every(r => r.completed)).toBe(true);

      // Verify timing increments (simulating real workflow delays)
      expect(results[0].response.responseTimeMs).toBeLessThan(results[3].response.responseTimeMs);
    });

    it('should simulate emergency override scenario', () => {
      const permissionHelpers = apexTestHelpers.permission;
      const autonomyHelpers = apexTestHelpers.autonomy;

      // Create a critical system scenario
      const emergencyOverride = permissionHelpers.testDangerousOperationDenial(
        'emergency-system-restart',
        'critical',
        {
          productionSystem: true,
          reversible: true,
          requiresBackup: false,
          affectedFiles: ['/system/critical-service'],
        }
      );

      expect(emergencyOverride.riskAssessment.recommendation).toBe('escalate');
      expect(emergencyOverride.requiredApprovals).toBeDefined();
      expect(emergencyOverride.requiredApprovals!.some(a => a.approver === 'production-manager')).toBe(true);

      // Test timeout behavior for emergency scenarios
      const timeoutResult = autonomyHelpers.testApprovalTimeoutWithBehavior(5, 'abort', {
        isCriticalGate: true,
        hasRetryPolicy: false,
      });

      expect(timeoutResult.workflowEffect.nextAction).toBe('abort-workflow');
      expect(timeoutResult.escalationTriggered).toBe(true);
    });
  });
});