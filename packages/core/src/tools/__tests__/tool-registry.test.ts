/**
 * @fileoverview Comprehensive unit tests for ToolRegistry class
 *
 * Tests cover:
 * - Singleton pattern implementation
 * - Core registry methods (register, unregister, get, getAll, getByCategory, has)
 * - Error handling for duplicate registrations and unknown tools
 * - Event system and listener management
 * - Tool validation and utility methods
 * - Edge cases and boundary conditions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolInterface, ToolExecutionContext, ValidationResult } from '../base-tool.js';
import type { ToolDefinition, ToolCategory } from '../../types.js';
import {
  ToolRegistry,
  DuplicateToolError,
  ToolNotFoundError,
  ToolValidationError,
  getToolRegistry,
  registerTool,
  unregisterTool,
} from '../tool-registry.js';

// ============================================================================
// Mock Tool Implementations
// ============================================================================

/**
 * Mock tool for testing basic functionality
 */
class MockTool implements ToolInterface<{ input: string }, string> {
  constructor(
    private name: string = 'MockTool',
    private category: ToolCategory = 'custom',
    private enabled: boolean = true
  ) {}

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: 'A mock tool for testing',
      category: this.category,
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Input string',
          },
        },
        required: ['input'],
        additionalProperties: false,
      },
      enabled: this.enabled,
      version: '1.0.0',
      tags: ['test', 'mock'],
    };
  }

  validate(params: { input: string }): ValidationResult {
    const errors: string[] = [];
    if (!params.input) {
      errors.push('Input is required');
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async execute(params: { input: string }): Promise<any> {
    return {
      success: true,
      output: `Mock output: ${params.input}`,
      toolName: this.name,
      invokedAt: new Date(),
      completedAt: new Date(),
    };
  }
}

/**
 * Mock tool with invalid definition for validation tests
 */
class InvalidMockTool implements ToolInterface {
  getDefinition(): ToolDefinition {
    return {
      name: '', // Invalid: empty name
      description: '', // Invalid: empty description
      category: 'invalid' as ToolCategory, // Invalid: bad category
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      version: 'invalid-version', // Invalid: not semver
    };
  }

  validate(): ValidationResult {
    return { valid: true };
  }

  async execute(): Promise<any> {
    return { success: true, output: 'test' };
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a fresh ToolRegistry instance for each test
 */
function createFreshRegistry(): ToolRegistry {
  ToolRegistry.resetInstance();
  return ToolRegistry.getInstance();
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockTool: MockTool;

  beforeEach(() => {
    // Reset singleton and create fresh instances
    registry = createFreshRegistry();
    mockTool = new MockTool();
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = ToolRegistry.getInstance();
      const instance2 = ToolRegistry.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(registry);
    });

    it('should only use options on first instantiation', () => {
      ToolRegistry.resetInstance();

      const instance1 = ToolRegistry.getInstance({ allowOverwrite: true });
      const instance2 = ToolRegistry.getInstance({ allowOverwrite: false });

      expect(instance1).toBe(instance2);

      // Test that first options were used (allowOverwrite: true)
      const tool1 = new MockTool('Tool1');
      const tool2 = new MockTool('Tool1'); // Same name

      instance1.register(tool1);
      expect(() => instance1.register(tool2)).not.toThrow(); // Should allow overwrite
    });

    it('should reset instance correctly', () => {
      const instance1 = ToolRegistry.getInstance();
      instance1.register(mockTool);

      ToolRegistry.resetInstance();
      const instance2 = ToolRegistry.getInstance();

      expect(instance2).not.toBe(instance1);
      expect(instance2.size).toBe(0); // Should be empty
    });
  });

  // ==========================================================================
  // Core Registry Methods Tests
  // ==========================================================================

  describe('Core Registry Methods', () => {
    describe('register()', () => {
      it('should register a tool successfully', () => {
        expect(() => registry.register(mockTool)).not.toThrow();
        expect(registry.has('MockTool')).toBe(true);
        expect(registry.size).toBe(1);
      });

      it('should throw DuplicateToolError for duplicate registrations', () => {
        registry.register(mockTool);
        const duplicateTool = new MockTool('MockTool');

        expect(() => registry.register(duplicateTool)).toThrow(DuplicateToolError);
        expect(() => registry.register(duplicateTool)).toThrow(
          "Tool 'MockTool' is already registered. Use unregister() first to replace it."
        );
      });

      it('should allow overwrite when allowOverwrite is true', () => {
        ToolRegistry.resetInstance();
        const overwriteRegistry = ToolRegistry.getInstance({ allowOverwrite: true });

        const tool1 = new MockTool('TestTool');
        const tool2 = new MockTool('TestTool');

        overwriteRegistry.register(tool1);
        expect(() => overwriteRegistry.register(tool2)).not.toThrow();
        expect(overwriteRegistry.size).toBe(1);
      });

      it('should validate tool definition when validateOnRegister is true', () => {
        const invalidTool = new InvalidMockTool();

        expect(() => registry.register(invalidTool)).toThrow(ToolValidationError);
        expect(() => registry.register(invalidTool)).toThrow(/Tool validation failed/);
      });

      it('should skip validation when validateOnRegister is false', () => {
        ToolRegistry.resetInstance();
        const noValidationRegistry = ToolRegistry.getInstance({ validateOnRegister: false });

        const invalidTool = new InvalidMockTool();
        expect(() => noValidationRegistry.register(invalidTool)).not.toThrow();
      });

      it('should set correct registry entry properties', () => {
        registry.register(mockTool);
        const entry = registry.get('MockTool');

        expect(entry.definition).toEqual(mockTool.getDefinition());
        expect(entry.available).toBe(true);
        expect(entry.unavailableReason).toBeUndefined();
        expect(entry.lastInvoked).toBeUndefined();
        expect(entry.invocationCount).toBe(0);
        expect(entry.successCount).toBe(0);
        expect(entry.failureCount).toBe(0);
      });

      it('should handle disabled tools correctly', () => {
        const disabledTool = new MockTool('DisabledTool', 'custom', false);
        registry.register(disabledTool);

        const entry = registry.get('DisabledTool');
        expect(entry.available).toBe(false);
      });
    });

    describe('unregister()', () => {
      it('should unregister an existing tool', () => {
        registry.register(mockTool);
        expect(registry.has('MockTool')).toBe(true);

        expect(() => registry.unregister('MockTool')).not.toThrow();
        expect(registry.has('MockTool')).toBe(false);
        expect(registry.size).toBe(0);
      });

      it('should throw ToolNotFoundError for non-existent tool', () => {
        expect(() => registry.unregister('NonExistentTool')).toThrow(ToolNotFoundError);
        expect(() => registry.unregister('NonExistentTool')).toThrow(
          "Tool 'NonExistentTool' is not registered."
        );
      });
    });

    describe('get()', () => {
      it('should return correct registry entry for existing tool', () => {
        registry.register(mockTool);
        const entry = registry.get('MockTool');

        expect(entry.definition.name).toBe('MockTool');
        expect(entry.definition.description).toBe('A mock tool for testing');
        expect(entry.available).toBe(true);
      });

      it('should throw ToolNotFoundError for non-existent tool', () => {
        expect(() => registry.get('NonExistentTool')).toThrow(ToolNotFoundError);
      });
    });

    describe('getToolInterface()', () => {
      it('should return correct tool interface', () => {
        registry.register(mockTool);
        const toolInterface = registry.getToolInterface('MockTool');

        expect(toolInterface).toBe(mockTool);
        expect(toolInterface.getDefinition().name).toBe('MockTool');
      });

      it('should throw ToolNotFoundError for non-existent tool', () => {
        expect(() => registry.getToolInterface('NonExistentTool')).toThrow(ToolNotFoundError);
      });
    });

    describe('has()', () => {
      it('should return true for registered tool', () => {
        registry.register(mockTool);
        expect(registry.has('MockTool')).toBe(true);
      });

      it('should return false for unregistered tool', () => {
        expect(registry.has('NonExistentTool')).toBe(false);
      });
    });

    describe('getAll()', () => {
      it('should return empty array when no tools are registered', () => {
        const allTools = registry.getAll();
        expect(allTools).toEqual([]);
        expect(allTools.length).toBe(0);
      });

      it('should return all registered tools', () => {
        const tool1 = new MockTool('Tool1', 'filesystem');
        const tool2 = new MockTool('Tool2', 'search');

        registry.register(tool1);
        registry.register(tool2);

        const allTools = registry.getAll();
        expect(allTools.length).toBe(2);

        const toolNames = allTools.map(entry => entry.definition.name);
        expect(toolNames).toContain('Tool1');
        expect(toolNames).toContain('Tool2');
      });
    });

    describe('getByCategory()', () => {
      it('should return tools matching the specified category', () => {
        const filesystemTool = new MockTool('FileSystemTool', 'filesystem');
        const searchTool = new MockTool('SearchTool', 'search');
        const anotherFilesystemTool = new MockTool('AnotherFileSystemTool', 'filesystem');

        registry.register(filesystemTool);
        registry.register(searchTool);
        registry.register(anotherFilesystemTool);

        const filesystemTools = registry.getByCategory('filesystem');
        expect(filesystemTools.length).toBe(2);

        const filesystemNames = filesystemTools.map(entry => entry.definition.name);
        expect(filesystemNames).toContain('FileSystemTool');
        expect(filesystemNames).toContain('AnotherFileSystemTool');
        expect(filesystemNames).not.toContain('SearchTool');
      });

      it('should return empty array for category with no tools', () => {
        const customTool = new MockTool('CustomTool', 'custom');
        registry.register(customTool);

        const webTools = registry.getByCategory('web');
        expect(webTools).toEqual([]);
        expect(webTools.length).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Utility Methods Tests
  // ==========================================================================

  describe('Utility Methods', () => {
    beforeEach(() => {
      const tool1 = new MockTool('Tool1', 'filesystem');
      const tool2 = new MockTool('Tool2', 'search', false); // disabled
      registry.register(tool1);
      registry.register(tool2);
    });

    describe('size', () => {
      it('should return correct number of registered tools', () => {
        expect(registry.size).toBe(2);

        const tool3 = new MockTool('Tool3');
        registry.register(tool3);
        expect(registry.size).toBe(3);

        registry.unregister('Tool1');
        expect(registry.size).toBe(2);
      });
    });

    describe('getNames()', () => {
      it('should return array of all tool names', () => {
        const names = registry.getNames();
        expect(names.sort()).toEqual(['Tool1', 'Tool2']);
      });
    });

    describe('getAvailable()', () => {
      it('should return only available tools', () => {
        const availableTools = registry.getAvailable();
        expect(availableTools.length).toBe(1);
        expect(availableTools[0].definition.name).toBe('Tool1');
        expect(availableTools[0].available).toBe(true);
      });
    });

    describe('getDefinitions()', () => {
      it('should return array of tool definitions', () => {
        const definitions = registry.getDefinitions();
        expect(definitions.length).toBe(2);

        const definitionNames = definitions.map(def => def.name);
        expect(definitionNames.sort()).toEqual(['Tool1', 'Tool2']);

        definitions.forEach(def => {
          expect(def).toHaveProperty('name');
          expect(def).toHaveProperty('description');
          expect(def).toHaveProperty('category');
          expect(def).toHaveProperty('parameters');
        });
      });
    });

    describe('setAvailability()', () => {
      it('should update tool availability', () => {
        expect(registry.get('Tool1').available).toBe(true);

        registry.setAvailability('Tool1', false, 'Test reason');

        const entry = registry.get('Tool1');
        expect(entry.available).toBe(false);
        expect(entry.unavailableReason).toBe('Test reason');
      });

      it('should clear unavailable reason when setting available', () => {
        registry.setAvailability('Tool1', false, 'Test reason');
        expect(registry.get('Tool1').unavailableReason).toBe('Test reason');

        registry.setAvailability('Tool1', true);

        const entry = registry.get('Tool1');
        expect(entry.available).toBe(true);
        expect(entry.unavailableReason).toBeUndefined();
      });

      it('should throw ToolNotFoundError for non-existent tool', () => {
        expect(() =>
          registry.setAvailability('NonExistentTool', false)
        ).toThrow(ToolNotFoundError);
      });
    });

    describe('recordInvocation()', () => {
      it('should record successful invocation', () => {
        const beforeEntry = registry.get('Tool1');
        expect(beforeEntry.invocationCount).toBe(0);
        expect(beforeEntry.successCount).toBe(0);
        expect(beforeEntry.lastInvoked).toBeUndefined();

        registry.recordInvocation('Tool1', true);

        const afterEntry = registry.get('Tool1');
        expect(afterEntry.invocationCount).toBe(1);
        expect(afterEntry.successCount).toBe(1);
        expect(afterEntry.failureCount).toBe(0);
        expect(afterEntry.lastInvoked).toBeInstanceOf(Date);
      });

      it('should record failed invocation', () => {
        registry.recordInvocation('Tool1', false);

        const entry = registry.get('Tool1');
        expect(entry.invocationCount).toBe(1);
        expect(entry.successCount).toBe(0);
        expect(entry.failureCount).toBe(1);
      });

      it('should accumulate multiple invocations', () => {
        registry.recordInvocation('Tool1', true);
        registry.recordInvocation('Tool1', false);
        registry.recordInvocation('Tool1', true);

        const entry = registry.get('Tool1');
        expect(entry.invocationCount).toBe(3);
        expect(entry.successCount).toBe(2);
        expect(entry.failureCount).toBe(1);
      });

      it('should throw ToolNotFoundError for non-existent tool', () => {
        expect(() =>
          registry.recordInvocation('NonExistentTool', true)
        ).toThrow(ToolNotFoundError);
      });
    });

    describe('clear()', () => {
      it('should remove all registered tools', () => {
        expect(registry.size).toBe(2);

        registry.clear();

        expect(registry.size).toBe(0);
        expect(registry.getAll()).toEqual([]);
        expect(registry.has('Tool1')).toBe(false);
        expect(registry.has('Tool2')).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Event System Tests
  // ==========================================================================

  describe('Event System', () => {
    let registeredEvents: any[];
    let unregisteredEvents: any[];
    let availabilityEvents: any[];

    beforeEach(() => {
      registeredEvents = [];
      unregisteredEvents = [];
      availabilityEvents = [];

      registry.on('tool:registered', (data) => registeredEvents.push(data));
      registry.on('tool:unregistered', (data) => unregisteredEvents.push(data));
      registry.on('tool:availability-changed', (data) => availabilityEvents.push(data));
    });

    it('should emit tool:registered event on registration', () => {
      registry.register(mockTool);

      expect(registeredEvents.length).toBe(1);
      expect(registeredEvents[0]).toEqual({
        toolName: 'MockTool',
        definition: mockTool.getDefinition(),
      });
    });

    it('should emit tool:unregistered event on unregistration', () => {
      registry.register(mockTool);
      registry.unregister('MockTool');

      expect(unregisteredEvents.length).toBe(1);
      expect(unregisteredEvents[0]).toEqual({
        toolName: 'MockTool',
      });
    });

    it('should emit tool:availability-changed event when availability changes', () => {
      registry.register(mockTool);
      registry.setAvailability('MockTool', false, 'Test reason');

      expect(availabilityEvents.length).toBe(1);
      expect(availabilityEvents[0]).toEqual({
        toolName: 'MockTool',
        available: false,
        reason: 'Test reason',
      });
    });

    it('should not emit availability-changed when availability stays the same', () => {
      registry.register(mockTool);
      registry.setAvailability('MockTool', true); // Same as current

      expect(availabilityEvents.length).toBe(0);
    });

    it('should emit unregistered events for all tools on clear', () => {
      const tool1 = new MockTool('Tool1');
      const tool2 = new MockTool('Tool2');

      registry.register(tool1);
      registry.register(tool2);
      registry.clear();

      expect(unregisteredEvents.length).toBe(2);
      const toolNames = unregisteredEvents.map(event => event.toolName);
      expect(toolNames).toContain('Tool1');
      expect(toolNames).toContain('Tool2');
    });

    it('should support removing event listeners', () => {
      const handler = vi.fn();
      registry.on('tool:registered', handler);

      registry.register(new MockTool('Tool1'));
      expect(handler).toHaveBeenCalledOnce();

      registry.off('tool:registered', handler);
      registry.register(new MockTool('Tool2'));
      expect(handler).toHaveBeenCalledOnce(); // Should not be called again
    });

    it('should handle errors in event listeners gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      registry.on('tool:registered', () => {
        throw new Error('Listener error');
      });

      // Should not throw, should continue execution
      expect(() => registry.register(mockTool)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in ToolRegistry event listener'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Tool Validation', () => {
    it('should reject tools with empty names', () => {
      const invalidTool = new MockTool(''); // Empty name
      expect(() => registry.register(invalidTool)).toThrow(ToolValidationError);
    });

    it('should reject tools with very long names', () => {
      const longName = 'a'.repeat(65); // Exceeds 64 character limit
      const invalidTool = new MockTool(longName);
      expect(() => registry.register(invalidTool)).toThrow(ToolValidationError);
    });

    it('should reject tools with invalid categories', () => {
      const invalidTool = new InvalidMockTool();
      expect(() => registry.register(invalidTool)).toThrow(ToolValidationError);
      expect(() => registry.register(invalidTool)).toThrow(/category must be one of/);
    });

    it('should reject tools with invalid version format', () => {
      const invalidTool = new InvalidMockTool();
      expect(() => registry.register(invalidTool)).toThrow(ToolValidationError);
      expect(() => registry.register(invalidTool)).toThrow(/version must be in semver format/);
    });

    it('should accept tools with valid semver versions', () => {
      const validVersions = ['1.0.0', '10.2.3', '0.1.0'];

      validVersions.forEach((version, index) => {
        const tool = new MockTool(`Tool${index}`, 'custom', true);
        // Override getDefinition to return custom version
        tool.getDefinition = () => ({
          ...new MockTool().getDefinition(),
          name: `Tool${index}`,
          version,
        });

        expect(() => registry.register(tool)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Error Classes Tests
  // ==========================================================================

  describe('Error Classes', () => {
    it('should provide correct error information for DuplicateToolError', () => {
      registry.register(mockTool);

      try {
        registry.register(new MockTool('MockTool'));
      } catch (error) {
        expect(error).toBeInstanceOf(DuplicateToolError);
        expect((error as DuplicateToolError).toolName).toBe('MockTool');
        expect((error as DuplicateToolError).name).toBe('DuplicateToolError');
        expect((error as DuplicateToolError).message).toContain('MockTool');
      }
    });

    it('should provide correct error information for ToolNotFoundError', () => {
      try {
        registry.get('NonExistentTool');
      } catch (error) {
        expect(error).toBeInstanceOf(ToolNotFoundError);
        expect((error as ToolNotFoundError).toolName).toBe('NonExistentTool');
        expect((error as ToolNotFoundError).name).toBe('ToolNotFoundError');
        expect((error as ToolNotFoundError).message).toContain('NonExistentTool');
      }
    });

    it('should provide correct error information for ToolValidationError', () => {
      const invalidTool = new InvalidMockTool();

      try {
        registry.register(invalidTool);
      } catch (error) {
        expect(error).toBeInstanceOf(ToolValidationError);
        expect((error as ToolValidationError).toolName).toBe('');
        expect((error as ToolValidationError).name).toBe('ToolValidationError');
        expect((error as ToolValidationError).details).toBeInstanceOf(Array);
        expect((error as ToolValidationError).details.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // Edge Cases and Boundary Conditions
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle registering and unregistering the same tool multiple times', () => {
      registry.register(mockTool);
      registry.unregister('MockTool');
      registry.register(mockTool);

      expect(registry.has('MockTool')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should handle empty tool parameters schema', () => {
      const minimalTool = new MockTool('MinimalTool');
      minimalTool.getDefinition = () => ({
        name: 'MinimalTool',
        description: 'Minimal tool',
        category: 'custom',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      });

      expect(() => registry.register(minimalTool)).not.toThrow();
    });

    it('should handle tools with all optional parameters', () => {
      const optionalTool = new MockTool('OptionalTool');
      optionalTool.getDefinition = () => ({
        name: 'OptionalTool',
        description: 'Tool with optional parameters',
        category: 'custom',
        parameters: {
          type: 'object',
          properties: {
            optional1: { type: 'string', description: 'Optional param 1' },
            optional2: { type: 'number', description: 'Optional param 2' },
          },
          required: [],
          additionalProperties: false,
        },
      });

      expect(() => registry.register(optionalTool)).not.toThrow();
    });

    it('should handle large numbers of tools', () => {
      const toolCount = 1000;
      const tools: MockTool[] = [];

      // Register many tools
      for (let i = 0; i < toolCount; i++) {
        const tool = new MockTool(`Tool${i}`, 'custom');
        tools.push(tool);
        registry.register(tool);
      }

      expect(registry.size).toBe(toolCount);
      expect(registry.getAll().length).toBe(toolCount);

      // Check random tools are accessible
      expect(registry.has('Tool0')).toBe(true);
      expect(registry.has('Tool500')).toBe(true);
      expect(registry.has('Tool999')).toBe(true);
    });

    it('should maintain order independence for operations', () => {
      const tool1 = new MockTool('Tool1');
      const tool2 = new MockTool('Tool2');
      const tool3 = new MockTool('Tool3');

      registry.register(tool2);
      registry.register(tool1);
      registry.register(tool3);

      const allTools = registry.getAll();
      expect(allTools.length).toBe(3);

      // Should be able to access all regardless of registration order
      expect(registry.has('Tool1')).toBe(true);
      expect(registry.has('Tool2')).toBe(true);
      expect(registry.has('Tool3')).toBe(true);
    });
  });
});

// ============================================================================
// Convenience Functions Tests
// ============================================================================

describe('Convenience Functions', () => {
  beforeEach(() => {
    ToolRegistry.resetInstance();
  });

  describe('getToolRegistry()', () => {
    it('should return the singleton instance', () => {
      const registry1 = getToolRegistry();
      const registry2 = getToolRegistry();
      const registry3 = ToolRegistry.getInstance();

      expect(registry1).toBe(registry2);
      expect(registry1).toBe(registry3);
    });
  });

  describe('registerTool()', () => {
    it('should register tool with global registry', () => {
      const mockTool = new MockTool();

      expect(() => registerTool(mockTool)).not.toThrow();

      const registry = getToolRegistry();
      expect(registry.has('MockTool')).toBe(true);
    });

    it('should throw on duplicate registration', () => {
      const mockTool1 = new MockTool('SameName');
      const mockTool2 = new MockTool('SameName');

      registerTool(mockTool1);
      expect(() => registerTool(mockTool2)).toThrow(DuplicateToolError);
    });
  });

  describe('unregisterTool()', () => {
    it('should unregister tool from global registry', () => {
      const mockTool = new MockTool();
      registerTool(mockTool);

      expect(() => unregisterTool('MockTool')).not.toThrow();

      const registry = getToolRegistry();
      expect(registry.has('MockTool')).toBe(false);
    });

    it('should throw when unregistering non-existent tool', () => {
      expect(() => unregisterTool('NonExistentTool')).toThrow(ToolNotFoundError);
    });
  });
});