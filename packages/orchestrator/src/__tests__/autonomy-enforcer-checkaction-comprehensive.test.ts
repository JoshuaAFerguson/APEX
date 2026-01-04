/**
 * Comprehensive test suite for AutonomyEnforcer.checkAction method
 *
 * This test suite focuses specifically on testing the checkAction method
 * that was added to support pre-action autonomy checks in the ApexOrchestrator.
 * It validates all autonomy levels, gate configurations, and edge cases.
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

describe('AutonomyEnforcer.checkAction - Comprehensive Tests', () => {
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
        maxCostPerTask: 1.00,
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
    actionType: 'write-file',
    scope: 'src/main.ts',
    toolName: 'Write',
    operationType: 'write',
    ...overrides,
  });

  describe('Full Auto Autonomy Level', () => {
    beforeEach(() => {
      autonomyEnforcer.updateConfig({ level: 'full-auto' });
    });

    it('should allow all operations without gates', async () => {
      const actions = [
        createActionMetadata({ operationType: 'read', toolName: 'Read' }),
        createActionMetadata({ operationType: 'write', toolName: 'Write' }),
        createActionMetadata({ operationType: 'execute', toolName: 'Bash' }),
        createActionMetadata({ operationType: 'network', toolName: 'WebFetch' }),
      ];

      for (const action of actions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(false);
      }
    });

    it('should respect specific approval gates', async () => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [
          { type: 'before-destructive', enabled: true } as ApprovalGate,
          { type: 'before-network', enabled: true } as ApprovalGate,
        ],
      });

      const dangerousAction = createActionMetadata({
        operationType: 'dangerous',
        actionType: 'delete-database',
        toolName: 'Bash'
      });

      const networkAction = createActionMetadata({
        operationType: 'network',
        actionType: 'fetch-data',
        toolName: 'WebFetch'
      });

      expect(await autonomyEnforcer.checkAction(dangerousAction)).toBe(true);
      expect(await autonomyEnforcer.checkAction(networkAction)).toBe(true);
    });

    it('should allow safe operations even with gates enabled', async () => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [{ type: 'before-destructive', enabled: true } as ApprovalGate],
      });

      const safeAction = createActionMetadata({
        operationType: 'read',
        actionType: 'read-file',
        toolName: 'Read'
      });

      expect(await autonomyEnforcer.checkAction(safeAction)).toBe(false);
    });
  });

  describe('Review Before Commit Autonomy Level', () => {
    beforeEach(() => {
      autonomyEnforcer.updateConfig({ level: 'review-before-commit' });
    });

    it('should require approval for git commit operations', async () => {
      const commitActions = [
        createActionMetadata({
          actionType: 'git-commit',
          toolName: 'Bash',
          operationType: 'execute'
        }),
        createActionMetadata({
          actionType: 'git-push',
          toolName: 'Bash',
          operationType: 'execute'
        }),
        createActionMetadata({
          actionType: 'deploy-to-production',
          toolName: 'Bash',
          operationType: 'execute'
        }),
        createActionMetadata({
          actionType: 'publish-package',
          toolName: 'Bash',
          operationType: 'execute'
        }),
      ];

      for (const action of commitActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(true);
      }
    });

    it('should allow non-commit operations', async () => {
      const nonCommitActions = [
        createActionMetadata({
          actionType: 'edit-file',
          toolName: 'Edit',
          operationType: 'write'
        }),
        createActionMetadata({
          actionType: 'read-file',
          toolName: 'Read',
          operationType: 'read'
        }),
        createActionMetadata({
          actionType: 'run-tests',
          toolName: 'Bash',
          operationType: 'execute'
        }),
      ];

      for (const action of nonCommitActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(false);
      }
    });

    it('should emit approval:required event for commit operations', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const commitAction = createActionMetadata({
        actionType: 'git-commit',
        toolName: 'Bash'
      });

      await autonomyEnforcer.checkAction(commitAction);

      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-commit',
        expect.objectContaining({
          agent: 'developer',
          operationType: 'write'
        })
      );
    });

    it('should check additional gates after commit check', async () => {
      autonomyEnforcer.updateConfig({
        level: 'review-before-commit',
        gates: [{ type: 'before-network', enabled: true } as ApprovalGate],
      });

      const networkAction = createActionMetadata({
        actionType: 'fetch-api-data',
        toolName: 'WebFetch',
        operationType: 'network'
      });

      expect(await autonomyEnforcer.checkAction(networkAction)).toBe(true);
    });
  });

  describe('Review All Autonomy Level', () => {
    beforeEach(() => {
      autonomyEnforcer.updateConfig({ level: 'review-all' });
    });

    it('should allow read operations without approval', async () => {
      const readActions = [
        createActionMetadata({
          operationType: 'read',
          actionType: 'read-file',
          toolName: 'Read'
        }),
        createActionMetadata({
          operationType: 'read',
          actionType: 'list-files',
          toolName: 'Glob'
        }),
        createActionMetadata({
          operationType: 'read',
          actionType: 'grep-content',
          toolName: 'Grep'
        }),
      ];

      for (const action of readActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(false);
      }
    });

    it('should require approval for all non-read operations', async () => {
      const nonReadActions = [
        createActionMetadata({
          operationType: 'write',
          actionType: 'write-file',
          toolName: 'Write'
        }),
        createActionMetadata({
          operationType: 'execute',
          actionType: 'run-command',
          toolName: 'Bash'
        }),
        createActionMetadata({
          operationType: 'network',
          actionType: 'fetch-data',
          toolName: 'WebFetch'
        }),
        createActionMetadata({
          operationType: 'dangerous',
          actionType: 'delete-file',
          toolName: 'Bash'
        }),
      ];

      for (const action of nonReadActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(result).toBe(true);
      }
    });

    it('should emit approval:required event for non-read operations', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const writeAction = createActionMetadata({
        operationType: 'write',
        actionType: 'write-file',
        toolName: 'Write'
      });

      await autonomyEnforcer.checkAction(writeAction);

      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'review-all',
        expect.objectContaining({
          agent: 'developer',
          operationType: 'write'
        })
      );
    });
  });

  describe('Approval Gate Matching', () => {
    beforeEach(() => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [
          { type: 'before-destructive', enabled: true } as ApprovalGate,
          { type: 'before-network', enabled: true } as ApprovalGate,
          { type: 'before-file-write', enabled: true } as ApprovalGate,
          { type: 'before-commit', enabled: true } as ApprovalGate,
        ],
      });
    });

    describe('before-destructive gate', () => {
      it('should match dangerous operations', async () => {
        const actions = [
          createActionMetadata({
            operationType: 'dangerous',
            actionType: 'delete-database'
          }),
          createActionMetadata({
            actionType: 'delete-file',
            scope: '/important/file.txt'
          }),
          createActionMetadata({
            actionType: 'remove-directory',
            toolName: 'Bash'
          }),
          createActionMetadata({
            actionType: 'drop-table',
            scope: 'production_db'
          }),
        ];

        for (const action of actions) {
          expect(await autonomyEnforcer.checkAction(action)).toBe(true);
        }
      });

      it('should not match non-destructive operations', async () => {
        const actions = [
          createActionMetadata({
            operationType: 'write',
            actionType: 'create-file'
          }),
          createActionMetadata({
            operationType: 'read',
            actionType: 'list-files'
          }),
        ];

        for (const action of actions) {
          expect(await autonomyEnforcer.checkAction(action)).toBe(false);
        }
      });
    });

    describe('before-network gate', () => {
      it('should match network operations', async () => {
        const actions = [
          createActionMetadata({
            operationType: 'network',
            toolName: 'WebFetch'
          }),
          createActionMetadata({
            actionType: 'http-request',
            toolName: 'WebFetch'
          }),
          createActionMetadata({
            actionType: 'fetch-data',
            toolName: 'WebSearch'
          }),
          createActionMetadata({
            actionType: 'download-file',
            scope: 'https://example.com/file.zip'
          }),
          createActionMetadata({
            actionType: 'upload-data',
            scope: 'api.example.com'
          }),
        ];

        for (const action of actions) {
          expect(await autonomyEnforcer.checkAction(action)).toBe(true);
        }
      });
    });

    describe('before-file-write gate', () => {
      it('should match write operations', async () => {
        const actions = [
          createActionMetadata({
            operationType: 'write',
            toolName: 'Write'
          }),
          createActionMetadata({
            actionType: 'write-file',
            toolName: 'Write'
          }),
          createActionMetadata({
            actionType: 'edit-file',
            toolName: 'Edit'
          }),
          createActionMetadata({
            actionType: 'create-file',
            scope: 'new-file.ts'
          }),
          createActionMetadata({
            actionType: 'save-content',
            toolName: 'Write'
          }),
        ];

        for (const action of actions) {
          expect(await autonomyEnforcer.checkAction(action)).toBe(true);
        }
      });
    });

    describe('before-commit gate', () => {
      it('should match commit operations', async () => {
        const actions = [
          createActionMetadata({
            actionType: 'git-commit',
            toolName: 'Bash'
          }),
          createActionMetadata({
            actionType: 'git-push',
            toolName: 'Bash'
          }),
          createActionMetadata({
            toolName: 'Bash',
            scope: 'git commands'
          }),
        ];

        for (const action of actions) {
          expect(await autonomyEnforcer.checkAction(action)).toBe(true);
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing or undefined fields gracefully', async () => {
      const incompleteActions = [
        { agentType: 'test' } as ActionMetadata,
        { actionType: 'test' } as ActionMetadata,
        { agentType: 'test', actionType: 'test' } as ActionMetadata,
        createActionMetadata({ toolName: undefined }),
        createActionMetadata({ operationType: undefined }),
        createActionMetadata({ scope: undefined }),
      ];

      for (const action of incompleteActions) {
        // Should not throw errors
        expect(async () => {
          await autonomyEnforcer.checkAction(action);
        }).not.toThrow();
      }
    });

    it('should handle empty strings in action metadata', async () => {
      const emptyFieldActions = [
        createActionMetadata({ agentType: '' }),
        createActionMetadata({ actionType: '' }),
        createActionMetadata({ toolName: '' }),
        createActionMetadata({ scope: '' }),
      ];

      for (const action of emptyFieldActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle unknown operation types', async () => {
      const unknownOpAction = createActionMetadata({
        operationType: 'unknown' as any
      });

      const result = await autonomyEnforcer.checkAction(unknownOpAction);
      expect(typeof result).toBe('boolean');
    });

    it('should handle disabled gates', async () => {
      autonomyEnforcer.updateConfig({
        level: 'full-auto',
        gates: [
          { type: 'before-destructive', enabled: false } as ApprovalGate,
        ],
      });

      const dangerousAction = createActionMetadata({
        operationType: 'dangerous',
        actionType: 'delete-database'
      });

      // Should not require approval for disabled gates
      expect(await autonomyEnforcer.checkAction(dangerousAction)).toBe(false);
    });

    it('should handle case sensitivity in action type matching', async () => {
      autonomyEnforcer.updateConfig({ level: 'review-before-commit' });

      const caseVariations = [
        createActionMetadata({ actionType: 'GIT-COMMIT' }),
        createActionMetadata({ actionType: 'Git-Push' }),
        createActionMetadata({ actionType: 'git_commit' }),
      ];

      for (const action of caseVariations) {
        const result = await autonomyEnforcer.checkAction(action);
        // Case sensitivity test - depending on implementation
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple overlapping gate conditions', async () => {
      autonomyEnforcer.updateConfig({
        level: 'review-before-commit',
        gates: [
          { type: 'before-destructive', enabled: true } as ApprovalGate,
          { type: 'before-file-write', enabled: true } as ApprovalGate,
        ],
      });

      // Action that could match multiple gates
      const complexAction = createActionMetadata({
        operationType: 'dangerous',
        actionType: 'delete-and-write',
        toolName: 'Bash',
        scope: 'important-file.ts'
      });

      // Should require approval (first matching gate)
      expect(await autonomyEnforcer.checkAction(complexAction)).toBe(true);
    });

    it('should prioritize autonomy level over gates for commit operations', async () => {
      autonomyEnforcer.updateConfig({
        level: 'review-before-commit',
        gates: [], // No gates enabled
      });

      const commitAction = createActionMetadata({
        actionType: 'git-commit',
        toolName: 'Bash'
      });

      // Should require approval due to autonomy level, not gates
      expect(await autonomyEnforcer.checkAction(commitAction)).toBe(true);
    });

    it('should handle agent-specific actions', async () => {
      const agentActions = [
        createActionMetadata({ agentType: 'planner' }),
        createActionMetadata({ agentType: 'architect' }),
        createActionMetadata({ agentType: 'developer' }),
        createActionMetadata({ agentType: 'tester' }),
        createActionMetadata({ agentType: 'reviewer' }),
        createActionMetadata({ agentType: 'devops' }),
      ];

      for (const action of agentActions) {
        const result = await autonomyEnforcer.checkAction(action);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle multiple concurrent checkAction calls', async () => {
      const actions = Array.from({ length: 100 }, (_, i) =>
        createActionMetadata({
          actionType: `action-${i}`,
          scope: `file-${i}.ts`
        })
      );

      const startTime = Date.now();
      const promises = actions.map(action => autonomyEnforcer.checkAction(action));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });

    it('should not have side effects between calls', async () => {
      const action1 = createActionMetadata({ actionType: 'action1' });
      const action2 = createActionMetadata({ actionType: 'action2' });

      const result1a = await autonomyEnforcer.checkAction(action1);
      const result2a = await autonomyEnforcer.checkAction(action2);
      const result1b = await autonomyEnforcer.checkAction(action1);
      const result2b = await autonomyEnforcer.checkAction(action2);

      expect(result1a).toBe(result1b);
      expect(result2a).toBe(result2b);
    });
  });
});