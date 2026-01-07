/**
 * Comprehensive tests for git commit detection in autonomy enforcement
 *
 * Tests verify that the review-before-commit autonomy mode correctly
 * identifies various git commit operations and triggers approval gates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type ActionMetadata } from '../autonomy-enforcer.js';
import { AutonomyLevel, type AutonomyLimits } from '@apexcli/core';

// Mock orchestrator for testing
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
    addAuditLog: vi.fn().mockResolvedValue(undefined),
  },
});

describe('Git Commit Detection in Autonomy Enforcement', () => {
  let autonomyEnforcer: AutonomyEnforcer;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let baseConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    baseConfig = {
      level: 'review-before-commit' as AutonomyLevel,
      gates: [],
      limits: {
        maxTokensPerTask: 10000,
        maxCostPerTask: 5.00,
        maxTimePerTaskMs: 300000,
      } as AutonomyLimits,
      warningThresholds: {
        costWarningPercent: 80,
        tokenWarningPercent: 80,
        timeWarningPercent: 80,
        fileWarningPercent: 80,
      },
    };

    autonomyEnforcer = new AutonomyEnforcer(baseConfig, mockOrchestrator as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Git Command Detection', () => {
    it('should detect standard git commit commands', async () => {
      const gitCommands = [
        'git-commit',
        'git commit',
        'git-commit -m "message"',
        'git commit -am "message"',
        'git commit --amend'
      ];

      for (const command of gitCommands) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: command,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true);
      }
    });

    it('should detect git push commands', async () => {
      const pushCommands = [
        'git-push',
        'git push',
        'git push origin main',
        'git push origin feature-branch',
        'git push --force',
        'git push --force-with-lease'
      ];

      for (const command of pushCommands) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: command,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true);
      }
    });

    it('should detect deployment and publish commands', async () => {
      const deployCommands = [
        'deploy',
        'deploy-to-production',
        'deploy-staging',
        'publish',
        'publish-package',
        'npm publish',
        'yarn publish'
      ];

      for (const command of deployCommands) {
        const actionMetadata: ActionMetadata = {
          agentType: 'devops',
          actionType: command,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true);
      }
    });

    it('should NOT detect safe git commands', async () => {
      const safeCommands = [
        'git status',
        'git log',
        'git diff',
        'git show',
        'git branch',
        'git checkout',
        'git fetch',
        'git pull',
        'git stash',
        'git add',
        'git reset --soft',
        'git merge --no-commit'
      ];

      for (const command of safeCommands) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: command,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(false);
      }
    });
  });

  describe('Tool Name Detection', () => {
    it('should detect git commit operations in tool names', async () => {
      const toolNameTests = [
        {
          actionType: 'execute-command',
          toolName: 'git-commit',
          expected: true
        },
        {
          actionType: 'run-script',
          toolName: 'git-push',
          expected: true
        },
        {
          actionType: 'automated-deploy',
          toolName: 'deploy',
          expected: true
        },
        {
          actionType: 'package-release',
          toolName: 'publish',
          expected: true
        },
        {
          actionType: 'execute-command',
          toolName: 'Bash',
          expected: false
        },
        {
          actionType: 'edit-content',
          toolName: 'Edit',
          expected: false
        }
      ];

      for (const test of toolNameTests) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: test.actionType,
          toolName: test.toolName,
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(test.expected);
      }
    });

    it('should handle Bash tool with commit-related commands', async () => {
      const bashCommitTests = [
        {
          actionType: 'git commit -m "test"',
          toolName: 'Bash',
          expected: true
        },
        {
          actionType: 'git push origin main',
          toolName: 'Bash',
          expected: true
        },
        {
          actionType: 'npm run deploy',
          toolName: 'Bash',
          expected: true
        },
        {
          actionType: 'yarn build && npm publish',
          toolName: 'Bash',
          expected: true
        },
        {
          actionType: 'ls -la',
          toolName: 'Bash',
          expected: false
        },
        {
          actionType: 'npm test',
          toolName: 'Bash',
          expected: false
        }
      ];

      for (const test of bashCommitTests) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: test.actionType,
          toolName: test.toolName,
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(test.expected);
      }
    });
  });

  describe('Complex Command Patterns', () => {
    it('should detect git commit in complex command chains', async () => {
      const complexCommands = [
        'npm test && git add . && git commit -m "Add tests"',
        'git add .; git commit -m "Fix bug"; git push',
        'build_project && git commit -a -m "Build artifacts"',
        'run_linter && fix_issues && git commit',
        'echo "Starting deployment" && deploy_to_server',
        'build && test && publish_package'
      ];

      for (const command of complexCommands) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: command,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true);
      }
    });

    it('should handle scripted git operations', async () => {
      const scriptedOperations = [
        'run_commit_script',
        'execute_deploy_pipeline',
        'auto_publish_release',
        'commit_and_push',
        'deploy_to_staging',
        'release_package'
      ];

      for (const operation of scriptedOperations) {
        const actionMetadata: ActionMetadata = {
          agentType: 'devops',
          actionType: operation,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true);
      }
    });
  });

  describe('Edge Cases and False Positives', () => {
    it('should NOT trigger on non-commit git operations', async () => {
      const nonCommitOperations = [
        'git_log_analysis',
        'git_status_check',
        'git_branch_listing',
        'commit_message_validation', // Contains "commit" but not actual commit
        'deploy_readiness_check', // Contains "deploy" but not actual deploy
        'publish_documentation', // Contains "publish" but not package publish
        'read_commit_history'
      ];

      for (const operation of nonCommitOperations) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: operation,
          toolName: 'Bash',
          operationType: 'read' // Important: read operations should not trigger
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(false);
      }
    });

    it('should handle case variations correctly', async () => {
      const caseVariations = [
        'Git-Commit',
        'GIT-COMMIT',
        'git-COMMIT',
        'Git-Push',
        'GIT-PUSH',
        'Deploy',
        'DEPLOY',
        'Publish',
        'PUBLISH'
      ];

      for (const variation of caseVariations) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: variation,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true);
      }
    });

    it('should handle partial matches correctly', async () => {
      const partialMatches = [
        {
          actionType: 'recommit_changes', // Contains "commit"
          expected: true
        },
        {
          actionType: 'decompress_files', // Contains "deploy" substring
          expected: true
        },
        {
          actionType: 'republican_vote', // Contains "publish" substring
          expected: true
        },
        {
          actionType: 'commit_to_memory', // Contains "commit" but different context
          expected: true
        },
        {
          actionType: 'file_operations', // No trigger words
          expected: false
        }
      ];

      for (const test of partialMatches) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: test.actionType,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(test.expected);
      }
    });
  });

  describe('Event Emission for Git Commit Detection', () => {
    it('should emit approval:required events with correct context for git operations', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const gitOperations = [
        {
          actionType: 'git-commit',
          expectedGate: 'before-commit'
        },
        {
          actionType: 'git-push',
          expectedGate: 'before-commit'
        },
        {
          actionType: 'deploy-production',
          expectedGate: 'before-commit'
        },
        {
          actionType: 'publish-release',
          expectedGate: 'before-commit'
        }
      ];

      for (const operation of gitOperations) {
        emitSpy.mockClear();

        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: operation.actionType,
          toolName: 'Bash',
          operationType: 'execute'
        };

        await autonomyEnforcer.checkAction(actionMetadata);

        expect(emitSpy).toHaveBeenCalledWith(
          'approval:required',
          operation.expectedGate,
          expect.objectContaining({
            agent: 'developer',
            operationType: 'execute',
            currentStage: 'execution'
          })
        );
      }
    });

    it('should include complete context information in events', async () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      const actionMetadata: ActionMetadata = {
        agentType: 'senior-developer',
        actionType: 'git commit -m "Critical security fix"',
        toolName: 'Bash',
        operationType: 'execute',
        scope: 'security-patch'
      };

      await autonomyEnforcer.checkAction(actionMetadata);

      expect(emitSpy).toHaveBeenCalledWith(
        'approval:required',
        'before-commit',
        expect.objectContaining({
          task: expect.objectContaining({ id: 'current-task' }),
          currentStage: 'execution',
          agent: 'senior-developer',
          operationType: 'execute'
        })
      );
    });
  });

  describe('Integration with Different Autonomy Levels', () => {
    it('should NOT require approval for git operations in full-auto mode', async () => {
      autonomyEnforcer.updateConfig({ level: 'full-auto' as AutonomyLevel });

      const gitOperations = [
        'git-commit',
        'git-push',
        'deploy',
        'publish'
      ];

      for (const operation of gitOperations) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: operation,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(false);
      }
    });

    it('should require approval for git operations in review-all mode', async () => {
      autonomyEnforcer.updateConfig({ level: 'review-all' as AutonomyLevel });

      const gitOperations = [
        'git-commit',
        'git-push',
        'deploy',
        'publish'
      ];

      for (const operation of gitOperations) {
        const actionMetadata: ActionMetadata = {
          agentType: 'developer',
          actionType: operation,
          toolName: 'Bash',
          operationType: 'execute'
        };

        const requiresApproval = await autonomyEnforcer.checkAction(actionMetadata);
        expect(requiresApproval).toBe(true); // All operations require approval in review-all
      }
    });

    it('should respect specific gates even when git commit detection is active', async () => {
      autonomyEnforcer.updateConfig({
        level: 'review-before-commit' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', description: 'Review destructive ops', enabled: true }
        ]
      });

      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      // Test git commit (should trigger review-before-commit)
      const commitAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        toolName: 'Bash',
        operationType: 'execute'
      };

      await autonomyEnforcer.checkAction(commitAction);
      expect(emitSpy).toHaveBeenCalledWith('approval:required', 'before-commit', expect.anything());

      emitSpy.mockClear();

      // Test destructive operation (should trigger before-destructive gate)
      const destructiveAction: ActionMetadata = {
        agentType: 'developer',
        actionType: 'delete-database',
        operationType: 'dangerous'
      };

      await autonomyEnforcer.checkAction(destructiveAction);
      expect(emitSpy).toHaveBeenCalledWith('approval:required', 'before-destructive', expect.anything());
    });
  });
});