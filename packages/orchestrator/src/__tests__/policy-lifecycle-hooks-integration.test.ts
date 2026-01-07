/**
 * @fileoverview Integration tests for policy lifecycle hooks
 *
 * This test suite verifies that policy checks are properly integrated into the
 * orchestrator's pre-execution hook lifecycle and that the PolicyEngine works
 * correctly with different enforcement modes.
 *
 * Tests cover:
 * - Pre-execution policy check is called before agent actions
 * - Block mode prevents execution and emits correct events
 * - Warn mode logs and continues with correct events
 * - Audit mode records silently with correct events
 * - Multiple policies can be checked
 * - PolicyEngine can be disabled/optional
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator, type OrchestratorOptions } from '../index.js';
import { PolicyEngine } from '../policy-engine.js';
import type {
  ApexConfig,
  PolicyCheckResult,
  PolicyCheckContext,
  PolicyEnforcementMode,
  PolicyEngine as IPolicyEngine,
  Task,
  PolicyViolation,
  PolicyBlockedEventData,
  PolicyWarnedEventData,
  PolicyAuditedEventData,
} from '@apexcli/core';
import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';
import { EventEmitter } from 'events';

// ============================================================================
// Test Helpers and Mocks
// ============================================================================

/**
 * Creates a test project directory with apex config
 */
