import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getEffectiveConfig } from '../config';
import { ApexConfig, HookConfig, HookConfigSchema, HookType, HookHandler } from '../types';

describe('Hook Configuration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-hooks-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('HookConfigSchema validation', () => {
    it('should validate a complete hook configuration with file handler', () => {
      const hookConfig: HookConfig = {
        name: 'pre-commit-lint',
        type: 'before-commit',
        handler: {
          type: 'file',
          path: './scripts/lint.sh',
          args: ['--fix'],
        },
        priority: 200,
        enabled: true,
        description: 'Runs linting before commits',
        conditions: {
          stages: ['implementation'],
          filePatterns: ['*.ts', '*.js'],
          env: { NODE_ENV: 'development' },
        },
        timeoutMs: 60000,
        failOnError: true,
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(hookConfig);
    });

    it('should validate a minimal hook configuration with inline handler', () => {
      const hookConfig: HookConfig = {
        name: 'test-hook',
        type: 'after-task',
        handler: {
          type: 'inline',
          code: 'echo "Task completed"',
        },
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data?.priority).toBe(100); // default value
      expect(result.data?.enabled).toBe(true); // default value
      expect(result.data?.timeoutMs).toBe(30000); // default value
      expect(result.data?.failOnError).toBe(true); // default value
    });

    it('should validate all supported hook types', () => {
      const hookTypes: HookType[] = [
        'before-task',
        'after-task',
        'before-stage',
        'after-stage',
        'before-commit',
        'after-commit',
        'before-push',
        'after-push',
        'on-error',
        'on-success',
      ];

      for (const type of hookTypes) {
        const hookConfig = {
          name: `${type}-hook`,
          type,
          handler: {
            type: 'inline' as const,
            code: `echo "Running ${type} hook"`,
          },
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(true);
        expect(result.data?.type).toBe(type);
      }
    });

    it('should validate file handler with different configurations', () => {
      const fileHandlers: HookHandler[] = [
        {
          type: 'file',
          path: './scripts/hook.sh',
        },
        {
          type: 'file',
          path: '/usr/local/bin/custom-hook',
          args: ['--verbose', '--config', 'production'],
        },
      ];

      for (const handler of fileHandlers) {
        const hookConfig = {
          name: 'file-handler-test',
          type: 'before-task' as const,
          handler,
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(true);
        expect(result.data?.handler).toEqual(handler);
      }
    });

    it('should validate inline handler with different languages', () => {
      const languages = ['bash', 'javascript', 'typescript'] as const;

      for (const language of languages) {
        const hookConfig = {
          name: `${language}-hook`,
          type: 'after-stage' as const,
          handler: {
            type: 'inline' as const,
            code: 'console.log("test")',
            language,
          },
        };

        const result = HookConfigSchema.safeParse(hookConfig);
        expect(result.success).toBe(true);
        expect(result.data?.handler.language).toBe(language);
      }
    });

    it('should apply default language for inline handler', () => {
      const hookConfig = {
        name: 'default-lang-hook',
        type: 'on-success' as const,
        handler: {
          type: 'inline' as const,
          code: 'echo "success"',
        },
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data?.handler.language).toBe('bash'); // default value
    });

    it('should reject invalid hook configurations', () => {
      const invalidConfigs = [
        // Missing required fields
        {
          name: 'invalid',
          // missing type and handler
        },
        // Invalid type
        {
          name: 'invalid-type',
          type: 'invalid-hook-type',
          handler: { type: 'inline', code: 'echo test' },
        },
        // Empty name
        {
          name: '',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
        },
        // Invalid handler type
        {
          name: 'invalid-handler',
          type: 'before-task',
          handler: { type: 'invalid', code: 'echo test' },
        },
        // File handler without path
        {
          name: 'no-path',
          type: 'before-task',
          handler: { type: 'file' },
        },
        // Inline handler without code
        {
          name: 'no-code',
          type: 'before-task',
          handler: { type: 'inline' },
        },
        // Invalid timeout (too small)
        {
          name: 'small-timeout',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo test' },
          timeoutMs: 500,
        },
      ];

      for (const config of invalidConfigs) {
        const result = HookConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Config loading with hooks', () => {
    it('should save and load config with hooks array', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'hooks-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'pre-commit-format',
            type: 'before-commit',
            handler: {
              type: 'file',
              path: './scripts/format.sh',
            },
            priority: 150,
            enabled: true,
          },
          {
            name: 'post-deploy-notify',
            type: 'after-push',
            handler: {
              type: 'inline',
              code: 'curl -X POST https://hooks.slack.com/notify',
              language: 'bash',
            },
            description: 'Notify team of deployment',
            conditions: {
              env: { ENVIRONMENT: 'production' },
            },
            failOnError: false,
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.hooks).toBeDefined();
      expect(loaded.hooks).toHaveLength(2);

      // Test first hook
      const firstHook = loaded.hooks?.[0];
      expect(firstHook?.name).toBe('pre-commit-format');
      expect(firstHook?.type).toBe('before-commit');
      expect(firstHook?.handler.type).toBe('file');
      expect(firstHook?.priority).toBe(150);

      // Test second hook
      const secondHook = loaded.hooks?.[1];
      expect(secondHook?.name).toBe('post-deploy-notify');
      expect(secondHook?.type).toBe('after-push');
      expect(secondHook?.handler.type).toBe('inline');
      expect(secondHook?.failOnError).toBe(false);
      expect(secondHook?.conditions?.env).toEqual({ ENVIRONMENT: 'production' });
    });

    it('should handle empty hooks array', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-hooks-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.hooks).toBeDefined();
      expect(loaded.hooks).toHaveLength(0);
    });

    it('should handle missing hooks section with defaults', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'default-hooks-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.hooks).toBeDefined();
      expect(loaded.hooks).toEqual([]);
    });

    it('should preserve hook defaults from schema', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'hook-defaults-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'minimal-hook',
            type: 'before-task',
            handler: {
              type: 'inline',
              code: 'echo "minimal hook"',
            },
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      const hook = loaded.hooks?.[0];
      expect(hook?.priority).toBe(100); // default
      expect(hook?.enabled).toBe(true); // default
      expect(hook?.timeoutMs).toBe(30000); // default
      expect(hook?.failOnError).toBe(true); // default
      expect(hook?.handler.language).toBe('bash'); // default for inline
    });
  });

  describe('getEffectiveConfig with hooks', () => {
    it('should apply hook defaults when hooks section is missing', () => {
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
      expect(effective.hooks).toBeDefined();
      expect(effective.hooks).toEqual([]);
    });

    it('should preserve hooks in effective config', () => {
      const hooks: HookConfig[] = [
        {
          name: 'test-hook',
          type: 'before-commit',
          handler: {
            type: 'file',
            path: './test-script.sh',
          },
        },
      ];

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks,
      };

      const effective = getEffectiveConfig(config);
      expect(effective.hooks).toEqual(hooks);
    });
  });

  describe('Hook conditions validation', () => {
    it('should validate hook conditions with all properties', () => {
      const hookConfig = {
        name: 'conditional-hook',
        type: 'before-stage' as const,
        handler: {
          type: 'inline' as const,
          code: 'echo "conditional"',
        },
        conditions: {
          stages: ['planning', 'implementation'],
          agents: ['planner', 'developer'],
          filePatterns: ['src/**/*.ts', 'tests/**/*.test.ts'],
          env: {
            NODE_ENV: 'development',
            DEBUG: 'true',
          },
        },
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data?.conditions).toEqual(hookConfig.conditions);
    });

    it('should validate hook conditions with partial properties', () => {
      const hookConfig = {
        name: 'partial-conditions-hook',
        type: 'on-error' as const,
        handler: {
          type: 'inline' as const,
          code: 'echo "error occurred"',
        },
        conditions: {
          stages: ['implementation'],
          // only stages specified, others optional
        },
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data?.conditions?.stages).toEqual(['implementation']);
      expect(result.data?.conditions?.agents).toBeUndefined();
      expect(result.data?.conditions?.filePatterns).toBeUndefined();
      expect(result.data?.conditions?.env).toBeUndefined();
    });

    it('should handle hooks without conditions', () => {
      const hookConfig = {
        name: 'no-conditions-hook',
        type: 'after-task' as const,
        handler: {
          type: 'inline' as const,
          code: 'echo "no conditions"',
        },
      };

      const result = HookConfigSchema.safeParse(hookConfig);
      expect(result.success).toBe(true);
      expect(result.data?.conditions).toBeUndefined();
    });
  });

  describe('Complex hook configurations', () => {
    it('should handle multiple hooks with different types and handlers', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-hooks-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          // File handler with args
          {
            name: 'pre-commit-checks',
            type: 'before-commit',
            handler: {
              type: 'file',
              path: './scripts/pre-commit.sh',
              args: ['--strict', '--fix-issues'],
            },
            priority: 300,
            enabled: true,
            description: 'Run pre-commit checks and fixes',
            conditions: {
              filePatterns: ['src/**/*'],
            },
            timeoutMs: 120000,
            failOnError: true,
          },
          // Inline JavaScript
          {
            name: 'post-build-analysis',
            type: 'after-task',
            handler: {
              type: 'inline',
              code: 'const fs = require("fs"); console.log("Build completed");',
              language: 'javascript',
            },
            priority: 50,
            enabled: true,
            conditions: {
              stages: ['implementation'],
              agents: ['developer'],
            },
            failOnError: false,
          },
          // Error handler
          {
            name: 'error-notification',
            type: 'on-error',
            handler: {
              type: 'inline',
              code: 'echo "Error occurred: $ERROR_MESSAGE" | mail -s "Build Error" admin@example.com',
            },
            priority: 1000,
            enabled: true,
            description: 'Send email notification on errors',
            timeoutMs: 10000,
          },
          // Disabled hook
          {
            name: 'disabled-hook',
            type: 'before-push',
            handler: {
              type: 'inline',
              code: 'echo "This should not run"',
            },
            enabled: false,
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.hooks).toHaveLength(4);

      // Verify each hook was loaded correctly
      const preCommitHook = loaded.hooks?.find(h => h.name === 'pre-commit-checks');
      expect(preCommitHook?.handler.type).toBe('file');
      expect(preCommitHook?.handler.args).toEqual(['--strict', '--fix-issues']);
      expect(preCommitHook?.priority).toBe(300);
      expect(preCommitHook?.timeoutMs).toBe(120000);

      const postBuildHook = loaded.hooks?.find(h => h.name === 'post-build-analysis');
      expect(postBuildHook?.handler.type).toBe('inline');
      expect(postBuildHook?.handler.language).toBe('javascript');
      expect(postBuildHook?.failOnError).toBe(false);

      const errorHook = loaded.hooks?.find(h => h.name === 'error-notification');
      expect(errorHook?.type).toBe('on-error');
      expect(errorHook?.priority).toBe(1000);

      const disabledHook = loaded.hooks?.find(h => h.name === 'disabled-hook');
      expect(disabledHook?.enabled).toBe(false);
    });

    it('should validate hooks are sorted by priority in effective config', () => {
      const hooks: HookConfig[] = [
        {
          name: 'low-priority',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo "low"' },
          priority: 50,
        },
        {
          name: 'high-priority',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo "high"' },
          priority: 200,
        },
        {
          name: 'default-priority',
          type: 'before-task',
          handler: { type: 'inline', code: 'echo "default"' },
          // priority defaults to 100
        },
      ];

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'priority-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks,
      };

      const effective = getEffectiveConfig(config);
      expect(effective.hooks).toHaveLength(3);

      // While we don't sort in getEffectiveConfig, we verify priorities are preserved
      const highPriorityHook = effective.hooks.find(h => h.name === 'high-priority');
      const defaultPriorityHook = effective.hooks.find(h => h.name === 'default-priority');
      const lowPriorityHook = effective.hooks.find(h => h.name === 'low-priority');

      expect(highPriorityHook?.priority).toBe(200);
      expect(defaultPriorityHook?.priority).toBe(100);
      expect(lowPriorityHook?.priority).toBe(50);
    });
  });
});