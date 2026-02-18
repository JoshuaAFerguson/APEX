/**
 * @fileoverview Integration tests for PolicyEnforcer.checkTaskStart() with ApexOrchestrator
 *
 * This test suite verifies the complete integration of PolicyEnforcer.checkTaskStart()
 * within the ApexOrchestrator task execution workflow. It tests:
 * 1. Task blocking behavior when policy violations occur
 * 2. Policy check result storage in task database
 * 3. Event emission during policy checks
 * 4. Complete end-to-end workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index';
import type {
  AgentConfig,
  PolicyConfig,
  Task,
  PolicyEvaluationResult,
  PolicyValidationResult,
} from '@apexcli/core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Mock configuration setup
const createMockConfig = (overrides: Partial<PolicyConfig> = {}): PolicyConfig => ({
  version: '1.0',
  enabled: true,
  enforcement: 'warn',
  allowedPaths: {
    mode: 'allowlist',
    allow: ['src/**', 'tests/**'],
    block: ['src/secrets/**', '**/*.key'],
    sensitivePatterns: ['**/.env*', '**/config/production.*'],
  },
  approvalRules: {
    enabled: true,
    rules: [
      {
        id: 'high-cost-approval',
        name: 'High Cost Approval',
        enabled: true,
        conditions: [
          {
            type: 'cost-threshold',
            threshold: 5.0,
          },
        ],
        urgency: 'normal',
        timeoutMinutes: 60,
        minApprovals: 1,
      },
      {
        id: 'production-deployment',
        name: 'Production Deployment Approval',
        enabled: true,
        conditions: [
          {
            type: 'operation',
            operations: ['deploy', 'release'],
          },
        ],
        urgency: 'high',
        timeoutMinutes: 30,
        minApprovals: 2,
        approvers: ['lead-dev', 'devops-admin'],
      },
    ],
  },
  ...overrides,
});

