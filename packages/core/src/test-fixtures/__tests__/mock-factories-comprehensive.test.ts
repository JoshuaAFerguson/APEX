/**
 * @fileoverview Comprehensive test suite for all mock factories
 *
 * This test file verifies that all mock factory functions:
 * - Generate valid objects that conform to their respective schemas
 * - Support partial overrides correctly
 * - Generate realistic test data suitable for testing
 * - Have proper TypeScript types and exports
 * - Work together in integration scenarios
 */

import { describe, test, expect } from 'vitest';

// Import all factory functions
import {
  // Task factories
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
  TaskPresets,

  // Tool factories
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
  WebToolResponses,

  // Autonomy factories
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
  validateAutonomyConfig,

  // Configuration factories
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
  createAutonomyComparisonConfigs,

  // Permission factories
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
  createTimeBasedPermissions,

  // Agent factories
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
  validateAgentDefinition,

  // Workflow factories
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
  validateWorkflowGate,
} from '../factories/index.js';

// Import from original source factories for completeness testing
import {
  createTask as createTaskFromSource,
  createTaskUsage,
  createTaskLog,
  createTaskArtifact,
  createAgentMessage,
  createWorkspaceConfig,
  createTaskSessionData,
  createThoughtCapture,
  createIterationHistory,
  createApprovalState,
  createSubtaskDefinition,
  createTaskDecomposition,
  createTasks,
  createTaskLifecycle,
} from '../../factories/task-factory.js';

import {
  createAgent as createAgentFromSource,
  createAgentMessage as createAgentMessageFromSource,
  createAgentAutonomyOverride as createAgentAutonomyOverrideFromSource,
  createDeveloperAgent as createDeveloperAgentFromSource,
  createPlannerAgent as createPlannerAgentFromSource,
  createTesterAgent as createTesterAgentFromSource,
  createReviewerAgent as createReviewerAgentFromSource,
  createAgentTeam,
  createAgents,
  createAgentConversation,
} from '../../factories/agent-factory.js';

import {
  createWorkflow,
  createWorkflowStage as createWorkflowStageFromSource,
  createWorkflowGate as createWorkflowGateFromSource,
  createIsolationConfig,
  createCodeOnlyWorkflow,
  createResearchWorkflow,
  createBugFixWorkflow,
  createStandardWorkflows,
  createWorkflows,
  createWorkflowExecution,
} from '../../factories/workflow-factory.js';

// ============================================================================
// Core Factory Coverage Tests
// ============================================================================

