/**
 * @fileoverview MCP Mock Server Test Utilities
 *
 * Re-exports the withMockMCP test wrapper functions for convenient
 * import in test files alongside other test utilities.
 */

// Re-export withMockMCP functions for convenience in tests
export {
  withMockMCP,
  withMockMCPFacade,
  type WithMockMCPOptions,
} from './mcp/mock-server/with-mock-mcp.js';