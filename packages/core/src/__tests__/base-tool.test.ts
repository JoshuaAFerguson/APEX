/**
 * @fileoverview Tests for BaseTool abstract class and ToolInterface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BaseTool,
  ToolInterface,
  ToolExecutionContext,
  ValidationResult,
  ToolResult,
  BaseToolOptions,
  isToolInterface,
  isBaseTool,
} from '../tools/base-tool';
import type { ToolDefinition, ToolCategory } from '../types';

// ============================================================================
// Test Tool Implementations
// ============================================================================

/**
 * Simple echo tool for testing basic functionality
 */
class EchoTool extends BaseTool<{ message: string }, string> {
  constructor() {
    super({
      name: 'Echo',
      description: 'Echoes the input message back',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo' },
        },
        required: ['message'],
        additionalProperties: false,
      },
      version: '1.0.0',
      tags: ['test', 'utility'],
    });
  }

  protected async executeImpl(params: { message: string }): Promise<string> {
    return params.message;
  }
}

/**
 * Math tool for testing number validation
 */
class AddTool extends BaseTool<{ a: number; b: number }, number> {
  constructor() {
    super({
      name: 'Add',
      description: 'Adds two numbers together',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['a', 'b'],
        additionalProperties: false,
      },
    });
  }

  protected async executeImpl(params: { a: number; b: number }): Promise<number> {
    return params.a + params.b;
  }
}

/**
 * Tool that throws an error for testing error handling
 */
class FailingTool extends BaseTool<{ shouldFail: boolean }, void> {
  constructor() {
    super({
      name: 'Failing',
      description: 'A tool that fails when told to',
      category: 'custom',
      dangerous: true,
    });
  }

  protected async executeImpl(params: { shouldFail: boolean }): Promise<void> {
    if (params.shouldFail) {
      throw new Error('Intentional failure');
    }
  }
}

/**
 * Tool with async validation
 */
class AsyncValidationTool extends BaseTool<{ value: string }, boolean> {
  constructor() {
    super({
      name: 'AsyncValidation',
      description: 'A tool with async validation',
      category: 'custom',
    });
  }

  async validate(
    params: { value: string },
    _context?: ToolExecutionContext
  ): Promise<ValidationResult> {
    // Simulate async validation
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (params.value === 'invalid') {
      return {
        valid: false,
        errors: ['Value cannot be "invalid"'],
      };
    }

    return { valid: true };
  }

  protected async executeImpl(params: { value: string }): Promise<boolean> {
    return params.value === 'valid';
  }
}

/**
 * Tool with custom validation that returns warnings
 */