describe('Mock Factory Coverage', () => {
  describe('Task Factories', () => {
    test('all task factory functions are exported and work', () => {
      // Test main factory functions
      expect(createTask()).toBeDefined();
      expect(createPendingTask()).toBeDefined();
      expect(createRunningTask()).toBeDefined();
      expect(createCompletedTask()).toBeDefined();
      expect(createFailedTask()).toBeDefined();
      expect(createPausedTask()).toBeDefined();
      expect(createCancelledTask()).toBeDefined();

      // Test specialized factories
      expect(createTaskWithWorkflow()).toBeDefined();
      expect(createHighUsageTask()).toBeDefined();
      expect(createTaskWithLogs()).toBeDefined();
      expect(createTaskWithArtifacts()).toBeDefined();

      // Test presets
      expect(TaskPresets).toBeDefined();
      expect(TaskPresets.simple).toBeDefined();
    });

    test('task factory supports all required types', () => {
      const task = createTask();

      expect(typeof task.id).toBe('string');
      expect(typeof task.description).toBe('string');
      expect(task.status).toMatch(/^(pending|queued|in-progress|completed|failed|cancelled|paused)$/);
      expect(task.priority).toMatch(/^(low|normal|high|urgent)$/);
      expect(task.effort).toMatch(/^(trivial|small|medium|large|xl)$/);
    });

    test('source task factory functions work', () => {
      expect(createTaskFromSource()).toBeDefined();
      expect(createTaskUsage()).toBeDefined();
      expect(createTaskLog()).toBeDefined();
      expect(createTaskArtifact()).toBeDefined();
      expect(createAgentMessage()).toBeDefined();
      expect(createWorkspaceConfig()).toBeDefined();
    });
  });

  describe('Agent Factories', () => {
    test('all agent factory functions are exported and work', () => {
      // Test main factory functions
      expect(createAgent()).toBeDefined();
      expect(createPlannerAgent()).toBeDefined();
      expect(createArchitectAgent()).toBeDefined();
      expect(createDeveloperAgent()).toBeDefined();
      expect(createTesterAgent()).toBeDefined();
      expect(createReviewerAgent()).toBeDefined();
      expect(createDevOpsAgent()).toBeDefined();

      // Test specialized factories
      expect(createMinimalAgent()).toBeDefined();
      expect(createFullFeaturedAgent()).toBeDefined();
      expect(createModelSpecificAgent('sonnet')).toBeDefined();

      // Test collections
      expect(AgentPresets).toBeDefined();
      expect(createWorkflowAgentCollection()).toBeDefined();
    });

    test('agent factory supports all required properties', () => {
      const agent = createAgent();

      expect(typeof agent.name).toBe('string');
      expect(typeof agent.description).toBe('string');
      expect(typeof agent.prompt).toBe('string');
      expect(agent.model).toMatch(/^(opus|sonnet|haiku|inherit)$/);
    });

    test('source agent factory functions work', () => {
      expect(createAgentFromSource()).toBeDefined();
      expect(createAgentMessageFromSource()).toBeDefined();
      expect(createAgentAutonomyOverrideFromSource()).toBeDefined();
      expect(createAgentTeam()).toBeDefined();
    });
  });

  describe('Workflow Factories', () => {
    test('all workflow factory functions are exported and work', () => {
      // Test main factory functions
      expect(createWorkflowDefinition()).toBeDefined();
      expect(createWorkflowStage()).toBeDefined();
      expect(createWorkflowGate()).toBeDefined();

      // Test workflow type factories
      expect(createFeatureWorkflow()).toBeDefined();
      expect(createHotfixWorkflow()).toBeDefined();
      expect(createBugfixWorkflow()).toBeDefined();
      expect(createEnhancementWorkflow()).toBeDefined();
      expect(createRefactorWorkflow()).toBeDefined();

      // Test specialized factories
      expect(createMinimalWorkflow()).toBeDefined();
      expect(createParallelWorkflow()).toBeDefined();

      // Test stage factories
      expect(createPlanningStage()).toBeDefined();
      expect(createArchitectureStage()).toBeDefined();
      expect(createImplementationStage()).toBeDefined();
      expect(createTestingStage()).toBeDefined();
      expect(createReviewStage()).toBeDefined();
      expect(createDeploymentStage()).toBeDefined();

      // Test gate factories
      expect(createWorkflowApprovalGate()).toBeDefined();
      expect(createQualityGate()).toBeDefined();
      expect(createSecurityGate()).toBeDefined();
      expect(createDeploymentGate()).toBeDefined();
    });

    test('workflow factory supports all required properties', () => {
      const workflow = createWorkflowDefinition();

      expect(typeof workflow.name).toBe('string');
      expect(typeof workflow.description).toBe('string');
      expect(Array.isArray(workflow.stages)).toBe(true);
      expect(workflow.stages.length).toBeGreaterThan(0);
    });

    test('source workflow factory functions work', () => {
      expect(createWorkflow()).toBeDefined();
      expect(createWorkflowStageFromSource()).toBeDefined();
      expect(createWorkflowGateFromSource()).toBeDefined();
      expect(createIsolationConfig()).toBeDefined();
    });
  });

  describe('Tool Factories', () => {
    test('all tool factory functions are exported and work', () => {
      expect(createToolResult()).toBeDefined();
      expect(createSuccessResult()).toBeDefined();
      expect(createFailureResult()).toBeDefined();
      expect(createToolExecution()).toBeDefined();
      expect(createRunningExecution()).toBeDefined();
      expect(createFailedExecution()).toBeDefined();
    });

    test('tool presets are available', () => {
      expect(ToolResponsePresets).toBeDefined();
      expect(ToolExecutionPresets).toBeDefined();
      expect(ToolInvocationPresets).toBeDefined();
      expect(FileSystemToolResponses).toBeDefined();
      expect(ShellToolResponses).toBeDefined();
      expect(WebToolResponses).toBeDefined();
    });
  });

  describe('Permission Factories', () => {
    test('all permission factory functions are exported and work', () => {
      expect(createToolPermission()).toBeDefined();
      expect(createToolPermissionResult()).toBeDefined();
      expect(createAlwaysAllowPermission()).toBeDefined();
      expect(createAllowOncePermission()).toBeDefined();
      expect(createDenyPermission()).toBeDefined();
    });

    test('permission collection factories work', () => {
      expect(createFileSystemPermissions()).toBeDefined();
      expect(createNetworkPermissions()).toBeDefined();
      expect(createSystemPermissions()).toBeDefined();
      expect(createSearchPermissions()).toBeDefined();
    });

    test('permission presets are available', () => {
      expect(PermissionPresets).toBeDefined();
    });
  });

  describe('Autonomy Factories', () => {
    test('all autonomy factory functions are exported and work', () => {
      expect(createAutonomyConfig()).toBeDefined();
      expect(createAgentAutonomyOverride()).toBeDefined();
      expect(createApprovalGate()).toBeDefined();
      expect(createResourceLimits()).toBeDefined();
    });

    test('autonomy configuration presets work', () => {
      expect(createFullAutoConfig()).toBeDefined();
      expect(createReviewBeforeCommitConfig()).toBeDefined();
      expect(createReviewAllConfig()).toBeDefined();
      expect(createTestAutonomyConfig()).toBeDefined();
      expect(createRestrictiveConfig()).toBeDefined();
      expect(createPermissiveConfig()).toBeDefined();
    });

    test('autonomy presets are available', () => {
      expect(AutonomyPresets).toBeDefined();
    });
  });

  describe('Configuration Factories', () => {
    test('all configuration factory functions are exported and work', () => {
      expect(createProjectConfig()).toBeDefined();
      expect(createIntegratedConfig()).toBeDefined();
      expect(createFullAutoProjectConfig()).toBeDefined();
      expect(createReviewBeforeCommitProjectConfig()).toBeDefined();
      expect(createReviewAllProjectConfig()).toBeDefined();
    });

    test('configuration collection factories work', () => {
      expect(createStageSpecificConfigs()).toBeDefined();
      expect(createResourceConstrainedConfigs()).toBeDefined();
      expect(createAgentSpecificConfigs()).toBeDefined();
    });

    test('configuration presets are available', () => {
      expect(ConfigPresets).toBeDefined();
    });
  });
});

