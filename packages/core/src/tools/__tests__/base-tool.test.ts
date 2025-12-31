/**
 * @fileoverview Tests for BaseTool abstract class and ToolInterface
 *
 * This test suite provides comprehensive coverage for the BaseTool abstract class
 * and ToolInterface, ensuring correct behavior across various scenarios including:
 * - Tool definition creation and caching
 * - Parameter validation (types, required fields, enums)
 * - Execution lifecycle (validation → execution → result)
 * - Error handling and edge cases
 * - Type safety and guards
 * - Performance characteristics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BaseTool,
  type ToolInterface,
  type ToolExecutionContext,
  type ValidationResult,
  type ToolResult,
  type BaseToolOptions,
  isToolInterface,
  isBaseTool,
} from '../base-tool.js';
import type { ToolCategory, ToolPermission, ToolParametersSchema } from '../../types.js';

// ============================================================================
// Test Implementations
// ============================================================================

/**
 * Simple test tool that echoes input message
 */
class EchoTool extends BaseTool<{ message: string; repeat?: number }, string> {
  constructor(options?: Partial<BaseToolOptions>) {
    super({
      name: 'Echo',
      description: 'Echoes the input message back',
      category: 'custom' as ToolCategory,
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo' },
          repeat: { type: 'integer', description: 'Number of times to repeat' },
        },
        required: ['message'],
        additionalProperties: false,
      },
      ...options,
    });
  }

  protected async executeImpl(params: { message: string; repeat?: number }): Promise<string> {
    const repeat = params.repeat ?? 1;
    return Array(repeat).fill(params.message).join(' ');
  }
}

/**
 * Tool that throws an error during execution
 */
class FailingTool extends BaseTool<{ shouldFail: boolean }, string> {
  constructor() {
    super({
      name: 'FailingTool',
      description: 'A tool that fails on command',
      category: 'custom' as ToolCategory,
      parameters: {
        type: 'object',
        properties: {
          shouldFail: { type: 'boolean', description: 'Whether to fail' },
        },
        required: ['shouldFail'],
        additionalProperties: false,
      },
    });
  }

  protected async executeImpl(params: { shouldFail: boolean }): Promise<string> {
    if (params.shouldFail) {
      throw new Error('Tool execution failed as requested');
    }
    return 'success';
  }
}

/**
 * Tool that simulates async operations with abort signal support
 */
class AsyncTool extends BaseTool<{ delay: number }, string> {
  constructor() {
    super({
      name: 'AsyncTool',
      description: 'Tool with async delay',
      category: 'custom' as ToolCategory,
      parameters: {
        type: 'object',
        properties: {
          delay: { type: 'number', description: 'Delay in milliseconds' },
        },
        required: ['delay'],
        additionalProperties: false,
      },
    });
  }

  protected async executeImpl(
    params: { delay: number },
    context?: ToolExecutionContext
  ): Promise<string> {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, params.delay);

      // Support abort signal
      if (context?.signal) {
        context.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Operation aborted'));
        });
      }
    });

    return `Completed after ${params.delay}ms`;
  }
}

/**
 * Tool with custom validation logic
 */