class WarningTool extends BaseTool<{ input: string }, string> {
  constructor() {
    super({
      name: 'Warning',
      description: 'A tool that may warn about inputs',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
        additionalProperties: false,
      },
    });
  }

  validate(params: { input: string }): ValidationResult {
    const base = super.validate(params);
    if (!base.valid) return base;

    const warnings: string[] = [];
    if (params.input.length > 100) {
      warnings.push('Input is very long, consider shortening');
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  protected async executeImpl(params: { input: string }): Promise<string> {
    return params.input.toUpperCase();
  }
}

/**
 * Tool that uses execution context
 */
class ContextAwareTool extends BaseTool<Record<string, never>, Record<string, unknown>> {
  constructor() {
    super({
      name: 'ContextAware',
      description: 'Returns execution context info',
      category: 'system',
      permissions: ['read'],
    });
  }

  protected async executeImpl(
    _params: Record<string, never>,
    context?: ToolExecutionContext
  ): Promise<Record<string, unknown>> {
    return {
      taskId: context?.taskId,
      agentName: context?.agentName,
      stageName: context?.stageName,
      workingDirectory: context?.workingDirectory,
    };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseTool', () => {
  describe('constructor', () => {
    it('should create a tool with required options', () => {
      const tool = new EchoTool();
      expect(tool.name).toBe('Echo');
      expect(tool.category).toBe('custom');
      expect(tool.enabled).toBe(true);
    });

    it('should handle dangerous flag', () => {
      const tool = new FailingTool();
      const def = tool.getDefinition();
      expect(def.dangerous).toBe(true);
    });

    it('should default dangerous to false', () => {
      const tool = new EchoTool();
      const def = tool.getDefinition();
      expect(def.dangerous).toBe(false);
    });
  });

  describe('getDefinition', () => {
    it('should return a valid ToolDefinition', () => {
      const tool = new EchoTool();
      const def = tool.getDefinition();

      expect(def.name).toBe('Echo');
      expect(def.description).toBe('Echoes the input message back');
      expect(def.category).toBe('custom');
      expect(def.parameters).toBeDefined();
      expect(def.parameters.type).toBe('object');
      expect(def.parameters.required).toContain('message');
      expect(def.version).toBe('1.0.0');
      expect(def.tags).toEqual(['test', 'utility']);
    });

    it('should cache the definition', () => {
      const tool = new EchoTool();
      const def1 = tool.getDefinition();
      const def2 = tool.getDefinition();
      expect(def1).toBe(def2); // Same reference
    });

    it('should include permissions', () => {
      const tool = new ContextAwareTool();
      const def = tool.getDefinition();
      expect(def.permissions).toContain('read');
    });
  });

  describe('validate', () => {
    it('should pass validation for valid parameters', () => {
      const tool = new EchoTool();
      const result = tool.validate({ message: 'hello' });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation for missing required parameters', () => {
      const tool = new EchoTool();
      const result = tool.validate({} as { message: string });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: message');
    });

    it('should fail validation for wrong parameter types', () => {
      const tool = new AddTool();
      const result = tool.validate({ a: 'not a number', b: 5 } as unknown as { a: number; b: number });

      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("'a' must be a number"))).toBe(true);
    });

    it('should fail validation for non-integer when integer expected', () => {
      class IntegerTool extends BaseTool<{ count: number }, number> {
        constructor() {
          super({
            name: 'Integer',
            description: 'Test integer validation',
            category: 'custom',
            parameters: {
              type: 'object',
              properties: {
                count: { type: 'integer' },
              },
              required: ['count'],
            },
          });
        }
        protected async executeImpl(params: { count: number }): Promise<number> {
          return params.count;
        }
      }

      const tool = new IntegerTool();
      const result = tool.validate({ count: 3.14 });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('must be an integer'))).toBe(true);
    });

    it('should fail validation for wrong boolean type', () => {
      class BoolTool extends BaseTool<{ flag: boolean }, boolean> {
        constructor() {
          super({
            name: 'Bool',
            description: 'Test boolean validation',
            category: 'custom',
            parameters: {
              type: 'object',
              properties: {
                flag: { type: 'boolean' },
              },
              required: ['flag'],
            },
          });
        }
        protected async executeImpl(params: { flag: boolean }): Promise<boolean> {
          return params.flag;
        }
      }

      const tool = new BoolTool();
      const result = tool.validate({ flag: 'true' } as unknown as { flag: boolean });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('must be a boolean'))).toBe(true);
    });

    it('should fail validation for wrong array type', () => {
      class ArrayTool extends BaseTool<{ items: unknown[] }, number> {
        constructor() {
          super({
            name: 'Array',
            description: 'Test array validation',
            category: 'custom',
            parameters: {
              type: 'object',
              properties: {
                items: { type: 'array' },
              },
              required: ['items'],
            },
          });
        }
        protected async executeImpl(params: { items: unknown[] }): Promise<number> {
          return params.items.length;
        }
      }

      const tool = new ArrayTool();
      const result = tool.validate({ items: 'not an array' } as unknown as { items: unknown[] });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('must be an array'))).toBe(true);
    });

    it('should fail validation for wrong object type', () => {
      class ObjectTool extends BaseTool<{ data: Record<string, unknown> }, boolean> {
        constructor() {
          super({
            name: 'Object',
            description: 'Test object validation',
            category: 'custom',
            parameters: {
              type: 'object',
              properties: {
                data: { type: 'object' },
              },
              required: ['data'],
            },
          });
        }
        protected async executeImpl(): Promise<boolean> {
          return true;
        }
      }

      const tool = new ObjectTool();
      // Array is not a valid object
      const result = tool.validate({ data: [1, 2, 3] } as unknown as { data: Record<string, unknown> });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('must be an object'))).toBe(true);
    });

    it('should fail validation for wrong null type', () => {
      class NullTool extends BaseTool<{ nothing: null }, boolean> {
        constructor() {
          super({
            name: 'Null',
            description: 'Test null validation',
            category: 'custom',
            parameters: {
              type: 'object',
              properties: {
                nothing: { type: 'null' },
              },
              required: ['nothing'],
            },
          });
        }
        protected async executeImpl(): Promise<boolean> {
          return true;
        }
      }

      const tool = new NullTool();
      const result = tool.validate({ nothing: 'not null' } as unknown as { nothing: null });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('must be null'))).toBe(true);
    });

    it('should validate enum values', () => {
      class EnumTool extends BaseTool<{ level: string }, string> {
        constructor() {
          super({
            name: 'Enum',
            description: 'Test enum validation',
            category: 'custom',
            parameters: {
              type: 'object',
              properties: {
                level: { type: 'string', enum: ['low', 'medium', 'high'] },
              },
              required: ['level'],
            },
          });
        }
        protected async executeImpl(params: { level: string }): Promise<string> {
          return params.level;
        }
      }

      const tool = new EnumTool();

      // Valid enum value
      expect(tool.validate({ level: 'medium' }).valid).toBe(true);

      // Invalid enum value
      const result = tool.validate({ level: 'extreme' });
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes('must be one of'))).toBe(true);
    });

    it('should warn about unknown parameters when additionalProperties is false', () => {
      const tool = new EchoTool();
      const result = tool.validate({ message: 'hello', unknown: 'param' } as { message: string });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown parameter: unknown');
    });

    it('should fail for non-object parameters', () => {
      const tool = new EchoTool();
      const result = tool.validate(null as unknown as { message: string });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Parameters must be an object');
    });

    it('should support async validation', async () => {
      const tool = new AsyncValidationTool();

      const validResult = await tool.validate({ value: 'valid' });
      expect(validResult.valid).toBe(true);

      const invalidResult = await tool.validate({ value: 'invalid' });
      expect(invalidResult.valid).toBe(false);
    });

    it('should support custom validation with warnings', () => {
      const tool = new WarningTool();
      const result = tool.validate({ input: 'a'.repeat(150) });

      expect(result.valid).toBe(true);
      expect(result.warnings?.some((w) => w.includes('very long'))).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid parameters', async () => {
      const tool = new EchoTool();
      const result = await tool.execute({ message: 'hello world' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello world');
      expect(result.toolName).toBe('Echo');
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should fail execution when validation fails', async () => {
      const tool = new EchoTool();
      const result = await tool.execute({} as { message: string });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(result.error).toContain('Missing required parameter');
    });

    it('should handle execution errors gracefully', async () => {
      const tool = new FailingTool();
      const result = await tool.execute({ shouldFail: true });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Intentional failure');
      expect(result.metadata?.errorType).toBe('Error');
      expect(result.metadata?.stack).toBeDefined();
    });

    it('should pass execution context to executeImpl', async () => {
      const tool = new ContextAwareTool();
      const context: ToolExecutionContext = {
        taskId: 'task-123',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workingDirectory: '/tmp',
      };

      const result = await tool.execute({}, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        taskId: 'task-123',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workingDirectory: '/tmp',
      });
    });

    it('should respect abort signal', async () => {
      const tool = new EchoTool();
      const controller = new AbortController();
      controller.abort();

      const result = await tool.execute({ message: 'hello' }, { signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution aborted');
    });

    it('should work with async validation', async () => {
      const tool = new AsyncValidationTool();

      const result = await tool.execute({ value: 'valid' });
      expect(result.success).toBe(true);
      expect(result.output).toBe(true);
    });

    it('should fail with async validation failure', async () => {
      const tool = new AsyncValidationTool();

      const result = await tool.execute({ value: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should track execution duration', async () => {
      class SlowTool extends BaseTool<Record<string, never>, void> {
        constructor() {
          super({
            name: 'Slow',
            description: 'A slow tool',
            category: 'custom',
          });
        }
        protected async executeImpl(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const tool = new SlowTool();
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
  });
});

describe('ToolInterface type guards', () => {
  describe('isToolInterface', () => {
    it('should return true for BaseTool instances', () => {
      const tool = new EchoTool();
      expect(isToolInterface(tool)).toBe(true);
    });

    it('should return true for objects implementing ToolInterface', () => {
      const customTool: ToolInterface = {
        getDefinition: () => ({
          name: 'Custom',
          description: 'A custom tool',
          category: 'custom',
          parameters: { type: 'object', properties: {}, required: [] },
          dangerous: false,
          permissions: [],
          enabled: true,
        }),
        validate: () => ({ valid: true }),
        execute: async () => ({ success: true, output: null }),
      };

      expect(isToolInterface(customTool)).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isToolInterface(null)).toBe(false);
      expect(isToolInterface(undefined)).toBe(false);
      expect(isToolInterface('string')).toBe(false);
      expect(isToolInterface(123)).toBe(false);
    });

    it('should return false for objects missing required methods', () => {
      expect(isToolInterface({})).toBe(false);
      expect(isToolInterface({ getDefinition: () => ({}) })).toBe(false);
      expect(isToolInterface({ getDefinition: () => ({}), validate: () => ({}) })).toBe(false);
    });
  });

  describe('isBaseTool', () => {
    it('should return true for BaseTool instances', () => {
      const tool = new EchoTool();
      expect(isBaseTool(tool)).toBe(true);
    });

    it('should return false for non-BaseTool objects', () => {
      const customTool = {
        getDefinition: () => ({}),
        validate: () => ({ valid: true }),
        execute: async () => ({ success: true }),
      };

      expect(isBaseTool(customTool)).toBe(false);
      expect(isBaseTool(null)).toBe(false);
      expect(isBaseTool({})).toBe(false);
    });
  });
});

describe('Edge cases', () => {
  it('should handle tools with no parameters schema', () => {
    class NoParamsTool extends BaseTool<Record<string, never>, string> {
      constructor() {
        super({
          name: 'NoParams',
          description: 'A tool with no parameters',
          category: 'custom',
        });
      }
      protected async executeImpl(): Promise<string> {
        return 'done';
      }
    }

    const tool = new NoParamsTool();
    const def = tool.getDefinition();
    expect(def.parameters).toBeDefined();
    expect(def.parameters.type).toBe('object');

    const result = tool.validate({});
    expect(result.valid).toBe(true);
  });

  it('should handle undefined values in parameters', () => {
    const tool = new EchoTool();
    const result = tool.validate({ message: undefined } as unknown as { message: string });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required parameter: message');
  });

  it('should handle non-Error throws in executeImpl', async () => {
    class ThrowStringTool extends BaseTool<Record<string, never>, void> {
      constructor() {
        super({
          name: 'ThrowString',
          description: 'Throws a string',
          category: 'custom',
        });
      }
      protected async executeImpl(): Promise<void> {
        throw 'string error';
      }
    }

    const tool = new ThrowStringTool();
    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');
    expect(result.metadata?.errorType).toBe('Unknown');
  });

  it('should handle empty string tool name', () => {
    class EmptyNameTool extends BaseTool<Record<string, never>, void> {
      constructor() {
        super({
          name: '',
          description: 'Empty name',
          category: 'custom',
        });
      }
      protected async executeImpl(): Promise<void> {}
    }

    const tool = new EmptyNameTool();
    expect(tool.name).toBe('');
  });

  it('should skip validation for parameters without type', () => {
    class NoTypeTool extends BaseTool<{ value: unknown }, unknown> {
      constructor() {
        super({
          name: 'NoType',
          description: 'No type in param schema',
          category: 'custom',
          parameters: {
            type: 'object',
            properties: {
              value: { description: 'A value without type' },
            },
            required: [],
          },
        });
      }
      protected async executeImpl(params: { value: unknown }): Promise<unknown> {
        return params.value;
      }
    }

    const tool = new NoTypeTool();
    // Should pass validation even with any value type
    expect(tool.validate({ value: 123 }).valid).toBe(true);
    expect(tool.validate({ value: 'string' }).valid).toBe(true);
    expect(tool.validate({ value: null }).valid).toBe(true);
  });
});
