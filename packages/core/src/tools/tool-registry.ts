/**
 * @fileoverview ToolRegistry - Singleton registry for tool registration and discovery
 *
 * This module provides a centralized registry for managing APEX tools. It follows
 * the singleton pattern to ensure a single source of truth for all registered tools
 * across the application.
 *
 * ## Architecture Decision Record (ADR-015)
 *
 * ### Context
 * APEX agents need access to a shared collection of tools during task execution.
 * The system requires:
 * - Centralized tool registration and discovery
 * - Prevention of duplicate tool registrations
 * - Fast lookup by name and category
 * - Type-safe tool management
 * - Runtime tool availability tracking
 *
 * ### Decision
 * Implement a `ToolRegistry` singleton class that:
 * 1. Uses `ToolRegistryEntry` from types.ts to track tools with runtime metadata
 * 2. Provides methods matching acceptance criteria: register, unregister, get, getAll, getByCategory, has
 * 3. Throws descriptive errors for duplicate registrations and unknown tools
 * 4. Integrates with `ToolInterface` and `BaseTool` for consistent tool abstraction
 * 5. Emits events for registration/unregistration to support reactive consumers
 *
 * ### Consequences
 * - Single source of truth for all tools
 * - Consistent error handling across the application
 * - Tools can be dynamically added/removed at runtime
 * - Category-based filtering enables agent-specific tool sets
 *
 * @module @apex/core/tools/tool-registry
 */

import type {
  ToolDefinition,
  ToolCategory,
  ToolRegistryEntry,
} from '../types.js';
import type { ToolInterface } from './base-tool.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when attempting to register a tool that already exists
 */
export class DuplicateToolError extends Error {
  /** Name of the tool that was duplicated */
  public readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool '${toolName}' is already registered. Use unregister() first to replace it.`);
    this.name = 'DuplicateToolError';
    this.toolName = toolName;
  }
}

/**
 * Error thrown when attempting to access a tool that doesn't exist
 */
export class ToolNotFoundError extends Error {
  /** Name of the tool that was not found */
  public readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool '${toolName}' is not registered.`);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
  }
}

/**
 * Error thrown when tool validation fails during registration
 */
export class ToolValidationError extends Error {
  /** Name of the tool that failed validation */
  public readonly toolName: string;
  /** Validation error details */
  public readonly details: string[];

  constructor(toolName: string, details: string[]) {
    super(`Tool '${toolName}' validation failed: ${details.join('; ')}`);
    this.name = 'ToolValidationError';
    this.toolName = toolName;
    this.details = details;
  }
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the ToolRegistry
 */
export interface ToolRegistryEvents {
  /** Emitted when a tool is registered */
  'tool:registered': { toolName: string; definition: ToolDefinition };
  /** Emitted when a tool is unregistered */
  'tool:unregistered': { toolName: string };
  /** Emitted when a tool's availability changes */
  'tool:availability-changed': { toolName: string; available: boolean; reason?: string };
}

/**
 * Event listener type for registry events
 */
export type ToolRegistryEventListener<K extends keyof ToolRegistryEvents> = (
  data: ToolRegistryEvents[K]
) => void;

// ============================================================================
// Registry Options
// ============================================================================

/**
 * Options for creating a ToolRegistry instance
 */
export interface ToolRegistryOptions {
  /** Whether to allow overwriting existing tools (default: false) */
  allowOverwrite?: boolean;
  /** Whether to validate tool definitions on registration (default: true) */
  validateOnRegister?: boolean;
}

// ============================================================================
// ToolRegistry Class
// ============================================================================

/**
 * Singleton registry for managing APEX tools.
 *
 * The ToolRegistry provides centralized tool management with:
 * - Registration and unregistration of tools
 * - Lookup by name and category
 * - Runtime availability tracking
 * - Event emission for tool lifecycle changes
 *
 * ## Usage
 *
 * ```typescript
 * // Get the singleton instance
 * const registry = ToolRegistry.getInstance();
 *
 * // Register a tool
 * registry.register(myTool);
 *
 * // Check if a tool exists
 * if (registry.has('MyTool')) {
 *   const entry = registry.get('MyTool');
 *   console.log(entry.definition.description);
 * }
 *
 * // Get all tools in a category
 * const fileTools = registry.getByCategory('filesystem');
 *
 * // Unregister a tool
 * registry.unregister('MyTool');
 * ```
 *
 * ## Thread Safety
 * The registry is designed for single-threaded Node.js environments.
 * In multi-threaded scenarios, external synchronization may be required.
 */
export class ToolRegistry {
  /** Singleton instance */
  private static instance: ToolRegistry | null = null;

