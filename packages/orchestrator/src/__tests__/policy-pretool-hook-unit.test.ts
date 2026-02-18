/**
 * @fileoverview Unit tests for Policy PreTool Hook Implementation
 *
 * This test suite focuses specifically on the PreToolUse hook implementation
 * that integrates the PolicyEngine with the Claude Agent SDK's hook system.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index';
import type {
  PolicyCheckResult,
  PolicyCheckContext,
  PolicyViolation,
  PolicyEngine as IPolicyEngine,
} from '@apexcli/core';
import type {
  PolicyBlockedEventData,
} from '../index';

/**
 * Mock PolicyEngine for testing
 */
class TestPolicyEngine implements IPolicyEngine {
  private checkPolicyMock: MockedFunction<(context: PolicyCheckContext) => Promise<PolicyCheckResult>>;

  constructor() {
    this.checkPolicyMock = vi.fn();
  }

  async checkPolicy(context: PolicyCheckContext): Promise<PolicyCheckResult> {
    return this.checkPolicyMock(context);
  }

  setResult(result: PolicyCheckResult) {
    this.checkPolicyMock.mockResolvedValue(result);
  }

  setError(error: Error) {
    this.checkPolicyMock.mockRejectedValue(error);
  }

  getMock() {
    return this.checkPolicyMock;
  }

  reset() {
    this.checkPolicyMock.mockReset();
  }
}

/**
 * Mock AutonomyEnforcer for testing
 */
class TestAutonomyEnforcer {
  private checkActionMock: MockedFunction<(metadata: any) => Promise<boolean>>;

  constructor() {
    this.checkActionMock = vi.fn();
  }

  async checkAction(metadata: any): Promise<boolean> {
    return this.checkActionMock(metadata);
  }

  setRequiresApproval(requires: boolean) {
    this.checkActionMock.mockResolvedValue(requires);
  }

  getMock() {
    return this.checkActionMock;
  }

  reset() {
    this.checkActionMock.mockReset();
  }
}

