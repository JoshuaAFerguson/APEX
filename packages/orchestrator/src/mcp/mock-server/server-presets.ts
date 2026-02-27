/**
 * @fileoverview Server Preset Definitions for Mock MCP Servers
 *
 * Defines preset configurations for common mock MCP server patterns.
 * These presets provide sensible defaults for testing various scenarios:
 * - filesystem: File system operations (read_file, write_file, etc.)
 * - database: Database operations (query, insert, update, etc.)
 * - api: HTTP/REST operations (http_get, http_post, etc.)
 * - minimal: Empty server with no tools
 * - error-prone: Server configured to fail frequently
 * - slow: Server with high latency for timeout testing
 *
 * Implements ADR-080: Preset-Based Mock MCP Server Factory
 *
 * @module orchestrator/mcp/mock-server/server-presets
 */

import type {
  MockMCPServerConfig,
  MockBehaviorConfig,
  MockToolHandler,
  MockDynamicHandler,
  MockErrorSimulationConfig,
} from './types.js';

// ============================================================================
// Server Preset Types
// ============================================================================

/**
 * Available server preset names
 */
export type MockServerPreset =
  | 'filesystem'   // File system tools (read_file, write_file, list_directory)
  | 'database'     // Database tools (query, insert, update, delete)
  | 'api'          // HTTP API tools (get, post, put, delete)
  | 'minimal'      // Empty server, no tools, minimal config
  | 'error-prone'  // Server configured to fail frequently
  | 'slow';        // Server with high latency for timeout testing

/**
 * Server preset configuration structure
 */
export interface ServerPresetConfig {
  /** Preset name for identification */
  name: string;
  /** Human-readable description */
  description: string;
  /** Partial server configuration (merged with defaults) */
  serverConfig: Partial<MockMCPServerConfig>;
  /** Partial behavior configuration (merged with defaults) */
  behaviorConfig: Partial<MockBehaviorConfig>;
  /** Static tool handlers for this preset */
  toolHandlers: MockToolHandler[];
  /** Optional dynamic handlers */
  dynamicHandlers?: MockDynamicHandler[];
  /** Optional error simulation configuration */
  errorSimulation?: MockErrorSimulationConfig;
}

// ============================================================================
// Individual Preset Definitions
// ============================================================================

/**
 * Filesystem preset - provides common file system operations
 */
export const FILESYSTEM_PRESET: ServerPresetConfig = {
  name: 'filesystem-server',
  description: 'Mock server with file system operations',
  serverConfig: {
    capabilities: { tools: { listChanged: true } },
  },
  behaviorConfig: {
    responseDelay: { fixedMs: 10, jitter: true },
  },
  toolHandlers: [
    {
      toolName: 'read_file',
      response: {
        content: [{ type: 'text', text: 'Mock file content from filesystem preset' }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'write_file',
      response: {
        content: [{ type: 'text', text: 'File written successfully' }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'list_directory',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify([
            { name: 'file1.txt', type: 'file', size: 1024 },
            { name: 'file2.txt', type: 'file', size: 2048 },
            { name: 'subdir', type: 'directory' }
          ])
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'delete_file',
      response: {
        content: [{ type: 'text', text: 'File deleted successfully' }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'create_directory',
      response: {
        content: [{ type: 'text', text: 'Directory created successfully' }],
        isError: false,
      },
      priority: 50,
    },
  ],
};

/**
 * Database preset - provides common database operations
 */
export const DATABASE_PRESET: ServerPresetConfig = {
  name: 'database-server',
  description: 'Mock server with database operations',
  serverConfig: {
    capabilities: { tools: { listChanged: true } },
  },
  behaviorConfig: {
    responseDelay: { fixedMs: 25, jitter: true },
  },
  toolHandlers: [
    {
      toolName: 'query',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            rows: [
              { id: 1, name: 'John Doe', email: 'john@example.com' },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
            ],
            count: 2
          })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'insert',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ inserted: 1, id: 3 })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'update',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ updated: 1 })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'delete',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({ deleted: 1 })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'list_tables',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify(['users', 'posts', 'comments', 'categories'])
        }],
        isError: false,
      },
      priority: 50,
    },
  ],
};

/**
 * API preset - provides common HTTP/REST operations
 */
