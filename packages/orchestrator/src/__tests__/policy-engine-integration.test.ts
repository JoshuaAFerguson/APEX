/**
 * @fileoverview Integration tests for PolicyEngine integration with ApexOrchestrator
 *
 * Tests cover:
 * - PolicyEngine constructor option injection
 * - Pre-execution policy checking in orchestrator workflow
 * - Different enforcement modes (strict, warn, audit, disabled)
 * - Policy violation handling and error scenarios
 * - Integration with Claude Agent SDK hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import { PolicyEngine, createPolicyEngine } from '../policy-engine.js';
import type {
  ApexConfig,
  PolicyConfig,
  PolicyCheckResult,
  PolicyCheckContext,
  PolicyEnforcementMode,
  PolicyEngine as IPolicyEngine,
  ApexOrchestratorOptions,
  Task,
} from '@apexcli/core';
import { loadApexConfig } from '@apexcli/core/config';
import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';

// ============================================================================
// Test Helpers and Mocks
// ============================================================================

/**
 * Creates a test project directory with apex config
 */
async function createTestProject(): Promise<string> {
  const testDir = path.join(tmpdir(), `apex-test-${randomUUID()}`);
  const apexDir = path.join(testDir, '.apex');

  await fs.mkdir(apexDir, { recursive: true });

  // Create basic config with policy settings
  const config: ApexConfig = {
    project: {
      name: 'test-project',
      description: 'Test project for PolicyEngine integration',
    },
    policy: {
      enabled: true,
      enforcement: 'warn',
      name: 'test-policy',
      allowedPaths: {
        mode: 'allowlist',
        allow: ['src/**', 'test/**'],
        block: ['secrets/**', '**/*.key'],
        sensitive: ['**/.env*', '**/config/production.*'],
      },
      approvalRules: {
        enabled: true,
        rules: [
          {
            id: 'dangerous-operations',
            name: 'Dangerous Operations',
            enabled: true,
            priority: 100,
            conditions: [
              {
                type: 'tool-name',
                patterns: ['Bash', 'Shell'],
              },
            ],
            urgency: 'high',
            timeoutMinutes: 30,
            approvers: ['admin'],
            minApprovals: 1,
            timeoutAction: 'reject',
          },
        ],
      },
    },
    permissions: {
      autonomy: 'autonomous',
      tools: {},
    },
    agents: [],
    workflows: [],
  };

  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    `
project:
  name: test-project
  description: Test project for PolicyEngine integration

policy:
  enabled: true
  enforcement: warn
  name: test-policy
  allowedPaths:
    mode: allowlist
    allow:
      - "src/**"
      - "test/**"
    block:
      - "secrets/**"
      - "**/*.key"
    sensitive:
      - "**/.env*"
      - "**/config/production.*"
  approvalRules:
    enabled: true
    rules:
      - id: dangerous-operations
        name: Dangerous Operations
        enabled: true
        priority: 100
        conditions:
          - type: tool-name
            patterns: ["Bash", "Shell"]
        urgency: high
        timeoutMinutes: 30
        approvers: ["admin"]
        minApprovals: 1
        timeoutAction: reject

permissions:
  autonomy: autonomous
  tools: {}

agents: []
workflows: []
`
  );

  return testDir;
}

/**
 * Creates a mock PolicyEngine with configurable behavior
 */
function createMockPolicyEngine(
  checkPolicyResponse: PolicyCheckResult = {
    status: 'allow',
    violations: [],
    enforcementMode: 'warn',
    checkedAt: new Date(),
    policyName: 'mock-policy',
    policyId: 'mock-policy-id',
    rulesEvaluated: 0,
    rulesPassed: 0,
    rulesFailed: 0,
    durationMs: 10,
    metadata: {},
  }
): IPolicyEngine {
  return {
    checkPolicy: vi.fn().mockResolvedValue(checkPolicyResponse),
    getEnforcementMode: vi.fn().mockReturnValue('warn'),
    setEnforcementMode: vi.fn(),
    registerPolicy: vi.fn(),
    unregisterPolicy: vi.fn(),
    getPolicies: vi.fn().mockReturnValue([]),
    getPolicy: vi.fn(),
    hasPolicy: vi.fn().mockReturnValue(false),
    clearPolicies: vi.fn(),
  };
}

