/**
 * @fileoverview Enhanced Permission and Autonomy Test Helpers Integration Tests
 *
 * Comprehensive tests for the newly implemented permission and autonomy test helpers,
 * covering advanced scenarios including boundary conditions, approval flows, escalation,
 * and complex integration scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PermissionTestHelpers,
  AutonomyTestHelpers,
  apexTestHelpers,
} from './helpers';
import type {
  Permission,
  PermissionLevel,
  AutonomyLevel,
  ApprovalCheckpointType,
  TaskResourceLimits,
} from '../types';

describe('Enhanced Permission Test Helpers', () => {
  let helpers: PermissionTestHelpers;

  beforeEach(() => {
    helpers = new PermissionTestHelpers();
  });

  describe('Permission Boundary Testing', () => {
    it('should test permission boundary conditions with scope matching', () => {
      const testCases = [
        { testScope: '/tmp/file1.txt', expectedAllowed: true, description: 'File within allowed scope' },
        { testScope: '/tmp/subdir/file2.txt', expectedAllowed: true, description: 'File in subdirectory' },
        { testScope: '/etc/passwd', expectedAllowed: false, description: 'File outside allowed scope' },
        { testScope: '/tmp', expectedAllowed: true, description: 'Exact scope match' },
      ];

      const results = helpers.testPermissionBoundary('Write', '/tmp', testCases);

      expect(results).toHaveLength(4);

      // Verify the exact scope match works
      const exactMatch = results.find(r => r.testCase.testScope === '/tmp');
      expect(exactMatch?.result.allowed).toBe(true);

      // Verify out-of-scope is denied
      const outOfScope = results.find(r => r.testCase.testScope === '/etc/passwd');
      expect(outOfScope?.result.allowed).toBe(false);
    });

    it('should handle wildcard denial patterns correctly', () => {
      const patterns = [
        { pattern: '/tmp/*', level: 'allow-always' as PermissionLevel },
        { pattern: '/etc/*', level: 'deny' as PermissionLevel },
        { pattern: '*/secret/*', level: 'deny' as PermissionLevel },
      ];

      const testPaths = [
        '/tmp/file.txt',      // Should be allowed
        '/etc/passwd',        // Should be denied
        '/home/user/secret/key', // Should be denied by pattern
        '/home/user/normal.txt', // Should be allowed (default)
      ];

      const results = helpers.simulateScopedWildcardDenial('Write', patterns, testPaths);

      expect(results).toHaveLength(4);

      // Check /tmp is allowed
      expect(results[0].result.allowed).toBe(true);
      expect(results[0].matchedPattern).toBe('/tmp/*');

      // Check /etc is denied
      expect(results[1].result.allowed).toBe(false);
      expect(results[1].matchedPattern).toBe('/etc/*');

      // Check secret pattern is denied
      expect(results[2].result.allowed).toBe(false);
      expect(results[2].matchedPattern).toBe('*/secret/*');

      // Check default allow
      expect(results[3].result.allowed).toBe(true);
      expect(results[3].matchedPattern).toBeUndefined();
    });
  });

  describe('Permission Escalation Testing', () => {
    it('should simulate permission denial with escalation workflow', () => {
      const escalationSteps = [
        { escalationLevel: 'supervisor' as const, autoApprove: false, timeout: 30 },
        { escalationLevel: 'admin' as const, autoApprove: false, timeout: 60 },
        { escalationLevel: 'security-team' as const, autoApprove: true, timeout: 120 },
      ];

      const result = helpers.simulatePermissionDenialEscalation(
        'Shell',
        'sudo rm -rf /',
        escalationSteps
      );

      expect(result.initialDenial.allowed).toBe(false);
      expect(result.escalationSteps).toHaveLength(3);
      expect(result.finalDecision).toMatch(/approved|denied|escalated-further/);

      // Check security team auto-approval
      const securityStep = result.escalationSteps.find(step => step.level === 'security-team');
      expect(securityStep?.approved).toBe(true);
      expect(securityStep?.reason).toContain('security-team');
    });

    it('should test dangerous operation denial with risk assessment', () => {
      const context = {
        affectedFiles: Array(50).fill('/important/file').map((f, i) => `${f}${i}`),
        reversible: false,
        requiresBackup: true,
        productionSystem: true,
      };

      const result = helpers.testDangerousOperationDenial(
        'rm -rf /production/*',
        'critical',
        context
      );

      expect(result.riskAssessment.level).toBe('critical');
      expect(result.riskAssessment.score).toBeGreaterThan(90);
      expect(result.riskAssessment.recommendation).toBe('deny');
      expect(result.permissionResult.allowed).toBe(false);
      expect(result.requiredApprovals).toBeDefined();

      if (result.requiredApprovals) {
        expect(result.requiredApprovals.length).toBeGreaterThanOrEqual(2);
        expect(result.requiredApprovals.some(a => a.approver === 'security-team')).toBe(true);
      }
    });
  });

  describe('Permission Conflict Resolution', () => {
    it('should detect and resolve permission conflicts', () => {
      const conflictingRules = [
        { scope: '/tmp', level: 'allow-always' as PermissionLevel },
        { scope: '/tmp/secret', level: 'deny' as PermissionLevel },
        { scope: '/tmp', level: 'allow-once' as PermissionLevel }, // Conflicting with first rule
      ];

      const result = helpers.testPermissionConflicts('Write', conflictingRules);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.resolution.resolutionStrategy).toBe('most-restrictive');
      expect(result.resolution.resolvedLevel).toBe('deny'); // Most restrictive wins
    });
  });

  describe('Permission Audit Trail Verification', () => {
    it('should verify complete permission audit trail', () => {
      const actions = [
        { action: 'request' as const, timestamp: new Date('2024-01-01T10:00:00Z'), actor: 'user-1' },
        { action: 'approve' as const, timestamp: new Date('2024-01-01T10:05:00Z'), actor: 'supervisor', reason: 'Reviewed and approved' },
        { action: 'consume' as const, timestamp: new Date('2024-01-01T10:10:00Z'), actor: 'system' },
      ];

      const result = helpers.verifyPermissionAuditTrail('Write', '/tmp/file', actions);

      expect(result.isCompliant).toBe(true);
      expect(result.auditTrail.every(entry => entry.valid)).toBe(true);
      expect(result.missingEntries).toHaveLength(0);
      expect(result.suspiciousActivity).toHaveLength(0);
    });

    it('should detect suspicious activity in audit trail', () => {
      const suspiciousActions = [
        { action: 'request' as const, timestamp: new Date('2024-01-01T10:00:00Z'), actor: 'user-1' },
        { action: 'approve' as const, timestamp: new Date('2024-01-01T10:00:01Z'), actor: 'user-1' }, // Self-approval
        { action: 'approve' as const, timestamp: new Date('2024-01-01T10:00:02Z'), actor: 'user-2' }, // Rapid approval
      ];

      const result = helpers.verifyPermissionAuditTrail('Write', '/sensitive', suspiciousActions);

      expect(result.isCompliant).toBe(false);
      expect(result.suspiciousActivity.length).toBeGreaterThan(0);

      const selfApproval = result.suspiciousActivity.find(s => s.issue === 'Self-approval detected');
      expect(selfApproval).toBeDefined();
      expect(selfApproval?.severity).toBe('high');
    });
  });
});

describe('Enhanced Autonomy Test Helpers', () => {
  let helpers: AutonomyTestHelpers;

  beforeEach(() => {
    helpers = new AutonomyTestHelpers();
  });

  describe('Sequential Approval Testing', () => {
    it('should simulate sequential approval gates correctly', () => {
      const gates = [
        helpers.createApprovalGate('security', 'Security Review', 'before-destructive'),
        helpers.createApprovalGate('compliance', 'Compliance Check', 'custom'),
        helpers.createApprovalGate('deploy', 'Deployment Approval', 'before-deploy'),
      ];

      const outcomes: Array<'approved' | 'denied' | 'timeout'> = ['approved', 'denied', 'approved'];
      const results = helpers.simulateSequentialApprovals(gates, outcomes);

      expect(results).toHaveLength(3);
      expect(results[0].completed).toBe(true);  // First gate approved
      expect(results[1].completed).toBe(false); // Second gate denied
      expect(results[2].completed).toBe(false); // Third gate not reached due to sequence failure
      expect(results[2].response.reason).toContain('Previous gate failed');
    });

    it('should handle all approvals in sequence', () => {
      const gates = [
        helpers.createApprovalGate('gate1', 'Gate 1', 'before-commit'),
        helpers.createApprovalGate('gate2', 'Gate 2', 'custom'),
      ];

      const results = helpers.simulateSequentialApprovals(gates, ['approved', 'approved']);

      expect(results.every(r => r.completed)).toBe(true);
      expect(results[1].response.responseTimeMs).toBeGreaterThan(results[0].response.responseTimeMs);
    });
  });

  describe('Parallel Approval Testing', () => {
    it('should simulate parallel approvals with quorum requirement', () => {
      const gates = [
        helpers.createApprovalGate('lead1', 'Lead 1', 'custom'),
        helpers.createApprovalGate('lead2', 'Lead 2', 'custom'),
        helpers.createApprovalGate('architect', 'Architect', 'custom'),
      ];

      const result = helpers.simulateParallelApprovals(
        gates,
        ['approved', 'denied', 'approved'],
        { requireAllApprovals: false, minimumApprovals: 2 }
      );

      expect(result.results).toHaveLength(3);
      expect(result.approvalCount).toBe(2);
      expect(result.overallResult).toBe('approved'); // 2/3 approved meets minimum
    });

    it('should require all approvals when configured', () => {
      const gates = [
        helpers.createApprovalGate('gate1', 'Gate 1', 'custom'),
        helpers.createApprovalGate('gate2', 'Gate 2', 'custom'),
      ];

      const result = helpers.simulateParallelApprovals(
        gates,
        ['approved', 'denied'],
        { requireAllApprovals: true }
      );

      expect(result.overallResult).toBe('denied'); // One denial fails the whole approval
    });
  });

  describe('Multi-Approver Quorum Testing', () => {
    it('should handle quorum with multiple approvers', () => {
      const approverResponses = [
        { approver: 'tech-lead-1', response: 'approve' as const, reason: 'Looks good' },
        { approver: 'tech-lead-2', response: 'approve' as const, reason: 'Approved' },
        { approver: 'architect', response: 'deny' as const, reason: 'Concerns about approach' },
      ];

      const result = helpers.testApprovalQuorumHandling(2, approverResponses);

      expect(result.quorumMet).toBe(true);
      expect(result.totalApprovals).toBe(2);
      expect(result.totalDenials).toBe(1);
      expect(result.finalDecision).toBe('approved');
    });

    it('should handle insufficient approvals', () => {
      const approverResponses = [
        { approver: 'tech-lead-1', response: 'approve' as const },
        { approver: 'tech-lead-2', response: 'deny' as const },
        { approver: 'architect', response: 'deny' as const },
      ];

      const result = helpers.testApprovalQuorumHandling(2, approverResponses);

      expect(result.quorumMet).toBe(false);
      expect(result.finalDecision).toBe('denied');
    });
  });

  describe('Resource Limit Boundary Testing', () => {
    it('should test resource usage within limits', () => {
      const limits: TaskResourceLimits = {
        maxExecutionTimeMs: 300000,
        maxMemoryMB: 512,
        maxCpuPercent: 80,
      };

      const usage = {
        maxExecutionTimeMs: 250000, // 83% utilization
        maxMemoryMB: 400,          // 78% utilization
        maxCpuPercent: 60,         // 75% utilization
      };

      const result = helpers.testResourceLimitBoundary(limits, usage);

      expect(result.withinLimits).toBe(true);
      expect(result.exceedingLimits).toHaveLength(0);
      expect(result.utilizationPercentage.maxExecutionTimeMs).toBeCloseTo(83.33, 1);
      expect(result.recommendedAction).toBe('warn'); // >80% utilization triggers warning
    });

    it('should detect resource limit exceedance', () => {
      const limits: TaskResourceLimits = {
        maxExecutionTimeMs: 300000,
        maxMemoryMB: 512,
      };

      const usage = {
        maxExecutionTimeMs: 350000, // Exceeds limit
        maxMemoryMB: 400,          // Within limit
      };

      const result = helpers.testResourceLimitBoundary(limits, usage);

      expect(result.withinLimits).toBe(false);
      expect(result.exceedingLimits).toContain('maxExecutionTimeMs');
      expect(result.recommendedAction).toBe('deny');
    });
  });

  describe('Rejection Behavior Testing', () => {
    it('should test abort behavior correctly', () => {
      const result = helpers.testRejectionBehaviorEffect('abort', {
        gatesFailed: 1,
        totalGates: 3,
        criticalGateFailed: false,
      });

      expect(result.workflowContinues).toBe(false);
      expect(result.nextAction).toBe('abort-workflow');
      expect(result.terminationReason).toContain('Approval gate failed');
    });

    it('should test skip behavior correctly', () => {
      const result = helpers.testRejectionBehaviorEffect('skip', {
        gatesFailed: 2,
        totalGates: 5,
        criticalGateFailed: false,
      });

      expect(result.workflowContinues).toBe(true);
      expect(result.stepsSkipped).toBe(2);
      expect(result.nextAction).toBe('skip-stage');
    });

    it('should handle critical gate failures in skip mode', () => {
      const result = helpers.testRejectionBehaviorEffect('skip', {
        gatesFailed: 1,
        totalGates: 3,
        criticalGateFailed: true,
      });

      expect(result.workflowContinues).toBe(false);
      expect(result.nextAction).toBe('abort-workflow');
      expect(result.terminationReason).toContain('Critical gate failed');
    });
  });

  describe('Agent Override Conflict Testing', () => {
    it('should detect and resolve agent override conflicts', () => {
      const baseConfig = helpers.createAutonomyConfig('review-before-commit');
      const agentOverrides = {
        developer: 'full-auto' as AutonomyLevel,
        reviewer: 'supervised' as AutonomyLevel,
      };
      const stageOverrides = {
        testing: 'full-auto' as AutonomyLevel,
        production: 'supervised' as AutonomyLevel,
      };

      const result = helpers.simulateAgentOverrideConflict(
        baseConfig,
        agentOverrides,
        stageOverrides
      );

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.finalConfig.agentOverrides).toEqual(agentOverrides);
      expect(result.finalConfig.stageOverrides).toEqual(stageOverrides);

      // Agent overrides should take precedence
      const developerConflict = result.conflicts.find(c => c.agent === 'developer');
      if (developerConflict) {
        expect(developerConflict.resolution).toBe('full-auto');
        expect(developerConflict.resolutionReason).toContain('Agent-specific override takes precedence');
      }
    });
  });

  describe('Approval Retry Testing', () => {
    it('should test approval retry mechanism', () => {
      const gate = helpers.createApprovalGate('retry-gate', 'Retry Test Gate', 'before-commit', {
        timeout: 30,
      });

      const failedAttempts = [
        { attempt: 1, failureReason: 'timeout' as const, retryDelay: 30000 },
        { attempt: 2, failureReason: 'denial' as const, retryDelay: 60000 },
        { attempt: 3, failureReason: 'insufficient-approvals' as const, retryDelay: 120000 },
      ];

      const result = helpers.testApprovalRetry(gate, failedAttempts);

      expect(result.retryResults).toHaveLength(3);
      expect(result.totalRetryTime).toBe(210000); // Sum of retry delays
      expect(result.finalOutcome).toMatch(/success|failure|escalated/);

      // Check that last attempt should succeed (based on implementation)
      const lastRetry = result.retryResults[result.retryResults.length - 1];
      expect(lastRetry.retryAllowed).toBe(true);
    });
  });
});

describe('Integrated Permission-Autonomy Testing', () => {
  beforeEach(() => {
    apexTestHelpers.reset();
  });

  describe('Permission Denial with Autonomy Levels', () => {
    it('should handle permission denial in full-auto mode', () => {
      const result = apexTestHelpers.testPermissionDenialWithAutonomyLevel(
        'full-auto',
        'Shell',
        'sudo rm -rf /'
      );

      expect(result.expectedOutcome).toBe('blocked');
      expect(result.workflowContinues).toBe(false);
      expect(result.reason).toContain('Even full autonomy cannot override');
    });

    it('should handle permission denial in review-before-commit mode', () => {
      const result = apexTestHelpers.testPermissionDenialWithAutonomyLevel(
        'review-before-commit',
        'Write',
        '/etc/passwd'
      );

      expect(result.expectedOutcome).toBe('requires-approval');
      expect(result.workflowContinues).toBe(true);
      expect(result.reason).toContain('triggers approval gate');
    });

    it('should handle permission denial in supervised mode', () => {
      const result = apexTestHelpers.testPermissionDenialWithAutonomyLevel(
        'supervised',
        'Delete',
        '/production/data'
      );

      expect(result.expectedOutcome).toBe('escalated');
      expect(result.workflowContinues).toBe(false);
      expect(result.reason).toContain('requires escalation');
    });
  });

  describe('Dangerous Operations Across Autonomy Levels', () => {
    it('should test critical operations across all autonomy levels', () => {
      const results = apexTestHelpers.testDangerousOperationAcrossAutonomyLevels(
        'format_disk',
        'critical'
      );

      expect(results).toHaveLength(4); // Four autonomy levels

      const fullAutoResult = results.find(r => r.autonomyLevel === 'full-auto');
      expect(fullAutoResult?.workflowOutcome).toBe('blocked');

      const supervisedResult = results.find(r => r.autonomyLevel === 'supervised');
      expect(supervisedResult?.escalationLevel).toBe('security-team');
    });
  });

  describe('Resource Limits with Autonomy Integration', () => {
    it('should test resource limits across autonomy levels', () => {
      const usage = {
        maxExecutionTimeMs: 400000,
        maxMemoryMB: 600,
        maxCpuPercent: 95,
      };

      const limits = {
        maxExecutionTimeMs: 300000,
        maxMemoryMB: 512,
        maxCpuPercent: 80,
      };

      const results = apexTestHelpers.testResourceLimitBoundaryWithAutonomyLevels(usage, limits);

      expect(results).toHaveLength(4);

      // Full-auto should still deny when limits exceeded
      const fullAutoResult = results.find(r => r.autonomyLevel === 'full-auto');
      expect(fullAutoResult?.workflowAction).toBe('deny');

      // Supervised should always require approval
      const supervisedResult = results.find(r => r.autonomyLevel === 'supervised');
      expect(supervisedResult?.permissionRequired).toBe(true);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle comprehensive test scenarios', () => {
      const scenarios = apexTestHelpers.createComprehensiveTestScenarios();

      // Test high-risk operation with full autonomy
      const highRiskResults = scenarios.highRiskFullAutonomy();
      expect(Array.isArray(highRiskResults)).toBe(true);

      // Test permission escalation cascade
      const escalationResult = scenarios.permissionDenialCascade();
      expect(escalationResult.escalationSteps.length).toBeGreaterThan(0);

      // Test resource exhaustion
      const resourceResults = scenarios.resourceExhaustion();
      expect(Array.isArray(resourceResults)).toBe(true);

      // Test sequential approvals
      const sequentialResult = scenarios.multiGateSequentialApproval();
      expect(Array.isArray(sequentialResult)).toBe(true);

      // Test parallel approvals
      const parallelResult = scenarios.parallelApprovalQuorum();
      expect(parallelResult.results.length).toBeGreaterThan(0);
    });
  });

  describe('Permission Escalation with Approval Gates', () => {
    it('should test escalation combined with gates', () => {
      const result = apexTestHelpers.testPermissionEscalationWithApprovalGates(
        'Write',
        '/critical/system/file',
        ['supervisor', 'admin', 'security-team']
      );

      expect(result.escalationSteps).toHaveLength(3);
      expect(result.totalEscalationTime).toBeGreaterThan(0);
      expect(result.finalOutcome).toMatch(/approved|denied|timeout/);

      // Check that each escalation step has proper gate configuration
      result.escalationSteps.forEach(step => {
        expect(step.gate).toBeDefined();
        expect(step.gate.name).toContain(step.level);
        expect(step.approvalFlow).toBeDefined();
      });
    });
  });
});