export const API_PRESET: ServerPresetConfig = {
  name: 'api-server',
  description: 'Mock server with HTTP/REST operations',
  serverConfig: {
    capabilities: { tools: { listChanged: true } },
  },
  behaviorConfig: {
    responseDelay: { minMs: 50, maxMs: 200, jitter: true },
  },
  toolHandlers: [
    {
      toolName: 'http_get',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: { message: 'GET request successful', data: { id: 1 } }
          })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'http_post',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 201,
            headers: { 'content-type': 'application/json' },
            body: { id: 1, created: true, message: 'Resource created' }
          })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'http_put',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: { updated: true, message: 'Resource updated' }
          })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'http_delete',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 204,
            headers: {},
            body: null
          })
        }],
        isError: false,
      },
      priority: 50,
    },
    {
      toolName: 'http_patch',
      response: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: { patched: true, message: 'Resource partially updated' }
          })
        }],
        isError: false,
      },
      priority: 50,
    },
  ],
};

/**
 * Minimal preset - provides a bare minimum server with no tools
 */
export const MINIMAL_PRESET: ServerPresetConfig = {
  name: 'minimal-server',
  description: 'Minimal mock server with no tools',
  serverConfig: {
    capabilities: {},
  },
  behaviorConfig: {
    responseDelay: { fixedMs: 0 },
    recordRequests: true,
    validateRequests: true,
  },
  toolHandlers: [],
};

/**
 * Error-prone behavior modifier - applies high error injection rate
 */
export const ERROR_PRONE_MODIFIER: ServerPresetConfig = {
  name: 'error-prone-modifier',
  description: 'Behavior modifier that injects frequent errors',
  serverConfig: {},
  behaviorConfig: {
    errorInjection: {
      enabled: true,
      probability: 0.3, // 30% of requests fail
      errorCode: -32603,
      errorMessage: 'Simulated error for testing error handling',
      methods: [],
      afterRequestCount: 0,
      maxErrors: 0,
      simulateConnectionFailure: false,
      errorDelayMs: 0,
    },
  },
  toolHandlers: [],
};

/**
 * Slow behavior modifier - applies high latency
 */
export const SLOW_MODIFIER: ServerPresetConfig = {
  name: 'slow-modifier',
  description: 'Behavior modifier that adds high latency',
  serverConfig: {},
  behaviorConfig: {
    responseDelay: {
      minMs: 500,
      maxMs: 2000,
      jitter: true,
    },
  },
  toolHandlers: [],
};

// ============================================================================
// Preset Registry
// ============================================================================

/**
 * Registry mapping preset names to their configurations
 */
export const SERVER_PRESETS: Record<MockServerPreset, ServerPresetConfig> = {
  filesystem: FILESYSTEM_PRESET,
  database: DATABASE_PRESET,
  api: API_PRESET,
  minimal: MINIMAL_PRESET,
  'error-prone': ERROR_PRONE_MODIFIER,
  slow: SLOW_MODIFIER,
};

/**
 * Get a server preset by name
 *
 * @param presetName - The preset name to retrieve
 * @returns The preset configuration
 * @throws Error if preset is not found
 */
export function getServerPreset(presetName: MockServerPreset): ServerPresetConfig {
  const preset = SERVER_PRESETS[presetName];
  if (!preset) {
    throw new Error(
      `Unknown server preset: ${presetName}. Available presets: ${Object.keys(SERVER_PRESETS).join(', ')}`
    );
  }
  return preset;
}

/**
 * Get all available preset names
 *
 * @returns Array of preset names
 */
export function getAvailablePresets(): MockServerPreset[] {
  return Object.keys(SERVER_PRESETS) as MockServerPreset[];
}

/**
 * Check if a preset name is valid
 *
 * @param presetName - The preset name to check
 * @returns True if the preset exists
 */
export function isValidPreset(presetName: string): presetName is MockServerPreset {
  return presetName in SERVER_PRESETS;
}

/**
 * Behavior modifier presets - these are applied on top of base presets
 */
export const BEHAVIOR_MODIFIERS: Record<string, Partial<ServerPresetConfig>> = {
  'error-prone': ERROR_PRONE_MODIFIER,
  slow: SLOW_MODIFIER,
};

/**
 * Check if a preset is a behavior modifier (vs a base preset)
 *
 * @param presetName - The preset name to check
 * @returns True if it's a behavior modifier
 */
export function isBehaviorModifier(presetName: MockServerPreset): boolean {
  return presetName === 'error-prone' || presetName === 'slow';
}

/**
 * Get base presets (excluding behavior modifiers)
 *
 * @returns Array of base preset names
 */
export function getBasePresets(): MockServerPreset[] {
  return getAvailablePresets().filter(preset => !isBehaviorModifier(preset));
}