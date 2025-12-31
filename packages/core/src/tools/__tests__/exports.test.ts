/**
 * @fileoverview Export validation tests
 *
 * This test file verifies that all BaseTool and ToolInterface exports
 * are correctly exposed through the module system and can be imported
 * by consumers of the @apex/core package.
 */

import { describe, it, expect } from 'vitest';

describe('BaseTool Module Exports', () => {
  it('exports all required classes and types from base-tool', async () => {
    const module = await import('../base-tool.js');

    // Main class and interface
    expect(module.BaseTool).toBeDefined();
    expect(typeof module.BaseTool).toBe('function');

    // Type guards
    expect(module.isToolInterface).toBeDefined();
    expect(typeof module.isToolInterface).toBe('function');
    expect(module.isBaseTool).toBeDefined();
    expect(typeof module.isBaseTool).toBe('function');

    // Types should be available for TypeScript (no runtime check needed)
    // but we can verify the type guard functions work
    expect(module.isToolInterface(null)).toBe(false);
    expect(module.isBaseTool(null)).toBe(false);
  });

  it('exports all required items from tools index', async () => {
    const module = await import('../index.js');

    // All the same exports should be available from the index
    expect(module.BaseTool).toBeDefined();
    expect(module.isToolInterface).toBeDefined();
    expect(module.isBaseTool).toBeDefined();
  });

  it('can create BaseTool instances through export', async () => {
    const { BaseTool } = await import('../base-tool.js');

    class TestTool extends BaseTool<{ message: string }, string> {
      constructor() {
        super({
          name: 'TestTool',
          description: 'Test tool for export validation',
          category: 'custom',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
            additionalProperties: false,
          },
        });
      }

      protected async executeImpl(params: { message: string }): Promise<string> {
        return `Echo: ${params.message}`;
      }
    }

    const tool = new TestTool();
    expect(tool.name).toBe('TestTool');
    expect(tool.enabled).toBe(true);

    const result = await tool.execute({ message: 'test' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('Echo: test');
  });

  it('type guards work with actual instances', async () => {
    const { BaseTool, isToolInterface, isBaseTool } = await import('../base-tool.js');

    class TestTool extends BaseTool<{}, string> {
      constructor() {
        super({
          name: 'TestTool',
          description: 'Test',
          category: 'custom',
        });
      }
      protected async executeImpl(): Promise<string> {
        return 'test';
      }
    }

    const tool = new TestTool();

    expect(isToolInterface(tool)).toBe(true);
    expect(isBaseTool(tool)).toBe(true);
  });
});