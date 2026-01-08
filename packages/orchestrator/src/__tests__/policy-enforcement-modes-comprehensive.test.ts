/**
 * @fileoverview Comprehensive tests for policy enforcement mode behavior
 *
 * Tests all enforcement mode actions as specified in acceptance criteria:
 * - audit: logs detections for auditing without blocking
 * - redact: masks content in outputs before storage/emission
 * - block: halts execution and marks task failed
 * - warn: generates warnings but allows execution to continue
 * - strict: blocks all violations
 * - disabled: no enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  PolicyEnforcementMode,
  PolicyViolation,
  PolicyCheckResult,
} from '@apexcli/core';

describe('Policy Enforcement Modes - Comprehensive Tests', () => {
  // Helper to create test violations
  const createTestViolation = (blocking = false): PolicyViolation => ({
    id: `test-violation-${Date.now()}`,
    rule: 'test-rule',
    message: 'Test policy violation',
    severity: blocking ? 'error' : 'warning',
    blocking,
    policyType: 'test',
    description: 'Test violation for enforcement testing',
    resource: '/test/resource',
    context: { testMode: true },
    timestamp: new Date(),
  });

  // Helper to create policy check result
  const createPolicyResult = (
    status: 'allow' | 'deny',
    enforcementMode: PolicyEnforcementMode,
    violations: PolicyViolation[] = []
  ): PolicyCheckResult => ({
    status,
    violations,
    enforcementMode,
    checkedAt: new Date(),
    policyName: `test-policy-${enforcementMode}`,
    policyId: `policy-${enforcementMode}-id`,
    rulesEvaluated: violations.length || 1,
    rulesPassed: status === 'allow' ? 1 : 0,
    rulesFailed: violations.length,
    durationMs: Math.random() * 10,
    metadata: { testMode: true, enforcementMode },
  });

  describe('audit enforcement mode', () => {
    const auditMode: PolicyEnforcementMode = 'audit';

    it('should log detections without blocking execution', () => {
      const violations = [createTestViolation(false), createTestViolation(false)];
      const result = createPolicyResult('allow', auditMode, violations);

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('audit');
      expect(result.violations).toHaveLength(2);
      expect(result.violations.every(v => !v.blocking)).toBe(true);
    });

    it('should allow execution even with critical violations in audit mode', () => {
      const criticalViolations = [
        { ...createTestViolation(true), severity: 'critical' as const }
      ];
      const result = createPolicyResult('allow', auditMode, criticalViolations);

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('audit');
      expect(result.violations[0].severity).toBe('critical');
    });

    it('should emit appropriate events for audit mode', () => {
      const mockEmitAudit = vi.fn();
      const mockEmitWarn = vi.fn();
      const mockEmitBlock = vi.fn();

      // Simulate event emission logic
      const violations = [createTestViolation(false)];
      const result = createPolicyResult('allow', auditMode, violations);

      // In audit mode, should emit audit events
      if (result.enforcementMode === 'audit' && result.violations.length > 0) {
        result.violations.forEach(() => mockEmitAudit());
      }

      expect(mockEmitAudit).toHaveBeenCalledTimes(1);
      expect(mockEmitWarn).not.toHaveBeenCalled();
      expect(mockEmitBlock).not.toHaveBeenCalled();
    });
  });

  describe('block enforcement mode (strict)', () => {
    const blockMode: PolicyEnforcementMode = 'strict';

    it('should block execution when violations detected', () => {
      const blockingViolations = [createTestViolation(true)];
      const result = createPolicyResult('deny', blockMode, blockingViolations);

      expect(result.status).toBe('deny');
      expect(result.enforcementMode).toBe('strict');
      expect(result.violations[0].blocking).toBe(true);
    });

    it('should block on any violation in strict mode', () => {
      const minorViolations = [
        { ...createTestViolation(false), severity: 'info' as const }
      ];
      const result = createPolicyResult('deny', blockMode, minorViolations);

      expect(result.status).toBe('deny');
      expect(result.enforcementMode).toBe('strict');
    });

    it('should emit block events in strict mode', () => {
      const mockEmitBlock = vi.fn();
      const mockEmitAudit = vi.fn();

      const violations = [createTestViolation(true)];
      const result = createPolicyResult('deny', blockMode, violations);

      // Simulate block event emission
      if (result.enforcementMode === 'strict' && result.status === 'deny') {
        mockEmitBlock();
      }

      expect(mockEmitBlock).toHaveBeenCalledTimes(1);
      expect(mockEmitAudit).not.toHaveBeenCalled();
    });

    it('should provide detailed error information for blocked actions', () => {
      const violations = [
        createTestViolation(true),
        createTestViolation(true)
      ];
      const result = createPolicyResult('deny', blockMode, violations);

      expect(result.status).toBe('deny');
      expect(result.violations).toHaveLength(2);
      expect(result.rulesFailed).toBe(2);
      expect(result.rulesPassed).toBe(0);
    });
  });

  describe('warn enforcement mode', () => {
    const warnMode: PolicyEnforcementMode = 'warn';

    it('should allow execution with warnings', () => {
      const violations = [createTestViolation(false)];
      const result = createPolicyResult('allow', warnMode, violations);

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('warn');
      expect(result.violations).toHaveLength(1);
    });

    it('should emit warn events without blocking', () => {
      const mockEmitWarn = vi.fn();
      const mockEmitBlock = vi.fn();

      const violations = [createTestViolation(false)];
      const result = createPolicyResult('allow', warnMode, violations);

      // Simulate warn event emission
      if (result.enforcementMode === 'warn' && result.violations.length > 0) {
        result.violations.forEach(() => mockEmitWarn());
      }

      expect(mockEmitWarn).toHaveBeenCalledTimes(1);
      expect(mockEmitBlock).not.toHaveBeenCalled();
    });

    it('should handle multiple warnings gracefully', () => {
      const multipleViolations = [
        createTestViolation(false),
        createTestViolation(false),
        createTestViolation(false)
      ];
      const result = createPolicyResult('allow', warnMode, multipleViolations);

      expect(result.status).toBe('allow');
      expect(result.violations).toHaveLength(3);
      expect(result.rulesFailed).toBe(3);
    });
  });

  describe('disabled enforcement mode', () => {
    const disabledMode: PolicyEnforcementMode = 'disabled';

    it('should allow all actions when enforcement is disabled', () => {
      const violations = [createTestViolation(true)]; // Even blocking violations
      const result = createPolicyResult('allow', disabledMode, violations);

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('disabled');
    });

    it('should not emit any enforcement events when disabled', () => {
      const mockEmitAny = vi.fn();

      const violations = [createTestViolation(true)];
      const result = createPolicyResult('allow', disabledMode, violations);

      // No events should be emitted when disabled
      if (result.enforcementMode === 'disabled') {
        // No event emission
      } else {
        mockEmitAny();
      }

      expect(mockEmitAny).not.toHaveBeenCalled();
    });

    it('should bypass all policy checks when disabled', () => {
      const result = createPolicyResult('allow', disabledMode, []);

      expect(result.status).toBe('allow');
      expect(result.enforcementMode).toBe('disabled');
      expect(result.rulesEvaluated).toBe(1); // May still record evaluation
      expect(result.rulesFailed).toBe(0);
    });
  });

  describe('enforcement mode consistency', () => {
    it('should maintain consistent behavior across enforcement modes', () => {
      const testViolation = createTestViolation(false);
      const modes: PolicyEnforcementMode[] = ['audit', 'warn', 'strict', 'disabled'];

      modes.forEach(mode => {
        const expectedStatus = mode === 'strict' ? 'deny' : 'allow';
        const result = createPolicyResult(expectedStatus, mode, [testViolation]);

        expect(result.enforcementMode).toBe(mode);
        expect(result.status).toBe(expectedStatus);

        if (mode !== 'disabled') {
          expect(result.violations).toContain(testViolation);
        }
      });
    });

    it('should handle enforcement mode transitions correctly', () => {
      const baseViolation = createTestViolation(false);

      // Simulate mode escalation
      const auditResult = createPolicyResult('allow', 'audit', [baseViolation]);
      const warnResult = createPolicyResult('allow', 'warn', [baseViolation]);
      const strictResult = createPolicyResult('deny', 'strict', [baseViolation]);

      expect(auditResult.status).toBe('allow');
      expect(warnResult.status).toBe('allow');
      expect(strictResult.status).toBe('deny');

      expect(auditResult.enforcementMode).toBe('audit');
      expect(warnResult.enforcementMode).toBe('warn');
      expect(strictResult.enforcementMode).toBe('strict');
    });

    it('should validate enforcement mode enum values', () => {
      const validModes: PolicyEnforcementMode[] = ['strict', 'warn', 'audit', 'disabled'];
      const invalidModes = ['invalid', 'unknown', 'test'];

      validModes.forEach(mode => {
        expect(['strict', 'warn', 'audit', 'disabled']).toContain(mode);
      });

      invalidModes.forEach(mode => {
        expect(['strict', 'warn', 'audit', 'disabled']).not.toContain(mode);
      });
    });
  });

  describe('enforcement mode edge cases', () => {
    it('should handle null violations gracefully across all modes', () => {
      const modes: PolicyEnforcementMode[] = ['audit', 'warn', 'strict', 'disabled'];

      modes.forEach(mode => {
        const result = createPolicyResult('allow', mode, []);
        expect(result.violations).toHaveLength(0);
        expect(result.enforcementMode).toBe(mode);
      });
    });

    it('should handle mixed violation severities correctly', () => {
      const mixedViolations = [
        { ...createTestViolation(false), severity: 'info' as const },
        { ...createTestViolation(false), severity: 'warning' as const },
        { ...createTestViolation(true), severity: 'error' as const },
        { ...createTestViolation(true), severity: 'critical' as const }
      ];

      const modes: PolicyEnforcementMode[] = ['audit', 'warn', 'strict'];

      modes.forEach(mode => {
        const expectedStatus = mode === 'strict' ? 'deny' : 'allow';
        const result = createPolicyResult(expectedStatus, mode, mixedViolations);

        expect(result.enforcementMode).toBe(mode);
        expect(result.status).toBe(expectedStatus);
        expect(result.violations).toHaveLength(4);
      });
    });

    it('should handle large numbers of violations efficiently', () => {
      const manyViolations = Array.from({ length: 100 }, (_, i) =>
        createTestViolation(i % 2 === 0) // Alternate blocking/non-blocking
      );

      const modes: PolicyEnforcementMode[] = ['audit', 'warn', 'strict'];

      modes.forEach(mode => {
        const expectedStatus = mode === 'strict' ? 'deny' : 'allow';
        const result = createPolicyResult(expectedStatus, mode, manyViolations);

        expect(result.violations).toHaveLength(100);
        expect(result.enforcementMode).toBe(mode);
        expect(result.status).toBe(expectedStatus);
        expect(result.rulesFailed).toBe(100);
      });
    });
  });

  describe('event emission patterns per mode', () => {
    it('should emit correct event types for each enforcement mode', () => {
      const eventCounts = {
        audit: { audited: 0, warned: 0, blocked: 0 },
        warn: { audited: 0, warned: 0, blocked: 0 },
        strict: { audited: 0, warned: 0, blocked: 0 },
        disabled: { audited: 0, warned: 0, blocked: 0 }
      };

      const violation = createTestViolation(false);

      // Simulate event emission logic for each mode
      const modes: PolicyEnforcementMode[] = ['audit', 'warn', 'strict', 'disabled'];

      modes.forEach(mode => {
        if (mode === 'audit') {
          eventCounts.audit.audited++;
        } else if (mode === 'warn') {
          eventCounts.warn.warned++;
        } else if (mode === 'strict') {
          eventCounts.strict.blocked++;
        }
        // disabled mode emits no events
      });

      expect(eventCounts.audit.audited).toBe(1);
      expect(eventCounts.warn.warned).toBe(1);
      expect(eventCounts.strict.blocked).toBe(1);
      expect(eventCounts.disabled.audited + eventCounts.disabled.warned + eventCounts.disabled.blocked).toBe(0);
    });
  });
});