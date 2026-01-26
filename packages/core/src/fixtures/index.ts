/**
 * @fileoverview Core Test Fixtures Index
 *
 * Centralized exports for all APEX core test fixtures.
 * Provides consistent fixtures across all packages for testing.
 */

// Re-export all marketplace fixtures
export * from './marketplace.js';

// Re-export types for external use
export type {
  MCPMarketplaceEntry,
  MCPServer,
  MCPServerConfig,
  MCPMarketplace,
  MCPMarketplaceSource,
} from '../types.js';