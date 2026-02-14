/**
 * Comprehensive tests for all mock factories
 *
 * These tests verify that all factory functions:
 * 1. Generate valid objects that conform to their respective schemas
 * 2. Support partial overrides correctly
 * 3. Generate realistic test data
 * 4. Handle edge cases appropriately
 */

import { describe, test, expect } from 'vitest';
import { z } from 'zod';

// Import all factories
import {
  createTask,
  createTaskUsage,
  createTaskLog,
  createTaskArtifact,
  createAgentMessage,
  createTasks,
  createTaskLifecycle,
} from '../task-factory.js';

import {
  createAgent,
  createDeveloperAgent,
  createPlannerAgent,
  createTesterAgent,
  createReviewerAgent,
  createAgentTeam,
  createAgents,
  createAgentConversation,
} from '../agent-factory.js';

import {
  createWorkflow,
  createWorkflowStage,
  createWorkflowGate,
  createCodeOnlyWorkflow,
  createResearchWorkflow,
  createBugFixWorkflow,
  createStandardWorkflows,
  createWorkflows,
} from '../workflow-factory.js';

import {
  createPermission,
  createPermissionQuery,
  createExtendedPermission,
  createPermissionChangeEvent,
  createFilesystemPermissions,
  createShellPermissions,
  createWebPermissions,
  createDeveloperPermissions,
  createRestrictedPermissions,
  createTemporaryPermissions,
} from '../permission-factory.js';

import {
  createApexConfig,
  createProjectConfig,
  createAutonomyConfig,
  createLimitsConfig,
  createModelsConfig,
  createUIConfig,
  createGitConfig,
  createToolConfig,
  createDevelopmentConfig,
  createProductionConfig,
  createTestingConfig,
  createEnvironmentConfigs,
} from '../config-factory.js';

import {
  createTaskLog as createLogFromLogFactory,
  createDebugLog,
  createInfoLog,
  createWarnLog,
  createErrorLog,
  createTaskExecutionLogs,
  createFailedTaskLogs,
  createMixedLevelLogs,
  createLoggingConfigs,
} from '../log-factory.js';

import {
  createAuditLogEntry,
  createAutoFixResult,
  createAutoFixEvent,
  createTaskLifecycleAudits,
  createAgentHandoffAudits,
  createApprovalAudits,
  createSecurityAudits,
  createAutoFixSequence,
  createSeverityAudits,
} from '../audit-factory.js';

// Import type schemas for validation
import type {
  Task,
  AgentDefinition,
  WorkflowDefinition,
  Permission,
  ApexConfig,
  TaskLog,
  AuditLogEntry,
} from '../../types.js';

// ============================================================================
// Task Factory Tests
// ============================================================================

