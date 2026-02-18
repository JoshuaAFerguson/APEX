/**
 * @fileoverview Comprehensive integration tests for PolicyEnforcer full lifecycle
 *
 * This test suite covers the complete PolicyEnforcer lifecycle integration as specified
 * in the acceptance criteria:
 *
 * 1. PolicyEnforcer instantiation with config - Various policy configurations
 * 2. Policy checks at all 3 lifecycle points:
 *    - Task start (checkTaskStart)
 *    - File path validation (validateFilePath)
 *    - Approval requirements (checkApprovalRequired)
 * 3. Blocking behavior for different severity levels (info, warning, error, critical)
 * 4. Event propagation verification - policy:violation events
 * 5. Edge cases: no policies, all pass, mixed results
 *
 * Tests verify full end-to-end integration with ApexOrchestrator and the broader system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import { PolicyEnforcer } from '../policy/policy-enforcer.js';
import type {
  PolicyConfig,
  Task,
  PolicyEvaluationResult,
  PolicyValidationResult,
  PolicyViolationEvent,
  AgentConfig,
} from '@apexcli/core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// ============================================================================
// Test Configuration Helpers
// ============================================================================

/**
 * Creates a comprehensive policy configuration for lifecycle testing
 */
function createLifecyclePolicyConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    version: '1.0',
    name: 'lifecycle-test-policy',
    enabled: true,
    enforcement: 'warn',
    allowedPaths: {
      mode: 'allowlist',
      allow: ['src/**', 'tests/**', 'lib/**', 'docs/**'],
      block: ['src/secrets/**', '**/*.private', 'config/production.*', '**/.git/**'],
      sensitivePatterns: ['**/.env*', '**/*.key', '**/credentials.*', '**/config/staging.*'],
    },
    approvalRules: {
      enabled: true,
      rules: [
        {
          id: 'high-cost-threshold',
          name: 'High Cost Operations',
          description: 'Operations with high computational cost require approval',
          enabled: true,
          priority: 100,
          conditions: [{
            type: 'cost-threshold',
            threshold: 5.0,
          }],
          urgency: 'high',
          timeoutMinutes: 30,
          minApprovals: 2,
          approvers: ['tech-lead', 'finance-admin'],
          timeoutAction: 'reject',
        },
        {
          id: 'production-operations',
          name: 'Production Operations',
          description: 'Any production-related operations require approval',
          enabled: true,
          priority: 200,
          conditions: [
            {
              type: 'operation',
              operations: ['deploy', 'release', 'rollback'],
            },
            {
              type: 'file-pattern',
              patterns: ['**/production.*', '**/prod-*'],
            },
          ],
          requireAllConditions: false,
          urgency: 'critical',
          timeoutMinutes: 15,
          minApprovals: 3,
          approvers: ['devops-team', 'security-team', 'product-owner'],
          timeoutAction: 'escalate',
        },
        {
          id: 'sensitive-file-access',
          name: 'Sensitive File Access',
          description: 'Access to sensitive files requires approval',
          enabled: true,
          priority: 150,
          conditions: [{
            type: 'file-pattern',
            patterns: ['**/.env*', '**/*.key', '**/secrets/**'],
          }],
          urgency: 'normal',
          timeoutMinutes: 60,
          minApprovals: 1,
          approvers: ['security-team'],
          timeoutAction: 'reject',
        },
        {
          id: 'token-usage-limit',
          name: 'High Token Usage',
          description: 'Tasks with high token usage require approval',
          enabled: true,
          priority: 50,
          conditions: [{
            type: 'token-threshold',
            threshold: 10000,
          }],
          urgency: 'normal',
          timeoutMinutes: 45,
          minApprovals: 1,
          approvers: ['tech-lead'],
          timeoutAction: 'approve',
        },
      ],
    },
    ...overrides,
  };
}

/**
 * Creates a test agent configuration
 */
function createTestAgent(): AgentConfig {
  return {
    id: 'lifecycle-test-agent',
    name: 'Lifecycle Test Agent',
    role: 'developer',
    instructions: 'Test agent for lifecycle integration testing',
    autonomyLevel: 3,
  };
}

