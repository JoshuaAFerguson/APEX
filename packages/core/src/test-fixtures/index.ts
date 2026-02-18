/**
 * @fileoverview Centralized Test Fixtures Module
 *
 * Main barrel export for the APEX centralized test fixtures module.
 * Provides a single source of truth for test fixtures across all packages.
 *
 * @example
 * ```typescript
 * import {
 *   createTask,
 *   ErrorPresets,
 *   ToolResponseBuilder,
 *   TaskPresets
 * } from '@apexcli/core/test-fixtures';
 *
 * // Create a basic task fixture
 * const task = createTask({ description: 'Test task' });
 *
 * // Use error presets
 * const mcpError = ErrorPresets.mcp.protocolMismatch();
 *
 * // Use builder for complex responses
 * const response = ToolResponseBuilder.create()
 *   .withToolName('Read')
 *   .asFileRead('Hello World')
 *   .build();
 * ```
 */

// Core types
export type * from './types.js';

// Response fixtures
export * from './responses/index.js';

// Request fixtures
export * from './requests/index.js';

// Error fixtures
export * from './errors/index.js';

// Factory functions
export * from './factories/index.js';

// Builder classes
export * from './builders/index.js';

// Browser fixtures
export * from './browser-fixtures.js';

// Error page fixtures
export * from './error-page-fixture.js';

// Mock helpers
export * from './mock-helpers.js';

// Mock factories for core domain types
export * from './mock-factories.js';

// Logged-in page fixtures
export * from './logged-in-page-fixture.js';

// Loading state fixtures
export * from './loading-state-fixture.js';

// Setup and teardown utilities
export * from './setup-teardown.js';

// Package-specific helpers
export * from './package-helpers.js';

// Test utilities
export * from './test-utils.js';

// Sensitive information detection utilities
export * from './sensitive-info-utils.js';

// Test context for isolation
export * from './context/index.js';

// Marketplace fixtures
export * from '../fixtures/index.js';

// Re-export existing fixtures for backward compatibility
export {
  loadValidToolFixtures,
  loadInvalidToolFixtures,
  loadEdgeCaseFixtures,
  createTestToolConfig,
  validateToolConfig,
  loadFixtureFile,
  getRawFixture,
  getFixturePath,
  fixtureExists,
  clearFixtureCache,
  loadCategoryFixtures,
  getFixturesDirectory,
  type FixtureCategory
} from '../__tests__/fixtures/custom-tools/index.js';

// Combined error presets for easy access
export const ErrorPresets = {
  /** MCP protocol errors */
  mcp: {
    protocolMismatch: () => import('./errors/mcp-errors.js').then(m => m.MCPProtocolErrors.protocolMismatch),
    timeout: () => import('./errors/mcp-errors.js').then(m => m.MCPProtocolErrors.timeout),
    connectionLost: () => import('./errors/mcp-errors.js').then(m => m.MCPProtocolErrors.transportError),
    rateLimited: () => import('./errors/mcp-errors.js').then(m => m.MCPProtocolErrors.rateLimited),
    resourceNotFound: () => import('./errors/mcp-errors.js').then(m => m.MCPProtocolErrors.resourceNotFound),
    invalidRequest: () => import('./errors/mcp-errors.js').then(m => m.MCPProtocolErrors.invalidRequest),
  },

  /** Claude Agent SDK errors */
  agent: {
    sessionLimit: () => import('./errors/agent-errors.js').then(m => m.ClaudeAgentErrors.contextWindowExceeded),
    budgetExceeded: () => import('./errors/agent-errors.js').then(m => m.ClaudeAgentErrors.budgetExceeded),
    modelUnavailable: () => import('./errors/agent-errors.js').then(m => m.ClaudeAgentErrors.modelUnavailable),
    rateLimited: () => import('./errors/agent-errors.js').then(m => m.ClaudeAgentErrors.rateLimitExceeded),
    toolExecutionFailed: () => import('./errors/agent-errors.js').then(m => m.ClaudeAgentErrors.toolExecutionFailed),
    networkTimeout: () => import('./errors/agent-errors.js').then(m => m.ClaudeAgentErrors.networkTimeout),
  },

  /** APEX system errors */
  apex: {
    configNotFound: () => import('./errors/agent-errors.js').then(m => m.ApexErrors.configNotFound),
    projectNotInitialized: () => import('./errors/agent-errors.js').then(m => m.ApexErrors.projectNotInitialized),
    workflowNotFound: () => import('./errors/agent-errors.js').then(m => m.ApexErrors.workflowNotFound),
    taskExecutionFailed: () => import('./errors/agent-errors.js').then(m => m.ApexErrors.taskExecutionFailed),
    permissionDenied: () => import('./errors/agent-errors.js').then(m => m.ApexErrors.permissionDenied),
  },

  /** Validation errors */
  validation: {
    invalidTask: () => import('./errors/validation-errors.js').then(m => m.TaskValidationErrors.missingRequired),
    invalidTool: () => import('./errors/validation-errors.js').then(m => m.ToolValidationErrors.missingName),
    invalidAgent: () => import('./errors/validation-errors.js').then(m => m.AgentValidationErrors.invalidModel),
    requiredField: () => import('./errors/validation-errors.js').then(m => m.ValidationErrorScenarios.requiredField),
    invalidType: () => import('./errors/validation-errors.js').then(m => m.ValidationErrorScenarios.invalidType),
  },

  /** System-level errors */
  system: {
    fileNotFound: () => import('./errors/system-errors.js').then(m => m.FileSystemErrors.fileNotFound),
    permissionDenied: () => import('./errors/system-errors.js').then(m => m.FileSystemErrors.permissionDenied),
    networkTimeout: () => import('./errors/system-errors.js').then(m => m.NetworkErrors.connectionTimeout),
    connectionRefused: () => import('./errors/system-errors.js').then(m => m.NetworkErrors.connectionRefused),
    diskFull: () => import('./errors/system-errors.js').then(m => m.FileSystemErrors.noSpace),
    gitNotFound: () => import('./errors/system-errors.js').then(m => m.CustomSystemErrors.gitNotFound),
  },
} as const;