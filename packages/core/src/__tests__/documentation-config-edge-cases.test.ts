import { describe, it, expect } from 'vitest';
import {
  OutdatedDocsConfigSchema,
  DocumentationAnalysisConfigSchema,
  ApexConfigSchema,
} from '../types';
import { getEffectiveConfig } from '../config';

describe('Documentation Configuration Edge Cases', () => {
  describe('OutdatedDocsConfigSchema Edge Cases', () => {
    it('should handle very large todoAgeThresholdDays values', () => {
      const config = OutdatedDocsConfigSchema.parse({
        todoAgeThresholdDays: 999999,
      });
      expect(config.todoAgeThresholdDays).toBe(999999);
    });

    it('should handle fractional todoAgeThresholdDays values with precision', () => {
      const config = OutdatedDocsConfigSchema.parse({
        todoAgeThresholdDays: 7.25,
      });
      expect(config.todoAgeThresholdDays).toBe(7.25);
    });

    it('should handle very small positive todoAgeThresholdDays values', () => {
      const config = OutdatedDocsConfigSchema.parse({
        todoAgeThresholdDays: 0.001,
      });
      expect(config.todoAgeThresholdDays).toBe(0.001);
    });

    it('should handle complex regex patterns in versionCheckPatterns', () => {
      const complexPatterns = [
        '^v(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$',
        '(?:@([^@]+))?@(\\d+)\\.(\\d+)\\.(\\d+)',
        'release-\\d{4}-\\d{2}-\\d{2}',
        '\\bversion\\s*[=:]?\\s*["\']?([0-9]+\\.[0-9]+(?:\\.[0-9]+)?)["\']?',
      ];

      const config = OutdatedDocsConfigSchema.parse({
        versionCheckPatterns: complexPatterns,
      });

      expect(config.versionCheckPatterns).toEqual(complexPatterns);
    });

    it('should handle empty string patterns in versionCheckPatterns', () => {
      const config = OutdatedDocsConfigSchema.parse({
        versionCheckPatterns: ['', 'valid-pattern'],
      });

      expect(config.versionCheckPatterns).toEqual(['', 'valid-pattern']);
    });

    it('should handle special characters and escapes in patterns', () => {
      const specialPatterns = [
        '\\d+\\.\\d+',
        'v[0-9]+\\.[0-9]+\\.[0-9]+',
        '\\\\server\\\\path\\\\file',
        'pattern\\.with\\.dots',
        'pattern\\$with\\^special\\*chars\\+',
      ];

      const config = OutdatedDocsConfigSchema.parse({
        versionCheckPatterns: specialPatterns,
      });

      expect(config.versionCheckPatterns).toEqual(specialPatterns);
    });

    it('should handle extremely long pattern arrays', () => {
      const longPatternArray = Array.from({ length: 100 }, (_, i) => `pattern-${i}`);

      const config = OutdatedDocsConfigSchema.parse({
        versionCheckPatterns: longPatternArray,
      });

      expect(config.versionCheckPatterns).toHaveLength(100);
      expect(config.versionCheckPatterns[0]).toBe('pattern-0');
      expect(config.versionCheckPatterns[99]).toBe('pattern-99');
    });

    it('should reject null/undefined in versionCheckPatterns array', () => {
      expect(() => {
        OutdatedDocsConfigSchema.parse({
          versionCheckPatterns: [null, 'valid-pattern'],
        });
      }).toThrow();

      expect(() => {
        OutdatedDocsConfigSchema.parse({
          versionCheckPatterns: ['valid-pattern', undefined],
        });
      }).toThrow();
    });

    it('should reject non-string values in versionCheckPatterns array', () => {
      expect(() => {
        OutdatedDocsConfigSchema.parse({
          versionCheckPatterns: [123, 'valid-pattern'],
        });
      }).toThrow();

      expect(() => {
        OutdatedDocsConfigSchema.parse({
          versionCheckPatterns: ['valid-pattern', { invalid: 'object' }],
        });
      }).toThrow();
    });

    it('should handle floating point precision edge cases for todoAgeThresholdDays', () => {
      const preciseValue = 1.0000000000000002; // Just above 1 due to floating point
      const config = OutdatedDocsConfigSchema.parse({
        todoAgeThresholdDays: preciseValue,
      });
      expect(config.todoAgeThresholdDays).toBeCloseTo(1, 10);
    });

    it('should reject zero and negative values for todoAgeThresholdDays', () => {
      expect(() => {
        OutdatedDocsConfigSchema.parse({
          todoAgeThresholdDays: 0,
        });
      }).toThrow('Number must be greater than or equal to 1');

      expect(() => {
        OutdatedDocsConfigSchema.parse({
          todoAgeThresholdDays: -0.5,
        });
      }).toThrow();

      expect(() => {
        OutdatedDocsConfigSchema.parse({
          todoAgeThresholdDays: -100,
        });
      }).toThrow();
    });

    it('should reject non-numeric todoAgeThresholdDays', () => {
      const invalidValues = ['30', '7.5', null, undefined, {}, [], true, false];

      for (const value of invalidValues) {
        expect(() => {
          OutdatedDocsConfigSchema.parse({
            todoAgeThresholdDays: value,
          });
        }).toThrow();
      }
    });

    it('should reject non-boolean values for boolean fields', () => {
      const invalidBooleans = ['true', 'false', 1, 0, null, undefined, {}, []];

      for (const value of invalidBooleans) {
        expect(() => {
          OutdatedDocsConfigSchema.parse({
            deprecationRequiresMigration: value,
          });
        }).toThrow();

        expect(() => {
          OutdatedDocsConfigSchema.parse({
            crossReferenceEnabled: value,
          });
        }).toThrow();
      }
    });
  });

  describe('DocumentationAnalysisConfigSchema Edge Cases', () => {
    it('should handle deeply nested configuration with all options', () => {
      const config = DocumentationAnalysisConfigSchema.parse({
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 42,
          versionCheckPatterns: ['custom\\d+\\.\\d+', 'v[0-9]+'],
          deprecationRequiresMigration: false,
          crossReferenceEnabled: true,
        },
        jsdocAnalysis: {
          enabled: false,
          requirePublicExports: true,
          checkReturnTypes: false,
          checkParameterTypes: true,
        },
      });

      expect(config.enabled).toBe(true);
      expect(config.outdatedDocs?.todoAgeThresholdDays).toBe(42);
      expect(config.outdatedDocs?.versionCheckPatterns).toEqual(['custom\\d+\\.\\d+', 'v[0-9]+']);
      expect(config.outdatedDocs?.deprecationRequiresMigration).toBe(false);
      expect(config.outdatedDocs?.crossReferenceEnabled).toBe(true);
      expect(config.jsdocAnalysis?.enabled).toBe(false);
      expect(config.jsdocAnalysis?.requirePublicExports).toBe(true);
      expect(config.jsdocAnalysis?.checkReturnTypes).toBe(false);
      expect(config.jsdocAnalysis?.checkParameterTypes).toBe(true);
    });

    it('should handle partial nested configurations with defaults', () => {
      const config = DocumentationAnalysisConfigSchema.parse({
        outdatedDocs: {
          todoAgeThresholdDays: 15,
        },
        jsdocAnalysis: {
          checkReturnTypes: false,
        },
      });

      expect(config.enabled).toBe(true); // default
      expect(config.outdatedDocs?.todoAgeThresholdDays).toBe(15);
      expect(config.outdatedDocs?.versionCheckPatterns).toEqual([
        'v\\d+\\.\\d+\\.\\d+',
        'version\\s+\\d+\\.\\d+',
        '\\d+\\.\\d+\\s+release',
        'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
      ]); // defaults
      expect(config.outdatedDocs?.deprecationRequiresMigration).toBe(true); // default
      expect(config.outdatedDocs?.crossReferenceEnabled).toBe(true); // default
      expect(config.jsdocAnalysis?.enabled).toBe(true); // default
      expect(config.jsdocAnalysis?.requirePublicExports).toBe(true); // default
      expect(config.jsdocAnalysis?.checkReturnTypes).toBe(false);
      expect(config.jsdocAnalysis?.checkParameterTypes).toBe(true); // default
    });

    it('should handle configuration with disabled top-level but enabled sub-features', () => {
      const config = DocumentationAnalysisConfigSchema.parse({
        enabled: false,
        outdatedDocs: {
          todoAgeThresholdDays: 7,
        },
        jsdocAnalysis: {
          enabled: true,
        },
      });

      expect(config.enabled).toBe(false);
      expect(config.outdatedDocs?.todoAgeThresholdDays).toBe(7);
      expect(config.jsdocAnalysis?.enabled).toBe(true);
    });

    it('should reject invalid nested configuration', () => {
      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          outdatedDocs: {
            todoAgeThresholdDays: -5, // Invalid
          },
        });
      }).toThrow();

      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          jsdocAnalysis: {
            enabled: 'yes', // Invalid type
          },
        });
      }).toThrow();
    });

    it('should handle null/undefined nested objects gracefully', () => {
      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          outdatedDocs: null,
        });
      }).toThrow();

      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          jsdocAnalysis: undefined,
        });
      }).not.toThrow();
    });
  });

  describe('ApexConfig Integration with Documentation', () => {
    it('should handle full ApexConfig with comprehensive documentation settings', () => {
      const config = ApexConfigSchema.parse({
        version: '2.0',
        project: {
          name: 'comprehensive-doc-project',
          language: 'typescript',
          framework: 'next.js',
        },
        autonomy: {
          default: 'review-before-merge',
        },
        git: {
          branchPrefix: 'docs/',
          commitFormat: 'conventional',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 14,
            versionCheckPatterns: [
              'v\\d+\\.\\d+\\.\\d+',
              'version\\s*=\\s*"[^"]+"',
              '@version\\s+\\d+\\.\\d+',
            ],
            deprecationRequiresMigration: true,
            crossReferenceEnabled: true,
          },
          jsdocAnalysis: {
            enabled: true,
            requirePublicExports: true,
            checkReturnTypes: true,
            checkParameterTypes: true,
          },
        },
      });

      expect(config.project.name).toBe('comprehensive-doc-project');
      expect(config.documentation?.enabled).toBe(true);
      expect(config.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(14);
      expect(config.documentation?.jsdocAnalysis?.enabled).toBe(true);
    });

    it('should work with getEffectiveConfig when documentation is not specified', () => {
      const baseConfig = ApexConfigSchema.parse({
        project: { name: 'test-project' },
      });

      const effectiveConfig = getEffectiveConfig(baseConfig);

      // Documentation should remain undefined if not specified
      expect(effectiveConfig.documentation).toBeUndefined();
      // Other defaults should still be applied
      expect(effectiveConfig.autonomy.default).toBe('review-before-merge');
      expect(effectiveConfig.git.branchPrefix).toBe('apex/');
    });

    it('should work with getEffectiveConfig when documentation is specified', () => {
      const baseConfig = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        documentation: {
          enabled: false,
          outdatedDocs: {
            todoAgeThresholdDays: 90,
          },
        },
      });

      const effectiveConfig = getEffectiveConfig(baseConfig);

      expect(effectiveConfig.documentation?.enabled).toBe(false);
      expect(effectiveConfig.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(90);
      // Other defaults should still be applied
      expect(effectiveConfig.autonomy.default).toBe('review-before-merge');
    });

    it('should reject ApexConfig with invalid documentation configuration', () => {
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          documentation: {
            enabled: 'invalid', // Should be boolean
          },
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          documentation: {
            outdatedDocs: {
              todoAgeThresholdDays: 0, // Should be >= 1
            },
          },
        });
      }).toThrow();
    });
  });

  describe('Type Export Verification', () => {
    it('should ensure OutdatedDocsConfig type is properly exported', () => {
      // This test ensures the type exists and can be used
      const validConfig = {
        todoAgeThresholdDays: 30,
        versionCheckPatterns: ['v\\d+\\.\\d+\\.\\d+'],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const parsed = OutdatedDocsConfigSchema.parse(validConfig);

      // Type assertion to verify the type exists
      const typedConfig: typeof parsed = parsed;
      expect(typedConfig.todoAgeThresholdDays).toBe(30);
    });

    it('should ensure DocumentationAnalysisConfig type is properly exported', () => {
      const validConfig = {
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 21,
        },
        jsdocAnalysis: {
          enabled: false,
        },
      };

      const parsed = DocumentationAnalysisConfigSchema.parse(validConfig);

      // Type assertion to verify the type exists
      const typedConfig: typeof parsed = parsed;
      expect(typedConfig.enabled).toBe(true);
    });
  });

  describe('Schema Validation Performance', () => {
    it('should handle large configuration objects efficiently', () => {
      const startTime = performance.now();

      const largeConfig = {
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 30,
          versionCheckPatterns: Array.from({ length: 1000 }, (_, i) => `pattern-${i}`),
          deprecationRequiresMigration: true,
          crossReferenceEnabled: true,
        },
        jsdocAnalysis: {
          enabled: true,
          requirePublicExports: true,
          checkReturnTypes: true,
          checkParameterTypes: true,
        },
      };

      const parsed = DocumentationAnalysisConfigSchema.parse(largeConfig);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(parsed.outdatedDocs?.versionCheckPatterns).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should validate multiple configurations without memory issues', () => {
      const configs = Array.from({ length: 100 }, (_, i) => ({
        todoAgeThresholdDays: i + 1,
        versionCheckPatterns: [`pattern-${i}`],
        deprecationRequiresMigration: i % 2 === 0,
        crossReferenceEnabled: i % 3 === 0,
      }));

      configs.forEach(config => {
        const parsed = OutdatedDocsConfigSchema.parse(config);
        expect(parsed).toBeDefined();
      });

      // If we get here without throwing or running out of memory, the test passes
      expect(configs).toHaveLength(100);
    });
  });
});