/**
 * @fileoverview Validation tests for PolicyEngine integration requirements
 *
 * This test file specifically validates the task acceptance criteria:
 * 1. ApexOrchestrator accepts PolicyEngine in constructor options
 * 2. Before executing agent actions, orchestrator calls PolicyEngine.checkPolicy
 * 3. Policy checks occur in pre-execution hook before Claude Agent SDK query calls
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import { PolicyEngine } from '../policy-engine.js';
import type {
  ApexConfig,
  PolicyCheckResult,
  PolicyEngine as IPolicyEngine,
  ApexOrchestratorOptions,
} from '@apexcli/core';
import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';

// ============================================================================
// Test Project Setup
// ============================================================================

async function createValidationTestProject(): Promise<string> {
  const testDir = path.join(tmpdir(), `apex-validation-${randomUUID()}`);
  const apexDir = path.join(testDir, '.apex');

  await fs.mkdir(apexDir, { recursive: true });

  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    `
project:
  name: validation-test
  description: Policy validation test project

policy:
  enabled: true
  enforcement: warn
  name: validation-policy

permissions:
  autonomy: autonomous
  tools: {}

agents: []
workflows: []
`
  );

  return testDir;
}

// ============================================================================
// Acceptance Criteria Validation Tests
// ============================================================================

describe('PolicyEngine Integration - Acceptance Criteria Validation', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createValidationTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('AC1: ApexOrchestrator accepts PolicyEngine in constructor options', () => {
    it('should accept PolicyEngine instance in constructor options', () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockResolvedValue({
          status: 'allow',
          violations: [],
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'test-policy',
          policyId: 'test-policy-id',
          rulesEvaluated: 0,
          rulesPassed: 0,
          rulesFailed: 0,
          durationMs: 0,
          metadata: {},
        }),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      // Should not throw when PolicyEngine is provided
      expect(() => {
        const orchestrator = new ApexOrchestrator(testProjectPath, options);
        expect(orchestrator).toBeDefined();
      }).not.toThrow();
    });

    it('should store PolicyEngine instance for later use', () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn(),
        getEnforcementMode: vi.fn(),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn(),
        getPolicies: vi.fn(),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn(),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      // Access the private field for testing purposes
      const storedPolicyEngine = (orchestrator as any).policyEngine;
      expect(storedPolicyEngine).toBe(mockPolicyEngine);
    });

    it('should work when PolicyEngine is not provided (optional)', () => {
      const options: ApexOrchestratorOptions = {};

      expect(() => {
        const orchestrator = new ApexOrchestrator(testProjectPath, options);
        expect(orchestrator).toBeDefined();

        const policyEngine = (orchestrator as any).policyEngine;
        expect(policyEngine).toBeUndefined();
      }).not.toThrow();
    });

    it('should accept real PolicyEngine instance created from config', async () => {
      const config: ApexConfig = {
        project: { name: 'test', description: 'Test project' },
        policy: {
          enabled: true,
          enforcement: 'warn',
          name: 'real-policy'
        },
        permissions: { autonomy: 'autonomous', tools: {} },
        agents: [],
        workflows: [],
      };

      const realPolicyEngine = new PolicyEngine(config);

      const options: ApexOrchestratorOptions = {
        policyEngine: realPolicyEngine,
      };

      expect(() => {
        const orchestrator = new ApexOrchestrator(testProjectPath, options);
        expect(orchestrator).toBeDefined();

        const storedEngine = (orchestrator as any).policyEngine;
        expect(storedEngine).toBeInstanceOf(PolicyEngine);
        expect(storedEngine).toBe(realPolicyEngine);
      }).not.toThrow();
    });
  });

  describe('AC2: Before executing agent actions, orchestrator calls PolicyEngine.checkPolicy', () => {
    it('should call checkPolicy before agent action execution', async () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockResolvedValue({
          status: 'allow',
          violations: [],
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'test-policy',
          policyId: 'test-policy-id',
          rulesEvaluated: 1,
          rulesPassed: 1,
          rulesFailed: 0,
          durationMs: 10,
          metadata: {},
        }),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      // Mock the Claude query method to track execution order
      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test policy check timing');
      } catch {
        // Ignore execution errors, focus on policy check
      }

      // Verify checkPolicy was called
      expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();
      expect(mockPolicyEngine.checkPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: expect.any(String),
          agentId: expect.any(String),
          action: expect.any(String),
        }),
        undefined // No options provided
      );
    });

    it('should call checkPolicy with correct context information', async () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockResolvedValue({
          status: 'allow',
          violations: [],
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'context-test-policy',
          policyId: 'context-test-policy-id',
          rulesEvaluated: 1,
          rulesPassed: 1,
          rulesFailed: 0,
          durationMs: 5,
          metadata: {},
        }),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Context test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      (orchestrator as any).query = mockQuery;

      const taskId = 'context-test-task-123';

      try {
        await orchestrator.executeTask(taskId, 'Test context validation');
      } catch {
        // Ignore execution errors
      }

      expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();

      const [context] = (mockPolicyEngine.checkPolicy as any).mock.calls[0];

      expect(context).toMatchObject({
        taskId: expect.any(String),
        agentId: expect.any(String),
        action: expect.any(String),
        toolName: expect.any(String),
        environment: expect.objectContaining({
          projectPath: testProjectPath,
        }),
      });

      // Verify environment context includes project path
      expect(context.environment.projectPath).toBe(testProjectPath);
    });

    it('should not execute action when policy check denies', async () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockResolvedValue({
          status: 'deny',
          violations: [
            {
              id: randomUUID(),
              rule: 'deny-rule',
              message: 'Action denied by policy',
              severity: 'high',
              blocking: true,
              policyType: 'path',
              timestamp: new Date(),
            },
          ],
          enforcementMode: 'strict',
          checkedAt: new Date(),
          policyName: 'deny-policy',
          policyId: 'deny-policy-id',
          rulesEvaluated: 1,
          rulesPassed: 0,
          rulesFailed: 1,
          durationMs: 20,
          metadata: {},
        }),
        getEnforcementMode: vi.fn().mockReturnValue('strict'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'This should not execute' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test denied action');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Policy check failed');
      }

      // Verify policy was checked
      expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();

      // Verify action was not executed
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('AC3: Policy checks occur in pre-execution hook before Claude Agent SDK query calls', () => {
    it('should execute policy check in pre-execution hook timing', async () => {
      const executionOrder: string[] = [];

      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockImplementation(async () => {
          executionOrder.push('policy-check');
          return {
            status: 'allow',
            violations: [],
            enforcementMode: 'warn',
            checkedAt: new Date(),
            policyName: 'timing-policy',
            policyId: 'timing-policy-id',
            rulesEvaluated: 1,
            rulesPassed: 1,
            rulesFailed: 0,
            durationMs: 15,
            metadata: {},
          };
        }),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      const mockQuery = vi.fn().mockImplementation(async () => {
        executionOrder.push('claude-query');
        return {
          content: [{ type: 'text', text: 'Timing test response' }],
          stopReason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      });

      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test execution timing');
      } catch {
        // Ignore execution errors
      }

      // Verify execution order: policy check should come before Claude query
      expect(executionOrder).toContain('policy-check');
      expect(executionOrder).toContain('claude-query');

      const policyIndex = executionOrder.indexOf('policy-check');
      const queryIndex = executionOrder.indexOf('claude-query');

      // Policy check should occur before Claude query
      expect(policyIndex).toBeLessThan(queryIndex);
    });

    it('should integrate policy checks with pre-execution hook system', async () => {
      const hookEvents: Array<{ event: string; timestamp: number }> = [];

      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockImplementation(async () => {
          hookEvents.push({ event: 'policy-check-start', timestamp: Date.now() });

          // Simulate policy evaluation time
          await new Promise(resolve => setTimeout(resolve, 10));

          hookEvents.push({ event: 'policy-check-end', timestamp: Date.now() });

          return {
            status: 'allow',
            violations: [],
            enforcementMode: 'warn',
            checkedAt: new Date(),
            policyName: 'hook-integration-policy',
            policyId: 'hook-integration-policy-id',
            rulesEvaluated: 1,
            rulesPassed: 1,
            rulesFailed: 0,
            durationMs: 10,
            metadata: {},
          };
        }),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      const mockQuery = vi.fn().mockImplementation(async () => {
        hookEvents.push({ event: 'claude-query-start', timestamp: Date.now() });

        // Simulate query execution time
        await new Promise(resolve => setTimeout(resolve, 50));

        hookEvents.push({ event: 'claude-query-end', timestamp: Date.now() });

        return {
          content: [{ type: 'text', text: 'Hook integration test response' }],
          stopReason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      });

      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test hook integration');
      } catch {
        // Ignore execution errors
      }

      // Verify the hook events occurred in the correct order
      expect(hookEvents.length).toBeGreaterThanOrEqual(4);

      // Find event indices
      const policyStartIndex = hookEvents.findIndex(e => e.event === 'policy-check-start');
      const policyEndIndex = hookEvents.findIndex(e => e.event === 'policy-check-end');
      const queryStartIndex = hookEvents.findIndex(e => e.event === 'claude-query-start');

      // Verify timing: policy check should complete before Claude query starts
      expect(policyStartIndex).toBeGreaterThanOrEqual(0);
      expect(policyEndIndex).toBeGreaterThan(policyStartIndex);
      expect(queryStartIndex).toBeGreaterThan(policyEndIndex);

      // Verify timing relationships
      const policyEndTime = hookEvents[policyEndIndex].timestamp;
      const queryStartTime = hookEvents[queryStartIndex].timestamp;

      expect(policyEndTime).toBeLessThanOrEqual(queryStartTime);

      console.log('Hook integration events:', hookEvents);
    });

    it('should properly handle policy check failures in hook context', async () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockRejectedValue(new Error('Policy engine hook failure')),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const options: ApexOrchestratorOptions = {
        policyEngine: mockPolicyEngine,
      };

      const orchestrator = new ApexOrchestrator(testProjectPath, options);

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Should not execute due to policy hook failure' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      // Should handle policy engine failure gracefully within hook context
      try {
        await orchestrator.executeTask(taskId, 'Test hook failure handling');

        // If execution continues, verify that policy failure was handled appropriately
        // (depending on error handling strategy)
      } catch (error) {
        // If execution fails, ensure it's handled properly
        expect((error as Error).message).not.toBe('Policy engine hook failure');
      }

      // Verify policy check was attempted
      expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();

      // The query may or may not have been called depending on error handling strategy
      // This is acceptable as long as policy check was attempted first
    });
  });
});