  /** Map of tool name to registry entry */
  private readonly tools: Map<string, ToolRegistryEntry> = new Map();

  /** Map of tool name to tool interface for execution */
  private readonly toolInterfaces: Map<string, ToolInterface<unknown, unknown>> = new Map();

  /** Event listeners */
  private readonly listeners: Map<
    keyof ToolRegistryEvents,
    Set<ToolRegistryEventListener<keyof ToolRegistryEvents>>
  > = new Map();

  /** Registry options */
  private readonly options: Required<ToolRegistryOptions>;

  /**
   * Private constructor to enforce singleton pattern.
   * Use `ToolRegistry.getInstance()` to get the singleton instance.
   *
   * @param options - Optional configuration options
   */
  private constructor(options: ToolRegistryOptions = {}) {
    this.options = {
      allowOverwrite: options.allowOverwrite ?? false,
      validateOnRegister: options.validateOnRegister ?? true,
    };
  }

  /**
   * Gets the singleton instance of ToolRegistry.
   *
   * @param options - Optional configuration options (only used on first call)
   * @returns The singleton ToolRegistry instance
   *
   * @example
   * ```typescript
   * const registry = ToolRegistry.getInstance();
   * ```
   */
  public static getInstance(options?: ToolRegistryOptions): ToolRegistry {
    if (ToolRegistry.instance === null) {
      ToolRegistry.instance = new ToolRegistry(options);
    }
    return ToolRegistry.instance;
  }

  /**
   * Resets the singleton instance.
   *
   * **Warning**: This should only be used in testing scenarios.
   * Calling this in production code may lead to inconsistent state.
   */
  public static resetInstance(): void {
    ToolRegistry.instance = null;
  }

  // ==========================================================================
  // Core Registry Methods
  // ==========================================================================

  /**
   * Registers a tool with the registry.
   *
   * @param tool - The tool to register (must implement ToolInterface)
   * @throws {DuplicateToolError} If a tool with the same name is already registered
   * @throws {ToolValidationError} If the tool definition is invalid
   *
   * @example
   * ```typescript
   * const registry = ToolRegistry.getInstance();
   * registry.register(new MyCustomTool());
   * ```
   */
  public register(tool: ToolInterface<unknown, unknown>): void {
    const definition = tool.getDefinition();
    const toolName = definition.name;

    // Check for duplicate registration
    if (this.tools.has(toolName) && !this.options.allowOverwrite) {
      throw new DuplicateToolError(toolName);
    }

    // Validate tool definition if enabled
    if (this.options.validateOnRegister) {
      const validationErrors = this.validateDefinition(definition);
      if (validationErrors.length > 0) {
        throw new ToolValidationError(toolName, validationErrors);
      }
    }

    // Create registry entry with runtime metadata
    const entry: ToolRegistryEntry = {
      definition,
      available: definition.enabled !== false,
      unavailableReason: undefined,
      lastInvoked: undefined,
      invocationCount: 0,
      successCount: 0,
      failureCount: 0,
    };

    // Store both the entry and the interface
    this.tools.set(toolName, entry);
    this.toolInterfaces.set(toolName, tool);

    // Emit registration event
    this.emit('tool:registered', { toolName, definition });
  }

