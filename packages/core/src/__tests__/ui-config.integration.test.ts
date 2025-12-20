import { describe, it, expect } from 'vitest';
import { UIConfigSchema, ApexConfigSchema } from '../types';
import { getEffectiveConfig } from '../config';

describe('UI Config Integration Tests', () => {
  describe('UIConfigSchema with edge cases', () => {
    it('should validate previewConfidence edge values correctly', () => {
      // Test boundary values
      expect(() => UIConfigSchema.parse({ previewConfidence: 0.0 })).not.toThrow();
      expect(() => UIConfigSchema.parse({ previewConfidence: 1.0 })).not.toThrow();

      // Test precision values
      expect(() => UIConfigSchema.parse({ previewConfidence: 0.999999 })).not.toThrow();
      expect(() => UIConfigSchema.parse({ previewConfidence: 0.000001 })).not.toThrow();

      // Test invalid values
      expect(() => UIConfigSchema.parse({ previewConfidence: -0.000001 })).toThrow('Number must be greater than or equal to 0');
      expect(() => UIConfigSchema.parse({ previewConfidence: 1.000001 })).toThrow('Number must be less than or equal to 1');
    });

    it('should validate previewTimeout edge values correctly', () => {
      // Test boundary values
      expect(() => UIConfigSchema.parse({ previewTimeout: 1000 })).not.toThrow();
      expect(() => UIConfigSchema.parse({ previewTimeout: 999 })).toThrow('Number must be greater than or equal to 1000');

      // Test large values
      expect(() => UIConfigSchema.parse({ previewTimeout: 60000 })).not.toThrow();
      expect(() => UIConfigSchema.parse({ previewTimeout: Number.MAX_SAFE_INTEGER })).not.toThrow();

      // Test invalid values
      expect(() => UIConfigSchema.parse({ previewTimeout: 0 })).toThrow();
      expect(() => UIConfigSchema.parse({ previewTimeout: -1 })).toThrow();
    });

    it('should handle complex nested UI config scenarios', () => {
      const config = UIConfigSchema.parse({
        previewMode: true,
        previewConfidence: 0.85,
        autoExecuteHighConfidence: true,
        previewTimeout: 15000,
      });

      expect(config).toEqual({
        previewMode: true,
        previewConfidence: 0.85,
        autoExecuteHighConfidence: true,
        previewTimeout: 15000,
      });
    });

    it('should handle conflicting boolean combinations gracefully', () => {
      // Test logical combinations that might be unusual but valid
      const config1 = UIConfigSchema.parse({
        previewMode: false,
        autoExecuteHighConfidence: true, // This combination might seem odd but is valid
      });
      expect(config1.previewMode).toBe(false);
      expect(config1.autoExecuteHighConfidence).toBe(true);

      const config2 = UIConfigSchema.parse({
        previewMode: true,
        autoExecuteHighConfidence: false,
        previewConfidence: 0.95, // High confidence but no auto-execute
      });
      expect(config2.previewMode).toBe(true);
      expect(config2.autoExecuteHighConfidence).toBe(false);
      expect(config2.previewConfidence).toBe(0.95);
    });
  });

  describe('UI Config in Full ApexConfig Context', () => {
    it('should properly integrate UI config in complete ApexConfig', () => {
      const fullConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-merge',
          overrides: {
            testing: 'full',
          },
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.8,
          autoExecuteHighConfidence: true,
          previewTimeout: 10000,
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
        },
      });

      expect(fullConfig.ui.previewMode).toBe(true);
      expect(fullConfig.ui.previewConfidence).toBe(0.8);
      expect(fullConfig.ui.autoExecuteHighConfidence).toBe(true);
      expect(fullConfig.ui.previewTimeout).toBe(10000);
    });

    it('should handle UI config with minimal ApexConfig', () => {
      const minimalConfig = ApexConfigSchema.parse({
        project: {
          name: 'minimal-test',
        },
        ui: {
          previewMode: false,
        },
      });

      expect(minimalConfig.ui.previewMode).toBe(false);
      expect(minimalConfig.ui.previewConfidence).toBe(0.7); // default
      expect(minimalConfig.ui.autoExecuteHighConfidence).toBe(false); // default
      expect(minimalConfig.ui.previewTimeout).toBe(5000); // default
    });
  });

  describe('UI Config with Effective Config Merging', () => {
    it('should merge UI config defaults correctly via getEffectiveConfig', () => {
      const partialConfig = {
        version: '1.0' as const,
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: false,
          previewConfidence: 0.9,
          // autoExecuteHighConfidence and previewTimeout should get defaults
        },
      };

      const effectiveConfig = getEffectiveConfig(partialConfig);

      expect(effectiveConfig.ui.previewMode).toBe(false);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.9);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false); // default
      expect(effectiveConfig.ui.previewTimeout).toBe(5000); // default
    });

    it('should preserve all explicitly set UI config values', () => {
      const explicitConfig = {
        version: '1.0' as const,
        project: {
          name: 'explicit-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: false,
          previewConfidence: 0.95,
          autoExecuteHighConfidence: true,
          previewTimeout: 12000,
        },
      };

      const effectiveConfig = getEffectiveConfig(explicitConfig);

      expect(effectiveConfig.ui.previewMode).toBe(false);
      expect(effectiveConfig.ui.previewConfidence).toBe(0.95);
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(true);
      expect(effectiveConfig.ui.previewTimeout).toBe(12000);
    });

    it('should handle empty UI config with all defaults', () => {
      const configWithoutUI = {
        version: '1.0' as const,
        project: {
          name: 'no-ui-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const effectiveConfig = getEffectiveConfig(configWithoutUI);

      expect(effectiveConfig.ui.previewMode).toBe(true); // default
      expect(effectiveConfig.ui.previewConfidence).toBe(0.7); // default
      expect(effectiveConfig.ui.autoExecuteHighConfidence).toBe(false); // default
      expect(effectiveConfig.ui.previewTimeout).toBe(5000); // default
    });
  });

  describe('UI Config Type Safety and Validation', () => {
    it('should ensure type safety for previewConfidence', () => {
      // These should be valid
      const validConfidences = [0.0, 0.5, 0.7, 0.85, 1.0];
      for (const confidence of validConfidences) {
        expect(() => UIConfigSchema.parse({ previewConfidence: confidence })).not.toThrow();
      }

      // These should be invalid
      const invalidConfidences = [-0.1, 1.1, -1, 2, NaN, Infinity, -Infinity];
      for (const confidence of invalidConfidences) {
        expect(() => UIConfigSchema.parse({ previewConfidence: confidence })).toThrow();
      }
    });

    it('should ensure type safety for previewTimeout', () => {
      // These should be valid
      const validTimeouts = [1000, 1001, 5000, 10000, 60000];
      for (const timeout of validTimeouts) {
        expect(() => UIConfigSchema.parse({ previewTimeout: timeout })).not.toThrow();
      }

      // These should be invalid
      const invalidTimeouts = [0, 999, -1, -1000, NaN, Infinity, -Infinity];
      for (const timeout of invalidTimeouts) {
        expect(() => UIConfigSchema.parse({ previewTimeout: timeout })).toThrow();
      }
    });

    it('should enforce boolean type for preview flags', () => {
      // Valid boolean values
      expect(() => UIConfigSchema.parse({ previewMode: true })).not.toThrow();
      expect(() => UIConfigSchema.parse({ previewMode: false })).not.toThrow();
      expect(() => UIConfigSchema.parse({ autoExecuteHighConfidence: true })).not.toThrow();
      expect(() => UIConfigSchema.parse({ autoExecuteHighConfidence: false })).not.toThrow();

      // Invalid non-boolean values should be coerced or rejected
      expect(() => UIConfigSchema.parse({ previewMode: 1 })).toThrow();
      expect(() => UIConfigSchema.parse({ previewMode: 'true' })).toThrow();
      expect(() => UIConfigSchema.parse({ autoExecuteHighConfidence: 0 })).toThrow();
      expect(() => UIConfigSchema.parse({ autoExecuteHighConfidence: 'false' })).toThrow();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical development environment configuration', () => {
      const devConfig = UIConfigSchema.parse({
        previewMode: true,
        previewConfidence: 0.6, // Lower confidence for dev
        autoExecuteHighConfidence: false, // Manual approval in dev
        previewTimeout: 3000,
      });

      expect(devConfig.previewMode).toBe(true);
      expect(devConfig.previewConfidence).toBe(0.6);
      expect(devConfig.autoExecuteHighConfidence).toBe(false);
      expect(devConfig.previewTimeout).toBe(3000);
    });

    it('should handle typical production environment configuration', () => {
      const prodConfig = UIConfigSchema.parse({
        previewMode: true,
        previewConfidence: 0.9, // Higher confidence for prod
        autoExecuteHighConfidence: true, // Auto-execute high confidence changes
        previewTimeout: 15000, // Longer timeout for complex operations
      });

      expect(prodConfig.previewMode).toBe(true);
      expect(prodConfig.previewConfidence).toBe(0.9);
      expect(prodConfig.autoExecuteHighConfidence).toBe(true);
      expect(prodConfig.previewTimeout).toBe(15000);
    });

    it('should handle disabled preview mode configuration', () => {
      const disabledConfig = UIConfigSchema.parse({
        previewMode: false,
        // Other settings should still be respected even if preview is disabled
        previewConfidence: 0.8,
        autoExecuteHighConfidence: false,
        previewTimeout: 8000,
      });

      expect(disabledConfig.previewMode).toBe(false);
      expect(disabledConfig.previewConfidence).toBe(0.8);
      expect(disabledConfig.autoExecuteHighConfidence).toBe(false);
      expect(disabledConfig.previewTimeout).toBe(8000);
    });
  });

  describe('Error Messages and Validation Details', () => {
    it('should provide clear error messages for invalid previewConfidence', () => {
      expect(() => UIConfigSchema.parse({ previewConfidence: -0.5 }))
        .toThrow(/Number must be greater than or equal to 0/);

      expect(() => UIConfigSchema.parse({ previewConfidence: 1.5 }))
        .toThrow(/Number must be less than or equal to 1/);
    });

    it('should provide clear error messages for invalid previewTimeout', () => {
      expect(() => UIConfigSchema.parse({ previewTimeout: 500 }))
        .toThrow(/Number must be greater than or equal to 1000/);
    });

    it('should provide clear error messages for invalid boolean types', () => {
      expect(() => UIConfigSchema.parse({ previewMode: 'yes' }))
        .toThrow(/Expected boolean/);

      expect(() => UIConfigSchema.parse({ autoExecuteHighConfidence: 1 }))
        .toThrow(/Expected boolean/);
    });
  });
});