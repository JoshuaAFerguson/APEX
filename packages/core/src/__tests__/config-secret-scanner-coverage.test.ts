import { describe, it, expect } from 'vitest';
import {
  SecretScannerConfigSchema,
  SecretDetectionBehaviorSchema,
  SecretPatternSchema,
  ApexConfigSchema
} from '../types';
import { getEffectiveConfig } from '../config';

describe('SecretScanner Configuration Coverage', () => {
  describe('Comprehensive Schema Coverage', () => {
    it('should cover all SecretDetectionBehavior enum values', () => {
      const behaviors = ['log', 'warn', 'mask', 'block'];

      behaviors.forEach(behavior => {
        expect(() => SecretDetectionBehaviorSchema.parse(behavior))
          .not.toThrow(`Behavior '${behavior}' should be valid`);
      });
    });

    it('should cover all SecretPattern severity levels', () => {
      const severities = ['critical', 'high', 'medium', 'low'];

      severities.forEach(severity => {
        const pattern = {
          name: 'Test Pattern',
          pattern: 'TEST_.*',
          severity: severity
        };

        expect(() => SecretPatternSchema.parse(pattern))
          .not.toThrow(`Severity '${severity}' should be valid`);
      });
    });

    it('should verify all SecretScannerConfig fields are covered', () => {
      const fullConfig = {
        customPatterns: [
          {
            name: 'Full Pattern',
            pattern: 'FULL_[A-Z0-9]+',
            severity: 'critical',
            description: 'A complete pattern with all fields'
          }
        ],
        includeBuiltInPatterns: false,
        maxLineLength: 5000,
        maskSecrets: false,
        contextLength: 30,
        onSecretDetected: 'block'
      };

      const parsed = SecretScannerConfigSchema.parse(fullConfig);
      expect(parsed.customPatterns).toHaveLength(1);
      expect(parsed.includeBuiltInPatterns).toBe(false);
      expect(parsed.maxLineLength).toBe(5000);
      expect(parsed.maskSecrets).toBe(false);
      expect(parsed.contextLength).toBe(30);
      expect(parsed.onSecretDetected).toBe('block');
    });

    it('should verify APEX config integration completeness', () => {
      const configWithScanner = {
        version: '1.0',
        project: { name: 'coverage-test' },
        scanner: {
          onSecretDetected: 'mask',
          customPatterns: [
            {
              name: 'Coverage Pattern',
              pattern: 'COV_\\w+'
            }
          ]
        }
      };

      const parsed = ApexConfigSchema.parse(configWithScanner);
      expect(parsed.scanner).toBeDefined();
      expect(parsed.scanner!.onSecretDetected).toBe('mask');
      expect(parsed.scanner!.customPatterns).toHaveLength(1);
    });

    it('should verify effective config handles all cases', () => {
      // Test with no scanner config
      const baseConfig = {
        version: '1.0' as const,
        project: { name: 'test' }
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.scanner).toBeDefined();

      // Test with partial scanner config
      const partialConfig = {
        version: '1.0' as const,
        project: { name: 'test' },
        scanner: {
          onSecretDetected: 'log' as const
        }
      };

      const partialEffective = getEffectiveConfig(partialConfig);
      expect(partialEffective.scanner.onSecretDetected).toBe('log');
      expect(partialEffective.scanner.maskSecrets).toBe(true); // default
    });

    it('should test edge cases for numeric fields', () => {
      const edgeCases = [
        { maxLineLength: 0, contextLength: 0 },
        { maxLineLength: 1, contextLength: 1 },
        { maxLineLength: 999999, contextLength: 999999 },
      ];

      edgeCases.forEach((testCase, index) => {
        expect(() => SecretScannerConfigSchema.parse(testCase))
          .not.toThrow(`Edge case ${index} should be valid`);
      });
    });

    it('should test empty and minimal configurations', () => {
      const configs = [
        {},  // completely empty
        { customPatterns: [] },  // empty patterns
        { onSecretDetected: 'warn' },  // only behavior
        { maskSecrets: true },  // only masking
        { includeBuiltInPatterns: true },  // only built-ins
      ];

      configs.forEach((config, index) => {
        expect(() => SecretScannerConfigSchema.parse(config))
          .not.toThrow(`Minimal config ${index} should be valid`);
      });
    });
  });

  describe('Error Path Coverage', () => {
    it('should test all invalid onSecretDetected values', () => {
      const invalidValues = [
        'invalid', 'error', 'throw', 'ignore', 'stop', 'continue',
        '', '  ', null, undefined, 123, true, false, [], {}
      ];

      invalidValues.forEach(value => {
        expect(() => SecretDetectionBehaviorSchema.parse(value))
          .toThrow(`Invalid value '${value}' should be rejected`);
      });
    });

    it('should test all invalid pattern configurations', () => {
      const invalidPatterns = [
        null,
        undefined,
        '',
        123,
        { name: 'test' }, // missing pattern
        { pattern: 'test' }, // missing name
        { name: '', pattern: 'test' }, // empty name
        { name: 'test', pattern: '' }, // empty pattern
        { name: 'test', pattern: 'test', severity: 'invalid' }, // invalid severity
      ];

      invalidPatterns.forEach((pattern, index) => {
        expect(() => SecretPatternSchema.parse(pattern))
          .toThrow(`Invalid pattern ${index} should be rejected`);
      });
    });

    it('should test invalid field types', () => {
      const invalidConfigs = [
        { maskSecrets: 'true' }, // string instead of boolean
        { includeBuiltInPatterns: 1 }, // number instead of boolean
        { maxLineLength: '1000' }, // string instead of number
        { contextLength: true }, // boolean instead of number
        { customPatterns: 'pattern' }, // string instead of array
        { onSecretDetected: 123 }, // number instead of string enum
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => SecretScannerConfigSchema.parse(config))
          .toThrow(`Invalid config type ${index} should be rejected`);
      });
    });
  });

  describe('Type Safety Coverage', () => {
    it('should ensure proper TypeScript types are inferred', () => {
      const config = SecretScannerConfigSchema.parse({});

      // These should be properly typed
      expect(typeof config.onSecretDetected).toBe('string');
      expect(typeof config.maskSecrets).toBe('boolean');
      expect(typeof config.includeBuiltInPatterns).toBe('boolean');
      expect(typeof config.maxLineLength).toBe('number');
      expect(typeof config.contextLength).toBe('number');
      expect(Array.isArray(config.customPatterns)).toBe(true);
    });

    it('should verify pattern type structure', () => {
      const pattern = SecretPatternSchema.parse({
        name: 'Test',
        pattern: 'test.*'
      });

      expect(typeof pattern.name).toBe('string');
      expect(typeof pattern.pattern).toBe('string');
      expect(typeof pattern.severity).toBe('string');
      expect(pattern.description).toBeUndefined();

      const patternWithDesc = SecretPatternSchema.parse({
        name: 'Test',
        pattern: 'test.*',
        description: 'A test pattern'
      });

      expect(typeof patternWithDesc.description).toBe('string');
    });
  });
});