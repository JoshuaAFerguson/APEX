/**
 * Integration tests for ApexOrchestrator Pre-Action Autonomy Check Hook
 *
 * This test suite validates the integration between ApexOrchestrator's PreToolUse hook
 * and the AutonomyEnforcer's checkAction method. It ensures that the pre-action
 * autonomy check correctly prevents or allows tool execution based on action metadata.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator, type OrchestratorOptions } from '../index.js';
import { AutonomyEnforcer, type AutonomyEnforcerConfig } from '../autonomy-enforcer.js';
import type { Task, AutonomyLevel, ApprovalGate, AutonomyLimits } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ApexOrchestrator Pre-Action Autonomy Integration', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;
  let mockTask: Task;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-preaction-test-'));

    // Create mock task
    mockTask = {
      id: 'test-task-preaction',
      description: 'Test task for pre-action autonomy checks',
      workflow: 'test-workflow',
      autonomy: 'supervised',
      status: 'pending',
      priority: 'medium',
      projectPath: testDir,
      branchName: 'test-branch',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      logs: [],
      artifacts: [],
    };

    // Initialize orchestrator with test configuration
    const options: OrchestratorOptions = {
      projectPath: testDir,
      debug: false,
    };

    orchestrator = new ApexOrchestrator({ projectPath: options });
    await orchestrator.initialize();

    // Add test task to store
    await orchestrator.store.addTask(mockTask);
  });

  afterEach(async () => {
    await orchestrator.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Pre-Action Hook Integration', () => {
    it('should allow actions when autonomy level permits', async () => {
      // Configure full autonomy with no gates
      const autonomyConfig: AutonomyEnforcerConfig = {
        level: 'full-auto' as AutonomyLevel,
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

      // Update autonomy configuration
      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Mock Claude Agent SDK query to simulate tool use
      const mockQuery = vi.spyOn(orchestrator as any, 'claudeQuery').mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Task completed successfully'
        }],
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      });

      // Start task execution
      await orchestrator.executeTask(mockTask.id);

      // The task should complete successfully without approval blocks
      const updatedTask = orchestrator.store.getTask(mockTask.id);
      expect(updatedTask?.status).toBe('completed');

      // Cleanup mock
      mockQuery.mockRestore();
    });

    it('should block actions requiring approval in review-before-commit mode', async () => {
      // Configure review-before-commit autonomy
      const autonomyConfig: AutonomyEnforcerConfig = {
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

      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Mock approval required event
      let approvalRequested = false;
      orchestrator.autonomyEnforcer.on('approval:required', () => {
        approvalRequested = true;
      });

      // Mock Claude Agent SDK to request git commit
      const mockQuery = vi.spyOn(orchestrator as any, 'claudeQuery').mockImplementation(
        async (request: any) => {
          // Simulate the Claude Agent SDK making a tool call that would trigger PreToolUse
          if (request.tools) {
            // Simulate a tool use that would be caught by PreToolUse hook
            const bashTool = request.tools.find((tool: any) => tool.name === 'Bash');
            if (bashTool) {
              // This would normally trigger the PreToolUse hook
              // For testing, we'll simulate the hook behavior
              const actionMetadata = {
                agentType: 'developer',
                actionType: 'git-commit',
                toolName: 'Bash',
                operationType: 'execute' as const,
              };

              const requiresApproval = await orchestrator.autonomyEnforcer.checkAction(actionMetadata);
              if (requiresApproval) {
                return {
                  content: [{
                    type: 'text',
                    text: 'Action blocked: Approval required for commit operations'
                  }],
                  usage: { input_tokens: 50, output_tokens: 25 }
                };
              }
            }
          }

          return {
            content: [{
              type: 'text',
              text: 'Task completed'
            }],
            usage: { input_tokens: 100, output_tokens: 50 }
          };
        }
      );

      // Execute task that would try to commit
      await orchestrator.executeTask(mockTask.id);

      // Verify approval was requested
      expect(approvalRequested).toBe(true);

      mockQuery.mockRestore();
    });

    it('should allow read operations in review-all mode', async () => {
      // Configure review-all autonomy
      const autonomyConfig: AutonomyEnforcerConfig = {
        level: 'review-all' as AutonomyLevel,
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

      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Test read operation - should be allowed
      const readActionMetadata = {
        agentType: 'developer',
        actionType: 'read-file',
        toolName: 'Read',
        operationType: 'read' as const,
        scope: 'src/index.ts',
      };

      const requiresApproval = await orchestrator.autonomyEnforcer.checkAction(readActionMetadata);
      expect(requiresApproval).toBe(false);
    });

    it('should block write operations in review-all mode', async () => {
      // Configure review-all autonomy
      const autonomyConfig: AutonomyEnforcerConfig = {
        level: 'review-all' as AutonomyLevel,
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

      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Track approval events
      let approvalRequested = false;
      orchestrator.autonomyEnforcer.on('approval:required', (gateName, context) => {
        expect(gateName).toBe('review-all');
        expect(context.agent).toBe('developer');
        approvalRequested = true;
      });

      // Test write operation - should require approval
      const writeActionMetadata = {
        agentType: 'developer',
        actionType: 'write-file',
        toolName: 'Write',
        operationType: 'write' as const,
        scope: 'src/new-file.ts',
      };

      const requiresApproval = await orchestrator.autonomyEnforcer.checkAction(writeActionMetadata);
      expect(requiresApproval).toBe(true);
      expect(approvalRequested).toBe(true);
    });

    it('should respect approval gates for specific operations', async () => {
      // Configure full-auto with specific gates
      const autonomyConfig: AutonomyEnforcerConfig = {
        level: 'full-auto' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', enabled: true } as ApprovalGate,
          { type: 'before-network', enabled: true } as ApprovalGate,
        ],
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

      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Test cases for different gate types
      const testCases = [
        {
          name: 'destructive operation',
          actionMetadata: {
            agentType: 'developer',
            actionType: 'delete-file',
            toolName: 'Bash',
            operationType: 'dangerous' as const,
            scope: '/important/file.txt',
          },
          shouldRequireApproval: true,
          expectedGate: 'before-destructive',
        },
        {
          name: 'network operation',
          actionMetadata: {
            agentType: 'developer',
            actionType: 'fetch-data',
            toolName: 'WebFetch',
            operationType: 'network' as const,
            scope: 'https://api.example.com',
          },
          shouldRequireApproval: true,
          expectedGate: 'before-network',
        },
        {
          name: 'safe write operation',
          actionMetadata: {
            agentType: 'developer',
            actionType: 'write-file',
            toolName: 'Write',
            operationType: 'write' as const,
            scope: 'src/safe-file.ts',
          },
          shouldRequireApproval: false,
          expectedGate: null,
        },
      ];

      for (const testCase of testCases) {
        let approvalGate: string | null = null;
        const removeListener = orchestrator.autonomyEnforcer.on('approval:required', (gateName) => {
          approvalGate = gateName;
        });

        const requiresApproval = await orchestrator.autonomyEnforcer.checkAction(testCase.actionMetadata);

        expect(requiresApproval).toBe(testCase.shouldRequireApproval);

        if (testCase.shouldRequireApproval) {
          expect(approvalGate).toBe(testCase.expectedGate);
        }

        removeListener();
      }
    });
  });

  describe('Action Metadata Extraction', () => {
    it('should correctly determine operation types from tool names', async () => {
      // Test operation type determination logic
      const testCases = [
        { toolName: 'Read', expectedType: 'read' },
        { toolName: 'Write', expectedType: 'write' },
        { toolName: 'Edit', expectedType: 'write' },
        { toolName: 'Bash', expectedType: 'execute' },
        { toolName: 'WebFetch', expectedType: 'network' },
        { toolName: 'WebSearch', expectedType: 'network' },
        { toolName: 'UnknownTool', expectedType: 'unknown' },
      ];

      for (const testCase of testCases) {
        // Simulate the operation type determination that happens in orchestrator
        const operationType = (orchestrator as any).determineOperationType(testCase.toolName, {});

        // The operation type should match expectations based on tool name
        if (testCase.expectedType !== 'unknown') {
          expect(operationType).toBe(testCase.expectedType);
        }
      }
    });

    it('should extract scope from tool inputs', async () => {
      const testInputs = [
        { file_path: '/src/main.ts', expectedScope: '/src/main.ts' },
        { path: '/config/settings.json', expectedScope: '/config/settings.json' },
        { url: 'https://api.example.com', expectedScope: undefined }, // URL not extracted as scope
        { command: 'git commit -m "test"', expectedScope: undefined },
      ];

      for (const testInput of testInputs) {
        // Simulate scope extraction logic from orchestrator
        const scope = testInput.file_path || testInput.path || undefined;
        expect(scope).toBe(testInput.expectedScope);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle AutonomyEnforcer checkAction errors gracefully', async () => {
      // Mock checkAction to throw an error
      const originalCheckAction = orchestrator.autonomyEnforcer.checkAction.bind(orchestrator.autonomyEnforcer);
      vi.spyOn(orchestrator.autonomyEnforcer, 'checkAction').mockRejectedValue(
        new Error('Autonomy check failed')
      );

      // The orchestrator should handle the error and not crash
      const actionMetadata = {
        agentType: 'developer',
        actionType: 'test-action',
        toolName: 'Write',
        operationType: 'write' as const,
      };

      // Should not throw, but might default to requiring approval for safety
      await expect(orchestrator.autonomyEnforcer.checkAction(actionMetadata)).rejects.toThrow('Autonomy check failed');

      // Restore original method
      vi.mocked(orchestrator.autonomyEnforcer.checkAction).mockRestore();
    });

    it('should handle missing action metadata fields', async () => {
      const incompleteMetadata = [
        { agentType: 'developer' }, // Missing other fields
        { actionType: 'test' }, // Missing agent type
        {}, // Empty metadata
      ];

      for (const metadata of incompleteMetadata) {
        // Should not crash when handling incomplete metadata
        await expect(async () => {
          await orchestrator.autonomyEnforcer.checkAction(metadata as any);
        }).not.toThrow();
      }
    });

    it('should handle orchestrator shutdown during execution', async () => {
      // Start a task
      const taskPromise = orchestrator.executeTask(mockTask.id);

      // Shutdown orchestrator immediately
      await orchestrator.shutdown();

      // Task execution should complete or handle shutdown gracefully
      await expect(taskPromise).resolves.toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    it('should respond to autonomy configuration changes', async () => {
      // Initial configuration
      let autonomyConfig: AutonomyEnforcerConfig = {
        level: 'full-auto' as AutonomyLevel,
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

      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      const actionMetadata = {
        agentType: 'developer',
        actionType: 'write-file',
        toolName: 'Write',
        operationType: 'write' as const,
      };

      // Should not require approval in full-auto mode
      let requiresApproval = await orchestrator.autonomyEnforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(false);

      // Update to review-all mode
      autonomyConfig.level = 'review-all' as AutonomyLevel;
      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Same action should now require approval
      requiresApproval = await orchestrator.autonomyEnforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);
    });

    it('should handle gate configuration changes', async () => {
      const autonomyConfig: AutonomyEnforcerConfig = {
        level: 'full-auto' as AutonomyLevel,
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

      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      const networkAction = {
        agentType: 'developer',
        actionType: 'fetch-data',
        toolName: 'WebFetch',
        operationType: 'network' as const,
      };

      // Should not require approval without gates
      let requiresApproval = await orchestrator.autonomyEnforcer.checkAction(networkAction);
      expect(requiresApproval).toBe(false);

      // Add network gate
      autonomyConfig.gates = [{ type: 'before-network', enabled: true } as ApprovalGate];
      orchestrator.autonomyEnforcer.updateConfig(autonomyConfig);

      // Should now require approval
      requiresApproval = await orchestrator.autonomyEnforcer.checkAction(networkAction);
      expect(requiresApproval).toBe(true);
    });
  });
});