describe('Task Factory', () => {
  test('createTask generates valid task with defaults', () => {
    const task = createTask();

    expect(task).toBeDefined();
    expect(task.id).toMatch(/^task_\d+_[a-z0-9]+$/);
    expect(task.description).toBe('Create mock task for testing');
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('normal');
    expect(task.effort).toBe('medium');
    expect(task.workflow).toBe('feature-development');
    expect(task.autonomy).toBe('supervised');
    expect(task.retryCount).toBe(0);
    expect(task.maxRetries).toBe(3);
    expect(task.usage).toBeDefined();
    expect(task.logs).toHaveLength(1);
    expect(task.artifacts).toHaveLength(0);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);
  });

  test('createTask supports partial overrides', () => {
    const overrides = {
      description: 'Custom task description',
      priority: 'urgent' as const,
      effort: 'large' as const,
      status: 'in-progress' as const,
      branchName: 'feature/custom-branch',
    };

    const task = createTask(overrides);

    expect(task.description).toBe('Custom task description');
    expect(task.priority).toBe('urgent');
    expect(task.effort).toBe('large');
    expect(task.status).toBe('in-progress');
    expect(task.branchName).toBe('feature/custom-branch');

    // Verify defaults are still applied for non-overridden fields
    expect(task.workflow).toBe('feature-development');
    expect(task.retryCount).toBe(0);
  });

  test('createTasks generates multiple tasks with variations', () => {
    const tasks = createTasks(4);

    expect(tasks).toHaveLength(4);
    expect(tasks[0].id).toMatch(/^task_\d+_000$/);
    expect(tasks[3].id).toMatch(/^task_\d+_003$/);

    // Verify different priorities are assigned
    const priorities = tasks.map(t => t.priority);
    expect(priorities).toEqual(['low', 'normal', 'high', 'urgent']);

    // Verify different statuses are assigned
    const statuses = tasks.map(t => t.status);
    expect(statuses).toEqual(['pending', 'queued', 'in-progress', 'completed']);
  });

  test('createTaskLifecycle generates tasks in different states', () => {
    const lifecycle = createTaskLifecycle({ description: 'Test lifecycle task' });

    expect(lifecycle.pending.status).toBe('pending');
    expect(lifecycle.inProgress.status).toBe('in-progress');
    expect(lifecycle.inProgress.currentStage).toBe('implementation');
    expect(lifecycle.inProgress.logs).toHaveLength(2);
    expect(lifecycle.completed.status).toBe('completed');
    expect(lifecycle.completed.completedAt).toBeInstanceOf(Date);
    expect(lifecycle.completed.artifacts).toHaveLength(2);
    expect(lifecycle.failed.status).toBe('failed');
    expect(lifecycle.failed.error).toContain('TypeScript errors');
  });

  test('createTaskUsage generates valid usage statistics', () => {
    const usage = createTaskUsage();

    expect(usage.inputTokens).toBe(1500);
    expect(usage.outputTokens).toBe(800);
    expect(usage.totalTokens).toBe(2300);
    expect(usage.estimatedCost).toBe(0.023);
    expect(usage.totalCostCents).toBe(23);
    expect(usage.executionTimeMs).toBe(5000);
  });

  test('createTaskLog generates valid log entry', () => {
    const log = createTaskLog();

    expect(log.timestamp).toBeInstanceOf(Date);
    expect(log.level).toBe('info');
    expect(log.stage).toBe('implementation');
    expect(log.agent).toBe('developer');
    expect(log.message).toBe('Task execution in progress');
    expect(log.metadata).toBeDefined();
  });

  test('createTaskArtifact generates valid artifact', () => {
    const artifact = createTaskArtifact();

    expect(artifact.name).toBe('LoginComponent.tsx');
    expect(artifact.type).toBe('file');
    expect(artifact.path).toBe('/src/components/LoginComponent.tsx');
    expect(artifact.content).toContain('import React');
    expect(artifact.createdAt).toBeInstanceOf(Date);
  });
});

// ============================================================================
// Agent Factory Tests
// ============================================================================

