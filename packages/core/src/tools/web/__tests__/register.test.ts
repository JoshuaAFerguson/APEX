/**
 * @fileoverview Registration tests for web tools
 *
 * Tests that web tools are properly registered with the tool registry:
 * - Registration functions work correctly
 * - Tool classes are properly exported
 * - Tool instances are created correctly
 * - Integration with global registry works
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, getToolRegistry } from '../../tool-registry.js';
import {
  registerWebTools,
  registerWebToolsGlobal,
  registerWebSearchTool,
  createWebSearchTool,
  webToolClasses,
  webTools
} from '../register.js';
import { WebSearchTool, type WebSearchToolConfig } from '../web-search-tool.js';

describe('Web Tools Registration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    // Reset registry to ensure clean state
    ToolRegistry.resetInstance();
    registry = new ToolRegistry();
  });

  describe('registerWebTools', () => {
    it('should register all web tools with the registry', () => {
      expect(registry.getTools()).toHaveLength(0); // Start with empty registry

      registerWebTools(registry);

      const tools = registry.getTools();
      expect(tools.length).toBeGreaterThan(0);

      // Should include WebSearchTool
      const webSearchTool = tools.find(tool => tool.name === 'WebSearch');
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool).toBeInstanceOf(WebSearchTool);
    });

    it('should register tools with configuration when provided', () => {
      const config: WebSearchToolConfig = {
        allowedDomains: ['example.com'],
        blockedDomains: ['blocked.com'],
        maxResults: 10
      };

      registerWebTools(registry, config);

      const tools = registry.getTools();
      const webSearchTool = tools.find(tool => tool.name === 'WebSearch') as WebSearchTool;

      expect(webSearchTool).toBeDefined();
      expect(webSearchTool).toBeInstanceOf(WebSearchTool);
    });

    it('should handle duplicate registrations gracefully', () => {
      registerWebTools(registry);
      const firstCount = registry.getTools().length;

      // Attempt to register again - should handle duplicates
      expect(() => registerWebTools(registry)).toThrow(); // DuplicateToolError expected
    });
  });

  describe('registerWebToolsGlobal', () => {
    it('should register web tools with global registry', () => {
      // Reset global registry state
      ToolRegistry.resetInstance();

      registerWebToolsGlobal();

      const globalRegistry = getToolRegistry();
      const tools = globalRegistry.getTools();

      const webSearchTool = tools.find(tool => tool.name === 'WebSearch');
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool).toBeInstanceOf(WebSearchTool);
    });

    it('should register with configuration when provided', () => {
      ToolRegistry.resetInstance();

      const config: WebSearchToolConfig = {
        allowedDomains: ['example.org'],
        maxResults: 5
      };

      registerWebToolsGlobal(config);

      const globalRegistry = getToolRegistry();
      const tools = globalRegistry.getTools();
      const webSearchTool = tools.find(tool => tool.name === 'WebSearch');

      expect(webSearchTool).toBeDefined();
    });
  });

  describe('registerWebSearchTool', () => {
    it('should register WebSearchTool with the provided registry', () => {
      expect(registry.getTools()).toHaveLength(0);

      registerWebSearchTool(registry);

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);

      const webSearchTool = tools[0];
      expect(webSearchTool.name).toBe('WebSearch');
      expect(webSearchTool).toBeInstanceOf(WebSearchTool);
    });

    it('should register WebSearchTool with configuration', () => {
      const config: WebSearchToolConfig = {
        allowedDomains: ['trusted.com'],
        blockedDomains: ['untrusted.com'],
        maxResults: 8
      };

      registerWebSearchTool(registry, config);

      const tools = registry.getTools();
      expect(tools).toHaveLength(1);

      const webSearchTool = tools[0];
      expect(webSearchTool.name).toBe('WebSearch');
      expect(webSearchTool).toBeInstanceOf(WebSearchTool);
    });

    it('should throw on duplicate registration', () => {
      registerWebSearchTool(registry);

      expect(() => registerWebSearchTool(registry)).toThrow();
    });
  });

  describe('createWebSearchTool', () => {
    it('should create a new WebSearchTool instance', () => {
      const tool = createWebSearchTool();

      expect(tool).toBeInstanceOf(WebSearchTool);
      expect(tool.name).toBe('WebSearch');
      expect(tool.category).toBe('web');
    });

    it('should create WebSearchTool with configuration', () => {
      const config: WebSearchToolConfig = {
        allowedDomains: ['example.com'],
        maxResults: 15
      };

      const tool = createWebSearchTool(config);

      expect(tool).toBeInstanceOf(WebSearchTool);
      expect(tool.name).toBe('WebSearch');
    });

    it('should create independent instances', () => {
      const tool1 = createWebSearchTool();
      const tool2 = createWebSearchTool();

      expect(tool1).not.toBe(tool2);
      expect(tool1).toEqual(tool2);
    });
  });

  describe('webToolClasses', () => {
    it('should export all web tool classes', () => {
      expect(webToolClasses).toContain(WebSearchTool);
      expect(webToolClasses.length).toBe(1); // Currently only WebSearchTool
    });

    it('should have all classes that are constructable', () => {
      for (const ToolClass of webToolClasses) {
        expect(() => new ToolClass()).not.toThrow();
      }
    });

    it('should be readonly array', () => {
      expect(Object.isFrozen(webToolClasses)).toBe(true);
    });
  });

  describe('webTools', () => {
    it('should provide instances of all web tools', () => {
      expect(webTools.length).toBe(webToolClasses.length);

      for (let i = 0; i < webTools.length; i++) {
        const tool = webTools[i];
        const ToolClass = webToolClasses[i];
        expect(tool).toBeInstanceOf(ToolClass);
      }
    });

    it('should include WebSearchTool instance', () => {
      const webSearchTool = webTools.find(tool => tool.name === 'WebSearch');
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool).toBeInstanceOf(WebSearchTool);
    });

    it('should have consistent tool properties', () => {
      const webSearchTool = webTools.find(tool => tool.name === 'WebSearch')!;

      expect(webSearchTool.name).toBe('WebSearch');
      expect(webSearchTool.category).toBe('web');
      expect(webSearchTool.description).toBeTruthy();
      expect(Array.isArray(webSearchTool.permissions)).toBe(true);
    });
  });

  describe('Tool Integration', () => {
    it('should allow registering individual web tools', () => {
      const webSearchTool = new WebSearchTool();

      registry.register(webSearchTool);

      expect(registry.get('WebSearch')).toBe(webSearchTool);
      expect(registry.has('WebSearch')).toBe(true);
    });

    it('should allow getting web tools by name after registration', () => {
      registerWebTools(registry);

      const webSearchTool = registry.get('WebSearch');
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool.name).toBe('WebSearch');
      expect(webSearchTool.category).toBe('web');
    });

    it('should list web tools with correct metadata', () => {
      registerWebTools(registry);

      const tools = registry.list({ category: 'web' });
      expect(tools.length).toBeGreaterThan(0);

      const webSearchInfo = tools.find(info => info.name === 'WebSearch');
      expect(webSearchInfo).toBeDefined();
      expect(webSearchInfo?.category).toBe('web');
      expect(webSearchInfo?.description).toContain('search');
    });

    it('should support bulk registration and querying', () => {
      registerWebTools(registry);

      const allTools = registry.getTools();
      const webTools = allTools.filter(tool => tool.category === 'web');

      expect(webTools.length).toBe(1); // Currently only WebSearchTool

      const webSearchTool = webTools[0];
      expect(webSearchTool.name).toBe('WebSearch');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid registry gracefully', () => {
      // @ts-expect-error Testing invalid input
      expect(() => registerWebTools(null)).toThrow();
      // @ts-expect-error Testing invalid input
      expect(() => registerWebSearchTool(undefined)).toThrow();
    });

    it('should validate configuration parameters', () => {
      // Invalid configuration should not crash the registration
      const invalidConfig = {
        // @ts-expect-error Testing invalid config
        maxResults: 'invalid',
        allowedDomains: null
      };

      // Should either work with defaults or throw meaningful error
      expect(() => {
        createWebSearchTool(invalidConfig as any);
      }).not.toThrow(); // Tool should handle invalid config gracefully
    });
  });

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types', () => {
      const tool = createWebSearchTool();

      // Type checks that should compile correctly
      expect(tool.name).toBe('WebSearch');
      expect(typeof tool.execute).toBe('function');
      expect(typeof tool.validate).toBe('function');
    });

    it('should work with registry type system', () => {
      const tool = createWebSearchTool();
      registry.register(tool);

      const retrieved = registry.get('WebSearch');
      expect(retrieved).toBe(tool);

      // Should maintain tool interface
      expect(typeof retrieved.execute).toBe('function');
    });
  });
});