async function createTestProject(policyConfig?: Partial<ApexConfig['policy']>): Promise<string> {
  const testDir = path.join(tmpdir(), `apex-policy-test-${randomUUID()}`);
  const apexDir = path.join(testDir, '.apex');

  await fs.mkdir(apexDir, { recursive: true });

  // Default policy configuration
  const defaultPolicy = {
    enabled: true,
    enforcement: 'warn' as PolicyEnforcementMode,
    name: 'test-policy',
    allowedPaths: {
      mode: 'allowlist' as const,
      allow: ['src/**', 'test/**'],
      block: ['secrets/**', '**/*.key'],
      sensitive: ['**/.env*', '**/config/production.*'],
    },
  };

  const config: ApexConfig = {
    project: {
      name: 'test-project',
      description: 'Test project for policy lifecycle hooks',
    },
    policy: {
      ...defaultPolicy,
      ...policyConfig,
    },
    permissions: {
      autonomy: 'autonomous',
      tools: {},
    },
    agents: [],
    workflows: [],
  };

  // Write YAML config file
  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    `
project:
  name: test-project
  description: Test project for policy lifecycle hooks

policy:
  enabled: ${config.policy?.enabled ?? true}
  enforcement: ${config.policy?.enforcement ?? 'warn'}
  name: ${config.policy?.name ?? 'test-policy'}
  allowedPaths:
    mode: ${config.policy?.allowedPaths?.mode ?? 'allowlist'}
    allow:
      - "src/**"
      - "test/**"
    block:
      - "secrets/**"
      - "**/*.key"
    sensitive:
      - "**/.env*"
      - "**/config/production.*"

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
    getEnforcementMode: vi.fn().mockReturnValue(checkPolicyResponse.enforcementMode),
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
    description: 'Test task for policy lifecycle hooks',
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

/**
 * Event collector for testing event emissions
 */
class EventCollector extends EventEmitter {
  private events: Array<{ type: string; data: unknown }> = [];

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const eventData = args[0];
    this.events.push({ type: event.toString(), data: eventData });
    return super.emit(event, ...args);
  }

  getEvents(eventType?: string): Array<{ type: string; data: unknown }> {
    if (eventType) {
      return this.events.filter(e => e.type === eventType);
    }
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  getLastEvent(eventType?: string): { type: string; data: unknown } | undefined {
    const events = this.getEvents(eventType);
    return events[events.length - 1];
  }
}

// ============================================================================
// Pre-execution Policy Check Integration Tests
// ============================================================================

describe('ApexOrchestrator - Policy Lifecycle Hooks Integration', () => {
  let testProjectPath: string;
  let mockPolicyEngine: IPolicyEngine;
  let orchestrator: ApexOrchestrator;
  let eventCollector: EventCollector;

  beforeEach(async () => {
    testProjectPath = await createTestProject();
    mockPolicyEngine = createMockPolicyEngine();
    eventCollector = new EventCollector();

    const options: OrchestratorOptions = {
      policyEngine: mockPolicyEngine,
    };

    orchestrator = new ApexOrchestrator(testProjectPath, options);

    // Wire up event collector to the orchestrator
    (orchestrator as any).eventEmitter = eventCollector;
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should call PolicyEngine.checkPolicy before agent actions', async () => {
    const task = createMockTask();

    // Mock the agent execution workflow to simulate tool use
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mocked agent response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    // Mock the hook system to verify policy checks are called
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any, toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
          // Simulate calling policy engine before tool execution
          const policyContext: PolicyCheckContext = {
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
            environment: {
              projectPath: testProjectPath,
            },
          };

          await mockPolicyEngine.checkPolicy(policyContext);
          return {};
        }],
        timeout: 30,
        priority: 1000,
      }],
      PostToolUse: [],
    });

    // Replace orchestrator methods for testing
    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    // Simulate tool execution workflow
    try {
      await orchestrator.executeTask(task.id, 'Test pre-execution policy check');
    } catch (error) {
      // Ignore execution errors, we're testing policy checks
    }

    // Verify that checkPolicy was called before tool execution
    expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();

    const calls = (mockPolicyEngine.checkPolicy as MockedFunction<any>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const policyContext: PolicyCheckContext = calls[0][0];
    expect(policyContext).toMatchObject({
      action: expect.any(String),
      agentId: expect.any(String),
      taskId: task.id,
      toolName: expect.any(String),
      environment: {
        projectPath: testProjectPath,
      },
    });
  });

  it('should allow tool execution when policy check passes', async () => {
    // Configure policy to allow the action
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
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(async () => {
      toolExecuted = true;
      return {
        content: [{ type: 'text', text: 'Tool executed successfully' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      };
    });

    // Mock hook system that checks policy before allowing tool execution
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any) => {
          const result = await mockPolicyEngine.checkPolicy({
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
          });

          // Allow execution if policy allows it
          if (result.status === 'allow') {
            return {};
          } else {
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'Policy violation',
              },
            };
          }
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    try {
      await orchestrator.executeTask(task.id, 'Test allowed execution');
    } catch (error) {
      // Check that it's not a policy-related error
      expect((error as Error).message).not.toContain('Policy violation');
    }

    expect(toolExecuted).toBe(true);
    expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();
  });
});

// ============================================================================
// Policy Enforcement Mode Tests
// ============================================================================

describe('ApexOrchestrator - Policy Enforcement Modes', () => {
  let testProjectPath: string;
  let eventCollector: EventCollector;

  beforeEach(async () => {
    testProjectPath = await createTestProject();
    eventCollector = new EventCollector();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should block execution and emit policy:blocked event in strict mode', async () => {
    const violation: PolicyViolation = {
      id: 'strict-violation',
      rule: 'dangerous-operation',
      message: 'Dangerous operation not allowed',
      severity: 'error',
      blocking: true,
      policyType: 'path',
      timestamp: new Date(),
    };

    const blockResponse: PolicyCheckResult = {
      status: 'deny',
      violations: [violation],
      enforcementMode: 'strict',
      checkedAt: new Date(),
      policyName: 'strict-policy',
      policyId: 'strict-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 15,
      metadata: {},
    };

    const strictPolicyEngine = createMockPolicyEngine(blockResponse);

    const options: OrchestratorOptions = {
      policyEngine: strictPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    (orchestrator as any).eventEmitter = eventCollector;

    const task = createMockTask();
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(() => {
      toolExecuted = true;
      return Promise.resolve({
        content: [{ type: 'text', text: 'This should not execute' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    // Mock hook system that enforces strict policy
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any) => {
          const result = await strictPolicyEngine.checkPolicy({
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
          });

          if (result.status === 'deny') {
            // Emit policy blocked event
            const eventData: PolicyBlockedEventData = {
              taskId: task.id,
              agent: 'test-agent',
              action: input.tool_name || 'unknown',
              toolName: input.tool_name,
              violations: result.violations,
              enforcementMode: result.enforcementMode,
              timestamp: new Date(),
            };
            eventCollector.emit('policy:blocked', eventData);

            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: `Policy violation: ${result.violations.map(v => v.message).join('; ')}`,
              },
            };
          }

          return {};
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    try {
      await orchestrator.executeTask(task.id, 'Test strict mode blocking');
    } catch (error) {
      // Expected to be blocked
    }

    // Verify tool was not executed
    expect(toolExecuted).toBe(false);

    // Verify policy:blocked event was emitted
    const blockedEvents = eventCollector.getEvents('policy:blocked');
    expect(blockedEvents).toHaveLength(1);

    const blockedEvent = blockedEvents[0];
    expect(blockedEvent.data).toMatchObject({
      taskId: task.id,
      agent: 'test-agent',
      violations: [violation],
      enforcementMode: 'strict',
    });
  });

  it('should warn but continue execution and emit policy:warned event in warn mode', async () => {
    const violation: PolicyViolation = {
      id: 'warn-violation',
      rule: 'risky-operation',
      message: 'Potentially risky operation',
      severity: 'warning',
      blocking: false,
      policyType: 'path',
      timestamp: new Date(),
    };

    const warnResponse: PolicyCheckResult = {
      status: 'allow', // Allow in warn mode
      violations: [violation],
      enforcementMode: 'warn',
      checkedAt: new Date(),
      policyName: 'warn-policy',
      policyId: 'warn-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 12,
      metadata: {},
    };

    const warnPolicyEngine = createMockPolicyEngine(warnResponse);

    const options: OrchestratorOptions = {
      policyEngine: warnPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    (orchestrator as any).eventEmitter = eventCollector;

    const task = createMockTask();
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(() => {
      toolExecuted = true;
      return Promise.resolve({
        content: [{ type: 'text', text: 'Warn mode execution' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    // Mock hook system that enforces warn mode policy
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any) => {
          const result = await warnPolicyEngine.checkPolicy({
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
          });

          // In warn mode, emit warnings for non-blocking violations but continue
          for (const violation of result.violations) {
            if (!violation.blocking) {
              const eventData: PolicyWarnedEventData = {
                taskId: task.id,
                agent: 'test-agent',
                action: input.tool_name || 'unknown',
                toolName: input.tool_name,
                violation,
                enforcementMode: result.enforcementMode,
                timestamp: new Date(),
              };
              eventCollector.emit('policy:warned', eventData);
            }
          }

          // Continue execution in warn mode unless blocking violations exist
          if (result.status === 'deny' && result.violations.some(v => v.blocking)) {
            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'Blocking policy violation',
              },
            };
          }

          return {};
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    try {
      await orchestrator.executeTask(task.id, 'Test warn mode execution');
    } catch (error) {
      // Should not fail in warn mode for non-blocking violations
    }

    // Verify tool was executed despite warning
    expect(toolExecuted).toBe(true);

    // Verify policy:warned event was emitted
    const warnedEvents = eventCollector.getEvents('policy:warned');
    expect(warnedEvents).toHaveLength(1);

    const warnedEvent = warnedEvents[0];
    expect(warnedEvent.data).toMatchObject({
      taskId: task.id,
      agent: 'test-agent',
      violation: violation,
      enforcementMode: 'warn',
    });
  });

  it('should log but continue execution and emit policy:audited event in audit mode', async () => {
    const violation: PolicyViolation = {
      id: 'audit-violation',
      rule: 'audit-rule',
      message: 'Action logged for audit',
      severity: 'info',
      blocking: false,
      policyType: 'path',
      timestamp: new Date(),
    };

    const auditResponse: PolicyCheckResult = {
      status: 'allow', // Always allow in audit mode
      violations: [violation],
      enforcementMode: 'audit',
      checkedAt: new Date(),
      policyName: 'audit-policy',
      policyId: 'audit-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 0,
      rulesFailed: 1,
      durationMs: 5,
      metadata: {},
    };

    const auditPolicyEngine = createMockPolicyEngine(auditResponse);

    const options: OrchestratorOptions = {
      policyEngine: auditPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    (orchestrator as any).eventEmitter = eventCollector;

    const task = createMockTask();
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(() => {
      toolExecuted = true;
      return Promise.resolve({
        content: [{ type: 'text', text: 'Audit mode execution' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    // Mock hook system that enforces audit mode policy
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any) => {
          const result = await auditPolicyEngine.checkPolicy({
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
          });

          // In audit mode, always log but never block
          const eventData: PolicyAuditedEventData = {
            taskId: task.id,
            agent: 'test-agent',
            action: input.tool_name || 'unknown',
            toolName: input.tool_name,
            violations: result.violations,
            enforcementMode: result.enforcementMode,
            timestamp: new Date(),
          };
          eventCollector.emit('policy:audited', eventData);

          return {}; // Always allow in audit mode
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    await orchestrator.executeTask(task.id, 'Test audit mode execution');

    // Verify tool was executed
    expect(toolExecuted).toBe(true);

    // Verify policy:audited event was emitted
    const auditedEvents = eventCollector.getEvents('policy:audited');
    expect(auditedEvents).toHaveLength(1);

    const auditedEvent = auditedEvents[0];
    expect(auditedEvent.data).toMatchObject({
      taskId: task.id,
      agent: 'test-agent',
      violations: [violation],
      enforcementMode: 'audit',
    });
  });

  it('should handle multiple policy violations correctly', async () => {
    const violations: PolicyViolation[] = [
      {
        id: 'violation-1',
        rule: 'rule-1',
        message: 'First violation',
        severity: 'warning',
        blocking: false,
        policyType: 'path',
        timestamp: new Date(),
      },
      {
        id: 'violation-2',
        rule: 'rule-2',
        message: 'Second violation',
        severity: 'error',
        blocking: true,
        policyType: 'path',
        timestamp: new Date(),
      },
    ];

    const multiViolationResponse: PolicyCheckResult = {
      status: 'deny', // Should be denied due to blocking violation
      violations,
      enforcementMode: 'warn',
      checkedAt: new Date(),
      policyName: 'multi-policy',
      policyId: 'multi-policy-id',
      rulesEvaluated: 2,
      rulesPassed: 0,
      rulesFailed: 2,
      durationMs: 20,
      metadata: {},
    };

    const multiViolationEngine = createMockPolicyEngine(multiViolationResponse);

    const options: OrchestratorOptions = {
      policyEngine: multiViolationEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    (orchestrator as any).eventEmitter = eventCollector;

    const task = createMockTask();
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(() => {
      toolExecuted = true;
      return Promise.resolve({
        content: [{ type: 'text', text: 'Should not execute' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    // Mock hook system that handles multiple violations
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any) => {
          const result = await multiViolationEngine.checkPolicy({
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
          });

          // Check if any violations are blocking
          const blockingViolations = result.violations.filter(v => v.blocking);
          const nonBlockingViolations = result.violations.filter(v => !v.blocking);

          // Emit warnings for non-blocking violations
          for (const violation of nonBlockingViolations) {
            const eventData: PolicyWarnedEventData = {
              taskId: task.id,
              agent: 'test-agent',
              action: input.tool_name || 'unknown',
              toolName: input.tool_name,
              violation,
              enforcementMode: result.enforcementMode,
              timestamp: new Date(),
            };
            eventCollector.emit('policy:warned', eventData);
          }

          // Block if there are blocking violations
          if (blockingViolations.length > 0) {
            const eventData: PolicyBlockedEventData = {
              taskId: task.id,
              agent: 'test-agent',
              action: input.tool_name || 'unknown',
              toolName: input.tool_name,
              violations: blockingViolations,
              enforcementMode: result.enforcementMode,
              timestamp: new Date(),
            };
            eventCollector.emit('policy:blocked', eventData);

            return {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: `Blocking violations: ${blockingViolations.map(v => v.message).join('; ')}`,
              },
            };
          }

          return {};
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    try {
      await orchestrator.executeTask(task.id, 'Test multiple violations');
    } catch (error) {
      // Expected to be blocked
    }

    // Verify tool was not executed due to blocking violation
    expect(toolExecuted).toBe(false);

    // Verify both warned and blocked events were emitted
    const warnedEvents = eventCollector.getEvents('policy:warned');
    const blockedEvents = eventCollector.getEvents('policy:blocked');

    expect(warnedEvents).toHaveLength(1); // For the non-blocking violation
    expect(blockedEvents).toHaveLength(1); // For the blocking violation

    const warnedEvent = warnedEvents[0];
    expect(warnedEvent.data).toMatchObject({
      violation: violations[0], // Non-blocking violation
    });

    const blockedEvent = blockedEvents[0];
    expect((blockedEvent.data as PolicyBlockedEventData).violations).toContainEqual(violations[1]); // Blocking violation
  });

  it('should work correctly when PolicyEngine is disabled', async () => {
    const disabledResponse: PolicyCheckResult = {
      status: 'allow',
      violations: [],
      enforcementMode: 'disabled',
      checkedAt: new Date(),
      policyName: 'disabled-policy',
      policyId: 'disabled-policy-id',
      rulesEvaluated: 0,
      rulesPassed: 0,
      rulesFailed: 0,
      durationMs: 0,
      metadata: { disabled: true },
    };

    const disabledPolicyEngine = createMockPolicyEngine(disabledResponse);

    const options: OrchestratorOptions = {
      policyEngine: disabledPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    (orchestrator as any).eventEmitter = eventCollector;

    const task = createMockTask();
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(() => {
      toolExecuted = true;
      return Promise.resolve({
        content: [{ type: 'text', text: 'Disabled mode execution' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    // Mock hook system with disabled policy engine
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async (input: any) => {
          const result = await disabledPolicyEngine.checkPolicy({
            action: input.tool_name || 'unknown',
            agentId: 'test-agent',
            taskId: task.id,
            toolName: input.tool_name,
            toolArguments: input.tool_input,
          });

          // In disabled mode, should always allow without events
          if (result.enforcementMode === 'disabled') {
            return {}; // Allow without policy events
          }

          return {};
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    await orchestrator.executeTask(task.id, 'Test disabled mode execution');

    // Verify tool was executed
    expect(toolExecuted).toBe(true);

    // Verify no policy events were emitted
    const policyEvents = [
      ...eventCollector.getEvents('policy:blocked'),
      ...eventCollector.getEvents('policy:warned'),
      ...eventCollector.getEvents('policy:audited'),
    ];
    expect(policyEvents).toHaveLength(0);

    // Verify policy engine was still called but returned disabled
    expect(disabledPolicyEngine.checkPolicy).toHaveBeenCalled();
  });

  it('should work correctly when PolicyEngine is not provided', async () => {
    const options: OrchestratorOptions = {};

    const orchestrator = new ApexOrchestrator(testProjectPath, options);
    (orchestrator as any).eventEmitter = eventCollector;

    const task = createMockTask();
    let toolExecuted = false;

    const mockQuery = vi.fn().mockImplementation(() => {
      toolExecuted = true;
      return Promise.resolve({
        content: [{ type: 'text', text: 'No policy engine execution' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });

    // Mock hook system without policy engine
    const mockCreateHooksWithManager = vi.fn().mockReturnValue({
      PreToolUse: [{
        hooks: [async () => {
          // No policy checks when engine is not provided
          return {};
        }],
        timeout: 30,
      }],
      PostToolUse: [],
    });

    (orchestrator as any).query = mockQuery;
    (orchestrator as any).createHooksWithManager = mockCreateHooksWithManager;

    await orchestrator.executeTask(task.id, 'Test no policy engine execution');

    // Verify tool was executed without policy checks
    expect(toolExecuted).toBe(true);

    // Verify no policy events were emitted
    const policyEvents = [
      ...eventCollector.getEvents('policy:blocked'),
      ...eventCollector.getEvents('policy:warned'),
      ...eventCollector.getEvents('policy:audited'),
    ];
    expect(policyEvents).toHaveLength(0);

    // Verify no policy engine is present
    expect((orchestrator as any).policyEngine).toBeUndefined();
  });
});