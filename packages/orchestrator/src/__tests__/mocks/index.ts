/**
 * Mock utilities for testing APEX components
 *
 * Provides centralized mock implementations for external dependencies
 * used throughout the APEX test suite.
 */

// Claude Agent SDK Mocks
export {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  createMockModule,
  setupMockSDK,
  createMockHookInput,
  MockErrors
} from './claude-agent-sdk';

export type {
  MockQueryResponse,
  MockUsage,
  StreamingEvent,
  QueryCallRecord,
  ContentBlock,
  MockMessage,
  MockOutput,
  MockHookInput,
  MockQueryFunction
} from './claude-agent-sdk.types';

// Future mock exports can be added here
// export * from './other-mocks';