describe('Agent Factory', () => {
  test('createAgent generates valid agent with defaults', () => {
    const agent = createAgent();

    expect(agent.name).toBe('developer');
    expect(agent.description).toContain('software developer agent');
    expect(agent.prompt).toContain('senior software developer');
    expect(agent.tools).toContain('Read');
    expect(agent.tools).toContain('Write');
    expect(agent.tools).toContain('Edit');
    expect(agent.model).toBe('sonnet');
    expect(agent.skills).toContain('typescript');
  });

  test('createAgent supports partial overrides', () => {
    const overrides = {
      name: 'custom-agent',
      description: 'Custom agent for specialized tasks',
      tools: ['Read', 'WebSearch'],
      model: 'opus' as const,
      skills: ['research', 'analysis'],
    };

    const agent = createAgent(overrides);

    expect(agent.name).toBe('custom-agent');
    expect(agent.description).toBe('Custom agent for specialized tasks');
    expect(agent.tools).toEqual(['Read', 'WebSearch']);
    expect(agent.model).toBe('opus');
    expect(agent.skills).toEqual(['research', 'analysis']);
  });

  test('specialized agent factories create appropriate configurations', () => {
    const developer = createDeveloperAgent();
    const planner = createPlannerAgent();
    const tester = createTesterAgent();
    const reviewer = createReviewerAgent();

    expect(developer.name).toBe('developer');
    expect(developer.tools).toContain('LSP');
    expect(developer.skills).toContain('git');

    expect(planner.name).toBe('planner');
    expect(planner.model).toBe('opus');
    expect(planner.skills).toContain('planning');

    expect(tester.name).toBe('tester');
    expect(tester.skills).toContain('testing');

    expect(reviewer.name).toBe('reviewer');
    expect(reviewer.skills).toContain('security');
  });

  test('createAgentTeam generates complete team', () => {
    const team = createAgentTeam();

    expect(team.planner).toBeDefined();
    expect(team.architect).toBeDefined();
    expect(team.developer).toBeDefined();
    expect(team.tester).toBeDefined();
    expect(team.reviewer).toBeDefined();
    expect(team.devops).toBeDefined();

    expect(team.planner.name).toBe('planner');
    expect(team.developer.name).toBe('developer');
  });

  test('createAgents generates multiple agents with variations', () => {
    const agents = createAgents(4);

    expect(agents).toHaveLength(4);
    expect(agents[0].name).toMatch(/frontend-dev-1/);
    expect(agents[1].name).toMatch(/backend-dev-2/);
    expect(agents[2].name).toMatch(/full-stack-dev-3/);
    expect(agents[3].name).toMatch(/qa-engineer-4/);
  });

  test('createAgentConversation generates message history', () => {
    const conversation = createAgentConversation(3);

    expect(conversation).toHaveLength(4); // 1 user + 3 assistant messages
    expect(conversation[0].role).toBe('user');
    expect(conversation[1].role).toBe('assistant');
    expect(conversation[1].agent).toBe('planner');
    expect(conversation[2].agent).toBe('developer');
    expect(conversation[3].agent).toBe('tester');
  });
});

// ============================================================================
// Workflow Factory Tests
// ============================================================================

describe('Workflow Factory', () => {
  test('createWorkflow generates valid workflow with defaults', () => {
    const workflow = createWorkflow();

    expect(workflow.name).toBe('feature-development');
    expect(workflow.description).toContain('Complete feature development workflow');
    expect(workflow.version).toBe('1.0.0');
    expect(workflow.stages).toHaveLength(6);
    expect(workflow.defaultAgent).toBe('developer');
    expect(workflow.timeout).toBe(3600000);
    expect(workflow.retryPolicy).toBeDefined();
    expect(workflow.isolation).toBeDefined();
  });

  test('createWorkflow supports partial overrides', () => {
    const overrides = {
      name: 'custom-workflow',
      description: 'Custom workflow for specialized tasks',
      stages: [
        createWorkflowStage({ name: 'analysis', agent: 'analyst' }),
      ],
      timeout: 1800000,
    };

    const workflow = createWorkflow(overrides);

    expect(workflow.name).toBe('custom-workflow');
    expect(workflow.description).toBe('Custom workflow for specialized tasks');
    expect(workflow.stages).toHaveLength(1);
    expect(workflow.timeout).toBe(1800000);
  });

  test('createWorkflowStage generates valid stage', () => {
    const stage = createWorkflowStage();

    expect(stage.name).toBe('implementation');
    expect(stage.agent).toBe('developer');
    expect(stage.description).toContain('Implement the requested feature');
    expect(stage.dependsOn).toEqual(['planning']);
    expect(stage.parallel).toBe(false);
    expect(stage.retryable).toBe(true);
    expect(stage.maxRetries).toBe(3);
    expect(stage.tools).toContain('Read');
  });

  test('createWorkflowGate generates valid gate', () => {
    const gate = createWorkflowGate();

    expect(gate.type).toBe('approval');
    expect(gate.condition).toContain('stage.success');
    expect(gate.timeout).toBe(3600000);
    expect(gate.approvers).toContain('tech-lead@company.com');
    expect(gate.autoApprove).toBe(false);
  });

  test('specialized workflow factories create appropriate configurations', () => {
    const codeOnly = createCodeOnlyWorkflow();
    const research = createResearchWorkflow();
    const bugFix = createBugFixWorkflow();

    expect(codeOnly.name).toBe('code-only');
    expect(codeOnly.stages).toHaveLength(2);

    expect(research.name).toBe('research');
    expect(research.stages[0].tools).toContain('WebSearch');

    expect(bugFix.name).toBe('bug-fix');
    expect(bugFix.retryPolicy?.maxAttempts).toBe(2);
  });

  test('createStandardWorkflows generates complete workflow set', () => {
    const workflows = createStandardWorkflows();

    expect(workflows.feature).toBeDefined();
    expect(workflows.bugfix).toBeDefined();
    expect(workflows.research).toBeDefined();
    expect(workflows.codeOnly).toBeDefined();

    expect(workflows.feature.name).toBe('feature-development');
    expect(workflows.bugfix.name).toBe('bug-fix');
  });
});

