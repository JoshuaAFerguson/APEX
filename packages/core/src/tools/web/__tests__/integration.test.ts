/**
 * @fileoverview Integration tests for web tools module
 *
 * Tests the complete integration of the web tools module:
 * - Module loads correctly
 * - Registration functions work end-to-end
 * - Tools can be created and used
 * - Integration with tool registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, getToolRegistry } from '../../tool-registry.js';

describe('Web Tools Module Integration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    // Reset registry to ensure clean state
    ToolRegistry.resetInstance();
    registry = new ToolRegistry();
  });

  describe('End-to-End Module Usage', () => {
    it('should import and use web tools module successfully', async () => {
      // Import the complete web module
      const webModule = await import('../index.js');

      // Should be able to create tools
      const webSearchTool = new webModule.WebSearchTool();
      expect(webSearchTool.name).toBe('WebSearch');
      expect(webSearchTool.category).toBe('web');

      // Should be able to register tools
      webModule.registerWebTools(registry);
      expect(registry.has('WebSearch')).toBe(true);

      // Should be able to get registered tool
      const registeredTool = registry.get('WebSearch');
      expect(registeredTool.name).toBe('WebSearch');
    });

    it('should work through main tools module', async () => {
      // Import from main tools module
      const toolsModule = await import('../../index.js');

      // Should be able to create and register web tools
      const tool = new toolsModule.WebSearchTool();
      expect(tool).toBeDefined();

      toolsModule.registerWebTools(registry);
      expect(registry.has('WebSearch')).toBe(true);
    });

    it('should work through core package', async () => {
      // Import from core package root
      const coreModule = await import('../../../index.js');

      // Should have web tools available
      expect(coreModule.WebSearchTool).toBeDefined();
      expect(coreModule.registerWebTools).toBeDefined();

      // Should be able to use them
      const tool = new coreModule.WebSearchTool();
      coreModule.registerWebTools(registry);

      expect(tool.name).toBe('WebSearch');
      expect(registry.has('WebSearch')).toBe(true);
    });
  });

  describe('Tool Lifecycle', () => {
    it('should complete full tool lifecycle', async () => {
      const { WebSearchTool, registerWebSearchTool } = await import('../index.js');

      // Create tool
      const tool = new WebSearchTool();
      expect(tool.name).toBe('WebSearch');

      // Register tool
      registerWebSearchTool(registry);
      expect(registry.has('WebSearch')).toBe(true);

      // Get registered tool
      const registeredTool = registry.get('WebSearch');
      expect(registeredTool.name).toBe('WebSearch');

      // Validate tool input (basic structure test)
      const sampleInput = { query: 'test search' };
      const validation = registeredTool.validate(sampleInput);
      expect(validation.isValid).toBe(true);
    });

    it('should handle bulk registration and usage', async () => {
      const { registerWebTools, webToolClasses, webTools } = await import('../index.js');

      // Register all web tools
      registerWebTools(registry);

      // Should have all tools registered
      expect(registry.getTools().length).toBe(webToolClasses.length);

      // Should be able to get each tool
      for (const toolClass of webToolClasses) {
        const tool = new toolClass();
        const registeredTool = registry.get(tool.name);
        expect(registeredTool).toBeDefined();
        expect(registeredTool.name).toBe(tool.name);
      }

      // Pre-created tool instances should work
      expect(webTools.length).toBe(webToolClasses.length);
      for (const tool of webTools) {
        expect(tool.name).toBeTruthy();
        expect(tool.category).toBeTruthy();
      }
    });
  });

  describe('Global Registry Integration', () => {
    it('should work with global registry', async () => {
      const { registerWebToolsGlobal, WebSearchTool } = await import('../index.js');

      // Reset global state
      ToolRegistry.resetInstance();

      // Register with global registry
      registerWebToolsGlobal();

      // Should be available through global registry
      const globalRegistry = getToolRegistry();
      expect(globalRegistry.has('WebSearch')).toBe(true);

      const tool = globalRegistry.get('WebSearch');
      expect(tool).toBeInstanceOf(WebSearchTool);
    });

    it('should maintain global registry consistency', async () => {
      const { registerWebToolsGlobal } = await import('../index.js');

      ToolRegistry.resetInstance();

      registerWebToolsGlobal();

      const registry1 = getToolRegistry();
      const registry2 = getToolRegistry();

      // Should be the same instance
      expect(registry1).toBe(registry2);

      // Should have the same tools
      expect(registry1.getTools().length).toBe(registry2.getTools().length);
    });
  });

  describe('Configuration Handling', () => {
    it('should handle configuration throughout the flow', async () => {
      const { WebSearchTool, registerWebSearchTool, createWebSearchTool } = await import('../index.js');

      const config = {
        allowedDomains: ['example.com'],
        maxResults: 5
      };

      // Should work with constructor
      const tool1 = new WebSearchTool(config);
      expect(tool1.name).toBe('WebSearch');

      // Should work with factory function
      const tool2 = createWebSearchTool(config);
      expect(tool2.name).toBe('WebSearch');

      // Should work with registration
      registerWebSearchTool(registry, config);
      const registeredTool = registry.get('WebSearch');
      expect(registeredTool.name).toBe('WebSearch');
    });
  });

  describe('Error Recovery', () => {
    it('should handle import errors gracefully', async () => {
      // This test ensures module structure is solid
      const module = await import('../index.js');

      // All expected exports should be present
      expect(module.WebSearchTool).toBeDefined();
      expect(module.registerWebTools).toBeDefined();
      expect(module.registerWebToolsGlobal).toBeDefined();
      expect(module.registerWebSearchTool).toBeDefined();
      expect(module.createWebSearchTool).toBeDefined();
      expect(module.webToolClasses).toBeDefined();
      expect(module.webTools).toBeDefined();
    });

    it('should handle registration conflicts', async () => {
      const { registerWebSearchTool } = await import('../index.js');

      // Register once
      registerWebSearchTool(registry);
      expect(registry.has('WebSearch')).toBe(true);

      // Second registration should throw
      expect(() => registerWebSearchTool(registry)).toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('should load module efficiently', async () => {
      const start = Date.now();

      const module = await import('../index.js');

      const loadTime = Date.now() - start;

      // Module should load quickly (less than 100ms)
      expect(loadTime).toBeLessThan(100);

      // Should have all expected exports
      expect(Object.keys(module).length).toBeGreaterThan(5);
    });

    it('should handle multiple imports efficiently', async () => {
      // Multiple imports should not cause performance issues
      const imports = await Promise.all([
        import('../index.js'),
        import('../index.js'),
        import('../index.js')
      ]);

      // All should resolve to same module
      expect(imports[0]).toBe(imports[1]);
      expect(imports[1]).toBe(imports[2]);
    });
  });
});