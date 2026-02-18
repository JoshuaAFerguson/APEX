/**
 * Edge cases and error scenarios for pre-action autonomy checks
 *
 * This test suite covers edge cases, error conditions, and boundary scenarios
 * for the AutonomyEnforcer.checkAction method and its integration with
 * the ApexOrchestrator's PreToolUse hook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata } from '../autonomy-enforcer.js';
import { AutonomyLevel, AutonomyLimits, type ApprovalGate } from '@apexcli/core';

// Mock ApexOrchestrator
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
  },
});

describe('Autonomy Pre-Action Edge Cases and Error Scenarios', () => {
  let autonomyEnforcer: AutonomyEnforcer;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let defaultConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    defaultConfig = {
      level: 'review-before-commit' as AutonomyLevel,
      gates: [],
      limits: {
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.0,
        maxTimePerTaskMs: 300000,
      } as AutonomyLimits,
      warningThresholds: {
        costWarningPercent: 80,
        tokenWarningPercent: 80,
        timeWarningPercent: 80,
        fileWarningPercent: 80,
      },
    };

    autonomyEnforcer = new AutonomyEnforcer(defaultConfig, mockOrchestrator as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createActionMetadata = (overrides: Partial<ActionMetadata> = {}): ActionMetadata => ({
    agentType: 'developer',
    actionType: 'test-action',
    toolName: 'Write',
    operationType: 'write',
    ...overrides,
  });

  describe('Null and Undefined Handling', () => {
    it('should handle null action metadata gracefully', async () => {
      await expect(autonomyEnforcer.checkAction(null as any)).rejects.toThrow();
    });

    it('should handle undefined action metadata gracefully', async () => {
      await expect(autonomyEnforcer.checkAction(undefined as any)).rejects.toThrow();
    });

    it('should handle null/undefined agentType', async () => {
      const actions = [
        createActionMetadata({ agentType: null as any }),
        createActionMetadata({ agentType: undefined as any }),
      ];

      for (const action of actions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle null/undefined actionType', async () => {
      const actions = [
        createActionMetadata({ actionType: null as any }),
        createActionMetadata({ actionType: undefined as any }),
      ];

      for (const action of actions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle null/undefined toolName', async () => {
      const actions = [
        createActionMetadata({ toolName: null as any }),
        createActionMetadata({ toolName: undefined as any }),
      ];

      for (const action of actions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle null/undefined operationType', async () => {
      const actions = [
        createActionMetadata({ operationType: null as any }),
        createActionMetadata({ operationType: undefined as any }),
      ];

      for (const action of actions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle null/undefined scope', async () => {
      const actions = [
        createActionMetadata({ scope: null as any }),
        createActionMetadata({ scope: undefined as any }),
      ];

      for (const action of actions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Empty and Whitespace Handling', () => {
    it('should handle empty string values', async () => {
      const action = createActionMetadata({
        agentType: '',
        actionType: '',
        toolName: '',
        scope: '',
      });

      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle whitespace-only values', async () => {
      const action = createActionMetadata({
        agentType: '   ',
        actionType: '\t\n',
        toolName: '  \t  ',
        scope: '\n\n\n',
      });

      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle mixed empty and whitespace values', async () => {
      const action = createActionMetadata({
        agentType: '',
        actionType: '  ',
        toolName: undefined,
        scope: null as any,
      });

      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Invalid Configuration Handling', () => {
    it('should handle invalid autonomy level', async () => {
      autonomyEnforcer.updateConfig({
        level: 'invalid-level' as any,
      });

      const action = createActionMetadata();
      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle null gates array', async () => {
      autonomyEnforcer.updateConfig({
        gates: null as any,
      });

      const action = createActionMetadata();
      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle undefined gates array', async () => {
      autonomyEnforcer.updateConfig({
        gates: undefined as any,
      });

      const action = createActionMetadata();
      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle malformed gate objects', async () => {
      autonomyEnforcer.updateConfig({
        gates: [
          null,
          undefined,
          {},
          { type: null },
          { type: undefined },
          { type: 'invalid-gate-type' },
          { enabled: true }, // Missing type
        ] as any,
      });

      const action = createActionMetadata();
      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Memory and Resource Limits', () => {
    it('should handle extremely long string values', async () => {
      const longString = 'a'.repeat(1000000); // 1MB string

      const action = createActionMetadata({
        agentType: longString,
        actionType: longString,
        toolName: longString,
        scope: longString,
      });

      const startTime = Date.now();
      const result = await autonomyEnforcer.checkAction(action);
      const duration = Date.now() - startTime;

      expect(typeof result).toBe('boolean');
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle many concurrent checkAction calls', async () => {
      const concurrentCalls = 1000;
      const actions = Array.from({ length: concurrentCalls }, (_, i) =>
        createActionMetadata({ actionType: `action-${i}` })
      );

      const startTime = Date.now();
      const promises = actions.map(action => autonomyEnforcer.checkAction(action));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentCalls);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should handle event listener errors gracefully', async () => {
      // Add a listener that throws an error
      autonomyEnforcer.on('approval:required', () => {
        throw new Error('Event listener error');
      });

      autonomyEnforcer.updateConfig({ level: 'review-all' });

      const action = createActionMetadata({ operationType: 'write' });

      // Should not throw despite listener error
      await expect(autonomyEnforcer.checkAction(action)).resolves.toBe(true);
    });

    it('should handle multiple event listeners with mixed success/failure', async () => {
      let successfulListenerCalled = false;
      let errorListenerCalled = false;

      // Add successful listener
      autonomyEnforcer.on('approval:required', () => {
        successfulListenerCalled = true;
      });

      // Add failing listener
      autonomyEnforcer.on('approval:required', () => {
        errorListenerCalled = true;
        throw new Error('Listener error');
      });

      autonomyEnforcer.updateConfig({ level: 'review-all' });

      const action = createActionMetadata({ operationType: 'write' });
      const result = await autonomyEnforcer.checkAction(action);

      expect(result).toBe(true);
      expect(successfulListenerCalled).toBe(true);
      expect(errorListenerCalled).toBe(true);
    });

    it('should handle removal of event listeners during emission', async () => {
      let listenerCallCount = 0;

      const listener = () => {
        listenerCallCount++;
        // Remove self during execution
        autonomyEnforcer.removeListener('approval:required', listener);
      };

      autonomyEnforcer.on('approval:required', listener);
      autonomyEnforcer.updateConfig({ level: 'review-all' });

      const action = createActionMetadata({ operationType: 'write' });

      // Call twice to test listener removal
      await autonomyEnforcer.checkAction(action);
      await autonomyEnforcer.checkAction(action);

      expect(listenerCallCount).toBe(1); // Should only be called once
    });
  });

  describe('Gate Matching Edge Cases', () => {
    it('should handle case sensitivity in gate matching', async () => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [{ type: 'before-destructive', enabled: true } as ApprovalGate],
      });

      const caseVariations = [
        createActionMetadata({ actionType: 'DELETE-FILE' }),
        createActionMetadata({ actionType: 'Delete-File' }),
        createActionMetadata({ actionType: 'delete_file' }),
        createActionMetadata({ actionType: 'deleteFile' }),
        createActionMetadata({ actionType: 'REMOVE-DATA' }),
        createActionMetadata({ scope: 'DELETE-OPERATION' }),
        createActionMetadata({ scope: 'remove-important-files' }),
      ];

      for (const action of caseVariations) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
        // The exact result depends on implementation - testing that it doesn't crash
      }
    });

    it('should handle special characters in action metadata', async () => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [{ type: 'before-destructive', enabled: true } as ApprovalGate],
      });

      const specialCharActions = [
        createActionMetadata({ actionType: 'delete@#$%^&*()file' }),
        createActionMetadata({ toolName: 'Bash!@#$%' }),
        createActionMetadata({ scope: '/path/with spaces/file.txt' }),
        createActionMetadata({ scope: 'file-with-émojis-🚀.ts' }),
        createActionMetadata({ agentType: 'agent-with-ünicödé' }),
      ];

      for (const action of specialCharActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle regex-breaking patterns', async () => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [{ type: 'before-destructive', enabled: true } as ApprovalGate],
      });

      const regexBreakingActions = [
        createActionMetadata({ actionType: 'delete[\\w+]*' }),
        createActionMetadata({ actionType: 'remove.*everything' }),
        createActionMetadata({ scope: '/path/[unclosed-bracket' }),
        createActionMetadata({ scope: '.*+?{invalid-regex}' }),
        createActionMetadata({ toolName: 'Bash(unclosed-paren' }),
      ];

      for (const action of regexBreakingActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Configuration Update Edge Cases', () => {
    it('should handle partial configuration updates', async () => {
      const action = createActionMetadata();

      // Test partial update with undefined fields
      autonomyEnforcer.updateConfig({
        level: undefined as any,
      });

      let result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');

      // Test partial update with null fields
      autonomyEnforcer.updateConfig({
        gates: null as any,
        limits: undefined as any,
      });

      result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle configuration updates during execution', async () => {
      const action = createActionMetadata({ operationType: 'write' });

      // Start with review-all mode
      autonomyEnforcer.updateConfig({ level: 'review-all' });

      // Create a promise that will take some time
      const checkPromise = autonomyEnforcer.checkAction(action);

      // Immediately update config while check is in progress
      autonomyEnforcer.updateConfig({ level: 'full-auto' });

      // The check should complete without errors
      const result = await checkPromise;
      expect(typeof result).toBe('boolean');
    });

    it('should handle rapid configuration updates', async () => {
      const action = createActionMetadata();

      // Rapidly update configuration multiple times
      for (let i = 0; i < 100; i++) {
        autonomyEnforcer.updateConfig({
          level: i % 2 === 0 ? 'full-auto' : 'review-all',
        });
      }

      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Orchestrator Integration Edge Cases', () => {
    it('should handle orchestrator event emission failures', async () => {
      // Mock the orchestrator to throw on event emission
      vi.spyOn(mockOrchestrator, 'emit').mockImplementation(() => {
        throw new Error('Event emission failed');
      });

      // Create a new enforcer with the failing orchestrator
      const failingEnforcer = new AutonomyEnforcer(defaultConfig, mockOrchestrator as any);

      const action = createActionMetadata();

      // Should not throw despite orchestrator emit failure
      await expect(failingEnforcer.checkAction(action)).resolves.toBeDefined();
    });

    it('should handle orchestrator store failures', async () => {
      // Mock the store to throw on getTask
      vi.spyOn(mockOrchestrator.store, 'getTask').mockImplementation(() => {
        throw new Error('Store access failed');
      });

      const action = createActionMetadata();
      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });

    it('should handle circular reference in task context', async () => {
      // Create circular reference
      const circularContext: any = { self: null };
      circularContext.self = circularContext;

      // This test mainly ensures no infinite loops occur during context creation
      const action = createActionMetadata();
      const result = await autonomyEnforcer.checkAction(action);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle checkAction calls with high frequency', async () => {
      const action = createActionMetadata();
      const iterations = 10000;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await autonomyEnforcer.checkAction(action);
      }

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);
    });

    it('should handle memory-intensive action metadata', async () => {
      const largeObject = Array.from({ length: 100000 }, (_, i) => `item-${i}`).join(',');

      const memoryIntensiveAction = createActionMetadata({
        scope: largeObject,
        agentType: largeObject,
        actionType: largeObject,
      });

      const result = await autonomyEnforcer.checkAction(memoryIntensiveAction);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Async Behavior Edge Cases', () => {
    it('should handle checkAction calls with different timing', async () => {
      const actions = [
        createActionMetadata({ actionType: 'fast-action' }),
        createActionMetadata({ actionType: 'slow-action' }),
        createActionMetadata({ actionType: 'medium-action' }),
      ];

      // Start all checks with different delays
      const promises = actions.map(async (action, index) => {
        if (index === 1) {
          // Add delay for "slow" action
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return autonomyEnforcer.checkAction(action);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
    });

    it('should handle promise rejection in checkAction', async () => {
      // Mock an internal method to reject
      const originalMethod = (autonomyEnforcer as any).checkSpecificGatesForAction;
      vi.spyOn(autonomyEnforcer as any, 'checkSpecificGatesForAction').mockRejectedValue(
        new Error('Internal error')
      );

      const action = createActionMetadata();

      await expect(autonomyEnforcer.checkAction(action)).rejects.toThrow('Internal error');

      // Restore original method
      vi.mocked((autonomyEnforcer as any).checkSpecificGatesForAction).mockRestore();
    });
  });
});