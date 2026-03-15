/**
 * Mock Factories for APEX Core Domain Types
 *
 * This module provides type-safe mock factories for all core domain types
 * defined in packages/core/src/types.ts. Each factory supports partial
 * overrides and generates valid typed objects for testing.
 *
 * @example
 * ```typescript
 * import { createTask, createAgent, createWorkflow } from '@apex/core/factories';
 *
 * const task = createTask({ description: 'Custom test task' });
 * const agent = createAgent({ name: 'test-agent' });
 * const workflow = createWorkflow({ name: 'test-workflow' });
 * ```
 */

// Re-export task-factory (excluding duplicates that also exist in agent-factory and log-factory)
export {
  type TaskUsageOverrides,
  createTaskUsage,
  type TaskLogOverrides,
  createTaskLog,
  type TaskArtifactOverrides,
  createTaskArtifact,
  type AgentMessageOverrides,
  createAgentMessage,
  type WorkspaceConfigOverrides,
  createWorkspaceConfig,
  type TaskSessionDataOverrides,
  createTaskSessionData,
  type ThoughtCaptureOverrides,
  createThoughtCapture,
  type IterationHistoryOverrides,
  createIterationHistory,
  type ApprovalStateOverrides,
  createApprovalState,
  type SubtaskDefinitionOverrides,
  createSubtaskDefinition,
  type TaskDecompositionOverrides,
  createTaskDecomposition,
  type TaskOverrides,
  createTask,
  createTasks,
  createTaskLifecycle,
} from './task-factory.js';

// Re-export agent-factory (excluding AgentMessageOverrides and createAgentMessage which come from task-factory)
export {
  type AgentDefinitionOverrides,
  createAgent,
  type AgentAutonomyOverrideOverrides,
  createAgentAutonomyOverride,
  createDeveloperAgent,
  createPlannerAgent,
  createTesterAgent,
  createReviewerAgent,
  createAgentTeam,
  createAgents,
  createAgentConversation,
} from './agent-factory.js';

export * from './workflow-factory.js';
export * from './permission-factory.js';

// Re-export config-factory (excluding LoggingConfigOverrides and createLoggingConfig which come from log-factory)
export {
  type ProjectConfigOverrides,
  createProjectConfig,
  type AutonomyConfigOverrides,
  createAutonomyConfig,
  type LimitsConfigOverrides,
  createLimitsConfig,
  type ModelsConfigOverrides,
  createModelsConfig,
  type UIConfigOverrides,
  createUIConfig,
  type GitConfigOverrides,
  createGitConfig,
  type WorktreeConfigOverrides,
  createWorktreeConfig,
  type ToolConfigOverrides,
  createToolConfig,
  type ServiceConfigOverrides,
  createServiceConfig,
  type DaemonConfigOverrides,
  createDaemonConfig,
  type ApexConfigOverrides,
  createApexConfig,
  createDevelopmentConfig,
  createProductionConfig,
  createTestingConfig,
  createEnvironmentConfigs,
  createAutonomyLevelConfigs,
  createConfigValidationScenarios,
} from './config-factory.js';

// Re-export log-factory (this is the preferred source for logging-related factories)
export {
  createTaskLog as createEnhancedTaskLog,
  type LogRotationConfigOverrides,
  createLogRotationConfig,
  type LoggingConfigOverrides,
  createLoggingConfig as createEnhancedLoggingConfig,
  createDebugLog,
  createInfoLog,
  createWarnLog,
  createErrorLog,
  createTaskExecutionLogs,
  createFailedTaskLogs,
  createMixedLevelLogs,
  createLoggingConfigs,
  createLogTestScenarios,
} from './log-factory.js';

export * from './audit-factory.js';