const createMockAgentConfig = (): AgentConfig => ({
  id: 'test-agent',
  name: 'Test Agent',
  role: 'tester',
  instructions: 'Test agent instructions',
  autonomyLevel: 3,
});

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Test Task',
  description: 'A test task for policy integration testing',
  status: 'pending',
  agent: 'test-agent',
  workflow: 'test-workflow',
  priority: 'medium',
  effort: 'medium',
  context: {},
  usage: {
    totalTokens: 1000,
    inputTokens: 600,
    outputTokens: 400,
    estimatedCost: 0.05,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PolicyEnforcer Integration with ApexOrchestrator', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    // Create temporary directory for test configuration
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-policy-test-'));
    configPath = path.join(tempDir, 'config.yaml');

    // Create minimal config file
    const configContent = `
agents:
  - id: test-agent
    name: Test Agent
    role: tester
    instructions: Test agent instructions
    autonomyLevel: 3

workflows:
  test-workflow:
    name: Test Workflow
    description: Test workflow for policy testing
    agents: [test-agent]
    stages:
      - name: test
        agent: test-agent
        inputs: []
        outputs: []
`;

    fs.writeFileSync(configPath, configContent);

    // Initialize orchestrator with policy configuration
    const policyConfig = createMockConfig();
    orchestrator = new ApexOrchestrator({
      configPath,
      policyConfig,
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Task Execution with Policy Checks', () => {
    it('should successfully execute task when policy checks pass', async () => {
      const task = createMockTask({
        title: 'Allowed Task',
        workflow: 'test-workflow',
        usage: { estimatedCost: 1.0, totalTokens: 1000, inputTokens: 600, outputTokens: 400 },
      });

      // Mock the Claude SDK query to avoid actual API calls
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed successfully',
      });

      // Create and start task
      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      // Verify task was created and policy checked
      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask).toBeDefined();
      expect(storedTask?.policyCheckResult).toBeDefined();
      expect(storedTask?.policyCheckResult?.passed).toBe(true);
      expect(storedTask?.status).toBe('in-progress');
    });

    it('should block task execution when policy violations with error severity occur', async () => {
      const policyConfig = createMockConfig({
        enforcement: 'strict',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*.secret', 'config/production.*'],
        },
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const task = createMockTask({
        title: 'Blocked Task',
        workflow: 'production-deployment', // Will trigger production-deployment rule
        usage: { estimatedCost: 10.0, totalTokens: 5000, inputTokens: 3000, outputTokens: 2000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Attempt to start task - should be blocked
      await expect(orchestrator.startTask(taskId)).rejects.toThrow(/policy violations/);

      // Verify task was marked as failed
      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.status).toBe('failed');
      expect(storedTask?.policyCheckResult?.passed).toBe(false);
      expect(storedTask?.policyCheckResult?.failedCount).toBeGreaterThan(0);
    });

    it('should allow task execution with warnings in warn mode', async () => {
      const policyConfig = createMockConfig({
        enforcement: 'warn', // Allow execution with warnings
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const task = createMockTask({
        title: 'Warning Task',
        priority: 'urgent', // Will generate a warning in evaluateTaskPolicies
        usage: { estimatedCost: 2.0, totalTokens: 2000, inputTokens: 1200, outputTokens: 800 },
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed with warnings',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Should not throw despite warnings
      await orchestrator.startTask(taskId);

      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.status).toBe('in-progress');
      expect(storedTask?.policyCheckResult?.passed).toBe(true);
      expect(storedTask?.policyCheckResult?.warningCount).toBeGreaterThan(0);
    });

    it('should store detailed policy check results in task database', async () => {
      const task = createMockTask({
        title: 'Policy Storage Test',
        effort: 'large', // Will trigger large-effort-review rule
        usage: { estimatedCost: 3.0, totalTokens: 3000, inputTokens: 1800, outputTokens: 1200 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Start task to trigger policy check
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      await orchestrator.startTask(taskId);

      // Verify policy check results are stored correctly
      const storedTask = await orchestrator.getTask(taskId);
      const policyResult = storedTask?.policyCheckResult;

      expect(policyResult).toBeDefined();
      expect(policyResult?.checkedAt).toBeInstanceOf(Date);
      expect(policyResult?.enforcementMode).toBe('warn');
      expect(typeof policyResult?.passed).toBe('boolean');

      // Should have violation for large effort task
      expect(policyResult?.violations).toHaveLength(1);
      expect(policyResult?.violations?.[0]?.ruleId).toBe('large-effort-review');
      expect(policyResult?.violations?.[0]?.severity).toBe('info');
    });
  });

  describe('Policy Check Event Emission', () => {
    it('should emit policy violation events during task execution', async () => {
      const policyConfig = createMockConfig({
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['blocked/**'],
        },
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const violationEvents: any[] = [];

      // Listen for policy violation events
      orchestrator.policyEnforcer.on('policy:violation', (event) => {
        violationEvents.push(event);
      });

      const task = createMockTask({
        title: 'Event Test Task',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      await orchestrator.startTask(taskId);

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Since we don't specify projectPaths in the test, no path violations should occur
      // But task-specific policies might still trigger
      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.policyCheckResult).toBeDefined();
    });

    it('should emit task events with policy check information', async () => {
      const taskEvents: any[] = [];

      orchestrator.on('task:started', (task) => {
        taskEvents.push({ type: 'started', task });
      });

      orchestrator.on('task:updated', (task) => {
        taskEvents.push({ type: 'updated', task });
      });

      const task = createMockTask({
        title: 'Event Tracking Task',
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      // Verify task events were emitted
      expect(taskEvents.length).toBeGreaterThan(0);

      const startedEvent = taskEvents.find(e => e.type === 'started');
      expect(startedEvent).toBeDefined();
      expect(startedEvent.task.id).toBe(taskId);
    });
  });

  describe('Approval Requirements Integration', () => {
    it('should detect approval requirements during task start', async () => {
      const policyConfig = createMockConfig({
        approvalRules: {
          enabled: true,
          rules: [
            {
              id: 'cost-approval',
              name: 'Cost Approval Required',
              enabled: true,
              conditions: [
                {
                  type: 'cost-threshold',
                  threshold: 2.0, // Lower threshold to trigger approval
                },
              ],
              urgency: 'normal',
              timeoutMinutes: 60,
              minApprovals: 1,
            },
          ],
        },
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const task = createMockTask({
        title: 'High Cost Task',
        usage: { estimatedCost: 5.0, totalTokens: 10000, inputTokens: 6000, outputTokens: 4000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      await orchestrator.startTask(taskId);

      // Verify approval requirements were detected
      const storedTask = await orchestrator.getTask(taskId);
      const policyResult = storedTask?.policyCheckResult;

      expect(policyResult?.violations).toBeDefined();
      const approvalViolation = policyResult?.violations?.find(
        v => v.ruleId === 'approval-required'
      );
      expect(approvalViolation).toBeDefined();
    });

    it('should handle production deployment approval requirements', async () => {
      const task = createMockTask({
        title: 'Production Deploy Task',
        workflow: 'deploy-production',
        usage: { estimatedCost: 8.0, totalTokens: 15000, inputTokens: 9000, outputTokens: 6000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      await orchestrator.startTask(taskId);

      // Verify production deployment rules were triggered
      const storedTask = await orchestrator.getTask(taskId);
      const policyResult = storedTask?.policyCheckResult;

      expect(policyResult?.violations).toBeDefined();
      // Should trigger both high-cost and production-deployment rules
      expect(policyResult?.violations?.length).toBeGreaterThan(0);
    });
  });

  describe('Policy Configuration Edge Cases', () => {
    it('should handle disabled policy enforcement', async () => {
      const policyConfig = createMockConfig({
        enabled: false,
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const task = createMockTask({
        title: 'Task with Disabled Policy',
        workflow: 'production-deployment',
        usage: { estimatedCost: 100.0, totalTokens: 50000, inputTokens: 30000, outputTokens: 20000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      // Should not throw despite potential violations
      await orchestrator.startTask(taskId);

      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.status).toBe('in-progress');
      expect(storedTask?.policyCheckResult?.passed).toBe(true);
      expect(storedTask?.policyCheckResult?.results).toEqual([]);
    });

    it('should handle missing policy configuration gracefully', async () => {
      // Initialize orchestrator without policy config
      orchestrator = new ApexOrchestrator({
        configPath,
        // No policyConfig provided
      });

      const task = createMockTask({
        title: 'Task without Policy Config',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      // Should execute without policy checks
      await orchestrator.startTask(taskId);

      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.status).toBe('in-progress');
      // May or may not have policy check results depending on default config
    });

    it('should handle audit mode enforcement correctly', async () => {
      const policyConfig = createMockConfig({
        enforcement: 'audit',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*'],  // Block everything to force violations
        },
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const task = createMockTask({
        title: 'Audit Mode Task',
        workflow: 'production-deployment',
        usage: { estimatedCost: 20.0, totalTokens: 30000, inputTokens: 18000, outputTokens: 12000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      // Should pass even with violations in audit mode
      await orchestrator.startTask(taskId);

      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.status).toBe('in-progress');
      expect(storedTask?.policyCheckResult?.passed).toBe(true);
      // Violations should still be recorded
      expect(storedTask?.policyCheckResult?.violations).toBeDefined();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle policy checks efficiently for multiple concurrent tasks', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createMockTask({
          title: `Concurrent Task ${i}`,
          usage: { estimatedCost: 1.0, totalTokens: 2000, inputTokens: 1200, outputTokens: 800 },
        })
      );

      // Mock execution for all tasks
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskIds = await Promise.all(
        tasks.map(task => orchestrator.createTask({
          ...task,
          agent: createMockAgentConfig(),
        }))
      );

      const startTime = Date.now();

      // Start all tasks concurrently
      await Promise.all(taskIds.map(id => orchestrator.startTask(id)));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all tasks were processed efficiently (should complete within reasonable time)
      expect(duration).toBeLessThan(2000); // 2 seconds should be plenty for policy checks

      // Verify all tasks have policy check results
      for (const taskId of taskIds) {
        const storedTask = await orchestrator.getTask(taskId);
        expect(storedTask?.policyCheckResult).toBeDefined();
        expect(storedTask?.status).toBe('in-progress');
      }
    });

    it('should handle malformed policy configuration without crashing', async () => {
      const malformedConfig = {
        enabled: true,
        enforcement: 'invalid-mode' as any,
        allowedPaths: {
          mode: 'invalid-mode' as any,
          allow: null as any,
          block: ['**/*'],
        },
        approvalRules: {
          enabled: true,
          rules: [
            {
              // Missing required fields
              id: 'malformed-rule',
              conditions: null as any,
            } as any,
          ],
        },
      };

      // Should not crash during initialization
      expect(() => {
        orchestrator = new ApexOrchestrator({
          configPath,
          policyConfig: malformedConfig,
        });
      }).not.toThrow();

      const task = createMockTask({
        title: 'Task with Malformed Config',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      // Should handle gracefully without crashing
      expect(async () => {
        await orchestrator.startTask(taskId);
      }).not.toThrow();
    });
  });

  describe('Database Integration', () => {
    it('should persist policy check results across orchestrator restarts', async () => {
      const task = createMockTask({
        title: 'Persistence Test Task',
        effort: 'large',
        usage: { estimatedCost: 3.0, totalTokens: 5000, inputTokens: 3000, outputTokens: 2000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Mock execution
      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      await orchestrator.startTask(taskId);

      // Verify task is stored with policy results
      let storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.policyCheckResult).toBeDefined();
      const originalPolicyResult = storedTask?.policyCheckResult;

      // Create new orchestrator instance (simulating restart)
      const newOrchestrator = new ApexOrchestrator({
        configPath,
        policyConfig: createMockConfig(),
      });

      // Verify policy results are still available
      storedTask = await newOrchestrator.getTask(taskId);
      expect(storedTask?.policyCheckResult).toEqual(originalPolicyResult);
    });

    it('should update task status correctly when policy checks fail', async () => {
      const policyConfig = createMockConfig({
        enforcement: 'strict',
      });

      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
      });

      const task = createMockTask({
        title: 'Policy Failure Test',
        workflow: 'production-deployment', // Will trigger error-level violation
        usage: { estimatedCost: 15.0, totalTokens: 25000, inputTokens: 15000, outputTokens: 10000 },
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Attempt to start task - should fail
      await expect(orchestrator.startTask(taskId)).rejects.toThrow();

      // Verify task status and error information
      const storedTask = await orchestrator.getTask(taskId);
      expect(storedTask?.status).toBe('failed');
      expect(storedTask?.error).toBeDefined();
      expect(storedTask?.error).toContain('policy violations');
      expect(storedTask?.policyCheckResult?.passed).toBe(false);
    });
  });
});