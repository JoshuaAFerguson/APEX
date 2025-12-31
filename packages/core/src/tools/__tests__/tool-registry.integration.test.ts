/**
 * @fileoverview Integration tests for ToolRegistry with core APEX types
 *
 * These tests verify that ToolRegistry integrates correctly with the existing
 * APEX type system and core functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { ToolInterface, ToolExecutionContext, ValidationResult } from '../base-tool.js';
import { BaseTool } from '../base-tool.js';
import type { ToolDefinition, ToolCategory, ToolRegistryEntry } from '../../types.js';
import { ToolRegistryEntrySchema, ToolDefinitionSchema } from '../../types.js';
import { ToolRegistry } from '../tool-registry.js';

// ============================================================================
// Concrete Tool Implementation for Integration Testing
// ============================================================================

/**
 * Example file reader tool for testing registry integration
 */
class TestFileReaderTool extends BaseTool<{ path: string; encoding?: string }, { content: string; size: number }> {
  constructor() {
    super({
      name: 'TestFileReader',
      description: 'Reads file content for testing',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
          encoding: {
            type: 'string',
            description: 'File encoding',
            enum: ['utf8', 'ascii', 'binary'],
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
      permissions: ['read'],
      version: '1.0.0',
      tags: ['filesystem', 'io'],
    });
  }

  protected async executeImpl(
    params: { path: string; encoding?: string },
    context?: ToolExecutionContext
  ): Promise<{ content: string; size: number }> {
    // Mock implementation for testing
    return {
      content: `Mock content of ${params.path}`,
      size: params.path.length * 10, // Mock size calculation
    };
  }
}

/**
 * Example shell command tool for testing
 */
class TestShellTool extends BaseTool<{ command: string; timeout?: number }, { output: string; exitCode: number }> {
  constructor() {
    super({
      name: 'TestShell',
      description: 'Executes shell commands for testing',
      category: 'shell',
      dangerous: true,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to execute',
            minLength: 1,
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds',
            minimum: 0,
            maximum: 300000,
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
      permissions: ['execute'],
      version: '2.1.0',
    });
  }

  protected async executeImpl(
    params: { command: string; timeout?: number },
    context?: ToolExecutionContext
  ): Promise<{ output: string; exitCode: number }> {
    // Mock implementation for testing
    return {
      output: `Mock output for: ${params.command}`,
      exitCode: 0,
    };
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('ToolRegistry Integration Tests', () => {
  let registry: ToolRegistry;
  let fileReaderTool: TestFileReaderTool;
  let shellTool: TestShellTool;

  beforeEach(() => {
    ToolRegistry.resetInstance();
    registry = ToolRegistry.getInstance();
    fileReaderTool = new TestFileReaderTool();
    shellTool = new TestShellTool();
  });

  // ==========================================================================
  // Type System Integration
  // ==========================================================================

  describe('Type System Integration', () => {
    it('should register tools that conform to APEX type schemas', () => {
      registry.register(fileReaderTool);
      registry.register(shellTool);

      const fileReaderEntry = registry.get('TestFileReader');
      const shellEntry = registry.get('TestShell');

      // Verify entries conform to ToolRegistryEntry schema
      expect(() => ToolRegistryEntrySchema.parse(fileReaderEntry)).not.toThrow();
      expect(() => ToolRegistryEntrySchema.parse(shellEntry)).not.toThrow();

      // Verify definitions conform to ToolDefinition schema
      expect(() => ToolDefinitionSchema.parse(fileReaderEntry.definition)).not.toThrow();
      expect(() => ToolDefinitionSchema.parse(shellEntry.definition)).not.toThrow();
    });

    it('should handle all supported tool categories correctly', () => {
      const categories: Array<{ category: ToolCategory; toolName: string }> = [
        { category: 'filesystem', toolName: 'FileSystemTool' },
        { category: 'search', toolName: 'SearchTool' },
        { category: 'shell', toolName: 'ShellTool' },
        { category: 'web', toolName: 'WebTool' },
        { category: 'system', toolName: 'SystemTool' },
        { category: 'custom', toolName: 'CustomTool' },
      ];

      categories.forEach(({ category, toolName }) => {
        const tool = new TestFileReaderTool();
        // Override the category for testing
        tool.getDefinition = () => ({
          ...fileReaderTool.getDefinition(),
          name: toolName,
          category,
        });

        expect(() => registry.register(tool)).not.toThrow();

        const categoryTools = registry.getByCategory(category);
        expect(categoryTools.length).toBe(1);
        expect(categoryTools[0].definition.name).toBe(toolName);

        registry.unregister(toolName);
      });
    });

    it('should validate tool permissions correctly', () => {
      registry.register(fileReaderTool);
      registry.register(shellTool);

      const fileEntry = registry.get('TestFileReader');
      const shellEntry = registry.get('TestShell');

      expect(fileEntry.definition.permissions).toContain('read');
      expect(shellEntry.definition.permissions).toContain('execute');
      expect(shellEntry.definition.dangerous).toBe(true);
      expect(fileEntry.definition.dangerous).toBe(false);
    });

    it('should handle complex parameter schemas', () => {
      const complexTool = new TestFileReaderTool();
      complexTool.getDefinition = () => ({
        name: 'ComplexTool',
        description: 'Tool with complex parameters',
        category: 'custom',
        parameters: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                retries: { type: 'integer', minimum: 0, maximum: 10 },
                timeout: { type: 'number', minimum: 0 },
                enabled: { type: 'boolean' },
              },
              required: ['retries'],
              additionalProperties: false,
            },
            modes: {
              type: 'array',
              items: { type: 'string', enum: ['fast', 'normal', 'thorough'] },
            },
          },
          required: ['config'],
          additionalProperties: false,
        },
      });

      expect(() => registry.register(complexTool)).not.toThrow();

      const entry = registry.get('ComplexTool');
      expect(entry.definition.parameters.properties).toBeDefined();
      expect(entry.definition.parameters.properties.config).toBeDefined();
      expect(entry.definition.parameters.properties.modes).toBeDefined();
    });
  });

