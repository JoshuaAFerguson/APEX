import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  initializeApex,
} from '../config';
import { ApexConfig, ApexConfigSchema, VisualRegressionConfigSchema } from '../types';

describe('VisualRegressionConfig', () => {
  describe('VisualRegressionConfigSchema validation', () => {
    it('should parse config with all default values', () => {
      const config = VisualRegressionConfigSchema.parse({});

      expect(config).toEqual({
        enabled: false,
        threshold: 0.99,
        diffColor: [255, 0, 255],
        snapshotDir: '.apex/snapshots',
        failOnMismatch: true,
      });
    });

    it('should parse config with explicit values', () => {
      const config = VisualRegressionConfigSchema.parse({
        enabled: true,
        threshold: 0.95,
        diffColor: [255, 0, 0],
        snapshotDir: 'custom/snapshots',
        failOnMismatch: false,
      });

      expect(config).toEqual({
        enabled: true,
        threshold: 0.95,
        diffColor: [255, 0, 0],
        snapshotDir: 'custom/snapshots',
        failOnMismatch: false,
      });
    });

    it('should validate threshold bounds', () => {
      // Valid threshold values
      expect(() => VisualRegressionConfigSchema.parse({ threshold: 0 })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ threshold: 0.5 })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ threshold: 1 })).not.toThrow();

      // Invalid threshold values
      expect(() => VisualRegressionConfigSchema.parse({ threshold: -0.1 })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ threshold: 1.1 })).toThrow();
    });

    it('should validate diffColor RGB values', () => {
      // Valid RGB values
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [0, 0, 0] })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [128, 128, 128] })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [255, 255, 255] })).not.toThrow();

      // Invalid RGB values
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [-1, 0, 0] })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [0, 256, 0] })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [0, 0, 300] })).toThrow();
    });

    it('should require exactly 3 values for diffColor', () => {
      // Invalid array lengths
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [255] })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [255, 0] })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [255, 0, 0, 255] })).toThrow();
    });

    it('should accept string values for snapshotDir', () => {
      expect(() => VisualRegressionConfigSchema.parse({ snapshotDir: 'test/snapshots' })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ snapshotDir: './snapshots' })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ snapshotDir: '/absolute/path/snapshots' })).not.toThrow();
    });

    it('should validate boolean values for enabled and failOnMismatch', () => {
      expect(() => VisualRegressionConfigSchema.parse({ enabled: true })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ enabled: false })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ failOnMismatch: true })).not.toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ failOnMismatch: false })).not.toThrow();

      // Invalid boolean values
      expect(() => VisualRegressionConfigSchema.parse({ enabled: 'true' })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ enabled: 1 })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ failOnMismatch: 'false' })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ failOnMismatch: 0 })).toThrow();
    });

    it('should handle partial configuration with defaults', () => {
      const config = VisualRegressionConfigSchema.parse({
        enabled: true,
        threshold: 0.85,
        // diffColor, snapshotDir, failOnMismatch should get defaults
      });

      expect(config).toEqual({
        enabled: true,
        threshold: 0.85,
        diffColor: [255, 0, 255], // default magenta
        snapshotDir: '.apex/snapshots', // default
        failOnMismatch: true, // default
      });
    });

    it('should preserve all explicitly set values', () => {
      const inputConfig = {
        enabled: true,
        threshold: 0.98,
        diffColor: [0, 255, 0] as [number, number, number],
        snapshotDir: 'tests/visual-snapshots',
        failOnMismatch: false,
      };

      const parsedConfig = VisualRegressionConfigSchema.parse(inputConfig);

      expect(parsedConfig).toEqual(inputConfig);
    });

    it('should handle edge case threshold values', () => {
      // Test minimum boundary
      const minConfig = VisualRegressionConfigSchema.parse({ threshold: 0 });
      expect(minConfig.threshold).toBe(0);

      // Test maximum boundary
      const maxConfig = VisualRegressionConfigSchema.parse({ threshold: 1 });
      expect(maxConfig.threshold).toBe(1);

      // Test decimal precision
      const preciseConfig = VisualRegressionConfigSchema.parse({ threshold: 0.999999 });
      expect(preciseConfig.threshold).toBe(0.999999);
    });

    it('should handle edge case RGB values', () => {
      // Test minimum RGB values
      const minConfig = VisualRegressionConfigSchema.parse({ diffColor: [0, 0, 0] });
      expect(minConfig.diffColor).toEqual([0, 0, 0]);

      // Test maximum RGB values
      const maxConfig = VisualRegressionConfigSchema.parse({ diffColor: [255, 255, 255] });
      expect(maxConfig.diffColor).toEqual([255, 255, 255]);

      // Test mixed values
      const mixedConfig = VisualRegressionConfigSchema.parse({ diffColor: [100, 200, 50] });
      expect(mixedConfig.diffColor).toEqual([100, 200, 50]);
    });

    it('should reject invalid types for all fields', () => {
      // Test invalid enabled
      expect(() => VisualRegressionConfigSchema.parse({ enabled: null })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ enabled: undefined })).toThrow();

      // Test invalid threshold
      expect(() => VisualRegressionConfigSchema.parse({ threshold: 'high' })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ threshold: null })).toThrow();

      // Test invalid diffColor
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: 'red' })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: null })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ diffColor: [255, 0, 'blue'] })).toThrow();

      // Test invalid snapshotDir
      expect(() => VisualRegressionConfigSchema.parse({ snapshotDir: null })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ snapshotDir: 123 })).toThrow();

      // Test invalid failOnMismatch
      expect(() => VisualRegressionConfigSchema.parse({ failOnMismatch: null })).toThrow();
      expect(() => VisualRegressionConfigSchema.parse({ failOnMismatch: 'yes' })).toThrow();
    });
  });

  describe('ApexConfigSchema integration with VisualRegression', () => {
    it('should parse ApexConfig without visualRegression section', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
      });

      expect(config.visualRegression).toBeUndefined();
    });

    it('should parse ApexConfig with visualRegression section using defaults', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        visualRegression: {},
      });

      expect(config.visualRegression).toEqual({
        enabled: false,
        threshold: 0.99,
        diffColor: [255, 0, 255],
        snapshotDir: '.apex/snapshots',
        failOnMismatch: true,
      });
    });

    it('should parse ApexConfig with custom visualRegression values', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        visualRegression: {
          enabled: true,
          threshold: 0.95,
          diffColor: [255, 255, 0],
          snapshotDir: 'custom-snapshots',
          failOnMismatch: false,
        },
      });

      expect(config.visualRegression).toEqual({
        enabled: true,
        threshold: 0.95,
        diffColor: [255, 255, 0],
        snapshotDir: 'custom-snapshots',
        failOnMismatch: false,
      });
    });

    it('should parse ApexConfig with partial visualRegression values and apply defaults', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        visualRegression: {
          enabled: true,
          threshold: 0.9,
          // diffColor, snapshotDir, failOnMismatch should default
        },
      });

      expect(config.visualRegression).toEqual({
        enabled: true,
        threshold: 0.9,
        diffColor: [255, 0, 255],
        snapshotDir: '.apex/snapshots',
        failOnMismatch: true,
      });
    });

    it('should validate visualRegression constraints within ApexConfig', () => {
      // Valid config
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            threshold: 0.8,
            diffColor: [100, 150, 200],
          },
        });
      }).not.toThrow();

      // Invalid threshold
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            threshold: 1.5,
          },
        });
      }).toThrow();

      // Invalid diffColor
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            diffColor: [256, 0, 0],
          },
        });
      }).toThrow();
    });

    it('should preserve visualRegression config alongside other config sections', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        autonomy: { level: 'review-before-commit' },
        visualRegression: {
          enabled: true,
          threshold: 0.85,
        },
        limits: { maxCostPerTask: 5.0 },
      });

      expect(config.project.name).toBe('test-project');
      expect(config.autonomy?.level).toBe('review-before-commit');
      expect(config.limits?.maxCostPerTask).toBe(5.0);
      expect(config.visualRegression?.enabled).toBe(true);
      expect(config.visualRegression?.threshold).toBe(0.85);
      expect(config.visualRegression?.diffColor).toEqual([255, 0, 255]); // default
    });
  });

  describe('getEffectiveConfig with VisualRegression', () => {
    it('should apply visualRegression defaults when section is missing', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression).toEqual({
        enabled: false,
        threshold: 0.99,
        diffColor: [255, 0, 255],
        snapshotDir: '.apex/snapshots',
        failOnMismatch: true,
      });
    });

    it('should preserve custom visualRegression values', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
          threshold: 0.92,
          diffColor: [0, 255, 0],
          snapshotDir: 'tests/screenshots',
          failOnMismatch: false,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression).toEqual({
        enabled: true,
        threshold: 0.92,
        diffColor: [0, 255, 0],
        snapshotDir: 'tests/screenshots',
        failOnMismatch: false,
      });
    });

    it('should apply defaults for missing visualRegression properties', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
          threshold: 0.88,
          // diffColor, snapshotDir, failOnMismatch missing
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression).toEqual({
        enabled: true,
        threshold: 0.88,
        diffColor: [255, 0, 255], // default
        snapshotDir: '.apex/snapshots', // default
        failOnMismatch: true, // default
      });
    });

    it('should handle visualRegression with only enabled set', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression).toEqual({
        enabled: true,
        threshold: 0.99, // default
        diffColor: [255, 0, 255], // default
        snapshotDir: '.apex/snapshots', // default
        failOnMismatch: true, // default
      });
    });

    it('should handle visualRegression with only threshold set', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          threshold: 0.75,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression).toEqual({
        enabled: false, // default
        threshold: 0.75,
        diffColor: [255, 0, 255], // default
        snapshotDir: '.apex/snapshots', // default
        failOnMismatch: true, // default
      });
    });

    it('should handle threshold as 0 (falsy but valid)', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          threshold: 0,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression.threshold).toBe(0);
    });

    it('should handle failOnMismatch as false (falsy but valid)', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          failOnMismatch: false,
        },
      };

      const effective = getEffectiveConfig(config);

      expect(effective.visualRegression.failOnMismatch).toBe(false);
    });
  });

  describe('Config file persistence', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-visual-regression-test-'));
      await fs.mkdir(path.join(testDir, '.apex'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should save and load visualRegression config correctly', async () => {
      const configWithVisualRegression: ApexConfig = {
        version: '1.0',
        project: {
          name: 'visual-regression-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
          threshold: 0.93,
          diffColor: [255, 165, 0],
          snapshotDir: 'tests/visual-snapshots',
          failOnMismatch: false,
        },
      };

      await saveConfig(testDir, configWithVisualRegression);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.visualRegression).toEqual({
        enabled: true,
        threshold: 0.93,
        diffColor: [255, 165, 0],
        snapshotDir: 'tests/visual-snapshots',
        failOnMismatch: false,
      });
    });

    it('should save and load visualRegression config with minimal values', async () => {
      const configWithMinimalVisualRegression: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-visual-regression-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
        },
      };

      await saveConfig(testDir, configWithMinimalVisualRegression);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.visualRegression).toEqual({
        enabled: true,
        threshold: 0.99, // default
        diffColor: [255, 0, 255], // default
        snapshotDir: '.apex/snapshots', // default
        failOnMismatch: true, // default
      });
    });

    it('should save config without visualRegression and load with getEffectiveConfig defaults', async () => {
      const configWithoutVisualRegression: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-visual-regression-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, configWithoutVisualRegression);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(loadedConfig.visualRegression).toBeUndefined();
      expect(effectiveConfig.visualRegression).toEqual({
        enabled: false,
        threshold: 0.99,
        diffColor: [255, 0, 255],
        snapshotDir: '.apex/snapshots',
        failOnMismatch: true,
      });
    });

    it('should preserve visualRegression config alongside other config sections during save/load', async () => {
      const complexConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-test',
          language: 'typescript',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
        },
        limits: {
          maxCostPerTask: 15.0,
          maxTokensPerTask: 100000,
        },
        visualRegression: {
          enabled: true,
          threshold: 0.87,
          diffColor: [128, 255, 128],
          snapshotDir: 'e2e/visual-tests',
          failOnMismatch: true,
        },
        ui: {
          previewMode: false,
          diffPreview: true,
        },
      };

      await saveConfig(testDir, complexConfig);
      const loadedConfig = await loadConfig(testDir);

      // Check that all config sections are preserved
      expect(loadedConfig.project.name).toBe('complex-test');
      expect(loadedConfig.project.language).toBe('typescript');
      expect(loadedConfig.autonomy?.level).toBe('full-auto');
      expect(loadedConfig.limits?.maxCostPerTask).toBe(15.0);
      expect(loadedConfig.ui?.previewMode).toBe(false);
      expect(loadedConfig.ui?.diffPreview).toBe(true);

      // Check visualRegression specifically
      expect(loadedConfig.visualRegression?.enabled).toBe(true);
      expect(loadedConfig.visualRegression?.threshold).toBe(0.87);
      expect(loadedConfig.visualRegression?.diffColor).toEqual([128, 255, 128]);
      expect(loadedConfig.visualRegression?.snapshotDir).toBe('e2e/visual-tests');
      expect(loadedConfig.visualRegression?.failOnMismatch).toBe(true);
    });
  });

  describe('initializeApex with visualRegression defaults', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-visual-regression-init-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should initialize project with visualRegression defaults via getEffectiveConfig', async () => {
      await initializeApex(testDir, { projectName: 'visual-regression-init-test' });
      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // initializeApex doesn't explicitly set visualRegression config, so it should use defaults from getEffectiveConfig
      expect(config.visualRegression).toBeUndefined();
      expect(effective.visualRegression).toEqual({
        enabled: false,
        threshold: 0.99,
        diffColor: [255, 0, 255],
        snapshotDir: '.apex/snapshots',
        failOnMismatch: true,
      });
    });
  });

  describe('Edge cases and type validation', () => {
    it('should reject invalid threshold types', () => {
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            threshold: 'high' as any,
          },
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            threshold: null as any,
          },
        });
      }).toThrow();
    });

    it('should reject invalid diffColor types', () => {
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            diffColor: 'red' as any,
          },
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            diffColor: [255, 0] as any, // Wrong array length
          },
        });
      }).toThrow();
    });

    it('should reject invalid enabled types', () => {
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            enabled: 'true' as any,
          },
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            enabled: 1 as any,
          },
        });
      }).toThrow();
    });

    it('should reject invalid snapshotDir types', () => {
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            snapshotDir: null as any,
          },
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: {
            snapshotDir: 123 as any,
          },
        });
      }).toThrow();
    });

    it('should handle very precise threshold values', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        visualRegression: {
          threshold: 0.999999999,
        },
      });

      expect(config.visualRegression!.threshold).toBe(0.999999999);
    });

    it('should handle various valid path formats for snapshotDir', () => {
      const paths = [
        'snapshots',
        './snapshots',
        '../snapshots',
        '/absolute/path/snapshots',
        'deep/nested/snapshot/dir',
        'snapshots-2024',
        'snapshots_with_underscores',
      ];

      for (const snapshotDir of paths) {
        const config = ApexConfigSchema.parse({
          project: { name: 'test-project' },
          visualRegression: { snapshotDir },
        });

        expect(config.visualRegression!.snapshotDir).toBe(snapshotDir);
      }
    });

    it('should preserve all visualRegression config types in getEffectiveConfig', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        visualRegression: {
          enabled: true,
          threshold: 0.95,
          diffColor: [200, 100, 50],
          snapshotDir: 'custom/dir',
          failOnMismatch: false,
        },
      });

      const effective = getEffectiveConfig(config);

      expect(typeof effective.visualRegression.enabled).toBe('boolean');
      expect(typeof effective.visualRegression.threshold).toBe('number');
      expect(Array.isArray(effective.visualRegression.diffColor)).toBe(true);
      expect(effective.visualRegression.diffColor).toHaveLength(3);
      expect(typeof effective.visualRegression.snapshotDir).toBe('string');
      expect(typeof effective.visualRegression.failOnMismatch).toBe('boolean');
    });
  });
});