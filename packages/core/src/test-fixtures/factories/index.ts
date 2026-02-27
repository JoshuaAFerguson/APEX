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

// Enhanced autonomy factories with intuitive naming
export {
  AutonomyFixturesEnhanced,
  createSemiAutoConfig,
  createManualConfig,
  createSupervisedConfig,
  createTestingAutonomyConfig,
  createApexConfigWithEnhancedAutonomy,
  getAllAutonomyConfigVariations,
  validateEnhancedAutonomyConfig,
  createAutonomyABTestConfigs
} from '../../test-utils/autonomy-fixtures-enhanced.js';

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

// Agent factories
export {
  createAgent,
  createPlannerAgent,
  createArchitectAgent,
  createDeveloperAgent,
  createTesterAgent,
  createReviewerAgent,
  createDevOpsAgent,
  createMinimalAgent,
  createFullFeaturedAgent,
  createModelSpecificAgent,
  AgentPresets,
  createWorkflowAgentCollection,
  createAgentVariants,
  validateAgentDefinition
} from './agent-factory.js';

// Workflow factories
export {
  createWorkflowDefinition,
  createWorkflowStage,
  createWorkflowGate,
  createFeatureWorkflow,
  createHotfixWorkflow,
  createBugfixWorkflow,
  createEnhancementWorkflow,
  createRefactorWorkflow,
  createMinimalWorkflow,
  createParallelWorkflow,
  createPlanningStage,
  createArchitectureStage,
  createImplementationStage,
  createTestingStage,
  createReviewStage,
  createDeploymentStage,
  createApprovalGate as createWorkflowApprovalGate,
  createQualityGate,
  createSecurityGate,
  createDeploymentGate,
  WorkflowPresets,
  createWorkflowTypeCollection,
  createWorkflowStageCollection,
  createWorkflowVariants,
  validateWorkflowDefinition,
  validateWorkflowStage,
  validateWorkflowGate
} from './workflow-factory.js';