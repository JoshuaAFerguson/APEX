import {
  ToolHookTypeSchema,
  ToolHookDefinitionSchema,
  ToolHookConfigSchema,
  PreHookContextSchema,
  PostHookContextSchema,
  PreHookActionSchema,
  PreHookResultSchema,
  PostHookResultSchema,
  type ToolHookType,
  type ToolHookDefinition,
  type ToolHookConfig,
  type PreHookContext,
  type PostHookContext,
  type PreHookAction,
  type PreHookResult,
  type PostHookResult,
} from '../types.js';
import { ZodError } from 'zod';

/**
 * Test file for tool hook types and Zod schemas
 * Validates all hook-related types, schemas, and their validation logic
 */
describe('Tool Hook Types', () => {
  describe('ToolHookTypeSchema', () => {
    it('should accept valid hook types', () => {
      expect(ToolHookTypeSchema.parse('pre')).toBe('pre');
      expect(ToolHookTypeSchema.parse('post')).toBe('post');
    });

    it('should reject invalid hook types', () => {
      expect(() => ToolHookTypeSchema.parse('invalid')).toThrow(ZodError);
      expect(() => ToolHookTypeSchema.parse('')).toThrow(ZodError);
      expect(() => ToolHookTypeSchema.parse(null)).toThrow(ZodError);
      expect(() => ToolHookTypeSchema.parse(undefined)).toThrow(ZodError);
      expect(() => ToolHookTypeSchema.parse(123)).toThrow(ZodError);
    });
  });

  describe('ToolHookDefinitionSchema', () => {
    const validHookDefinition = {
      name: 'test-hook',
      type: 'pre' as const,
      handlerPath: '/path/to/handler.js',
    };

    it('should parse valid hook definition with required fields only', () => {
      const result = ToolHookDefinitionSchema.parse(validHookDefinition);
      expect(result.name).toBe('test-hook');
      expect(result.type).toBe('pre');
      expect(result.handlerPath).toBe('/path/to/handler.js');
      // Check defaults
      expect(result.priority).toBe(100);
      expect(result.enabled).toBe(true);
      expect(result.tools).toEqual([]);
      expect(result.timeoutMs).toBe(30000);
    });

    it('should parse valid hook definition with all optional fields', () => {
      const fullHookDefinition = {
        ...validHookDefinition,
        priority: 200,
        enabled: false,
        description: 'Test hook description',
        tools: ['bash', 'git'],
        timeoutMs: 60000,
        failOnError: false,
      };

      const result = ToolHookDefinitionSchema.parse(fullHookDefinition);
      expect(result.priority).toBe(200);
      expect(result.enabled).toBe(false);
      expect(result.description).toBe('Test hook description');
      expect(result.tools).toEqual(['bash', 'git']);
      expect(result.timeoutMs).toBe(60000);
      expect(result.failOnError).toBe(false);
    });

    it('should require name field', () => {
      const invalidHook = { ...validHookDefinition, name: '' };
      expect(() => ToolHookDefinitionSchema.parse(invalidHook)).toThrow(ZodError);

      const missingName = { ...validHookDefinition };
      delete (missingName as any).name;
      expect(() => ToolHookDefinitionSchema.parse(missingName)).toThrow(ZodError);
    });

    it('should require type field', () => {
      const missingType = { ...validHookDefinition };
      delete (missingType as any).type;
      expect(() => ToolHookDefinitionSchema.parse(missingType)).toThrow(ZodError);
    });

    it('should require handlerPath field', () => {
      const invalidHandler = { ...validHookDefinition, handlerPath: '' };
      expect(() => ToolHookDefinitionSchema.parse(invalidHandler)).toThrow(ZodError);

      const missingHandler = { ...validHookDefinition };
      delete (missingHandler as any).handlerPath;
      expect(() => ToolHookDefinitionSchema.parse(missingHandler)).toThrow(ZodError);
    });

    it('should validate priority is integer', () => {
      const floatPriority = { ...validHookDefinition, priority: 100.5 };
      expect(() => ToolHookDefinitionSchema.parse(floatPriority)).toThrow(ZodError);
    });

    it('should validate timeoutMs minimum value', () => {
      const tooSmallTimeout = { ...validHookDefinition, timeoutMs: 50 };
      expect(() => ToolHookDefinitionSchema.parse(tooSmallTimeout)).toThrow(ZodError);

      const validTimeout = { ...validHookDefinition, timeoutMs: 100 };
      expect(() => ToolHookDefinitionSchema.parse(validTimeout)).not.toThrow();
    });

    it('should validate timeoutMs is integer', () => {
      const floatTimeout = { ...validHookDefinition, timeoutMs: 1000.5 };
      expect(() => ToolHookDefinitionSchema.parse(floatTimeout)).toThrow(ZodError);
    });
  });

  describe('ToolHookConfigSchema', () => {
    it('should parse empty hook config with defaults', () => {
      const result = ToolHookConfigSchema.parse({});
      expect(result.pre).toEqual([]);
      expect(result.post).toEqual([]);
      expect(result.enabled).toBe(true);
      expect(result.defaultTimeoutMs).toBe(30000);
    });

    it('should parse hook config with pre and post hooks', () => {
      const config = {
        pre: [
          {
            name: 'pre-hook',
            type: 'pre' as const,
            handlerPath: '/pre-handler.js',
          },
        ],
        post: [
          {
            name: 'post-hook',
            type: 'post' as const,
            handlerPath: '/post-handler.js',
          },
        ],
        enabled: false,
        defaultTimeoutMs: 60000,
      };

      const result = ToolHookConfigSchema.parse(config);
      expect(result.pre).toHaveLength(1);
      expect(result.post).toHaveLength(1);
      expect(result.enabled).toBe(false);
      expect(result.defaultTimeoutMs).toBe(60000);
    });

    it('should validate defaultTimeoutMs minimum value', () => {
      const invalidTimeout = { defaultTimeoutMs: 50 };
      expect(() => ToolHookConfigSchema.parse(invalidTimeout)).toThrow(ZodError);

      const validTimeout = { defaultTimeoutMs: 100 };
      expect(() => ToolHookConfigSchema.parse(validTimeout)).not.toThrow();
    });

    it('should validate defaultTimeoutMs is integer', () => {
      const floatTimeout = { defaultTimeoutMs: 1000.5 };
      expect(() => ToolHookConfigSchema.parse(floatTimeout)).toThrow(ZodError);
    });

    it('should validate hook definitions within arrays', () => {
      const invalidConfig = {
        pre: [
          {
            name: '', // Invalid empty name
            type: 'pre' as const,
            handlerPath: '/handler.js',
          },
        ],
      };
      expect(() => ToolHookConfigSchema.parse(invalidConfig)).toThrow(ZodError);
    });
  });

  describe('PreHookContextSchema', () => {
    const validContext = {
      toolName: 'bash',
      arguments: { command: 'ls -la' },
      invocationId: 'inv-123',
      timestamp: new Date(),
    };

    it('should parse valid pre-hook context with required fields', () => {
      const result = PreHookContextSchema.parse(validContext);
      expect(result.toolName).toBe('bash');
      expect(result.arguments).toEqual({ command: 'ls -la' });
      expect(result.invocationId).toBe('inv-123');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should parse pre-hook context with all optional fields', () => {
      const fullContext = {
        ...validContext,
        taskId: 'task-456',
        agentName: 'developer',
        stageName: 'implementation',
      };

      const result = PreHookContextSchema.parse(fullContext);
      expect(result.taskId).toBe('task-456');
      expect(result.agentName).toBe('developer');
      expect(result.stageName).toBe('implementation');
    });

    it('should require toolName field', () => {
      const missingToolName = { ...validContext };
      delete (missingToolName as any).toolName;
      expect(() => PreHookContextSchema.parse(missingToolName)).toThrow(ZodError);
    });

    it('should require arguments field', () => {
      const missingArguments = { ...validContext };
      delete (missingArguments as any).arguments;
      expect(() => PreHookContextSchema.parse(missingArguments)).toThrow(ZodError);
    });

    it('should require invocationId field', () => {
      const missingId = { ...validContext };
      delete (missingId as any).invocationId;
      expect(() => PreHookContextSchema.parse(missingId)).toThrow(ZodError);
    });

    it('should require timestamp field', () => {
      const missingTimestamp = { ...validContext };
      delete (missingTimestamp as any).timestamp;
      expect(() => PreHookContextSchema.parse(missingTimestamp)).toThrow(ZodError);
    });

    it('should accept valid date objects for timestamp', () => {
      const dateContext = { ...validContext, timestamp: new Date() };
      expect(() => PreHookContextSchema.parse(dateContext)).not.toThrow();
    });

    it('should accept complex argument objects', () => {
      const complexArgs = {
        ...validContext,
        arguments: {
          command: 'npm test',
          options: { silent: true, verbose: false },
          env: { NODE_ENV: 'test' },
          nested: { deep: { value: 'test' } },
        },
      };
      const result = PreHookContextSchema.parse(complexArgs);
      expect(result.arguments).toEqual(complexArgs.arguments);
    });
  });

  describe('PostHookContextSchema', () => {
    const validContext = {
      toolName: 'bash',
      arguments: { command: 'ls -la' },
      invocationId: 'inv-123',
      timestamp: new Date(),
      result: {
        success: true,
        output: 'file1.txt\nfile2.txt',
        duration: 1500,
      },
    };

    it('should parse valid post-hook context', () => {
      const result = PostHookContextSchema.parse(validContext);
      expect(result.toolName).toBe('bash');
      expect(result.result.success).toBe(true);
      expect(result.result.output).toBe('file1.txt\nfile2.txt');
      expect(result.result.duration).toBe(1500);
    });

    it('should parse post-hook context with error result', () => {
      const errorContext = {
        ...validContext,
        result: {
          success: false,
          error: 'Command failed',
          duration: 500,
        },
      };

      const result = PostHookContextSchema.parse(errorContext);
      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Command failed');
      expect(result.result.output).toBeUndefined();
    });

    it('should require result field', () => {
      const missingResult = { ...validContext };
      delete (missingResult as any).result;
      expect(() => PostHookContextSchema.parse(missingResult)).toThrow(ZodError);
    });

    it('should require success field in result', () => {
      const invalidResult = {
        ...validContext,
        result: { output: 'test' },
      };
      expect(() => PostHookContextSchema.parse(invalidResult)).toThrow(ZodError);
    });

    it('should allow complex output objects', () => {
      const complexOutput = {
        ...validContext,
        result: {
          success: true,
          output: {
            stdout: 'Success output',
            stderr: '',
            exitCode: 0,
            metadata: { processed: true },
          },
        },
      };
      const result = PostHookContextSchema.parse(complexOutput);
      expect(result.result.output).toEqual(complexOutput.result.output);
    });
  });

  describe('PreHookActionSchema', () => {
    it('should accept valid pre-hook actions', () => {
      expect(PreHookActionSchema.parse('continue')).toBe('continue');
      expect(PreHookActionSchema.parse('modify')).toBe('modify');
      expect(PreHookActionSchema.parse('cancel')).toBe('cancel');
    });

    it('should reject invalid pre-hook actions', () => {
      expect(() => PreHookActionSchema.parse('invalid')).toThrow(ZodError);
      expect(() => PreHookActionSchema.parse('')).toThrow(ZodError);
      expect(() => PreHookActionSchema.parse(null)).toThrow(ZodError);
    });
  });

  describe('PreHookResultSchema', () => {
    it('should parse continue action result', () => {
      const result = PreHookResultSchema.parse({
        action: 'continue',
        reason: 'All checks passed',
      });
      expect(result.action).toBe('continue');
      expect(result.reason).toBe('All checks passed');
    });

    it('should parse modify action result with modified arguments', () => {
      const result = PreHookResultSchema.parse({
        action: 'modify',
        modifiedArguments: { command: 'ls -la --color' },
        reason: 'Added color output',
      });
      expect(result.action).toBe('modify');
      expect(result.modifiedArguments).toEqual({ command: 'ls -la --color' });
      expect(result.reason).toBe('Added color output');
    });

    it('should parse cancel action result with custom result', () => {
      const result = PreHookResultSchema.parse({
        action: 'cancel',
        reason: 'Security check failed',
        cancelResult: {
          success: false,
          error: 'Operation blocked by security policy',
        },
      });
      expect(result.action).toBe('cancel');
      expect(result.reason).toBe('Security check failed');
      expect(result.cancelResult?.success).toBe(false);
      expect(result.cancelResult?.error).toBe('Operation blocked by security policy');
    });

    it('should parse result with metadata', () => {
      const result = PreHookResultSchema.parse({
        action: 'continue',
        metadata: {
          checksPassed: ['security', 'syntax'],
          executionTime: 150,
        },
      });
      expect(result.metadata).toEqual({
        checksPassed: ['security', 'syntax'],
        executionTime: 150,
      });
    });

    it('should require action field', () => {
      expect(() => PreHookResultSchema.parse({})).toThrow(ZodError);
      expect(() => PreHookResultSchema.parse({ reason: 'test' })).toThrow(ZodError);
    });

    it('should allow minimal valid result', () => {
      const result = PreHookResultSchema.parse({ action: 'continue' });
      expect(result.action).toBe('continue');
      expect(result.reason).toBeUndefined();
      expect(result.modifiedArguments).toBeUndefined();
    });
  });

  describe('PostHookResultSchema', () => {
    it('should parse result without modification', () => {
      const result = PostHookResultSchema.parse({});
      expect(result.modifyResult).toBe(false);
      expect(result.modifiedResult).toBeUndefined();
    });

    it('should parse result with modification', () => {
      const result = PostHookResultSchema.parse({
        modifyResult: true,
        modifiedResult: {
          success: true,
          output: 'Modified output',
        },
      });
      expect(result.modifyResult).toBe(true);
      expect(result.modifiedResult?.success).toBe(true);
      expect(result.modifiedResult?.output).toBe('Modified output');
    });

    it('should parse result with metadata', () => {
      const result = PostHookResultSchema.parse({
        metadata: {
          processed: true,
          transformations: ['format', 'filter'],
        },
      });
      expect(result.metadata).toEqual({
        processed: true,
        transformations: ['format', 'filter'],
      });
    });

    it('should parse result with error modification', () => {
      const result = PostHookResultSchema.parse({
        modifyResult: true,
        modifiedResult: {
          success: false,
          error: 'Post-processing failed',
        },
      });
      expect(result.modifiedResult?.success).toBe(false);
      expect(result.modifiedResult?.error).toBe('Post-processing failed');
    });
  });

  describe('Type Inference', () => {
    it('should infer correct TypeScript types', () => {
      // Test type inference by creating typed variables
      const hookType: ToolHookType = 'pre';
      expect(hookType).toBe('pre');

      const hookDefinition: ToolHookDefinition = {
        name: 'test-hook',
        type: 'post',
        handlerPath: '/handler.js',
        priority: 150,
        enabled: true,
        description: 'Test hook',
        tools: ['bash'],
        timeoutMs: 5000,
        failOnError: false,
      };
      expect(hookDefinition.name).toBe('test-hook');

      const preHookAction: PreHookAction = 'modify';
      expect(preHookAction).toBe('modify');

      const preHookContext: PreHookContext = {
        toolName: 'test-tool',
        arguments: { arg1: 'value1' },
        invocationId: 'inv-123',
        timestamp: new Date(),
        taskId: 'task-456',
        agentName: 'test-agent',
        stageName: 'test-stage',
      };
      expect(preHookContext.toolName).toBe('test-tool');

      const postHookContext: PostHookContext = {
        ...preHookContext,
        result: {
          success: true,
          output: 'test output',
          duration: 1000,
        },
      };
      expect(postHookContext.result.success).toBe(true);

      const preHookResult: PreHookResult = {
        action: 'cancel',
        reason: 'Test cancellation',
        cancelResult: {
          success: false,
          error: 'Cancelled by test',
        },
      };
      expect(preHookResult.action).toBe('cancel');

      const postHookResult: PostHookResult = {
        modifyResult: true,
        modifiedResult: {
          success: true,
          output: 'Modified output',
        },
        metadata: { processed: true },
      };
      expect(postHookResult.modifyResult).toBe(true);

      const hookConfig: ToolHookConfig = {
        pre: [hookDefinition],
        post: [],
        enabled: true,
        defaultTimeoutMs: 30000,
      };
      expect(hookConfig.pre).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays in hook config', () => {
      const config = ToolHookConfigSchema.parse({
        pre: [],
        post: [],
      });
      expect(config.pre).toEqual([]);
      expect(config.post).toEqual([]);
    });

    it('should handle large timeout values', () => {
      const largeTimeout = 999999999;
      const config = {
        name: 'test-hook',
        type: 'pre' as const,
        handlerPath: '/handler.js',
        timeoutMs: largeTimeout,
      };
      const result = ToolHookDefinitionSchema.parse(config);
      expect(result.timeoutMs).toBe(largeTimeout);
    });

    it('should handle negative priority values', () => {
      const config = {
        name: 'test-hook',
        type: 'pre' as const,
        handlerPath: '/handler.js',
        priority: -100,
      };
      const result = ToolHookDefinitionSchema.parse(config);
      expect(result.priority).toBe(-100);
    });

    it('should handle empty tool arrays', () => {
      const config = {
        name: 'test-hook',
        type: 'pre' as const,
        handlerPath: '/handler.js',
        tools: [],
      };
      const result = ToolHookDefinitionSchema.parse(config);
      expect(result.tools).toEqual([]);
    });

    it('should handle null values in arguments', () => {
      const context = {
        toolName: 'test',
        arguments: { nullValue: null, undefinedValue: undefined },
        invocationId: 'inv-123',
        timestamp: new Date(),
      };
      const result = PreHookContextSchema.parse(context);
      expect(result.arguments.nullValue).toBeNull();
      expect(result.arguments.undefinedValue).toBeUndefined();
    });

    it('should handle complex nested argument structures', () => {
      const complexArgs = {
        toolName: 'complex-tool',
        arguments: {
          level1: {
            level2: {
              level3: {
                array: [1, 2, 3],
                string: 'test',
                boolean: true,
                null: null,
              },
            },
            array: ['a', 'b', 'c'],
          },
          topLevel: 'value',
        },
        invocationId: 'inv-complex',
        timestamp: new Date(),
      };
      const result = PreHookContextSchema.parse(complexArgs);
      expect(result.arguments).toEqual(complexArgs.arguments);
    });

    it('should handle zero duration in post-hook result', () => {
      const context = {
        toolName: 'fast-tool',
        arguments: {},
        invocationId: 'inv-fast',
        timestamp: new Date(),
        result: {
          success: true,
          duration: 0,
        },
      };
      const result = PostHookContextSchema.parse(context);
      expect(result.result.duration).toBe(0);
    });
  });
});