// ============================================================================
// Factory Integration Tests
// ============================================================================

describe('Factory Integration', () => {
  test('factories work together for complete workflow scenarios', () => {
    const task = createTask({
      description: 'Integration test task',
      workflow: 'feature-development',
      priority: 'high',
    });

    const workflow = createFeatureWorkflow({
      name: 'feature-development',
    });

    const agents = createWorkflowAgentCollection();
    const permissions = createFileSystemPermissions();
    const config = createFullAutoConfig();

    // Verify integration
    expect(task.workflow).toBe(workflow.name);
    expect(agents.developer).toBeDefined();
    expect(permissions.readSource).toBeDefined();
    expect(config.defaultLevel).toBe('full');
  });

  test('factory presets provide consistent configurations', () => {
    const taskPresets = TaskPresets;
    const agentPresets = AgentPresets;
    const workflowPresets = WorkflowPresets;
    const permissionPresets = PermissionPresets;
    const autonomyPresets = AutonomyPresets;

    // Verify presets exist and have expected structure
    expect(taskPresets.simple).toBeDefined();
    expect(agentPresets.workflow.developer).toBeDefined();
    expect(workflowPresets.types.feature).toBeDefined();
    expect(permissionPresets.development).toBeDefined();
    expect(autonomyPresets.levels.full).toBeDefined();
  });

  test('all factory functions support partial overrides', () => {
    // Test that main factory functions handle partial overrides without errors
    expect(() => createTask({ priority: 'urgent' })).not.toThrow();
    expect(() => createAgent({ model: 'opus' })).not.toThrow();
    expect(() => createWorkflowDefinition({ timeout: 5000 })).not.toThrow();
    expect(() => createToolPermission({ level: 'deny' })).not.toThrow();
    expect(() => createAutonomyConfig({ defaultLevel: 'full' })).not.toThrow();
    expect(() => createProjectConfig({ name: 'test-project' })).not.toThrow();
  });

  test('factory validation functions work correctly', () => {
    const agent = createAgent();
    const workflow = createWorkflowDefinition();
    const autonomy = createAutonomyConfig();
    const project = createProjectConfig();
    const permission = createToolPermission();

    expect(validateAgentDefinition(agent)).toBe(true);
    expect(validateWorkflowDefinition(workflow)).toBe(true);
    expect(validateAutonomyConfig(autonomy)).toBe(true);
    expect(validateProjectConfig(project)).toBe(true);
    expect(validateToolPermission(permission)).toBe(true);
  });
});

// ============================================================================
// Type Safety and Schema Compliance Tests
// ============================================================================

