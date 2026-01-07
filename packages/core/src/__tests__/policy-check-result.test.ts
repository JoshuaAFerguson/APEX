import { describe, it, expect } from 'vitest';
import {
  PolicyCheckResult,
  PolicyCheckResultSchema,
  PolicyCheckStatus,
  PolicyCheckStatusSchema,
  PolicyViolation,
  PolicyViolationSchema,
  PolicyEnforcementMode,
  PolicyEnforcementModeSchema,
  type PolicyCheckResult as PolicyCheckResultType,
  type PolicyViolation as PolicyViolationType,
} from '../types';

describe('PolicyCheckResult Schema and Type', () => {
  describe('PolicyCheckStatusSchema', () => {
    it('should accept valid status values', () => {
      expect(() => PolicyCheckStatusSchema.parse('allow')).not.toThrow();
      expect(() => PolicyCheckStatusSchema.parse('deny')).not.toThrow();
    });

    it('should reject invalid status values', () => {
      expect(() => PolicyCheckStatusSchema.parse('invalid')).toThrow();
      expect(() => PolicyCheckStatusSchema.parse('permit')).toThrow();
      expect(() => PolicyCheckStatusSchema.parse('block')).toThrow();
      expect(() => PolicyCheckStatusSchema.parse(null)).toThrow();
      expect(() => PolicyCheckStatusSchema.parse(undefined)).toThrow();
    });

    it('should provide correct TypeScript types', () => {
      const allowStatus: PolicyCheckStatus = 'allow';
      const denyStatus: PolicyCheckStatus = 'deny';

      expect(allowStatus).toBe('allow');
      expect(denyStatus).toBe('deny');
    });
  });

  describe('PolicyCheckResultSchema', () => {
    const validViolation: PolicyViolationType = {
      id: 'v-123',
      rule: 'test-rule',
      message: 'Test violation message',
      severity: 'warning',
      blocking: false,
      timestamp: new Date(),
      policyType: 'path',
      context: { testData: 'value' }
    };

    it('should accept minimal valid PolicyCheckResult', () => {
      const result: PolicyCheckResultType = {
        status: 'allow',
        violations: [],
        enforcementMode: 'strict',
        checkedAt: new Date()
      };

      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();

      const parsed = PolicyCheckResultSchema.parse(result);
      expect(parsed.status).toBe('allow');
      expect(Array.isArray(parsed.violations)).toBe(true);
      expect(parsed.violations).toHaveLength(0);
      expect(parsed.enforcementMode).toBe('strict');
      expect(parsed.checkedAt).toBeInstanceOf(Date);
    });

    it('should accept complete PolicyCheckResult with all optional fields', () => {
      const result: PolicyCheckResultType = {
        status: 'deny',
        violations: [validViolation],
        enforcementMode: 'warn',
        checkedAt: new Date(),
        policyName: 'Test Policy',
        policyId: 'test-policy-123',
        rulesEvaluated: 10,
        rulesPassed: 8,
        rulesFailed: 2,
        durationMs: 250,
        metadata: {
          requestId: 'req-456',
          sessionId: 'session-789',
          additionalInfo: {
            nested: 'data'
          }
        }
      };

      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();

      const parsed = PolicyCheckResultSchema.parse(result);
      expect(parsed.status).toBe('deny');
      expect(parsed.violations).toHaveLength(1);
      expect(parsed.policyName).toBe('Test Policy');
      expect(parsed.policyId).toBe('test-policy-123');
      expect(parsed.rulesEvaluated).toBe(10);
      expect(parsed.rulesPassed).toBe(8);
      expect(parsed.rulesFailed).toBe(2);
      expect(parsed.durationMs).toBe(250);
      expect(parsed.metadata).toBeDefined();
    });

    it('should accept multiple violations', () => {
      const violations: PolicyViolationType[] = [
        {
          ...validViolation,
          id: 'v-1',
          severity: 'warning',
          blocking: false
        },
        {
          ...validViolation,
          id: 'v-2',
          severity: 'critical',
          blocking: true,
          policyType: 'test'
        },
        {
          ...validViolation,
          id: 'v-3',
          severity: 'info',
          blocking: false,
          policyType: 'approval'
        }
      ];

      const result: PolicyCheckResultType = {
        status: 'deny',
        violations,
        enforcementMode: 'strict',
        checkedAt: new Date()
      };

      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();

      const parsed = PolicyCheckResultSchema.parse(result);
      expect(parsed.violations).toHaveLength(3);
      expect(parsed.violations[0].id).toBe('v-1');
      expect(parsed.violations[1].id).toBe('v-2');
      expect(parsed.violations[2].id).toBe('v-3');
    });

    it('should validate all enforcement modes', () => {
      const enforcementModes: PolicyEnforcementMode[] = ['strict', 'warn', 'monitor'];

      enforcementModes.forEach(mode => {
        const result: PolicyCheckResultType = {
          status: 'allow',
          violations: [],
          enforcementMode: mode,
          checkedAt: new Date()
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.enforcementMode).toBe(mode);
      });
    });

    it('should validate numeric fields with correct types', () => {
      const result: PolicyCheckResultType = {
        status: 'allow',
        violations: [],
        enforcementMode: 'strict',
        checkedAt: new Date(),
        rulesEvaluated: 0,
        rulesPassed: 0,
        rulesFailed: 0,
        durationMs: 0
      };

      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();

      const parsed = PolicyCheckResultSchema.parse(result);
      expect(parsed.rulesEvaluated).toBe(0);
      expect(parsed.rulesPassed).toBe(0);
      expect(parsed.rulesFailed).toBe(0);
      expect(parsed.durationMs).toBe(0);
    });

    it('should handle large numeric values', () => {
      const result: PolicyCheckResultType = {
        status: 'allow',
        violations: [],
        enforcementMode: 'strict',
        checkedAt: new Date(),
        rulesEvaluated: 1000000,
        rulesPassed: 999998,
        rulesFailed: 2,
        durationMs: 30000
      };

      expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();

      const parsed = PolicyCheckResultSchema.parse(result);
      expect(parsed.rulesEvaluated).toBe(1000000);
      expect(parsed.durationMs).toBe(30000);
    });

    describe('Validation Errors', () => {
      it('should reject missing required fields', () => {
        expect(() => PolicyCheckResultSchema.parse({})).toThrow();
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow'
        })).toThrow();
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: []
        })).toThrow();
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict'
        })).toThrow();
      });

      it('should reject invalid status values', () => {
        expect(() => PolicyCheckResultSchema.parse({
          status: 'invalid',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date()
        })).toThrow();
      });

      it('should reject invalid enforcement modes', () => {
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'invalid',
          checkedAt: new Date()
        })).toThrow();
      });

      it('should reject invalid violation arrays', () => {
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: 'not an array',
          enforcementMode: 'strict',
          checkedAt: new Date()
        })).toThrow();

        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [{ invalid: 'violation' }],
          enforcementMode: 'strict',
          checkedAt: new Date()
        })).toThrow();
      });

      it('should reject negative numeric values', () => {
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          rulesEvaluated: -1
        })).toThrow();

        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          rulesPassed: -1
        })).toThrow();

        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          rulesFailed: -1
        })).toThrow();

        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          durationMs: -1
        })).toThrow();
      });

      it('should reject non-integer numeric values', () => {
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          rulesEvaluated: 10.5
        })).toThrow();

        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          durationMs: 100.7
        })).toThrow();
      });

      it('should reject invalid date types', () => {
        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: 'not a date'
        })).toThrow();

        expect(() => PolicyCheckResultSchema.parse({
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: 1234567890
        })).toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty metadata', () => {
        const result: PolicyCheckResultType = {
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          metadata: {}
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.metadata).toEqual({});
      });

      it('should handle complex nested metadata', () => {
        const complexMetadata = {
          level1: {
            level2: {
              level3: {
                array: [1, 2, 3, { nested: true }],
                string: 'value',
                number: 42,
                boolean: false,
                nullValue: null
              }
            }
          },
          topLevelArray: ['a', 'b', 'c']
        };

        const result: PolicyCheckResultType = {
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          metadata: complexMetadata
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.metadata).toEqual(complexMetadata);
      });

      it('should handle very long string values', () => {
        const longString = 'A'.repeat(10000);

        const result: PolicyCheckResultType = {
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          policyName: longString,
          policyId: longString
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.policyName).toHaveLength(10000);
        expect(parsed.policyId).toHaveLength(10000);
      });

      it('should handle edge case dates', () => {
        const edgeDates = [
          new Date('1970-01-01T00:00:00.000Z'), // Unix epoch
          new Date('2099-12-31T23:59:59.999Z'), // Future date
          new Date(), // Current time
        ];

        edgeDates.forEach(date => {
          const result: PolicyCheckResultType = {
            status: 'allow',
            violations: [],
            enforcementMode: 'strict',
            checkedAt: date
          };

          expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
          const parsed = PolicyCheckResultSchema.parse(result);
          expect(parsed.checkedAt).toEqual(date);
        });
      });
    });

    describe('Real-world Scenarios', () => {
      it('should handle successful policy check with no violations', () => {
        const result: PolicyCheckResultType = {
          status: 'allow',
          violations: [],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          policyName: 'File Access Policy',
          policyId: 'file-access-v1',
          rulesEvaluated: 5,
          rulesPassed: 5,
          rulesFailed: 0,
          durationMs: 15,
          metadata: {
            requestId: 'req-abc123',
            evaluationEngine: 'apex-policy-v1.0.0'
          }
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.status).toBe('allow');
        expect(parsed.rulesPassed).toBe(5);
        expect(parsed.rulesFailed).toBe(0);
      });

      it('should handle failed policy check with blocking violations', () => {
        const violations: PolicyViolationType[] = [
          {
            id: 'v-secret-detected',
            rule: 'no-secrets-in-code',
            message: 'API key detected in source file',
            severity: 'critical',
            blocking: true,
            timestamp: new Date(),
            policyType: 'path',
            context: {
              filePath: 'src/config.ts',
              lineNumber: 15,
              secretType: 'api-key'
            }
          }
        ];

        const result: PolicyCheckResultType = {
          status: 'deny',
          violations,
          enforcementMode: 'strict',
          checkedAt: new Date(),
          policyName: 'Security Policy',
          policyId: 'security-v2',
          rulesEvaluated: 12,
          rulesPassed: 11,
          rulesFailed: 1,
          durationMs: 45,
          metadata: {
            scanType: 'full',
            riskScore: 9.5
          }
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.status).toBe('deny');
        expect(parsed.violations).toHaveLength(1);
        expect(parsed.violations[0].blocking).toBe(true);
      });

      it('should handle mixed violations with warn mode', () => {
        const violations: PolicyViolationType[] = [
          {
            id: 'v-test-coverage',
            rule: 'minimum-test-coverage',
            message: 'Test coverage below 80%',
            severity: 'warning',
            blocking: false,
            timestamp: new Date(),
            policyType: 'test',
            context: { coverage: 75 }
          },
          {
            id: 'v-path-restriction',
            rule: 'restricted-path-access',
            message: 'Access to restricted path attempted',
            severity: 'info',
            blocking: false,
            timestamp: new Date(),
            policyType: 'path',
            context: { attemptedPath: '/admin/secrets' }
          }
        ];

        const result: PolicyCheckResultType = {
          status: 'allow', // Non-blocking violations in warn mode
          violations,
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'Development Guidelines',
          policyId: 'dev-guidelines-v1',
          rulesEvaluated: 20,
          rulesPassed: 18,
          rulesFailed: 2,
          durationMs: 125
        };

        expect(() => PolicyCheckResultSchema.parse(result)).not.toThrow();
        const parsed = PolicyCheckResultSchema.parse(result);
        expect(parsed.status).toBe('allow');
        expect(parsed.violations).toHaveLength(2);
        expect(parsed.violations.every(v => !v.blocking)).toBe(true);
      });
    });
  });
});