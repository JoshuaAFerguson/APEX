/**
 * Test file to verify tool hooks integration with ApexConfigSchema
 */
import { ApexConfigSchema } from '../types.js';

describe('Tool Hooks Config Integration', () => {
  describe('ApexConfigSchema with toolHooks', () => {
    it('should accept config without toolHooks field', () => {
      const config = {
        project: {
          name: 'test-project',
        },
      };

      const result = ApexConfigSchema.parse(config);
      expect(result.toolHooks).toBeUndefined();
    });

    it('should accept config with empty toolHooks', () => {
      const config = {
        project: {
          name: 'test-project',
        },
        toolHooks: {},
      };

      const result = ApexConfigSchema.parse(config);
      expect(result.toolHooks).toBeDefined();
      expect(result.toolHooks?.pre).toEqual([]);
      expect(result.toolHooks?.post).toEqual([]);
      expect(result.toolHooks?.enabled).toBe(true);
    });

    it('should accept config with full toolHooks configuration', () => {
      const config = {
        project: {
          name: 'test-project',
        },
        toolHooks: {
          pre: [
            {
              name: 'security-check',
              type: 'pre',
              handlerPath: '/hooks/security.js',
              priority: 200,
              enabled: true,
              description: 'Validates command security',
              tools: ['bash', 'sh'],
              timeoutMs: 10000,
              failOnError: true,
            },
          ],
          post: [
            {
              name: 'audit-logger',
              type: 'post',
              handlerPath: '/hooks/audit.js',
              priority: 100,
              enabled: true,
              description: 'Logs command execution for audit',
            },
          ],
          enabled: true,
          defaultTimeoutMs: 30000,
        },
      };

      const result = ApexConfigSchema.parse(config);
      expect(result.toolHooks?.pre).toHaveLength(1);
      expect(result.toolHooks?.post).toHaveLength(1);
      expect(result.toolHooks?.pre?.[0].name).toBe('security-check');
      expect(result.toolHooks?.post?.[0].name).toBe('audit-logger');
    });

    it('should validate hook definitions within config', () => {
      const configWithInvalidHook = {
        project: {
          name: 'test-project',
        },
        toolHooks: {
          pre: [
            {
              name: '', // Invalid empty name
              type: 'pre',
              handlerPath: '/hooks/invalid.js',
            },
          ],
        },
      };

      expect(() => ApexConfigSchema.parse(configWithInvalidHook)).toThrow();
    });

    it('should validate hook types within config', () => {
      const configWithInvalidType = {
        project: {
          name: 'test-project',
        },
        toolHooks: {
          pre: [
            {
              name: 'test-hook',
              type: 'invalid-type', // Invalid hook type
              handlerPath: '/hooks/test.js',
            },
          ],
        },
      };

      expect(() => ApexConfigSchema.parse(configWithInvalidType)).toThrow();
    });

    it('should apply defaults for toolHooks config fields', () => {
      const config = {
        project: {
          name: 'test-project',
        },
        toolHooks: {
          pre: [
            {
              name: 'minimal-hook',
              type: 'pre',
              handlerPath: '/hooks/minimal.js',
            },
          ],
        },
      };

      const result = ApexConfigSchema.parse(config);
      const hook = result.toolHooks?.pre?.[0];

      expect(hook?.priority).toBe(100); // Default priority
      expect(hook?.enabled).toBe(true); // Default enabled
      expect(hook?.tools).toEqual([]); // Default tools array
      expect(hook?.timeoutMs).toBe(30000); // Default timeout
      expect(result.toolHooks?.enabled).toBe(true); // Default config enabled
      expect(result.toolHooks?.defaultTimeoutMs).toBe(30000); // Default config timeout
    });

    it('should support complex real-world configuration', () => {
      const complexConfig = {
        project: {
          name: 'complex-project',
        },
        agents: {
          planner: {
            model: 'claude-3-sonnet',
            maxTokens: 8192,
          },
          developer: {
            model: 'claude-3-sonnet',
            maxTokens: 8192,
          },
        },
        limits: {
          maxConcurrentTasks: 3,
          maxTokensPerTask: 50000,
        },
        toolHooks: {
          pre: [
            {
              name: 'command-validator',
              type: 'pre',
              handlerPath: '/project/hooks/validate.js',
              priority: 300,
              enabled: true,
              description: 'Validates command syntax and safety',
              tools: ['bash', 'sh', 'zsh'],
              timeoutMs: 5000,
              failOnError: true,
            },
            {
              name: 'environment-setup',
              type: 'pre',
              handlerPath: '/project/hooks/setup-env.js',
              priority: 200,
              enabled: true,
              description: 'Sets up required environment variables',
              timeoutMs: 15000,
            },
            {
              name: 'git-state-check',
              type: 'pre',
              handlerPath: '/project/hooks/git-check.js',
              priority: 100,
              enabled: true,
              description: 'Ensures git working directory is clean',
              tools: ['git'],
              failOnError: false,
            },
          ],
          post: [
            {
              name: 'execution-logger',
              type: 'post',
              handlerPath: '/project/hooks/logger.js',
              priority: 200,
              enabled: true,
              description: 'Logs all command executions with results',
            },
            {
              name: 'result-analyzer',
              type: 'post',
              handlerPath: '/project/hooks/analyze.js',
              priority: 150,
              enabled: true,
              description: 'Analyzes command results for patterns',
              tools: ['bash', 'npm', 'git'],
              timeoutMs: 20000,
            },
            {
              name: 'cleanup-handler',
              type: 'post',
              handlerPath: '/project/hooks/cleanup.js',
              priority: 50,
              enabled: true,
              description: 'Performs cleanup after command execution',
            },
          ],
          enabled: true,
          defaultTimeoutMs: 45000,
        },
      };

      const result = ApexConfigSchema.parse(complexConfig);

      expect(result.toolHooks?.pre).toHaveLength(3);
      expect(result.toolHooks?.post).toHaveLength(3);
      expect(result.toolHooks?.defaultTimeoutMs).toBe(45000);

      // Verify priorities are maintained
      const preHooks = result.toolHooks?.pre || [];
      expect(preHooks.find(h => h.name === 'command-validator')?.priority).toBe(300);
      expect(preHooks.find(h => h.name === 'environment-setup')?.priority).toBe(200);
      expect(preHooks.find(h => h.name === 'git-state-check')?.priority).toBe(100);

      // Verify tool-specific hooks
      const gitHook = preHooks.find(h => h.name === 'git-state-check');
      expect(gitHook?.tools).toEqual(['git']);
      expect(gitHook?.failOnError).toBe(false);

      const validatorHook = preHooks.find(h => h.name === 'command-validator');
      expect(validatorHook?.tools).toEqual(['bash', 'sh', 'zsh']);
      expect(validatorHook?.failOnError).toBe(true);
    });
  });

  describe('Configuration File Examples', () => {
    it('should parse YAML-like configuration structure', () => {
      // This would typically come from config.yaml parsing
      const yamlLikeConfig = {
        project: {
          name: 'my-apex-project',
          version: '1.0.0',
        },
        agents: {
          planner: { model: 'claude-3-sonnet' },
          developer: { model: 'claude-3-sonnet' },
          tester: { model: 'claude-3-haiku' },
        },
        toolHooks: {
          enabled: true,
          defaultTimeoutMs: 30000,
          pre: [
            {
              name: 'security-scanner',
              type: 'pre',
              handlerPath: './hooks/security-scan.js',
              description: 'Scans for security vulnerabilities in commands',
              priority: 200,
              enabled: true,
              tools: ['bash', 'sh'],
              timeoutMs: 10000,
              failOnError: true,
            },
            {
              name: 'dependency-checker',
              type: 'pre',
              handlerPath: './hooks/check-deps.js',
              description: 'Verifies required dependencies are available',
              priority: 150,
              enabled: true,
              failOnError: true,
            },
          ],
          post: [
            {
              name: 'performance-monitor',
              type: 'post',
              handlerPath: './hooks/perf-monitor.js',
              description: 'Monitors and logs command performance metrics',
              priority: 100,
              enabled: true,
            },
          ],
        },
      };

      const result = ApexConfigSchema.parse(yamlLikeConfig);
      expect(result.project.name).toBe('my-apex-project');
      expect(result.toolHooks?.enabled).toBe(true);
      expect(result.toolHooks?.pre).toHaveLength(2);
      expect(result.toolHooks?.post).toHaveLength(1);
    });

    it('should handle disabled hooks configuration', () => {
      const disabledHooksConfig = {
        project: {
          name: 'test-project',
        },
        toolHooks: {
          enabled: false, // Globally disabled
          pre: [
            {
              name: 'disabled-hook',
              type: 'pre',
              handlerPath: '/hooks/disabled.js',
              enabled: false, // Also individually disabled
            },
            {
              name: 'enabled-hook',
              type: 'pre',
              handlerPath: '/hooks/enabled.js',
              enabled: true, // Individually enabled
            },
          ],
        },
      };

      const result = ApexConfigSchema.parse(disabledHooksConfig);
      expect(result.toolHooks?.enabled).toBe(false);
      expect(result.toolHooks?.pre?.[0].enabled).toBe(false);
      expect(result.toolHooks?.pre?.[1].enabled).toBe(true);
    });
  });
});