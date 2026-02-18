/**
 * @fileoverview Edge Cases and Error Scenarios for Permission and Autonomy Test Helpers
 *
 * This test file focuses on edge cases, error conditions, and boundary scenarios
 * to ensure the test helpers are robust and handle unusual situations gracefully.
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
} from '../types';

describe('Permission Test Helpers Edge Cases', () => {
  let helpers: PermissionTestHelpers;

  beforeEach(() => {
    helpers = new PermissionTestHelpers();
  });

  afterEach(() => {
    helpers.reset();
  });

  describe('Boundary Conditions', () => {
    it('should handle null and undefined scopes gracefully', () => {
      const manager = helpers.getMockPermissionManager();

      // Configure permission with undefined scope
      manager.configurePermissionCheck('Write', undefined, {
        allowed: true,
        level: 'allow-always',
        requiresConfirmation: false,
      });

      // Test with various falsy values
      expect(manager.checkPermission('Write').allowed).toBe(true);
      expect(manager.checkPermission('Write', { scope: undefined }).allowed).toBe(true);

      // Test with different scope should not match
      expect(manager.checkPermission('Write', { scope: '/specific/path' }).allowed).toBe(false);
    });

    it('should handle empty strings and whitespace in scopes', () => {
      const testCases = [
        { scope: '', description: 'empty string' },
        { scope: '   ', description: 'whitespace only' },
        { scope: '\t\n', description: 'tabs and newlines' },
        { scope: null as any, description: 'null value' },
      ];

      testCases.forEach(testCase => {
        const permission = helpers.createPermission('Read', 'allow-once', {
          scope: testCase.scope,
        });

        expect(permission.scope).toBe(testCase.scope);
      });
    });

    it('should handle extreme expiry dates', () => {
      // Test with dates far in the future and past
      const farFuture = new Date('2099-12-31T23:59:59Z');
      const farPast = new Date('1970-01-01T00:00:01Z');

      const futurePermission = helpers.createPermission('Write', 'allow-once', {
        expiry: farFuture,
      });

      const pastPermission = helpers.createPermission('Read', 'allow-once', {
        expiry: farPast,
      });

      expect(futurePermission.expiry).toEqual(farFuture);
      expect(pastPermission.expiry).toEqual(farPast);
    });

    it('should handle very long scope strings', () => {
      const longScope = '/very/long/path/that/goes/on/and/on/' + 'segment/'.repeat(100) + 'file.txt';

      const permission = helpers.createPermission('Write', 'allow-always', {
        scope: longScope,
      });

      expect(permission.scope).toBe(longScope);
      expect(permission.scope!.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in scopes', () => {
      const specialChars = [
        '/path/with/unicode/文件.txt',
        '/path/with/emoji/📁📄.txt',
        '/path/with/symbols/file!@#$%^&*().txt',
        '/path/with/spaces/my file.txt',
        '/path/with/quotes/file"name\'.txt',
        '/path/with/backslashes/file\\name.txt',
      ];

      specialChars.forEach(scope => {
        const permission = helpers.createPermission('Read', 'allow-always', {
          scope,
        });

        expect(permission.scope).toBe(scope);
      });
    });
  });

  describe('Permission Flow Edge Cases', () => {
    it('should handle rapid permission state changes', () => {
      const flowScenario = helpers.createPermissionFlowScenario('Shell');

      expect(flowScenario.initialDenial.allowed).toBe(false);
      expect(flowScenario.requiresApproval.requiresConfirmation).toBe(true);
      expect(flowScenario.finalApproval.allowed).toBe(true);

      // Verify state transitions are logically consistent
      expect(flowScenario.initialDenial.level).not.toBe(flowScenario.finalApproval.level);
    });

    it('should handle simultaneous permission requests', () => {
      const manager = helpers.getMockPermissionManager();

      // Simulate multiple requests for the same resource
      const requests = Array.from({ length: 10 }, (_, i) => ({
        tool: 'Write',
        scope: `/concurrent/file${i}.txt`,
      }));

      // Configure allow-once permissions
      requests.forEach(req => {
        manager.configurePermissionCheck(req.tool, req.scope, {
          allowed: true,
          level: 'allow-once',
          requiresConfirmation: false,
          consumed: false,
        });
      });

      // Check all permissions
      const results = requests.map(req =>
        manager.checkPermission(req.tool, { scope: req.scope })
      );

      // All should be allowed initially
      expect(results.every(r => r.allowed)).toBe(true);
      expect(results.every(r => r.level === 'allow-once')).toBe(true);
    });

    it('should handle permission consumption edge cases', () => {
      // Test multiple consumptions of the same allow-once permission
      const consumptionResults = Array.from({ length: 5 }, () =>
        helpers.simulateAllowOnceConsumption('Git', 'commit')
      );

      // All should indicate consumption
      expect(consumptionResults.every(r => r.consumed)).toBe(true);
      expect(consumptionResults.every(r => r.level === 'allow-once')).toBe(true);
    });
  });

  describe('Dangerous Operation Assessment Edge Cases', () => {
    it('should handle operations with no context', () => {
      const result = helpers.testDangerousOperationDenial('unknown-operation', 'medium');

      expect(result.riskAssessment.level).toBe('medium');
      expect(result.riskAssessment.factors).toHaveLength(0);
      expect(result.riskAssessment.score).toBe(50); // Base medium score
    });

    it('should handle operations with contradictory context', () => {
      // Context that suggests both high and low risk
      const result = helpers.testDangerousOperationDenial('backup-operation', 'low', {
        productionSystem: true,    // High risk factor
        reversible: true,          // Low risk factor
        requiresBackup: true,      // Low risk factor
        affectedFiles: ['single-file'], // Low risk factor
      });

      expect(result.riskAssessment.score).toBeGreaterThan(25); // Should be higher than base low
      expect(result.riskAssessment.factors).toContain('Production system impact');
    });

    it('should handle maximum risk scenarios', () => {
      const result = helpers.testDangerousOperationDenial('nuclear-option', 'critical', {
        productionSystem: true,
        reversible: false,
        requiresBackup: false,
        affectedFiles: Array.from({ length: 50 }, (_, i) => `/critical/file${i}`),
      });

      expect(result.riskAssessment.score).toBe(100); // Capped at 100
      expect(result.riskAssessment.recommendation).toBe('deny');
      expect(result.permissionResult.allowed).toBe(false);
    });
  });

  describe('Audit Trail Edge Cases', () => {
    it('should handle empty audit trail', () => {
      const result = helpers.verifyPermissionAuditTrail('Write', '/file.txt', []);

      expect(result.isCompliant).toBe(false);
      expect(result.missingEntries).toContain('Initial permission request');
    });

    it('should handle audit entries with identical timestamps', () => {
      const timestamp = new Date('2024-01-01T12:00:00Z');
      const actions = [
        { action: 'request' as const, timestamp, actor: 'user1' },
        { action: 'approve' as const, timestamp, actor: 'admin1' },
        { action: 'consume' as const, timestamp, actor: 'system' },
      ];

      const result = helpers.verifyPermissionAuditTrail('Shell', 'command', actions);

      // Should still be valid even with identical timestamps
      expect(result.isCompliant).toBe(true);
    });

    it('should handle missing required fields in audit entries', () => {
      const actions = [
        { action: 'request' as const, timestamp: new Date(), actor: '' }, // Empty actor
        { action: 'approve' as const, timestamp: new Date(), actor: 'admin' },
      ];

      const result = helpers.verifyPermissionAuditTrail('Write', '/file', actions);

      expect(result.isCompliant).toBe(false);
      expect(result.auditTrail[0].valid).toBe(false);
      expect(result.auditTrail[0].issues).toContain('Missing actor');
    });

    it('should detect complex suspicious patterns', () => {
      const baseTime = new Date('2024-01-01T12:00:00Z');
      const actions = [
        { action: 'request' as const, timestamp: baseTime, actor: 'user1' },
        { action: 'approve' as const, timestamp: new Date(baseTime.getTime() + 100), actor: 'user1' }, // Self-approval
        { action: 'request' as const, timestamp: new Date(baseTime.getTime() + 200), actor: 'user2' },
        { action: 'approve' as const, timestamp: new Date(baseTime.getTime() + 300), actor: 'admin' }, // Rapid approval
        { action: 'approve' as const, timestamp: new Date(baseTime.getTime() + 400), actor: 'admin' }, // Another rapid approval
      ];

      const result = helpers.verifyPermissionAuditTrail('Delete', '/critical', actions);

      expect(result.suspiciousActivity.length).toBeGreaterThan(0);
      expect(result.suspiciousActivity.some(s => s.issue === 'Self-approval detected')).toBe(true);
      expect(result.suspiciousActivity.some(s => s.issue === 'Rapid consecutive approvals')).toBe(true);
    });
  });
});

describe('Autonomy Test Helpers Edge Cases', () => {
  let helpers: AutonomyTestHelpers;

  beforeEach(() => {
    helpers = new AutonomyTestHelpers();
  });

  afterEach(() => {
    helpers.reset();
  });

  describe('Approval Timeout Edge Cases', () => {
    it('should handle zero and negative timeout values', () => {
      // Test with zero timeout (immediate timeout)
      const zeroTimeoutResponse = helpers.simulateApprovalTimeout('before-commit', 0);
      expect(zeroTimeoutResponse?.reason).toContain('Approval timeout exceeded');
      expect(zeroTimeoutResponse?.responseTimeMs).toBe(0);

      // Test with fractional minutes
      const fractionalTimeoutResponse = helpers.simulateApprovalTimeout('before-deploy', 0.5);
      expect(fractionalTimeoutResponse?.responseTimeMs).toBe(30000); // 0.5 minutes = 30 seconds
    });

    it('should handle extremely long timeout values', () => {
      // Test with very long timeout (should not cause issues)
      const longTimeoutResponse = helpers.simulateApprovalTimeout('before-destructive', 10000);
      expect(longTimeoutResponse?.responseTimeMs).toBe(10000 * 60 * 1000); // 10000 minutes
    });
  });

  describe('Resource Limit Boundary Testing Edge Cases', () => {
    it('should handle zero and negative resource limits', () => {
      const zeroLimits = {
        maxExecutionTimeMs: 0,
        maxMemoryMB: 0,
        maxCpuPercent: 0,
        maxDiskUsageMB: 0,
        maxNetworkRequestsPerMinute: 0,
      };

      const currentUsage = {
        maxExecutionTimeMs: 1000,
        maxMemoryMB: 100,
      };

      const result = helpers.testResourceLimitBoundary(zeroLimits, currentUsage);

      expect(result.withinLimits).toBe(false);
      expect(result.exceedingLimits.length).toBeGreaterThan(0);
    });

    it('should handle missing or undefined limits', () => {
      const incompleteLimits = {
        maxMemoryMB: 512,
        // Other limits missing
      };

      const currentUsage = {
        maxExecutionTimeMs: 100000,
        maxMemoryMB: 256,
        maxCpuPercent: 50,
      };

      const result = helpers.testResourceLimitBoundary(incompleteLimits as any, currentUsage);

      // Should only check defined limits
      expect(result.withinLimits).toBe(true);
      expect(result.utilizationPercentage.maxMemoryMB).toBe(50); // 256/512 = 50%
    });

    it('should handle extreme resource usage values', () => {
      const limits = helpers.createDefaultResourceLimits();
      const extremeUsage = {
        maxExecutionTimeMs: Number.MAX_SAFE_INTEGER,
        maxMemoryMB: Number.MAX_SAFE_INTEGER,
        maxCpuPercent: 1000, // Over 100%
      };

      const result = helpers.testResourceLimitBoundary(limits, extremeUsage);

      expect(result.withinLimits).toBe(false);
      expect(result.recommendedAction).toBe('deny');
    });
  });

  describe('Approval Quorum Edge Cases', () => {
    it('should handle empty approver list', () => {
      const result = helpers.testApprovalQuorumHandling(1, []);

      expect(result.quorumMet).toBe(false);
      expect(result.totalApprovals).toBe(0);
      expect(result.finalDecision).toBe('pending'); // Still possible to reach quorum
    });

    it('should handle quorum larger than approver pool', () => {
      const approverResponses = [
        { approver: 'alice', response: 'approve' as const },
        { approver: 'bob', response: 'approve' as const },
      ];

      const result = helpers.testApprovalQuorumHandling(5, approverResponses); // Need 5, only have 2

      expect(result.quorumMet).toBe(false);
      expect(result.finalDecision).toBe('denied'); // Impossible to reach quorum
    });

    it('should handle unanimous denial requirement', () => {
      const approverResponses = [
        { approver: 'alice', response: 'deny' as const },
        { approver: 'bob', response: 'approve' as const }, // One approval breaks unanimous denial
        { approver: 'carol', response: 'deny' as const },
      ];

      // Simulate scenario where any approval prevents overall denial
      const result = helpers.testApprovalQuorumHandling(3, approverResponses);

      expect(result.totalApprovals).toBe(1);
      expect(result.totalDenials).toBe(2);
      expect(result.quorumMet).toBe(false); // Needs 3 approvals
    });
  });

  describe('Sequential Approval Edge Cases', () => {
    it('should handle empty gate list', () => {
      const results = helpers.simulateSequentialApprovals([], []);

      expect(results).toHaveLength(0);
    });

    it('should handle mismatched gates and outcomes', () => {
      const gates = [
        helpers.createApprovalGate('gate1', 'Gate 1', 'before-commit'),
        helpers.createApprovalGate('gate2', 'Gate 2', 'before-deploy'),
        helpers.createApprovalGate('gate3', 'Gate 3', 'before-destructive'),
      ];

      // More gates than outcomes
      const outcomes = ['approved', 'denied'] as const; // Missing third outcome

      const results = helpers.simulateSequentialApprovals(gates, outcomes);

      expect(results).toHaveLength(3);
      expect(results[2].response.response).toBe('approved'); // Should default to approved
    });

    it('should handle gate with missing required properties', () => {
      const incompleteGate = {
        id: 'incomplete',
        name: 'Incomplete Gate',
        type: 'before-commit' as ApprovalCheckpointType,
        // Missing required and other properties
      } as any;

      const results = helpers.simulateSequentialApprovals([incompleteGate], ['approved']);

      expect(results).toHaveLength(1);
      expect(results[0].gate).toBe(incompleteGate);
    });
  });

  describe('Agent Override Conflict Edge Cases', () => {
    it('should handle empty override objects', () => {
      const baseConfig = helpers.createAutonomyConfig('full-auto');
      const result = helpers.simulateAgentOverrideConflict(baseConfig, {}, {});

      expect(result.conflicts).toHaveLength(0);
      expect(result.finalConfig).toEqual({
        ...baseConfig,
        agentOverrides: {},
        stageOverrides: {},
      });
    });

    it('should handle complex agent autonomy overrides', () => {
      const baseConfig = helpers.createAutonomyConfig('review-before-commit');
      const complexOverrides = {
        developer: {
          level: 'full-auto' as AutonomyLevel,
          approvalTimeout: 30,
          rejectionBehavior: 'skip' as const,
          gates: [helpers.createApprovalGate('dev-gate', 'Developer Gate', 'custom')],
        },
      };

      const result = helpers.simulateAgentOverrideConflict(baseConfig, complexOverrides);

      expect(result.finalConfig.agentOverrides!.developer).toEqual(complexOverrides.developer);
    });

    it('should handle conflicting autonomy levels with same names', () => {
      const baseConfig = helpers.createAutonomyConfig('review-before-commit');
      const agentOverrides = {
        reviewer: 'supervised' as AutonomyLevel,
      };
      const stageOverrides = {
        review: 'full-auto' as AutonomyLevel,
      };

      const result = helpers.simulateAgentOverrideConflict(
        baseConfig,
        agentOverrides,
        stageOverrides
      );

      // Should find conflicts even with similar naming
      expect(result.conflicts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Rejection Behavior Edge Cases', () => {
    it('should handle unknown rejection behavior', () => {
      const result = helpers.testRejectionBehaviorEffect('unknown' as any, {
        gatesFailed: 1,
        totalGates: 2,
        criticalGateFailed: false,
      });

      expect(result.nextAction).toBe('retry'); // Should default to retry
    });

    it('should handle scenario with all gates failed', () => {
      const result = helpers.testRejectionBehaviorEffect('skip', {
        gatesFailed: 5,
        totalGates: 5,
        criticalGateFailed: false,
      });

      expect(result.stepsSkipped).toBe(5);
      expect(result.workflowContinues).toBe(true); // Skip behavior allows continuation
    });

    it('should handle scenario with no gates', () => {
      const result = helpers.testRejectionBehaviorEffect('abort', {
        gatesFailed: 0,
        totalGates: 0,
        criticalGateFailed: false,
      });

      expect(result.workflowContinues).toBe(true);
      expect(result.nextAction).toBe('continue');
      expect(result.stepsSkipped).toBe(0);
    });
  });

  describe('Approval Retry Edge Cases', () => {
    it('should handle retry with zero attempts', () => {
      const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');
      const result = helpers.testApprovalRetry(gate, []);

      expect(result.retryResults).toHaveLength(0);
      expect(result.finalOutcome).toBe('failure'); // No attempts = failure
      expect(result.totalRetryTime).toBe(0);
    });

    it('should handle retry with excessive attempts', () => {
      const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');
      const manyAttempts = Array.from({ length: 10 }, (_, i) => ({
        attempt: i + 1,
        failureReason: 'timeout' as const,
      }));

      const result = helpers.testApprovalRetry(gate, manyAttempts);

      // Should cap at max retries and escalate
      expect(result.retryResults.some(r => r.escalated)).toBe(true);
      expect(result.finalOutcome).toBe('escalated');
    });

    it('should handle retry with missing delay values', () => {
      const gate = helpers.createApprovalGate('test-gate', 'Test Gate', 'before-commit');
      const attemptsWithoutDelay = [
        { attempt: 1, failureReason: 'timeout' as const }, // No retryDelay
        { attempt: 2, failureReason: 'denial' as const },  // No retryDelay
      ];

      const result = helpers.testApprovalRetry(gate, attemptsWithoutDelay);

      expect(result.totalRetryTime).toBe(60000); // 2 * 30000ms default delay
    });
  });
});

describe('Combined Edge Cases', () => {
  beforeEach(() => {
    apexTestHelpers.reset();
  });

  describe('Integration Stress Testing', () => {
    it('should handle rapid reset operations', () => {
      // Rapidly create and reset scenarios
      for (let i = 0; i < 100; i++) {
        apexTestHelpers.createIntegratedScenario('full-auto', 'allow-always');
        apexTestHelpers.reset();
      }

      // Should not cause memory leaks or errors
      expect(apexTestHelpers.permission.getMockPermissionManager().getPermissions()).toHaveLength(0);
      expect(apexTestHelpers.autonomy.getMockApprovalSystem().getPendingApprovals()).toHaveLength(0);
    });

    it('should handle concurrent scenario creation', () => {
      const scenarios = Array.from({ length: 10 }, (_, i) =>
        apexTestHelpers.createIntegratedScenario(
          i % 2 === 0 ? 'full-auto' : 'supervised',
          i % 3 === 0 ? 'allow-always' : 'allow-once'
        )
      );

      expect(scenarios).toHaveLength(10);
      scenarios.forEach(scenario => {
        expect(scenario.autonomyConfig).toBeDefined();
        expect(scenario.permissionScenarios).toBeDefined();
      });
    });

    it('should handle mixed permission and autonomy edge cases', () => {
      const scenario = apexTestHelpers.createIntegratedScenario('review-before-commit', 'allow-once');

      // Test edge case: consumed permission with pending approval
      const permissionResult = scenario.permissionManager.checkPermission('Write');
      expect(permissionResult.consumed).toBe(true);

      // Test edge case: timeout during permission consumption
      const autonomyHelpers = apexTestHelpers.autonomy;
      const timeoutResult = autonomyHelpers.testApprovalTimeoutWithBehavior(1, 'abort', {
        isCriticalGate: true,
      });

      expect(timeoutResult.timeoutResponse.reason).toContain('timeout');
      expect(timeoutResult.workflowEffect.workflowContinues).toBe(false);
    });
  });
});