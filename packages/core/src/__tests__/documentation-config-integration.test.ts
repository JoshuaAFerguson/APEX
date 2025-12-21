import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getEffectiveConfig } from '../config';
import { ApexConfig, DocumentationAnalysisConfig } from '../types';

describe('Documentation Configuration Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-doc-config-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Configuration File Persistence', () => {
    it('should save and load configuration with documentation settings', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'doc-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 21,
            versionCheckPatterns: ['v\\d+\\.\\d+\\.\\d+', 'custom-pattern'],
            deprecationRequiresMigration: false,
            crossReferenceEnabled: true,
          },
          jsdocAnalysis: {
            enabled: true,
            requirePublicExports: false,
            checkReturnTypes: true,
            checkParameterTypes: false,
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.documentation?.enabled).toBe(true);
      expect(loadedConfig.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(21);
      expect(loadedConfig.documentation?.outdatedDocs?.versionCheckPatterns).toEqual([
        'v\\d+\\.\\d+\\.\\d+',
        'custom-pattern',
      ]);
      expect(loadedConfig.documentation?.outdatedDocs?.deprecationRequiresMigration).toBe(false);
      expect(loadedConfig.documentation?.outdatedDocs?.crossReferenceEnabled).toBe(true);
      expect(loadedConfig.documentation?.jsdocAnalysis?.enabled).toBe(true);
      expect(loadedConfig.documentation?.jsdocAnalysis?.requirePublicExports).toBe(false);
      expect(loadedConfig.documentation?.jsdocAnalysis?.checkReturnTypes).toBe(true);
      expect(loadedConfig.documentation?.jsdocAnalysis?.checkParameterTypes).toBe(false);
    });

    it('should save and load configuration with minimal documentation settings', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-doc-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: false,
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.documentation?.enabled).toBe(false);
      expect(loadedConfig.documentation?.outdatedDocs).toBeUndefined();
      expect(loadedConfig.documentation?.jsdocAnalysis).toBeUndefined();
    });

    it('should save and load configuration without documentation section', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-doc-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.documentation).toBeUndefined();
    });

    it('should preserve other config sections when documentation is present', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'comprehensive-project',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'full',
          overrides: {
            testing: 'review-before-merge',
          },
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          autoPush: false,
        },
        limits: {
          maxTokensPerTask: 250000,
          maxCostPerTask: 15.0,
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 45,
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      // Verify non-documentation fields are preserved
      expect(loadedConfig.project.name).toBe('comprehensive-project');
      expect(loadedConfig.project.language).toBe('typescript');
      expect(loadedConfig.project.framework).toBe('nextjs');
      expect(loadedConfig.autonomy?.default).toBe('full');
      expect(loadedConfig.autonomy?.overrides?.testing).toBe('review-before-merge');
      expect(loadedConfig.git?.branchPrefix).toBe('feature/');
      expect(loadedConfig.git?.commitFormat).toBe('conventional');
      expect(loadedConfig.git?.autoPush).toBe(false);
      expect(loadedConfig.limits?.maxTokensPerTask).toBe(250000);
      expect(loadedConfig.limits?.maxCostPerTask).toBe(15.0);

      // Verify documentation field is preserved
      expect(loadedConfig.documentation?.enabled).toBe(true);
      expect(loadedConfig.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(45);
    });
  });

  describe('getEffectiveConfig Integration', () => {
    it('should preserve documentation settings through getEffectiveConfig', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'effective-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 14,
            deprecationRequiresMigration: false,
          },
          jsdocAnalysis: {
            enabled: false,
            requirePublicExports: true,
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Documentation settings should be preserved
      expect(effectiveConfig.documentation?.enabled).toBe(true);
      expect(effectiveConfig.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(14);
      expect(effectiveConfig.documentation?.outdatedDocs?.deprecationRequiresMigration).toBe(false);
      expect(effectiveConfig.documentation?.jsdocAnalysis?.enabled).toBe(false);
      expect(effectiveConfig.documentation?.jsdocAnalysis?.requirePublicExports).toBe(true);

      // Other defaults should still be applied
      expect(effectiveConfig.autonomy.default).toBe('review-before-merge');
      expect(effectiveConfig.git.branchPrefix).toBe('apex/');
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(500000);
    });

    it('should handle mixed explicit and default values in documentation config', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'mixed-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'manual', // Explicit value
        },
        documentation: {
          // enabled defaults to true
          outdatedDocs: {
            todoAgeThresholdDays: 7, // Explicit value
            // Other fields should use defaults
          },
          jsdocAnalysis: {
            requirePublicExports: false, // Explicit value
            // Other fields should use defaults
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Explicit documentation values
      expect(effectiveConfig.documentation?.enabled).toBe(true); // default
      expect(effectiveConfig.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(7); // explicit
      expect(effectiveConfig.documentation?.jsdocAnalysis?.requirePublicExports).toBe(false); // explicit

      // Default documentation values
      expect(effectiveConfig.documentation?.outdatedDocs?.versionCheckPatterns).toEqual([
        'v\\d+\\.\\d+\\.\\d+',
        'version\\s+\\d+\\.\\d+',
        '\\d+\\.\\d+\\s+release',
        'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
      ]); // default
      expect(effectiveConfig.documentation?.outdatedDocs?.deprecationRequiresMigration).toBe(true); // default
      expect(effectiveConfig.documentation?.outdatedDocs?.crossReferenceEnabled).toBe(true); // default
      expect(effectiveConfig.documentation?.jsdocAnalysis?.enabled).toBe(true); // default
      expect(effectiveConfig.documentation?.jsdocAnalysis?.checkReturnTypes).toBe(true); // default
      expect(effectiveConfig.documentation?.jsdocAnalysis?.checkParameterTypes).toBe(true); // default

      // Other explicit values
      expect(effectiveConfig.autonomy.default).toBe('manual'); // explicit

      // Other default values
      expect(effectiveConfig.git.branchPrefix).toBe('apex/'); // default
    });

    it('should not add documentation config if not specified in original config', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-doc-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        limits: {
          maxCostPerTask: 5.0,
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Documentation should remain undefined
      expect(effectiveConfig.documentation).toBeUndefined();

      // Other values should be properly handled
      expect(effectiveConfig.limits.maxCostPerTask).toBe(5.0); // explicit
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(500000); // default
    });
  });

  describe('Configuration Migration Scenarios', () => {
    it('should handle loading old config without documentation field', async () => {
      // Simulate an older config file that doesn't have documentation field
      const oldConfig = {
        version: '0.9',
        project: {
          name: 'legacy-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          default: 'review-before-commit',
        },
      };

      // Write the old config format directly
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, `version: '0.9'
project:
  name: legacy-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  default: review-before-commit`);

      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.project.name).toBe('legacy-project');
      expect(loadedConfig.autonomy?.default).toBe('review-before-commit');
      expect(loadedConfig.documentation).toBeUndefined();
    });

    it('should handle partial documentation configs from different versions', async () => {
      // Simulate a config that only has outdatedDocs but not jsdocAnalysis
      const partialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-doc-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 30,
            versionCheckPatterns: ['legacy-pattern'],
          },
          // jsdocAnalysis intentionally omitted
        },
      };

      await saveConfig(testDir, partialConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.documentation?.enabled).toBe(true);
      expect(loadedConfig.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(30);
      expect(loadedConfig.documentation?.outdatedDocs?.versionCheckPatterns).toEqual(['legacy-pattern']);
      expect(loadedConfig.documentation?.jsdocAnalysis).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages for invalid documentation config', async () => {
      const invalidConfig = {
        version: '1.0',
        project: {
          name: 'invalid-doc-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: 'invalid-boolean',
          outdatedDocs: {
            todoAgeThresholdDays: -5,
          },
        },
      };

      // Write invalid config directly to file
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, `version: '1.0'
project:
  name: invalid-doc-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
documentation:
  enabled: invalid-boolean
  outdatedDocs:
    todoAgeThresholdDays: -5`);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle corrupted documentation config gracefully', async () => {
      // Write a config with malformed YAML in documentation section
      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, `version: '1.0'
project:
  name: corrupted-doc-project
documentation:
  enabled: true
  outdatedDocs:
    todoAgeThresholdDays: 30
    versionCheckPatterns:
      - valid-pattern
      - [invalid-nested-array]`);

      // Should throw a parsing error
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should load large documentation configs efficiently', async () => {
      const largeConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'large-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 30,
            versionCheckPatterns: Array.from({ length: 500 }, (_, i) => `pattern-${i}-\\d+\\.\\d+`),
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
      };

      const startTime = performance.now();

      await saveConfig(testDir, largeConfig);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(loadedConfig.documentation?.outdatedDocs?.versionCheckPatterns).toHaveLength(500);
      expect(effectiveConfig.documentation?.outdatedDocs?.versionCheckPatterns).toHaveLength(500);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Type Safety in Integration', () => {
    it('should maintain type safety through save/load cycle', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'type-safety-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 30,
            versionCheckPatterns: ['v\\d+\\.\\d+\\.\\d+'],
            deprecationRequiresMigration: true,
            crossReferenceEnabled: false,
          },
          jsdocAnalysis: {
            enabled: false,
            requirePublicExports: true,
            checkReturnTypes: false,
            checkParameterTypes: true,
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      // Type assertions to ensure type safety
      const docConfig: DocumentationAnalysisConfig | undefined = loadedConfig.documentation;
      if (docConfig) {
        expect(typeof docConfig.enabled).toBe('boolean');
        expect(typeof docConfig.outdatedDocs?.todoAgeThresholdDays).toBe('number');
        expect(Array.isArray(docConfig.outdatedDocs?.versionCheckPatterns)).toBe(true);
        expect(typeof docConfig.outdatedDocs?.deprecationRequiresMigration).toBe('boolean');
        expect(typeof docConfig.outdatedDocs?.crossReferenceEnabled).toBe('boolean');
        expect(typeof docConfig.jsdocAnalysis?.enabled).toBe('boolean');
        expect(typeof docConfig.jsdocAnalysis?.requirePublicExports).toBe('boolean');
        expect(typeof docConfig.jsdocAnalysis?.checkReturnTypes).toBe('boolean');
        expect(typeof docConfig.jsdocAnalysis?.checkParameterTypes).toBe('boolean');
      }

      expect(docConfig).toBeDefined();
    });
  });
});