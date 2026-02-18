/**
 * @fileoverview Registration tests for search tools
 *
 * Tests that search tools are properly registered with the tool registry:
 * - Registration function works correctly
 * - Tool classes are properly exported
 * - Tool instances are created correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../tool-registry.js';
import { registerSearchTools, searchToolClasses, searchTools } from '../register.js';
import { GrepTool } from '../grep-tool.js';

describe('Search Tools Registration', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    // Reset registry to ensure clean state
    ToolRegistry.resetInstance();
    registry = ToolRegistry.getInstance();
  });

  describe('registerSearchTools', () => {
    it('should register all search tools with the registry', () => {
      expect(registry.getTools()).toHaveLength(0); // Start with empty registry

      registerSearchTools(registry);

      const tools = registry.getTools();
      expect(tools.length).toBeGreaterThan(0);

      // Should include GrepTool
      const grepTool = tools.find(tool => tool.name === 'Grep');
      expect(grepTool).toBeDefined();
      expect(grepTool).toBeInstanceOf(GrepTool);
    });

    it('should be idempotent (safe to call multiple times)', () => {
      registerSearchTools(registry);
      const firstCount = registry.getTools().length;

      registerSearchTools(registry);
      const secondCount = registry.getTools().length;

      // Should not register duplicates
      expect(secondCount).toBe(firstCount);
    });
  });

  describe('searchToolClasses', () => {
    it('should export all search tool classes', () => {
      expect(searchToolClasses).toContain(GrepTool);
      expect(searchToolClasses.length).toBeGreaterThan(0);
    });

    it('should have all classes that are constructable', () => {
      for (const ToolClass of searchToolClasses) {
        expect(() => new ToolClass()).not.toThrow();
      }
    });
  });

  describe('searchTools', () => {
    it('should provide instances of all search tools', () => {
      expect(searchTools.length).toBe(searchToolClasses.length);

      for (let i = 0; i < searchTools.length; i++) {
        const tool = searchTools[i];
        const ToolClass = searchToolClasses[i];
        expect(tool).toBeInstanceOf(ToolClass);
      }
    });

    it('should include GrepTool instance', () => {
      const grepTool = searchTools.find(tool => tool.name === 'Grep');
      expect(grepTool).toBeDefined();
      expect(grepTool).toBeInstanceOf(GrepTool);
    });
  });

  describe('Tool Integration', () => {
    it('should allow registering individual search tools', () => {
      const grepTool = new GrepTool();

      registry.register(grepTool);

      expect(registry.get('Grep')).toBe(grepTool);
      expect(registry.has('Grep')).toBe(true);
    });

    it('should allow getting search tools by name after registration', () => {
      registerSearchTools(registry);

      const grepTool = registry.get('Grep');
      expect(grepTool).toBeDefined();
      expect(grepTool.name).toBe('Grep');
      expect(grepTool.category).toBe('search');
    });

    it('should list search tools with correct metadata', () => {
      registerSearchTools(registry);

      const tools = registry.list({ category: 'search' });
      expect(tools.length).toBeGreaterThan(0);

      const grepInfo = tools.find(info => info.name === 'Grep');
      expect(grepInfo).toBeDefined();
      expect(grepInfo?.category).toBe('search');
      expect(grepInfo?.description).toContain('search');
    });
  });
});