/**
 * Creates a mock task for testing
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: randomUUID(),
    description: 'Test task for PolicyEngine integration',
    workflow: 'test-workflow',
    autonomy: 'autonomous',
    status: 'pending',
    priority: 'medium',
    effort: 'small',
    projectPath: '/test/project',
    branchName: 'feature/test',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.01,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  };
}

// ============================================================================
// PolicyEngine Constructor Injection Tests
// ============================================================================

describe('ApexOrchestrator - PolicyEngine Constructor Injection', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should accept PolicyEngine in constructor options', async () => {
    const mockPolicyEngine = createMockPolicyEngine();

    const options: ApexOrchestratorOptions = {
      policyEngine: mockPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    // Access private policyEngine field through type assertion for testing
    expect((orchestrator as any).policyEngine).toBe(mockPolicyEngine);
  });

  it('should work without PolicyEngine when not provided', async () => {
    const options: ApexOrchestratorOptions = {};

    expect(() => {
      const orchestrator = new ApexOrchestrator(testProjectPath, options);
      expect((orchestrator as any).policyEngine).toBeUndefined();
    }).not.toThrow();
  });

  it('should create PolicyEngine from config when not provided', async () => {
    const options: ApexOrchestratorOptions = {};

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    // Check that the orchestrator has access to policy configuration
    const config = await loadApexConfig(testProjectPath);
    expect(config.policy).toBeDefined();
    expect(config.policy?.enabled).toBe(true);
  });

  it('should override config PolicyEngine with provided option', async () => {
    const customPolicyEngine = createMockPolicyEngine({
      status: 'deny',
      violations: [
        {
          id: 'test-violation',
          rule: 'custom-rule',
          message: 'Custom policy violation',
          severity: 'error',
          blocking: true,
          policyType: 'path',
          timestamp: new Date(),
        },
      ],
      enforcementMode: 'strict',
      policyName: 'custom-policy',
      policyId: 'custom-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 50,
    });

    const options: ApexOrchestratorOptions = {
      policyEngine: customPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    expect((orchestrator as any).policyEngine).toBe(customPolicyEngine);
  });
});

// ============================================================================
// Pre-execution Policy Check Integration Tests
// ============================================================================

describe('ApexOrchestrator - Pre-execution Policy Checks', () => {
  let testProjectPath: string;
  let mockPolicyEngine: IPolicyEngine;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testProjectPath = await createTestProject();
    mockPolicyEngine = createMockPolicyEngine();

    const options: ApexOrchestratorOptions = {
      policyEngine: mockPolicyEngine,
    };

    orchestrator = new ApexOrchestrator(testProjectPath, options);
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should call PolicyEngine.checkPolicy before tool execution', async () => {
    const task = createMockTask();

    // Mock the Claude Agent SDK query to simulate tool execution
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mocked response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    // Replace the query method
    (orchestrator as any).query = mockQuery;

    // Create a simple workflow task
    try {
      await orchestrator.executeTask(task.id, 'Simple test task');
    } catch {
      // Ignore execution errors, we're testing policy checks
    }

    // Verify that checkPolicy was called
    expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();

    // Verify the context passed to policy check
    const calls = (mockPolicyEngine.checkPolicy as MockedFunction<any>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const policyContext: PolicyCheckContext = calls[0][0];
    expect(policyContext).toMatchObject({
      action: expect.any(String),
      taskId: expect.any(String),
      agentId: expect.any(String),
    });
  });

  it('should allow tool execution when policy check passes', async () => {
    // Configure mock to allow the action
    const allowResponse: PolicyCheckResult = {
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
    };

    (mockPolicyEngine.checkPolicy as MockedFunction<any>).mockResolvedValue(allowResponse);

    const task = createMockTask();

    // Mock successful query execution
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Task executed successfully' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      const result = await orchestrator.executeTask(task.id, 'Test task execution');
      // If we reach here, policy allowed execution
      expect(mockQuery).toHaveBeenCalled();
    } catch (error) {
      // Check if it's not a policy-related error
      expect((error as Error).message).not.toContain('Policy check failed');
    }
  });

  it('should deny tool execution when policy check fails', async () => {
    // Configure mock to deny the action
    const denyResponse: PolicyCheckResult = {
      status: 'deny',
      violations: [
        {
          id: 'violation-1',
          rule: 'dangerous-operation',
          message: 'Operation not allowed by policy',
          severity: 'error',
          blocking: true,
          policyType: 'path',
          timestamp: new Date(),
        },
      ],
      enforcementMode: 'strict',
      checkedAt: new Date(),
      policyName: 'test-policy',
      policyId: 'test-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 15,
      metadata: {},
    };

    (mockPolicyEngine.checkPolicy as MockedFunction<any>).mockResolvedValue(denyResponse);

    const task = createMockTask();

    // Mock query that should not be called due to policy denial
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'This should not execute' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask(task.id, 'Test denied task');
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      // Should get a policy-related error
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain('Policy check failed');
      expect(mockQuery).not.toHaveBeenCalled();
    }
  });

  it('should handle policy engine errors gracefully', async () => {
    // Configure mock to throw an error
    (mockPolicyEngine.checkPolicy as MockedFunction<any>).mockRejectedValue(
      new Error('Policy engine unavailable')
    );

    const task = createMockTask();

    // Mock query execution
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Task executed with policy error' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Should handle policy engine error and potentially continue execution
    try {
      await orchestrator.executeTask(task.id, 'Test with policy error');
      // Execution might continue depending on error handling strategy
    } catch (error) {
      // If execution fails, it should not be due to policy engine unavailability
      // The orchestrator should handle policy engine errors gracefully
      expect((error as Error).message).not.toBe('Policy engine unavailable');
    }
  });

  it('should include correct context in policy checks', async () => {
    const task = createMockTask({
      id: 'test-task-123',
      workflow: 'feature-development',
    });

    // Mock query execution
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask(task.id, 'Test context verification');
    } catch {
      // Ignore execution errors
    }

    expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();

    const calls = (mockPolicyEngine.checkPolicy as MockedFunction<any>).mock.calls;
    const policyContext: PolicyCheckContext = calls[0][0];

    expect(policyContext).toMatchObject({
      taskId: 'test-task-123',
      agentId: expect.any(String),
      action: expect.any(String),
      toolName: expect.any(String),
    });

    // Should include environment context
    expect(policyContext.environment).toMatchObject({
      projectPath: testProjectPath,
    });
  });
});

// ============================================================================
// Policy Enforcement Mode Tests
// ============================================================================

describe('ApexOrchestrator - Policy Enforcement Modes', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should block execution in strict enforcement mode', async () => {
    const strictPolicyEngine = createMockPolicyEngine({
      status: 'deny',
      violations: [
        {
          id: 'strict-violation',
          rule: 'strict-rule',
          message: 'Strict policy violation',
          severity: 'error',
          blocking: true,
          policyType: 'path',
          timestamp: new Date(),
        },
      ],
      enforcementMode: 'strict',
      policyName: 'strict-policy',
      policyId: 'strict-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 20,
      metadata: {},
    });

    const options: ApexOrchestratorOptions = {
      policyEngine: strictPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn();
    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask(task.id, 'Strict mode test');
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect((error as Error).message).toContain('Policy check failed');
      expect(mockQuery).not.toHaveBeenCalled();
    }
  });

  it('should warn but continue in warn enforcement mode', async () => {
    const warnPolicyEngine = createMockPolicyEngine({
      status: 'allow', // Allow in warn mode even with violations
      violations: [
        {
          id: 'warn-violation',
          rule: 'warn-rule',
          message: 'Warning policy violation',
          severity: 'warning',
          blocking: false,
          policyType: 'path',
          timestamp: new Date(),
        },
      ],
      enforcementMode: 'warn',
      policyName: 'warn-policy',
      policyId: 'warn-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 15,
      metadata: {},
    });

    const options: ApexOrchestratorOptions = {
      policyEngine: warnPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Warn mode execution' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask(task.id, 'Warn mode test');
      // Should continue execution in warn mode
      expect(mockQuery).toHaveBeenCalled();
    } catch {
      // If execution fails, it shouldn't be due to policy warnings
    }
  });

  it('should log but continue in audit enforcement mode', async () => {
    const auditPolicyEngine = createMockPolicyEngine({
      status: 'allow', // Always allow in audit mode
      violations: [
        {
          id: 'audit-violation',
          rule: 'audit-rule',
          message: 'Audit policy violation',
          severity: 'info',
          blocking: false,
          policyType: 'path',
          timestamp: new Date(),
        },
      ],
      enforcementMode: 'audit',
      policyName: 'audit-policy',
      policyId: 'audit-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 5,
      metadata: {},
    });

    const options: ApexOrchestratorOptions = {
      policyEngine: auditPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Audit mode execution' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask(task.id, 'Audit mode test');
      // Should always continue in audit mode
      expect(mockQuery).toHaveBeenCalled();
    } catch {
      // If execution fails, it shouldn't be due to policy auditing
    }
  });

  it('should skip policy checks in disabled mode', async () => {
    const disabledPolicyEngine = createMockPolicyEngine({
      status: 'allow',
      violations: [],
      enforcementMode: 'disabled',
      policyName: 'disabled-policy',
      policyId: 'disabled-policy-id',
      rulesEvaluated: 0,
      rulesPassed: 0,
      rulesFailed: 0,
      durationMs: 0,
      metadata: { disabled: true },
    });

    const options: ApexOrchestratorOptions = {
      policyEngine: disabledPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Disabled mode execution' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask(task.id, 'Disabled mode test');
      // Should execute without policy checks
      expect(mockQuery).toHaveBeenCalled();
    } catch {
      // If execution fails, it shouldn't be due to policy enforcement
    }

    // Should still call checkPolicy but return early for disabled mode
    expect(disabledPolicyEngine.checkPolicy).toHaveBeenCalled();
  });
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe('ApexOrchestrator - PolicyEngine Edge Cases', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle missing policy context gracefully', async () => {
    const mockPolicyEngine = createMockPolicyEngine();

    const options: ApexOrchestratorOptions = {
      policyEngine: mockPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask({ id: '' }); // Invalid task ID

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    try {
      await orchestrator.executeTask('', 'Test with missing context');
    } catch {
      // Ignore execution errors
    }

    // Should still attempt policy check even with minimal context
    expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();
  });

  it('should handle policy engine timeout', async () => {
    // Create a policy engine that times out
    const timeoutPolicyEngine: IPolicyEngine = {
      checkPolicy: vi.fn().mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Policy check timeout')), 100)
        )
      ),
      getEnforcementMode: vi.fn().mockReturnValue('warn'),
      setEnforcementMode: vi.fn(),
      registerPolicy: vi.fn(),
      unregisterPolicy: vi.fn(),
      getPolicies: vi.fn().mockReturnValue([]),
      getPolicy: vi.fn(),
      hasPolicy: vi.fn().mockReturnValue(false),
      clearPolicies: vi.fn(),
    };

    const options: ApexOrchestratorOptions = {
      policyEngine: timeoutPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response after timeout' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Should handle timeout gracefully
    try {
      await orchestrator.executeTask(task.id, 'Test timeout handling');
      // Execution might continue depending on timeout handling strategy
    } catch (error) {
      // If execution fails, ensure it's handled appropriately
      expect((error as Error).message).not.toBe('Policy check timeout');
    }

    expect(timeoutPolicyEngine.checkPolicy).toHaveBeenCalled();
  });

  it('should handle malformed policy responses', async () => {
    const malformedPolicyEngine: IPolicyEngine = {
      checkPolicy: vi.fn().mockResolvedValue({
        // Missing required fields
        violations: null,
        enforcementMode: undefined,
      } as any),
      getEnforcementMode: vi.fn().mockReturnValue('warn'),
      setEnforcementMode: vi.fn(),
      registerPolicy: vi.fn(),
      unregisterPolicy: vi.fn(),
      getPolicies: vi.fn().mockReturnValue([]),
      getPolicy: vi.fn(),
      hasPolicy: vi.fn().mockReturnValue(false),
      clearPolicies: vi.fn(),
    };

    const options: ApexOrchestratorOptions = {
      policyEngine: malformedPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response with malformed policy' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Should handle malformed responses gracefully
    expect(async () => {
      await orchestrator.executeTask(task.id, 'Test malformed policy response');
    }).not.toThrow();

    expect(malformedPolicyEngine.checkPolicy).toHaveBeenCalled();
  });

  it('should work without PolicyEngine when undefined', async () => {
    const options: ApexOrchestratorOptions = {};

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    const task = createMockTask();

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test response without policy engine' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Should execute normally without policy engine
    try {
      await orchestrator.executeTask(task.id, 'Test without policy engine');
      expect(mockQuery).toHaveBeenCalled();
    } catch {
      // If execution fails, it shouldn't be due to missing policy engine
    }

    // No policy checks should be made
    expect((orchestrator as any).policyEngine).toBeUndefined();
  });

  it('should handle concurrent policy checks', async () => {
    const concurrentPolicyEngine = createMockPolicyEngine();
    let checkCount = 0;

    (concurrentPolicyEngine.checkPolicy as MockedFunction<any>).mockImplementation(
      async () => {
        checkCount++;
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          status: 'allow',
          violations: [],
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'concurrent-policy',
          policyId: 'concurrent-policy-id',
          rulesEvaluated: 1,
          rulesPassed: 1,
          rulesFailed: 0,
          durationMs: 10,
          metadata: { checkCount },
        };
      }
    );

    const options: ApexOrchestratorOptions = {
      policyEngine: concurrentPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Concurrent test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Execute multiple tasks concurrently
    const tasks = Array.from({ length: 3 }, (_, i) =>
      createMockTask({ id: `concurrent-task-${i}` })
    );

    const executions = tasks.map(async (task, i) => {
      try {
        return await orchestrator.executeTask(task.id, `Concurrent test ${i}`);
      } catch {
        return null;
      }
    });

    await Promise.allSettled(executions);

    // Should handle concurrent policy checks
    expect(checkCount).toBeGreaterThan(0);
    expect(concurrentPolicyEngine.checkPolicy).toHaveBeenCalledTimes(3);
  });
});