describe('Policy PreTool Hook Unit Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockPolicyEngine: TestPolicyEngine;
  let mockAutonomyEnforcer: TestAutonomyEnforcer;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    // Silence console warnings
    originalConsoleWarn = console.warn;
    console.warn = vi.fn();

    // Create orchestrator with minimal setup
    orchestrator = new ApexOrchestrator({ projectPath: '/tmp/test' });

    // Create and inject mock dependencies
    mockPolicyEngine = new TestPolicyEngine();
    mockAutonomyEnforcer = new TestAutonomyEnforcer();

    // Inject mocks into orchestrator
    (orchestrator as any).policyEngine = mockPolicyEngine;
    (orchestrator as any).autonomyEnforcer = mockAutonomyEnforcer;

    // Set up autonomy enforcer to not require approval by default
    mockAutonomyEnforcer.setRequiresApproval(false);
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    mockPolicyEngine?.reset();
    mockAutonomyEnforcer?.reset();
  });

  describe('PreToolUse hook with policy enforcement', () => {
    it('should call PolicyEngine.checkPolicy with correct context', async () => {
      // Arrange
      const allowResult: PolicyCheckResult = {
        status: 'allow',
        violations: [],
        enforcementMode: 'warn',
        checkId: randomUUID(),
        timestamp: new Date(),
        allowed: true,
        blocked: false,
        warningsIssued: false
      };
      mockPolicyEngine.setResult(allowResult);

      const hookContext = {
        taskId: 'test-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/test.ts',
          content: 'console.log("test");'
        }
      };

      await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-1', { signal: new AbortController().signal });

      // Assert
      const policyMock = mockPolicyEngine.getMock();
      expect(policyMock).toHaveBeenCalledWith({
        action: {
          type: 'tool_use',
          agent: 'test-agent',
          tool: 'Write',
          parameters: toolInput.tool_input,
          timestamp: expect.any(Date),
        },
        task: {
          id: 'test-task',
          stage: 'test-stage',
          workflow: 'test-workflow',
        },
        environment: {
          projectPath: '/test/project',
        },
      });
    });

    it('should return permissionDecision deny when policy status is deny', async () => {
      // Arrange
      const violation: PolicyViolation = {
        violationId: 'v001',
        ruleId: 'test-rule',
        ruleName: 'Test Denial Rule',
        severity: 'critical',
        message: 'Action denied for testing',
        category: 'test'
      };

      const denyResult: PolicyCheckResult = {
        status: 'deny',
        violations: [violation],
        enforcementMode: 'strict',
        checkId: randomUUID(),
        timestamp: new Date(),
        allowed: false,
        blocked: true,
        warningsIssued: false
      };
      mockPolicyEngine.setResult(denyResult);

      const hookContext = {
        taskId: 'deny-test-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Bash',
        tool_input: {
          command: 'rm -rf /'
        }
      };

      const result = await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-2', { signal: new AbortController().signal });

      // Assert
      expect(result).toBeDefined();
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(result.hookSpecificOutput.permissionDecisionReason).toContain('Policy check failed');
      expect(result.hookSpecificOutput.permissionDecisionReason).toContain('Action denied for testing');
      expect(result.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    });

    it('should emit policy:blocked event when action is denied', async () => {
      // Arrange
      const blockedEvents: PolicyBlockedEventData[] = [];
      orchestrator.on('policy:blocked', (event) => blockedEvents.push(event));

      const violation: PolicyViolation = {
        violationId: 'v002',
        ruleId: 'block-rule',
        ruleName: 'Block Test Rule',
        severity: 'critical',
        message: 'Blocked for event testing',
        category: 'security'
      };

      const denyResult: PolicyCheckResult = {
        status: 'deny',
        violations: [violation],
        enforcementMode: 'strict',
        checkId: randomUUID(),
        timestamp: new Date(),
        allowed: false,
        blocked: true,
        warningsIssued: false
      };
      mockPolicyEngine.setResult(denyResult);

      const hookContext = {
        taskId: 'event-test-task',
        agentName: 'event-agent',
        stageName: 'event-stage',
        workflowName: 'event-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'event-agent',
        'event-stage',
        'event-workflow'
      );

      const toolInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/etc/passwd',
          content: 'malicious content'
        }
      };

      await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-3', { signal: new AbortController().signal });

      // Assert
      expect(blockedEvents).toHaveLength(1);

      const blockedEvent = blockedEvents[0];
      expect(blockedEvent.taskId).toBe('event-test-task');
      expect(blockedEvent.agent).toBe('event-agent');
      expect(blockedEvent.action).toBe('Write');
      expect(blockedEvent.violations).toEqual([violation]);
      expect(blockedEvent.enforcementMode).toBe('strict');
    });

    it('should not block when policy status is allow', async () => {
      // Arrange
      const allowResult: PolicyCheckResult = {
        status: 'allow',
        violations: [],
        enforcementMode: 'warn',
        checkId: randomUUID(),
        timestamp: new Date(),
        allowed: true,
        blocked: false,
        warningsIssued: false
      };
      mockPolicyEngine.setResult(allowResult);

      const hookContext = {
        taskId: 'allow-test-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Read',
        tool_input: {
          file_path: 'src/safe.ts'
        }
      };

      const result = await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-4', { signal: new AbortController().signal });

      // Assert
      expect(result).toBeUndefined(); // Should not block, so hook returns undefined
    });

    it('should handle policy engine errors gracefully', async () => {
      // Arrange
      const policyError = new Error('PolicyEngine crashed');
      mockPolicyEngine.setError(policyError);

      const hookContext = {
        taskId: 'error-test-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Read',
        tool_input: {
          file_path: 'src/test.ts'
        }
      };

      const result = await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-5', { signal: new AbortController().signal });

      // Assert
      expect(result).toBeUndefined(); // Should not block when policy engine fails (fail-safe)
      expect(console.warn).toHaveBeenCalledWith('PolicyEngine check failed:', policyError);
    });

    it('should skip policy check when policy engine is null', async () => {
      // Arrange
      (orchestrator as any).policyEngine = null;

      const hookContext = {
        taskId: 'no-policy-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/test.ts',
          content: 'test content'
        }
      };

      const result = await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-6', { signal: new AbortController().signal });

      // Assert
      expect(result).toBeUndefined(); // Should not block when no policy engine
      expect(mockPolicyEngine.getMock()).not.toHaveBeenCalled();
    });

    it('should check autonomy before policy and block if autonomy requires approval', async () => {
      // Arrange
      mockAutonomyEnforcer.setRequiresApproval(true); // Autonomy blocks first

      // Policy engine should not be called if autonomy blocks
      const allowResult: PolicyCheckResult = {
        status: 'allow',
        violations: [],
        enforcementMode: 'warn',
        checkId: randomUUID(),
        timestamp: new Date(),
        allowed: true,
        blocked: false,
        warningsIssued: false
      };
      mockPolicyEngine.setResult(allowResult);

      const hookContext = {
        taskId: 'autonomy-block-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Bash',
        tool_input: {
          command: 'sudo dangerous-command'
        }
      };

      const result = await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-7', { signal: new AbortController().signal });

      // Assert
      expect(result).toBeDefined();
      expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(result.hookSpecificOutput.permissionDecisionReason).toContain('Autonomy enforcer requires approval');

      // Verify autonomy was called but policy was not (short-circuit behavior)
      expect(mockAutonomyEnforcer.getMock()).toHaveBeenCalled();
      expect(mockPolicyEngine.getMock()).not.toHaveBeenCalled();
    });

    it('should check policy after autonomy passes', async () => {
      // Arrange
      mockAutonomyEnforcer.setRequiresApproval(false); // Autonomy allows

      const denyResult: PolicyCheckResult = {
        status: 'deny',
        violations: [{
          violationId: 'v003',
          ruleId: 'policy-rule',
          ruleName: 'Policy Test Rule',
          severity: 'critical',
          message: 'Policy blocks after autonomy allows',
          category: 'test'
        }],
        enforcementMode: 'strict',
        checkId: randomUUID(),
        timestamp: new Date(),
        allowed: false,
        blocked: true,
        warningsIssued: false
      };
      mockPolicyEngine.setResult(denyResult);

      const hookContext = {
        taskId: 'policy-after-autonomy-task',
        agentName: 'test-agent',
        stageName: 'test-stage',
        workflowName: 'test-workflow',
        projectPath: '/test/project',
        timestamp: new Date(),
        environment: {},
        metadata: {}
      };

      // Act
      const hooks = (orchestrator as any).createHooksWithManager(
        hookContext,
        'test-agent',
        'test-stage',
        'test-workflow'
      );

      const toolInput = {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/blocked.ts',
          content: 'blocked content'
        }
      };

      const result = await hooks.PreToolUse[0].hooks[0](toolInput, 'tool-use-8', { signal: new AbortController().signal });

      // Assert
      expect(result).toBeDefined();
      expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(result.hookSpecificOutput.permissionDecisionReason).toContain('Policy check failed');

      // Verify both autonomy and policy were called in the correct order
      expect(mockAutonomyEnforcer.getMock()).toHaveBeenCalled();
      expect(mockPolicyEngine.getMock()).toHaveBeenCalled();
    });
  });

  describe('determineOperationType helper', () => {
    it('should determine correct operation types for different tools', () => {
      // Test the operation type determination logic
      const determineOperationType = (orchestrator as any).determineOperationType;

      // Write operations
      expect(determineOperationType('Write', { file_path: 'test.ts', content: 'code' })).toBe('write');
      expect(determineOperationType('Edit', { file_path: 'test.ts' })).toBe('write');

      // Read operations
      expect(determineOperationType('Read', { file_path: 'test.ts' })).toBe('read');
      expect(determineOperationType('Glob', { pattern: '*.ts' })).toBe('read');

      // Execute operations
      expect(determineOperationType('bash', { command: 'ls' })).toBe('execute');

      // Dangerous operations
      expect(determineOperationType('bash', { command: 'rm -rf /' })).toBe('dangerous');
      expect(determineOperationType('bash', { command: 'sudo delete file' })).toBe('dangerous');

      // Default
      expect(determineOperationType('UnknownTool', {})).toBe('read');
    });
  });
});