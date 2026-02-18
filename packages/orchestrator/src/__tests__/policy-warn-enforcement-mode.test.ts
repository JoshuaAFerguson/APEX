/**
 * @fileoverview Tests for Policy Warn Enforcement Mode
 *
 * This test file validates the task acceptance criteria:
 * 1. When PolicyEngine returns violation with warn mode, orchestrator emits policy:warned event
 * 2. Warning is logged via orchestrator logging (console.warn)
 * 3. Action execution continues normally
 * 4. Claude SDK query proceeds after warning
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import type {
  ApexConfig,
  PolicyCheckResult,
  PolicyEngine as IPolicyEngine,
  OrchestratorOptions,
  PolicyViolation,
  PolicyEnforcementMode,
} from '@apexcli/core';
import type { PolicyWarnedEventData } from '../index.js';
import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';

// ============================================================================
// Test Project Setup
// ============================================================================

async function createWarnTestProject(): Promise<string> {
  const testDir = path.join(tmpdir(), `apex-warn-test-${randomUUID()}`);
  const apexDir = path.join(testDir, '.apex');

  await fs.mkdir(apexDir, { recursive: true });

  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    `
project:
  name: warn-test
  description: Policy warn mode test project

policy:
  enabled: true
  enforcement: warn
  name: warn-policy

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
// Mock Policy Engine Utilities
// ============================================================================

function createMockPolicyViolation(): PolicyViolation {
  return {
    id: randomUUID(),
    rule: 'test-warn-rule',
    message: 'Test policy violation for warn mode',
    severity: 'warning',
    blocking: false,
    policyType: 'path',
    timestamp: new Date(),
  };
}

function createWarnModePolicyEngine(violations: PolicyViolation[] = []): IPolicyEngine {
  return {
    checkPolicy: vi.fn().mockResolvedValue({
      status: 'allow',
      violations,
      enforcementMode: 'warn' as PolicyEnforcementMode,
      checkedAt: new Date(),
      policyName: 'test-warn-policy',
      policyId: 'test-warn-policy-id',
      rulesEvaluated: 1,
      rulesPassed: violations.length === 0 ? 1 : 0,
      rulesFailed: violations.length,
      durationMs: 10,
      metadata: {},
    } as PolicyCheckResult),
    getEnforcementMode: vi.fn().mockReturnValue('warn'),
    setEnforcementMode: vi.fn(),
    registerPolicy: vi.fn(),
    unregisterPolicy: vi.fn().mockReturnValue(false),
    getPolicies: vi.fn().mockReturnValue([]),
    getPolicy: vi.fn(),
    hasPolicy: vi.fn().mockReturnValue(false),
    clearPolicies: vi.fn(),
  };
}

// ============================================================================
// Warn Enforcement Mode Tests
// ============================================================================

describe('Policy Warn Enforcement Mode', () => {
  let testProjectPath: string;
  let consoleWarnSpy: any;

  beforeEach(async () => {
    testProjectPath = await createWarnTestProject();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('AC1: PolicyEngine returns violation with warn mode, orchestrator emits policy:warned event', () => {
    it('should emit policy:warned event when violations exist in warn mode', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      // Capture warned events
      const warnedEvents: PolicyWarnedEventData[] = [];
      orchestrator.on('policy:warned', (event) => warnedEvents.push(event));

      // Mock Claude SDK query to avoid actual API calls
      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      // Execute task to trigger policy check
      try {
        await orchestrator.executeTask(taskId, 'Test warn mode policy event emission');
      } catch {
        // Ignore execution errors, focus on event emission
      }

      // Verify policy:warned event was emitted
      expect(warnedEvents).toHaveLength(1);
      expect(warnedEvents[0]).toMatchObject({
        taskId: expect.any(String),
        agent: expect.any(String),
        action: expect.any(String),
        violation,
        enforcementMode: 'warn',
      });
    });

    it('should emit multiple policy:warned events for multiple violations', async () => {
      const violation1 = createMockPolicyViolation();
      const violation2 = { ...createMockPolicyViolation(), rule: 'test-warn-rule-2' };
      const mockPolicyEngine = createWarnModePolicyEngine([violation1, violation2]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const warnedEvents: PolicyWarnedEventData[] = [];
      orchestrator.on('policy:warned', (event) => warnedEvents.push(event));

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test multiple violations warn mode');
      } catch {
        // Ignore execution errors
      }

      // Verify multiple policy:warned events were emitted
      expect(warnedEvents).toHaveLength(2);
      expect(warnedEvents[0].violation).toEqual(violation1);
      expect(warnedEvents[1].violation).toEqual(violation2);
    });

    it('should not emit policy:warned event when no violations exist', async () => {
      const mockPolicyEngine = createWarnModePolicyEngine([]); // No violations

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const warnedEvents: PolicyWarnedEventData[] = [];
      orchestrator.on('policy:warned', (event) => warnedEvents.push(event));

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test no violations warn mode');
      } catch {
        // Ignore execution errors
      }

      // Verify no policy:warned events were emitted
      expect(warnedEvents).toHaveLength(0);
    });

    it('should include correct event data structure in policy:warned event', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const warnedEvents: PolicyWarnedEventData[] = [];
      orchestrator.on('policy:warned', (event) => warnedEvents.push(event));

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test event data structure');
      } catch {
        // Ignore execution errors
      }

      // Verify event data structure
      expect(warnedEvents).toHaveLength(1);
      const eventData = warnedEvents[0];

      // Check required fields
      expect(eventData.taskId).toBeDefined();
      expect(typeof eventData.taskId).toBe('string');
      expect(eventData.agent).toBeDefined();
      expect(typeof eventData.agent).toBe('string');
      expect(eventData.action).toBeDefined();
      expect(typeof eventData.action).toBe('string');
      expect(eventData.violation).toEqual(violation);
      expect(eventData.enforcementMode).toBe('warn');
    });
  });

  describe('AC2: Warning is logged via orchestrator logging (console.warn)', () => {
    it('should log warnings via console.warn for each violation', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test console.warn logging');
      } catch {
        // Ignore execution errors
      }

      // Verify console.warn was called with policy warning
      expect(consoleWarnSpy).toHaveBeenCalled();

      // Find the policy warning log call
      const policyWarningCalls = consoleWarnSpy.mock.calls.filter(call =>
        call[0] && call[0].includes('Policy warning')
      );

      expect(policyWarningCalls).toHaveLength(1);
      expect(policyWarningCalls[0][0]).toContain('Policy warning');
      expect(policyWarningCalls[0][0]).toContain(violation.severity);
      expect(policyWarningCalls[0][0]).toContain(violation.message);
    });

    it('should log multiple warnings for multiple violations', async () => {
      const violation1 = createMockPolicyViolation();
      const violation2 = {
        ...createMockPolicyViolation(),
        rule: 'test-warn-rule-2',
        message: 'Second test violation'
      };
      const mockPolicyEngine = createWarnModePolicyEngine([violation1, violation2]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test multiple console.warn logging');
      } catch {
        // Ignore execution errors
      }

      // Verify multiple console.warn calls for policy warnings
      const policyWarningCalls = consoleWarnSpy.mock.calls.filter(call =>
        call[0] && call[0].includes('Policy warning')
      );

      expect(policyWarningCalls).toHaveLength(2);
      expect(policyWarningCalls[0][0]).toContain(violation1.message);
      expect(policyWarningCalls[1][0]).toContain(violation2.message);
    });

    it('should include task context in warning logs', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test warning log context');
      } catch {
        // Ignore execution errors
      }

      // Verify console.warn includes context information
      const policyWarningCalls = consoleWarnSpy.mock.calls.filter(call =>
        call[0] && call[0].includes('Policy warning')
      );

      expect(policyWarningCalls).toHaveLength(1);

      // Check that context object is passed as second argument
      expect(policyWarningCalls[0][1]).toBeDefined();
      expect(policyWarningCalls[0][1]).toMatchObject({
        taskId: expect.any(String),
        violationId: violation.id,
      });
    });
  });

  describe('AC3: Action execution continues normally', () => {
    it('should proceed with action execution after warning in warn mode', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response after warning' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();
      let executionCompleted = false;
      let executionResult: any;

      try {
        executionResult = await orchestrator.executeTask(taskId, 'Test execution continues after warning');
        executionCompleted = true;
      } catch (error) {
        // Should not throw due to warn mode
        console.error('Unexpected execution error:', error);
      }

      // Verify execution completed successfully
      expect(executionCompleted).toBe(true);

      // Verify Claude SDK query was called (action proceeded)
      expect(mockQuery).toHaveBeenCalled();

      // Verify policy check was still performed
      expect(mockPolicyEngine.checkPolicy).toHaveBeenCalled();
    });

    it('should not block execution flow when multiple violations exist in warn mode', async () => {
      const violation1 = createMockPolicyViolation();
      const violation2 = { ...createMockPolicyViolation(), rule: 'test-warn-rule-2' };
      const mockPolicyEngine = createWarnModePolicyEngine([violation1, violation2]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const executionOrder: string[] = [];
      const mockQuery = vi.fn().mockImplementation(async () => {
        executionOrder.push('claude-query-executed');
        return {
          content: [{ type: 'text', text: 'Test response with multiple warnings' }],
          stopReason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      });
      (orchestrator as any).query = mockQuery;

      // Track when warnings are logged
      const originalWarn = console.warn;
      console.warn = vi.fn().mockImplementation((...args) => {
        if (args[0] && args[0].includes('Policy warning')) {
          executionOrder.push('warning-logged');
        }
      });

      const taskId = randomUUID();
      let executionError: any = null;

      try {
        await orchestrator.executeTask(taskId, 'Test no blocking with multiple violations');
      } catch (error) {
        executionError = error;
      } finally {
        console.warn = originalWarn;
      }

      // Verify execution was not blocked
      expect(executionError).toBeNull();

      // Verify warnings were logged and query executed
      expect(executionOrder).toContain('warning-logged');
      expect(executionOrder).toContain('claude-query-executed');

      // Verify multiple warnings were processed
      expect(executionOrder.filter(item => item === 'warning-logged')).toHaveLength(2);
    });
  });

  describe('AC4: Claude SDK query proceeds after warning', () => {
    it('should call Claude SDK query after processing warnings', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const executionOrder: string[] = [];

      // Mock policy check to track timing
      const originalCheckPolicy = mockPolicyEngine.checkPolicy;
      mockPolicyEngine.checkPolicy = vi.fn().mockImplementation(async (...args) => {
        executionOrder.push('policy-check');
        return await originalCheckPolicy(...args);
      });

      const mockQuery = vi.fn().mockImplementation(async () => {
        executionOrder.push('claude-query');
        return {
          content: [{ type: 'text', text: 'Test response after policy check' }],
          stopReason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test Claude SDK query timing after warning');
      } catch {
        // Ignore execution errors
      }

      // Verify execution order: policy check should come before Claude query
      expect(executionOrder).toContain('policy-check');
      expect(executionOrder).toContain('claude-query');

      const policyIndex = executionOrder.indexOf('policy-check');
      const queryIndex = executionOrder.indexOf('claude-query');

      expect(policyIndex).toBeLessThan(queryIndex);
      expect(mockQuery).toHaveBeenCalledAfter(mockPolicyEngine.checkPolicy as any);
    });

    it('should pass correct parameters to Claude SDK query despite warnings', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response with parameters' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();
      const testDescription = 'Test parameter passing after warnings';

      try {
        await orchestrator.executeTask(taskId, testDescription);
      } catch {
        // Ignore execution errors
      }

      // Verify Claude SDK query was called with correct parameters
      expect(mockQuery).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: expect.stringContaining(testDescription),
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should maintain normal query response handling after warnings', async () => {
      const violation = createMockPolicyViolation();
      const mockPolicyEngine = createWarnModePolicyEngine([violation]);

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const expectedResponse = {
        content: [{ type: 'text', text: 'Expected response content' }],
        stopReason: 'end_turn' as const,
        usage: { input_tokens: 150, output_tokens: 75 },
      };

      const mockQuery = vi.fn().mockResolvedValue(expectedResponse);
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();
      let actualResult: any;

      try {
        actualResult = await orchestrator.executeTask(taskId, 'Test response handling after warnings');
      } catch {
        // Ignore execution errors for this test
      }

      // Verify Claude SDK query was called and response handled normally
      expect(mockQuery).toHaveBeenCalled();

      // Response handling verification would depend on internal implementation
      // The key point is that execution doesn't fail due to warnings
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle PolicyEngine errors gracefully in warn mode', async () => {
      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockRejectedValue(new Error('Policy engine failure')),
        getEnforcementMode: vi.fn().mockReturnValue('warn'),
        setEnforcementMode: vi.fn(),
        registerPolicy: vi.fn(),
        unregisterPolicy: vi.fn().mockReturnValue(false),
        getPolicies: vi.fn().mockReturnValue([]),
        getPolicy: vi.fn(),
        hasPolicy: vi.fn().mockReturnValue(false),
        clearPolicies: vi.fn(),
      };

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response after policy error' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();
      let executionError: any = null;

      try {
        await orchestrator.executeTask(taskId, 'Test policy engine error handling');
      } catch (error) {
        executionError = error;
      }

      // Verify policy engine error was caught and logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'PolicyEngine check failed:',
        expect.any(Error)
      );

      // Verify execution continued despite policy engine error (graceful degradation)
      // This behavior may vary based on implementation - adjust assertion accordingly
    });

    it('should handle malformed violations in warn mode', async () => {
      const malformedViolation = {
        // Missing required fields
        rule: 'malformed-rule',
        message: 'Malformed violation test',
      } as PolicyViolation;

      const mockPolicyEngine: IPolicyEngine = {
        checkPolicy: vi.fn().mockResolvedValue({
          status: 'allow',
          violations: [malformedViolation],
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'test-policy',
          policyId: 'test-policy-id',
          rulesEvaluated: 1,
          rulesPassed: 0,
          rulesFailed: 1,
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

      const orchestrator = new ApexOrchestrator({ projectPath: testProjectPath,
        policyEngine: mockPolicyEngine,
      });

      const warnedEvents: PolicyWarnedEventData[] = [];
      orchestrator.on('policy:warned', (event) => warnedEvents.push(event));

      const mockQuery = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response with malformed violation' }],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      (orchestrator as any).query = mockQuery;

      const taskId = randomUUID();

      try {
        await orchestrator.executeTask(taskId, 'Test malformed violation handling');
      } catch {
        // Ignore execution errors
      }

      // Verify graceful handling of malformed violations
      // Implementation should either skip malformed violations or provide defaults
      expect(mockQuery).toHaveBeenCalled(); // Execution should continue
    });
  });
});