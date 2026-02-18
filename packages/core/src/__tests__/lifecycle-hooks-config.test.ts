/**
 * Test file to verify lifecycle hooks configuration loading and validation
 */
import { ApexConfigSchema, HookConfigSchema } from '../types.js';

describe('Lifecycle Hooks Configuration', () => {
  describe('HookConfigSchema validation', () => {
    it('should validate a complete lifecycle hook configuration', () => {
      const validHookConfig = {
        name: 'pre-task-setup',
        type: 'before-task',
        handler: {
          type: 'file',
          path: './scripts/pre-task-setup.sh',
          args: ['--verbose', '--setup'],
        },
        priority: 200,
        enabled: true,
        description: 'Setup environment before task execution',
        timeoutMs: 30000,
        failOnError: true,
      };

      expect(() => HookConfigSchema.parse(validHookConfig)).not.toThrow();
      const parsed = HookConfigSchema.parse(validHookConfig);

      expect(parsed.name).toBe('pre-task-setup');
      expect(parsed.type).toBe('before-task');
      expect(parsed.handler.type).toBe('file');
      expect(parsed.priority).toBe(200);
      expect(parsed.enabled).toBe(true);
    });

    it('should validate inline hook handlers', () => {
      const inlineHookConfig = {
        name: 'post-task-cleanup',
        type: 'after-task',
        handler: {
          type: 'inline',
          code: 'echo "Task completed"; cleanup_temp_files',
          language: 'bash',
        },
        priority: 100,
        enabled: true,
      };

      expect(() => HookConfigSchema.parse(inlineHookConfig)).not.toThrow();
      const parsed = HookConfigSchema.parse(inlineHookConfig);

      expect(parsed.handler.type).toBe('inline');
      expect(parsed.handler.code).toContain('Task completed');
      expect(parsed.handler.language).toBe('bash');
    });

    it('should validate all lifecycle hook types', () => {
      const lifecycleTypes = [
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

      lifecycleTypes.forEach(hookType => {
        const hookConfig = {
          name: `test-${hookType}`,
          type: hookType,
          handler: {
            type: 'file',
            path: `./scripts/${hookType}.sh`,
          },
        };

        expect(() => HookConfigSchema.parse(hookConfig)).not.toThrow();
        const parsed = HookConfigSchema.parse(hookConfig);
        expect(parsed.type).toBe(hookType);
      });
    });

    it('should apply default values for optional fields', () => {
      const minimalHookConfig = {
        name: 'minimal-hook',
        type: 'before-task',
        handler: {
          type: 'file',
          path: './scripts/minimal.sh',
        },
      };

      const parsed = HookConfigSchema.parse(minimalHookConfig);

      // Check defaults are applied
      expect(parsed.priority).toBe(100); // default priority
      expect(parsed.enabled).toBe(true); // default enabled
      expect(parsed.timeoutMs).toBe(30000); // default timeout
      expect(parsed.failOnError).toBe(true); // default failOnError
    });

    it('should reject invalid hook configurations', () => {
      const invalidConfigs = [
        // Missing name
        {
          type: 'before-task',
          handler: { type: 'file', path: './test.sh' },
        },
        // Invalid hook type
        {
          name: 'invalid-type',
          type: 'invalid-hook-type',
          handler: { type: 'file', path: './test.sh' },
        },
        // Missing handler
        {
          name: 'missing-handler',
          type: 'before-task',
        },
        // Invalid handler type
        {
          name: 'invalid-handler',
          type: 'before-task',
          handler: { type: 'invalid', path: './test.sh' },
        },
      ];

      invalidConfigs.forEach(config => {
        expect(() => HookConfigSchema.parse(config)).toThrow();
      });
    });
  });

  describe('ApexConfig with lifecycle hooks', () => {
    it('should parse config with lifecycle hooks array', () => {
      const configWithHooks = {
        version: '1.0',
        project: {
          name: 'hooks-test-project',
        },
        hooks: [
          {
            name: 'pre-task-setup',
            type: 'before-task',
            handler: {
              type: 'file',
              path: './scripts/pre-task-setup.sh',
            },
            priority: 200,
            enabled: true,
          },
          {
            name: 'post-task-notification',
            type: 'after-task',
            handler: {
              type: 'inline',
              code: 'echo "Task completed successfully"',
              language: 'bash',
            },
            priority: 100,
            enabled: true,
          },
          {
            name: 'stage-validator',
            type: 'before-stage',
            handler: {
              type: 'file',
              path: './scripts/validate-stage.js',
            },
            priority: 150,
            enabled: true,
          },
        ],
      };

      expect(() => ApexConfigSchema.parse(configWithHooks)).not.toThrow();
      const parsed = ApexConfigSchema.parse(configWithHooks);

      expect(parsed.hooks).toHaveLength(3);
      expect(parsed.hooks[0].name).toBe('pre-task-setup');
      expect(parsed.hooks[0].type).toBe('before-task');
      expect(parsed.hooks[1].name).toBe('post-task-notification');
      expect(parsed.hooks[1].type).toBe('after-task');
      expect(parsed.hooks[2].name).toBe('stage-validator');
      expect(parsed.hooks[2].type).toBe('before-stage');
    });

    it('should default to empty array when hooks not provided', () => {
      const configWithoutHooks = {
        version: '1.0',
        project: {
          name: 'no-hooks-project',
        },
      };

      const parsed = ApexConfigSchema.parse(configWithoutHooks);
      expect(parsed.hooks).toEqual([]);
    });

    it('should handle empty hooks array', () => {
      const configWithEmptyHooks = {
        version: '1.0',
        project: {
          name: 'empty-hooks-project',
        },
        hooks: [],
      };

      const parsed = ApexConfigSchema.parse(configWithEmptyHooks);
      expect(parsed.hooks).toEqual([]);
    });
  });

  describe('Comprehensive lifecycle hook scenarios', () => {
    it('should support complex hook configurations with all lifecycle types', () => {
      const comprehensiveHooksConfig = {
        version: '1.0',
        project: {
          name: 'comprehensive-hooks-project',
        },
        hooks: [
          {
            name: 'task-initialization',
            type: 'before-task',
            handler: {
              type: 'file',
              path: './scripts/init-task.sh',
              args: ['--setup', '--verbose'],
            },
            priority: 300,
            enabled: true,
            description: 'Initialize task environment',
            timeoutMs: 60000,
            failOnError: true,
          },
          {
            name: 'task-finalization',
            type: 'after-task',
            handler: {
              type: 'inline',
              code: 'echo "Task finalized"; send_metrics',
              language: 'bash',
            },
            priority: 100,
            enabled: true,
            description: 'Finalize task and send metrics',
          },
          {
            name: 'stage-preparation',
            type: 'before-stage',
            handler: {
              type: 'file',
              path: './scripts/prepare-stage.js',
              args: ['--stage', '$STAGE_NAME'],
            },
            priority: 200,
            enabled: true,
            description: 'Prepare stage environment',
          },
          {
            name: 'stage-completion',
            type: 'after-stage',
            handler: {
              type: 'inline',
              code: 'cleanup_stage_artifacts && log_completion',
              language: 'bash',
            },
            priority: 50,
            enabled: true,
            description: 'Clean up after stage completion',
          },
          {
            name: 'pre-commit-validation',
            type: 'before-commit',
            handler: {
              type: 'file',
              path: './scripts/pre-commit-checks.sh',
              args: ['--strict', '--auto-fix'],
            },
            priority: 400,
            enabled: true,
            description: 'Run validation before commit',
          },
          {
            name: 'post-commit-notification',
            type: 'after-commit',
            handler: {
              type: 'file',
              path: './scripts/notify-commit.js',
              args: ['--webhook', '$COMMIT_WEBHOOK_URL'],
            },
            priority: 100,
            enabled: true,
            description: 'Send commit notification',
          },
          {
            name: 'error-handler',
            type: 'on-error',
            handler: {
              type: 'file',
              path: './scripts/handle-error.sh',
            },
            priority: 500,
            enabled: true,
            description: 'Handle and report errors',
          },
          {
            name: 'success-celebration',
            type: 'on-success',
            handler: {
              type: 'inline',
              code: 'echo "🎉 Success!"; update_success_metrics',
              language: 'bash',
            },
            priority: 50,
            enabled: true,
            description: 'Celebrate successful completion',
          },
        ],
      };

      expect(() => ApexConfigSchema.parse(comprehensiveHooksConfig)).not.toThrow();
      const parsed = ApexConfigSchema.parse(comprehensiveHooksConfig);

      expect(parsed.hooks).toHaveLength(8);

      // Verify all hook types are present
      const hookTypes = parsed.hooks.map(hook => hook.type);
      expect(hookTypes).toContain('before-task');
      expect(hookTypes).toContain('after-task');
      expect(hookTypes).toContain('before-stage');
      expect(hookTypes).toContain('after-stage');
      expect(hookTypes).toContain('before-commit');
      expect(hookTypes).toContain('after-commit');
      expect(hookTypes).toContain('on-error');
      expect(hookTypes).toContain('on-success');
    });

    it('should maintain hook priority and ordering information', () => {
      const priorityTestConfig = {
        version: '1.0',
        project: {
          name: 'priority-test-project',
        },
        hooks: [
          {
            name: 'low-priority',
            type: 'before-task',
            handler: { type: 'file', path: './low.sh' },
            priority: 50,
          },
          {
            name: 'high-priority',
            type: 'before-task',
            handler: { type: 'file', path: './high.sh' },
            priority: 300,
          },
          {
            name: 'default-priority',
            type: 'before-task',
            handler: { type: 'file', path: './default.sh' },
            // priority will default to 100
          },
        ],
      };

      const parsed = ApexConfigSchema.parse(priorityTestConfig);

      expect(parsed.hooks[0].priority).toBe(50);
      expect(parsed.hooks[1].priority).toBe(300);
      expect(parsed.hooks[2].priority).toBe(100); // default
    });
  });
});