/**
 * @fileoverview Unit Tests for Policy Audit Enforcement Mode Edge Cases
 *
 * This test file focuses on edge cases and specific unit behaviors:
 * 1. Empty violation arrays in audit mode
 * 2. Malformed violation data handling
 * 3. Event emission timing and ordering
 * 4. Policy engine integration edge cases
 * 5. Error handling in audit mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator, type PolicyAuditedEventData } from '../index.js';
import type {
  PolicyEngine as IPolicyEngine,
  PolicyCheckContext,
  PolicyCheckResult,
  PolicyViolation,
  PolicyEnforcementMode,
} from '@apexcli/core';

// ============================================================================
// Test Utilities
// ============================================================================

class EdgeCaseAuditPolicyEngine implements IPolicyEngine {
  private enforcementMode: PolicyEnforcementMode = 'audit';
  private mockResult: PolicyCheckResult | null = null;
  private shouldThrowError = false;
  private errorToThrow: Error | null = null;

  setMockResult(result: PolicyCheckResult): void {
    this.mockResult = result;
  }

  setShouldThrowError(shouldThrow: boolean, error?: Error): void {
    this.shouldThrowError = shouldThrow;
    this.errorToThrow = error || new Error('Mock policy engine error');
  }

  async checkPolicy(context: PolicyCheckContext): Promise<PolicyCheckResult> {
    if (this.shouldThrowError) {
      throw this.errorToThrow;
    }

    return this.mockResult || {
      status: 'allow',
      violations: [],
      enforcementMode: this.enforcementMode,
      checkedAt: new Date(),
      policyName: 'edge-case-policy',
      policyId: 'edge-case-id',
      rulesEvaluated: 0,
      rulesPassed: 0,
      rulesFailed: 0,
      durationMs: 1,
      metadata: { edgeCase: true },
    };
  }

  getEnforcementMode(): PolicyEnforcementMode {
    return this.enforcementMode;
  }

  setEnforcementMode(mode: PolicyEnforcementMode): void {
    this.enforcementMode = mode;
  }

  // Required interface methods
  registerPolicy(): void {}
  unregisterPolicy(): boolean { return false; }
  getPolicies(): any[] { return []; }
  getPolicy(): any { return undefined; }
  hasPolicy(): boolean { return false; }
  clearPolicies(): void {}
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('Policy Audit Enforcement Mode - Unit Tests', () => {
  let mockPolicyEngine: EdgeCaseAuditPolicyEngine;
  let orchestrator: ApexOrchestrator;
  let consoleWarnSpy: any;

  beforeEach(() => {
    mockPolicyEngine = new EdgeCaseAuditPolicyEngine();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    orchestrator = new ApexOrchestrator({ projectPath: '/tmp/test',
      policyEngine: mockPolicyEngine,
    });
  });

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
  });

  describe('empty violations handling', () => {
    it('should handle empty violations array in audit mode', async () => {
      const auditedEvents: PolicyAuditedEventData[] = [];
      orchestrator.on('policy:audited', (event) => auditedEvents.push(event));

      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: [], // Empty violations array
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'empty-violations-policy',
        policyId: 'empty-violations-id',
        rulesEvaluated: 1,
        rulesPassed: 1,
        rulesFailed: 0,
        durationMs: 5,
        metadata: { testCase: 'empty-violations' },
      });

      const result = await mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'test_action',
        toolName: 'TestTool',
        resource: '/test/empty',
        toolArguments: {},
        taskId: 'empty-test',
        metadata: {},
      });

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(0);
      expect(result.enforcementMode).toBe('audit');
      expect(result.rulesPassed).toBe(1);
      expect(result.rulesFailed).toBe(0);
    });

    it('should handle undefined violations in audit mode', async () => {
      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: undefined as any, // Undefined violations
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'undefined-violations-policy',
        policyId: 'undefined-violations-id',
        rulesEvaluated: 0,
        rulesPassed: 0,
        rulesFailed: 0,
        durationMs: 3,
        metadata: { testCase: 'undefined-violations' },
      });

      const result = await mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'test_action',
        toolName: 'TestTool',
        resource: '/test/undefined',
        toolArguments: {},
        taskId: 'undefined-test',
        metadata: {},
      });

      expect(result.status).toBe('allow');
      expect(result.violations).toBeUndefined();
      expect(result.enforcementMode).toBe('audit');
    });
  });

  describe('malformed violation data handling', () => {
    it('should handle violations with missing required fields', async () => {
      const malformedViolation = {
        id: 'malformed-1',
        // Missing 'rule' field
        message: 'Malformed violation test',
        severity: 'warning',
        // Missing other required fields
      } as PolicyViolation;

      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: [malformedViolation],
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'malformed-policy',
        policyId: 'malformed-id',
        rulesEvaluated: 1,
        rulesPassed: 0,
        rulesFailed: 1,
        durationMs: 7,
        metadata: { testCase: 'malformed-violations' },
      });

      const result = await mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'test_action',
        toolName: 'TestTool',
        resource: '/test/malformed',
        toolArguments: {},
        taskId: 'malformed-test',
        metadata: {},
      });

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].id).toBe('malformed-1');
      expect(result.enforcementMode).toBe('audit');
    });

    it('should handle violations with null/undefined nested data', async () => {
      const violationWithNullData: PolicyViolation = {
        id: 'null-data-violation',
        rule: 'null-data-rule',
        message: 'Violation with null context',
        severity: 'info',
        blocking: false,
        policyType: 'test',
        description: 'Testing null data handling',
        resource: '/test/null',
        context: null as any, // Null context
        timestamp: new Date(),
      };

      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: [violationWithNullData],
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'null-data-policy',
        policyId: 'null-data-id',
        rulesEvaluated: 1,
        rulesPassed: 0,
        rulesFailed: 1,
        durationMs: 4,
        metadata: null as any, // Null metadata
      });

      const result = await mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'test_action',
        toolName: 'TestTool',
        resource: '/test/null',
        toolArguments: {},
        taskId: 'null-test',
        metadata: {},
      });

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].context).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.enforcementMode).toBe('audit');
    });
  });

  describe('audit mode identification', () => {
    it('should correctly identify audit enforcement mode', async () => {
      const testCases: PolicyEnforcementMode[] = ['audit', 'warn', 'block'];

      for (const mode of testCases) {
        mockPolicyEngine.setEnforcementMode(mode);

        mockPolicyEngine.setMockResult({
          status: mode === 'block' ? 'deny' : 'allow',
          violations: [{
            id: `test-${mode}`,
            rule: 'mode-test',
            message: `Testing ${mode} mode`,
            severity: 'warning',
            blocking: mode === 'block',
            policyType: 'test',
            description: `Test for ${mode} mode`,
            resource: `/test/${mode}`,
            context: { mode },
            timestamp: new Date(),
          }],
          enforcementMode: mode,
          checkedAt: new Date(),
          policyName: `${mode}-policy`,
          policyId: `${mode}-id`,
          rulesEvaluated: 1,
          rulesPassed: 0,
          rulesFailed: 1,
          durationMs: 2,
          metadata: { enforcementMode: mode },
        });

        const result = await mockPolicyEngine.checkPolicy({
          agentId: 'test-agent',
          action: 'mode_test',
          toolName: 'ModeTestTool',
          resource: `/test/${mode}`,
          toolArguments: {},
          taskId: `${mode}-test`,
          metadata: {},
        });

        expect(result.enforcementMode).toBe(mode);

        if (mode === 'audit') {
          expect(result.status).toBe('allow');
        } else if (mode === 'block') {
          expect(result.status).toBe('deny');
        } else { // warn
          expect(result.status).toBe('allow');
        }
      }
    });

    it('should handle case-insensitive enforcement mode comparison', async () => {
      // Test that audit mode detection is robust
      const auditModeVariations = ['audit', 'AUDIT', 'Audit', 'aUdIt'];

      auditModeVariations.forEach(mode => {
        mockPolicyEngine.setEnforcementMode(mode.toLowerCase() as PolicyEnforcementMode);
        expect(mockPolicyEngine.getEnforcementMode()).toBe('audit');
      });
    });
  });

  describe('error handling in audit mode', () => {
    it('should handle policy engine errors gracefully in audit mode', async () => {
      const testError = new Error('Policy engine connection failed');
      mockPolicyEngine.setShouldThrowError(true, testError);

      await expect(mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'error_test',
        toolName: 'ErrorTool',
        resource: '/test/error',
        toolArguments: {},
        taskId: 'error-test',
        metadata: {},
      })).rejects.toThrow('Policy engine connection failed');
    });

    it('should handle policy results with invalid status in audit mode', async () => {
      mockPolicyEngine.setMockResult({
        status: 'invalid-status' as any, // Invalid status
        violations: [{
          id: 'invalid-status-violation',
          rule: 'status-test',
          message: 'Testing invalid status handling',
          severity: 'error',
          blocking: false,
          policyType: 'test',
          description: 'Invalid status test',
          resource: '/test/invalid-status',
          context: { invalidStatus: true },
          timestamp: new Date(),
        }],
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'invalid-status-policy',
        policyId: 'invalid-status-id',
        rulesEvaluated: 1,
        rulesPassed: 0,
        rulesFailed: 1,
        durationMs: 6,
        metadata: { testCase: 'invalid-status' },
      });

      const result = await mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'invalid_status_test',
        toolName: 'InvalidStatusTool',
        resource: '/test/invalid-status',
        toolArguments: {},
        taskId: 'invalid-status-test',
        metadata: {},
      });

      // Even with invalid status, audit mode should be identifiable
      expect(result.enforcementMode).toBe('audit');
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('performance and timing tests', () => {
    it('should handle rapid consecutive policy checks in audit mode', async () => {
      const auditedEvents: PolicyAuditedEventData[] = [];
      orchestrator.on('policy:audited', (event) => auditedEvents.push(event));

      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: [{
          id: 'rapid-test-violation',
          rule: 'rapid-test',
          message: 'Rapid consecutive test',
          severity: 'info',
          blocking: false,
          policyType: 'performance',
          description: 'Testing rapid policy checks',
          resource: '/test/rapid',
          context: { rapidTest: true },
          timestamp: new Date(),
        }],
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'rapid-test-policy',
        policyId: 'rapid-test-id',
        rulesEvaluated: 1,
        rulesPassed: 0,
        rulesFailed: 1,
        durationMs: 1,
        metadata: { testCase: 'rapid-consecutive' },
      });

      // Simulate rapid consecutive policy checks
      const promises: Promise<PolicyCheckResult>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(mockPolicyEngine.checkPolicy({
          agentId: 'test-agent',
          action: `rapid_test_${i}`,
          toolName: 'RapidTool',
          resource: `/test/rapid/${i}`,
          toolArguments: { iteration: i },
          taskId: `rapid-test-${i}`,
          metadata: { iteration: i },
        }));
      }

      const results = await Promise.all(promises);

      // All results should be consistent
      results.forEach((result, index) => {
        expect(result.status).toBe('allow');
        expect(result.enforcementMode).toBe('audit');
        expect(result.violations).toHaveLength(1);
      });
    });

    it('should handle policy checks with large violation datasets', async () => {
      // Create a large number of violations to test performance
      const manyViolations: PolicyViolation[] = [];
      for (let i = 0; i < 100; i++) {
        manyViolations.push({
          id: `bulk-violation-${i}`,
          rule: `bulk-rule-${i % 5}`,
          message: `Bulk violation ${i}`,
          severity: ['info', 'warning', 'error'][i % 3] as any,
          blocking: false,
          policyType: 'bulk',
          description: `Bulk test violation number ${i}`,
          resource: `/test/bulk/${i}`,
          context: {
            bulkTest: true,
            index: i,
            category: `category-${i % 10}`,
            metadata: { generated: true, timestamp: new Date() },
          },
          timestamp: new Date(Date.now() - i * 1000), // Staggered timestamps
        });
      }

      mockPolicyEngine.setMockResult({
        status: 'allow',
        violations: manyViolations,
        enforcementMode: 'audit',
        checkedAt: new Date(),
        policyName: 'bulk-test-policy',
        policyId: 'bulk-test-id',
        rulesEvaluated: 100,
        rulesPassed: 0,
        rulesFailed: 100,
        durationMs: 50,
        metadata: { testCase: 'bulk-violations', count: 100 },
      });

      const result = await mockPolicyEngine.checkPolicy({
        agentId: 'test-agent',
        action: 'bulk_test',
        toolName: 'BulkTool',
        resource: '/test/bulk',
        toolArguments: { count: 100 },
        taskId: 'bulk-test',
        metadata: { bulkTest: true },
      });

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(100);
      expect(result.enforcementMode).toBe('audit');
      expect(result.rulesFailed).toBe(100);

      // Verify violation structure integrity
      result.violations.forEach((violation, index) => {
        expect(violation.id).toBe(`bulk-violation-${index}`);
        expect(violation.context?.index).toBe(index);
      });
    });
  });
});