/**
 * Creates a test task with specified properties
 */
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: randomUUID(),
    title: 'Lifecycle Integration Test Task',
    description: 'Test task for PolicyEnforcer lifecycle integration',
    status: 'pending',
    agent: 'lifecycle-test-agent',
    workflow: 'feature-development',
    priority: 'medium',
    effort: 'medium',
    context: {},
    usage: {
      totalTokens: 2000,
      inputTokens: 1200,
      outputTokens: 800,
      estimatedCost: 1.5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PolicyEnforcer Full Lifecycle Integration', () => {
  let orchestrator: ApexOrchestrator;
  let policyEnforcer: PolicyEnforcer;
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    // Create temporary directory for test configuration
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-policy-lifecycle-'));
    configPath = path.join(tempDir, 'config.yaml');

    // Create minimal APEX configuration
    const configContent = `
version: '1.0'
projectPath: ${tempDir}

agents:
  - id: lifecycle-test-agent
    name: Lifecycle Test Agent
    role: developer
    instructions: Test agent for lifecycle integration testing
    autonomyLevel: 3

workflows:
  feature-development:
    name: Feature Development
    description: Standard feature development workflow
    agents: [lifecycle-test-agent]
    stages:
      - name: implementation
        agent: lifecycle-test-agent
        inputs: []
        outputs: []

  production-deployment:
    name: Production Deployment
    description: Production deployment workflow requiring approval
    agents: [lifecycle-test-agent]
    stages:
      - name: deployment
        agent: lifecycle-test-agent
        inputs: []
        outputs: []

  data-migration:
    name: Data Migration
    description: Database migration workflow
    agents: [lifecycle-test-agent]
    stages:
      - name: migration
        agent: lifecycle-test-agent
        inputs: []
        outputs: []
`;

    fs.writeFileSync(configPath, configContent);

    // Initialize orchestrator with comprehensive policy configuration
    const policyConfig = createLifecyclePolicyConfig();
    orchestrator = new ApexOrchestrator({
      configPath,
      policyConfig,
    });

    policyEnforcer = orchestrator.policyEnforcer;

    // Mock task execution to avoid Claude API calls
    vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
      success: true,
      result: 'Task completed successfully',
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. PolicyEnforcer Instantiation with Config
  // ============================================================================

  describe('PolicyEnforcer instantiation with various configurations', () => {
    it('should instantiate PolicyEnforcer with minimal config', () => {
      const minimalConfig: PolicyConfig = {
        version: '1.0',
        enabled: true,
        enforcement: 'audit',
      };

      const enforcer = new PolicyEnforcer(minimalConfig);

      expect(enforcer.policyConfig).toEqual(minimalConfig);
      expect(enforcer.enforcementMode).toBe('audit');
      expect(enforcer.isEnabled).toBe(true);
    });

    it('should instantiate PolicyEnforcer with comprehensive config', () => {
      const config = createLifecyclePolicyConfig();
      const enforcer = new PolicyEnforcer(config);

      expect(enforcer.policyConfig).toEqual(config);
      expect(enforcer.enforcementMode).toBe('warn');
      expect(enforcer.isEnabled).toBe(true);
      expect(enforcer.policyConfig.allowedPaths?.allow).toEqual(['src/**', 'tests/**', 'lib/**', 'docs/**']);
      expect(enforcer.policyConfig.approvalRules?.rules).toHaveLength(4);
    });

    it('should handle disabled policy configuration', () => {
      const disabledConfig = createLifecyclePolicyConfig({ enabled: false });
      const enforcer = new PolicyEnforcer(disabledConfig);

      expect(enforcer.isEnabled).toBe(false);
      expect(enforcer.enforcementMode).toBe('warn');
    });

    it('should handle different enforcement modes', () => {
      const modes: Array<PolicyConfig['enforcement']> = ['strict', 'warn', 'audit', 'disabled'];

      for (const mode of modes) {
        const config = createLifecyclePolicyConfig({ enforcement: mode });
        const enforcer = new PolicyEnforcer(config);

        expect(enforcer.enforcementMode).toBe(mode || 'warn');
      }
    });
  });

  // ============================================================================
  // 2. Policy Checks at All 3 Lifecycle Points
  // ============================================================================

  describe('Policy checks at all lifecycle points', () => {
    describe('Lifecycle Point 1: Task Start (checkTaskStart)', () => {
      it('should perform comprehensive policy check at task start', async () => {
        const task = createTestTask({
          title: 'Task Start Policy Check',
          workflow: 'feature-development',
          priority: 'high',
          effort: 'large',
          usage: {
            totalTokens: 8000,
            inputTokens: 5000,
            outputTokens: 3000,
            estimatedCost: 3.5,
          },
        });

        const context = {
          projectPaths: ['src/components/Button.tsx', 'tests/Button.test.ts'],
          operationType: 'development',
          metadata: { feature: 'ui-components' },
        };

        const result = policyEnforcer.checkTaskStart(task, context);

        expect(result).toBeDefined();
        expect(result.policyName).toBe('lifecycle-test-policy');
        expect(result.evaluatedAt).toBeInstanceOf(Date);
        expect(typeof result.passed).toBe('boolean');
        expect(Array.isArray(result.results)).toBe(true);
        expect(typeof result.requiresApproval).toBe('boolean');
      });

      it('should detect high-cost task requiring approval', async () => {
        const highCostTask = createTestTask({
          title: 'High Cost Task',
          usage: {
            totalTokens: 15000,
            inputTokens: 10000,
            outputTokens: 5000,
            estimatedCost: 8.5, // Exceeds 5.0 threshold
          },
        });

        const result = policyEnforcer.checkTaskStart(highCostTask);

        expect(result.requiresApproval).toBe(true);
        expect(result.triggeredApprovalRules).toContain('high-cost-threshold');
        expect(result.failedCount).toBeGreaterThan(0);
      });

      it('should detect production workflow requiring approval', async () => {
        const productionTask = createTestTask({
          title: 'Production Deployment Task',
          workflow: 'production-deployment',
        });

        const result = policyEnforcer.checkTaskStart(productionTask, {
          operationType: 'deploy',
        });

        expect(result.requiresApproval).toBe(true);
        expect(result.triggeredApprovalRules).toContain('production-operations');
      });

      it('should validate against urgent task policies', async () => {
        const urgentTask = createTestTask({
          title: 'Urgent Priority Task',
          priority: 'urgent',
        });

        const result = policyEnforcer.checkTaskStart(urgentTask);

        // Should generate a warning for urgent tasks per evaluateTaskPolicies
        expect(result.warningCount).toBeGreaterThan(0);
        const urgentWarning = result.results.find(r => r.ruleId.includes('urgent'));
        expect(urgentWarning?.severity).toBe('warning');
      });
    });

    describe('Lifecycle Point 2: File Path Validation (validateFilePath)', () => {
      it('should validate allowed file paths', () => {
        const allowedPaths = [
          'src/components/Header.tsx',
          'tests/integration/api.test.ts',
          'lib/utils/format.ts',
          'docs/README.md',
        ];

        for (const filePath of allowedPaths) {
          const violations = policyEnforcer.validateFilePath(filePath);
          expect(violations).toHaveLength(0);
        }
      });

      it('should detect blocked file paths', () => {
        const blockedPaths = [
          'src/secrets/api-keys.ts',
          'config/production.yaml',
          '.git/config',
          'temp/data.private',
        ];

        for (const filePath of blockedPaths) {
          const violations = policyEnforcer.validateFilePath(filePath);
          expect(violations.length).toBeGreaterThan(0);
          expect(violations[0].policyType).toBe('path');
          expect(violations[0].rule).toBe('path-validation');
        }
      });

      it('should detect sensitive file patterns requiring approval', () => {
        const sensitivePaths = [
          '.env.local',
          'config/staging.env',
          'keys/ssl.key',
          'src/credentials.json',
        ];

        for (const filePath of sensitivePaths) {
          const violations = policyEnforcer.validateFilePath(filePath);

          // Should have sensitive pattern violation
          const sensitiveViolation = violations.find(v => v.rule === 'sensitive-path');
          expect(sensitiveViolation).toBeDefined();
          expect(sensitiveViolation?.context?.requiresApproval).toBe(true);
        }
      });

      it('should emit policy violation events for file validation', () => {
        const events: PolicyViolationEvent[] = [];
        policyEnforcer.on('policy:violation', (event) => events.push(event));

        const context = {
          taskId: 'task-123',
          agentId: 'agent-456',
          workflowId: 'workflow-789',
        };

        // Trigger violation
        policyEnforcer.validateFilePath('src/secrets/database.key', context);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('policy_violation');
        expect(events[0].taskId).toBe('task-123');
        expect(events[0].agentId).toBe('agent-456');
        expect(events[0].workflowId).toBe('workflow-789');
        expect(events[0].violation.resource).toBe('src/secrets/database.key');
      });

      it('should handle path validation with different enforcement modes', () => {
        const strictConfig = createLifecyclePolicyConfig({ enforcement: 'strict' });
        const strictEnforcer = new PolicyEnforcer(strictConfig);

        const violations = strictEnforcer.validateFilePath('src/secrets/api.key');
        expect(violations[0].severity).toBe('critical'); // Strict mode
        expect(violations[0].blocking).toBe(true);
      });
    });

    describe('Lifecycle Point 3: Approval Requirements (checkApprovalRequired)', () => {
      it('should check approval requirements for different operations', () => {
        const task = createTestTask();

        const operations = [
          { action: 'deploy', shouldRequire: true },
          { action: 'release', shouldRequire: true },
          { action: 'rollback', shouldRequire: true },
          { action: 'test', shouldRequire: false },
          { action: 'build', shouldRequire: false },
        ];

        for (const { action, shouldRequire } of operations) {
          const result = policyEnforcer.checkApprovalRequired(task, action);
          expect(result.required).toBe(shouldRequire);

          if (shouldRequire) {
            expect(result.triggeredRules.length).toBeGreaterThan(0);
            expect(result.urgency).toBeDefined();
            expect(result.timeoutMinutes).toBeGreaterThan(0);
          }
        }
      });

      it('should aggregate multiple approval rules correctly', () => {
        const highCostProductionTask = createTestTask({
          usage: {
            totalTokens: 15000,
            inputTokens: 10000,
            outputTokens: 5000,
            estimatedCost: 12.0, // High cost
          },
        });

        const context = {
          filePaths: ['config/production.yaml', '.env.prod'],
          operation: 'deploy' as const,
        };

        const result = policyEnforcer.checkApprovalRequired(
          highCostProductionTask,
          'deploy',
          context
        );

        expect(result.required).toBe(true);
        expect(result.triggeredRules.length).toBeGreaterThanOrEqual(2); // Both cost and production rules
        expect(result.urgency).toBe('critical'); // Highest urgency wins
        expect(result.minApprovals).toBe(3); // Highest requirement wins
        expect(result.requiredApprovers.length).toBeGreaterThan(0);
      });

      it('should handle token threshold approval rules', () => {
        const highTokenTask = createTestTask({
          usage: {
            totalTokens: 25000, // Exceeds 10000 threshold
            inputTokens: 15000,
            outputTokens: 10000,
            estimatedCost: 2.0,
          },
        });

        const result = policyEnforcer.checkApprovalRequired(highTokenTask, 'process');

        expect(result.required).toBe(true);
        expect(result.triggeredRules.some(rule => rule.id === 'token-usage-limit')).toBe(true);
      });

      it('should handle file pattern approval rules', () => {
        const task = createTestTask();
        const context = {
          filePaths: ['src/secrets/database.key', '.env.production'],
        };

        const result = policyEnforcer.checkApprovalRequired(task, 'access', context);

        expect(result.required).toBe(true);
        expect(result.triggeredRules.some(rule =>
          rule.id === 'sensitive-file-access' || rule.id === 'production-operations'
        )).toBe(true);
      });
    });
  });

  // ============================================================================
  // 3. Blocking Behavior for Different Severity Levels
  // ============================================================================

  describe('Blocking behavior for different severity levels', () => {
    it('should allow tasks in audit mode regardless of violations', async () => {
      const auditConfig = createLifecyclePolicyConfig({ enforcement: 'audit' });
      const auditOrchestrator = new ApexOrchestrator({
        configPath,
        policyConfig: auditConfig,
      });

      vi.spyOn(auditOrchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const task = await auditOrchestrator.createTask({
        description: 'Task with violations in audit mode',
        workflow: 'production-deployment', // Would trigger violations
        agent: createTestAgent(),
      });

      // Should not throw despite violations
      await expect(auditOrchestrator.startTask(task.id)).resolves.not.toThrow();

      const executedTask = await auditOrchestrator.getTask(task.id);
      expect(executedTask?.status).toBe('in-progress');
    });

    it('should allow tasks with warnings in warn mode', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with warnings',
        priority: 'urgent', // Generates warning
        effort: 'large', // Generates info
        agent: createTestAgent(),
      });

      await expect(orchestrator.startTask(task.id)).resolves.not.toThrow();

      const executedTask = await orchestrator.getTask(task.id);
      expect(executedTask?.status).toBe('in-progress');
      expect(executedTask?.policyCheckResult?.warningCount).toBeGreaterThan(0);
    });

    it('should block tasks with warnings in strict mode', async () => {
      const strictConfig = createLifecyclePolicyConfig({ enforcement: 'strict' });
      const strictOrchestrator = new ApexOrchestrator({
        configPath,
        policyConfig: strictConfig,
      });

      const task = await strictOrchestrator.createTask({
        description: 'Task with warnings should be blocked in strict mode',
        priority: 'urgent', // Generates warning
        agent: createTestAgent(),
      });

      await expect(strictOrchestrator.startTask(task.id)).rejects.toThrow(/policy violations/);

      const failedTask = await strictOrchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
    });

    it('should block tasks with error-level violations in warn mode', async () => {
      const task = await orchestrator.createTask({
        description: 'Task with production deployment (error-level)',
        workflow: 'production-deployment', // Triggers error-level violation
        agent: createTestAgent(),
      });

      await expect(orchestrator.startTask(task.id)).rejects.toThrow(/policy violations/);

      const failedTask = await orchestrator.getTask(task.id);
      expect(failedTask?.status).toBe('failed');
    });

    it('should properly categorize violations by severity', () => {
      const severityTests = [
        { path: 'src/main.ts', expectedSeverity: null }, // Allowed
        { path: 'config/staging.env', expectedSeverity: 'high' }, // Sensitive
        { path: 'src/secrets/key.pem', expectedSeverity: 'high' }, // Blocked
        { path: 'unauthorized/file.txt', expectedSeverity: 'high' }, // Not allowed
      ];

      for (const { path, expectedSeverity } of severityTests) {
        const violations = policyEnforcer.validateFilePath(path);

        if (expectedSeverity === null) {
          expect(violations).toHaveLength(0);
        } else {
          expect(violations.length).toBeGreaterThan(0);
          expect(violations[0].severity).toBe(expectedSeverity);
        }
      }
    });
  });

  // ============================================================================
  // 4. Event Propagation Verification
  // ============================================================================

  describe('Event propagation verification', () => {
    it('should emit policy:violation events throughout the lifecycle', () => {
      const events: PolicyViolationEvent[] = [];
      policyEnforcer.on('policy:violation', (event) => events.push(event));

      const context = {
        taskId: 'lifecycle-task-001',
        agentId: 'lifecycle-test-agent',
        workflowId: 'feature-development',
        metadata: { test: 'event-propagation' },
      };

      // Trigger multiple violations
      policyEnforcer.validateFilePath('src/secrets/config.key', context);
      policyEnforcer.validateFilePath('config/production.yaml', context);
      policyEnforcer.validateFilePath('.env.production', context);

      expect(events.length).toBeGreaterThanOrEqual(3);

      // Verify event structure and context propagation
      for (const event of events) {
        expect(event.type).toBe('policy_violation');
        expect(event.taskId).toBe('lifecycle-task-001');
        expect(event.agentId).toBe('lifecycle-test-agent');
        expect(event.workflowId).toBe('feature-development');
        expect(event.metadata?.test).toBe('event-propagation');
        expect(event.violation).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should emit events with correct violation details', () => {
      const events: PolicyViolationEvent[] = [];
      policyEnforcer.on('policy:violation', (event) => events.push(event));

      policyEnforcer.validateFilePath('src/secrets/database.key');

      expect(events).toHaveLength(1);
      const event = events[0];

      expect(event.violation.policyType).toBe('path');
      expect(event.violation.rule).toBe('path-validation');
      expect(event.violation.resource).toBe('src/secrets/database.key');
      expect(event.violation.context?.matchedPattern).toBe('src/secrets/**');
      expect(event.violation.context?.matchType).toBe('block');
    });

    it('should handle multiple concurrent event listeners', () => {
      const listener1Events: PolicyViolationEvent[] = [];
      const listener2Events: PolicyViolationEvent[] = [];
      const listener3Events: PolicyViolationEvent[] = [];

      policyEnforcer.on('policy:violation', (event) => listener1Events.push(event));
      policyEnforcer.on('policy:violation', (event) => listener2Events.push(event));
      policyEnforcer.on('policy:violation', (event) => listener3Events.push(event));

      policyEnforcer.validateFilePath('blocked/file.ts');

      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener3Events).toHaveLength(1);

      // All listeners should receive the same event
      expect(listener1Events[0].id).toBe(listener2Events[0].id);
      expect(listener2Events[0].id).toBe(listener3Events[0].id);
    });

    it('should maintain event emission performance under load', () => {
      const events: PolicyViolationEvent[] = [];
      policyEnforcer.on('policy:violation', (event) => events.push(event));

      const startTime = Date.now();

      // Emit many events
      for (let i = 0; i < 500; i++) {
        policyEnforcer.validateFilePath(`blocked/file-${i}.ts`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(events).toHaveLength(500);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  // ============================================================================
  // 5. Edge Cases: No Policies, All Pass, Mixed Results
  // ============================================================================

  describe('Edge cases: no policies, all pass, mixed results', () => {
    describe('No policies configured', () => {
      it('should handle empty policy configuration gracefully', () => {
        const emptyConfig: PolicyConfig = {
          version: '1.0',
          enabled: true,
          enforcement: 'warn',
        };

        const enforcer = new PolicyEnforcer(emptyConfig);
        const task = createTestTask();

        // No policies should mean everything passes
        const result = enforcer.checkTaskStart(task);
        expect(result.passed).toBe(true);
        expect(result.results).toHaveLength(0);
        expect(result.requiresApproval).toBe(false);

        const violations = enforcer.validateFilePath('any/path/file.ts');
        expect(violations).toHaveLength(0);

        const approvalResult = enforcer.checkApprovalRequired(task, 'any-action');
        expect(approvalResult.required).toBe(false);
      });

      it('should handle disabled policy configuration', () => {
        const disabledConfig = createLifecyclePolicyConfig({ enabled: false });
        const enforcer = new PolicyEnforcer(disabledConfig);
        const task = createTestTask();

        const result = enforcer.checkTaskStart(task);
        expect(result.passed).toBe(true);
        expect(result.results).toHaveLength(0);

        // No events should be emitted for disabled policy
        const events: PolicyViolationEvent[] = [];
        enforcer.on('policy:violation', (event) => events.push(event));

        enforcer.validateFilePath('src/secrets/key.pem');
        expect(events).toHaveLength(0);
      });

      it('should handle empty approval rules', () => {
        const noApprovalConfig = createLifecyclePolicyConfig({
          approvalRules: { enabled: false, rules: [] },
        });

        const enforcer = new PolicyEnforcer(noApprovalConfig);
        const task = createTestTask();

        const result = enforcer.checkApprovalRequired(task, 'deploy');
        expect(result.required).toBe(false);
        expect(result.triggeredRules).toHaveLength(0);
      });
    });

    describe('All policies pass', () => {
      it('should handle scenarios where all checks pass', async () => {
        const task = await orchestrator.createTask({
          description: 'Simple compliant task',
          workflow: 'feature-development',
          priority: 'medium',
          effort: 'small',
          usage: {
            totalTokens: 1000,
            inputTokens: 600,
            outputTokens: 400,
            estimatedCost: 0.5, // Below thresholds
          },
          agent: createTestAgent(),
        });

        await expect(orchestrator.startTask(task.id)).resolves.not.toThrow();

        const executedTask = await orchestrator.getTask(task.id);
        expect(executedTask?.status).toBe('in-progress');
        expect(executedTask?.policyCheckResult?.passed).toBe(true);
        expect(executedTask?.policyCheckResult?.failedCount).toBe(0);

        // Check individual policy components
        const pathViolations = policyEnforcer.validateFilePath('src/components/Button.tsx');
        expect(pathViolations).toHaveLength(0);

        const approvalResult = policyEnforcer.checkApprovalRequired(task, 'build');
        expect(approvalResult.required).toBe(false);
      });

      it('should record passed checks in policy results', () => {
        const allowedPaths = [
          'src/index.ts',
          'tests/unit/helper.ts',
          'lib/utils/format.js',
          'docs/api.md',
        ];

        for (const filePath of allowedPaths) {
          const violations = policyEnforcer.validateFilePath(filePath);
          expect(violations).toHaveLength(0);
        }
      });
    });

    describe('Mixed results scenarios', () => {
      it('should handle mixed violation severities correctly', () => {
        const config = createLifecyclePolicyConfig({ enforcement: 'warn' });
        const enforcer = new PolicyEnforcer(config);

        const task = createTestTask({
          priority: 'urgent', // Warning
          workflow: 'production-deployment', // Error (for approval)
          usage: {
            totalTokens: 15000, // Triggers token approval (normal)
            estimatedCost: 2.0, // Below cost threshold
            inputTokens: 10000,
            outputTokens: 5000,
          },
        });

        const result = enforcer.checkTaskStart(task, {
          projectPaths: ['src/main.ts', '.env.local'], // Mix of allowed and sensitive
          operationType: 'deploy',
        });

        // Should have mixed results
        expect(result.results.length).toBeGreaterThan(1);
        expect(result.warningCount).toBeGreaterThan(0);
        expect(result.failedCount).toBeGreaterThan(0);
        expect(result.requiresApproval).toBe(true);

        // In warn mode, only error-level violations should fail
        const hasErrors = result.results.some(r => r.severity === 'error');
        expect(result.passed).toBe(!hasErrors);
      });

      it('should correctly aggregate mixed approval rules', () => {
        const highCostSensitiveTask = createTestTask({
          usage: {
            totalTokens: 20000, // Triggers token rule
            estimatedCost: 7.0, // Triggers cost rule
            inputTokens: 12000,
            outputTokens: 8000,
          },
        });

        const context = {
          filePaths: ['.env.production', 'src/secrets/key.pem'], // Triggers file rules
          operation: 'deploy' as const, // Triggers production rule
        };

        const result = policyEnforcer.checkApprovalRequired(
          highCostSensitiveTask,
          'deploy',
          context
        );

        expect(result.required).toBe(true);
        expect(result.triggeredRules.length).toBeGreaterThanOrEqual(3); // Multiple rules triggered
        expect(result.urgency).toBe('critical'); // Highest urgency
        expect(result.minApprovals).toBe(3); // Highest requirement
        expect(result.requiredApprovers.length).toBeGreaterThan(2); // Union of approvers
      });

      it('should handle partial policy failures gracefully', () => {
        const events: PolicyViolationEvent[] = [];
        policyEnforcer.on('policy:violation', (event) => events.push(event));

        // Mix of valid and invalid paths
        const paths = [
          'src/components/Header.tsx', // Valid
          'src/secrets/api.key', // Blocked
          'tests/integration/test.ts', // Valid
          'config/production.yaml', // Blocked
          'lib/utils/helper.ts', // Valid
          '.env.staging', // Sensitive
        ];

        for (const path of paths) {
          policyEnforcer.validateFilePath(path);
        }

        // Should have events only for violations (not for valid paths)
        expect(events.length).toBe(3); // Blocked + Blocked + Sensitive

        const blockedEvents = events.filter(e =>
          e.violation.context?.matchType === 'block'
        );
        expect(blockedEvents).toHaveLength(2);

        const sensitiveEvents = events.filter(e =>
          e.violation.rule === 'sensitive-path'
        );
        expect(sensitiveEvents).toHaveLength(1);
      });

      it('should maintain policy state consistency across mixed scenarios', async () => {
        // Create a task that will trigger multiple policy conditions
        const complexTask = await orchestrator.createTask({
          description: 'Complex task with mixed policy results',
          workflow: 'production-deployment',
          priority: 'urgent',
          effort: 'large',
          usage: {
            totalTokens: 12000, // Triggers token threshold
            estimatedCost: 4.0, // Below cost threshold
            inputTokens: 7000,
            outputTokens: 5000,
          },
          agent: createTestAgent(),
        });

        // Should trigger blocking due to production workflow
        await expect(orchestrator.startTask(complexTask.id)).rejects.toThrow();

        const failedTask = await orchestrator.getTask(complexTask.id);
        expect(failedTask?.status).toBe('failed');
        expect(failedTask?.policyCheckResult?.passed).toBe(false);
        expect(failedTask?.policyCheckResult?.requiresApproval).toBe(true);

        // Should have multiple triggered rules recorded
        expect(failedTask?.policyCheckResult?.triggeredApprovalRules.length).toBeGreaterThan(0);
        expect(failedTask?.policyCheckResult?.violations?.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Integration with ApexOrchestrator
  // ============================================================================

  describe('Full integration with ApexOrchestrator', () => {
    it('should integrate seamlessly with task creation and execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Full integration test task',
        workflow: 'feature-development',
        agent: createTestAgent(),
      });

      await expect(orchestrator.startTask(task.id)).resolves.not.toThrow();

      const executedTask = await orchestrator.getTask(task.id);
      expect(executedTask?.policyCheckResult).toBeDefined();
      expect(executedTask?.policyCheckResult?.policyName).toBe('lifecycle-test-policy');
    });

    it('should persist policy results across orchestrator restarts', async () => {
      const task = await orchestrator.createTask({
        description: 'Persistence test task',
        agent: createTestAgent(),
      });

      await orchestrator.startTask(task.id);

      // Create new orchestrator instance (simulates restart)
      const newOrchestrator = new ApexOrchestrator({
        configPath,
        policyConfig: createLifecyclePolicyConfig(),
      });

      const persistedTask = await newOrchestrator.getTask(task.id);
      expect(persistedTask?.policyCheckResult).toBeDefined();
      expect(persistedTask?.policyCheckResult?.policyName).toBe('lifecycle-test-policy');
    });

    it('should handle concurrent task executions with policy checking', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({
          description: 'Concurrent task 1',
          agent: createTestAgent(),
        }),
        orchestrator.createTask({
          description: 'Concurrent task 2',
          agent: createTestAgent(),
        }),
        orchestrator.createTask({
          description: 'Concurrent task 3',
          agent: createTestAgent(),
        }),
      ]);

      const startTime = Date.now();

      await Promise.all(
        tasks.map(task => orchestrator.startTask(task.id))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All tasks should complete efficiently
      expect(duration).toBeLessThan(2000);

      // All tasks should have policy check results
      for (const task of tasks) {
        const executedTask = await orchestrator.getTask(task.id);
        expect(executedTask?.policyCheckResult).toBeDefined();
        expect(executedTask?.status).toBe('in-progress');
      }
    });
  });
});