// ============================================================================
// Permission Factory Tests
// ============================================================================

describe('Permission Factory', () => {
  test('createPermission generates valid permission with defaults', () => {
    const permission = createPermission();

    expect(permission.tool).toBe('Read');
    expect(permission.scope).toBe('/src/**/*.ts');
    expect(permission.level).toBe('allow-always');
    expect(permission.createdAt).toBeInstanceOf(Date);
    expect(permission.expiry).toBeUndefined();
  });

  test('createPermission supports partial overrides', () => {
    const expiry = new Date(Date.now() + 3600000);
    const overrides = {
      tool: 'Write',
      scope: '/src/components/**/*',
      level: 'allow-once' as const,
      expiry,
    };

    const permission = createPermission(overrides);

    expect(permission.tool).toBe('Write');
    expect(permission.scope).toBe('/src/components/**/*');
    expect(permission.level).toBe('allow-once');
    expect(permission.expiry).toBe(expiry);
  });

  test('createExtendedPermission includes additional metadata', () => {
    const extended = createExtendedPermission();

    expect(extended.grantedBy).toBe('user@example.com');
    expect(extended.reason).toContain('Development work');
    expect(extended.context).toBeDefined();
    expect(extended.usageCount).toBe(15);
    expect(extended.lastUsed).toBeInstanceOf(Date);
  });

  test('specialized permission factories create appropriate sets', () => {
    const filesystem = createFilesystemPermissions();
    const shell = createShellPermissions();
    const web = createWebPermissions();

    expect(filesystem.readSource.tool).toBe('Read');
    expect(filesystem.writeSource.tool).toBe('Write');

    expect(shell.basicCommands.scope).toContain('ls');
    expect(shell.dangerousCommands.level).toBe('deny');

    expect(web.documentation.tool).toBe('WebSearch');
    expect(web.socialMedia.level).toBe('deny');
  });

  test('createDeveloperPermissions generates comprehensive permission set', () => {
    const permissions = createDeveloperPermissions();

    expect(permissions.length).toBeGreaterThan(5);

    const tools = permissions.map(p => p.tool);
    expect(tools).toContain('Read');
    expect(tools).toContain('Bash');
    expect(tools).toContain('WebSearch');
  });

  test('createTemporaryPermissions generates expiring permissions', () => {
    const permissions = createTemporaryPermissions(4);

    expect(permissions).toHaveLength(4);
    permissions.forEach(permission => {
      expect(permission.expiry).toBeInstanceOf(Date);
      expect(permission.expiry!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  test('createPermissionChangeEvent generates valid event', () => {
    const event = createPermissionChangeEvent();

    expect(event.changeType).toBe('granted');
    expect(event.permission).toBeDefined();
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.message).toContain('granted');
    expect(event.metadata).toBeDefined();
  });
});

// ============================================================================
// Config Factory Tests
// ============================================================================

describe('Config Factory', () => {
  test('createApexConfig generates valid config with defaults', () => {
    const config = createApexConfig();

    expect(config.version).toBe('0.5.0');
    expect(config.project).toBeDefined();
    expect(config.autonomy).toBeDefined();
    expect(config.limits).toBeDefined();
    expect(config.models).toBeDefined();
    expect(config.ui).toBeDefined();
    expect(config.git).toBeDefined();
    expect(config.tools).toBeDefined();
    expect(config.logging).toBeDefined();
    expect(config.service).toBeDefined();
    expect(config.daemon).toBeDefined();
  });

  test('createApexConfig supports partial overrides', () => {
    const overrides = {
      version: '1.0.0',
      autonomy: createAutonomyConfig({ defaultLevel: 'full' }),
      limits: createLimitsConfig({ maxConcurrentTasks: 10 }),
    };

    const config = createApexConfig(overrides);

    expect(config.version).toBe('1.0.0');
    expect(config.autonomy.defaultLevel).toBe('full');
    expect(config.limits.maxConcurrentTasks).toBe(10);

    // Verify other defaults are preserved
    expect(config.project.name).toBe('apex-test-project');
  });

  test('specialized config factories create appropriate configurations', () => {
    const dev = createDevelopmentConfig();
    const prod = createProductionConfig();
    const test = createTestingConfig();

    expect(dev.autonomy.defaultLevel).toBe('full');
    expect(dev.autonomy.requireApproval).toBe(false);

    expect(prod.autonomy.defaultLevel).toBe('ask-first');
    expect(prod.autonomy.requireApproval).toBe(true);

    expect(test.autonomy.timeoutMinutes).toBe(10);
    expect(test.git.enabled).toBe(false);
  });

  test('createEnvironmentConfigs generates config set', () => {
    const configs = createEnvironmentConfigs();

    expect(configs.development).toBeDefined();
    expect(configs.staging).toBeDefined();
    expect(configs.production).toBeDefined();
    expect(configs.testing).toBeDefined();

    expect(configs.development.autonomy.defaultLevel).toBe('full');
    expect(configs.production.autonomy.defaultLevel).toBe('ask-first');
  });

  test('createProjectConfig generates valid project info', () => {
    const project = createProjectConfig();

    expect(project.name).toBe('apex-test-project');
    expect(project.description).toContain('Test project');
    expect(project.version).toBe('1.0.0');
    expect(project.framework).toBe('react');
    expect(project.language).toBe('typescript');
  });

  test('createToolConfig generates valid tool permissions', () => {
    const tools = createToolConfig();

    expect(tools.Read.enabled).toBe(true);
    expect(tools.Write.enabled).toBe(true);
    expect(tools.Bash.allowedCommands).toContain('ls');
    expect(tools.WebFetch.enabled).toBe(false);
  });
});

// ============================================================================
// Log Factory Tests
// ============================================================================

describe('Log Factory', () => {
  test('createTaskLog generates valid log entry', () => {
    const log = createLogFromLogFactory();

    expect(log.timestamp).toBeInstanceOf(Date);
    expect(log.level).toBe('info');
    expect(log.stage).toBe('implementation');
    expect(log.agent).toBe('developer');
    expect(log.message).toBe('Task execution in progress');
    expect(log.metadata.step).toBe(1);
  });

  test('specialized log factories create appropriate entries', () => {
    const debug = createDebugLog();
    const info = createInfoLog();
    const warn = createWarnLog();
    const error = createErrorLog();

    expect(debug.level).toBe('debug');
    expect(debug.metadata.function).toBe('processTask');

    expect(info.level).toBe('info');
    expect(info.message).toContain('started successfully');

    expect(warn.level).toBe('warn');
    expect(warn.metadata.quotaUsed).toBe(1800);

    expect(error.level).toBe('error');
    expect(error.metadata.exitCode).toBe(1);
  });

  test('createTaskExecutionLogs generates complete log sequence', () => {
    const logs = createTaskExecutionLogs();

    expect(logs).toHaveLength(7);
    expect(logs[0].message).toContain('queued');
    expect(logs[1].stage).toBe('planning');
    expect(logs[6].message).toContain('completed');

    // Verify timestamps are sequential
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i].timestamp.getTime()).toBeGreaterThan(logs[i - 1].timestamp.getTime());
    }
  });

  test('createFailedTaskLogs generates failure sequence', () => {
    const logs = createFailedTaskLogs();

    expect(logs).toHaveLength(5);
    expect(logs[1].level).toBe('error');
    expect(logs[1].message).toContain('Build failed');
    expect(logs[4].message).toContain('failed after 2 attempts');
  });

  test('createMixedLevelLogs generates varied log levels', () => {
    const logs = createMixedLevelLogs(8);

    expect(logs).toHaveLength(8);

    const levels = logs.map(l => l.level);
    expect(levels).toEqual(['debug', 'info', 'warn', 'error', 'debug', 'info', 'warn', 'error']);
  });
});

// ============================================================================
// Audit Factory Tests
// ============================================================================

describe('Audit Factory', () => {
  test('createAuditLogEntry generates valid audit entry', () => {
    const audit = createAuditLogEntry();

    expect(audit.id).toMatch(/^audit_\d+_[a-z0-9]+$/);
    expect(audit.taskId).toMatch(/^task_[a-z0-9]+$/);
    expect(audit.eventType).toBe('task.created');
    expect(audit.severity).toBe('info');
    expect(audit.timestamp).toBeInstanceOf(Date);
    expect(audit.actor).toBe('system');
    expect(audit.success).toBe(true);
    expect(audit.correlationId).toMatch(/^corr_[a-z0-9]+$/);
  });

  test('createTaskLifecycleAudits generates complete lifecycle', () => {
    const lifecycle = createTaskLifecycleAudits('test-task-123');

    expect(lifecycle.created.eventType).toBe('task.created');
    expect(lifecycle.started.eventType).toBe('task.started');
    expect(lifecycle.completed.eventType).toBe('task.completed');

    // All should have same task ID
    expect(lifecycle.created.taskId).toBe('test-task-123');
    expect(lifecycle.started.taskId).toBe('test-task-123');
    expect(lifecycle.completed.taskId).toBe('test-task-123');

    // Verify state transitions
    expect(lifecycle.started.previousState).toBe('pending');
    expect(lifecycle.started.newState).toBe('in-progress');
    expect(lifecycle.completed.durationMs).toBe(40000);
  });

  test('createAgentHandoffAudits generates handoff sequence', () => {
    const handoffs = createAgentHandoffAudits();

    expect(handoffs).toHaveLength(3);
    expect(handoffs[0].eventType).toBe('agent.started');
    expect(handoffs[0].agent).toBe('planner');
    expect(handoffs[1].eventType).toBe('agent.completed');
    expect(handoffs[2].eventType).toBe('agent.handoff');
    expect(handoffs[2].metadata.previousAgent).toBe('planner');
    expect(handoffs[2].metadata.nextAgent).toBe('developer');
  });

  test('createApprovalAudits generates approval workflow', () => {
    const approvals = createApprovalAudits();

    expect(approvals.requested.eventType).toBe('approval.requested');
    expect(approvals.granted.eventType).toBe('approval.granted');
    expect(approvals.denied.eventType).toBe('approval.denied');
    expect(approvals.timeout.eventType).toBe('approval.timeout');

    expect(approvals.granted.actor).toBe('tech-lead@company.com');
    expect(approvals.timeout.success).toBe(false);
  });

  test('createSecurityAudits generates security events', () => {
    const security = createSecurityAudits();

    expect(security).toHaveLength(2);
    expect(security[0].eventType).toBe('security.policy_violation');
    expect(security[0].severity).toBe('critical');
    expect(security[0].success).toBe(false);
    expect(security[1].eventType).toBe('security.rate_limited');
    expect(security[1].severity).toBe('warn');
  });

  test('createAutoFixResult generates valid fix result', () => {
    const result = createAutoFixResult();

    expect(result.id).toMatch(/^autofix_\d+_[a-z0-9]+$/);
    expect(result.taskId).toMatch(/^task_[a-z0-9]+$/);
    expect(result.success).toBe(true);
    expect(result.fixType).toBe('syntax');
    expect(result.issuesFixed).toBe(3);
    expect(result.originalContent).toContain('Hello World');
    expect(result.fixedContent).toContain('Hello World";');
  });

  test('createAutoFixSequence generates complete fix operation', () => {
    const sequence = createAutoFixSequence();

    expect(sequence.start.eventType).toBe('auto-fix-start');
    expect(sequence.progress.eventType).toBe('auto-fix-progress');
    expect(sequence.complete.eventType).toBe('auto-fix-complete');

    expect(sequence.start.iterationCount).toBe(0);
    expect(sequence.progress.iterationCount).toBe(2);
    expect(sequence.complete.iterationCount).toBe(3);
    expect(sequence.complete.status).toBe('success');

    expect(sequence.result.success).toBe(true);
  });

  test('createSeverityAudits generates entries for all severity levels', () => {
    const audits = createSeverityAudits();

    expect(audits.debug).toHaveLength(1);
    expect(audits.info).toHaveLength(1);
    expect(audits.warn).toHaveLength(1);
    expect(audits.error).toHaveLength(1);
    expect(audits.critical).toHaveLength(1);

    expect(audits.debug[0].severity).toBe('debug');
    expect(audits.critical[0].severity).toBe('critical');
    expect(audits.critical[0].success).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Factory Integration', () => {
  test('factories work together to create complete scenarios', () => {
    // Create a complete task scenario
    const task = createTask({
      description: 'Integration test task',
      workflow: 'feature-development',
    });

    const workflow = createWorkflow({
      name: 'feature-development',
    });

    const agent = createDeveloperAgent();
    const config = createDevelopmentConfig();
    const permissions = createDeveloperPermissions();

    // Verify they all work together
    expect(task.workflow).toBe(workflow.name);
    expect(workflow.defaultAgent).toBe('developer');
    expect(agent.name).toBe('developer');
    expect(config.autonomy.defaultLevel).toBe('full');
    expect(permissions.some(p => p.tool === 'Read')).toBe(true);
  });

  test('factories generate consistent IDs and timestamps', () => {
    const task1 = createTask();
    const task2 = createTask();

    // IDs should be unique
    expect(task1.id).not.toBe(task2.id);

    // Timestamps should be recent and reasonable
    const now = Date.now();
    expect(task1.createdAt.getTime()).toBeLessThanOrEqual(now);
    expect(task1.createdAt.getTime()).toBeGreaterThan(now - 10000); // Within 10 seconds
  });

  test('all factories support partial overrides without breaking', () => {
    // Test that all main factories can handle partial overrides
    expect(() => createTask({ priority: 'high' })).not.toThrow();
    expect(() => createAgent({ model: 'opus' })).not.toThrow();
    expect(() => createWorkflow({ timeout: 5000 })).not.toThrow();
    expect(() => createPermission({ level: 'deny' })).not.toThrow();
    expect(() => createApexConfig({ version: '2.0.0' })).not.toThrow();
    expect(() => createTaskLog({ level: 'error' })).not.toThrow();
    expect(() => createAuditLogEntry({ severity: 'critical' })).not.toThrow();
  });

  test('factory outputs have consistent structure and types', () => {
    const task = createTask();
    const agent = createAgent();
    const workflow = createWorkflow();

    // Verify all have required string identifiers
    expect(typeof task.id).toBe('string');
    expect(typeof agent.name).toBe('string');
    expect(typeof workflow.name).toBe('string');

    // Verify timestamps are Date objects
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);

    // Verify arrays are proper arrays
    expect(Array.isArray(task.logs)).toBe(true);
    expect(Array.isArray(agent.tools)).toBe(true);
    expect(Array.isArray(workflow.stages)).toBe(true);
  });
});