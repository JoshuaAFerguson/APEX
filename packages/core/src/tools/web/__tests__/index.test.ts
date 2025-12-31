/**
 * @fileoverview Module exports tests for web tools
 *
 * Tests that the web tools module exports are correct and accessible:
 * - All expected exports are available
 * - Types are properly exported
 * - Re-exports from register module work
 * - Integration with main tools module
 */

import { describe, it, expect } from 'vitest';

describe('Web Tools Module Exports', () => {
  describe('Direct Web Module Exports', () => {
    it('should export WebSearchTool and related types', async () => {
      const module = await import('../index.js');

      // Tool class
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

      // Tool collections
      expect(module.webToolClasses).toBeDefined();
      expect(Array.isArray(module.webToolClasses)).toBe(true);

      expect(module.webTools).toBeDefined();
      expect(Array.isArray(module.webTools)).toBe(true);
    });

    it('should export types that can be imported', async () => {
      // This test verifies TypeScript compilation works
      const module = await import('../index.js');

      // Create instances to verify types work
      const tool = new module.WebSearchTool();
      expect(tool).toBeDefined();
      expect(tool.name).toBe('WebSearch');

      const createdTool = module.createWebSearchTool();
      expect(createdTool).toBeDefined();
      expect(createdTool.name).toBe('WebSearch');
    });
  });

  describe('Main Tools Module Integration', () => {
    it('should export web tools from main tools module', async () => {
      const mainModule = await import('../../index.js');

      // Tool class
      expect(mainModule.WebSearchTool).toBeDefined();
      expect(typeof mainModule.WebSearchTool).toBe('function');

      // Registration functions
      expect(mainModule.registerWebTools).toBeDefined();
      expect(mainModule.registerWebToolsGlobal).toBeDefined();
      expect(mainModule.registerWebSearchTool).toBeDefined();
      expect(mainModule.createWebSearchTool).toBeDefined();

      // Tool collections
      expect(mainModule.webToolClasses).toBeDefined();
      expect(mainModule.webTools).toBeDefined();
    });

    it('should maintain consistency between web module and main module exports', async () => {
      const webModule = await import('../index.js');
      const mainModule = await import('../../index.js');

      // Same tool class
      expect(mainModule.WebSearchTool).toBe(webModule.WebSearchTool);

      // Same registration functions
      expect(mainModule.registerWebTools).toBe(webModule.registerWebTools);
      expect(mainModule.registerWebToolsGlobal).toBe(webModule.registerWebToolsGlobal);
      expect(mainModule.registerWebSearchTool).toBe(webModule.registerWebSearchTool);
      expect(mainModule.createWebSearchTool).toBe(webModule.createWebSearchTool);

      // Same tool collections
      expect(mainModule.webToolClasses).toBe(webModule.webToolClasses);
      expect(mainModule.webTools).toBe(webModule.webTools);
    });
  });

  describe('Core Package Integration', () => {
    it('should export web tools from core package root', async () => {
      const coreModule = await import('../../../index.js');

      // Should be able to access web tools through core
      expect(coreModule.WebSearchTool).toBeDefined();
      expect(coreModule.registerWebTools).toBeDefined();
      expect(coreModule.webToolClasses).toBeDefined();
    });

    it('should maintain type consistency across package boundaries', async () => {
      const coreModule = await import('../../../index.js');
      const webModule = await import('../index.js');

      // Same tool class should be exported
      expect(coreModule.WebSearchTool).toBe(webModule.WebSearchTool);

      // Should be able to create instances from both
      const coreInstance = new coreModule.WebSearchTool();
      const webInstance = new webModule.WebSearchTool();

      expect(coreInstance.constructor).toBe(webInstance.constructor);
      expect(coreInstance.name).toBe(webInstance.name);
      expect(coreInstance.category).toBe(webInstance.category);
    });
  });

  describe('Export Completeness', () => {
    it('should export all functions from register module', async () => {
      const webModule = await import('../index.js');
      const registerModule = await import('../register.js');

      // All register functions should be re-exported
      expect(webModule.registerWebTools).toBe(registerModule.registerWebTools);
      expect(webModule.registerWebToolsGlobal).toBe(registerModule.registerWebToolsGlobal);
      expect(webModule.registerWebSearchTool).toBe(registerModule.registerWebSearchTool);
      expect(webModule.createWebSearchTool).toBe(registerModule.createWebSearchTool);
      expect(webModule.webToolClasses).toBe(registerModule.webToolClasses);
      expect(webModule.webTools).toBe(registerModule.webTools);
    });

    it('should export all classes and types from web-search-tool module', async () => {
      const webModule = await import('../index.js');
      const webSearchModule = await import('../web-search-tool.js');

      // Tool class should be re-exported
      expect(webModule.WebSearchTool).toBe(webSearchModule.WebSearchTool);
    });
  });

  describe('Named vs Default Exports', () => {
    it('should use named exports consistently', async () => {
      const module = await import('../index.js');

      // Should not have default export
      expect(module.default).toBeUndefined();

      // All exports should be named
      const exports = Object.keys(module);
      expect(exports.length).toBeGreaterThan(0);

      // Key exports should be present
      expect(exports).toContain('WebSearchTool');
      expect(exports).toContain('registerWebTools');
      expect(exports).toContain('webToolClasses');
      expect(exports).toContain('webTools');
    });
  });

  describe('ESM Module Structure', () => {
    it('should work with destructuring imports', async () => {
      const { WebSearchTool, registerWebTools, webToolClasses } = await import('../index.js');

      expect(WebSearchTool).toBeDefined();
      expect(registerWebTools).toBeDefined();
      expect(webToolClasses).toBeDefined();

      // Should be able to create instances
      const tool = new WebSearchTool();
      expect(tool.name).toBe('WebSearch');
    });

    it('should work with namespace imports', async () => {
      const webTools = await import('../index.js');

      expect(webTools.WebSearchTool).toBeDefined();
      expect(webTools.registerWebTools).toBeDefined();
      expect(webTools.webToolClasses).toBeDefined();

      // Should be able to use through namespace
      const tool = new webTools.WebSearchTool();
      expect(tool.name).toBe('WebSearch');
    });
  });

  describe('Tree Shaking Support', () => {
    it('should allow selective imports', async () => {
      // Test that individual exports can be imported
      const { WebSearchTool } = await import('../index.js');
      expect(WebSearchTool).toBeDefined();

      const { registerWebTools } = await import('../index.js');
      expect(registerWebTools).toBeDefined();

      const { webToolClasses } = await import('../index.js');
      expect(webToolClasses).toBeDefined();
    });

    it('should not bundle unnecessary code when partially imported', async () => {
      // This is more of a build-time concern, but we can verify structure
      const module = await import('../index.js');

      // Each export should be independently accessible
      expect(typeof module.WebSearchTool).toBe('function');
      expect(typeof module.registerWebTools).toBe('function');
      expect(typeof module.createWebSearchTool).toBe('function');
    });
  });
});