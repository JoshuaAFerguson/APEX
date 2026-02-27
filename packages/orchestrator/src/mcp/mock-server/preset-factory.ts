/**
 * @fileoverview Preset-Based Mock MCP Server Factory
 *
 * Provides the createMockMCPServer() factory function that creates fully-configured
 * mock servers from preset configurations with optional overrides.
 *
 * Implements ADR-080: Preset-Based Mock MCP Server Factory
 *
 * @example
 * ```typescript
 * // Basic usage with preset name
 * const server = createMockMCPServer('filesystem');
 *
 * // With custom server name
 * const server = createMockMCPServer('database', { name: 'my-db-server' });
 *
 * // Combining presets (error-prone filesystem)
 * const server = createMockMCPServer(['filesystem', 'error-prone']);
 *
 * // Custom tool handlers on top of preset
 * const server = createMockMCPServer('api', {
 *   additionalTools: [
 *     { toolName: 'custom_endpoint', response: { content: [...] } }
 *   ]
 * });
 * ```
 *
 * @module orchestrator/mcp/mock-server/preset-factory
 */

import type {
  MockMCPServerDefinition,
  MockMCPServerConfig,
  MockBehaviorConfig,
  MockToolHandler,
  MockErrorSimulationConfig,
  MockErrorScenarioPreset,
  MCPServerCapabilities,
} from './types.js';
import { MockMCPServerFacade } from './mock-server-facade.js';
import { MockMCPServerBuilder } from './mock-mcp-server-builder.js';
import {
  type MockServerPreset,
  type ServerPresetConfig,
  getServerPreset,
  isBehaviorModifier,
  BEHAVIOR_MODIFIERS,
} from './server-presets.js';

// ============================================================================
// Factory Function Options
// ============================================================================

/**
 * Options for customizing mock server creation
 */
export interface CreateMockServerOptions {
  /** Custom server name (overrides preset default) */
  name?: string;

  /** Custom description */
  description?: string;

  /** Additional tool handlers to add to preset */
  additionalTools?: MockToolHandler[];

  /** Override preset tool handlers (by tool name) */
  toolOverrides?: Record<string, Partial<MockToolHandler>>;

  /** Behavior preset to apply (e.g., 'error-prone', 'slow') */
  behaviorPreset?: 'error-prone' | 'slow';

  /** Custom delay configuration */
  delay?: number | { min: number; max: number };

  /** Error simulation configuration */
  errorSimulation?: MockErrorSimulationConfig;

  /** Error preset to apply */
  errorPreset?: MockErrorScenarioPreset;

  /** Server capabilities override */
  capabilities?: MCPServerCapabilities;

  /** Named scenarios to add */
  scenarios?: Array<{
    name: string;
    behaviorPreset?: 'error-prone' | 'slow';
    errorPreset?: MockErrorScenarioPreset;
  }>;

  /** Transport type override */
  transport?: 'stdio' | 'http' | 'sse';

  /** Auto-start the server (default: true) */
  autoStart?: boolean;

  /** Maximum number of concurrent connections (default: 10) */
  maxConnections?: number;

  /** Shutdown timeout in milliseconds (default: 5000) */
  shutdownTimeoutMs?: number;
}

// ============================================================================
// Main Factory Function
// ============================================================================

/**
 * Create a mock MCP server from a preset configuration.
 *
 * This factory function provides a simple interface for creating mock servers
 * with sensible defaults for common testing scenarios. It supports:
 * - Single preset names for basic configurations
 * - Array of presets for behavior composition
 * - Extensive customization options via overrides
 *
 * @param preset - Preset name or array of preset names to combine
 * @param overrides - Optional configuration overrides
 * @returns Configured MockMCPServerFacade ready for testing
 *
 * @example
 * ```typescript
 * // Basic filesystem server
 * const fsServer = createMockMCPServer('filesystem');
 *
 * // Database server with custom name
 * const dbServer = createMockMCPServer('database', {
 *   name: 'test-db',
 *   additionalTools: [
 *     { toolName: 'backup', response: { content: [{ type: 'text', text: 'Backup complete' }] } }
 *   ]
 * });
 *
 * // Slow API server (combines base preset with behavior modifier)
 * const slowApiServer = createMockMCPServer(['api', 'slow']);
 *
 * // Error-prone filesystem server with custom error simulation
 * const errorServer = createMockMCPServer(['filesystem', 'error-prone'], {
 *   errorSimulation: {
 *     mode: 'fail_first_n',
 *     failCount: 3,
 *     customError: { code: -32603, message: 'Service initializing...' }
 *   }
 * });
 * ```
 */