  // ==========================================================================
  // BaseTool Integration
  // ==========================================================================

  describe('BaseTool Integration', () => {
    it('should work seamlessly with BaseTool subclasses', async () => {
      registry.register(fileReaderTool);

      const toolInterface = registry.getToolInterface('TestFileReader');
      expect(toolInterface).toBe(fileReaderTool);

      // Test execution through the registry
      const result = await toolInterface.execute({ path: '/test/file.txt' });
      expect(result.success).toBe(true);
      expect(result.output?.content).toContain('/test/file.txt');
      expect(result.toolName).toBe('TestFileReader');
    });

    it('should handle tool validation through BaseTool', () => {
      registry.register(fileReaderTool);

      const toolInterface = registry.getToolInterface('TestFileReader');

      // Test valid parameters
      const validResult = toolInterface.validate({ path: '/valid/path' });
      expect(validResult.valid).toBe(true);

      // Test invalid parameters - missing required field
      const invalidResult = toolInterface.validate({} as any);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Missing required parameter: path');
    });

    it('should track tool statistics after execution', async () => {
      registry.register(fileReaderTool);

      const initialEntry = registry.get('TestFileReader');
      expect(initialEntry.invocationCount).toBe(0);
      expect(initialEntry.successCount).toBe(0);
      expect(initialEntry.lastInvoked).toBeUndefined();

      // Record a successful invocation
      registry.recordInvocation('TestFileReader', true);

      const afterEntry = registry.get('TestFileReader');
      expect(afterEntry.invocationCount).toBe(1);
      expect(afterEntry.successCount).toBe(1);
      expect(afterEntry.failureCount).toBe(0);
      expect(afterEntry.lastInvoked).toBeInstanceOf(Date);
    });
  });

  // ==========================================================================
  // Real-world Scenario Tests
  // ==========================================================================

