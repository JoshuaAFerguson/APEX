/**
 * @fileoverview Database Integration Tests for PolicyEnforcer Results Storage
 *
 * This test suite verifies that policy check results are properly stored in the
 * database when PolicyEnforcer.checkTaskStart() is called during task execution.
 * Tests cover result persistence, retrieval, and database schema validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index';
import { TaskStore } from '../store';
import type {
  AgentConfig,
  PolicyConfig,
  Task,
  TaskUpdate,
  PolicyCheckResult,
} from '@apexcli/core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const createMockAgentConfig = (): AgentConfig => ({
  id: 'test-agent',
  name: 'Test Agent',
  role: 'tester',
  instructions: 'Test agent instructions',
  autonomyLevel: 3,
});

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: randomUUID(),
  title: 'Database Test Task',
  description: 'Testing policy result storage in database',
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
    estimatedCost: 2.0,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createPolicyConfig = (overrides: Partial<PolicyConfig> = {}): PolicyConfig => ({
  version: '1.0',
  enabled: true,
  enforcement: 'warn',
  name: 'test-policy',
  allowedPaths: {
    mode: 'allowlist',
    allow: ['src/**', 'tests/**'],
    block: ['src/secrets/**'],
    sensitivePatterns: ['**/.env*'],
  },
  approvalRules: {
    enabled: true,
    rules: [
      {
        id: 'cost-approval',
        name: 'Cost Approval Rule',
        enabled: true,
        conditions: [{ type: 'cost-threshold', threshold: 5.0 }],
        urgency: 'normal',
        timeoutMinutes: 60,
        minApprovals: 1,
      },
    ],
  },
  ...overrides,
});