export function createMockMCPServer(
  preset: MockServerPreset | MockServerPreset[],
  overrides: CreateMockServerOptions = {}
): MockMCPServerFacade {
  // 1. Normalize preset to array and separate base from modifiers
  const presets = Array.isArray(preset) ? preset : [preset];
  const basePresets = presets.filter(p => !isBehaviorModifier(p));
  const modifierPresets = presets.filter(p => isBehaviorModifier(p));

  if (basePresets.length === 0) {
    throw new Error('At least one base preset (filesystem, database, api, minimal) must be provided');
  }

  if (basePresets.length > 1) {
    throw new Error('Only one base preset can be specified. Use behavior modifiers (error-prone, slow) for additional behaviors.');
  }

  // 2. Get the base preset configuration
  const basePreset = getServerPreset(basePresets[0]);

  // 3. Apply behavior modifiers
  let config = applyBehaviorModifiers(basePreset, modifierPresets, overrides);

  // 4. Apply user overrides
  config = applyUserOverrides(config, overrides);

  // 5. Create the server definition
  const definition = createServerDefinition(config, overrides);

  // 6. Use builder to create server (leverages existing infrastructure)
  const builder = new MockMCPServerBuilder()
    .withName(definition.serverConfig.name, definition.serverConfig.description)
    .withTransport(definition.serverConfig.transport)
    .withCapabilities(definition.serverConfig.capabilities);

  // Add tools from merged configuration
  for (const handler of definition.defaultBehavior.toolHandlers) {
    builder
      .withTool(handler.toolName)
      .withStaticResponse(handler.response.content, handler.response.isError);
  }

  // Apply behavior configuration
  if (definition.defaultBehavior.responseDelay) {
    const delay = definition.defaultBehavior.responseDelay;
    if (delay.minMs && delay.maxMs) {
      builder.withDelay(delay.minMs, delay.maxMs, delay.jitter);
    } else if (delay.fixedMs) {
      builder.withDelay(delay.fixedMs, undefined, delay.jitter);
    }
  }

  // Apply error injection
  if (definition.defaultBehavior.errorInjection) {
    builder.withErrorInjection(definition.defaultBehavior.errorInjection);
  }

  // Apply error simulation if specified
  if (overrides.errorSimulation) {
    builder.withErrorSimulation(overrides.errorSimulation);
  }

  // Apply error preset if specified
  if (overrides.errorPreset) {
    builder.withErrorPreset(overrides.errorPreset);
  }

  // Add scenarios if specified
  for (const scenario of overrides.scenarios ?? []) {
    builder.withScenario(scenario.name, scenarioBuilder => {
      if (scenario.behaviorPreset === 'error-prone') {
        scenarioBuilder.withErrorInjection({
          enabled: true,
          probability: 0.5,
          errorMessage: `Error from ${scenario.name} scenario`
        });
      } else if (scenario.behaviorPreset === 'slow') {
        scenarioBuilder.withDelay(1000, 3000, true);
      }

      if (scenario.errorPreset) {
        scenarioBuilder.withErrorPreset(scenario.errorPreset);
      }

      return scenarioBuilder;
    });
  }

  return builder.build();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply behavior modifiers to the base preset configuration
 */
function applyBehaviorModifiers(
  basePreset: ServerPresetConfig,
  modifierPresets: MockServerPreset[],
  overrides: CreateMockServerOptions
): ServerPresetConfig {
  let config = { ...basePreset };

  // Apply each behavior modifier
  for (const modifierName of modifierPresets) {
    const modifier = BEHAVIOR_MODIFIERS[modifierName];
    if (modifier) {
      config = mergePresetConfigs(config, modifier);
    }
  }

  // Apply behaviorPreset override if specified
  if (overrides.behaviorPreset) {
    const modifier = BEHAVIOR_MODIFIERS[overrides.behaviorPreset];
    if (modifier) {
      config = mergePresetConfigs(config, modifier);
    }
  }

  return config;
}

/**
 * Apply user-specified overrides to the configuration
 */
function applyUserOverrides(
  config: ServerPresetConfig,
  overrides: CreateMockServerOptions
): ServerPresetConfig {
  const result = { ...config };

  // Override server name and description
  if (overrides.name) {
    result.name = overrides.name;
    result.serverConfig.name = overrides.name;
  }
  if (overrides.description) {
    result.description = overrides.description;
    result.serverConfig.description = overrides.description;
  }

  // Override transport
  if (overrides.transport) {
    result.serverConfig.transport = overrides.transport;
  }

  // Override capabilities
  if (overrides.capabilities) {
    result.serverConfig.capabilities = { ...result.serverConfig.capabilities, ...overrides.capabilities };
  }

  // Override connection settings
  if (overrides.autoStart !== undefined) {
    result.serverConfig.autoStart = overrides.autoStart;
  }
  if (overrides.maxConnections !== undefined) {
    result.serverConfig.maxConnections = overrides.maxConnections;
  }
  if (overrides.shutdownTimeoutMs !== undefined) {
    result.serverConfig.shutdownTimeoutMs = overrides.shutdownTimeoutMs;
  }

  // Add additional tools
  if (overrides.additionalTools) {
    result.toolHandlers = [...result.toolHandlers, ...overrides.additionalTools];
  }

  // Apply tool overrides
  if (overrides.toolOverrides) {
    result.toolHandlers = result.toolHandlers.map(handler => {
      const override = overrides.toolOverrides![handler.toolName];
      return override ? { ...handler, ...override } : handler;
    });
  }

  // Apply custom delay
  if (overrides.delay) {
    if (typeof overrides.delay === 'number') {
      result.behaviorConfig.responseDelay = { fixedMs: overrides.delay, jitter: false };
    } else {
      result.behaviorConfig.responseDelay = {
        minMs: overrides.delay.min,
        maxMs: overrides.delay.max,
        jitter: true,
      };
    }
  }

  return result;
}

/**
 * Create a complete MockMCPServerDefinition from the merged configuration
 */
function createServerDefinition(
  config: ServerPresetConfig,
  overrides: CreateMockServerOptions
): MockMCPServerDefinition {
  // Build complete server configuration with sensible defaults
  const serverConfig: MockMCPServerConfig = {
    name: config.name,
    description: config.description,
    transport: 'stdio',
    protocolVersion: '2024-11-05',
    capabilities: {},
    serverInfo: { name: config.name, version: '1.0.0' },
    autoStart: true,
    maxConnections: 10,
    shutdownTimeoutMs: 5000,
    ...config.serverConfig,
  };

  // Build complete behavior configuration with sensible defaults
  const defaultBehavior: MockBehaviorConfig = {
    toolHandlers: config.toolHandlers,
    recordRequests: true,
    maxRecordedRequests: 1000,
    validateRequests: true,
    enableDebugLogging: false,
    notificationTriggers: [],
    expectations: [],
    ...config.behaviorConfig,
  };

  return {
    serverConfig,
    defaultBehavior,
    scenarios: [],
    activeScenario: undefined,
  };
}

/**
 * Merge two preset configurations, with the second taking precedence
 */
function mergePresetConfigs(
  base: ServerPresetConfig,
  modifier: Partial<ServerPresetConfig>
): ServerPresetConfig {
  return {
    name: modifier.name ?? base.name,
    description: modifier.description ?? base.description,
    serverConfig: { ...base.serverConfig, ...modifier.serverConfig },
    behaviorConfig: mergeBehaviorConfigs(base.behaviorConfig, modifier.behaviorConfig),
    toolHandlers: [...base.toolHandlers, ...(modifier.toolHandlers ?? [])],
    dynamicHandlers: [...(base.dynamicHandlers ?? []), ...(modifier.dynamicHandlers ?? [])],
    errorSimulation: modifier.errorSimulation ?? base.errorSimulation,
  };
}

/**
 * Deep merge behavior configurations
 */
function mergeBehaviorConfigs(
  base: Partial<MockBehaviorConfig>,
  modifier: Partial<MockBehaviorConfig> = {}
): Partial<MockBehaviorConfig> {
  return {
    ...base,
    ...modifier,
    // Deep merge nested objects
    responseDelay: modifier.responseDelay ?? base.responseDelay,
    errorInjection: modifier.errorInjection ?? base.errorInjection,
    stateMachine: modifier.stateMachine ?? base.stateMachine,
    notificationTriggers: [...(base.notificationTriggers ?? []), ...(modifier.notificationTriggers ?? [])],
    expectations: [...(base.expectations ?? []), ...(modifier.expectations ?? [])],
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a filesystem mock server with common file operations
 *
 * @param options - Optional configuration overrides
 * @returns Configured filesystem mock server
 *
 * @example
 * ```typescript
 * const server = createFileSystemMockServer({
 *   name: 'test-fs',
 *   additionalTools: [
 *     { toolName: 'chmod', response: { content: [{ type: 'text', text: 'Permissions changed' }] } }
 *   ]
 * });
 * ```
 */
export function createFileSystemMockServer(options: CreateMockServerOptions = {}): MockMCPServerFacade {
  return createMockMCPServer('filesystem', options);
}

/**
 * Create a database mock server with common database operations
 *
 * @param options - Optional configuration overrides
 * @returns Configured database mock server
 *
 * @example
 * ```typescript
 * const server = createDatabaseMockServer({
 *   name: 'test-db',
 *   additionalTools: [
 *     { toolName: 'migrate', response: { content: [{ type: 'text', text: 'Migration complete' }] } }
 *   ]
 * });
 * ```
 */
export function createDatabaseMockServer(options: CreateMockServerOptions = {}): MockMCPServerFacade {
  return createMockMCPServer('database', options);
}

/**
 * Create an API mock server with common HTTP operations
 *
 * @param options - Optional configuration overrides
 * @returns Configured API mock server
 *
 * @example
 * ```typescript
 * const server = createApiMockServer({
 *   name: 'test-api',
 *   delay: { min: 100, max: 300 } // Variable latency
 * });
 * ```
 */
export function createApiMockServer(options: CreateMockServerOptions = {}): MockMCPServerFacade {
  return createMockMCPServer('api', options);
}

/**
 * Create a minimal mock server with no preset tools
 *
 * @param options - Optional configuration overrides
 * @returns Configured minimal mock server
 *
 * @example
 * ```typescript
 * const server = createMinimalMockServer({
 *   name: 'test-minimal',
 *   additionalTools: [
 *     { toolName: 'ping', response: { content: [{ type: 'text', text: 'pong' }] } }
 *   ]
 * });
 * ```
 */
export function createMinimalMockServer(options: CreateMockServerOptions = {}): MockMCPServerFacade {
  return createMockMCPServer('minimal', options);
}