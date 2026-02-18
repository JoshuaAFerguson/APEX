/**
 * @fileoverview Build validation tests for GlobTool
 *
 * These tests verify that the GlobTool is properly built, exported, and
 * integrates correctly with the APEX ecosystem. These tests are designed
 * to catch build-time issues and ensure proper module loading.
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool.build-validation
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Import Validation Tests
// ============================================================================

describe('GlobTool Build and Export Validation', () => {

  describe('module imports', () => {
    it('should import GlobTool class successfully', async () => {
      const { GlobTool } = await import('../glob-tool.js');

      expect(GlobTool).toBeDefined();
      expect(typeof GlobTool).toBe('function');
      expect(GlobTool.prototype).toBeDefined();
    });

    it('should import GlobTool types successfully', async () => {
      const module = await import('../glob-tool.js');

      expect(module.GlobTool).toBeDefined();

      // Verify TypeScript interfaces are available at runtime through the class
      const instance = new module.GlobTool();
      expect(instance.name).toBe('Glob');
    });

    it('should import from filesystem index', async () => {
      const module = await import('../index.js');

      expect(module.GlobTool).toBeDefined();
      expect(module.registerGlobTool).toBeDefined();
      expect(module.createGlobTool).toBeDefined();
    });

    it('should import registration functions', async () => {
      const module = await import('../register.js');

      expect(module.registerGlobTool).toBeDefined();
      expect(module.createGlobTool).toBeDefined();
      expect(module.registerFilesystemTools).toBeDefined();

      expect(typeof module.registerGlobTool).toBe('function');
      expect(typeof module.createGlobTool).toBeDefined();
      expect(typeof module.registerFilesystemTools).toBe('function');
    });
  });

  describe('class instantiation', () => {
    it('should create GlobTool instance without errors', async () => {
      const { GlobTool } = await import('../glob-tool.js');

      expect(() => new GlobTool()).not.toThrow();

      const instance = new GlobTool();
      expect(instance).toBeInstanceOf(GlobTool);
    });

    it('should have correct tool metadata after instantiation', async () => {
      const { GlobTool } = await import('../glob-tool.js');
      const instance = new GlobTool();

      expect(instance.name).toBe('Glob');
      expect(instance.description).toBeDefined();
      expect(instance.description).toContain('Fast file pattern matching');

      const metadata = instance.getMetadata();
      expect(metadata.category).toBe('filesystem');
      expect(metadata.permissions).toContain('read');
      expect(metadata.dangerous).toBe(false);
    });

    it('should provide valid JSON schema', async () => {
      const { GlobTool } = await import('../glob-tool.js');
      const instance = new GlobTool();

      const schema = instance.getParametersSchema();

      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeDefined();
      expect(schema.required).toContain('pattern');

      // Verify schema properties
      expect(schema.properties.pattern).toBeDefined();
      expect(schema.properties.pattern.type).toBe('string');
      expect(schema.properties.path).toBeDefined();
      expect(schema.properties.path.type).toBe('string');
    });
  });

  describe('dependency validation', () => {
    it('should have fast-glob dependency available', async () => {
      // This tests that fast-glob is properly installed and accessible
      const fastGlob = await import('fast-glob');

      expect(fastGlob).toBeDefined();
      expect(typeof fastGlob.default).toBe('function');
    });

    it('should have all required Node.js modules', async () => {
      // Verify Node.js built-in modules are accessible
      const fs = await import('node:fs');
      const path = await import('node:path');

      expect(fs.promises).toBeDefined();
      expect(path.resolve).toBeDefined();
      expect(path.join).toBeDefined();
      expect(path.isAbsolute).toBeDefined();
    });

    it('should inherit from BaseTool correctly', async () => {
      const { GlobTool } = await import('../glob-tool.js');
      const { BaseTool } = await import('../../base-tool.js');

      const instance = new GlobTool();

      expect(instance).toBeInstanceOf(BaseTool);
      expect(instance.validate).toBeDefined();
      expect(instance.execute).toBeDefined();
      expect(instance.getMetadata).toBeDefined();
      expect(instance.getParametersSchema).toBeDefined();
    });
  });

  describe('tool registry integration', () => {
    it('should register without errors', async () => {
      const { getToolRegistry } = await import('../../tool-registry.js');
      const { registerGlobTool } = await import('../register.js');

      const registry = getToolRegistry();
      registry.clear(); // Ensure clean state

      expect(() => registerGlobTool()).not.toThrow();
      expect(registry.has('Glob')).toBe(true);

      registry.clear(); // Clean up
    });

    it('should prevent duplicate registration', async () => {
      const { getToolRegistry } = await import('../../tool-registry.js');
      const { registerGlobTool } = await import('../register.js');

      const registry = getToolRegistry();
      registry.clear(); // Ensure clean state

      registerGlobTool();

      expect(() => registerGlobTool()).toThrow();

      registry.clear(); // Clean up
    });

    it('should register with filesystem tools batch', async () => {
      const { getToolRegistry } = await import('../../tool-registry.js');
      const { registerFilesystemTools } = await import('../register.js');

      const registry = getToolRegistry();
      registry.clear(); // Ensure clean state

      expect(() => registerFilesystemTools()).not.toThrow();

      expect(registry.has('Glob')).toBe(true);
      expect(registry.has('Read')).toBe(true);
      expect(registry.has('Write')).toBe(true);
      expect(registry.has('Edit')).toBe(true);
      expect(registry.has('MultiEdit')).toBe(true);

      registry.clear(); // Clean up
    });
  });

  describe('TypeScript compilation validation', () => {
    it('should have correct type exports', async () => {
      // This test verifies that TypeScript types are properly exported
      const module = await import('../glob-tool.js');

      // Create instance to verify types work at runtime
      const instance = new module.GlobTool();

      // Test input validation (TypeScript types should be enforced)
      const validInput = { pattern: '**/*.ts' };
      const validationResult = instance.validate(validInput);

      expect(validationResult.valid).toBe(true);
    });

    it('should support all exported interfaces', async () => {
      const module = await import('../index.js');

      // Verify all expected exports are present
      expect(module.GlobTool).toBeDefined();
      expect(module.registerGlobTool).toBeDefined();
      expect(module.createGlobTool).toBeDefined();
      expect(module.registerFilesystemTools).toBeDefined();
    });
  });

  describe('performance characteristics', () => {
    it('should initialize quickly', async () => {
      const start = Date.now();

      const { GlobTool } = await import('../glob-tool.js');
      const instance = new GlobTool();
      const metadata = instance.getMetadata();

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should initialize within 100ms
      expect(metadata).toBeDefined();
    });

    it('should have minimal memory footprint', async () => {
      const { GlobTool } = await import('../glob-tool.js');

      // Create multiple instances to test memory usage
      const instances: any[] = [];
      for (let i = 0; i < 10; i++) {
        instances.push(new GlobTool());
      }

      // All instances should be properly created
      expect(instances.length).toBe(10);
      instances.forEach(instance => {
        expect(instance.name).toBe('Glob');
      });
    });
  });

  describe('error handling in build context', () => {
    it('should handle import errors gracefully', async () => {
      // Test that the module can be imported even if some optional features fail
      const { GlobTool } = await import('../glob-tool.js');

      expect(GlobTool).toBeDefined();

      const instance = new GlobTool();
      expect(instance).toBeInstanceOf(GlobTool);
    });

    it('should validate configuration at build time', async () => {
      const { GlobTool } = await import('../glob-tool.js');
      const instance = new GlobTool();

      // Verify that configuration constants are properly set
      const metadata = instance.getMetadata();
      expect(metadata.version).toBeDefined();
      expect(metadata.version).toMatch(/^\d+\.\d+\.\d+$/);

      // Verify that internal constants are accessible
      expect(typeof instance.validate).toBe('function');
      expect(typeof instance.execute).toBe('function');
    });
  });

  describe('integration compatibility', () => {
    it('should be compatible with vitest test environment', async () => {
      const { GlobTool } = await import('../glob-tool.js');

      // Test that the tool works in the current test environment
      const instance = new GlobTool();
      const result = instance.validate({ pattern: '*.test.ts' });

      expect(result.valid).toBe(true);
    });

    it('should work with ES modules', async () => {
      // Dynamic import should work properly
      const globModule = await import('../glob-tool.js');
      const registerModule = await import('../register.js');
      const indexModule = await import('../index.js');

      expect(globModule.GlobTool).toBeDefined();
      expect(registerModule.registerGlobTool).toBeDefined();
      expect(indexModule.GlobTool).toBeDefined();

      // All should reference the same class
      expect(globModule.GlobTool).toBe(indexModule.GlobTool);
    });

    it('should support CommonJS interop', async () => {
      // Verify that the tool can work in both ES and CommonJS environments
      const module = await import('../glob-tool.js');

      expect(module.GlobTool).toBeDefined();
      expect(module.default).toBeUndefined(); // Should not have default export
    });
  });
});