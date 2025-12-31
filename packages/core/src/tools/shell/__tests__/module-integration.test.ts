/**
 * @fileoverview Shell module integration tests
 *
 * This test file verifies that all shell module exports work together
 * correctly and integrate properly with the broader tools system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolRegistry } from '../../tool-registry.js';

describe('Shell Module Integration Tests', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    ToolRegistry.resetInstance();
    registry = ToolRegistry.getInstance();
  });

  afterEach(() => {
    registry.clear();
    ToolRegistry.resetInstance();
  });

  describe('Complete Module Export Integration', () => {
    it('can import and use all shell module exports from main tools index', async () => {
      // Import everything from the main tools index
      const toolsModule = await import('../../index.js');

      // Verify shell tool exports are available
      expect(toolsModule.BashTool).toBeDefined();
      expect(toolsModule.BackgroundTaskManager).toBeDefined();
      expect(toolsModule.registerShellTools).toBeDefined();
      expect(toolsModule.registerBashTool).toBeDefined();
      expect(toolsModule.createBashTool).toBeDefined();

      // Create and register a tool using exported functions
      const bashTool = toolsModule.createBashTool();
      expect(bashTool.name).toBe('Bash');

      // Register using the exported function
      toolsModule.registerBashTool(registry);
      expect(registry.has('Bash')).toBe(true);
    });

    it('can import and use all shell module exports from shell/index', async () => {
      // Import everything from shell/index specifically
      const shellModule = await import('../index.js');

      // Verify all expected exports exist
      const expectedExports = [
        'BashTool',
        'BackgroundTaskManager',
        'CommandSandbox',
        'createStrictSandbox',
        'createPermissiveSandbox',
        'createDisabledSandbox',
        'checkCommandBlocklist',
        'getAllBlocklistPatterns',
        'getBlocklistCategories',
        'getBlocklistCategory',
        'COMMAND_BLOCKLIST',
        'detectPathTraversal',
        'validateWorkingDirectory',
        'extractPathsFromCommand',
        'checkPathEscapesBase',
        'normalizePath',
        'pathsEqual',
        'getRelativePathIfWithin',
        'registerShellTools',
        'registerBashTool',
        'createBashTool',
        'BACKGROUND_TASK_DEFAULTS'
      ];

      for (const exportName of expectedExports) {
        expect(shellModule[exportName]).toBeDefined();
      }
    });

    it('ensures shell exports from main index match shell/index exports', async () => {
      const mainModule = await import('../../index.js');
      const shellModule = await import('../index.js');

      // Key exports should be identical references
      expect(mainModule.BashTool).toBe(shellModule.BashTool);
      expect(mainModule.BackgroundTaskManager).toBe(shellModule.BackgroundTaskManager);
      expect(mainModule.registerShellTools).toBe(shellModule.registerShellTools);
      expect(mainModule.registerBashTool).toBe(shellModule.registerBashTool);
      expect(mainModule.createBashTool).toBe(shellModule.createBashTool);
    });
  });

  describe('End-to-End Registration and Usage', () => {
    it('completes full registration workflow using exports', async () => {
      const { BashTool, registerShellTools, createBashTool } = await import('../index.js');

      // Step 1: Create tool instance using factory
      const tool1 = createBashTool();
      expect(tool1).toBeInstanceOf(BashTool);

      // Step 2: Register all shell tools
      registerShellTools(registry);
      expect(registry.size).toBe(1);
      expect(registry.has('Bash')).toBe(true);

      // Step 3: Get registered tool and verify it's the same type
      const registeredTool = registry.getToolInterface('Bash');
      expect(registeredTool).toBeInstanceOf(BashTool);
      expect(registeredTool.name).toBe('Bash');

      // Step 4: Execute tool (simple command)
      const result = await registeredTool.execute({ command: 'echo "integration test"' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('integration test');
    });

    it('handles complex registration scenarios', async () => {
      const {
        registerBashTool,
        createBashTool,
        CommandSandbox,
        createStrictSandbox
      } = await import('../index.js');

      // Create custom sandbox config
      const sandboxConfig = createStrictSandbox();
      expect(sandboxConfig.enabled).toBe(true);
      expect(sandboxConfig.mode).toBe('strict');

      // Register with custom config
      registerBashTool(registry, sandboxConfig);

      const tool = registry.getToolInterface('Bash');
      expect(tool.name).toBe('Bash');

      // Verify it works with registry features
      const entry = registry.get('Bash');
      expect(entry.available).toBe(true);
      expect(entry.definition.category).toBe('shell');
    });

    it('integrates with tool registry events', async () => {
      const { registerBashTool } = await import('../index.js');

      const events: string[] = [];

      registry.on('tool:registered', (data) => {
        events.push(`registered:${data.toolName}`);
      });

      registry.on('tool:unregistered', (data) => {
        events.push(`unregistered:${data.toolName}`);
      });

      // Register tool
      registerBashTool(registry);
      expect(events).toContain('registered:Bash');

      // Unregister tool
      registry.unregister('Bash');
      expect(events).toContain('unregistered:Bash');
    });
  });

  describe('Security and Configuration Integration', () => {
    it('integrates sandbox configurations with registration', async () => {
      const {
        registerBashTool,
        createStrictSandbox,
        createPermissiveSandbox,
        createDisabledSandbox
      } = await import('../index.js');

      // Test different sandbox configurations
      const configs = [
        createStrictSandbox(),
        createPermissiveSandbox(),
        createDisabledSandbox()
      ];

      for (let i = 0; i < configs.length; i++) {
        ToolRegistry.resetInstance();
        const testRegistry = ToolRegistry.getInstance();

        registerBashTool(testRegistry, configs[i]);
        expect(testRegistry.has('Bash')).toBe(true);

        const tool = testRegistry.getToolInterface('Bash');
        expect(tool.name).toBe('Bash');
      }
    });

    it('integrates blocklist functionality with tool execution', async () => {
      const {
        registerBashTool,
        checkCommandBlocklist,
        COMMAND_BLOCKLIST
      } = await import('../index.js');

      // Verify blocklist exports work
      expect(COMMAND_BLOCKLIST).toBeDefined();
      expect(typeof COMMAND_BLOCKLIST).toBe('object');

      const blocklistResult = checkCommandBlocklist('rm -rf /');
      expect(blocklistResult.blocked).toBe(true);
      expect(blocklistResult.category).toBeDefined();

      // Register tool and verify it can still be used safely
      registerBashTool(registry);
      const tool = registry.getToolInterface('Bash');

      // Safe command should work
      const safeResult = await tool.execute({ command: 'echo "safe command"' });
      expect(safeResult.success).toBe(true);
    });
  });

  describe('Background Task Integration', () => {
    it('integrates background task manager with tool system', async () => {
      const {
        BackgroundTaskManager,
        BACKGROUND_TASK_DEFAULTS,
        registerBashTool
      } = await import('../index.js');

      // Verify background task exports
      expect(BACKGROUND_TASK_DEFAULTS).toBeDefined();
      expect(BACKGROUND_TASK_DEFAULTS.timeout).toBeDefined();

      const manager = new BackgroundTaskManager();
      expect(manager).toBeDefined();

      // Register bash tool
      registerBashTool(registry);
      const tool = registry.getToolInterface('Bash');

      // Background execution should be possible
      // (Note: actual background execution testing is done in other test files)
      expect(typeof tool.execute).toBe('function');
    });
  });
});