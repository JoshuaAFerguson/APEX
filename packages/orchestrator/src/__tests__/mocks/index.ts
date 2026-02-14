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

// Tool Mocking Utilities
export {
  MockToolRegistry
} from './tool-mock-registry';

export {
  MockToolBuilder,
  createMockTool,
  createSimpleTextTool,
  createFailingTool,
  createSequenceTool
} from './tool-mock-builder';

// Core Tool Mock Types (ADR-095)
export type {
  MockTool,
  MockToolResponse,
  ToolInvocation,
  MockToolExecutor,
  ToolContentBlock,
  ToolExecutionContext,
  MockToolOptions,
  ToolSequenceVerificationResult,
  MockToolFactory,
  MockToolBuilder,
} from './tool-mock-core.types';

export {
  isMockToolResponse,
  isToolInvocation,
  isToolContentBlock,
  createTextResponse,
  createErrorResponse,
  createStructuredResponse,
} from './tool-mock-core.types';

// Re-export existing tool mock types for compatibility
export type {
  MockToolContent,
  MockToolResult,
  ToolInvocationRecord,
  MockToolConfig,
  MockToolHandler,
  MockToolContext,
  MockToolDefinition,
  ToolCallVerificationResult,
  ToolCallExpectation,
  ToolExecutionOptions,
  ToolUsageStatistics,
  ToolCallPattern,
  PatternMatchResult
} from './tool-mock.types';

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

// Enhanced Test Helper Utilities
export {
  TestHelper,
  TestPatterns,
  createTestHelper,
  setupTestEnvironment,
  verifyToolInteractionPattern
} from './test-helpers';

export type {
  TestScenarioConfig,
  TestPattern,
  ToolExecutionExpectation
} from './test-helpers';