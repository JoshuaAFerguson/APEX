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
  MockQueryFunction,
  ResponseOptions,
  DynamicResponseHandler
} from './claude-agent-sdk.types';

// Permission Revocation Test Utilities
export {
  InterruptibleStreamController,
  PartialResultTracker,
  PermissionRevocationSimulator
} from './permission-revocation';

export type {
  RevocationConfig,
  RevocationSimulationResult,
  TrackedToolCall
} from './permission-revocation.types';