  /**
   * Unregisters a tool from the registry.
   *
   * @param name - Name of the tool to unregister
   * @throws {ToolNotFoundError} If the tool is not registered
   *
   * @example
   * ```typescript
   * const registry = ToolRegistry.getInstance();
   * registry.unregister('MyTool');
   * ```
   */
  public unregister(name: string): void {
    if (!this.tools.has(name)) {
      throw new ToolNotFoundError(name);
    }

    this.tools.delete(name);
    this.toolInterfaces.delete(name);

    // Emit unregistration event
    this.emit('tool:unregistered', { toolName: name });
  }

  /**
   * Gets a tool's registry entry by name.
   *
   * @param name - Name of the tool to retrieve
   * @returns The tool's registry entry
   * @throws {ToolNotFoundError} If the tool is not registered
   *
   * @example
   * ```typescript
   * const entry = registry.get('ReadFile');
   * console.log(entry.definition.description);
   * console.log(entry.invocationCount);
   * ```
   */
  public get(name: string): ToolRegistryEntry {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new ToolNotFoundError(name);
    }
    return entry;
  }

  /**
   * Gets a tool's interface for execution.
   *
   * @param name - Name of the tool to retrieve
   * @returns The tool interface
   * @throws {ToolNotFoundError} If the tool is not registered
   */
  public getToolInterface(name: string): ToolInterface {
    const tool = this.toolInterfaces.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }
    return tool;
  }

  /**
   * Gets all registered tool entries.
   *
   * @returns Array of all tool registry entries
   *
   * @example
   * ```typescript
   * const allTools = registry.getAll();
   * console.log(`${allTools.length} tools registered`);
   * ```
   */
  public getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  /**
   * Gets all tools in a specific category.
   *
   * @param category - The category to filter by
   * @returns Array of tool registry entries matching the category
   *
   * @example
   * ```typescript
   * const fileTools = registry.getByCategory('filesystem');
   * const searchTools = registry.getByCategory('search');
   * ```
   */
  public getByCategory(category: ToolCategory): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter(
      (entry) => entry.definition.category === category
    );
  }

  /**
   * Checks if a tool is registered.
   *
   * @param name - Name of the tool to check
   * @returns True if the tool is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (registry.has('ReadFile')) {
   *   // Tool is available
   * }
   * ```
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  // ==========================================================================
  // Additional Utility Methods
  // ==========================================================================

  /**
   * Gets the count of registered tools.
   *
   * @returns The number of registered tools
   */
  public get size(): number {
    return this.tools.size;
  }

  /**
   * Gets all tool names.
   *
   * @returns Array of registered tool names
   */
  public getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Gets all available tools (enabled and not marked unavailable).
   *
   * @returns Array of available tool registry entries
   */
  public getAvailable(): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter((entry) => entry.available);
  }

  /**
   * Gets tool definitions only (for Claude Agent SDK integration).
   *
   * @returns Array of tool definitions
   */
  public getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  /**
   * Sets a tool's availability status.
   *
   * @param name - Name of the tool
   * @param available - Whether the tool should be available
   * @param reason - Optional reason for unavailability
   * @throws {ToolNotFoundError} If the tool is not registered
   */
  public setAvailability(name: string, available: boolean, reason?: string): void {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new ToolNotFoundError(name);
    }

    const previousAvailable = entry.available;
    entry.available = available;
    entry.unavailableReason = available ? undefined : reason;

    // Emit event if availability changed
    if (previousAvailable !== available) {
      this.emit('tool:availability-changed', {
        toolName: name,
        available,
        reason,
      });
    }
  }

  /**
   * Records a tool invocation for statistics tracking.
   *
   * @param name - Name of the tool
   * @param success - Whether the invocation was successful
   * @throws {ToolNotFoundError} If the tool is not registered
   */
  public recordInvocation(name: string, success: boolean): void {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new ToolNotFoundError(name);
    }

    entry.lastInvoked = new Date();
    entry.invocationCount++;
    if (success) {
      entry.successCount++;
    } else {
      entry.failureCount++;
    }
  }

  /**
   * Clears all registered tools.
   *
   * **Warning**: This removes all tools from the registry.
   */
  public clear(): void {
    const toolNames = Array.from(this.tools.keys());
    this.tools.clear();
    this.toolInterfaces.clear();

    // Emit unregistration events for all tools
    for (const toolName of toolNames) {
      this.emit('tool:unregistered', { toolName });
    }
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Adds an event listener for registry events.
   *
   * @param event - The event type to listen for
   * @param listener - The callback function
   */
  public on<K extends keyof ToolRegistryEvents>(
    event: K,
    listener: ToolRegistryEventListener<K>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as ToolRegistryEventListener<keyof ToolRegistryEvents>);
  }

  /**
   * Removes an event listener.
   *
   * @param event - The event type
   * @param listener - The callback function to remove
   */
  public off<K extends keyof ToolRegistryEvents>(
    event: K,
    listener: ToolRegistryEventListener<K>
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as ToolRegistryEventListener<keyof ToolRegistryEvents>);
    }
  }

  /**
   * Emits an event to all registered listeners.
   *
   * @param event - The event type
   * @param data - The event data
   */
  private emit<K extends keyof ToolRegistryEvents>(
    event: K,
    data: ToolRegistryEvents[K]
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (error) {
          // Log error but don't interrupt other listeners
          console.error(`Error in ToolRegistry event listener for '${event}':`, error);
        }
      }
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validates a tool definition.
   *
   * @param definition - The tool definition to validate
   * @returns Array of validation error messages (empty if valid)
   */
  private validateDefinition(definition: ToolDefinition): string[] {
    const errors: string[] = [];

    // Validate name
    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    } else if (definition.name.length === 0) {
      errors.push('Tool name cannot be empty');
    } else if (definition.name.length > 64) {
      errors.push('Tool name must be 64 characters or less');
    }

    // Validate description
    if (!definition.description || typeof definition.description !== 'string') {
      errors.push('Tool description is required and must be a string');
    } else if (definition.description.length === 0) {
      errors.push('Tool description cannot be empty');
    }

    // Validate category
    const validCategories = ['filesystem', 'search', 'shell', 'web', 'system', 'custom'];
    if (!validCategories.includes(definition.category)) {
      errors.push(`Tool category must be one of: ${validCategories.join(', ')}`);
    }

    // Validate parameters schema
    if (definition.parameters) {
      if (definition.parameters.type !== 'object') {
        errors.push('Tool parameters.type must be "object"');
      }
    }

    // Validate version format if provided
    if (definition.version) {
      const semverRegex = /^\d+\.\d+\.\d+$/;
      if (!semverRegex.test(definition.version)) {
        errors.push('Tool version must be in semver format (e.g., "1.0.0")');
      }
    }

    return errors;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Gets the global ToolRegistry instance.
 *
 * This is a convenience function equivalent to `ToolRegistry.getInstance()`.
 *
 * @returns The singleton ToolRegistry instance
 */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}

/**
 * Registers a tool with the global registry.
 *
 * This is a convenience function equivalent to `ToolRegistry.getInstance().register(tool)`.
 *
 * @param tool - The tool to register
 * @throws {DuplicateToolError} If a tool with the same name is already registered
 */
export function registerTool(tool: ToolInterface): void {
  getToolRegistry().register(tool);
}

/**
 * Unregisters a tool from the global registry.
 *
 * This is a convenience function equivalent to `ToolRegistry.getInstance().unregister(name)`.
 *
 * @param name - Name of the tool to unregister
 * @throws {ToolNotFoundError} If the tool is not registered
 */
export function unregisterTool(name: string): void {
  getToolRegistry().unregister(name);
}