  describe('Real-world Scenarios', () => {
    it('should handle tool orchestration scenario', () => {
      // Register multiple tools that might be used together
      registry.register(fileReaderTool);
      registry.register(shellTool);

      // Simulate agent workflow requiring different tool categories
      const filesystemTools = registry.getByCategory('filesystem');
      const shellTools = registry.getByCategory('shell');

      expect(filesystemTools.length).toBe(1);
      expect(shellTools.length).toBe(1);
      expect(filesystemTools[0].definition.name).toBe('TestFileReader');
      expect(shellTools[0].definition.name).toBe('TestShell');

      // Check available tools for agent selection
      const availableTools = registry.getAvailable();
      expect(availableTools.length).toBe(2);
    });

    it('should handle tool availability changes during execution', () => {
      registry.register(fileReaderTool);
      registry.register(shellTool);

      // Initially both tools are available
      expect(registry.getAvailable().length).toBe(2);

      // Simulate shell tool becoming unavailable due to security restrictions
      registry.setAvailability('TestShell', false, 'Security policy violation');

      const availableTools = registry.getAvailable();
      expect(availableTools.length).toBe(1);
      expect(availableTools[0].definition.name).toBe('TestFileReader');

      const shellEntry = registry.get('TestShell');
      expect(shellEntry.available).toBe(false);
      expect(shellEntry.unavailableReason).toBe('Security policy violation');
    });

    it('should support dynamic tool management during runtime', () => {
      // Start with no tools
      expect(registry.size).toBe(0);

      // Add tools dynamically
      registry.register(fileReaderTool);
      expect(registry.getNames()).toEqual(['TestFileReader']);

      registry.register(shellTool);
      expect(registry.getNames().sort()).toEqual(['TestFileReader', 'TestShell']);

      // Remove tools dynamically
      registry.unregister('TestFileReader');
      expect(registry.getNames()).toEqual(['TestShell']);

      // Clear all tools
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.getNames()).toEqual([]);
    });

    it('should provide comprehensive tool metadata for agent planning', () => {
      registry.register(fileReaderTool);
      registry.register(shellTool);

      const definitions = registry.getDefinitions();
      expect(definitions.length).toBe(2);

      definitions.forEach(definition => {
        expect(definition).toHaveProperty('name');
        expect(definition).toHaveProperty('description');
        expect(definition).toHaveProperty('category');
        expect(definition).toHaveProperty('parameters');
        expect(definition).toHaveProperty('permissions');
        expect(definition).toHaveProperty('version');

        // Verify the definition has all required Claude Agent SDK fields
        expect(typeof definition.name).toBe('string');
        expect(typeof definition.description).toBe('string');
        expect(definition.parameters.type).toBe('object');
      });

      // Verify dangerous tool flagging
      const dangerousTool = definitions.find(d => d.dangerous);
      expect(dangerousTool?.name).toBe('TestShell');

      const safeTool = definitions.find(d => !d.dangerous);
      expect(safeTool?.name).toBe('TestFileReader');
    });
  });

  // ==========================================================================
  // Error Handling Integration
  // ==========================================================================

  describe('Error Handling Integration', () => {
    it('should maintain registry consistency after errors', () => {
      registry.register(fileReaderTool);
      expect(registry.size).toBe(1);

      // Try to register duplicate tool
      try {
        registry.register(new TestFileReaderTool());
      } catch (error) {
        // Registry should remain consistent
        expect(registry.size).toBe(1);
        expect(registry.has('TestFileReader')).toBe(true);
      }

      // Try to unregister non-existent tool
      try {
        registry.unregister('NonExistentTool');
      } catch (error) {
        // Registry should remain consistent
        expect(registry.size).toBe(1);
        expect(registry.has('TestFileReader')).toBe(true);
      }
    });

    it('should handle event listener errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add a listener that throws an error
      registry.on('tool:registered', () => {
        throw new Error('Listener error');
      });

      // Registration should still succeed despite listener error
      expect(() => registry.register(fileReaderTool)).not.toThrow();
      expect(registry.has('TestFileReader')).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Performance and Scale Testing
  // ==========================================================================

  describe('Performance and Scale', () => {
    it('should handle rapid registration/unregistration cycles', () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const tool = new TestFileReaderTool();
        tool.getDefinition = () => ({
          ...fileReaderTool.getDefinition(),
          name: `Tool${i}`,
        });

        registry.register(tool);
        expect(registry.has(`Tool${i}`)).toBe(true);

        registry.unregister(`Tool${i}`);
        expect(registry.has(`Tool${i}`)).toBe(false);
      }

      expect(registry.size).toBe(0);
    });

    it('should maintain performance with many tools and events', () => {
      const toolCount = 500;
      const eventCalls: any[] = [];

      // Add event listener to track all events
      registry.on('tool:registered', (data) => eventCalls.push(data));

      // Register many tools
      for (let i = 0; i < toolCount; i++) {
        const tool = new TestFileReaderTool();
        tool.getDefinition = () => ({
          ...fileReaderTool.getDefinition(),
          name: `Tool${i}`,
          category: i % 2 === 0 ? 'filesystem' : 'custom',
        });

        registry.register(tool);
      }

      expect(registry.size).toBe(toolCount);
      expect(eventCalls.length).toBe(toolCount);

      // Test category filtering performance
      const filesystemTools = registry.getByCategory('filesystem');
      const customTools = registry.getByCategory('custom');

      expect(filesystemTools.length + customTools.length).toBe(toolCount);
      expect(filesystemTools.length).toBeGreaterThan(200); // Roughly half
      expect(customTools.length).toBeGreaterThan(200); // Roughly half
    });
  });
});