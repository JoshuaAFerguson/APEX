import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { loadConfig, saveConfig } from '../config';
import { ApexConfigSchema } from '../types';

describe('VisualRegression Config Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-vr-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('YAML parsing and serialization', () => {
    it('should parse YAML config with visualRegression section correctly', async () => {
      const yamlContent = `version: "1.0"
project:
  name: visual-test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
visualRegression:
  enabled: true
  threshold: 0.95
  diffColor: [255, 0, 0]
  snapshotDir: tests/visual
  failOnMismatch: false`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent);

      const config = await loadConfig(testDir);

      expect(config.visualRegression).toEqual({
        enabled: true,
        threshold: 0.95,
        diffColor: [255, 0, 0],
        snapshotDir: 'tests/visual',
        failOnMismatch: false,
      });
    });

    it('should serialize and deserialize visual regression config correctly', async () => {
      const originalConfig = {
        version: '1.0',
        project: {
          name: 'serialize-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        visualRegression: {
          enabled: true,
          threshold: 0.88,
          diffColor: [0, 255, 128] as [number, number, number],
          snapshotDir: 'custom/snapshots',
          failOnMismatch: true,
        },
      };

      await saveConfig(testDir, originalConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.visualRegression).toEqual(originalConfig.visualRegression);
    });

    it('should handle partial YAML config with defaults applied', async () => {
      const yamlContent = `version: "1.0"
project:
  name: partial-vr-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
visualRegression:
  enabled: true
  threshold: 0.85`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent);

      const config = await loadConfig(testDir);

      expect(config.visualRegression).toEqual({
        enabled: true,
        threshold: 0.85,
        diffColor: [255, 0, 255], // default
        snapshotDir: '.apex/snapshots', // default
        failOnMismatch: true, // default
      });
    });

    it('should reject invalid YAML visual regression configuration', async () => {
      const invalidYamlContent = `version: "1.0"
project:
  name: invalid-vr-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
visualRegression:
  enabled: true
  threshold: 1.5  # Invalid: > 1
  diffColor: [256, 0, 0]  # Invalid: > 255`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, invalidYamlContent);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('Schema validation with real YAML scenarios', () => {
    it('should validate common visual regression use cases', async () => {
      const testCases = [
        {
          name: 'minimal config',
          config: {
            visualRegression: {
              enabled: true,
            },
          },
          expected: {
            enabled: true,
            threshold: 0.99,
            diffColor: [255, 0, 255],
            snapshotDir: '.apex/snapshots',
            failOnMismatch: true,
          },
        },
        {
          name: 'strict testing config',
          config: {
            visualRegression: {
              enabled: true,
              threshold: 1.0,
              failOnMismatch: true,
            },
          },
          expected: {
            enabled: true,
            threshold: 1.0,
            diffColor: [255, 0, 255],
            snapshotDir: '.apex/snapshots',
            failOnMismatch: true,
          },
        },
        {
          name: 'lenient testing config',
          config: {
            visualRegression: {
              enabled: true,
              threshold: 0.7,
              failOnMismatch: false,
              snapshotDir: 'tests/screenshots',
            },
          },
          expected: {
            enabled: true,
            threshold: 0.7,
            diffColor: [255, 0, 255],
            snapshotDir: 'tests/screenshots',
            failOnMismatch: false,
          },
        },
        {
          name: 'custom diff color config',
          config: {
            visualRegression: {
              enabled: true,
              diffColor: [255, 255, 0],
              snapshotDir: './snapshots',
            },
          },
          expected: {
            enabled: true,
            threshold: 0.99,
            diffColor: [255, 255, 0],
            snapshotDir: './snapshots',
            failOnMismatch: true,
          },
        },
      ];

      for (const testCase of testCases) {
        const fullConfig = {
          version: '1.0',
          project: {
            name: `test-${testCase.name.replace(/\s+/g, '-')}`,
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          ...testCase.config,
        };

        const validatedConfig = ApexConfigSchema.parse(fullConfig);
        expect(validatedConfig.visualRegression).toEqual(testCase.expected);
      }
    });

    it('should reject invalid visual regression configurations', async () => {
      const invalidConfigs = [
        {
          name: 'threshold too high',
          config: {
            visualRegression: {
              threshold: 1.1,
            },
          },
        },
        {
          name: 'threshold too low',
          config: {
            visualRegression: {
              threshold: -0.1,
            },
          },
        },
        {
          name: 'invalid RGB values',
          config: {
            visualRegression: {
              diffColor: [256, 0, 0],
            },
          },
        },
        {
          name: 'wrong RGB array length',
          config: {
            visualRegression: {
              diffColor: [255, 0],
            },
          },
        },
        {
          name: 'invalid enabled type',
          config: {
            visualRegression: {
              enabled: 'yes',
            },
          },
        },
        {
          name: 'invalid failOnMismatch type',
          config: {
            visualRegression: {
              failOnMismatch: 'no',
            },
          },
        },
      ];

      for (const invalidConfig of invalidConfigs) {
        const fullConfig = {
          version: '1.0',
          project: {
            name: 'invalid-test',
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          ...invalidConfig.config,
        };

        expect(() => ApexConfigSchema.parse(fullConfig),
          `Should reject ${invalidConfig.name}`)
          .toThrow();
      }
    });
  });

  describe('Real-world configuration scenarios', () => {
    it('should handle enterprise-grade visual regression config', async () => {
      const enterpriseConfig = {
        version: '1.0',
        project: {
          name: 'enterprise-app',
          language: 'typescript',
          framework: 'react',
          testCommand: 'npm run test:ci',
          lintCommand: 'npm run lint:ci',
          buildCommand: 'npm run build:prod',
        },
        autonomy: {
          level: 'review-before-commit',
        },
        limits: {
          maxCostPerTask: 50.0,
          maxTokensPerTask: 1000000,
        },
        visualRegression: {
          enabled: true,
          threshold: 0.98,
          diffColor: [255, 69, 0],
          snapshotDir: 'tests/e2e/visual-snapshots',
          failOnMismatch: true,
        },
        policy: {
          enforcement: 'strict',
          enabled: true,
        },
      };

      await saveConfig(testDir, enterpriseConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.visualRegression).toEqual({
        enabled: true,
        threshold: 0.98,
        diffColor: [255, 69, 0],
        snapshotDir: 'tests/e2e/visual-snapshots',
        failOnMismatch: true,
      });

      // Verify other config sections aren't affected
      expect(loadedConfig.project.name).toBe('enterprise-app');
      expect(loadedConfig.autonomy?.level).toBe('review-before-commit');
      expect(loadedConfig.limits?.maxCostPerTask).toBe(50.0);
      expect(loadedConfig.policy?.enforcement).toBe('strict');
    });

    it('should handle dev/staging environment configs with different visual regression settings', async () => {
      const envConfigs = {
        development: {
          visualRegression: {
            enabled: false, // Disable in dev
          },
        },
        staging: {
          visualRegression: {
            enabled: true,
            threshold: 0.85, // More lenient for staging
            failOnMismatch: false, // Don't fail builds in staging
            snapshotDir: 'staging/visual-tests',
          },
        },
        production: {
          visualRegression: {
            enabled: true,
            threshold: 0.99, // Very strict for production
            failOnMismatch: true,
            snapshotDir: 'production/visual-tests',
            diffColor: [255, 0, 0], // Red for easy spotting
          },
        },
      };

      for (const [env, envConfig] of Object.entries(envConfigs)) {
        const config = {
          version: '1.0',
          project: {
            name: `app-${env}`,
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          ...envConfig,
        };

        const validatedConfig = ApexConfigSchema.parse(config);
        expect(validatedConfig.visualRegression).toBeDefined();

        if (env === 'development') {
          expect(validatedConfig.visualRegression?.enabled).toBe(false);
        } else {
          expect(validatedConfig.visualRegression?.enabled).toBe(true);
          expect(validatedConfig.visualRegression?.snapshotDir).toBe(`${env}/visual-tests`);
        }
      }
    });
  });

  describe('Backward compatibility', () => {
    it('should load config without visualRegression section (backward compatibility)', async () => {
      const legacyYamlContent = `version: "1.0"
project:
  name: legacy-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
limits:
  maxCostPerTask: 10.0`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, legacyYamlContent);

      const config = await loadConfig(testDir);

      expect(config.visualRegression).toBeUndefined();
      expect(config.project.name).toBe('legacy-project');
      expect(config.autonomy?.level).toBe('review-before-commit');
      expect(config.limits?.maxCostPerTask).toBe(10.0);
    });

    it('should preserve existing config when adding visualRegression section', async () => {
      // First, create a legacy config
      const legacyConfig = {
        version: '1.0',
        project: {
          name: 'evolving-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
        },
        limits: {
          maxTokensPerTask: 200000,
        },
      };

      await saveConfig(testDir, legacyConfig);
      const loadedLegacy = await loadConfig(testDir);
      expect(loadedLegacy.visualRegression).toBeUndefined();

      // Then update with visualRegression
      const updatedConfig = {
        ...legacyConfig,
        visualRegression: {
          enabled: true,
          threshold: 0.92,
          snapshotDir: 'tests/visual-regression',
        },
      };

      await saveConfig(testDir, updatedConfig);
      const loadedUpdated = await loadConfig(testDir);

      expect(loadedUpdated.visualRegression).toEqual({
        enabled: true,
        threshold: 0.92,
        diffColor: [255, 0, 255], // default
        snapshotDir: 'tests/visual-regression',
        failOnMismatch: true, // default
      });

      // Verify existing config is preserved
      expect(loadedUpdated.project.name).toBe('evolving-project');
      expect(loadedUpdated.autonomy?.level).toBe('full-auto');
      expect(loadedUpdated.limits?.maxTokensPerTask).toBe(200000);
    });
  });
});