/**
 * @fileoverview Export validation tests
 *
 * This test file verifies that all tool exports are correctly exposed
 * through the module system and can be imported by consumers of the
 * @apex/core package.
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

describe('Shell Module Exports', () => {
  it('exports all required shell tool classes and types from shell/index', async () => {
    const module = await import('../shell/index.js');

    // Main tool classes
    expect(module.BashTool).toBeDefined();
    expect(typeof module.BashTool).toBe('function');
    expect(module.BackgroundTaskManager).toBeDefined();
    expect(typeof module.BackgroundTaskManager).toBe('function');

    // Security classes and functions
    expect(module.CommandSandbox).toBeDefined();
    expect(typeof module.CommandSandbox).toBe('function');
    expect(module.createStrictSandbox).toBeDefined();
    expect(typeof module.createStrictSandbox).toBe('function');
    expect(module.createPermissiveSandbox).toBeDefined();
    expect(typeof module.createPermissiveSandbox).toBe('function');
    expect(module.createDisabledSandbox).toBeDefined();
    expect(typeof module.createDisabledSandbox).toBe('function');

    // Blocklist functions
    expect(module.checkCommandBlocklist).toBeDefined();
    expect(typeof module.checkCommandBlocklist).toBe('function');
    expect(module.getAllBlocklistPatterns).toBeDefined();
    expect(typeof module.getAllBlocklistPatterns).toBe('function');
    expect(module.getBlocklistCategories).toBeDefined();
    expect(typeof module.getBlocklistCategories).toBe('function');
    expect(module.getBlocklistCategory).toBeDefined();
    expect(typeof module.getBlocklistCategory).toBe('function');
    expect(module.COMMAND_BLOCKLIST).toBeDefined();
    expect(typeof module.COMMAND_BLOCKLIST).toBe('object');

    // Path validation functions
    expect(module.detectPathTraversal).toBeDefined();
    expect(typeof module.detectPathTraversal).toBe('function');
    expect(module.validateWorkingDirectory).toBeDefined();
    expect(typeof module.validateWorkingDirectory).toBe('function');
    expect(module.extractPathsFromCommand).toBeDefined();
    expect(typeof module.extractPathsFromCommand).toBe('function');
    expect(module.checkPathEscapesBase).toBeDefined();
    expect(typeof module.checkPathEscapesBase).toBe('function');
    expect(module.normalizePath).toBeDefined();
    expect(typeof module.normalizePath).toBe('function');
    expect(module.pathsEqual).toBeDefined();
    expect(typeof module.pathsEqual).toBe('function');
    expect(module.getRelativePathIfWithin).toBeDefined();
    expect(typeof module.getRelativePathIfWithin).toBe('function');

    // Registration functions
    expect(module.registerShellTools).toBeDefined();
    expect(typeof module.registerShellTools).toBe('function');
    expect(module.registerBashTool).toBeDefined();
    expect(typeof module.registerBashTool).toBe('function');
    expect(module.createBashTool).toBeDefined();
    expect(typeof module.createBashTool).toBe('function');

    // Constants
    expect(module.BACKGROUND_TASK_DEFAULTS).toBeDefined();
    expect(typeof module.BACKGROUND_TASK_DEFAULTS).toBe('object');
  });

  it('exports all shell tools from main tools index', async () => {
    const module = await import('../index.js');

    // Shell tool exports should be available from main index
    expect(module.BashTool).toBeDefined();
    expect(module.BackgroundTaskManager).toBeDefined();
    expect(module.registerShellTools).toBeDefined();
    expect(module.registerBashTool).toBeDefined();
    expect(module.createBashTool).toBeDefined();

    // Verify they're the same exports
    const shellModule = await import('../shell/index.js');
    expect(module.BashTool).toBe(shellModule.BashTool);
    expect(module.BackgroundTaskManager).toBe(shellModule.BackgroundTaskManager);
    expect(module.registerShellTools).toBe(shellModule.registerShellTools);
    expect(module.registerBashTool).toBe(shellModule.registerBashTool);
    expect(module.createBashTool).toBe(shellModule.createBashTool);
  });

  it('can create BashTool instances through shell module exports', async () => {
    const { BashTool, createBashTool } = await import('../shell/index.js');

    // Test direct instantiation
    const tool1 = new BashTool();
    expect(tool1.name).toBe('Bash');
    expect(tool1.enabled).toBe(true);

    // Test factory function
    const tool2 = createBashTool();
    expect(tool2.name).toBe('Bash');
    expect(tool2.enabled).toBe(true);

    // Test with sandbox config
    const tool3 = createBashTool({
      enabled: true,
      mode: 'strict',
    });
    expect(tool3.name).toBe('Bash');
    expect(tool3.enabled).toBe(true);
  });

  it('can create BackgroundTaskManager instances through shell module exports', async () => {
    const { BackgroundTaskManager } = await import('../shell/index.js');

    const manager = new BackgroundTaskManager();
    expect(manager).toBeDefined();
    expect(typeof manager.start).toBe('function');
    expect(typeof manager.stop).toBe('function');
    expect(typeof manager.kill).toBe('function');
    expect(typeof manager.getInfo).toBe('function');
  });
});

describe('Web Module Exports', () => {
  it('exports all required web tool classes and types from web/index', async () => {
    const module = await import('../web/index.js');

    // Main tool classes
    expect(module.WebSearchTool).toBeDefined();
    expect(typeof module.WebSearchTool).toBe('function');

    // Registration functions
    expect(module.registerWebTools).toBeDefined();
    expect(typeof module.registerWebTools).toBe('function');
    expect(module.registerWebToolsGlobal).toBeDefined();
    expect(typeof module.registerWebToolsGlobal).toBe('function');
    expect(module.registerWebSearchTool).toBeDefined();
    expect(typeof module.registerWebSearchTool).toBe('function');
    expect(module.createWebSearchTool).toBeDefined();
    expect(typeof module.createWebSearchTool).toBe('function');

    // Tool class arrays
    expect(module.webToolClasses).toBeDefined();
    expect(Array.isArray(module.webToolClasses)).toBe(true);
    expect(module.webTools).toBeDefined();
    expect(Array.isArray(module.webTools)).toBe(true);
  });

  it('exports all web tools from main tools index', async () => {
    const module = await import('../index.js');

    // Web tool exports should be available from main index
    expect(module.WebSearchTool).toBeDefined();
    expect(module.registerWebTools).toBeDefined();
    expect(module.registerWebToolsGlobal).toBeDefined();
    expect(module.registerWebSearchTool).toBeDefined();
    expect(module.createWebSearchTool).toBeDefined();
    expect(module.webToolClasses).toBeDefined();
    expect(module.webTools).toBeDefined();

    // Verify they're the same exports
    const webModule = await import('../web/index.js');
    expect(module.WebSearchTool).toBe(webModule.WebSearchTool);
    expect(module.registerWebTools).toBe(webModule.registerWebTools);
    expect(module.registerWebToolsGlobal).toBe(webModule.registerWebToolsGlobal);
    expect(module.registerWebSearchTool).toBe(webModule.registerWebSearchTool);
    expect(module.createWebSearchTool).toBe(webModule.createWebSearchTool);
    expect(module.webToolClasses).toBe(webModule.webToolClasses);
    expect(module.webTools).toBe(webModule.webTools);
  });

  it('can create WebSearchTool instances through web module exports', async () => {
    const { WebSearchTool, createWebSearchTool } = await import('../web/index.js');

    // Test direct instantiation
    const tool1 = new WebSearchTool();
    expect(tool1.name).toBe('WebSearch');
    expect(tool1.enabled).toBe(true);

    // Test factory function
    const tool2 = createWebSearchTool();
    expect(tool2.name).toBe('WebSearch');
    expect(tool2.enabled).toBe(true);

    // Test with config
    const tool3 = createWebSearchTool({ apiKey: 'test-key' });
    expect(tool3.name).toBe('WebSearch');
    expect(tool3.enabled).toBe(true);
  });

  it('web tools registration functions work correctly', async () => {
    const { ToolRegistry } = await import('../tool-registry.js');
    const { registerWebTools, registerWebSearchTool } = await import('../web/index.js');

    const registry = new ToolRegistry();

    // Test registerWebSearchTool
    registerWebSearchTool(registry);
    expect(registry.getTool('WebSearch')).toBeDefined();

    // Create a new registry for the full registration test
    const registry2 = new ToolRegistry();
    registerWebTools(registry2);
    expect(registry2.getTool('WebSearch')).toBeDefined();
  });
});