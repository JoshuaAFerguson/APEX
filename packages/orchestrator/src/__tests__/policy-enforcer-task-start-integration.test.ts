/**
 * @fileoverview Unit tests for policy check at task start integration
 *
 * This test suite verifies the specific acceptance criteria:
 * (1) checkTaskStart is called on task execution
 * (2) tasks are blocked when error-severity violations exist
 * (3) tasks proceed with warning-level violations
 * (4) task state correctly reflects policy check results
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import { PolicyEnforcer } from '../policy/policy-enforcer.js';
import type {
  PolicyConfig,
  Task,
  PolicyEvaluationResult,
} from '@apexcli/core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// ============================================================================
// Test Setup and Helpers
// ============================================================================

/**
 * Creates a test policy configuration with specified enforcement mode
 */
function createPolicyConfig(enforcement: 'strict' | 'warn' | 'audit' = 'warn'): PolicyConfig {
  return {
    enabled: true,
    enforcement,
    name: 'test-policy-v1',
    allowedPaths: {
      mode: 'allowlist',
      allow: ['src/**', 'tests/**', 'lib/**'],
      block: ['src/secrets/**', '**/*.private', 'config/production.*'],
      sensitivePatterns: ['**/.env*', '**/*.key', '**/credentials.*'],
    },
    approvalRules: {
      enabled: true,
      rules: [
        {
          id: 'high-cost-approval',
          name: 'High Cost Task Approval',
          enabled: true,
          conditions: [{
            type: 'cost-threshold',
            threshold: 10.0,
          }],
          urgency: 'high',
          timeoutMinutes: 30,
          minApprovals: 2,
          approvers: ['tech-lead', 'finance-admin'],
        },
        {
          id: 'production-workflow',
          name: 'Production Workflow Approval',
          enabled: true,
          conditions: [{
            type: 'operation',
            operations: ['deploy', 'release'],
          }],
          urgency: 'critical',
          timeoutMinutes: 15,
          minApprovals: 3,
          approvers: ['devops-team', 'security-team'],
        },
      ],
    },
  };
}

/**
 * Creates task creation options for testing
 */
function createTestTaskOptions(overrides: {
  description?: string;
  acceptanceCriteria?: string;
  workflow?: string;
  autonomy?: Task['autonomy'];
  priority?: Task['priority'];
  effort?: Task['effort'];
  maxRetries?: number;
  dependsOn?: string[];
  parentTaskId?: string;
} = {}) {
  return {
    description: 'Test task for policy integration',
    workflow: 'feature-development',
    autonomy: 'autonomous' as const,
    priority: 'medium' as const,
    effort: 'medium' as const,
    maxRetries: 3,
    ...overrides,
  };
}

