import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  initializeApex,
} from '../config.js';
import { ApexConfig } from '../types.js';

describe('Linter Configuration Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-linter-integration-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Save and Load Linter Configuration', () => {
    it('should save and load complete linter configuration', async () => {
      const configWithLinter: ApexConfig = {
        version: '1.0',
        project: {
          name: 'linter-integration-test',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          global: {
            enabled: true,
            runOnCommit: true,
            runOnPush: true,
            runOnSave: false,
            parallel: true,
            maxConcurrency: 6,
            failFast: false,
            cache: true,
            cacheDirectory: '/custom/cache/linters',
            workingDirectory: '/project/root',
            timeoutMs: 90000,
          },
          eslint: {
            enabled: true,
            configPath: '.eslintrc.custom.js',
            include: [
              'src/**/*.ts',
              'src/**/*.tsx',
              'pages/**/*.ts',
              'pages/**/*.tsx',
            ],
            exclude: [
              'src/**/*.test.ts',
              'src/**/*.spec.ts',
              '*.d.ts',
            ],
            autoFix: true,
            maxWarnings: 5,
            cliOptions: ['--no-ignore', '--report-unused-disable-directives'],
            environments: ['browser', 'node', 'jest'],
            parserOptions: {
              ecmaVersion: 2023,
              sourceType: 'module',
              ecmaFeatures: {
                jsx: true,
              },
            },
            severity: 'error',
          },
          prettier: {
            enabled: true,
            configPath: '.prettierrc.json',
            include: [
              'src/**/*.{ts,tsx,js,jsx}',
              'pages/**/*.{ts,tsx}',
              '**/*.json',
              '**/*.md',
            ],
            exclude: [
              'node_modules/**',
              'dist/**',
              '.next/**',
              'package-lock.json',
            ],
            autoFix: true,
            options: {
              semi: false,
              singleQuote: true,
              tabWidth: 2,
              trailingComma: 'es5',
              printWidth: 100,
              useTabs: false,
              quoteProps: 'as-needed',
              bracketSpacing: true,
              arrowParens: 'avoid',
            },
            severity: 'warn',
          },
          custom: [
            {
              name: 'tslint-custom',
              enabled: true,
              command: 'tslint',
              args: ['--format', 'json', '--project', 'tsconfig.json'],
              include: ['src/**/*.ts', 'src/**/*.tsx'],
              exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
              autoFix: false,
              workingDirectory: '/project/root',
              environment: {
                NODE_ENV: 'production',
                TSLINT_CONFIG: '/custom/tslint.json',
              },
              timeoutMs: 45000,
              severity: 'warn',
              description: 'Custom TSLint configuration for TypeScript files',
            },
            {
              name: 'stylelint',
              enabled: true,
              command: 'stylelint',
              args: ['--formatter', 'json', '--config', '.stylelintrc.json'],
              include: [
                'src/**/*.css',
                'src/**/*.scss',
                'src/**/*.module.css',
              ],
              exclude: ['node_modules/**', 'dist/**'],
              autoFix: true,
              timeoutMs: 30000,
              severity: 'error',
              description: 'CSS and SCSS linting with Stylelint',
            },
          ],
          order: ['prettier', 'eslint', 'tslint-custom', 'stylelint'],
          integrations: {
            preCommit: {
              enabled: true,
              linters: ['prettier', 'eslint'],
              autoFix: true,
              failOnError: true,
            },
            ci: {
              enabled: true,
              linters: ['eslint', 'tslint-custom', 'stylelint'],
              autoFix: false,
              failOnError: true,
              uploadReports: true,
              reportFormat: 'junit',
            },
            ide: {
              enabled: true,
              autoFixOnSave: true,
              showInlineErrors: true,
              formatOnSave: true,
            },
          },
        },
      };

      await saveConfig(testDir, configWithLinter);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.linter).toBeDefined();

      // Test global config
      expect(loadedConfig.linter?.global?.enabled).toBe(true);
      expect(loadedConfig.linter?.global?.runOnPush).toBe(true);
      expect(loadedConfig.linter?.global?.maxConcurrency).toBe(6);
      expect(loadedConfig.linter?.global?.cacheDirectory).toBe('/custom/cache/linters');
      expect(loadedConfig.linter?.global?.timeoutMs).toBe(90000);

      // Test ESLint config
      expect(loadedConfig.linter?.eslint?.enabled).toBe(true);
      expect(loadedConfig.linter?.eslint?.configPath).toBe('.eslintrc.custom.js');
      expect(loadedConfig.linter?.eslint?.include).toEqual([
        'src/**/*.ts',
        'src/**/*.tsx',
        'pages/**/*.ts',
        'pages/**/*.tsx',
      ]);
      expect(loadedConfig.linter?.eslint?.autoFix).toBe(true);
      expect(loadedConfig.linter?.eslint?.maxWarnings).toBe(5);
      expect(loadedConfig.linter?.eslint?.environments).toEqual(['browser', 'node', 'jest']);
      expect(loadedConfig.linter?.eslint?.parserOptions?.ecmaVersion).toBe(2023);

      // Test Prettier config
      expect(loadedConfig.linter?.prettier?.enabled).toBe(true);
      expect(loadedConfig.linter?.prettier?.options?.semi).toBe(false);
      expect(loadedConfig.linter?.prettier?.options?.singleQuote).toBe(true);
      expect(loadedConfig.linter?.prettier?.options?.printWidth).toBe(100);

      // Test custom linters
      expect(loadedConfig.linter?.custom).toHaveLength(2);
      const tslintCustom = loadedConfig.linter?.custom?.find(l => l.name === 'tslint-custom');
      expect(tslintCustom?.command).toBe('tslint');
      expect(tslintCustom?.environment?.NODE_ENV).toBe('production');
      expect(tslintCustom?.timeoutMs).toBe(45000);

      const stylelint = loadedConfig.linter?.custom?.find(l => l.name === 'stylelint');
      expect(stylelint?.autoFix).toBe(true);
      expect(stylelint?.severity).toBe('error');

      // Test execution order
      expect(loadedConfig.linter?.order).toEqual(['prettier', 'eslint', 'tslint-custom', 'stylelint']);

      // Test integrations
      expect(loadedConfig.linter?.integrations?.preCommit?.enabled).toBe(true);
      expect(loadedConfig.linter?.integrations?.ci?.uploadReports).toBe(true);
      expect(loadedConfig.linter?.integrations?.ci?.reportFormat).toBe('junit');
      expect(loadedConfig.linter?.integrations?.ide?.autoFixOnSave).toBe(true);
    });

    it('should save and load minimal linter configuration with defaults applied', async () => {
      const configWithMinimalLinter: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-linter-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          eslint: {
            enabled: false,
          },
          prettier: {
            enabled: true,
            autoFix: true,
          },
        },
      };

      await saveConfig(testDir, configWithMinimalLinter);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.linter?.eslint?.enabled).toBe(false);
      expect(loadedConfig.linter?.prettier?.enabled).toBe(true);
      expect(loadedConfig.linter?.prettier?.autoFix).toBe(true);

      // Test that defaults are applied through getEffectiveConfig
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.linter.global.enabled).toBe(true);
      expect(effectiveConfig.linter.global.runOnCommit).toBe(true);
      expect(effectiveConfig.linter.global.maxConcurrency).toBe(4);

      expect(effectiveConfig.linter.eslint.enabled).toBe(false);
      expect(effectiveConfig.linter.prettier.enabled).toBe(true);
      expect(effectiveConfig.linter.prettier.autoFix).toBe(true);
      expect(effectiveConfig.linter.prettier.severity).toBe('warn'); // Default
    });

    it('should save config without linter and load with getEffectiveConfig defaults', async () => {
      const configWithoutLinter: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-linter-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, configWithoutLinter);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(loadedConfig.linter).toBeUndefined();
      expect(effectiveConfig.linter).toBeDefined();

      // All linter defaults should be applied
      expect(effectiveConfig.linter.global.enabled).toBe(true);
      expect(effectiveConfig.linter.eslint.enabled).toBe(true);
      expect(effectiveConfig.linter.prettier.enabled).toBe(true);
      expect(effectiveConfig.linter.custom).toEqual([]);
      expect(effectiveConfig.linter.order).toEqual(['eslint', 'prettier']);
    });

    it('should handle partial linter configuration correctly', async () => {
      const configWithPartialLinter: ApexConfig = {
        version: '1.0',
        project: {
          name: 'partial-linter-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          global: {
            parallel: false,
            maxConcurrency: 1,
          },
          custom: [
            {
              name: 'single-custom',
              enabled: true,
              command: 'custom-lint',
            },
          ],
          order: ['eslint', 'single-custom'],
        },
      };

      await saveConfig(testDir, configWithPartialLinter);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Custom global settings should be preserved
      expect(effectiveConfig.linter.global.parallel).toBe(false);
      expect(effectiveConfig.linter.global.maxConcurrency).toBe(1);

      // Defaults should be applied for missing global settings
      expect(effectiveConfig.linter.global.enabled).toBe(true);
      expect(effectiveConfig.linter.global.runOnCommit).toBe(true);
      expect(effectiveConfig.linter.global.cache).toBe(true);

      // ESLint and Prettier defaults should be applied since not specified
      expect(effectiveConfig.linter.eslint.enabled).toBe(true);
      expect(effectiveConfig.linter.prettier.enabled).toBe(true);

      // Custom linter should be preserved
      expect(effectiveConfig.linter.custom).toHaveLength(1);
      expect(effectiveConfig.linter.custom[0].name).toBe('single-custom');

      // Custom order should be preserved
      expect(effectiveConfig.linter.order).toEqual(['eslint', 'single-custom']);
    });
  });

  describe('Integration with initializeApex', () => {
    it('should initialize project with linter configuration defaults', async () => {
      await initializeApex(testDir, {
        projectName: 'linter-init-test',
        language: 'typescript',
      });

      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // Should have linter config with defaults applied
      expect(effective.linter).toBeDefined();
      expect(effective.linter.global.enabled).toBe(true);
      expect(effective.linter.eslint.enabled).toBe(true);
      expect(effective.linter.prettier.enabled).toBe(true);

      // Test specific defaults for TypeScript project
      expect(effective.linter.eslint.include).toContain('**/*.ts');
      expect(effective.linter.eslint.include).toContain('**/*.tsx');
      expect(effective.linter.prettier.include).toContain('**/*.ts');
      expect(effective.linter.prettier.include).toContain('**/*.tsx');
    });

    it('should support language-specific linter defaults', async () => {
      await initializeApex(testDir, {
        projectName: 'js-project',
        language: 'javascript',
      });

      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      // Should include JS files in linter patterns
      expect(effective.linter.eslint.include).toContain('**/*.js');
      expect(effective.linter.eslint.include).toContain('**/*.jsx');
      expect(effective.linter.prettier.include).toContain('**/*.js');
      expect(effective.linter.prettier.include).toContain('**/*.jsx');
    });
  });

  describe('Complex Configuration Scenarios', () => {
    it('should handle configuration with overlapping include/exclude patterns', async () => {
      const complexConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-patterns',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          eslint: {
            enabled: true,
            include: ['src/**/*', 'test/**/*'],
            exclude: ['src/**/*.test.ts', 'test/**/*.spec.ts'],
          },
          prettier: {
            enabled: true,
            include: ['src/**/*', 'docs/**/*.md'],
            exclude: ['src/**/*.generated.ts'],
          },
          custom: [
            {
              name: 'overlap-test',
              enabled: true,
              command: 'test-linter',
              include: ['src/**/*.ts'],
              exclude: ['src/generated/**'],
            },
          ],
        },
      };

      await saveConfig(testDir, complexConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.linter?.eslint?.include).toEqual(['src/**/*', 'test/**/*']);
      expect(loadedConfig.linter?.eslint?.exclude).toEqual(['src/**/*.test.ts', 'test/**/*.spec.ts']);
      expect(loadedConfig.linter?.prettier?.include).toEqual(['src/**/*', 'docs/**/*.md']);
      expect(loadedConfig.linter?.prettier?.exclude).toEqual(['src/**/*.generated.ts']);

      const customLinter = loadedConfig.linter?.custom?.find(l => l.name === 'overlap-test');
      expect(customLinter?.include).toEqual(['src/**/*.ts']);
      expect(customLinter?.exclude).toEqual(['src/generated/**']);
    });

    it('should handle integration configuration edge cases', async () => {
      const edgeCaseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'edge-case-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          integrations: {
            preCommit: {
              enabled: false,
              linters: [],
              autoFix: false,
              failOnError: false,
            },
            ci: {
              enabled: true,
              linters: ['custom-only'],
              autoFix: false,
              failOnError: true,
              uploadReports: false,
              reportFormat: 'checkstyle',
            },
            ide: {
              enabled: false,
              autoFixOnSave: false,
              showInlineErrors: false,
              formatOnSave: false,
            },
          },
        },
      };

      await saveConfig(testDir, edgeCaseConfig);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.linter?.integrations?.preCommit?.enabled).toBe(false);
      expect(loadedConfig.linter?.integrations?.preCommit?.linters).toEqual([]);

      expect(loadedConfig.linter?.integrations?.ci?.enabled).toBe(true);
      expect(loadedConfig.linter?.integrations?.ci?.linters).toEqual(['custom-only']);
      expect(loadedConfig.linter?.integrations?.ci?.reportFormat).toBe('checkstyle');

      expect(loadedConfig.linter?.integrations?.ide?.enabled).toBe(false);
    });

    it('should preserve environment variables in custom linters', async () => {
      const envConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'env-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          custom: [
            {
              name: 'env-linter',
              enabled: true,
              command: 'env-aware-linter',
              environment: {
                LINT_LEVEL: 'strict',
                CONFIG_PATH: '/path/to/config',
                DEBUG: 'true',
                EMPTY_VAR: '',
                NUMBER_AS_STRING: '42',
              },
            },
          ],
        },
      };

      await saveConfig(testDir, envConfig);
      const loadedConfig = await loadConfig(testDir);

      const envLinter = loadedConfig.linter?.custom?.find(l => l.name === 'env-linter');
      expect(envLinter?.environment).toEqual({
        LINT_LEVEL: 'strict',
        CONFIG_PATH: '/path/to/config',
        DEBUG: 'true',
        EMPTY_VAR: '',
        NUMBER_AS_STRING: '42',
      });
    });
  });
});