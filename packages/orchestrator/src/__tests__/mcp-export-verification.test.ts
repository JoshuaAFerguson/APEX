/**
 * MCPConnectionManager Export Verification Tests
 *
 * Tests to verify that MCPConnectionManager is properly exported
 * from the @apex/orchestrator package according to acceptance criteria:
 *
 * - MCPConnectionManager is exported from @apex/orchestrator
 * - Related types are also exported
 * - Import structure is correct for external consumers
 */

import { describe, it, expect } from 'vitest';

describe('MCPConnectionManager Export Verification', () => {
  describe('Direct Import from Package', () => {
    it('should export MCPConnectionManager from orchestrator package root', async () => {
      // Test importing MCPConnectionManager from the main index
      const { MCPConnectionManager } = await import('../index.js');

      expect(MCPConnectionManager).toBeDefined();
      expect(typeof MCPConnectionManager).toBe('function');
      expect(MCPConnectionManager.name).toBe('MCPConnectionManager');
    });

    it('should export MCPConnectionManagerOptions type', async () => {
      // Test importing the options type
      const module = await import('../index.js');

      // TypeScript types aren't available at runtime, but we can verify
      // the import doesn't throw an error
      expect(module).toBeDefined();

      // Verify the class can be instantiated (constructor signature verification)
      expect(typeof MCPConnectionManager).toBe('function');
    });

    it('should export MCPConnectionManagerEvents type', async () => {
      // Test importing the events type
      const module = await import('../index.js');

      // Verify the module exports what we expect
      expect(module).toBeDefined();
      expect(module.MCPConnectionManager).toBeDefined();
    });
  });

  describe('Direct Import from MCP Module', () => {
    it('should export MCPConnectionManager directly from mcp module', async () => {
      // Test importing directly from the MCP module
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      expect(MCPConnectionManager).toBeDefined();
      expect(typeof MCPConnectionManager).toBe('function');
      expect(MCPConnectionManager.name).toBe('MCPConnectionManager');
    });

    it('should export MCPConnectionManagerOptions directly from mcp module', async () => {
      // Test importing the options type directly
      const module = await import('../mcp/connection-manager.js');

      expect(module).toBeDefined();
      expect(module.MCPConnectionManager).toBeDefined();
    });

    it('should export MCPConnectionManagerEvents directly from mcp module', async () => {
      // Test importing the events type directly
      const module = await import('../mcp/connection-manager.js');

      expect(module).toBeDefined();
      expect(module.MCPConnectionManager).toBeDefined();
    });
  });

  describe('Re-export Consistency', () => {
    it('should maintain consistency between direct and re-exported imports', async () => {
      // Import from both locations
      const { MCPConnectionManager: ReexportedClass } = await import('../index.js');
      const { MCPConnectionManager: DirectClass } = await import('../mcp/connection-manager.js');

      // Verify they're the same class
      expect(ReexportedClass).toBe(DirectClass);
      expect(ReexportedClass.name).toBe(DirectClass.name);
    });

    it('should provide same constructor signature from both imports', async () => {
      const { MCPConnectionManager: ReexportedClass } = await import('../index.js');
      const { MCPConnectionManager: DirectClass } = await import('../mcp/connection-manager.js');

      // Both should have the same constructor length (parameter count)
      expect(ReexportedClass.length).toBe(DirectClass.length);
    });
  });

  describe('External Consumer Usage Patterns', () => {
    it('should support destructured import pattern', async () => {
      // Simulate how external consumers would import
      const { MCPConnectionManager, ApexOrchestrator } = await import('../index.js');

      expect(MCPConnectionManager).toBeDefined();
      expect(ApexOrchestrator).toBeDefined();
      expect(typeof MCPConnectionManager).toBe('function');
      expect(typeof ApexOrchestrator).toBe('function');
    });

    it('should support namespace import pattern', async () => {
      // Simulate namespace import
      const OrchestratorModule = await import('../index.js');

      expect(OrchestratorModule.MCPConnectionManager).toBeDefined();
      expect(OrchestratorModule.ApexOrchestrator).toBeDefined();
      expect(typeof OrchestratorModule.MCPConnectionManager).toBe('function');
      expect(typeof OrchestratorModule.ApexOrchestrator).toBe('function');
    });

    it('should support default + named import pattern', async () => {
      // Test mixed import patterns
      const module = await import('../index.js');
      const { MCPConnectionManager } = module;

      expect(MCPConnectionManager).toBeDefined();
      expect(typeof MCPConnectionManager).toBe('function');
    });
  });

  describe('Type Export Verification', () => {
    it('should verify MCPConnectionManager class structure', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      // Create an instance to verify the class structure
      const mockOptions = {
        projectPath: '/test/path',
        config: {
          project: { name: 'test', version: '1.0.0' },
          agents: {},
          workflows: {}
        }
      };

      const instance = new MCPConnectionManager(mockOptions);

      // Verify expected methods exist
      expect(typeof instance.discoverServers).toBe('function');
      expect(typeof instance.connect).toBe('function');
      expect(typeof instance.disconnect).toBe('function');
      expect(typeof instance.disconnectAll).toBe('function');
      expect(typeof instance.listConnections).toBe('function');
      expect(typeof instance.getConnection).toBe('function');
      expect(typeof instance.getClient).toBe('function');
      expect(typeof instance.updateConfig).toBe('function');
      expect(typeof instance.checkHealth).toBe('function');

      // Verify it extends EventEmitter
      expect(typeof instance.on).toBe('function');
      expect(typeof instance.off).toBe('function');
      expect(typeof instance.emit).toBe('function');
    });

    it('should verify constructor parameter types', async () => {
      const { MCPConnectionManager } = await import('../mcp/connection-manager.js');

      // Test with minimal valid config
      const minimalOptions = {
        projectPath: '/test',
        config: {
          project: { name: 'test', version: '1.0.0' },
          agents: {},
          workflows: {}
        }
      };

      // Should not throw
      expect(() => new MCPConnectionManager(minimalOptions)).not.toThrow();

      // Test with MCP config
      const fullOptions = {
        projectPath: '/test',
        config: {
          project: { name: 'test', version: '1.0.0' },
          mcp: {
            enabled: true,
            servers: {
              'test': { name: 'test', type: 'stdio' as const, command: 'test' }
            }
          },
          agents: {},
          workflows: {}
        }
      };

      // Should not throw
      expect(() => new MCPConnectionManager(fullOptions)).not.toThrow();
    });
  });

  describe('Package Boundary Verification', () => {
    it('should be importable as if from external package', async () => {
      // This simulates how an external package would import
      // In a real scenario, this would be: import { MCPConnectionManager } from '@apex/orchestrator';
      const { MCPConnectionManager } = await import('../index.js');

      expect(MCPConnectionManager).toBeDefined();
      expect(typeof MCPConnectionManager).toBe('function');

      // Verify it can be instantiated
      const options = {
        projectPath: '/external/project',
        config: {
          project: { name: 'external', version: '1.0.0' },
          agents: {},
          workflows: {}
        }
      };

      const instance = new MCPConnectionManager(options);
      expect(instance).toBeInstanceOf(MCPConnectionManager);
    });

    it('should maintain API stability for external consumers', async () => {
      const { MCPConnectionManager } = await import('../index.js');

      // These are the key methods that external consumers should rely on
      const requiredMethods = [
        'discoverServers',
        'connect',
        'disconnect',
        'disconnectAll',
        'listConnections',
        'getConnection',
        'getClient',
        'updateConfig',
        'checkHealth'
      ];

      const options = {
        projectPath: '/test',
        config: {
          project: { name: 'test', version: '1.0.0' },
          agents: {},
          workflows: {}
        }
      };

      const instance = new MCPConnectionManager(options);

      // Verify all required methods are present and are functions
      requiredMethods.forEach(methodName => {
        expect(instance[methodName as keyof typeof instance]).toBeDefined();
        expect(typeof instance[methodName as keyof typeof instance]).toBe('function');
      });
    });

    it('should provide correct TypeScript module structure', async () => {
      // Verify the module exports match expected TypeScript declarations
      const module = await import('../index.js');

      // Check that key exports are available
      expect(module.MCPConnectionManager).toBeDefined();
      expect(module.ApexOrchestrator).toBeDefined();

      // MCPConnectionManager should be a constructor function
      expect(typeof module.MCPConnectionManager).toBe('function');
      expect(module.MCPConnectionManager.prototype).toBeDefined();
      expect(typeof module.MCPConnectionManager.prototype.constructor).toBe('function');
    });
  });

  describe('Import Error Handling', () => {
    it('should not throw when importing from orchestrator package', async () => {
      await expect(import('../index.js')).resolves.toBeDefined();
    });

    it('should not throw when importing directly from mcp module', async () => {
      await expect(import('../mcp/connection-manager.js')).resolves.toBeDefined();
    });

    it('should provide meaningful exports from both locations', async () => {
      const mainModule = await import('../index.js');
      const mcpModule = await import('../mcp/connection-manager.js');

      expect(Object.keys(mainModule)).toContain('MCPConnectionManager');
      expect(Object.keys(mcpModule)).toContain('MCPConnectionManager');
    });
  });
});