describe('Policy Check at Task Start Integration', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let checkTaskStartSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create temporary directory for test setup
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-policy-task-start-'));

    // Create minimal config structure
    const configDir = path.join(tempDir, '.apex');
    fs.mkdirSync(configDir, { recursive: true });

    const configContent = `
version: '1.0'
projectPath: ${tempDir}

agents:
  - id: test-developer
    name: Test Developer
    role: developer
    instructions: Test developer agent
    autonomyLevel: 3

workflows:
  feature-development:
    name: Feature Development
    description: Standard feature development workflow
    agents: [test-developer]
    stages:
      - name: development
        agent: test-developer
        inputs: []
        outputs: []

  production-deployment:
    name: Production Deployment
    description: Production deployment workflow
    agents: [test-developer]
    stages:
      - name: deployment
        agent: test-developer
        inputs: []
        outputs: []
`;

    fs.writeFileSync(path.join(configDir, 'config.yaml'), configContent);

    // Initialize orchestrator with policy configuration
    const policyConfig = createPolicyConfig('warn');
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      policyConfig,
    });

    // Spy on checkTaskStart method
    checkTaskStartSpy = vi.spyOn(PolicyEnforcer.prototype, 'checkTaskStart');

    // Mock the actual task execution to avoid Claude API calls
    vi.spyOn(orchestrator as any, 'runWorkflowForTask').mockResolvedValue({
      success: true,
      result: 'Task completed successfully',
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Reset all mocks
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Acceptance Criteria (1): checkTaskStart is called on task execution
  // ============================================================================

  describe('checkTaskStart method invocation', () => {
    it('should call checkTaskStart when executeTask is invoked', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Simple task to verify checkTaskStart is called',
        priority: 'medium',
        effort: 'small',
      });

      const task = await orchestrator.createTask(taskOptions);

      // Execute the task
      await orchestrator.executeTask(task.id);

      // Verify checkTaskStart was called
      expect(checkTaskStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          description: taskOptions.description,
          workflow: taskOptions.workflow,
          priority: taskOptions.priority,
          effort: taskOptions.effort,
        })
      );
      expect(checkTaskStartSpy).toHaveBeenCalledTimes(1);
    });

    it('should call checkTaskStart with correct task context', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task to verify context passed to checkTaskStart',
        workflow: 'production-deployment',
        priority: 'critical',
      });

      const task = await orchestrator.createTask(taskOptions);

      await orchestrator.executeTask(task.id);

      expect(checkTaskStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: 'production-deployment',
          priority: 'critical',
        })
      );
    });

    it('should call checkTaskStart before workflow execution', async () => {
      const workflowSpy = vi.spyOn(orchestrator as any, 'runWorkflowForTask');
      const taskOptions = createTestTaskOptions();
      const task = await orchestrator.createTask(taskOptions);

      await orchestrator.executeTask(task.id);

      // Verify order of calls
      expect(checkTaskStartSpy).toHaveBeenCalled();
      expect(workflowSpy).toHaveBeenCalled();

      // checkTaskStart should be called before workflow execution
      const checkTaskStartCallOrder = checkTaskStartSpy.mock.invocationCallOrder[0];
      const workflowCallOrder = workflowSpy.mock.invocationCallOrder[0];
      expect(checkTaskStartCallOrder).toBeLessThan(workflowCallOrder);
    });
  });

  // ============================================================================
  // Acceptance Criteria (2): tasks are blocked when error-severity violations exist
  // ============================================================================

  describe('task blocking with error-severity violations', () => {
    beforeEach(() => {
      // Use strict enforcement mode for these tests
      const strictPolicyConfig = createPolicyConfig('strict');
      orchestrator = new ApexOrchestrator({
        projectPath: tempDir,
        policyConfig: strictPolicyConfig,
      });

      // Re-spy after recreating orchestrator
      checkTaskStartSpy = vi.spyOn(PolicyEnforcer.prototype, 'checkTaskStart');
      vi.spyOn(orchestrator as any, 'runWorkflowForTask').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });
    });

    it('should block task execution with production workflow (error-level violation)', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Production deployment task that should be blocked',
        workflow: 'production-deployment', // Will trigger production-deployment approval rule
        priority: 'critical',
      });

      // Mock checkTaskStart to return error-level violation
      checkTaskStartSpy.mockReturnValue({
        passed: false,
        passedCount: 0,
        failedCount: 1,
        warningCount: 0,
        results: [{
          passed: false,
          ruleId: 'production-deployment',
          ruleName: 'Production Deployment Approval',
          ruleType: 'approval',
          message: 'Production deployments require approval',
          severity: 'error',
          details: {
            workflow: 'production-deployment',
            urgency: 'critical',
          },
        }],
        requiresApproval: true,
        triggeredApprovalRules: ['production-workflow'],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      // Task execution should be blocked and throw an error
      await expect(orchestrator.executeTask(task.id)).rejects.toThrow(/policy violations/);

      // Verify task status is failed
      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('failed');
    });

    it('should block task with high cost (error-level violation)', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'High-cost task that should be blocked',
      });

      // Mock checkTaskStart to return high-cost error
      checkTaskStartSpy.mockReturnValue({
        passed: false,
        passedCount: 0,
        failedCount: 1,
        warningCount: 0,
        results: [{
          passed: false,
          ruleId: 'high-cost-approval',
          ruleName: 'High Cost Task Approval',
          ruleType: 'approval',
          message: 'High-cost tasks require approval ($25.00)',
          severity: 'error',
          details: {
            estimatedCost: 25.0,
            urgency: 'high',
          },
        }],
        requiresApproval: true,
        triggeredApprovalRules: ['high-cost-approval'],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow(/policy violations/);

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('failed');
    });

    it('should store policy violations when task is blocked', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task to test violation storage',
        workflow: 'production-deployment',
      });

      const mockPolicyResult: PolicyEvaluationResult = {
        passed: false,
        passedCount: 0,
        failedCount: 2,
        warningCount: 0,
        results: [
          {
            passed: false,
            ruleId: 'production-deployment',
            ruleName: 'Production Deployment',
            ruleType: 'approval',
            message: 'Production deployment requires approval',
            severity: 'error',
            details: { workflow: 'production-deployment' },
          },
          {
            passed: false,
            ruleId: 'blocked-path',
            ruleName: 'File Path Access',
            ruleType: 'path',
            message: 'Access to blocked path',
            severity: 'error',
            details: { filePath: 'src/secrets/api.key' },
          },
        ],
        requiresApproval: true,
        triggeredApprovalRules: ['production-workflow'],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      };

      checkTaskStartSpy.mockReturnValue(mockPolicyResult);

      const task = await orchestrator.createTask(taskOptions);

      try {
        await orchestrator.executeTask(task.id);
      } catch (error) {
        // Expected to throw
      }

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.policyCheckResult).toBeDefined();
      expect(updatedTask?.policyCheckResult?.passed).toBe(false);
      expect(updatedTask?.policyCheckResult?.violations).toHaveLength(2);
      expect(updatedTask?.policyCheckResult?.violations?.[0]?.ruleId).toBe('production-deployment');
      expect(updatedTask?.policyCheckResult?.violations?.[1]?.ruleId).toBe('blocked-path');
    });
  });

  // ============================================================================
  // Acceptance Criteria (3): tasks proceed with warning-level violations
  // ============================================================================

  describe('task continuation with warning-level violations', () => {
    it('should allow task execution with warning violations in warn mode', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task with warnings should proceed',
        priority: 'critical', // Will generate warning in evaluateTaskPolicies
        effort: 'large', // Will generate info-level result
      });

      // Mock checkTaskStart to return warnings only
      checkTaskStartSpy.mockReturnValue({
        passed: true, // In warn mode, warnings don't fail the check
        passedCount: 0,
        failedCount: 0,
        warningCount: 2,
        results: [
          {
            passed: false,
            ruleId: 'critical-task-review',
            ruleName: 'Critical Task Review',
            ruleType: 'task',
            message: 'Critical priority tasks require review',
            severity: 'warning',
            details: { taskPriority: 'critical' },
          },
          {
            passed: false,
            ruleId: 'large-effort-review',
            ruleName: 'Large Effort Review',
            ruleType: 'task',
            message: 'Large effort tasks should be monitored',
            severity: 'info',
            details: { taskEffort: 'large' },
          },
        ],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      // Task should execute successfully despite warnings
      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('in-progress');
    });

    it('should proceed with sensitive file warnings in warn mode', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task accessing sensitive files with warnings',
      });

      checkTaskStartSpy.mockReturnValue({
        passed: true,
        passedCount: 1,
        failedCount: 0,
        warningCount: 1,
        results: [
          {
            passed: false,
            ruleId: 'sensitive-file-access',
            ruleName: 'Sensitive File Access',
            ruleType: 'path',
            message: 'Accessing potentially sensitive file',
            severity: 'warning',
            details: {
              filePath: 'config/staging.env',
              context: { isSensitive: true },
            },
          },
        ],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('in-progress');
      expect(updatedTask?.policyCheckResult?.warningCount).toBe(1);
    });

    it('should block with warnings in strict mode', async () => {
      // Use strict enforcement mode
      const strictPolicyConfig = createPolicyConfig('strict');
      orchestrator = new ApexOrchestrator({
        projectPath: tempDir,
        policyConfig: strictPolicyConfig,
      });

      checkTaskStartSpy = vi.spyOn(PolicyEnforcer.prototype, 'checkTaskStart');
      vi.spyOn(orchestrator as any, 'runWorkflowForTask').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskOptions = createTestTaskOptions({
        description: 'Task with warnings should be blocked in strict mode',
        priority: 'critical',
      });

      checkTaskStartSpy.mockReturnValue({
        passed: false, // In strict mode, warnings fail the check
        passedCount: 0,
        failedCount: 0,
        warningCount: 1,
        results: [{
          passed: false,
          ruleId: 'critical-task-review',
          ruleName: 'Critical Task Review',
          ruleType: 'task',
          message: 'Critical priority tasks require review',
          severity: 'warning',
          details: { taskPriority: 'critical' },
        }],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      await expect(orchestrator.executeTask(task.id)).rejects.toThrow(/policy violations/);

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('failed');
    });
  });

  // ============================================================================
  // Acceptance Criteria (4): task state correctly reflects policy check results
  // ============================================================================

  describe('task state reflects policy check results', () => {
    it('should store complete policy check results in task state', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task to verify complete policy result storage',
        priority: 'medium',
        effort: 'small',
      });

      const mockPolicyResult: PolicyEvaluationResult = {
        passed: true,
        passedCount: 3,
        failedCount: 0,
        warningCount: 1,
        results: [
          {
            passed: true,
            ruleId: 'path-allowed',
            ruleName: 'Path Access Allowed',
            ruleType: 'path',
            message: 'File path is within allowed directories',
            severity: 'info',
            details: { filePath: 'src/components/Button.tsx' },
          },
          {
            passed: false,
            ruleId: 'sensitive-pattern',
            ruleName: 'Sensitive File Pattern',
            ruleType: 'path',
            message: 'File matches sensitive pattern but is allowed',
            severity: 'warning',
            details: {
              filePath: 'config/test.env',
              context: { isSensitive: true, allowedOverride: true },
            },
          },
        ],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date('2024-01-15T10:30:00Z'),
        policyName: 'test-policy-v1',
      };

      checkTaskStartSpy.mockReturnValue(mockPolicyResult);

      const task = await orchestrator.createTask(taskOptions);
      await orchestrator.executeTask(task.id);

      const updatedTask = await orchestrator.store.getTask(task.id);
      const policyCheckResult = updatedTask?.policyCheckResult;

      // Verify all policy result fields are stored correctly
      expect(policyCheckResult).toBeDefined();
      expect(policyCheckResult?.passed).toBe(true);
      expect(policyCheckResult?.checkedAt).toBeInstanceOf(Date);
      expect(policyCheckResult?.policyName).toBe('test-policy-v1');
      expect(policyCheckResult?.enforcementMode).toBe('warn');

      // Verify violations are stored correctly
      expect(policyCheckResult?.violations).toHaveLength(2);

      const pathViolation = policyCheckResult?.violations?.[0];
      expect(pathViolation?.ruleId).toBe('path-allowed');
      expect(pathViolation?.policyType).toBe('path');
      expect(pathViolation?.severity).toBe('info');
      expect(pathViolation?.message).toBe('File path is within allowed directories');
      expect(pathViolation?.filePath).toBe('src/components/Button.tsx');

      const sensitiveViolation = policyCheckResult?.violations?.[1];
      expect(sensitiveViolation?.ruleId).toBe('sensitive-pattern');
      expect(sensitiveViolation?.severity).toBe('warning');
      expect(sensitiveViolation?.context?.isSensitive).toBe(true);
    });

    it('should update task status correctly based on policy results', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task to verify status updates',
      });

      // Test successful policy check
      checkTaskStartSpy.mockReturnValue({
        passed: true,
        passedCount: 1,
        failedCount: 0,
        warningCount: 0,
        results: [],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      // Initially pending
      expect(task.status).toBe('pending');

      await orchestrator.executeTask(task.id);

      const successTask = await orchestrator.store.getTask(task.id);
      expect(successTask?.status).toBe('in-progress');
    });

    it('should preserve task metadata alongside policy results', async () => {
      const taskOptions = createTestTaskOptions({
        description: 'Task with metadata preservation test',
        priority: 'high',
        effort: 'medium',
      });

      checkTaskStartSpy.mockReturnValue({
        passed: true,
        passedCount: 1,
        failedCount: 0,
        warningCount: 0,
        results: [],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);
      await orchestrator.executeTask(task.id);

      const updatedTask = await orchestrator.store.getTask(task.id);

      // Verify original task properties are preserved
      expect(updatedTask?.description).toBe(taskOptions.description);
      expect(updatedTask?.priority).toBe(taskOptions.priority);
      expect(updatedTask?.effort).toBe(taskOptions.effort);
      expect(updatedTask?.usage).toBeDefined();

      // And policy results are added
      expect(updatedTask?.policyCheckResult).toBeDefined();
      expect(updatedTask?.policyCheckResult?.passed).toBe(true);
    });

    it('should handle audit mode correctly in task state', async () => {
      // Use audit enforcement mode
      const auditPolicyConfig = createPolicyConfig('audit');
      orchestrator = new ApexOrchestrator({
        projectPath: tempDir,
        policyConfig: auditPolicyConfig,
      });

      checkTaskStartSpy = vi.spyOn(PolicyEnforcer.prototype, 'checkTaskStart');
      vi.spyOn(orchestrator as any, 'runWorkflowForTask').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskOptions = createTestTaskOptions({
        description: 'Task in audit mode',
        workflow: 'production-deployment', // Would normally trigger errors
      });

      checkTaskStartSpy.mockReturnValue({
        passed: true, // Audit mode always passes
        passedCount: 0,
        failedCount: 1, // But still records violations
        warningCount: 0,
        results: [{
          passed: false,
          ruleId: 'production-deployment',
          ruleName: 'Production Deployment',
          ruleType: 'approval',
          message: 'Production deployment detected (audit only)',
          severity: 'error',
          details: { workflow: 'production-deployment' },
        }],
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      // Should not throw even with error-level violations in audit mode
      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('in-progress');
      expect(updatedTask?.policyCheckResult?.passed).toBe(true);
      expect(updatedTask?.policyCheckResult?.enforcementMode).toBe('audit');
      expect(updatedTask?.policyCheckResult?.violations).toHaveLength(1);
    });
  });

  // ============================================================================
  // Edge Cases and Integration Robustness
  // ============================================================================

  describe('edge cases and robustness', () => {
    it('should handle missing policy configuration gracefully', async () => {
      // Create orchestrator without policy config
      const orchestratorNoPolicyConfig = new ApexOrchestrator({
        projectPath: tempDir,
        // No policyConfig provided
      });

      vi.spyOn(orchestratorNoPolicyConfig as any, 'runWorkflowForTask').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskOptions = createTestTaskOptions();
      const task = await orchestratorNoPolicyConfig.createTask(taskOptions);

      // Should not throw even without policy config
      await expect(orchestratorNoPolicyConfig.executeTask(task.id)).resolves.not.toThrow();

      const updatedTask = await orchestratorNoPolicyConfig.store.getTask(task.id);
      expect(updatedTask?.status).toBe('in-progress');
    });

    it('should handle policy enforcer errors gracefully', async () => {
      const taskOptions = createTestTaskOptions();

      // Mock checkTaskStart to throw an error
      checkTaskStartSpy.mockImplementation(() => {
        throw new Error('Policy enforcer internal error');
      });

      const task = await orchestrator.createTask(taskOptions);

      // Should handle policy enforcer errors and log them
      await expect(orchestrator.executeTask(task.id)).rejects.toThrow('Policy enforcer internal error');

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.status).toBe('failed');
    });

    it('should handle extremely large policy result sets', async () => {
      const taskOptions = createTestTaskOptions();

      // Mock a large number of violations
      const manyViolations = Array.from({ length: 1000 }, (_, i) => ({
        passed: false,
        ruleId: `violation-${i}`,
        ruleName: `Violation ${i}`,
        ruleType: 'path' as const,
        message: `Test violation ${i}`,
        severity: 'warning' as const,
        details: { filePath: `src/file${i}.ts` },
      }));

      checkTaskStartSpy.mockReturnValue({
        passed: true, // Warnings don't fail in warn mode
        passedCount: 0,
        failedCount: 0,
        warningCount: 1000,
        results: manyViolations,
        requiresApproval: false,
        triggeredApprovalRules: [],
        evaluatedAt: new Date(),
        policyName: 'test-policy-v1',
      });

      const task = await orchestrator.createTask(taskOptions);

      await expect(orchestrator.executeTask(task.id)).resolves.not.toThrow();

      const updatedTask = await orchestrator.store.getTask(task.id);
      expect(updatedTask?.policyCheckResult?.violations).toHaveLength(1000);
    });
  });
});