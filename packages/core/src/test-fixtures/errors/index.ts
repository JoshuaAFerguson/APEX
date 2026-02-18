/**
 * @fileoverview Error Fixtures Exports
 *
 * Centralized exports for all error-related fixtures.
 */

// MCP errors
export {
  MCPErrorPresets,
  MCPProtocolErrors,
  MCPErrorResponses,
  MCPErrorSimulationConfigs,
  JSONRPCErrorCodes,
  MCPErrorCodes,
  createJSONRPCError,
  createJSONRPCErrorResponse,
  createMCPError
} from './mcp-errors.js';

// Agent errors
export {
  AgentErrorPresets,
  ClaudeAgentErrors,
  ApexErrors,
  InfrastructureErrors,
  ErrorScenarios,
  createTimeoutError,
  createValidationError,
  createResourceNotFoundError,
  createPermissionError
} from './agent-errors.js';

// Validation errors
export {
  ValidationErrorPresets,
  ValidationErrorScenarios,
  TaskValidationErrors,
  ToolValidationErrors,
  AgentValidationErrors,
  createZodError,
  createValidationIssue,
  createCustomValidationError
} from './validation-errors.js';

// System errors
export {
  SystemErrorPresets,
  SystemErrorScenarios,
  FileSystemErrors,
  NetworkErrors,
  CustomSystemErrors,
  TimeoutErrors,
  SystemErrorCodes,
  createSystemError,
  createFileNotFoundError,
  createPermissionError as createSystemPermissionError,
  createNetworkError
} from './system-errors.js';