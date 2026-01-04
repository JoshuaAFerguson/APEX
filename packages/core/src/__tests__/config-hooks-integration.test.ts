import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { initializeApex, loadConfig, saveConfig, getEffectiveConfig } from '../config';
import { ApexConfig } from '../types';

describe('Hook Configuration Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-hooks-integration-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Project initialization with hooks', () => {
    it('should initialize project with empty hooks array by default', async () => {
      await initializeApex(testDir, { projectName: 'hooks-init-test' });

      const config = await loadConfig(testDir);
      expect(config.hooks).toBeDefined();
      expect(config.hooks).toEqual([]);
    });

    it('should create effective config with hook defaults', async () => {
      await initializeApex(testDir, { projectName: 'effective-hooks-test' });

      const config = await loadConfig(testDir);
      const effective = getEffectiveConfig(config);

      expect(effective.hooks).toBeDefined();
      expect(effective.hooks).toEqual([]);
    });
  });

  describe('Real-world hook configurations', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    });

    it('should handle a complete CI/CD hook setup', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'cicd-hooks-project',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          // Pre-commit hooks
          {
            name: 'format-code',
            type: 'before-commit',
            handler: {
              type: 'file',
              path: './scripts/format.sh',
            },
            priority: 300,
            description: 'Format code before committing',
            conditions: {
              filePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
            },
            timeoutMs: 30000,
          },
          {
            name: 'run-linter',
            type: 'before-commit',
            handler: {
              type: 'inline',
              code: 'npm run lint',
            },
            priority: 200,
            description: 'Run ESLint before committing',
            failOnError: true,
          },
          {
            name: 'run-tests',
            type: 'before-commit',
            handler: {
              type: 'inline',
              code: 'npm test -- --watchAll=false',
            },
            priority: 100,
            description: 'Run tests before committing',
            conditions: {
              filePatterns: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
            },
          },

          // Build and deployment hooks
          {
            name: 'build-project',
            type: 'before-push',
            handler: {
              type: 'inline',
              code: 'npm run build',
            },
            priority: 150,
            description: 'Build project before pushing',
            timeoutMs: 120000,
          },
          {
            name: 'deploy-staging',
            type: 'after-push',
            handler: {
              type: 'file',
              path: './scripts/deploy-staging.sh',
              args: ['--environment', 'staging'],
            },
            priority: 100,
            description: 'Deploy to staging after push',
            conditions: {
              env: {
                BRANCH: 'develop',
              },
            },
            failOnError: false,
          },

          // Monitoring and notifications
          {
            name: 'slack-notification',
            type: 'on-success',
            handler: {
              type: 'inline',
              code: 'curl -X POST -H "Content-type: application/json" --data "{\\"text\\":\\"Deployment successful\\"}" $SLACK_WEBHOOK_URL',
              language: 'bash',
            },
            priority: 50,
            description: 'Send Slack notification on success',
            conditions: {
              env: {
                SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/',
              },
            },
            timeoutMs: 10000,
            failOnError: false,
          },
          {
            name: 'error-reporting',
            type: 'on-error',
            handler: {
              type: 'inline',
              code: `
                const error = process.env.ERROR_MESSAGE || 'Unknown error';
                const webhook = process.env.ERROR_WEBHOOK_URL;
                if (webhook) {
                  require('child_process').execSync(\`curl -X POST -d "error=\${error}" \${webhook}\`);
                }
              `,
              language: 'javascript',
            },
            priority: 1000,
            description: 'Report errors to monitoring system',
            timeoutMs: 15000,
            failOnError: false,
          },

          // Stage-specific hooks
          {
            name: 'planning-analysis',
            type: 'before-stage',
            handler: {
              type: 'inline',
              code: 'echo "Starting planning stage with complexity analysis"',
            },
            conditions: {
              stages: ['planning'],
              agents: ['planner'],
            },
            description: 'Analyze task complexity before planning',
          },
          {
            name: 'implementation-setup',
            type: 'before-stage',
            handler: {
              type: 'file',
              path: './scripts/setup-dev-env.sh',
            },
            conditions: {
              stages: ['implementation'],
              agents: ['developer'],
            },
            description: 'Setup development environment',
          },

          // Disabled hook for maintenance
          {
            name: 'maintenance-mode',
            type: 'before-task',
            handler: {
              type: 'inline',
              code: 'echo "System under maintenance"',
            },
            enabled: false,
            description: 'Maintenance mode notification (disabled)',
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);
      const effective = getEffectiveConfig(loaded);

      // Verify all hooks were loaded
      expect(loaded.hooks).toHaveLength(10);
      expect(effective.hooks).toHaveLength(10);

      // Verify hook types and priorities
      const beforeCommitHooks = loaded.hooks?.filter(h => h.type === 'before-commit') ?? [];
      expect(beforeCommitHooks).toHaveLength(3);

      const stageHooks = loaded.hooks?.filter(h => h.type === 'before-stage') ?? [];
      expect(stageHooks).toHaveLength(2);

      // Verify specific hook configurations
      const formatHook = loaded.hooks?.find(h => h.name === 'format-code');
      expect(formatHook?.handler.type).toBe('file');
      expect(formatHook?.conditions?.filePatterns).toContain('src/**/*.ts');

      const slackHook = loaded.hooks?.find(h => h.name === 'slack-notification');
      expect(slackHook?.handler.type).toBe('inline');
      expect(slackHook?.handler.language).toBe('bash');

      const errorHook = loaded.hooks?.find(h => h.name === 'error-reporting');
      expect(errorHook?.handler.language).toBe('javascript');

      const disabledHook = loaded.hooks?.find(h => h.name === 'maintenance-mode');
      expect(disabledHook?.enabled).toBe(false);
    });

    it('should handle hooks with environment-specific conditions', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'env-hooks-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'dev-only-hook',
            type: 'before-task',
            handler: {
              type: 'inline',
              code: 'echo "Development environment detected"',
            },
            conditions: {
              env: {
                NODE_ENV: 'development',
                DEBUG: 'true',
              },
            },
            description: 'Only runs in development with debug enabled',
          },
          {
            name: 'prod-deployment',
            type: 'after-push',
            handler: {
              type: 'file',
              path: './scripts/deploy-production.sh',
              args: ['--secure', '--backup'],
            },
            conditions: {
              env: {
                NODE_ENV: 'production',
                DEPLOYMENT_ENVIRONMENT: 'production',
              },
              filePatterns: ['dist/**/*'],
            },
            description: 'Production deployment with security and backup',
            timeoutMs: 300000, // 5 minutes
            failOnError: true,
          },
          {
            name: 'staging-notification',
            type: 'on-success',
            handler: {
              type: 'inline',
              code: 'echo "Staging deployment completed" | mail -s "Staging Update" team@example.com',
            },
            conditions: {
              env: {
                DEPLOYMENT_ENVIRONMENT: 'staging',
              },
            },
            failOnError: false,
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      // Verify environment conditions are preserved
      const devHook = loaded.hooks?.find(h => h.name === 'dev-only-hook');
      expect(devHook?.conditions?.env).toEqual({
        NODE_ENV: 'development',
        DEBUG: 'true',
      });

      const prodHook = loaded.hooks?.find(h => h.name === 'prod-deployment');
      expect(prodHook?.conditions?.env).toEqual({
        NODE_ENV: 'production',
        DEPLOYMENT_ENVIRONMENT: 'production',
      });
      expect(prodHook?.conditions?.filePatterns).toContain('dist/**/*');
      expect(prodHook?.timeoutMs).toBe(300000);

      const stagingHook = loaded.hooks?.find(h => h.name === 'staging-notification');
      expect(stagingHook?.conditions?.env?.DEPLOYMENT_ENVIRONMENT).toBe('staging');
      expect(stagingHook?.failOnError).toBe(false);
    });

    it('should maintain hook order and priorities across save/load cycles', async () => {
      const hooks = [
        {
          name: 'highest-priority',
          type: 'before-commit' as const,
          handler: { type: 'inline' as const, code: 'echo "1"' },
          priority: 1000,
        },
        {
          name: 'medium-priority',
          type: 'before-commit' as const,
          handler: { type: 'inline' as const, code: 'echo "2"' },
          priority: 500,
        },
        {
          name: 'default-priority',
          type: 'before-commit' as const,
          handler: { type: 'inline' as const, code: 'echo "3"' },
          // priority defaults to 100
        },
        {
          name: 'lowest-priority',
          type: 'before-commit' as const,
          handler: { type: 'inline' as const, code: 'echo "4"' },
          priority: 10,
        },
      ];

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'priority-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks,
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.hooks).toHaveLength(4);

      // Verify priorities are preserved
      const priorityMap = new Map(
        loaded.hooks?.map(h => [h.name, h.priority]) ?? []
      );

      expect(priorityMap.get('highest-priority')).toBe(1000);
      expect(priorityMap.get('medium-priority')).toBe(500);
      expect(priorityMap.get('default-priority')).toBe(100); // default applied
      expect(priorityMap.get('lowest-priority')).toBe(10);
    });
  });

  describe('Hook configuration validation in real scenarios', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    });

    it('should validate hooks with complex file path configurations', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'file-path-hooks',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'relative-path-hook',
            type: 'before-commit',
            handler: {
              type: 'file',
              path: './scripts/hooks/pre-commit.sh',
              args: ['--config', './config/lint.json'],
            },
          },
          {
            name: 'absolute-path-hook',
            type: 'after-commit',
            handler: {
              type: 'file',
              path: '/usr/local/bin/notify-commit',
              args: ['--webhook', 'https://api.example.com/webhook'],
            },
          },
          {
            name: 'home-directory-hook',
            type: 'on-error',
            handler: {
              type: 'file',
              path: '~/scripts/error-handler.py',
              args: ['--log-file', '/var/log/apex-errors.log'],
            },
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      expect(loaded.hooks).toHaveLength(3);

      const relativeHook = loaded.hooks?.find(h => h.name === 'relative-path-hook');
      expect(relativeHook?.handler.type).toBe('file');
      expect(relativeHook?.handler.path).toBe('./scripts/hooks/pre-commit.sh');

      const absoluteHook = loaded.hooks?.find(h => h.name === 'absolute-path-hook');
      expect(absoluteHook?.handler.path).toBe('/usr/local/bin/notify-commit');

      const homeHook = loaded.hooks?.find(h => h.name === 'home-directory-hook');
      expect(homeHook?.handler.path).toBe('~/scripts/error-handler.py');
    });

    it('should handle hooks with extensive condition configurations', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'complex-conditions',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'frontend-specific-hook',
            type: 'before-stage',
            handler: {
              type: 'inline',
              code: 'npm run check-frontend',
            },
            conditions: {
              stages: ['implementation', 'testing'],
              agents: ['developer', 'tester'],
              filePatterns: [
                'src/components/**/*.tsx',
                'src/pages/**/*.tsx',
                'src/hooks/**/*.ts',
                'src/utils/**/*.ts',
                '*.css',
                '*.scss',
                'package.json',
              ],
              env: {
                PROJECT_TYPE: 'frontend',
                FRAMEWORK: 'react',
                BUILD_TARGET: 'production',
              },
            },
            description: 'Frontend-specific checks for React components',
            priority: 200,
            timeoutMs: 60000,
          },
          {
            name: 'backend-api-hook',
            type: 'after-stage',
            handler: {
              type: 'file',
              path: './scripts/api-validation.sh',
              args: ['--environment', 'test', '--coverage', 'full'],
            },
            conditions: {
              stages: ['implementation'],
              agents: ['developer'],
              filePatterns: [
                'src/api/**/*.ts',
                'src/models/**/*.ts',
                'src/middleware/**/*.ts',
                'src/routes/**/*.ts',
              ],
              env: {
                PROJECT_TYPE: 'backend',
                API_VERSION: 'v2',
              },
            },
            description: 'Backend API validation and testing',
            priority: 150,
            failOnError: true,
          },
        ],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);

      const frontendHook = loaded.hooks?.find(h => h.name === 'frontend-specific-hook');
      expect(frontendHook?.conditions?.stages).toEqual(['implementation', 'testing']);
      expect(frontendHook?.conditions?.agents).toEqual(['developer', 'tester']);
      expect(frontendHook?.conditions?.filePatterns).toContain('src/components/**/*.tsx');
      expect(frontendHook?.conditions?.env?.FRAMEWORK).toBe('react');

      const backendHook = loaded.hooks?.find(h => h.name === 'backend-api-hook');
      expect(backendHook?.conditions?.filePatterns).toContain('src/api/**/*.ts');
      expect(backendHook?.conditions?.env?.API_VERSION).toBe('v2');
      expect(backendHook?.handler.args).toEqual(['--environment', 'test', '--coverage', 'full']);
    });

    it('should preserve hook configuration through multiple save/load cycles', async () => {
      const originalConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'persistence-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'persistent-hook',
            type: 'before-commit',
            handler: {
              type: 'inline',
              code: 'echo "persistence test"',
              language: 'bash',
            },
            priority: 250,
            enabled: true,
            description: 'Test hook persistence',
            conditions: {
              filePatterns: ['src/**/*'],
            },
            timeoutMs: 45000,
            failOnError: false,
          },
        ],
      };

      // First save and load
      await saveConfig(testDir, originalConfig);
      let loaded = await loadConfig(testDir);

      // Modify and save again
      loaded.hooks?.[0] && (loaded.hooks[0].priority = 300);
      await saveConfig(testDir, loaded);

      // Load again and verify
      loaded = await loadConfig(testDir);
      const hook = loaded.hooks?.[0];

      expect(hook?.name).toBe('persistent-hook');
      expect(hook?.priority).toBe(300); // Modified value
      expect(hook?.handler.type).toBe('inline');
      expect(hook?.handler.language).toBe('bash');
      expect(hook?.description).toBe('Test hook persistence');
      expect(hook?.conditions?.filePatterns).toEqual(['src/**/*']);
      expect(hook?.timeoutMs).toBe(45000);
      expect(hook?.failOnError).toBe(false);
    });
  });

  describe('Edge cases and error recovery', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    });

    it('should handle empty hook configurations gracefully', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'empty-hooks-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [],
      };

      await saveConfig(testDir, config);
      const loaded = await loadConfig(testDir);
      const effective = getEffectiveConfig(loaded);

      expect(loaded.hooks).toEqual([]);
      expect(effective.hooks).toEqual([]);
    });

    it('should handle missing optional hook properties', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'minimal-hook-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        hooks: [
          {
            name: 'minimal-hook',
            type: 'after-task',
            handler: {
              type: 'inline',
              code: 'echo "minimal"',
            },
            // No optional properties
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
      expect(hook?.handler.language).toBe('bash'); // default
      expect(hook?.description).toBeUndefined();
      expect(hook?.conditions).toBeUndefined();
    });
  });
});