import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  ApexConfigSchema,
  ProjectConfigSchema,
  GitConfigSchema,
  LimitsConfigSchema,
  ModelsConfigSchema,
  UIConfigSchema,
  ApexConfig,
  ProjectConfig,
  GitConfig,
  LimitsConfig,
  ModelsConfig,
  UIConfig,
} from '../types';
import { loadConfig, saveConfig, getEffectiveConfig, initializeApex } from '../config';

describe('JSDoc Documented Configuration Schemas Validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-config-schemas-jsdoc-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('ApexConfigSchema - Main Configuration Schema', () => {
    it('should validate complete config example from JSDoc', () => {
      // Example from JSDoc documentation
      const apexConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'my-app', language: 'typescript' },
        models: { planning: 'opus', implementation: 'sonnet' },
        git: { branchPrefix: 'apex/', autoPush: true },
        limits: { maxTokensPerTask: 500000, dailyBudget: 100.0 },
        ui: { previewMode: true, diffPreview: true }
      };

      expect(() => ApexConfigSchema.parse(apexConfig)).not.toThrow();
      const parsed = ApexConfigSchema.parse(apexConfig);

      expect(parsed.version).toBe('1.0');
      expect(parsed.project.name).toBe('my-app');
      expect(parsed.project.language).toBe('typescript');
      expect(parsed.models?.planning).toBe('opus');
      expect(parsed.models?.implementation).toBe('sonnet');
      expect(parsed.git?.branchPrefix).toBe('apex/');
      expect(parsed.git?.autoPush).toBe(true);
      expect(parsed.limits?.maxTokensPerTask).toBe(500000);
      expect(parsed.limits?.dailyBudget).toBe(100.0);
      expect(parsed.ui?.previewMode).toBe(true);
      expect(parsed.ui?.diffPreview).toBe(true);
    });

    it('should require minimal configuration with proper defaults', () => {
      const minimalConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };

      expect(() => ApexConfigSchema.parse(minimalConfig)).not.toThrow();
      const parsed = ApexConfigSchema.parse(minimalConfig);

      expect(parsed.version).toBe('1.0');
      expect(parsed.project.name).toBe('test-project');
      // Optional sections should be undefined when not provided
      expect(parsed.models).toBeUndefined();
      expect(parsed.git).toBeUndefined();
      expect(parsed.limits).toBeUndefined();
      expect(parsed.ui).toBeUndefined();
    });

    it('should validate all nested configuration sections', () => {
      const fullConfig = {
        version: '1.0',
        project: {
          name: 'comprehensive-test',
          language: 'typescript',
          framework: 'react',
          testCommand: 'vitest',
          buildCommand: 'vite build'
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku'
        },
        git: {
          branchPrefix: 'feature/',
          commitFormat: 'conventional',
          autoPush: false,
          defaultBranch: 'develop'
        },
        limits: {
          maxTokensPerTask: 750000,
          maxCostPerTask: 15.0,
          dailyBudget: 200.0,
          maxConcurrentTasks: 5
        },
        ui: {
          previewMode: false,
          previewConfidence: 0.9,
          autoExecuteHighConfidence: true,
          diffPreview: false
        }
      };

      expect(() => ApexConfigSchema.parse(fullConfig)).not.toThrow();
      const parsed = ApexConfigSchema.parse(fullConfig);

      // Verify all nested sections are properly parsed
      expect(parsed.project.framework).toBe('react');
      expect(parsed.models?.review).toBe('haiku');
      expect(parsed.git?.commitFormat).toBe('conventional');
      expect(parsed.limits?.maxConcurrentTasks).toBe(5);
      expect(parsed.ui?.autoExecuteHighConfidence).toBe(true);
    });

    it('should reject invalid configuration structures', () => {
      const invalidConfigs = [
        // Missing required version
        { project: { name: 'test' } },
        // Missing required project
        { version: '1.0' },
        // Missing project name
        { version: '1.0', project: {} },
        // Invalid version type
        { version: 123, project: { name: 'test' } },
        // Invalid project type
        { version: '1.0', project: 'not-an-object' }
      ];

      invalidConfigs.forEach((config, index) => {
        expect(() => ApexConfigSchema.parse(config), `Invalid config ${index} should fail`).toThrow();
      });
    });
  });

  describe('ProjectConfigSchema - Project-specific Configuration', () => {
    it('should validate JSDoc example configuration', () => {
      // Example from JSDoc documentation
      const projectConfig: ProjectConfig = {
        name: 'my-app',
        language: 'typescript',
        framework: 'react',
        testCommand: 'npm test',
        buildCommand: 'npm run build'
      };

      expect(() => ProjectConfigSchema.parse(projectConfig)).not.toThrow();
      const parsed = ProjectConfigSchema.parse(projectConfig);

      expect(parsed.name).toBe('my-app');
      expect(parsed.language).toBe('typescript');
      expect(parsed.framework).toBe('react');
      expect(parsed.testCommand).toBe('npm test');
      expect(parsed.buildCommand).toBe('npm run build');
    });

    it('should apply default values for optional commands', () => {
      const minimalConfig = { name: 'minimal-project' };

      const parsed = ProjectConfigSchema.parse(minimalConfig);

      expect(parsed.name).toBe('minimal-project');
      expect(parsed.testCommand).toBe('npm test');
      expect(parsed.lintCommand).toBe('npm run lint');
      expect(parsed.buildCommand).toBe('npm run build');
      expect(parsed.typecheckCommand).toBe('npm run typecheck');
    });

    it('should allow custom command overrides', () => {
      const customConfig = {
        name: 'custom-project',
        testCommand: 'jest',
        lintCommand: 'eslint src/',
        buildCommand: 'webpack --mode production',
        typecheckCommand: 'tsc --noEmit'
      };

      const parsed = ProjectConfigSchema.parse(customConfig);

      expect(parsed.testCommand).toBe('jest');
      expect(parsed.lintCommand).toBe('eslint src/');
      expect(parsed.buildCommand).toBe('webpack --mode production');
      expect(parsed.typecheckCommand).toBe('tsc --noEmit');
    });

    it('should validate different programming languages and frameworks', () => {
      const configurations = [
        { name: 'js-project', language: 'javascript', framework: 'vue' },
        { name: 'py-project', language: 'python', framework: 'django' },
        { name: 'rs-project', language: 'rust' },
        { name: 'go-project', language: 'go', framework: 'gin' }
      ];

      configurations.forEach(config => {
        expect(() => ProjectConfigSchema.parse(config)).not.toThrow();
        const parsed = ProjectConfigSchema.parse(config);
        expect(parsed.name).toBe(config.name);
        expect(parsed.language).toBe(config.language);
        if (config.framework) {
          expect(parsed.framework).toBe(config.framework);
        }
      });
    });
  });

  describe('GitConfigSchema - Git Integration Configuration', () => {
    it('should validate JSDoc example configuration', () => {
      // Example from JSDoc documentation
      const gitConfig: GitConfig = {
        branchPrefix: 'apex/',
        commitFormat: 'conventional',
        autoPush: true,
        defaultBranch: 'main',
        commitAfterSubtask: true,
        createPR: 'always',
        autoWorktree: false
      };

      expect(() => GitConfigSchema.parse(gitConfig)).not.toThrow();
      const parsed = GitConfigSchema.parse(gitConfig);

      expect(parsed.branchPrefix).toBe('apex/');
      expect(parsed.commitFormat).toBe('conventional');
      expect(parsed.autoPush).toBe(true);
      expect(parsed.defaultBranch).toBe('main');
      expect(parsed.commitAfterSubtask).toBe(true);
      expect(parsed.createPR).toBe('always');
      expect(parsed.autoWorktree).toBe(false);
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {};

      const parsed = GitConfigSchema.parse(minimalConfig);

      expect(parsed.branchPrefix).toBe('apex/');
      expect(parsed.commitFormat).toBe('conventional');
      expect(parsed.autoPush).toBe(true);
      expect(parsed.defaultBranch).toBe('main');
      expect(parsed.commitAfterSubtask).toBe(true);
      expect(parsed.pushAfterTask).toBe(true);
      expect(parsed.createPR).toBe('always');
      expect(parsed.prDraft).toBe(false);
      expect(parsed.autoWorktree).toBe(false);
    });

    it('should validate commit format options', () => {
      const formats = ['conventional', 'simple'];

      formats.forEach(format => {
        const config = { commitFormat: format };
        expect(() => GitConfigSchema.parse(config)).not.toThrow();
        const parsed = GitConfigSchema.parse(config);
        expect(parsed.commitFormat).toBe(format);
      });

      // Invalid format should fail
      expect(() => GitConfigSchema.parse({ commitFormat: 'invalid' })).toThrow();
    });

    it('should validate createPR options', () => {
      const options = ['always', 'never', 'ask'];

      options.forEach(option => {
        const config = { createPR: option };
        expect(() => GitConfigSchema.parse(config)).not.toThrow();
        const parsed = GitConfigSchema.parse(config);
        expect(parsed.createPR).toBe(option);
      });

      // Invalid option should fail
      expect(() => GitConfigSchema.parse({ createPR: 'invalid' })).toThrow();
    });

    it('should validate PR configuration with labels and reviewers', () => {
      const config = {
        prLabels: ['enhancement', 'auto-generated'],
        prReviewers: ['alice', 'bob', 'charlie'],
        prDraft: true
      };

      const parsed = GitConfigSchema.parse(config);

      expect(parsed.prLabels).toEqual(['enhancement', 'auto-generated']);
      expect(parsed.prReviewers).toEqual(['alice', 'bob', 'charlie']);
      expect(parsed.prDraft).toBe(true);
    });
  });

  describe('LimitsConfigSchema - Execution Limits and Budgets', () => {
    it('should validate JSDoc example configuration', () => {
      // Example from JSDoc documentation
      const limits: LimitsConfig = {
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        dailyBudget: 100.0,
        maxConcurrentTasks: 3,
        maxRetries: 3
      };

      expect(() => LimitsConfigSchema.parse(limits)).not.toThrow();
      const parsed = LimitsConfigSchema.parse(limits);

      expect(parsed.maxTokensPerTask).toBe(500000);
      expect(parsed.maxCostPerTask).toBe(10.0);
      expect(parsed.dailyBudget).toBe(100.0);
      expect(parsed.maxConcurrentTasks).toBe(3);
      expect(parsed.maxRetries).toBe(3);
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {};

      const parsed = LimitsConfigSchema.parse(minimalConfig);

      expect(parsed.maxTokensPerTask).toBe(500000);
      expect(parsed.maxCostPerTask).toBe(10.0);
      expect(parsed.maxExecutionTime).toBe(0);
      expect(parsed.maxFileChanges).toBe(0);
      expect(parsed.dailyBudget).toBe(100.0);
      expect(parsed.maxTurns).toBe(100);
      expect(parsed.maxConcurrentTasks).toBe(3);
      expect(parsed.maxRetries).toBe(3);
      expect(parsed.retryDelayMs).toBe(1000);
      expect(parsed.retryBackoffFactor).toBe(2);
    });

    it('should validate custom limit configurations', () => {
      const customLimits = {
        maxTokensPerTask: 1000000,
        maxCostPerTask: 25.0,
        maxExecutionTime: 3600000, // 1 hour
        maxFileChanges: 50,
        dailyBudget: 500.0,
        maxTurns: 200,
        maxConcurrentTasks: 8,
        maxRetries: 5,
        retryDelayMs: 2000,
        retryBackoffFactor: 1.5
      };

      const parsed = LimitsConfigSchema.parse(customLimits);

      expect(parsed.maxTokensPerTask).toBe(1000000);
      expect(parsed.maxCostPerTask).toBe(25.0);
      expect(parsed.maxExecutionTime).toBe(3600000);
      expect(parsed.maxFileChanges).toBe(50);
      expect(parsed.dailyBudget).toBe(500.0);
      expect(parsed.maxTurns).toBe(200);
      expect(parsed.maxConcurrentTasks).toBe(8);
      expect(parsed.maxRetries).toBe(5);
      expect(parsed.retryDelayMs).toBe(2000);
      expect(parsed.retryBackoffFactor).toBe(1.5);
    });

    it('should enforce reasonable constraints on limit values', () => {
      // Test zero and negative values where appropriate
      const validZeroValues = {
        maxExecutionTime: 0, // 0 means no limit
        maxFileChanges: 0    // 0 means no limit
      };

      expect(() => LimitsConfigSchema.parse(validZeroValues)).not.toThrow();
    });
  });

  describe('ModelsConfigSchema - AI Model Selection', () => {
    it('should validate JSDoc example configuration', () => {
      // Example from JSDoc documentation
      const models: ModelsConfig = {
        planning: 'opus',      // Use powerful model for complex planning
        implementation: 'sonnet', // Balanced model for coding
        review: 'haiku'        // Fast model for code review
      };

      expect(() => ModelsConfigSchema.parse(models)).not.toThrow();
      const parsed = ModelsConfigSchema.parse(models);

      expect(parsed.planning).toBe('opus');
      expect(parsed.implementation).toBe('sonnet');
      expect(parsed.review).toBe('haiku');
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {};

      const parsed = ModelsConfigSchema.parse(minimalConfig);

      expect(parsed.planning).toBe('opus');
      expect(parsed.implementation).toBe('sonnet');
      expect(parsed.review).toBe('haiku');
    });

    it('should validate all available model options', () => {
      const models = ['opus', 'sonnet', 'haiku', 'inherit'];

      models.forEach(model => {
        const config = {
          planning: model,
          implementation: model,
          review: model
        };

        expect(() => ModelsConfigSchema.parse(config)).not.toThrow();
        const parsed = ModelsConfigSchema.parse(config);
        expect(parsed.planning).toBe(model);
        expect(parsed.implementation).toBe(model);
        expect(parsed.review).toBe(model);
      });

      // Invalid model should fail
      const invalidConfig = { planning: 'gpt-4' };
      expect(() => ModelsConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should allow mixed model configurations', () => {
      const config = {
        planning: 'opus',      // Most capable for planning
        implementation: 'sonnet', // Balanced for implementation
        review: 'haiku'        // Fast for review
      };

      const parsed = ModelsConfigSchema.parse(config);

      expect(parsed.planning).toBe('opus');
      expect(parsed.implementation).toBe('sonnet');
      expect(parsed.review).toBe('haiku');
    });

    it('should validate inherit option for model inheritance', () => {
      const config = {
        planning: 'opus',
        implementation: 'inherit', // Inherits from planning
        review: 'inherit'          // Inherits from planning
      };

      expect(() => ModelsConfigSchema.parse(config)).not.toThrow();
      const parsed = ModelsConfigSchema.parse(config);

      expect(parsed.planning).toBe('opus');
      expect(parsed.implementation).toBe('inherit');
      expect(parsed.review).toBe('inherit');
    });
  });

  describe('UIConfigSchema - User Interface Configuration', () => {
    it('should validate JSDoc example configuration', () => {
      // Example from JSDoc documentation
      const ui: UIConfig = {
        previewMode: true,
        previewConfidence: 0.7,
        autoExecuteHighConfidence: false,
        previewTimeout: 5000,
        diffPreview: true
      };

      expect(() => UIConfigSchema.parse(ui)).not.toThrow();
      const parsed = UIConfigSchema.parse(ui);

      expect(parsed.previewMode).toBe(true);
      expect(parsed.previewConfidence).toBe(0.7);
      expect(parsed.autoExecuteHighConfidence).toBe(false);
      expect(parsed.previewTimeout).toBe(5000);
      expect(parsed.diffPreview).toBe(true);
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {};

      const parsed = UIConfigSchema.parse(minimalConfig);

      expect(parsed.previewMode).toBe(true);
      expect(parsed.previewConfidence).toBe(0.7);
      expect(parsed.autoExecuteHighConfidence).toBe(false);
      expect(parsed.previewTimeout).toBe(5000);
      expect(parsed.diffPreview).toBe(true);
    });

    it('should validate previewConfidence range constraints', () => {
      // Valid confidence values (0-1 range)
      const validValues = [0, 0.1, 0.5, 0.7, 0.9, 1.0];

      validValues.forEach(value => {
        const config = { previewConfidence: value };
        expect(() => UIConfigSchema.parse(config)).not.toThrow();
        const parsed = UIConfigSchema.parse(config);
        expect(parsed.previewConfidence).toBe(value);
      });

      // Invalid confidence values (outside 0-1 range)
      const invalidValues = [-0.1, 1.1, 2.0, -1];

      invalidValues.forEach(value => {
        const config = { previewConfidence: value };
        expect(() => UIConfigSchema.parse(config), `Invalid confidence ${value} should fail`).toThrow();
      });
    });

    it('should validate previewTimeout minimum constraint', () => {
      // Valid timeout values (>= 1000ms)
      const validValues = [1000, 2000, 5000, 10000, 30000];

      validValues.forEach(value => {
        const config = { previewTimeout: value };
        expect(() => UIConfigSchema.parse(config)).not.toThrow();
        const parsed = UIConfigSchema.parse(config);
        expect(parsed.previewTimeout).toBe(value);
      });

      // Invalid timeout values (< 1000ms)
      const invalidValues = [0, 500, 999];

      invalidValues.forEach(value => {
        const config = { previewTimeout: value };
        expect(() => UIConfigSchema.parse(config), `Invalid timeout ${value} should fail`).toThrow();
      });
    });

    it('should validate boolean type constraints', () => {
      const booleanFields = ['previewMode', 'autoExecuteHighConfidence', 'diffPreview'];

      booleanFields.forEach(field => {
        // Valid boolean values
        [true, false].forEach(value => {
          const config = { [field]: value };
          expect(() => UIConfigSchema.parse(config)).not.toThrow();
          const parsed = UIConfigSchema.parse(config);
          expect(parsed[field as keyof UIConfig]).toBe(value);
        });

        // Invalid non-boolean values
        ['true', 'false', 1, 0, null, undefined].forEach(value => {
          const config = { [field]: value };
          expect(() => UIConfigSchema.parse(config), `Invalid ${field} value ${value} should fail`).toThrow();
        });
      });
    });
  });

  describe('Integration Tests with YAML Configuration', () => {
    it('should load and validate complete YAML configuration with all schemas', async () => {
      const yamlContent = `
version: '1.0'
project:
  name: 'integration-test-project'
  language: 'typescript'
  framework: 'react'
  testCommand: 'vitest run'
  buildCommand: 'vite build'

models:
  planning: 'opus'
  implementation: 'sonnet'
  review: 'haiku'

git:
  branchPrefix: 'feature/'
  commitFormat: 'conventional'
  autoPush: true
  defaultBranch: 'main'
  createPR: 'always'
  prDraft: false

limits:
  maxTokensPerTask: 750000
  maxCostPerTask: 15.0
  dailyBudget: 200.0
  maxConcurrentTasks: 5
  maxRetries: 3

ui:
  previewMode: true
  previewConfidence: 0.8
  autoExecuteHighConfidence: true
  previewTimeout: 7500
  diffPreview: true
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, yamlContent);

      const config = await loadConfig(testDir);

      // Validate project configuration
      expect(config.project.name).toBe('integration-test-project');
      expect(config.project.language).toBe('typescript');
      expect(config.project.framework).toBe('react');
      expect(config.project.testCommand).toBe('vitest run');
      expect(config.project.buildCommand).toBe('vite build');

      // Validate models configuration
      expect(config.models?.planning).toBe('opus');
      expect(config.models?.implementation).toBe('sonnet');
      expect(config.models?.review).toBe('haiku');

      // Validate git configuration
      expect(config.git?.branchPrefix).toBe('feature/');
      expect(config.git?.commitFormat).toBe('conventional');
      expect(config.git?.autoPush).toBe(true);
      expect(config.git?.defaultBranch).toBe('main');
      expect(config.git?.createPR).toBe('always');
      expect(config.git?.prDraft).toBe(false);

      // Validate limits configuration
      expect(config.limits?.maxTokensPerTask).toBe(750000);
      expect(config.limits?.maxCostPerTask).toBe(15.0);
      expect(config.limits?.dailyBudget).toBe(200.0);
      expect(config.limits?.maxConcurrentTasks).toBe(5);
      expect(config.limits?.maxRetries).toBe(3);

      // Validate UI configuration
      expect(config.ui?.previewMode).toBe(true);
      expect(config.ui?.previewConfidence).toBe(0.8);
      expect(config.ui?.autoExecuteHighConfidence).toBe(true);
      expect(config.ui?.previewTimeout).toBe(7500);
      expect(config.ui?.diffPreview).toBe(true);
    });

    it('should handle partial YAML configuration with proper defaults', async () => {
      const partialYamlContent = `
version: '1.0'
project:
  name: 'partial-config-test'
  language: 'python'

models:
  planning: 'opus'

ui:
  previewMode: false
`;

      const configPath = path.join(testDir, '.apex', 'config.yaml');
      await fs.writeFile(configPath, partialYamlContent);

      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // Validate provided configuration
      expect(config.project.name).toBe('partial-config-test');
      expect(config.project.language).toBe('python');
      expect(config.models?.planning).toBe('opus');
      expect(config.ui?.previewMode).toBe(false);

      // Validate defaults are applied in effective config
      expect(effective.project.testCommand).toBe('npm test');
      expect(effective.models.implementation).toBe('sonnet');
      expect(effective.models.review).toBe('haiku');
      expect(effective.git.branchPrefix).toBe('apex/');
      expect(effective.limits.maxTokensPerTask).toBe(500000);
      expect(effective.ui.previewConfidence).toBe(0.7);
      expect(effective.ui.diffPreview).toBe(true);
    });

    it('should save and reload configuration maintaining schema compliance', async () => {
      const originalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'save-reload-test',
          language: 'typescript',
          framework: 'svelte'
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku'
        },
        git: {
          branchPrefix: 'dev/',
          commitFormat: 'simple',
          autoPush: false
        },
        limits: {
          maxTokensPerTask: 600000,
          dailyBudget: 150.0
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.85,
          diffPreview: false
        }
      };

      // Save configuration
      await saveConfig(testDir, originalConfig);

      // Reload configuration
      const reloadedConfig = await loadConfig(testDir);

      // Verify all data is preserved and schema-compliant
      expect(reloadedConfig.project.name).toBe('save-reload-test');
      expect(reloadedConfig.project.language).toBe('typescript');
      expect(reloadedConfig.project.framework).toBe('svelte');
      expect(reloadedConfig.models?.planning).toBe('opus');
      expect(reloadedConfig.models?.implementation).toBe('sonnet');
      expect(reloadedConfig.models?.review).toBe('haiku');
      expect(reloadedConfig.git?.branchPrefix).toBe('dev/');
      expect(reloadedConfig.git?.commitFormat).toBe('simple');
      expect(reloadedConfig.git?.autoPush).toBe(false);
      expect(reloadedConfig.limits?.maxTokensPerTask).toBe(600000);
      expect(reloadedConfig.limits?.dailyBudget).toBe(150.0);
      expect(reloadedConfig.ui?.previewMode).toBe(true);
      expect(reloadedConfig.ui?.previewConfidence).toBe(0.85);
      expect(reloadedConfig.ui?.diffPreview).toBe(false);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should reject configurations with unknown properties (strict validation)', () => {
      const configsWithUnknownProps = [
        {
          version: '1.0',
          project: { name: 'test', unknownProp: 'should-fail' }
        },
        {
          version: '1.0',
          project: { name: 'test' },
          models: { planning: 'opus', invalidModel: 'gpt-4' }
        },
        {
          version: '1.0',
          project: { name: 'test' },
          git: { branchPrefix: 'apex/', unknownGitOption: true }
        },
        {
          version: '1.0',
          project: { name: 'test' },
          limits: { maxTokensPerTask: 500000, unknownLimit: 999 }
        },
        {
          version: '1.0',
          project: { name: 'test' },
          ui: { previewMode: true, unknownUIOption: 'invalid' }
        }
      ];

      configsWithUnknownProps.forEach((config, index) => {
        expect(() => ApexConfigSchema.parse(config), `Config with unknown props ${index} should fail`).toThrow();
      });
    });

    it('should handle type coercion correctly', () => {
      // Test cases where YAML might parse values as different types
      const yamlCoercionCases = [
        {
          config: { ui: { previewMode: 'true' } },
          shouldFail: true, // String 'true' should not be coerced to boolean
          description: 'String boolean should fail'
        },
        {
          config: { limits: { maxTokensPerTask: '500000' } },
          shouldFail: true, // String number should not be coerced
          description: 'String number should fail'
        },
        {
          config: { ui: { previewConfidence: '0.7' } },
          shouldFail: true, // String float should not be coerced
          description: 'String float should fail'
        }
      ];

      yamlCoercionCases.forEach(({ config, shouldFail, description }) => {
        const fullConfig = {
          version: '1.0',
          project: { name: 'coercion-test' },
          ...config
        };

        if (shouldFail) {
          expect(() => ApexConfigSchema.parse(fullConfig), description).toThrow();
        } else {
          expect(() => ApexConfigSchema.parse(fullConfig), description).not.toThrow();
        }
      });
    });
  });

  describe('TypeScript Type Safety and IntelliSense Support', () => {
    it('should provide proper TypeScript types for configuration objects', () => {
      // This test ensures the types are properly exported and usable
      const config = ApexConfigSchema.parse({
        version: '1.0',
        project: { name: 'type-test' },
        models: { planning: 'opus' },
        git: { branchPrefix: 'test/' },
        limits: { maxTokensPerTask: 400000 },
        ui: { previewMode: true }
      });

      // TypeScript should infer these types correctly
      const projectName: string = config.project.name;
      const planningModel: string | undefined = config.models?.planning;
      const branchPrefix: string | undefined = config.git?.branchPrefix;
      const tokenLimit: number | undefined = config.limits?.maxTokensPerTask;
      const previewMode: boolean | undefined = config.ui?.previewMode;

      expect(projectName).toBe('type-test');
      expect(planningModel).toBe('opus');
      expect(branchPrefix).toBe('test/');
      expect(tokenLimit).toBe(400000);
      expect(previewMode).toBe(true);

      // Test effective config types
      const effective = getEffectiveConfig(config);
      const effectiveTokenLimit: number = effective.limits.maxTokensPerTask;
      const effectivePreviewMode: boolean = effective.ui.previewMode;

      expect(typeof effectiveTokenLimit).toBe('number');
      expect(typeof effectivePreviewMode).toBe('boolean');
      expect(effectiveTokenLimit).toBe(400000);
      expect(effectivePreviewMode).toBe(true);
    });
  });
});