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
import {
  LinterConfigSchema,
  LinterGlobalConfigSchema,
  CustomLinterConfigSchema,
  ApexConfig,
  ApexConfigSchema,
} from '../types.js';

describe('Linter Configuration Schema Validation', () => {
  describe('CustomLinterConfigSchema', () => {
    it('should validate minimal custom linter config', () => {
      const minimalConfig = {
        name: 'test-linter',
        enabled: true,
        command: 'test-linter',
      };

      const result = CustomLinterConfigSchema.parse(minimalConfig);
      expect(result.name).toBe('test-linter');
      expect(result.enabled).toBe(true);
      expect(result.command).toBe('test-linter');
      expect(result.args).toEqual([]);
      expect(result.autoFix).toBe(false);
    });

    it('should validate complete custom linter config', () => {
      const completeConfig = {
        name: 'comprehensive-linter',
        enabled: true,
        command: 'lint-tool',
        args: ['--strict', '--format=json'],
        include: ['src/**/*.ts', 'lib/**/*.js'],
        exclude: ['node_modules/**', '*.test.ts'],
        autoFix: true,
        workingDirectory: '/project/root',
        environment: {
          NODE_ENV: 'production',
          LINT_CONFIG: '/custom/config.json',
        },
        timeoutMs: 30000,
        severity: 'error',
        description: 'Custom TypeScript linter with strict rules',
      };

      const result = CustomLinterConfigSchema.parse(completeConfig);
      expect(result.name).toBe('comprehensive-linter');
      expect(result.args).toEqual(['--strict', '--format=json']);
      expect(result.include).toEqual(['src/**/*.ts', 'lib/**/*.js']);
      expect(result.exclude).toEqual(['node_modules/**', '*.test.ts']);
      expect(result.environment).toEqual({
        NODE_ENV: 'production',
        LINT_CONFIG: '/custom/config.json',
      });
      expect(result.timeoutMs).toBe(30000);
      expect(result.severity).toBe('error');
    });

    it('should apply defaults for optional fields', () => {
      const configWithDefaults = {
        name: 'default-linter',
        enabled: false,
        command: 'default-cmd',
      };

      const result = CustomLinterConfigSchema.parse(configWithDefaults);
      expect(result.args).toEqual([]);
      expect(result.include).toEqual([]);
      expect(result.exclude).toEqual([]);
      expect(result.autoFix).toBe(false);
      expect(result.timeoutMs).toBe(30000);
      expect(result.severity).toBe('warn');
    });

    it('should validate severity enum values', () => {
      const validSeverities = ['info', 'warn', 'error'];

      for (const severity of validSeverities) {
        const config = {
          name: 'severity-test',
          enabled: true,
          command: 'test',
          severity,
        };

        const result = CustomLinterConfigSchema.parse(config);
        expect(result.severity).toBe(severity);
      }
    });

    it('should reject invalid severity values', () => {
      const invalidConfig = {
        name: 'invalid-severity',
        enabled: true,
        command: 'test',
        severity: 'critical',
      };

      expect(() => CustomLinterConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should require name, enabled, and command fields', () => {
      expect(() => CustomLinterConfigSchema.parse({})).toThrow();
      expect(() => CustomLinterConfigSchema.parse({ name: 'test' })).toThrow();
      expect(() => CustomLinterConfigSchema.parse({ name: 'test', enabled: true })).toThrow();
    });

    it('should validate environment as key-value pairs', () => {
      const configWithEnv = {
        name: 'env-test',
        enabled: true,
        command: 'test',
        environment: {
          VAR1: 'value1',
          VAR2: 'value2',
          VAR3: '',
        },
      };

      const result = CustomLinterConfigSchema.parse(configWithEnv);
      expect(result.environment).toEqual({
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: '',
      });
    });
  });

  describe('LinterGlobalConfigSchema', () => {
    it('should apply default values for all optional fields', () => {
      const minimalConfig = {};

      const result = LinterGlobalConfigSchema.parse(minimalConfig);
      expect(result.enabled).toBe(true);
      expect(result.runOnCommit).toBe(true);
      expect(result.runOnPush).toBe(false);
      expect(result.runOnSave).toBe(false);
      expect(result.parallel).toBe(true);
      expect(result.maxConcurrency).toBe(4);
      expect(result.failFast).toBe(false);
      expect(result.cache).toBe(true);
      expect(result.cacheDirectory).toBe('.apex/cache/linters');
      expect(result.timeoutMs).toBe(60000);
    });

    it('should preserve explicitly set values', () => {
      const customConfig = {
        enabled: false,
        runOnCommit: false,
        runOnPush: true,
        runOnSave: true,
        parallel: false,
        maxConcurrency: 2,
        failFast: true,
        cache: false,
        cacheDirectory: '/custom/cache',
        workingDirectory: '/custom/working',
        timeoutMs: 120000,
      };

      const result = LinterGlobalConfigSchema.parse(customConfig);
      expect(result).toEqual(customConfig);
    });

    it('should validate maxConcurrency as positive integer', () => {
      expect(() => {
        LinterGlobalConfigSchema.parse({ maxConcurrency: -1 });
      }).toThrow();

      expect(() => {
        LinterGlobalConfigSchema.parse({ maxConcurrency: 0 });
      }).toThrow();

      const validConfig = LinterGlobalConfigSchema.parse({ maxConcurrency: 8 });
      expect(validConfig.maxConcurrency).toBe(8);
    });

    it('should validate timeoutMs as positive integer', () => {
      expect(() => {
        LinterGlobalConfigSchema.parse({ timeoutMs: -1000 });
      }).toThrow();

      expect(() => {
        LinterGlobalConfigSchema.parse({ timeoutMs: 0 });
      }).toThrow();

      const validConfig = LinterGlobalConfigSchema.parse({ timeoutMs: 45000 });
      expect(validConfig.timeoutMs).toBe(45000);
    });
  });

  describe('LinterConfigSchema', () => {
    it('should validate minimal linter configuration', () => {
      const minimalConfig = {};

      const result = LinterConfigSchema.parse(minimalConfig);
      expect(result.eslint?.enabled).toBe(true);
      expect(result.prettier?.enabled).toBe(true);
      expect(result.custom).toEqual([]);
      expect(result.order).toEqual(['eslint', 'prettier']);
    });

    it('should validate complete linter configuration', () => {
      const completeConfig = {
        global: {
          enabled: true,
          runOnCommit: true,
          runOnPush: false,
          parallel: true,
          maxConcurrency: 6,
          failFast: false,
          cache: true,
          cacheDirectory: '/custom/cache',
          timeoutMs: 90000,
        },
        eslint: {
          enabled: true,
          configPath: '.eslintrc.js',
          include: ['src/**/*.ts'],
          exclude: ['*.test.ts'],
          autoFix: true,
          maxWarnings: 5,
          cliOptions: ['--no-ignore'],
          environments: ['node', 'browser'],
          severity: 'error',
        },
        prettier: {
          enabled: true,
          configPath: '.prettierrc',
          include: ['src/**/*.{ts,js}'],
          exclude: ['dist/**'],
          autoFix: true,
          options: {
            semi: false,
            singleQuote: true,
          },
          severity: 'warn',
        },
        custom: [
          {
            name: 'tslint-custom',
            enabled: true,
            command: 'tslint',
            args: ['--format', 'json'],
            severity: 'warn',
          },
        ],
        order: ['eslint', 'tslint-custom', 'prettier'],
        integrations: {
          preCommit: {
            enabled: true,
            linters: ['eslint', 'prettier'],
            autoFix: true,
            failOnError: true,
          },
          ci: {
            enabled: true,
            linters: ['eslint'],
            autoFix: false,
            failOnError: true,
            uploadReports: true,
            reportFormat: 'junit',
          },
          ide: {
            enabled: true,
            autoFixOnSave: false,
            showInlineErrors: true,
            formatOnSave: true,
          },
        },
      };

      const result = LinterConfigSchema.parse(completeConfig);
      expect(result.global?.maxConcurrency).toBe(6);
      expect(result.eslint?.maxWarnings).toBe(5);
      expect(result.prettier?.options?.semi).toBe(false);
      expect(result.custom).toHaveLength(1);
      expect(result.custom![0].name).toBe('tslint-custom');
      expect(result.order).toEqual(['eslint', 'tslint-custom', 'prettier']);
      expect(result.integrations?.ci?.reportFormat).toBe('junit');
    });

    it('should apply ESLint defaults correctly', () => {
      const configWithMinimalESLint = {
        eslint: {
          enabled: true,
        },
      };

      const result = LinterConfigSchema.parse(configWithMinimalESLint);
      expect(result.eslint?.autoFix).toBe(false);
      expect(result.eslint?.maxWarnings).toBe(0);
      expect(result.eslint?.cliOptions).toEqual([]);
      expect(result.eslint?.environments).toEqual(['node', 'es2022']);
      expect(result.eslint?.severity).toBe('warn');
    });

    it('should apply Prettier defaults correctly', () => {
      const configWithMinimalPrettier = {
        prettier: {
          enabled: true,
        },
      };

      const result = LinterConfigSchema.parse(configWithMinimalPrettier);
      expect(result.prettier?.autoFix).toBe(false);
      expect(result.prettier?.severity).toBe('warn');
      expect(result.prettier?.options).toBeUndefined();
    });

    it('should validate integration configurations', () => {
      const configWithIntegrations = {
        integrations: {
          preCommit: {
            enabled: false,
            linters: ['custom-linter'],
            autoFix: false,
            failOnError: false,
          },
          ci: {
            enabled: true,
            linters: ['eslint', 'prettier'],
            uploadReports: false,
            reportFormat: 'json',
          },
          ide: {
            enabled: false,
            autoFixOnSave: true,
            showInlineErrors: false,
            formatOnSave: false,
          },
        },
      };

      const result = LinterConfigSchema.parse(configWithIntegrations);
      expect(result.integrations?.preCommit?.enabled).toBe(false);
      expect(result.integrations?.preCommit?.linters).toEqual(['custom-linter']);
      expect(result.integrations?.ci?.reportFormat).toBe('json');
      expect(result.integrations?.ide?.autoFixOnSave).toBe(true);
    });

    it('should validate reportFormat enum values', () => {
      const validFormats = ['json', 'junit', 'checkstyle', 'html'];

      for (const format of validFormats) {
        const config = {
          integrations: {
            ci: {
              enabled: true,
              reportFormat: format,
            },
          },
        };

        const result = LinterConfigSchema.parse(config);
        expect(result.integrations?.ci?.reportFormat).toBe(format);
      }
    });

    it('should reject invalid reportFormat values', () => {
      const invalidConfig = {
        integrations: {
          ci: {
            enabled: true,
            reportFormat: 'invalid',
          },
        },
      };

      expect(() => LinterConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('ApexConfigSchema integration', () => {
    it('should parse ApexConfig with linter section', () => {
      const configWithLinter = {
        version: '1.0',
        project: {
          name: 'linter-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          global: {
            enabled: true,
            parallel: true,
          },
          eslint: {
            enabled: true,
            autoFix: false,
          },
          prettier: {
            enabled: true,
            autoFix: true,
          },
        },
      };

      const result = ApexConfigSchema.parse(configWithLinter);
      expect(result.linter).toBeDefined();
      expect(result.linter?.global?.enabled).toBe(true);
      expect(result.linter?.eslint?.enabled).toBe(true);
      expect(result.linter?.prettier?.autoFix).toBe(true);
    });

    it('should parse ApexConfig without linter section', () => {
      const configWithoutLinter = {
        version: '1.0',
        project: {
          name: 'no-linter-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const result = ApexConfigSchema.parse(configWithoutLinter);
      expect(result.linter).toBeUndefined();
    });
  });
});

describe('Linter Configuration Loading and Defaults', () => {
  describe('getEffectiveConfig with linter configuration', () => {
    it('should apply linter defaults when linter section is missing', () => {
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
      expect(effective.linter).toBeDefined();
      expect(effective.linter.global.enabled).toBe(true);
      expect(effective.linter.global.runOnCommit).toBe(true);
      expect(effective.linter.global.runOnPush).toBe(false);
      expect(effective.linter.global.parallel).toBe(true);
      expect(effective.linter.global.maxConcurrency).toBe(4);
      expect(effective.linter.global.failFast).toBe(false);
      expect(effective.linter.global.cache).toBe(true);
      expect(effective.linter.global.cacheDirectory).toBe('.apex/cache/linters');
      expect(effective.linter.global.timeoutMs).toBe(60000);
    });

    it('should preserve custom linter global configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          global: {
            enabled: false,
            runOnCommit: false,
            runOnPush: true,
            parallel: false,
            maxConcurrency: 2,
            failFast: true,
            cache: false,
            cacheDirectory: '/custom/cache',
            workingDirectory: '/custom/working',
            timeoutMs: 30000,
          },
        },
      };

      const effective = getEffectiveConfig(config);
      expect(effective.linter.global.enabled).toBe(false);
      expect(effective.linter.global.runOnCommit).toBe(false);
      expect(effective.linter.global.runOnPush).toBe(true);
      expect(effective.linter.global.parallel).toBe(false);
      expect(effective.linter.global.maxConcurrency).toBe(2);
      expect(effective.linter.global.failFast).toBe(true);
      expect(effective.linter.global.cache).toBe(false);
      expect(effective.linter.global.cacheDirectory).toBe('/custom/cache');
      expect(effective.linter.global.workingDirectory).toBe('/custom/working');
      expect(effective.linter.global.timeoutMs).toBe(30000);
    });

    it('should apply ESLint defaults correctly', () => {
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
      expect(effective.linter.eslint.enabled).toBe(true);
      expect(effective.linter.eslint.configPath).toBeUndefined();
      expect(effective.linter.eslint.include).toEqual([
        '**/*.js',
        '**/*.jsx',
        '**/*.ts',
        '**/*.tsx',
        '**/*.mjs',
        '**/*.cjs',
        '**/*.vue',
        '**/*.svelte',
      ]);
      expect(effective.linter.eslint.exclude).toEqual([
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.min.js',
        '*.bundle.js',
      ]);
      expect(effective.linter.eslint.autoFix).toBe(false);
      expect(effective.linter.eslint.maxWarnings).toBe(0);
      expect(effective.linter.eslint.cliOptions).toEqual([]);
      expect(effective.linter.eslint.environments).toEqual(['node', 'es2022']);
      expect(effective.linter.eslint.severity).toBe('warn');
    });

    it('should preserve custom ESLint configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          eslint: {
            enabled: false,
            configPath: '.eslintrc.custom.js',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
            autoFix: true,
            maxWarnings: 10,
            cliOptions: ['--no-ignore', '--debug'],
            environments: ['browser', 'jest'],
            parserOptions: {
              ecmaVersion: 2023,
              sourceType: 'module',
            },
            severity: 'error',
          },
        },
      };

      const effective = getEffectiveConfig(config);
      expect(effective.linter.eslint.enabled).toBe(false);
      expect(effective.linter.eslint.configPath).toBe('.eslintrc.custom.js');
      expect(effective.linter.eslint.include).toEqual(['src/**/*.ts']);
      expect(effective.linter.eslint.exclude).toEqual(['src/**/*.test.ts']);
      expect(effective.linter.eslint.autoFix).toBe(true);
      expect(effective.linter.eslint.maxWarnings).toBe(10);
      expect(effective.linter.eslint.cliOptions).toEqual(['--no-ignore', '--debug']);
      expect(effective.linter.eslint.environments).toEqual(['browser', 'jest']);
      expect(effective.linter.eslint.parserOptions).toEqual({
        ecmaVersion: 2023,
        sourceType: 'module',
      });
      expect(effective.linter.eslint.severity).toBe('error');
    });

    it('should apply Prettier defaults correctly', () => {
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
      expect(effective.linter.prettier.enabled).toBe(true);
      expect(effective.linter.prettier.configPath).toBeUndefined();
      expect(effective.linter.prettier.include).toEqual([
        '**/*.js',
        '**/*.jsx',
        '**/*.ts',
        '**/*.tsx',
        '**/*.json',
        '**/*.css',
        '**/*.scss',
        '**/*.less',
        '**/*.html',
        '**/*.vue',
        '**/*.svelte',
        '**/*.md',
        '**/*.yaml',
        '**/*.yml',
        '**/*.graphql',
        '**/*.gql',
      ]);
      expect(effective.linter.prettier.exclude).toEqual([
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.min.js',
        '*.bundle.js',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
      ]);
      expect(effective.linter.prettier.autoFix).toBe(false);
      expect(effective.linter.prettier.severity).toBe('warn');
    });

    it('should preserve custom Prettier configuration', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          prettier: {
            enabled: false,
            configPath: '.prettierrc.custom',
            include: ['src/**/*.{ts,js}'],
            exclude: ['src/**/*.generated.ts'],
            autoFix: true,
            options: {
              semi: false,
              singleQuote: true,
              tabWidth: 2,
              trailingComma: 'es5',
            },
            severity: 'error',
          },
        },
      };

      const effective = getEffectiveConfig(config);
      expect(effective.linter.prettier.enabled).toBe(false);
      expect(effective.linter.prettier.configPath).toBe('.prettierrc.custom');
      expect(effective.linter.prettier.include).toEqual(['src/**/*.{ts,js}']);
      expect(effective.linter.prettier.exclude).toEqual(['src/**/*.generated.ts']);
      expect(effective.linter.prettier.autoFix).toBe(true);
      expect(effective.linter.prettier.options).toEqual({
        semi: false,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
      });
      expect(effective.linter.prettier.severity).toBe('error');
    });

    it('should handle custom linters correctly', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          custom: [
            {
              name: 'tslint',
              enabled: true,
              command: 'tslint',
              args: ['--format', 'json'],
              include: ['src/**/*.ts'],
              exclude: ['src/**/*.test.ts'],
              autoFix: false,
              severity: 'warn',
              description: 'TypeScript linter',
            },
            {
              name: 'stylelint',
              enabled: true,
              command: 'stylelint',
              args: ['--formatter', 'json'],
              include: ['src/**/*.css', 'src/**/*.scss'],
              autoFix: true,
              severity: 'error',
              description: 'CSS/SCSS linter',
            },
          ],
        },
      };

      const effective = getEffectiveConfig(config);
      expect(effective.linter.custom).toHaveLength(2);

      const tslint = effective.linter.custom.find(l => l.name === 'tslint');
      expect(tslint).toBeDefined();
      expect(tslint?.enabled).toBe(true);
      expect(tslint?.command).toBe('tslint');
      expect(tslint?.args).toEqual(['--format', 'json']);
      expect(tslint?.severity).toBe('warn');

      const stylelint = effective.linter.custom.find(l => l.name === 'stylelint');
      expect(stylelint).toBeDefined();
      expect(stylelint?.autoFix).toBe(true);
      expect(stylelint?.severity).toBe('error');
    });

    it('should handle execution order correctly', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        linter: {
          order: ['prettier', 'eslint', 'custom-linter'],
        },
      };

      const effective = getEffectiveConfig(config);
      expect(effective.linter.order).toEqual(['prettier', 'eslint', 'custom-linter']);
    });

    it('should apply integration defaults correctly', () => {
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
      expect(effective.linter.integrations.preCommit.enabled).toBe(true);
      expect(effective.linter.integrations.preCommit.linters).toEqual(['eslint', 'prettier']);
      expect(effective.linter.integrations.preCommit.autoFix).toBe(true);
      expect(effective.linter.integrations.preCommit.failOnError).toBe(true);

      expect(effective.linter.integrations.ci.enabled).toBe(true);
      expect(effective.linter.integrations.ci.linters).toEqual(['eslint', 'prettier']);
      expect(effective.linter.integrations.ci.autoFix).toBe(false);
      expect(effective.linter.integrations.ci.failOnError).toBe(true);
      expect(effective.linter.integrations.ci.uploadReports).toBe(false);
      expect(effective.linter.integrations.ci.reportFormat).toBe('json');

      expect(effective.linter.integrations.ide.enabled).toBe(true);
      expect(effective.linter.integrations.ide.autoFixOnSave).toBe(false);
      expect(effective.linter.integrations.ide.showInlineErrors).toBe(true);
      expect(effective.linter.integrations.ide.formatOnSave).toBe(false);
    });
  });
});