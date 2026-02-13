/**
 * @fileoverview Factory Fixtures Exports
 *
 * Centralized exports for all factory functions.
 */

// Task factories
export {
  createTask,
  createPendingTask,
  createRunningTask,
  createCompletedTask,
  createFailedTask,
  createPausedTask,
  createCancelledTask,
  createTaskWithWorkflow,
  createHighUsageTask,
  createTaskWithLogs,
  createTaskWithArtifacts,
  TaskPresets
} from './task-factory.js';

// Tool factories
export {
  createToolResult,
  createSuccessResult,
  createFailureResult,
  createToolExecution,
  createRunningExecution,
  createFailedExecution,
  createToolInvocation,
  createToolDefinition,
  ToolResponsePresets,
  ToolExecutionPresets,
  ToolInvocationPresets,
  FileSystemToolResponses,
  ShellToolResponses,
  WebToolResponses
} from './tool-factory.js';

// Autonomy factories
export {
  createAutonomyConfig,
  createAgentAutonomyOverride,
  createApprovalGate,
  createResourceLimits,
  createFullAutoConfig,
  createReviewBeforeCommitConfig,
  createReviewAllConfig,
  createTestAutonomyConfig,
  createRestrictiveConfig,
  createPermissiveConfig,
  AutonomyPresets,
  createAutonomyLevelCollection,
  createAutonomyVariants,
  validateAutonomyConfig
} from './autonomy-factory.js';

// Configuration factories
export {
  createProjectConfig,
  createIntegratedConfig,
  createFullAutoProjectConfig,
  createReviewBeforeCommitProjectConfig,
  createReviewAllProjectConfig,
  createStageSpecificConfigs,
  createResourceConstrainedConfigs,
  createAgentSpecificConfigs,
  ConfigPresets,
  validateProjectConfig,
  createAutonomyProjectCollection,
  createAutonomyComparisonConfigs
} from './config-factory.js';

// Permission factories
export {
  createToolPermission,
  createToolPermissionResult,
  createAlwaysAllowPermission,
  createAllowOncePermission,
  createDenyPermission,
  createFileSystemPermissions,
  createNetworkPermissions,
  createSystemPermissions,
  createSearchPermissions,
  createScopeBasedPermissions,
  createPermissionResults,
  createSecurityLevelPermissions,
  createStageBasedPermissions,
  PermissionPresets,
  createUniformPermissions,
  createPermissionVariants,
  validateToolPermission,
  createTimeBasedPermissions
} from './permission-factory.js';