import { describe, it, expect } from 'vitest';
import {
  GuardrailConfigSchema,
  GuardrailConfig,
  EnforcementModeSchema,
  EnforcementMode,
  SecretDetectionSchema,
  SecretDetection,
  PolicyRuleSchema,
  SecretPatternSchema,
  SecretDetectionBehaviorSchema
} from '../types';

describe('GuardrailConfig Schema Tests', () => {
  describe('GuardrailConfigSchema', () => {
    it('should parse minimal valid configuration', () => {
      const minimalConfig = {};

      const result = GuardrailConfigSchema.parse(minimalConfig);

      expect(result.enabled).toBe(true);
      expect(result.enforcement).toBe('warn');
    });

    it('should parse complete valid configuration', () => {
      const completeConfig = {
        enabled: true,
        enforcement: 'block',
        policies: {
          enabled: true,
          enforcement: 'warn',
          policyPath: './policies',
          rules: [
            {
              id: 'test-rule',
              name: 'Test Rule',
              description: 'A test policy rule',
              enabled: true,
              enforcement: 'warn'
            }
          ]
        },
        secrets: {
          enabled: true,
          enforcement: 'audit',
          onDetection: 'mask',
          includeBuiltInPatterns: false,
          customPatterns: [
            {
              name: 'Test Pattern',
              pattern: 'CUSTOM_[A-Z0-9]{8}',
              severity: 'high',
              description: 'Test secret pattern'
            }
          ],
          excludePaths: ['/tmp', '/node_modules'],
          excludePatterns: ['*.test.js', '*.spec.ts']
        },
        reporting: {
          enabled: true,
          format: 'sarif',
          outputPath: './reports/guardrails.sarif'
        }
      };

      expect(() => GuardrailConfigSchema.parse(completeConfig)).not.toThrow();

      const result = GuardrailConfigSchema.parse(completeConfig);
      expect(result.enabled).toBe(true);
      expect(result.enforcement).toBe('block');
      expect(result.policies?.enabled).toBe(true);
      expect(result.policies?.enforcement).toBe('warn');
      expect(result.policies?.policyPath).toBe('./policies');
      expect(result.policies?.rules).toHaveLength(1);
      expect(result.secrets?.enabled).toBe(true);
      expect(result.secrets?.enforcement).toBe('audit');
      expect(result.secrets?.onDetection).toBe('mask');
      expect(result.secrets?.customPatterns).toHaveLength(1);
      expect(result.secrets?.excludePaths).toHaveLength(2);
      expect(result.reporting?.format).toBe('sarif');
    });

    it('should apply default values correctly', () => {
      const configWithSomeDefaults = {
        enabled: false,
        policies: {
          policyPath: './custom-policies'
        },
        secrets: {
          customPatterns: []
        }
      };

      const result = GuardrailConfigSchema.parse(configWithSomeDefaults);

      expect(result.enabled).toBe(false);
      expect(result.enforcement).toBe('warn'); // default
      expect(result.policies?.enabled).toBe(true); // default
      expect(result.policies?.enforcement).toBeUndefined(); // optional, no default
      expect(result.policies?.rules).toHaveLength(0); // default empty array
      expect(result.secrets?.enabled).toBe(true); // default
      expect(result.secrets?.onDetection).toBe('warn'); // default
      expect(result.secrets?.includeBuiltInPatterns).toBe(true); // default
      expect(result.secrets?.customPatterns).toHaveLength(0);
      expect(result.reporting?.enabled).toBe(true); // default
      expect(result.reporting?.format).toBe('json'); // default
    });

    it('should validate enforcement modes correctly', () => {
      const validModes: EnforcementMode[] = ['warn', 'block', 'audit'];

      for (const mode of validModes) {
        const config = { enforcement: mode };
        expect(() => GuardrailConfigSchema.parse(config)).not.toThrow();
      }

      const invalidConfig = { enforcement: 'invalid' };
      expect(() => GuardrailConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate policies configuration', () => {
      const validPoliciesConfig = {
        policies: {
          enabled: true,
          enforcement: 'block',
          policyPath: '/path/to/policies',
          rules: [
            {
              id: 'rule-1',
              name: 'Rule 1',
              enabled: true
            }
          ]
        }
      };

      expect(() => GuardrailConfigSchema.parse(validPoliciesConfig)).not.toThrow();

      // Test with invalid policy rule
      const invalidPoliciesConfig = {
        policies: {
          rules: [
            {
              // missing required id and name
              enabled: true
            }
          ]
        }
      };

      expect(() => GuardrailConfigSchema.parse(invalidPoliciesConfig)).toThrow();
    });

    it('should validate secrets configuration', () => {
      const validSecretsConfig = {
        secrets: {
          enabled: false,
          enforcement: 'warn',
          onDetection: 'block',
          includeBuiltInPatterns: false,
          customPatterns: [
            {
              name: 'Custom Test Pattern',
              pattern: 'custom_test_[a-f0-9]{8}',
              severity: 'critical'
            }
          ],
          excludePaths: ['/vendor'],
          excludePatterns: ['*.log']
        }
      };

      expect(() => GuardrailConfigSchema.parse(validSecretsConfig)).not.toThrow();

      // Test with invalid secret pattern
      const invalidSecretsConfig = {
        secrets: {
          customPatterns: [
            {
              // missing required name and pattern
              severity: 'high'
            }
          ]
        }
      };

      expect(() => GuardrailConfigSchema.parse(invalidSecretsConfig)).toThrow();
    });

    it('should validate reporting configuration', () => {
      const validFormats = ['json', 'text', 'sarif'] as const;

      for (const format of validFormats) {
        const config = {
          reporting: {
            format,
            outputPath: `./reports/output.${format}`
          }
        };
        expect(() => GuardrailConfigSchema.parse(config)).not.toThrow();
      }

      const invalidReportingConfig = {
        reporting: {
          format: 'xml' // invalid format
        }
      };

      expect(() => GuardrailConfigSchema.parse(invalidReportingConfig)).toThrow();
    });

    it('should handle nested optional configurations', () => {
      const partialConfig = {
        enabled: true,
        policies: {
          enabled: false
          // other policy fields are optional
        },
        secrets: {
          enforcement: 'audit'
          // other secret fields are optional
        }
        // reporting is entirely optional
      };

      expect(() => GuardrailConfigSchema.parse(partialConfig)).not.toThrow();

      const result = GuardrailConfigSchema.parse(partialConfig);
      expect(result.policies?.enabled).toBe(false);
      expect(result.policies?.rules).toHaveLength(0); // default empty array
      expect(result.secrets?.enforcement).toBe('audit');
      expect(result.secrets?.enabled).toBe(true); // default
      expect(result.reporting?.enabled).toBe(true); // default
    });

    it('should reject invalid boolean values', () => {
      const invalidConfigs = [
        { enabled: 'true' },
        { policies: { enabled: 1 } },
        { secrets: { includeBuiltInPatterns: 'false' } },
        { reporting: { enabled: null } }
      ];

      for (const config of invalidConfigs) {
        expect(() => GuardrailConfigSchema.parse(config)).toThrow();
      }
    });

    it('should reject invalid array values', () => {
      const invalidConfigs = [
        { policies: { rules: 'not-an-array' } },
        { secrets: { customPatterns: {} } },
        { secrets: { excludePaths: 'path1,path2' } },
        { secrets: { excludePatterns: ['pattern1', 123] } }
      ];

      for (const config of invalidConfigs) {
        expect(() => GuardrailConfigSchema.parse(config)).toThrow();
      }
    });
  });

  describe('EnforcementModeSchema', () => {
    it('should accept valid enforcement modes', () => {
      const validModes = ['warn', 'block', 'audit'];

      for (const mode of validModes) {
        expect(() => EnforcementModeSchema.parse(mode)).not.toThrow();
        expect(EnforcementModeSchema.parse(mode)).toBe(mode);
      }
    });

    it('should reject invalid enforcement modes', () => {
      const invalidModes = [
        'strict',
        'disabled',
        'enforce',
        'require',
        '',
        null,
        undefined,
        123,
        true,
        ['warn']
      ];

      for (const mode of invalidModes) {
        expect(() => EnforcementModeSchema.parse(mode)).toThrow();
      }
    });

    it('should be case-sensitive', () => {
      const caseSensitiveModes = ['WARN', 'Block', 'AUDIT', 'Warn'];

      for (const mode of caseSensitiveModes) {
        expect(() => EnforcementModeSchema.parse(mode)).toThrow();
      }
    });
  });
});