class ValidatingTool extends BaseTool<{ value: number }, number> {
  constructor() {
    super({
      name: 'ValidatingTool',
      description: 'Tool with custom validation',
      category: 'custom' as ToolCategory,
      parameters: {
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Input value' },
        },
        required: ['value'],
        additionalProperties: false,
      },
    });
  }

  validate(params: { value: number }, context?: ToolExecutionContext): ValidationResult {
    // Call parent validation first
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Custom validation: value must be positive
    if (params.value <= 0) {
      errors.push('Value must be positive');
    }

    // Custom warning: large values
    if (params.value > 1000) {
      warnings.push('Large values may cause performance issues');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  protected async executeImpl(params: { value: number }): Promise<number> {
    return params.value * 2;
  }
}

/**
 * Tool implementation using ToolInterface directly (not extending BaseTool)
 */
class DirectToolInterface implements ToolInterface<{ input: string }, string> {
  getDefinition() {
    return {
      name: 'DirectTool',
      description: 'Direct interface implementation',
      category: 'custom' as ToolCategory,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input string' },
        },
        required: ['input'],
        additionalProperties: false,
      } as ToolParametersSchema,
      dangerous: false,
      permissions: [] as ToolPermission[],
      enabled: true,
    };
  }

  validate(params: { input: string }): ValidationResult {
    if (!params.input || typeof params.input !== 'string') {
      return { valid: false, errors: ['Input must be a non-empty string'] };
    }
    return { valid: true };
  }

  async execute(params: { input: string }): Promise<ToolResult<string>> {
    const validation = this.validate(params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors?.join('; '),
        toolName: 'DirectTool',
        invokedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
      };
    }

    return {
      success: true,
      output: params.input.toUpperCase(),
      toolName: 'DirectTool',
      invokedAt: new Date(),
      completedAt: new Date(),
      duration: 1,
    };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseTool Abstract Class', () => {
  let echoTool: EchoTool;
  let failingTool: FailingTool;
  let asyncTool: AsyncTool;
  let validatingTool: ValidatingTool;

  beforeEach(() => {
    echoTool = new EchoTool();
    failingTool = new FailingTool();
    asyncTool = new AsyncTool();
    validatingTool = new ValidatingTool();
  });

  describe('Construction and Configuration', () => {
    it('creates tool with required options', () => {
      expect(echoTool.name).toBe('Echo');
      expect(echoTool.category).toBe('custom');
      expect(echoTool.enabled).toBe(true);
    });

    it('applies default values for optional options', () => {
      const tool = new EchoTool();
      const definition = tool.getDefinition();

      expect(definition.dangerous).toBe(false);
      expect(definition.permissions).toEqual([]);
      expect(definition.enabled).toBe(true);
      expect(definition.tags).toEqual([]);
    });

    it('allows override of default options', () => {
      const tool = new EchoTool({
        dangerous: true,
        permissions: ['write' as ToolPermission],
        enabled: false,
        tags: ['test', 'example'],
        version: '1.0.0',
      });

      const definition = tool.getDefinition();
      expect(definition.dangerous).toBe(true);
      expect(definition.permissions).toEqual(['write']);
      expect(definition.enabled).toBe(false);
      expect(definition.tags).toEqual(['test', 'example']);
      expect(definition.version).toBe('1.0.0');
    });
  });

  describe('Tool Definition', () => {
    it('returns complete tool definition', () => {
      const definition = echoTool.getDefinition();

      expect(definition).toEqual({
        name: 'Echo',
        description: 'Echoes the input message back',
        category: 'custom',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to echo' },
            repeat: { type: 'integer', description: 'Number of times to repeat' },
          },
          required: ['message'],
          additionalProperties: false,
        },
        dangerous: false,
        permissions: [],
        enabled: true,
        tags: [],
        examples: undefined,
        version: undefined,
      });
    });

    it('caches tool definition after first call', () => {
      const def1 = echoTool.getDefinition();
      const def2 = echoTool.getDefinition();

      expect(def1).toBe(def2); // Same object reference
    });

    it('handles missing parameters schema', () => {
      const tool = new class extends BaseTool<{}, string> {
        constructor() {
          super({
            name: 'NoParams',
            description: 'Tool without parameters',
            category: 'custom' as ToolCategory,
          });
        }
        protected async executeImpl(): Promise<string> {
          return 'result';
        }
      }();

      const definition = tool.getDefinition();
      expect(definition.parameters).toEqual({
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      });
    });
  });

  describe('Parameter Validation', () => {
    it('validates required parameters', () => {
      const result = echoTool.validate({} as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: message');
    });

    it('validates parameter types', () => {
      const result = echoTool.validate({
        message: 123, // Should be string
        repeat: 'invalid', // Should be number
      } as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter 'message' must be a string");
      expect(result.errors).toContain("Parameter 'repeat' must be a number");
    });

    it('validates integer types specifically', () => {
      const result = echoTool.validate({
        message: 'hello',
        repeat: 3.14, // Should be integer
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter 'repeat' must be an integer");
    });

    it('validates object types', () => {
      const tool = new class extends BaseTool<{ config: object }, string> {
        constructor() {
          super({
            name: 'ObjectTool',
            description: 'Tool with object param',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                config: { type: 'object', description: 'Configuration object' },
              },
              required: ['config'],
              additionalProperties: false,
            },
          });
        }
        protected async executeImpl(): Promise<string> {
          return 'result';
        }
      }();

      // Valid object
      expect(tool.validate({ config: {} }).valid).toBe(true);

      // Invalid types
      expect(tool.validate({ config: null } as any).valid).toBe(false);
      expect(tool.validate({ config: [] } as any).valid).toBe(false);
      expect(tool.validate({ config: 'string' } as any).valid).toBe(false);
    });

    it('validates array types', () => {
      const tool = new class extends BaseTool<{ items: string[] }, string> {
        constructor() {
          super({
            name: 'ArrayTool',
            description: 'Tool with array param',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                items: { type: 'array', description: 'Array of items' },
              },
              required: ['items'],
              additionalProperties: false,
            },
          });
        }
        protected async executeImpl(): Promise<string> {
          return 'result';
        }
      }();

      expect(tool.validate({ items: [] }).valid).toBe(true);
      expect(tool.validate({ items: ['a', 'b'] }).valid).toBe(true);
      expect(tool.validate({ items: 'not-array' } as any).valid).toBe(false);
    });

    it('validates boolean types', () => {
      expect(failingTool.validate({ shouldFail: true }).valid).toBe(true);
      expect(failingTool.validate({ shouldFail: false }).valid).toBe(true);
      expect(failingTool.validate({ shouldFail: 'true' } as any).valid).toBe(false);
    });

    it('validates null type', () => {
      const tool = new class extends BaseTool<{ nullable: null }, string> {
        constructor() {
          super({
            name: 'NullTool',
            description: 'Tool with null param',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                nullable: { type: 'null', description: 'Null value' },
              },
              required: ['nullable'],
              additionalProperties: false,
            },
          });
        }
        protected async executeImpl(): Promise<string> {
          return 'result';
        }
      }();

      expect(tool.validate({ nullable: null }).valid).toBe(true);
      expect(tool.validate({ nullable: undefined } as any).valid).toBe(false);
    });

    it('validates enum values', () => {
      const tool = new class extends BaseTool<{ mode: 'fast' | 'slow' }, string> {
        constructor() {
          super({
            name: 'EnumTool',
            description: 'Tool with enum param',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['fast', 'slow'],
                  description: 'Processing mode',
                },
              },
              required: ['mode'],
              additionalProperties: false,
            },
          });
        }
        protected async executeImpl(): Promise<string> {
          return 'result';
        }
      }();

      expect(tool.validate({ mode: 'fast' }).valid).toBe(true);
      expect(tool.validate({ mode: 'slow' }).valid).toBe(true);
      expect(tool.validate({ mode: 'invalid' } as any).valid).toBe(false);
    });

    it('warns about unknown parameters when additionalProperties is false', () => {
      const result = echoTool.validate({
        message: 'hello',
        unknownParam: 'value',
      } as any);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown parameter: unknownParam');
    });

    it('allows unknown parameters when additionalProperties is true', () => {
      const tool = new class extends BaseTool<{ message: string }, string> {
        constructor() {
          super({
            name: 'FlexibleTool',
            description: 'Tool allowing additional properties',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Message' },
              },
              required: ['message'],
              additionalProperties: true,
            },
          });
        }
        protected async executeImpl(): Promise<string> {
          return 'result';
        }
      }();

      const result = tool.validate({
        message: 'hello',
        extraParam: 'value',
      } as any);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('rejects non-object parameters', () => {
      const result = echoTool.validate('not an object' as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Parameters must be an object']);
    });

    it('rejects null parameters', () => {
      const result = echoTool.validate(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Parameters must be an object']);
    });

    it('supports custom validation in subclasses', () => {
      // Valid positive number
      expect(validatingTool.validate({ value: 10 }).valid).toBe(true);

      // Invalid negative number
      const negativeResult = validatingTool.validate({ value: -5 });
      expect(negativeResult.valid).toBe(false);
      expect(negativeResult.errors).toContain('Value must be positive');

      // Valid but large number (should warn)
      const largeResult = validatingTool.validate({ value: 2000 });
      expect(largeResult.valid).toBe(true);
      expect(largeResult.warnings).toContain('Large values may cause performance issues');
    });

    it('handles validation without context parameter', () => {
      const result = echoTool.validate({ message: 'test' });
      expect(result.valid).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('executes successfully with valid parameters', async () => {
      const result = await echoTool.execute({ message: 'hello' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello');
      expect(result.error).toBeUndefined();
      expect(result.toolName).toBe('Echo');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('executes with optional parameters', async () => {
      const result = await echoTool.execute({ message: 'hello', repeat: 3 });

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello hello hello');
    });

    it('fails execution with invalid parameters', async () => {
      const result = await echoTool.execute({} as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.output).toBeUndefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('handles execution errors gracefully', async () => {
      const result = await failingTool.execute({ shouldFail: true });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed as requested');
      expect(result.metadata?.errorType).toBe('Error');
      expect(result.metadata?.stack).toBeDefined();
    });

    it('handles non-Error thrown values', async () => {
      const tool = new class extends BaseTool<{}, string> {
        constructor() {
          super({
            name: 'StringThrower',
            description: 'Throws string instead of Error',
            category: 'custom' as ToolCategory,
          });
        }
        protected async executeImpl(): Promise<string> {
          throw 'String error'; // eslint-disable-line @typescript-eslint/no-throw-literal
        }
      }();

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
      expect(result.metadata?.errorType).toBe('Unknown');
    });

    it('respects abort signal', async () => {
      const controller = new AbortController();

      // Start execution and immediately abort
      controller.abort();

      const result = await asyncTool.execute(
        { delay: 1000 },
        { signal: controller.signal }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution aborted');
    });

    it('supports abort signal during execution', async () => {
      const controller = new AbortController();

      // Start execution and abort after short delay
      const executionPromise = asyncTool.execute(
        { delay: 500 },
        { signal: controller.signal }
      );

      setTimeout(() => controller.abort(), 100);

      const result = await executionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation aborted');
    });

    it('includes execution context in executeImpl', async () => {
      const mockExecuteImpl = vi.fn().mockResolvedValue('result');

      const tool = new class extends BaseTool<{ test: string }, string> {
        constructor() {
          super({
            name: 'ContextTool',
            description: 'Tool that checks context',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                test: { type: 'string' },
              },
              required: ['test'],
              additionalProperties: false,
            },
          });
        }
        protected executeImpl = mockExecuteImpl;
      }();

      const context: ToolExecutionContext = {
        taskId: 'task-123',
        agentName: 'test-agent',
        stageName: 'implementation',
        workingDirectory: '/tmp',
        environment: { NODE_ENV: 'test' },
        timeout: 5000,
      };

      await tool.execute({ test: 'value' }, context);

      expect(mockExecuteImpl).toHaveBeenCalledWith(
        { test: 'value' },
        context
      );
    });

    it('measures execution duration accurately', async () => {
      const result = await asyncTool.execute({ delay: 100 });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(100);
      expect(result.duration).toBeLessThan(200); // Allow some tolerance
    });

    it('sets timestamps correctly', async () => {
      const beforeExecution = new Date();
      const result = await echoTool.execute({ message: 'test' });
      const afterExecution = new Date();

      expect(result.invokedAt!.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
      expect(result.completedAt!.getTime()).toBeLessThanOrEqual(afterExecution.getTime());
      expect(result.completedAt!.getTime()).toBeGreaterThanOrEqual(result.invokedAt!.getTime());
    });
  });

  describe('Async Validation Support', () => {
    it('supports async validation', async () => {
      const tool = new class extends BaseTool<{ value: string }, string> {
        constructor() {
          super({
            name: 'AsyncValidator',
            description: 'Tool with async validation',
            category: 'custom' as ToolCategory,
            parameters: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
              required: ['value'],
              additionalProperties: false,
            },
          });
        }

        async validate(params: { value: string }): Promise<ValidationResult> {
          // Simulate async validation (e.g., checking database)
          await new Promise(resolve => setTimeout(resolve, 10));

          if (params.value === 'forbidden') {
            return { valid: false, errors: ['This value is forbidden'] };
          }

          return { valid: true };
        }

        protected async executeImpl(params: { value: string }): Promise<string> {
          return params.value;
        }
      }();

      const validResult = await tool.execute({ value: 'allowed' });
      expect(validResult.success).toBe(true);

      const invalidResult = await tool.execute({ value: 'forbidden' });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('This value is forbidden');
    });
  });
});

describe('ToolInterface Direct Implementation', () => {
  let directTool: DirectToolInterface;

  beforeEach(() => {
    directTool = new DirectToolInterface();
  });

  it('implements ToolInterface correctly', () => {
    expect(isToolInterface(directTool)).toBe(true);
    expect(isBaseTool(directTool)).toBe(false);
  });

  it('returns correct tool definition', () => {
    const definition = directTool.getDefinition();

    expect(definition.name).toBe('DirectTool');
    expect(definition.description).toBe('Direct interface implementation');
    expect(definition.category).toBe('custom');
  });

  it('validates parameters correctly', () => {
    expect(directTool.validate({ input: 'test' }).valid).toBe(true);
    expect(directTool.validate({ input: '' }).valid).toBe(false);
    expect(directTool.validate({} as any).valid).toBe(false);
  });

  it('executes successfully', async () => {
    const result = await directTool.execute({ input: 'hello' });

    expect(result.success).toBe(true);
    expect(result.output).toBe('HELLO');
    expect(result.toolName).toBe('DirectTool');
  });

  it('handles validation failures', async () => {
    const result = await directTool.execute({ input: '' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Input must be a non-empty string');
  });
});

describe('Type Guards', () => {
  let echoTool: EchoTool;
  let directTool: DirectToolInterface;

  beforeEach(() => {
    echoTool = new EchoTool();
    directTool = new DirectToolInterface();
  });

  describe('isToolInterface', () => {
    it('returns true for BaseTool instances', () => {
      expect(isToolInterface(echoTool)).toBe(true);
    });

    it('returns true for direct ToolInterface implementations', () => {
      expect(isToolInterface(directTool)).toBe(true);
    });

    it('returns false for non-tool objects', () => {
      expect(isToolInterface({})).toBe(false);
      expect(isToolInterface(null)).toBe(false);
      expect(isToolInterface(undefined)).toBe(false);
      expect(isToolInterface('string')).toBe(false);
      expect(isToolInterface(123)).toBe(false);
    });

    it('returns false for objects missing required methods', () => {
      expect(isToolInterface({ getDefinition: () => {} })).toBe(false);
      expect(isToolInterface({
        getDefinition: () => {},
        validate: () => ({ valid: true }),
      })).toBe(false);
    });

    it('returns false for objects with non-function methods', () => {
      expect(isToolInterface({
        getDefinition: 'not a function',
        validate: () => ({ valid: true }),
        execute: async () => ({ success: true }),
      })).toBe(false);
    });
  });

  describe('isBaseTool', () => {
    it('returns true for BaseTool instances', () => {
      expect(isBaseTool(echoTool)).toBe(true);
    });

    it('returns false for direct ToolInterface implementations', () => {
      expect(isBaseTool(directTool)).toBe(false);
    });

    it('returns false for non-BaseTool objects', () => {
      expect(isBaseTool({})).toBe(false);
      expect(isBaseTool(null)).toBe(false);
      expect(isBaseTool(undefined)).toBe(false);
    });
  });
});

describe('Performance and Edge Cases', () => {
  it('handles very large parameter objects', () => {
    const largeParams = {
      message: 'x'.repeat(10000),
      data: Array(1000).fill({ key: 'value' }),
    };

    const tool = new EchoTool();
    const result = tool.validate(largeParams as any);

    // Should handle large objects without crashing
    expect(result.valid).toBe(true);
  });

  it('caches tool definition for performance', () => {
    const tool = new EchoTool();

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      tool.getDefinition();
    }
    const end = performance.now();

    // Should be very fast due to caching
    expect(end - start).toBeLessThan(10);
  });

  it('handles concurrent executions safely', async () => {
    const tool = new EchoTool();

    const executions = Array(10).fill(null).map((_, i) =>
      tool.execute({ message: `message-${i}` })
    );

    const results = await Promise.all(executions);

    results.forEach((result, i) => {
      expect(result.success).toBe(true);
      expect(result.output).toBe(`message-${i}`);
    });
  });

  it('handles deeply nested parameter schemas', () => {
    const tool = new class extends BaseTool<{ nested: { deep: { value: string } } }, string> {
      constructor() {
        super({
          name: 'DeepTool',
          description: 'Tool with deeply nested parameters',
          category: 'custom' as ToolCategory,
          parameters: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deep: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                    },
                    required: ['value'],
                  },
                },
                required: ['deep'],
              },
            },
            required: ['nested'],
            additionalProperties: false,
          },
        });
      }
      protected async executeImpl(): Promise<string> {
        return 'result';
      }
    }();

    // Note: The base validation only validates top-level properties
    // For deep validation, custom validation logic would be needed
    const result = tool.validate({
      nested: { deep: { value: 'test' } },
    });

    expect(result.valid).toBe(true);
  });

  it('handles memory pressure gracefully', async () => {
    const tool = new class extends BaseTool<{ size: number }, string[]> {
      constructor() {
        super({
          name: 'MemoryTool',
          description: 'Tool that creates large arrays',
          category: 'custom' as ToolCategory,
          parameters: {
            type: 'object',
            properties: {
              size: { type: 'number' },
            },
            required: ['size'],
            additionalProperties: false,
          },
        });
      }
      protected async executeImpl(params: { size: number }): Promise<string[]> {
        return Array(params.size).fill('data');
      }
    }();

    const result = await tool.execute({ size: 1000 });
    expect(result.success).toBe(true);
    expect(result.output?.length).toBe(1000);
  });
});

describe('Integration with Existing Types', () => {
  it('uses ToolCategory from types correctly', () => {
    const categories: ToolCategory[] = [
      'filesystem',
      'search',
      'execution',
      'network',
      'custom',
    ];

    categories.forEach(category => {
      const tool = new EchoTool({ category });
      expect(tool.category).toBe(category);
      expect(tool.getDefinition().category).toBe(category);
    });
  });

  it('uses ToolPermission from types correctly', () => {
    const permissions: ToolPermission[] = ['read', 'write', 'execute', 'admin'];

    const tool = new EchoTool({ permissions });
    expect(tool.getDefinition().permissions).toEqual(permissions);
  });

  it('maintains compatibility with existing ToolResult schema', async () => {
    const result = await new EchoTool().execute({ message: 'test' });

    // These are the fields expected by the ToolResult schema from types.ts
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('toolName');
    expect(result).toHaveProperty('invokedAt');
    expect(result).toHaveProperty('completedAt');

    // Optional fields that may or may not be present
    if (result.error !== undefined) {
      expect(typeof result.error).toBe('string');
    }
    if (result.metadata !== undefined) {
      expect(typeof result.metadata).toBe('object');
    }
  });
});