/**
 * Integration test to verify that all hook types are properly exported
 * and can be used together in realistic scenarios
 */
describe('Tool Hook Integration', () => {
  describe('Package Exports', () => {
    it('should export all hook-related types and schemas', async () => {
      // Import from the package entry point to ensure exports work
      const coreExports = await import('../index.js');

      // Verify all hook schemas are exported
      expect(coreExports.ToolHookTypeSchema).toBeDefined();
      expect(coreExports.ToolHookDefinitionSchema).toBeDefined();
      expect(coreExports.ToolHookConfigSchema).toBeDefined();
      expect(coreExports.PreHookContextSchema).toBeDefined();
      expect(coreExports.PostHookContextSchema).toBeDefined();
      expect(coreExports.PreHookActionSchema).toBeDefined();
      expect(coreExports.PreHookResultSchema).toBeDefined();
      expect(coreExports.PostHookResultSchema).toBeDefined();

      // Verify all schemas have parse methods (are Zod schemas)
      expect(typeof coreExports.ToolHookTypeSchema.parse).toBe('function');
      expect(typeof coreExports.ToolHookDefinitionSchema.parse).toBe('function');
      expect(typeof coreExports.ToolHookConfigSchema.parse).toBe('function');
      expect(typeof coreExports.PreHookContextSchema.parse).toBe('function');
      expect(typeof coreExports.PostHookContextSchema.parse).toBe('function');
      expect(typeof coreExports.PreHookActionSchema.parse).toBe('function');
      expect(typeof coreExports.PreHookResultSchema.parse).toBe('function');
      expect(typeof coreExports.PostHookResultSchema.parse).toBe('function');
    });

    it('should work with TypeScript type system', () => {
      // This test verifies that the types can be imported and used
      // The fact that this compiles successfully validates the type exports
      const hookType: import('../types.js').ToolHookType = 'pre';
      const hookDefinition: import('../types.js').ToolHookDefinition = {
        name: 'integration-test-hook',
        type: 'post',
        handlerPath: '/test/handler.js',
        priority: 50,
        enabled: true,
        tools: ['bash', 'git'],
      };
      const hookConfig: import('../types.js').ToolHookConfig = {
        pre: [hookDefinition],
        post: [],
        enabled: true,
      };

      expect(hookType).toBe('pre');
      expect(hookDefinition.name).toBe('integration-test-hook');
      expect(hookConfig.pre).toHaveLength(1);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should support a complete pre-hook workflow', async () => {
      const { ToolHookConfigSchema, PreHookContextSchema, PreHookResultSchema } = await import('../index.js');

      // 1. Parse a realistic hook configuration
      const hookConfig = ToolHookConfigSchema.parse({
        pre: [
          {
            name: 'security-scanner',
            type: 'pre',
            handlerPath: '/hooks/security-scan.js',
            priority: 200,
            enabled: true,
            description: 'Scans commands for security issues',
            tools: ['bash', 'sh'],
            timeoutMs: 10000,
            failOnError: true,
          },
          {
            name: 'argument-validator',
            type: 'pre',
            handlerPath: '/hooks/validate-args.js',
            priority: 100,
            enabled: true,
            description: 'Validates and sanitizes command arguments',
            tools: [], // Apply to all tools
          },
        ],
        enabled: true,
        defaultTimeoutMs: 30000,
      });

      expect(hookConfig.pre).toHaveLength(2);
      expect(hookConfig.pre[0].name).toBe('security-scanner');
      expect(hookConfig.pre[1].name).toBe('argument-validator');

      // 2. Simulate a pre-hook context
      const preHookContext = PreHookContextSchema.parse({
        toolName: 'bash',
        arguments: {
          command: 'rm -rf /',
          timeout: 30000,
        },
        invocationId: 'inv-dangerous-command',
        taskId: 'task-cleanup',
        agentName: 'devops',
        stageName: 'deployment',
        timestamp: new Date(),
      });

      expect(preHookContext.toolName).toBe('bash');
      expect(preHookContext.arguments.command).toBe('rm -rf /');

      // 3. Simulate hook results - security hook blocks the command
      const securityHookResult = PreHookResultSchema.parse({
        action: 'cancel',
        reason: 'Dangerous command detected: rm -rf /',
        cancelResult: {
          success: false,
          error: 'Command blocked by security policy: destructive command detected',
        },
        metadata: {
          riskLevel: 'critical',
          detectedPatterns: ['rm -rf'],
          hookName: 'security-scanner',
        },
      });

      expect(securityHookResult.action).toBe('cancel');
      expect(securityHookResult.cancelResult?.success).toBe(false);
      expect(securityHookResult.metadata?.riskLevel).toBe('critical');
    });

    it('should support a complete post-hook workflow', async () => {
      const { ToolHookConfigSchema, PostHookContextSchema, PostHookResultSchema } = await import('../index.js');

      // 1. Parse post-hook configuration
      const hookConfig = ToolHookConfigSchema.parse({
        post: [
          {
            name: 'result-logger',
            type: 'post',
            handlerPath: '/hooks/log-results.js',
            priority: 100,
            enabled: true,
            description: 'Logs command execution results for audit',
          },
          {
            name: 'output-formatter',
            type: 'post',
            handlerPath: '/hooks/format-output.js',
            priority: 50,
            enabled: true,
            description: 'Formats command output for better readability',
            tools: ['bash', 'git'],
          },
        ],
        enabled: true,
      });

      expect(hookConfig.post).toHaveLength(2);

      // 2. Simulate successful command execution context
      const postHookContext = PostHookContextSchema.parse({
        toolName: 'git',
        arguments: {
          command: 'status',
          workingDirectory: '/project',
        },
        invocationId: 'inv-git-status',
        taskId: 'task-check-status',
        agentName: 'developer',
        stageName: 'implementation',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        result: {
          success: true,
          output: {
            stdout: 'On branch main\\nYour branch is up to date with \'origin/main\'.\\n\\nnothing to commit, working tree clean',
            stderr: '',
            exitCode: 0,
          },
          duration: 1250,
        },
      });

      expect(postHookContext.result.success).toBe(true);
      expect(postHookContext.result.duration).toBe(1250);

      // 3. Simulate output formatting hook result
      const formatterResult = PostHookResultSchema.parse({
        modifyResult: true,
        modifiedResult: {
          success: true,
          output: {
            stdout: 'On branch main\\nYour branch is up to date with \'origin/main\'.\\n\\nnothing to commit, working tree clean',
            stderr: '',
            exitCode: 0,
            formatted: {
              branch: 'main',
              status: 'up-to-date',
              hasChanges: false,
              summary: 'Working tree is clean',
            },
          },
        },
        metadata: {
          formatterApplied: true,
          outputEnhanced: true,
          hookName: 'output-formatter',
        },
      });

      expect(formatterResult.modifyResult).toBe(true);
      expect(formatterResult.modifiedResult?.output).toHaveProperty('formatted');
    });

    it('should support hook argument modification workflow', async () => {
      const { PreHookContextSchema, PreHookResultSchema } = await import('../index.js');

      // Simulate argument sanitization hook
      const context = PreHookContextSchema.parse({
        toolName: 'bash',
        arguments: {
          command: 'echo "hello world"',
          workingDirectory: '/tmp/../home/user',
          environment: {
            PATH: '/usr/bin:/bin',
            DANGEROUS_VAR: 'should-be-removed',
          },
        },
        invocationId: 'inv-sanitize',
        timestamp: new Date(),
      });

      // Hook modifies arguments to sanitize them
      const sanitizerResult = PreHookResultSchema.parse({
        action: 'modify',
        modifiedArguments: {
          command: 'echo "hello world"',
          workingDirectory: '/home/user', // Path normalized
          environment: {
            PATH: '/usr/bin:/bin',
            // DANGEROUS_VAR removed
          },
        },
        reason: 'Sanitized working directory path and removed dangerous environment variables',
        metadata: {
          sanitizationApplied: true,
          pathNormalized: true,
          environmentCleaned: true,
          removedVars: ['DANGEROUS_VAR'],
        },
      });

      expect(sanitizerResult.action).toBe('modify');
      expect(sanitizerResult.modifiedArguments?.workingDirectory).toBe('/home/user');
      expect(sanitizerResult.modifiedArguments?.environment).not.toHaveProperty('DANGEROUS_VAR');
      expect(sanitizerResult.metadata?.removedVars).toContain('DANGEROUS_VAR');
    });

    it('should handle hook priority and execution order', async () => {
      const { ToolHookConfigSchema } = await import('../index.js');

      // Configuration with hooks in different priority order
      const config = ToolHookConfigSchema.parse({
        pre: [
          {
            name: 'low-priority-hook',
            type: 'pre',
            handlerPath: '/hooks/low.js',
            priority: 50, // Lower priority
          },
          {
            name: 'high-priority-hook',
            type: 'pre',
            handlerPath: '/hooks/high.js',
            priority: 200, // Higher priority (should run first)
          },
          {
            name: 'default-priority-hook',
            type: 'pre',
            handlerPath: '/hooks/default.js',
            // priority defaults to 100
          },
        ],
      });

      // Verify hooks are present with correct priorities
      expect(config.pre).toHaveLength(3);

      const highPriorityHook = config.pre.find(h => h.name === 'high-priority-hook');
      const defaultPriorityHook = config.pre.find(h => h.name === 'default-priority-hook');
      const lowPriorityHook = config.pre.find(h => h.name === 'low-priority-hook');

      expect(highPriorityHook?.priority).toBe(200);
      expect(defaultPriorityHook?.priority).toBe(100); // Default value
      expect(lowPriorityHook?.priority).toBe(50);

      // Simulate ordering logic (higher priority = runs first)
      const sortedHooks = [...config.pre].sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
      expect(sortedHooks[0].name).toBe('high-priority-hook');
      expect(sortedHooks[1].name).toBe('default-priority-hook');
      expect(sortedHooks[2].name).toBe('low-priority-hook');
    });

    it('should handle tool-specific hook filtering', async () => {
      const { ToolHookConfigSchema } = await import('../index.js');

      const config = ToolHookConfigSchema.parse({
        pre: [
          {
            name: 'bash-only-hook',
            type: 'pre',
            handlerPath: '/hooks/bash.js',
            tools: ['bash'], // Only for bash commands
          },
          {
            name: 'git-only-hook',
            type: 'pre',
            handlerPath: '/hooks/git.js',
            tools: ['git'], // Only for git commands
          },
          {
            name: 'universal-hook',
            type: 'pre',
            handlerPath: '/hooks/universal.js',
            tools: [], // For all tools (empty array = all)
          },
        ],
      });

      // Simulate hook filtering logic for different tools
      const getHooksForTool = (toolName: string, hooks: typeof config.pre) => {
        return hooks.filter(hook =>
          hook.tools.length === 0 || hook.tools.includes(toolName)
        );
      };

      const bashHooks = getHooksForTool('bash', config.pre);
      const gitHooks = getHooksForTool('git', config.pre);
      const otherHooks = getHooksForTool('read', config.pre);

      expect(bashHooks.map(h => h.name)).toEqual(['bash-only-hook', 'universal-hook']);
      expect(gitHooks.map(h => h.name)).toEqual(['git-only-hook', 'universal-hook']);
      expect(otherHooks.map(h => h.name)).toEqual(['universal-hook']); // Only universal hook
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle hook timeout scenarios', async () => {
      const { ToolHookDefinitionSchema } = await import('../index.js');

      // Hook with custom timeout
      const timeoutHook = ToolHookDefinitionSchema.parse({
        name: 'slow-hook',
        type: 'pre',
        handlerPath: '/hooks/slow.js',
        timeoutMs: 5000, // 5 second timeout
      });

      expect(timeoutHook.timeoutMs).toBe(5000);

      // Hook with default timeout
      const defaultTimeoutHook = ToolHookDefinitionSchema.parse({
        name: 'default-timeout-hook',
        type: 'pre',
        handlerPath: '/hooks/default.js',
        // timeoutMs will default to 30000
      });

      expect(defaultTimeoutHook.timeoutMs).toBe(30000);
    });

    it('should handle hook failure scenarios', async () => {
      const { PostHookResultSchema, PreHookResultSchema } = await import('../index.js');

      // Pre-hook that cancels due to validation failure
      const validationFailure = PreHookResultSchema.parse({
        action: 'cancel',
        reason: 'Input validation failed: missing required parameter',
        cancelResult: {
          success: false,
          error: 'Validation Error: The \'output\' parameter is required but was not provided',
        },
        metadata: {
          validationErrors: ['missing-output-param'],
          failedChecks: ['required-params'],
        },
      });

      expect(validationFailure.action).toBe('cancel');
      expect(validationFailure.cancelResult?.success).toBe(false);

      // Post-hook that logs but doesn't modify result
      const loggingOnlyResult = PostHookResultSchema.parse({
        modifyResult: false,
        metadata: {
          logged: true,
          logFile: '/var/log/apex-tools.log',
          timestamp: Date.now(),
        },
      });

      expect(loggingOnlyResult.modifyResult).toBe(false);
      expect(loggingOnlyResult.modifiedResult).toBeUndefined();
    });
  });
});