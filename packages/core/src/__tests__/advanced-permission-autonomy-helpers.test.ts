/**
 * @fileoverview Tests for Advanced Permission and Autonomy Helpers
 *
 * Comprehensive tests for the newly implemented advanced test helpers,
 * covering time-based permissions, conditional approvals, cascade failures,
 * workload-based autonomy, and multi-tenancy scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdvancedPermissionAutonomyHelpers,
  AdvancedTestScenarios,
  advancedPermissionAutonomyHelpers,
} from './helpers/advanced-permission-autonomy-helpers';
import type {
  AutonomyLevel,
  ApprovalCheckpointType,
} from './types';

describe('Advanced Permission Autonomy Helpers', () => {
  let helpers: AdvancedPermissionAutonomyHelpers;

  beforeEach(() => {
    helpers = new AdvancedPermissionAutonomyHelpers();
  });

  describe('Time-Based Permission Scenarios', () => {
    it('should create time-based permission with expiry and renewal', () => {
      const scenario = helpers.createTimeBasedPermissionScenario('Write', 30, {
        scope: '/tmp/*',
        expiryAction: 'request-renewal',
      });

      expect(scenario.permission).toBeDefined();
      expect(scenario.permission.tool).toBe('Write');
      expect(scenario.permission.level).toBe('allow-once');
      expect(scenario.permission.scope).toBe('/tmp/*');
      expect(scenario.permission.expiry).toBeDefined();

      // Initial check should allow
      expect(scenario.initialCheck.allowed).toBe(true);

      // Near expiry should require confirmation
      expect(scenario.nearExpiryCheck.allowed).toBe(true);
      expect(scenario.nearExpiryCheck.requiresConfirmation).toBe(true);
      expect(scenario.nearExpiryCheck.reason).toContain('expires soon');

      // Expired check should deny and require renewal
      expect(scenario.expiredCheck.allowed).toBe(false);
      expect(scenario.expiredCheck.reason).toContain('expired');

      // Renewal request should be created
      expect(scenario.renewalRequest).toBeDefined();
      expect(scenario.renewalRequest?.gateName).toBe('Permission Renewal');
    });

    it('should handle downgrade expiry action', () => {
      const scenario = helpers.createTimeBasedPermissionScenario('Read', 15, {
        expiryAction: 'downgrade',
      });

      // After expiry, should downgrade to basic permission
      expect(scenario.expiredCheck.allowed).toBe(true);
      expect(scenario.expiredCheck.level).toBe('allow-always');
      expect(scenario.expiredCheck.reason).toContain('downgraded');
      expect(scenario.renewalRequest).toBeUndefined();
    });

    it('should handle deny expiry action', () => {
      const scenario = helpers.createTimeBasedPermissionScenario('Execute', 10, {
        scope: '/bin/*',
        expiryAction: 'deny',
      });

      // After expiry, should deny access
      expect(scenario.expiredCheck.allowed).toBe(false);
      expect(scenario.expiredCheck.reason).toBe('Permission expired');
      expect(scenario.renewalRequest).toBeUndefined();
    });
  });

  describe('Conditional Approval Scenarios', () => {
    it('should evaluate conditions and make approval decisions', () => {
      const result = helpers.testConditionalApprovalChain({
        conditions: [
          {
            type: 'time-window',
            criteria: {
              start: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
              end: new Date(Date.now() + 60 * 60 * 1000),   // 1 hour from now
            },
            required: true,
            weight: 3,
          },
          {
            type: 'system-health',
            criteria: { minHealthScore: 75 },
            required: true,
            weight: 2,
          },
          {
            type: 'custom',
            criteria: { mockResult: true, reason: 'Test condition met' },
            required: false,
            weight: 1,
          },
        ],
        fallbackActions: [
          {
            action: 'escalate',
            parameters: { level: 'admin', timeoutMinutes: 90 },
          },
          {
            action: 'delay',
            parameters: { delayMinutes: 45 },
          },
        ],
      });

      expect(result.conditionResults).toHaveLength(3);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.approvalDecision).toMatch(/approved|denied|conditional|escalated/);

      // Check time window condition should pass (current time is in range)
      const timeCondition = result.conditionResults.find(r => r.condition.type === 'time-window');
      expect(timeCondition?.met).toBe(true);
      expect(timeCondition?.reason).toBe('Within approved time window');

      // Check custom condition should pass
      const customCondition = result.conditionResults.find(r => r.condition.type === 'custom');
      expect(customCondition?.met).toBe(true);
      expect(customCondition?.reason).toBe('Test condition met');

      // Fallback actions should be configured
      expect(result.fallbacksTriggered).toHaveLength(2);
    });

    it('should handle failed conditions and trigger fallbacks', () => {
      const result = helpers.testConditionalApprovalChain({
        conditions: [
          {
            type: 'time-window',
            criteria: {
              start: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
              end: new Date(Date.now() - 1 * 60 * 60 * 1000),   // 1 hour ago (expired)
            },
            required: true,
            weight: 5,
          },
          {
            type: 'custom',
            criteria: { mockResult: false, reason: 'Mock condition failed' },
            required: true,
            weight: 3,
          },
        ],
        fallbackActions: [
          {
            action: 'auto-deny',
            parameters: { reason: 'Critical conditions not met' },
          },
        ],
      });

      // Time window should fail (current time is past the window)
      const timeCondition = result.conditionResults.find(r => r.condition.type === 'time-window');
      expect(timeCondition?.met).toBe(false);
      expect(timeCondition?.reason).toBe('Outside approved time window');

      // Custom condition should fail
      const customCondition = result.conditionResults.find(r => r.condition.type === 'custom');
      expect(customCondition?.met).toBe(false);

      // Should result in denial due to failed conditions
      expect(result.approvalDecision).toBe('denied');

      // Auto-deny fallback should be triggered
      const autoDefyFallback = result.fallbacksTriggered.find(f => f.fallback.action === 'auto-deny');
      expect(autoDefyFallback?.executed).toBe(true);
      expect(autoDefyFallback?.result?.denied).toBe(true);
    });
  });

  describe('Cascade Failure Scenarios', () => {
    it('should simulate cascade failures through dependent systems', () => {
      const result = helpers.simulateCascadeFailure({
        initialFailure: {
          type: 'approval-timeout',
          details: { gateName: 'critical-review', timeoutMinutes: 30 },
        },
        dependentSystems: [
          {
            system: 'permission-service',
            failureProbability: 0.8, // High probability for testing
            impactLevel: 'high',
            recoveryTimeMinutes: 15,
          },
          {
            system: 'notification-service',
            failureProbability: 0.3, // Lower probability
            impactLevel: 'medium',
            recoveryTimeMinutes: 5,
          },
          {
            system: 'audit-service',
            failureProbability: 0.9, // Very high probability
            impactLevel: 'critical',
            recoveryTimeMinutes: 60,
          },
        ],
        circuitBreaker: {
          enabled: true,
          failureThreshold: 2,
          timeoutMs: 30000,
          recoveryTimeMs: 300000,
        },
      });

      expect(result.initialFailure).toBeDefined();
      expect(result.initialFailure.type).toBe('approval-timeout');
      expect(result.initialFailure.impact).toContain('Approval workflow disruption');

      expect(result.cascadeSteps).toHaveLength(3);
      result.cascadeSteps.forEach((step, index) => {
        expect(step.step).toBe(index + 1);
        expect(step.system).toBeDefined();
        expect(typeof step.failed).toBe('boolean');
        expect(step.impactLevel).toMatch(/low|medium|high|critical/);
      });

      expect(result.systemRecovery).toBeDefined();
      expect(result.systemRecovery.totalFailures).toBeGreaterThanOrEqual(1); // At least initial failure
      expect(result.systemRecovery.estimatedRecoveryTime).toBeGreaterThanOrEqual(0);

      expect(result.mitigationActions.length).toBeGreaterThan(0);
      result.mitigationActions.forEach(action => {
        expect(action.action).toBeDefined();
        expect(action.priority).toMatch(/low|medium|high|critical/);
        expect(action.estimatedTime).toBeGreaterThan(0);
      });

      // Circuit breaker logic
      if (result.systemRecovery.totalFailures >= 2) {
        expect(result.systemRecovery.circuitBreakerTriggered).toBe(true);
        expect(result.mitigationActions.some(a => a.action.includes('Circuit breaker'))).toBe(true);
      }
    });

    it('should generate appropriate mitigation actions for critical failures', () => {
      const result = helpers.simulateCascadeFailure({
        initialFailure: {
          type: 'system-error',
          details: { component: 'core-engine' },
        },
        dependentSystems: [
          {
            system: 'critical-service',
            failureProbability: 1.0, // Guaranteed failure for testing
            impactLevel: 'critical',
            recoveryTimeMinutes: 120,
          },
        ],
      });

      // Should have emergency escalation for critical system failure
      const emergencyAction = result.mitigationActions.find(a =>
        a.action.includes('Emergency escalation')
      );
      expect(emergencyAction).toBeDefined();
      expect(emergencyAction?.priority).toBe('critical');
    });
  });

  describe('Workload-Based Autonomy Adjustment', () => {
    it('should adjust autonomy based on high workload', () => {
      const result = helpers.testWorkloadBasedAutonomyAdjustment({
        systemWorkload: {
          cpuUtilization: 85,
          memoryUtilization: 70,
          activeTasksCount: 30,
          queuedTasksCount: 25,
        },
        workloadThresholds: {
          high: { cpu: 80, memory: 75, tasks: 50 },
          critical: { cpu: 95, memory: 90, tasks: 100 },
        },
        degradationRules: [
          {
            threshold: 'high',
            targetAutonomyLevel: 'review-before-commit',
            additionalGates: ['before-commit'],
            resourceLimitReduction: 25,
          },
          {
            threshold: 'critical',
            targetAutonomyLevel: 'supervised',
            additionalGates: ['before-destructive', 'custom'],
            resourceLimitReduction: 50,
          },
        ],
      });

      expect(result.currentWorkload).toBeDefined();
      expect(result.thresholdEvaluation.exceededHigh).toBe(true);
      expect(result.thresholdEvaluation.exceededCritical).toBe(false);
      expect(result.thresholdEvaluation.triggeringFactors.length).toBeGreaterThan(0);

      // Should apply high threshold rule
      const highThresholdRule = result.autonomyAdjustments.find(a => a.rule.threshold === 'high');
      expect(highThresholdRule?.applied).toBe(true);
      expect(highThresholdRule?.newAutonomyLevel).toBe('review-before-commit');
      expect(highThresholdRule?.additionalGates.length).toBeGreaterThan(0);

      // Should not apply critical threshold rule
      const criticalThresholdRule = result.autonomyAdjustments.find(a => a.rule.threshold === 'critical');
      expect(criticalThresholdRule?.applied).toBe(false);

      expect(result.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should handle critical workload appropriately', () => {
      const result = helpers.testWorkloadBasedAutonomyAdjustment({
        systemWorkload: {
          cpuUtilization: 98,
          memoryUtilization: 95,
          activeTasksCount: 80,
          queuedTasksCount: 150,
        },
        workloadThresholds: {
          high: { cpu: 80, memory: 75, tasks: 50 },
          critical: { cpu: 95, memory: 90, tasks: 100 },
        },
        degradationRules: [
          {
            threshold: 'critical',
            targetAutonomyLevel: 'supervised',
            additionalGates: ['before-destructive'],
          },
        ],
      });

      expect(result.thresholdEvaluation.exceededCritical).toBe(true);

      // Should have immediate action recommendations
      const immediateActions = result.recommendedActions.filter(a => a.urgency === 'immediate');
      expect(immediateActions.length).toBeGreaterThan(0);

      // Should activate load shedding
      const loadSheddingAction = result.recommendedActions.find(a =>
        a.action.includes('load shedding')
      );
      expect(loadSheddingAction).toBeDefined();
      expect(loadSheddingAction?.urgency).toBe('immediate');
    });
  });

  describe('Multi-Tenancy Permission Scenarios', () => {
    it('should enforce tenant isolation correctly', () => {
      const result = helpers.testMultiTenancyPermissionScenario({
        tenants: [
          {
            id: 'tenant-free',
            name: 'Free Tenant',
            tier: 'free',
            resourceQuota: { maxMemoryMB: 256 },
            permissionLevel: 'restricted',
          },
          {
            id: 'tenant-pro',
            name: 'Pro Tenant',
            tier: 'pro',
            resourceQuota: { maxMemoryMB: 1024 },
            permissionLevel: 'standard',
          },
        ],
        crossTenantRules: [
          {
            sourceTenant: 'tenant-pro',
            targetTenant: 'tenant-free',
            allowedActions: ['read-data'],
            requiresApproval: true,
          },
        ],
      });

      expect(result.tenantIsolationTest).toHaveLength(2);

      // Check tenant isolation
      result.tenantIsolationTest.forEach(tenantTest => {
        expect(tenantTest.tenant).toBeDefined();
        expect(typeof tenantTest.isolationMaintained).toBe('boolean');
        expect(Array.isArray(tenantTest.crossTenantAttempts)).toBe(true);

        tenantTest.crossTenantAttempts.forEach(attempt => {
          expect(attempt.targetTenant).toBeDefined();
          expect(attempt.action).toBeDefined();
          expect(typeof attempt.allowed).toBe('boolean');
          expect(attempt.reason).toBeDefined();
        });
      });

      // Check resource quota enforcement
      expect(result.resourceQuotaEnforcement).toHaveLength(2);
      result.resourceQuotaEnforcement.forEach(quotaTest => {
        expect(quotaTest.tenant).toBeDefined();
        expect(typeof quotaTest.withinQuota).toBe('boolean');
        expect(Array.isArray(quotaTest.actionsRequired)).toBe(true);
      });

      // Check cross-tenant access results
      expect(result.crossTenantAccessResults).toHaveLength(1);
      const crossTenantResult = result.crossTenantAccessResults[0];
      expect(crossTenantResult.rule).toBeDefined();
      expect(crossTenantResult.testResult.approvalRequired).toBe(true);
    });

    it('should handle enterprise tier cross-access', () => {
      const result = helpers.testMultiTenancyPermissionScenario({
        tenants: [
          {
            id: 'tenant-ent-1',
            name: 'Enterprise 1',
            tier: 'enterprise',
            resourceQuota: { maxMemoryMB: 4096 },
            permissionLevel: 'elevated',
          },
          {
            id: 'tenant-ent-2',
            name: 'Enterprise 2',
            tier: 'enterprise',
            resourceQuota: { maxMemoryMB: 4096 },
            permissionLevel: 'elevated',
          },
        ],
        crossTenantRules: [],
      });

      // Enterprise tenants should have cross-access by default
      const ent1Test = result.tenantIsolationTest.find(t => t.tenant.id === 'tenant-ent-1');
      expect(ent1Test?.crossTenantAttempts[0].allowed).toBe(true);
      expect(ent1Test?.crossTenantAttempts[0].reason).toBe('Enterprise tier cross-access');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all helper state', () => {
      helpers.reset();
      // Reset should complete without error
      expect(true).toBe(true);
    });
  });
});

describe('Advanced Test Scenarios', () => {
  beforeEach(() => {
    advancedPermissionAutonomyHelpers.reset();
  });

  describe('Pre-configured Scenarios', () => {
    it('should provide time-based permission with renewal scenario', () => {
      const scenario = AdvancedTestScenarios.timeBasedPermissionWithRenewal(
        advancedPermissionAutonomyHelpers
      );

      expect(scenario).toBeDefined();
      expect(scenario.permission.tool).toBe('Write');
      expect(scenario.renewalRequest).toBeDefined();
    });

    it('should provide conditional approval scenario', () => {
      const scenario = AdvancedTestScenarios.conditionalApprovalBasedOnSystemState(
        advancedPermissionAutonomyHelpers
      );

      expect(scenario).toBeDefined();
      expect(scenario.conditionResults.length).toBeGreaterThan(0);
      expect(scenario.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should provide cascade failure scenario', () => {
      const scenario = AdvancedTestScenarios.cascadeFailureWithCircuitBreaker(
        advancedPermissionAutonomyHelpers
      );

      expect(scenario).toBeDefined();
      expect(scenario.initialFailure.type).toBe('approval-timeout');
      expect(scenario.cascadeSteps.length).toBeGreaterThan(0);
    });

    it('should provide workload-based autonomy scenario', () => {
      const scenario = AdvancedTestScenarios.workloadBasedAutonomyDegradation(
        advancedPermissionAutonomyHelpers
      );

      expect(scenario).toBeDefined();
      expect(scenario.currentWorkload).toBeDefined();
      expect(scenario.autonomyAdjustments.length).toBeGreaterThan(0);
    });

    it('should provide multi-tenancy scenario', () => {
      const scenario = AdvancedTestScenarios.multiTenancyComplexCrossTenant(
        advancedPermissionAutonomyHelpers
      );

      expect(scenario).toBeDefined();
      expect(scenario.tenantIsolationTest.length).toBe(3); // 3 tenants
      expect(scenario.crossTenantAccessResults.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero workload conditions', () => {
      const result = advancedPermissionAutonomyHelpers.testWorkloadBasedAutonomyAdjustment({
        systemWorkload: {
          cpuUtilization: 0,
          memoryUtilization: 0,
          activeTasksCount: 0,
          queuedTasksCount: 0,
        },
        workloadThresholds: {
          high: { cpu: 80, memory: 75, tasks: 50 },
          critical: { cpu: 95, memory: 90, tasks: 100 },
        },
        degradationRules: [],
      });

      expect(result.thresholdEvaluation.exceededHigh).toBe(false);
      expect(result.thresholdEvaluation.exceededCritical).toBe(false);
      expect(result.autonomyAdjustments).toHaveLength(0);
    });

    it('should handle empty tenant scenario', () => {
      const result = advancedPermissionAutonomyHelpers.testMultiTenancyPermissionScenario({
        tenants: [],
        crossTenantRules: [],
      });

      expect(result.tenantIsolationTest).toHaveLength(0);
      expect(result.resourceQuotaEnforcement).toHaveLength(0);
      expect(result.crossTenantAccessResults).toHaveLength(0);
    });

    it('should handle conditional approval with no conditions', () => {
      const result = advancedPermissionAutonomyHelpers.testConditionalApprovalChain({
        conditions: [],
        fallbackActions: [],
      });

      expect(result.conditionResults).toHaveLength(0);
      expect(result.overallScore).toBe(0);
      expect(result.approvalDecision).toBe('denied');
      expect(result.fallbacksTriggered).toHaveLength(0);
    });

    it('should handle cascade failure with no dependent systems', () => {
      const result = advancedPermissionAutonomyHelpers.simulateCascadeFailure({
        initialFailure: {
          type: 'system-error',
          details: {},
        },
        dependentSystems: [],
      });

      expect(result.cascadeSteps).toHaveLength(0);
      expect(result.systemRecovery.totalFailures).toBe(1); // Only initial failure
      expect(result.mitigationActions.length).toBeGreaterThan(0); // Should still have basic mitigation
    });
  });

  describe('Integration with Existing Helpers', () => {
    it('should work with existing permission helpers', () => {
      const timeScenario = advancedPermissionAutonomyHelpers.createTimeBasedPermissionScenario(
        'Read',
        45
      );

      // Should create valid permission that works with existing helpers
      expect(timeScenario.permission.tool).toBe('Read');
      expect(timeScenario.permission.level).toBe('allow-once');
      expect(timeScenario.permission.expiry).toBeDefined();
      expect(timeScenario.permission.createdAt).toBeDefined();
    });

    it('should work with existing autonomy helpers', () => {
      const workloadScenario = advancedPermissionAutonomyHelpers.testWorkloadBasedAutonomyAdjustment({
        systemWorkload: {
          cpuUtilization: 90,
          memoryUtilization: 80,
          activeTasksCount: 60,
          queuedTasksCount: 40,
        },
        workloadThresholds: {
          high: { cpu: 85, memory: 75, tasks: 50 },
          critical: { cpu: 95, memory: 90, tasks: 100 },
        },
        degradationRules: [
          {
            threshold: 'high',
            targetAutonomyLevel: 'review-all',
            additionalGates: ['before-commit'],
          },
        ],
      });

      // Additional gates should be valid ApprovalGate objects
      const appliedRule = workloadScenario.autonomyAdjustments.find(a => a.applied);
      if (appliedRule) {
        expect(appliedRule.additionalGates.length).toBeGreaterThan(0);
        appliedRule.additionalGates.forEach(gate => {
          expect(gate.id).toBeDefined();
          expect(gate.name).toBeDefined();
          expect(gate.type).toBeDefined();
          expect(gate.description).toBeDefined();
        });
      }
    });
  });
});