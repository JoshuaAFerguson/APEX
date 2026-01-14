import { describe, it, expect } from 'vitest';
import { ApexConfigSchema, VisualRegressionConfigSchema } from '../types';
import { getEffectiveConfig } from '../config';
import type { ApexConfig, VisualRegressionConfig } from '../types';

describe('VisualRegression Configuration Coverage', () => {
  describe('Schema exports and type safety', () => {
    it('should export VisualRegressionConfigSchema', () => {
      expect(VisualRegressionConfigSchema).toBeDefined();
      expect(typeof VisualRegressionConfigSchema.parse).toBe('function');
    });

    it('should export VisualRegressionConfig type', () => {
      // This test ensures the type is properly inferred and exported
      const config: VisualRegressionConfig = {
        enabled: true,
        threshold: 0.95,
        diffColor: [255, 0, 0],
        snapshotDir: 'test/snapshots',
        failOnMismatch: false,
      };

      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(0.95);
      expect(config.diffColor).toEqual([255, 0, 0]);
      expect(config.snapshotDir).toBe('test/snapshots');
      expect(config.failOnMismatch).toBe(false);
    });

    it('should integrate VisualRegressionConfig into ApexConfig type', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
          threshold: 0.99,
          diffColor: [255, 0, 255],
          snapshotDir: '.apex/snapshots',
          failOnMismatch: true,
        },
      };

      expect(config.visualRegression).toBeDefined();
      expect(config.visualRegression?.enabled).toBe(true);
    });
  });

  describe('Default values validation', () => {
    it('should have correct default values according to requirements', () => {
      const defaults = VisualRegressionConfigSchema.parse({});

      expect(defaults.enabled).toBe(false);
      expect(defaults.threshold).toBe(0.99);
      expect(defaults.diffColor).toEqual([255, 0, 255]); // magenta
      expect(defaults.snapshotDir).toBe('.apex/snapshots');
      expect(defaults.failOnMismatch).toBe(true);
    });

    it('should maintain default values when applied to empty ApexConfig', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test' },
        visualRegression: {},
      });

      expect(config.visualRegression?.enabled).toBe(false);
      expect(config.visualRegression?.threshold).toBe(0.99);
      expect(config.visualRegression?.diffColor).toEqual([255, 0, 255]);
      expect(config.visualRegression?.snapshotDir).toBe('.apex/snapshots');
      expect(config.visualRegression?.failOnMismatch).toBe(true);
    });

    it('should apply defaults through getEffectiveConfig', () => {
      const baseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const effective = getEffectiveConfig(baseConfig);

      expect(effective.visualRegression.enabled).toBe(false);
      expect(effective.visualRegression.threshold).toBe(0.99);
      expect(effective.visualRegression.diffColor).toEqual([255, 0, 255]);
      expect(effective.visualRegression.snapshotDir).toBe('.apex/snapshots');
      expect(effective.visualRegression.failOnMismatch).toBe(true);
    });
  });

  describe('Constraint validation comprehensive coverage', () => {
    describe('threshold validation', () => {
      it('should accept all valid threshold values', () => {
        const validThresholds = [0, 0.1, 0.5, 0.99, 0.999999, 1];

        for (const threshold of validThresholds) {
          expect(() => {
            VisualRegressionConfigSchema.parse({ threshold });
          }).not.toThrow(`Should accept threshold ${threshold}`);
        }
      });

      it('should reject all invalid threshold values', () => {
        const invalidThresholds = [-0.001, -1, 1.001, 2, 10, Infinity, -Infinity, NaN];

        for (const threshold of invalidThresholds) {
          expect(() => {
            VisualRegressionConfigSchema.parse({ threshold });
          }).toThrow(`Should reject threshold ${threshold}`);
        }
      });

      it('should handle edge cases in threshold validation', () => {
        // Very close to boundaries
        expect(() => VisualRegressionConfigSchema.parse({ threshold: 0.000001 })).not.toThrow();
        expect(() => VisualRegressionConfigSchema.parse({ threshold: 0.999999 })).not.toThrow();

        // Just outside boundaries
        expect(() => VisualRegressionConfigSchema.parse({ threshold: -0.000001 })).toThrow();
        expect(() => VisualRegressionConfigSchema.parse({ threshold: 1.000001 })).toThrow();
      });
    });

    describe('diffColor validation', () => {
      it('should accept all valid RGB combinations', () => {
        const validColors = [
          [0, 0, 0],
          [255, 255, 255],
          [128, 128, 128],
          [255, 0, 0],
          [0, 255, 0],
          [0, 0, 255],
          [255, 165, 0], // orange
          [128, 0, 128], // purple
        ] as [number, number, number][];

        for (const diffColor of validColors) {
          expect(() => {
            VisualRegressionConfigSchema.parse({ diffColor });
          }).not.toThrow(`Should accept color ${JSON.stringify(diffColor)}`);
        }
      });

      it('should reject invalid RGB values', () => {
        const invalidColors = [
          [-1, 0, 0],
          [0, -1, 0],
          [0, 0, -1],
          [256, 0, 0],
          [0, 256, 0],
          [0, 0, 256],
          [255.5, 0, 0],
          [0, 0],        // too few values
          [0, 0, 0, 0],  // too many values
          'red',         // wrong type
          null,          // null
        ];

        for (const diffColor of invalidColors) {
          expect(() => {
            VisualRegressionConfigSchema.parse({ diffColor });
          }).toThrow(`Should reject color ${JSON.stringify(diffColor)}`);
        }
      });
    });

    describe('snapshotDir validation', () => {
      it('should accept various valid directory paths', () => {
        const validPaths = [
          '.apex/snapshots',
          'snapshots',
          './snapshots',
          '../snapshots',
          '/absolute/path',
          'deep/nested/directory',
          'snapshots-with-dashes',
          'snapshots_with_underscores',
          'snapshots.with.dots',
          'UPPERCASE',
          'mixedCase',
        ];

        for (const snapshotDir of validPaths) {
          expect(() => {
            VisualRegressionConfigSchema.parse({ snapshotDir });
          }).not.toThrow(`Should accept path ${snapshotDir}`);
        }
      });

      it('should reject non-string values for snapshotDir', () => {
        const invalidPaths = [null, undefined, 123, true, [], {}];

        for (const snapshotDir of invalidPaths) {
          expect(() => {
            VisualRegressionConfigSchema.parse({ snapshotDir });
          }).toThrow(`Should reject non-string path ${JSON.stringify(snapshotDir)}`);
        }
      });
    });

    describe('boolean field validation', () => {
      it('should accept only boolean values for enabled and failOnMismatch', () => {
        const booleanFields = ['enabled', 'failOnMismatch'] as const;
        const validBooleans = [true, false];
        const invalidValues = ['true', 'false', 1, 0, 'yes', 'no', null, undefined];

        for (const field of booleanFields) {
          for (const value of validBooleans) {
            expect(() => {
              VisualRegressionConfigSchema.parse({ [field]: value });
            }).not.toThrow(`Should accept ${field}=${value}`);
          }

          for (const value of invalidValues) {
            expect(() => {
              VisualRegressionConfigSchema.parse({ [field]: value });
            }).toThrow(`Should reject ${field}=${JSON.stringify(value)}`);
          }
        }
      });
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support common configuration patterns', () => {
      const patterns = [
        {
          name: 'Disabled by default',
          config: {},
          expectedEnabled: false,
        },
        {
          name: 'Basic enabled',
          config: { enabled: true },
          expectedEnabled: true,
        },
        {
          name: 'Strict comparison',
          config: { enabled: true, threshold: 1.0, failOnMismatch: true },
          expectedEnabled: true,
        },
        {
          name: 'Lenient comparison',
          config: { enabled: true, threshold: 0.8, failOnMismatch: false },
          expectedEnabled: true,
        },
        {
          name: 'Custom directory',
          config: { enabled: true, snapshotDir: 'tests/visual' },
          expectedEnabled: true,
        },
        {
          name: 'Custom diff color',
          config: { enabled: true, diffColor: [255, 0, 0] },
          expectedEnabled: true,
        },
      ];

      for (const pattern of patterns) {
        const parsed = VisualRegressionConfigSchema.parse(pattern.config);
        expect(parsed.enabled).toBe(pattern.expectedEnabled);

        // All configs should be valid
        expect(() => {
          ApexConfigSchema.parse({
            project: { name: 'test' },
            visualRegression: pattern.config,
          });
        }).not.toThrow(`Pattern '${pattern.name}' should be valid`);
      }
    });

    it('should maintain consistency across parse and getEffectiveConfig', () => {
      const testConfig = {
        enabled: true,
        threshold: 0.95,
        diffColor: [0, 255, 0] as [number, number, number],
        snapshotDir: 'custom/dir',
        failOnMismatch: false,
      };

      const parsed = VisualRegressionConfigSchema.parse(testConfig);

      const apexConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: testConfig,
      };

      const effective = getEffectiveConfig(apexConfig);

      // Both should produce the same result
      expect(parsed).toEqual(effective.visualRegression);
    });
  });

  describe('Integration with ApexConfig sections', () => {
    it('should work alongside all other config sections', () => {
      const fullConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'full-integration-test',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
        },
        agents: {
          enabled: ['planner', 'developer', 'tester'],
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        git: {
          branchPrefix: 'feature/',
          autoPush: false,
        },
        limits: {
          maxCostPerTask: 25.0,
          maxTokensPerTask: 250000,
        },
        workspace: {
          defaultStrategy: 'directory',
        },
        permissions: {
          preset: 'review-all',
        },
        policy: {
          enforcement: 'warn',
          enabled: true,
        },
        ui: {
          previewMode: true,
          diffPreview: true,
        },
        visualRegression: {
          enabled: true,
          threshold: 0.96,
          diffColor: [255, 140, 0],
          snapshotDir: 'tests/e2e/visual',
          failOnMismatch: true,
        },
      };

      // Should parse without errors
      const parsed = ApexConfigSchema.parse(fullConfig);
      expect(parsed.visualRegression).toEqual(fullConfig.visualRegression);

      // Should work with getEffectiveConfig
      const effective = getEffectiveConfig(parsed);
      expect(effective.visualRegression).toEqual(fullConfig.visualRegression);

      // Other sections should be unaffected
      expect(effective.project.name).toBe('full-integration-test');
      expect(effective.autonomy.level).toBe('review-before-commit');
      expect(effective.limits.maxCostPerTask).toBe(25.0);
    });
  });
});