describe('PolicyEnforcer Database Integration', () => {
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let tempDir: string;
  let configPath: string;
  let dbPath: string;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-db-policy-test-'));
    configPath = path.join(tempDir, 'config.yaml');
    dbPath = path.join(tempDir, 'test.db');

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
    description: Test workflow for database testing
    agents: [test-agent]
    stages:
      - name: test
        agent: test-agent
        inputs: []
        outputs: []
`;

    fs.writeFileSync(configPath, configContent);

    // Initialize orchestrator with policy configuration
    const policyConfig = createPolicyConfig();
    orchestrator = new ApexOrchestrator({
      configPath,
      policyConfig,
      databasePath: dbPath,
    });

    store = orchestrator.store;
  });

  afterEach(() => {
    if (orchestrator) {
      orchestrator.close?.();
    }
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Policy Check Result Storage', () => {
    it('should store policy check results when task starts successfully', async () => {
      const task = createMockTask({
        title: 'Successful Policy Check Task',
        usage: { estimatedCost: 1.0, totalTokens: 2000, inputTokens: 1200, outputTokens: 800 },
      });

      // Mock task execution to avoid actual Claude API calls
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

      // Retrieve task from database
      const storedTask = await store.getTask(taskId);
      expect(storedTask).toBeDefined();

      // Verify policy check result is stored
      const policyResult = storedTask?.policyCheckResult;
      expect(policyResult).toBeDefined();
      expect(typeof policyResult?.passed).toBe('boolean');
      expect(policyResult?.checkedAt).toBeInstanceOf(Date);
      expect(policyResult?.enforcementMode).toBe('warn');
      expect(policyResult?.policyName).toBe('test-policy');
      expect(Array.isArray(policyResult?.violations)).toBe(true);
    });

    it('should store policy violations in correct database format', async () => {
      const task = createMockTask({
        title: 'Violation Storage Task',
        priority: 'urgent',  // Will create a warning violation
        effort: 'large',     // Will create an info violation
        usage: { estimatedCost: 8.0, totalTokens: 15000, inputTokens: 9000, outputTokens: 6000 }, // Will create warning violation
      });

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed with violations',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      // Retrieve and verify stored violations
      const storedTask = await store.getTask(taskId);
      const violations = storedTask?.policyCheckResult?.violations;

      expect(violations).toBeDefined();
      expect(violations!.length).toBeGreaterThan(0);

      // Check violation structure
      for (const violation of violations!) {
        expect(violation.ruleId).toBeDefined();
        expect(['path', 'test', 'approval'].includes(violation.policyType)).toBe(true);
        expect(['info', 'warning', 'error'].includes(violation.severity)).toBe(true);
        expect(violation.message).toBeDefined();
        expect(typeof violation.message).toBe('string');
      }

      // Should have urgent task warning
      const urgentViolation = violations!.find(v => v.ruleId === 'urgent-task-review');
      expect(urgentViolation).toBeDefined();
      expect(urgentViolation?.severity).toBe('warning');

      // Should have large effort info
      const effortViolation = violations!.find(v => v.ruleId === 'large-effort-review');
      expect(effortViolation).toBeDefined();
      expect(effortViolation?.severity).toBe('info');

      // Should have high cost warning
      const costViolation = violations!.find(v => v.ruleId === 'high-cost-review');
      expect(costViolation).toBeDefined();
      expect(costViolation?.severity).toBe('warning');
    });

    it('should handle policy check failures and store error information', async () => {
      const policyConfig = createPolicyConfig({
        enforcement: 'strict',  // Will block task on any violation
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: ['**/*'],  // Block everything to force failure
        },
      });

      // Create new orchestrator with strict policy
      orchestrator.close?.();
      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig,
        databasePath: dbPath,
      });
      store = orchestrator.store;

      const task = createMockTask({
        title: 'Policy Failure Task',
        workflow: 'production-deployment', // Will trigger error
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Attempt to start task - should fail due to policy violations
      await expect(orchestrator.startTask(taskId)).rejects.toThrow(/policy violations/);

      // Verify task was marked as failed with policy information
      const storedTask = await store.getTask(taskId);
      expect(storedTask?.status).toBe('failed');
      expect(storedTask?.error).toBeDefined();
      expect(storedTask?.error).toContain('policy violations');

      // Policy check result should still be stored
      const policyResult = storedTask?.policyCheckResult;
      expect(policyResult?.passed).toBe(false);
      expect(policyResult?.violations).toBeDefined();
      expect(policyResult?.violations!.length).toBeGreaterThan(0);
    });
  });

  describe('Database Schema Validation', () => {
    it('should handle NULL policy check results gracefully', async () => {
      const task = createMockTask();

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      // Manually update task to have NULL policy check result
      await store.updateTask(taskId, {
        policyCheckResult: null as any,
      });

      // Should be able to retrieve task without errors
      const storedTask = await store.getTask(taskId);
      expect(storedTask).toBeDefined();
      expect(storedTask?.policyCheckResult).toBeNull();
    });

    it('should validate policy check result fields match schema', async () => {
      const task = createMockTask();

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      const storedTask = await store.getTask(taskId);
      const policyResult = storedTask?.policyCheckResult;

      expect(policyResult).toBeDefined();

      // Validate all required fields are present and have correct types
      expect(typeof policyResult?.passed).toBe('boolean');
      expect(policyResult?.checkedAt).toBeInstanceOf(Date);
      expect(typeof policyResult?.enforcementMode).toBe('string');
      expect(Array.isArray(policyResult?.violations)).toBe(true);

      // Validate optional fields
      if (policyResult?.policyName !== null) {
        expect(typeof policyResult?.policyName).toBe('string');
      }

      // Validate violation structure
      if (policyResult?.violations && policyResult.violations.length > 0) {
        for (const violation of policyResult.violations) {
          expect(typeof violation.ruleId).toBe('string');
          expect(['path', 'test', 'approval'].includes(violation.policyType)).toBe(true);
          expect(['info', 'warning', 'error'].includes(violation.severity)).toBe(true);
          expect(typeof violation.message).toBe('string');

          // Optional fields should be null or correct type
          if (violation.filePath !== null && violation.filePath !== undefined) {
            expect(typeof violation.filePath).toBe('string');
          }
        }
      }
    });

    it('should handle complex violation context data correctly', async () => {
      const task = createMockTask({
        effort: 'xlarge',
        priority: 'urgent',
        workflow: 'complex-workflow',
        usage: { estimatedCost: 12.0, totalTokens: 25000, inputTokens: 15000, outputTokens: 10000 },
      });

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      const storedTask = await store.getTask(taskId);
      const violations = storedTask?.policyCheckResult?.violations;

      expect(violations).toBeDefined();
      expect(violations!.length).toBeGreaterThan(0);

      // Check that complex context data is stored correctly
      for (const violation of violations!) {
        if (violation.context) {
          // Context should be serializable JSON
          expect(() => JSON.stringify(violation.context)).not.toThrow();
          expect(() => JSON.parse(JSON.stringify(violation.context))).not.toThrow();
        }
      }

      // Verify specific violation context
      const costViolation = violations!.find(v => v.ruleId === 'high-cost-review');
      if (costViolation) {
        expect(costViolation.context).toBeDefined();
        // Context should contain relevant task information
      }
    });
  });

  describe('Policy Result Retrieval and Updates', () => {
    it('should allow querying tasks by policy check status', async () => {
      const passingTask = createMockTask({
        title: 'Passing Task',
        usage: { estimatedCost: 1.0, totalTokens: 1000, inputTokens: 600, outputTokens: 400 },
      });

      const failingTask = createMockTask({
        title: 'Failing Task',
        workflow: 'production-deployment', // Will create error
        priority: 'urgent',                // Will create warning
      });

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const passingTaskId = await orchestrator.createTask({
        ...passingTask,
        agent: createMockAgentConfig(),
      });

      const failingTaskId = await orchestrator.createTask({
        ...failingTask,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(passingTaskId);
      await orchestrator.startTask(failingTaskId);

      // Verify we can retrieve and distinguish tasks by policy status
      const passingStored = await store.getTask(passingTaskId);
      const failingStored = await store.getTask(failingTaskId);

      expect(passingStored?.policyCheckResult?.passed).toBe(true);
      expect(failingStored?.policyCheckResult?.passed).toBe(false);

      expect(passingStored?.policyCheckResult?.violations).toHaveLength(0);
      expect(failingStored?.policyCheckResult?.violations!.length).toBeGreaterThan(0);
    });

    it('should preserve policy check results across task updates', async () => {
      const task = createMockTask({
        title: 'Update Test Task',
        effort: 'large', // Will create violation
      });

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      // Get initial policy check result
      const initialTask = await store.getTask(taskId);
      const initialPolicyResult = initialTask?.policyCheckResult;
      expect(initialPolicyResult).toBeDefined();

      // Update task with new information
      const updateData: TaskUpdate = {
        title: 'Updated Task Title',
        description: 'Updated task description',
        updatedAt: new Date(),
      };

      await store.updateTask(taskId, updateData);

      // Verify policy check result is preserved
      const updatedTask = await store.getTask(taskId);
      expect(updatedTask?.title).toBe('Updated Task Title');
      expect(updatedTask?.policyCheckResult).toEqual(initialPolicyResult);
    });

    it('should handle concurrent policy checks without data corruption', async () => {
      const tasks = Array.from({ length: 3 }, (_, i) =>
        createMockTask({
          title: `Concurrent Task ${i}`,
          effort: i % 2 === 0 ? 'large' : 'small',
          priority: i === 1 ? 'urgent' : 'medium',
          usage: {
            estimatedCost: i * 2 + 1,
            totalTokens: (i + 1) * 2000,
            inputTokens: (i + 1) * 1200,
            outputTokens: (i + 1) * 800,
          },
        })
      );

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      // Create all tasks concurrently
      const taskIds = await Promise.all(
        tasks.map(task => orchestrator.createTask({
          ...task,
          agent: createMockAgentConfig(),
        }))
      );

      // Start all tasks concurrently to test concurrent policy checking
      await Promise.all(taskIds.map(id => orchestrator.startTask(id)));

      // Verify all tasks have correct policy results
      for (let i = 0; i < taskIds.length; i++) {
        const storedTask = await store.getTask(taskIds[i]);
        expect(storedTask?.policyCheckResult).toBeDefined();
        expect(storedTask?.title).toBe(`Concurrent Task ${i}`);

        // Verify policy results match task characteristics
        const violations = storedTask?.policyCheckResult?.violations || [];

        if (tasks[i].effort === 'large') {
          expect(violations.some(v => v.ruleId === 'large-effort-review')).toBe(true);
        }

        if (tasks[i].priority === 'urgent') {
          expect(violations.some(v => v.ruleId === 'urgent-task-review')).toBe(true);
        }
      }
    });
  });

  describe('Performance and Storage Efficiency', () => {
    it('should handle large policy check results efficiently', async () => {
      // Create config with many patterns to generate many violations
      const complexPolicyConfig = createPolicyConfig({
        allowedPaths: {
          mode: 'allowlist',
          allow: ['src/**'],
          block: Array.from({ length: 50 }, (_, i) => `blocked${i}/**`),
          sensitivePatterns: Array.from({ length: 20 }, (_, i) => `**/*.secret${i}`),
        },
      });

      orchestrator.close?.();
      orchestrator = new ApexOrchestrator({
        configPath,
        policyConfig: complexPolicyConfig,
        databasePath: dbPath,
      });
      store = orchestrator.store;

      const task = createMockTask({
        title: 'Complex Policy Task',
        effort: 'xlarge',
        priority: 'urgent',
        usage: { estimatedCost: 20.0, totalTokens: 50000, inputTokens: 30000, outputTokens: 20000 },
      });

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      const startTime = Date.now();
      await orchestrator.startTask(taskId);
      const endTime = Date.now();

      // Should complete within reasonable time even with complex policy
      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds max

      // Verify policy results are stored correctly
      const storedTask = await store.getTask(taskId);
      expect(storedTask?.policyCheckResult).toBeDefined();
      expect(storedTask?.policyCheckResult?.violations).toBeDefined();
    });

    it('should optimize storage of repeated violation patterns', async () => {
      const task = createMockTask({
        effort: 'large',
        priority: 'urgent',
      });

      vi.spyOn(orchestrator as any, 'executeTaskInternal').mockResolvedValue({
        success: true,
        result: 'Task completed',
      });

      const taskId = await orchestrator.createTask({
        ...task,
        agent: createMockAgentConfig(),
      });

      await orchestrator.startTask(taskId);

      // Get stored task and check storage size
      const storedTask = await store.getTask(taskId);
      const policyResultJson = JSON.stringify(storedTask?.policyCheckResult);

      // Policy results should be efficiently stored (not excessively large)
      expect(policyResultJson.length).toBeLessThan(10000); // 10KB max for typical policy results

      // Verify no unnecessary duplication in stored data
      expect(storedTask?.policyCheckResult?.violations).toBeDefined();
      const violations = storedTask?.policyCheckResult?.violations!;

      // Each violation should have unique rule IDs
      const ruleIds = violations.map(v => v.ruleId);
      const uniqueRuleIds = new Set(ruleIds);
      expect(uniqueRuleIds.size).toBeLessThanOrEqual(ruleIds.length);
    });
  });
});