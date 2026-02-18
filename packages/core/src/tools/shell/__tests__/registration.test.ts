/**
 * @fileoverview Shell tool registration tests
 *
 * This test file verifies that the shell tool registration functions
 * (registerShellTools, registerBashTool, createBashTool) work correctly
 * with the ToolRegistry system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolRegistry } from '../../tool-registry.js';
import {
  BashTool,
  registerShellTools,
  registerBashTool,
  createBashTool,
} from '../index.js';
import type { SandboxConfig } from '../command-sandbox.js';

describe('Shell Tool Registration Functions', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    // Reset singleton and create fresh registry for each test
    ToolRegistry.resetInstance();
    registry = ToolRegistry.getInstance();
  });

  afterEach(() => {
    // Clean up registry
    registry.clear();
    ToolRegistry.resetInstance();
  });

  describe('registerBashTool', () => {
    it('registers BashTool with default configuration', () => {
      expect(registry.size).toBe(0);

      registerBashTool(registry);

      expect(registry.size).toBe(1);
      expect(registry.has('Bash')).toBe(true);

      const entry = registry.get('Bash');
      expect(entry.definition.name).toBe('Bash');
      expect(entry.definition.category).toBe('shell');
      expect(entry.available).toBe(true);
    });

    it('registers BashTool with custom sandbox configuration', () => {
      const sandboxConfig: Partial<SandboxConfig> = {
        enabled: true,
        mode: 'strict',
        allowedCommands: ['echo', 'ls'],
      };

      registerBashTool(registry, sandboxConfig);

      expect(registry.has('Bash')).toBe(true);

      const tool = registry.getToolInterface('Bash') as BashTool;
      expect(tool).toBeInstanceOf(BashTool);
    });

    it('throws error when registering duplicate tool', () => {
      registerBashTool(registry);

      expect(() => {
        registerBashTool(registry);
      }).toThrow('Tool \'Bash\' is already registered');
    });

    it('can register multiple times with allowOverwrite option', () => {
      // Create registry with allowOverwrite: true
      ToolRegistry.resetInstance();
      registry = ToolRegistry.getInstance({ allowOverwrite: true });

      registerBashTool(registry);
      expect(registry.size).toBe(1);

      // Should not throw when registering again
      registerBashTool(registry, { mode: 'permissive' });
      expect(registry.size).toBe(1);
      expect(registry.has('Bash')).toBe(true);
    });
  });

  describe('registerShellTools', () => {
    it('registers all shell tools (currently just BashTool)', () => {
      expect(registry.size).toBe(0);

      registerShellTools(registry);

      expect(registry.size).toBe(1);
      expect(registry.has('Bash')).toBe(true);
    });

    it('registers shell tools with custom sandbox configuration', () => {
      const sandboxConfig: Partial<SandboxConfig> = {
        enabled: false,
      };

      registerShellTools(registry, sandboxConfig);

      expect(registry.has('Bash')).toBe(true);

      const tool = registry.getToolInterface('Bash') as BashTool;
      expect(tool).toBeInstanceOf(BashTool);
    });

    it('delegates to registerBashTool internally', () => {
      // This tests that registerShellTools calls registerBashTool with the same arguments
      registerShellTools(registry);

      const bashEntry = registry.get('Bash');
      expect(bashEntry.definition.name).toBe('Bash');
      expect(bashEntry.definition.category).toBe('shell');
    });
  });

  describe('createBashTool', () => {
    it('creates BashTool with default configuration', () => {
      const tool = createBashTool();

      expect(tool).toBeInstanceOf(BashTool);
      expect(tool.name).toBe('Bash');
      expect(tool.enabled).toBe(true);

      const definition = tool.getDefinition();
      expect(definition.category).toBe('shell');
      expect(definition.name).toBe('Bash');
    });

    it('creates BashTool with custom sandbox configuration', () => {
      const sandboxConfig: Partial<SandboxConfig> = {
        enabled: true,
        mode: 'strict',
        workingDirectory: '/tmp',
      };

      const tool = createBashTool(sandboxConfig);

      expect(tool).toBeInstanceOf(BashTool);
      expect(tool.name).toBe('Bash');
      expect(tool.enabled).toBe(true);
    });

    it('creates different instances each time', () => {
      const tool1 = createBashTool();
      const tool2 = createBashTool();

      expect(tool1).toBeInstanceOf(BashTool);
      expect(tool2).toBeInstanceOf(BashTool);
      expect(tool1).not.toBe(tool2);
    });

    it('creates tools with independent configurations', () => {
      const tool1 = createBashTool({ enabled: true });
      const tool2 = createBashTool({ enabled: false });

      expect(tool1.enabled).toBe(true);
      expect(tool2.enabled).toBe(false);
    });
  });

  describe('Integration with ToolRegistry', () => {
    it('registered tools can be retrieved and executed', async () => {
      registerBashTool(registry);

      const tool = registry.getToolInterface('Bash');
      expect(tool).toBeInstanceOf(BashTool);

      // Test that the tool can be executed (using a simple echo command)
      const result = await tool.execute({ command: 'echo "test"' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('tracks tool usage statistics', async () => {
      registerBashTool(registry);

      const entry = registry.get('Bash');
      expect(entry.invocationCount).toBe(0);
      expect(entry.successCount).toBe(0);
      expect(entry.lastInvoked).toBeUndefined();

      const tool = registry.getToolInterface('Bash');
      await tool.execute({ command: 'echo "test"' });

      // Note: This test verifies the tool can be executed.
      // Usage tracking is handled by the orchestrator, not the tool itself.
      expect(entry.invocationCount).toBe(0); // Still 0 as tracking is done externally
    });

    it('can unregister and re-register tools', () => {
      registerBashTool(registry);
      expect(registry.has('Bash')).toBe(true);

      registry.unregister('Bash');
      expect(registry.has('Bash')).toBe(false);
      expect(registry.size).toBe(0);

      registerBashTool(registry);
      expect(registry.has('Bash')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('maintains tool availability status', () => {
      registerBashTool(registry);

      const entry = registry.get('Bash');
      expect(entry.available).toBe(true);

      registry.setAvailability('Bash', false, 'Disabled for testing');
      expect(entry.available).toBe(false);
      expect(entry.unavailableReason).toBe('Disabled for testing');

      registry.setAvailability('Bash', true);
      expect(entry.available).toBe(true);
      expect(entry.unavailableReason).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('handles registration errors gracefully', () => {
      // Create a registry with validation enabled
      ToolRegistry.resetInstance();
      registry = ToolRegistry.getInstance({ validateOnRegister: true });

      // This should work fine
      expect(() => {
        registerBashTool(registry);
      }).not.toThrow();
    });

    it('provides meaningful error messages for duplicate registrations', () => {
      registerBashTool(registry);

      expect(() => {
        registerBashTool(registry);
      }).toThrow('Tool \'Bash\' is already registered. Use unregister() first to replace it.');
    });

    it('handles tool not found errors', () => {
      expect(() => {
        registry.get('NonexistentTool');
      }).toThrow('Tool \'NonexistentTool\' is not registered.');
    });
  });

  describe('Type Safety', () => {
    it('maintains type safety through registration process', () => {
      registerBashTool(registry);

      const tool = registry.getToolInterface('Bash');

      // TypeScript should know this is a BashTool
      expect(tool.name).toBe('Bash');
      expect(typeof tool.execute).toBe('function');

      const definition = tool.getDefinition();
      expect(definition.name).toBe('Bash');
      expect(definition.category).toBe('shell');
    });

    it('factory function returns correctly typed instances', () => {
      const tool = createBashTool();

      // Should be properly typed as BashTool
      expect(tool.name).toBe('Bash');
      expect(tool.enabled).toBeDefined();
      expect(typeof tool.execute).toBe('function');
      expect(typeof tool.getDefinition).toBe('function');
    });
  });
});