import { describe, it, expect } from 'vitest';
import {
  PolicyCheckOptions,
  PolicyCheckOptionsSchema,
  PolicyEnforcementMode,
  PolicyEnforcementModeSchema,
  type PolicyCheckOptions as PolicyCheckOptionsType,
} from '../types';

describe('PolicyCheckOptions Schema and Type', () => {
  describe('PolicyCheckOptionsSchema', () => {
    it('should accept empty options object (all fields optional)', () => {
      const options: PolicyCheckOptionsType = {};

      expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

      const parsed = PolicyCheckOptionsSchema.parse(options);
      expect(parsed.enforcementMode).toBeUndefined();
      expect(parsed.policyIds).toBeUndefined();
      expect(parsed.continueOnViolation).toBe(true); // Default value
      expect(parsed.maxViolations).toBe(0); // Default value
      expect(parsed.includeWarnings).toBe(true); // Default value
      expect(parsed.timeoutMs).toBeUndefined();
    });

    it('should apply default values correctly', () => {
      const options: PolicyCheckOptionsType = {
        enforcementMode: 'warn'
      };

      const parsed = PolicyCheckOptionsSchema.parse(options);
      expect(parsed.enforcementMode).toBe('warn');
      expect(parsed.continueOnViolation).toBe(true);
      expect(parsed.maxViolations).toBe(0);
      expect(parsed.includeWarnings).toBe(true);
    });

    it('should accept all optional fields with valid values', () => {
      const options: PolicyCheckOptionsType = {
        enforcementMode: 'strict',
        policyIds: ['policy-1', 'policy-2', 'policy-3'],
        continueOnViolation: false,
        maxViolations: 5,
        includeWarnings: false,
        timeoutMs: 10000
      };

      expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

      const parsed = PolicyCheckOptionsSchema.parse(options);
      expect(parsed.enforcementMode).toBe('strict');
      expect(parsed.policyIds).toEqual(['policy-1', 'policy-2', 'policy-3']);
      expect(parsed.continueOnViolation).toBe(false);
      expect(parsed.maxViolations).toBe(5);
      expect(parsed.includeWarnings).toBe(false);
      expect(parsed.timeoutMs).toBe(10000);
    });

    describe('Enforcement Mode Validation', () => {
      it('should accept all valid enforcement modes', () => {
        const enforcementModes: PolicyEnforcementMode[] = ['strict', 'warn', 'monitor'];

        enforcementModes.forEach(mode => {
          const options: PolicyCheckOptionsType = {
            enforcementMode: mode
          };

          expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
          const parsed = PolicyCheckOptionsSchema.parse(options);
          expect(parsed.enforcementMode).toBe(mode);
        });
      });

      it('should reject invalid enforcement modes', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          enforcementMode: 'invalid' as any
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          enforcementMode: 'block' as any
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          enforcementMode: null as any
        })).toThrow();
      });
    });

    describe('Policy IDs Array Validation', () => {
      it('should accept empty policy IDs array', () => {
        const options: PolicyCheckOptionsType = {
          policyIds: []
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual([]);
      });

      it('should accept single policy ID', () => {
        const options: PolicyCheckOptionsType = {
          policyIds: ['single-policy']
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual(['single-policy']);
      });

      it('should accept multiple policy IDs', () => {
        const policyIds = [
          'security-policy-v1',
          'compliance-policy-v2',
          'development-guidelines',
          'testing-requirements',
          'approval-workflow'
        ];

        const options: PolicyCheckOptionsType = {
          policyIds
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual(policyIds);
        expect(parsed.policyIds).toHaveLength(5);
      });

      it('should handle policy IDs with special characters', () => {
        const specialPolicyIds = [
          'policy-with-dashes',
          'policy_with_underscores',
          'policy.with.dots',
          'policy:with:colons',
          'policy@with@symbols',
          'policy123with456numbers',
          'POLICY_WITH_UPPERCASE'
        ];

        const options: PolicyCheckOptionsType = {
          policyIds: specialPolicyIds
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual(specialPolicyIds);
      });

      it('should reject non-string elements in policy IDs array', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: [123, 'valid-policy']
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: ['valid-policy', null]
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: ['valid-policy', undefined]
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: [true, 'valid-policy']
        })).toThrow();
      });

      it('should reject non-array policy IDs', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: 'not-an-array'
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: { policy: 'object' }
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          policyIds: 123
        })).toThrow();
      });
    });

    describe('Boolean Options Validation', () => {
      it('should validate continueOnViolation boolean values', () => {
        [true, false].forEach(value => {
          const options: PolicyCheckOptionsType = {
            continueOnViolation: value
          };

          expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
          const parsed = PolicyCheckOptionsSchema.parse(options);
          expect(parsed.continueOnViolation).toBe(value);
        });
      });

      it('should validate includeWarnings boolean values', () => {
        [true, false].forEach(value => {
          const options: PolicyCheckOptionsType = {
            includeWarnings: value
          };

          expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
          const parsed = PolicyCheckOptionsSchema.parse(options);
          expect(parsed.includeWarnings).toBe(value);
        });
      });

      it('should reject non-boolean values for boolean fields', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          continueOnViolation: 'true'
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          continueOnViolation: 1
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          includeWarnings: 'false'
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          includeWarnings: 0
        })).toThrow();
      });
    });

    describe('Numeric Options Validation', () => {
      it('should accept valid maxViolations values', () => {
        const validValues = [0, 1, 5, 10, 100, 1000];

        validValues.forEach(value => {
          const options: PolicyCheckOptionsType = {
            maxViolations: value
          };

          expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
          const parsed = PolicyCheckOptionsSchema.parse(options);
          expect(parsed.maxViolations).toBe(value);
        });
      });

      it('should accept valid timeoutMs values', () => {
        const validValues = [0, 100, 1000, 5000, 30000, 60000, 300000];

        validValues.forEach(value => {
          const options: PolicyCheckOptionsType = {
            timeoutMs: value
          };

          expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
          const parsed = PolicyCheckOptionsSchema.parse(options);
          expect(parsed.timeoutMs).toBe(value);
        });
      });

      it('should reject negative maxViolations values', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          maxViolations: -1
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          maxViolations: -100
        })).toThrow();
      });

      it('should reject negative timeoutMs values', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          timeoutMs: -1
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          timeoutMs: -1000
        })).toThrow();
      });

      it('should reject non-integer numeric values', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          maxViolations: 10.5
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          maxViolations: 3.14
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          timeoutMs: 1000.5
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          timeoutMs: 5000.99
        })).toThrow();
      });

      it('should reject non-numeric values for numeric fields', () => {
        expect(() => PolicyCheckOptionsSchema.parse({
          maxViolations: '5'
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          maxViolations: true
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          timeoutMs: '10000'
        })).toThrow();

        expect(() => PolicyCheckOptionsSchema.parse({
          timeoutMs: false
        })).toThrow();
      });
    });

    describe('Real-world Configuration Scenarios', () => {
      it('should handle strict security policy options', () => {
        const options: PolicyCheckOptionsType = {
          enforcementMode: 'strict',
          policyIds: [
            'security-secrets-detection',
            'security-file-permissions',
            'security-command-whitelist'
          ],
          continueOnViolation: false, // Stop on first violation
          maxViolations: 1,
          includeWarnings: false, // Only show blocking violations
          timeoutMs: 5000 // Fast evaluation required
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.enforcementMode).toBe('strict');
        expect(parsed.continueOnViolation).toBe(false);
        expect(parsed.maxViolations).toBe(1);
        expect(parsed.includeWarnings).toBe(false);
        expect(parsed.policyIds).toHaveLength(3);
      });

      it('should handle development mode options', () => {
        const options: PolicyCheckOptionsType = {
          enforcementMode: 'warn',
          continueOnViolation: true, // Continue checking all policies
          maxViolations: 0, // Unlimited violations
          includeWarnings: true, // Include all violations
          timeoutMs: 30000 // Allow longer evaluation time
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.enforcementMode).toBe('warn');
        expect(parsed.continueOnViolation).toBe(true);
        expect(parsed.maxViolations).toBe(0);
        expect(parsed.includeWarnings).toBe(true);
        expect(parsed.timeoutMs).toBe(30000);
      });

      it('should handle monitoring mode options', () => {
        const options: PolicyCheckOptionsType = {
          enforcementMode: 'monitor',
          policyIds: [
            'monitoring-performance',
            'monitoring-usage-patterns',
            'monitoring-error-rates'
          ],
          continueOnViolation: true,
          maxViolations: 50, // Collect many violations for analysis
          includeWarnings: true,
          timeoutMs: 60000 // Allow extensive monitoring time
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.enforcementMode).toBe('monitor');
        expect(parsed.maxViolations).toBe(50);
        expect(parsed.timeoutMs).toBe(60000);
      });

      it('should handle CI/CD pipeline options', () => {
        const options: PolicyCheckOptionsType = {
          enforcementMode: 'strict',
          policyIds: [
            'ci-test-coverage',
            'ci-build-quality',
            'ci-security-scan',
            'ci-license-compliance'
          ],
          continueOnViolation: true, // Get full report
          maxViolations: 10, // Limit report size
          includeWarnings: false, // Only failures
          timeoutMs: 120000 // 2 minutes for CI
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toContain('ci-test-coverage');
        expect(parsed.timeoutMs).toBe(120000);
      });

      it('should handle selective policy testing', () => {
        const options: PolicyCheckOptionsType = {
          policyIds: ['single-test-policy'],
          continueOnViolation: false,
          maxViolations: 1,
          timeoutMs: 1000
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();

        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual(['single-test-policy']);
        expect(parsed.maxViolations).toBe(1);
      });
    });

    describe('Edge Cases', () => {
      it('should handle very large arrays of policy IDs', () => {
        const largePolicyIds = Array.from({ length: 1000 }, (_, i) => `policy-${i}`);

        const options: PolicyCheckOptionsType = {
          policyIds: largePolicyIds
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toHaveLength(1000);
      });

      it('should handle very long policy ID strings', () => {
        const longPolicyId = 'very-long-policy-id-' + 'x'.repeat(1000);

        const options: PolicyCheckOptionsType = {
          policyIds: [longPolicyId]
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds![0]).toHaveLength(longPolicyId.length);
      });

      it('should handle maximum safe integer values', () => {
        const maxSafeInteger = Number.MAX_SAFE_INTEGER;

        const options: PolicyCheckOptionsType = {
          maxViolations: maxSafeInteger,
          timeoutMs: maxSafeInteger
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.maxViolations).toBe(maxSafeInteger);
        expect(parsed.timeoutMs).toBe(maxSafeInteger);
      });

      it('should handle empty string policy IDs (though not recommended)', () => {
        const options: PolicyCheckOptionsType = {
          policyIds: ['']
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual(['']);
      });

      it('should handle Unicode characters in policy IDs', () => {
        const unicodePolicyIds = [
          '策略-1', // Chinese
          'política-2', // Spanish with accent
          'политика-3', // Cyrillic
          'πολιτική-4', // Greek
          'policy-🚀-5' // Emoji
        ];

        const options: PolicyCheckOptionsType = {
          policyIds: unicodePolicyIds
        };

        expect(() => PolicyCheckOptionsSchema.parse(options)).not.toThrow();
        const parsed = PolicyCheckOptionsSchema.parse(options);
        expect(parsed.policyIds).toEqual(unicodePolicyIds);
      });
    });

    describe('Type Safety', () => {
      it('should provide correct TypeScript types for all fields', () => {
        // This test mainly ensures TypeScript compilation works correctly
        const options: PolicyCheckOptionsType = {
          enforcementMode: 'warn',
          policyIds: ['test-policy'],
          continueOnViolation: true,
          maxViolations: 10,
          includeWarnings: false,
          timeoutMs: 5000
        };

        // Type assertion to ensure correct types
        const enforcementMode: PolicyEnforcementMode | undefined = options.enforcementMode;
        const policyIds: string[] | undefined = options.policyIds;
        const continueOnViolation: boolean | undefined = options.continueOnViolation;
        const maxViolations: number | undefined = options.maxViolations;
        const includeWarnings: boolean | undefined = options.includeWarnings;
        const timeoutMs: number | undefined = options.timeoutMs;

        expect(typeof enforcementMode).toBe('string');
        expect(Array.isArray(policyIds)).toBe(true);
        expect(typeof continueOnViolation).toBe('boolean');
        expect(typeof maxViolations).toBe('number');
        expect(typeof includeWarnings).toBe('boolean');
        expect(typeof timeoutMs).toBe('number');
      });
    });
  });
});