/**
 * @fileoverview Core Test Fixtures Index
 *
 * Centralized exports for all APEX core test fixtures.
 * Provides consistent fixtures across all packages for testing.
 */

// Re-export all marketplace fixtures including new factory functions
export * from './marketplace.js';

// Re-export types for external use
export type {
  MCPMarketplaceEntry,
  MCPServer,
  MCPServerConfig,
  MCPMarketplace,
  MCPMarketplaceSource,
} from '../types.js';

// Re-export factory option types
export type {
  MCPServerFactoryOptions,
  MCPServerConfigFactoryOptions,
  MCPMarketplaceEntryFactoryOptions,
} from './marketplace.js';