describe('Factory Type Safety', () => {
  test('all factory outputs match their TypeScript types', () => {
    const task = createTask();
    const agent = createAgent();
    const workflow = createWorkflowDefinition();

    // Verify core required properties exist and are correct type
    expect(typeof task.id).toBe('string');
    expect(typeof task.description).toBe('string');
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(Array.isArray(task.logs)).toBe(true);

    expect(typeof agent.name).toBe('string');
    expect(typeof agent.description).toBe('string');
    expect(typeof agent.prompt).toBe('string');

    expect(typeof workflow.name).toBe('string');
    expect(typeof workflow.description).toBe('string');
    expect(Array.isArray(workflow.stages)).toBe(true);
  });

  test('factory outputs include realistic test data', () => {
    const task = createTask();
    const agent = createDeveloperAgent();
    const workflow = createFeatureWorkflow();

    // Verify realistic defaults
    expect(task.description).toContain('mock');
    expect(task.status).toMatch(/^(pending|queued|in-progress|completed|failed|cancelled|paused)$/);
    expect(task.priority).toMatch(/^(low|normal|high|urgent)$/);

    expect(agent.name).toBe('developer');
    expect(agent.skills).toContain('coding');
    expect(agent.tools).toContain('Read');

    expect(workflow.name).toBe('feature-development');
    expect(workflow.stages.length).toBeGreaterThan(0);
    expect(workflow.stages[0].name).toBeDefined();
  });

  test('factories generate unique IDs consistently', () => {
    const task1 = createTask();
    const task2 = createTask();
    const workflow1 = createWorkflowDefinition();
    const workflow2 = createWorkflowDefinition();

    // IDs should be unique
    expect(task1.id).not.toBe(task2.id);
    expect(workflow1.name).not.toBe(workflow2.name);

    // IDs should follow expected patterns
    expect(task1.id).toMatch(/^task_\d+_[a-z0-9]+$/);
    expect(workflow1.name).toMatch(/test-workflow-workflow-\d+/);
  });
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe('Factory Edge Cases', () => {
  test('factories handle empty overrides gracefully', () => {
    expect(() => createTask({})).not.toThrow();
    expect(() => createAgent({})).not.toThrow();
    expect(() => createWorkflowDefinition({})).not.toThrow();
    expect(() => createToolPermission({})).not.toThrow();
    expect(() => createAutonomyConfig({})).not.toThrow();
  });

  test('factories handle undefined overrides gracefully', () => {
    expect(() => createTask(undefined as any)).not.toThrow();
    expect(() => createAgent(undefined as any)).not.toThrow();
    expect(() => createWorkflowDefinition(undefined as any)).not.toThrow();
  });

  test('collection factories handle different counts', () => {
    // Test with zero
    expect(createTaskWithLogs(0)).toHaveProperty('logs');

    // Test with different numbers
    const tasks = createTasks(3);
    expect(tasks).toHaveLength(3);

    const agents = createAgents(2);
    expect(agents).toHaveLength(2);

    const workflows = createWorkflows(1);
    expect(workflows).toHaveLength(1);
  });

  test('specialized factories maintain base functionality', () => {
    const minimal = createMinimalAgent();
    const fullFeatured = createFullFeaturedAgent();

    // Both should be valid agents
    expect(validateAgentDefinition(minimal)).toBe(true);
    expect(validateAgentDefinition(fullFeatured)).toBe(true);

    // But have different capabilities
    expect((minimal.tools || []).length).toBeLessThan((fullFeatured.tools || []).length);
  });
});

// ============================================================================
// Performance and Memory Tests
// ============================================================================

describe('Factory Performance', () => {
  test('factories can generate large numbers of objects efficiently', () => {
    const startTime = performance.now();

    // Generate a reasonable number of objects
    const tasks = Array.from({ length: 100 }, () => createTask());
    const agents = Array.from({ length: 50 }, () => createAgent());
    const workflows = Array.from({ length: 25 }, () => createWorkflowDefinition());

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (less than 1 second)
    expect(duration).toBeLessThan(1000);
    expect(tasks).toHaveLength(100);
    expect(agents).toHaveLength(50);
    expect(workflows).toHaveLength(25);
  });

  test('factory objects are properly structured (no excessive nesting)', () => {
    const task = createTask();
    const agent = createAgent();
    const workflow = createWorkflowDefinition();

    // JSON serialization should work without issues
    expect(() => JSON.stringify(task)).not.toThrow();
    expect(() => JSON.stringify(agent)).not.toThrow();
    expect(() => JSON.stringify(workflow)).not.toThrow();

    // Serialized size should be reasonable
    const taskJson = JSON.stringify(task);
    const agentJson = JSON.stringify(agent);

    expect(taskJson.length).toBeLessThan(10000); // Less than 10KB
    expect(agentJson.length).toBeLessThan(5000);  // Less than 5KB
  });
});