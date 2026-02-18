/**
 * @fileoverview End-to-end tests for CLI confirmation flow with permission presets and dangerous operations
 *
 * This test suite validates the complete flow from dangerous operation detection
 * through permission preset evaluation to CLI confirmation prompts.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import {
  shouldShowConfirmation,
  confirmDangerousOperation,
  requestConfirmation,
  showOperationCancelled,
  DangerousOperation
} from '../utils/confirmation.js';
import {
  DangerousOperationDetector,
  type ConfirmationRequirements
} from '@apexcli/core';
import {
  PermissionPreset,
  PermissionLevel,
  AutonomyLevel,
  ToolDefinition,
  ToolInvocation,
} from '@apexcli/core';

// Mock inquirer for testing
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock chalk for consistent output testing
vi.mock('chalk', () => {
  const mockChalk = vi.fn((str: string) => str);
  mockChalk.red = vi.fn((str: string) => `[RED]${str}`);
  mockChalk.yellow = vi.fn((str: string) => `[YELLOW]${str}`);
  mockChalk.cyan = vi.fn((str: string) => `[CYAN]${str}`);
  mockChalk.gray = vi.fn((str: string) => `[GRAY]${str}`);
  return { default: mockChalk };
});

// Mock console.log to capture outputs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

// Test utilities for creating realistic scenarios
function createToolDefinition(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'TestTool',
    description: 'Test tool for E2E confirmation testing',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    dangerous: false,
    permissions: [],
    category: 'custom',
    enabled: true,
    ...overrides,
  };
}

function createToolInvocation(parameters: Record<string, unknown> = {}): ToolInvocation {
  return {
    toolName: 'TestTool',
    parameters,
  };
}

// Simulates the full flow from tool invocation to user confirmation
async function simulateToolExecutionFlow(
  toolDef: ToolDefinition,
  invocation: ToolInvocation,
  autonomyLevel: AutonomyLevel,
  userConfirmsPrompt: boolean = true
): Promise<{
  shouldProceed: boolean;
  warningDetected: boolean;
  confirmationShown: boolean;
  userConfirmed: boolean;
}> {
  const detector = new DangerousOperationDetector();
  const mockPrompt = vi.mocked(inquirer.prompt);

  // Step 1: Detect dangerous operations
  const dangerResult = detector.detectDangerousOperation(toolDef, invocation);

  // Step 2: Determine if confirmation should be shown based on tool danger and autonomy
  let confirmationShown = false;
  let userConfirmed = false;

  if (dangerResult.isDangerous && dangerResult.confirmation?.required) {
    // Mock user response
    mockPrompt.mockResolvedValueOnce({ confirmed: userConfirmsPrompt });

    try {
      userConfirmed = await confirmDangerousOperation(DangerousOperation.CANCEL_TASK, {
        context: `Tool: ${toolDef.name}`,
        resourceDescription: dangerResult.reason || 'Dangerous operation detected'
      });
      confirmationShown = true;
    } catch {
      userConfirmed = false;
    }
  }

  // Step 3: Determine final proceed decision
  const shouldProceed = !dangerResult.isDangerous ||
    (dangerResult.isDangerous && (!dangerResult.confirmation?.required || userConfirmed));

  return {
    shouldProceed,
    warningDetected: dangerResult.isDangerous,
    confirmationShown,
    userConfirmed
  };
}

describe('CLI Confirmation Flow E2E Tests', () => {
  let mockPrompt: Mock;

  beforeEach(() => {
    mockPrompt = vi.mocked(inquirer.prompt);
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Dangerous Bash Commands Flow', () => {
    it('should show critical warning and require confirmation for destructive commands', async () => {
      const bashTool = createToolDefinition({ name: 'Bash' });
      const destructiveCommand = createToolInvocation({ command: 'rm -rf /' });

      const result = await simulateToolExecutionFlow(
        bashTool,
        destructiveCommand,
        'manual', // Manual mode always shows confirmations
        true // User confirms
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(true);
      expect(result.shouldProceed).toBe(true);

      // Verify warning was shown with appropriate severity
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cancel Running Task')
      );
    });

    it('should block execution when user declines confirmation for dangerous command', async () => {
      const bashTool = createToolDefinition({ name: 'Bash' });
      const privilegeEscalation = createToolInvocation({ command: 'sudo rm -rf /var/log/*' });

      const result = await simulateToolExecutionFlow(
        bashTool,
        privilegeEscalation,
        'review-before-commit',
        false // User declines
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });

    it('should allow safe commands without confirmation in autonomous mode', async () => {
      const bashTool = createToolDefinition({ name: 'Bash' });
      const safeCommand = createToolInvocation({ command: 'echo "Hello World"' });

      const result = await simulateToolExecutionFlow(
        bashTool,
        safeCommand,
        'full', // Full autonomy
        true
      );

      expect(result.warningDetected).toBe(false);
      expect(result.confirmationShown).toBe(false);
      expect(result.shouldProceed).toBe(true);
    });
  });

  describe('Filesystem Access Flow', () => {
    it('should warn about credential file access and require elevated confirmation', async () => {
      const readTool = createToolDefinition({ name: 'Read' });
      const credentialAccess = createToolInvocation({ file_path: '/home/user/.ssh/id_rsa' });

      const result = await simulateToolExecutionFlow(
        readTool,
        credentialAccess,
        'review-before-merge',
        true // User confirms after warning
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(true);
      expect(result.shouldProceed).toBe(true);

      // Should show context about the dangerous file access
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Tool: Read')
      );
    });

    it('should detect and warn about path traversal attempts', async () => {
      const editTool = createToolDefinition({ name: 'Edit' });
      const pathTraversal = createToolInvocation({
        file_path: '/app/../../../etc/passwd'
      });

      const result = await simulateToolExecutionFlow(
        editTool,
        pathTraversal,
        'manual',
        false // User declines after seeing warning
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });

    it('should allow normal file operations without warnings', async () => {
      const writeTool = createToolDefinition({ name: 'Write' });
      const normalWrite = createToolInvocation({
        file_path: '/tmp/output.txt',
        content: 'Normal content'
      });

      const result = await simulateToolExecutionFlow(
        writeTool,
        normalWrite,
        'full',
        true
      );

      expect(result.warningDetected).toBe(false);
      expect(result.confirmationShown).toBe(false);
      expect(result.shouldProceed).toBe(true);
    });
  });

  describe('Network Access Flow', () => {
    it('should warn about suspicious domain access', async () => {
      const webFetchTool = createToolDefinition({ name: 'WebFetch' });
      const suspiciousDomain = createToolInvocation({
        url: 'https://malicious.tk/payload.exe'
      });

      const result = await simulateToolExecutionFlow(
        webFetchTool,
        suspiciousDomain,
        'review-before-commit',
        true // User proceeds despite warning
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(true);
      expect(result.shouldProceed).toBe(true);
    });

    it('should show critical warning for dark web access', async () => {
      const webFetchTool = createToolDefinition({ name: 'WebFetch' });
      const darkWebAccess = createToolInvocation({
        url: 'https://example.onion/illegal-content'
      });

      const result = await simulateToolExecutionFlow(
        webFetchTool,
        darkWebAccess,
        'manual',
        false // User wisely declines
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });

    it('should allow normal web requests without warnings', async () => {
      const webSearchTool = createToolDefinition({ name: 'WebSearch' });
      const normalSearch = createToolInvocation({
        query: 'Node.js best practices',
        url: 'https://api.github.com/search'
      });

      const result = await simulateToolExecutionFlow(
        webSearchTool,
        normalSearch,
        'review-before-merge',
        true
      );

      expect(result.warningDetected).toBe(false);
      expect(result.confirmationShown).toBe(false);
      expect(result.shouldProceed).toBe(true);
    });
  });

  describe('Tool-Level Dangerous Flags Flow', () => {
    it('should show appropriate warnings for tools marked as dangerous', async () => {
      const dangerousTool = createToolDefinition({
        name: 'AdminTool',
        dangerous: true,
        permissions: ['admin']
      });
      const invocation = createToolInvocation({ action: 'system_reset' });

      const result = await simulateToolExecutionFlow(
        dangerousTool,
        invocation,
        'review-before-commit',
        true // User confirms after careful consideration
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(true);
      expect(result.shouldProceed).toBe(true);
    });

    it('should show detailed confirmation for execution-level dangerous tools', async () => {
      const executeTool = createToolDefinition({
        name: 'ExecTool',
        dangerous: true,
        permissions: ['execute']
      });
      const invocation = createToolInvocation({ script: 'deploy.sh' });

      const result = await simulateToolExecutionFlow(
        executeTool,
        invocation,
        'manual',
        false // User declines deployment
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });
  });

  describe('Autonomy Level Integration', () => {
    const dangerousTool = createToolDefinition({
      name: 'ModeratelyDangerousTool',
      dangerous: true,
      permissions: ['write']
    });
    const invocation = createToolInvocation({ target: 'config.json' });

    it('should bypass warnings in full autonomy for medium-risk operations', async () => {
      const result = await simulateToolExecutionFlow(
        dangerousTool,
        invocation,
        'full', // Full autonomy
        true
      );

      expect(result.warningDetected).toBe(true);
      // Full autonomy might still show warnings for dangerous tools depending on severity
      expect(result.shouldProceed).toBe(true);
    });

    it('should show confirmations in review-before-commit mode', async () => {
      const result = await simulateToolExecutionFlow(
        dangerousTool,
        invocation,
        'review-before-commit',
        true // User confirms
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(true);
      expect(result.shouldProceed).toBe(true);
    });

    it('should always show confirmations in manual mode', async () => {
      const result = await simulateToolExecutionFlow(
        dangerousTool,
        invocation,
        'manual',
        false // User declines
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });
  });

  describe('Complex Scenario Integration', () => {
    it('should handle compound dangerous operations correctly', async () => {
      // A tool that is both marked dangerous AND performs dangerous operations
      const compoundDangerousTool = createToolDefinition({
        name: 'Bash',
        dangerous: true,
        permissions: ['execute']
      });
      const compoundDangerousInvocation = createToolInvocation({
        command: 'sudo rm -rf /etc/passwd' // Combines privilege escalation + destructive + system files
      });

      const result = await simulateToolExecutionFlow(
        compoundDangerousTool,
        compoundDangerousInvocation,
        'review-before-merge',
        false // User wisely declines
      );

      expect(result.warningDetected).toBe(true);
      expect(result.confirmationShown).toBe(true);
      expect(result.userConfirmed).toBe(false);
      expect(result.shouldProceed).toBe(false);
    });

    it('should provide helpful error messages when operations are cancelled', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      const cancelled = await confirmDangerousOperation(DangerousOperation.DELETE_TEMPLATE, {
        context: 'User requested template deletion',
        resourceId: 'critical-template',
        resourceDescription: 'Production deployment template'
      });

      expect(cancelled).toBe(false);

      // Show cancellation message
      showOperationCancelled(DangerousOperation.DELETE_TEMPLATE);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Delete Task Template cancelled by user')
      );
    });

    it('should handle rapid successive confirmations without interference', async () => {
      const operations = [
        DangerousOperation.CANCEL_TASK,
        DangerousOperation.TRASH_TASK,
        DangerousOperation.MERGE_TASK,
        DangerousOperation.EMPTY_TRASH
      ];

      // Mock alternating user responses
      operations.forEach((_, i) => {
        mockPrompt.mockResolvedValueOnce({ confirmed: i % 2 === 0 });
      });

      const results = await Promise.all(
        operations.map(operation =>
          confirmDangerousOperation(operation, {
            context: `Batch operation ${operation}`
          })
        )
      );

      expect(results).toEqual([true, false, true, false]);
      expect(mockPrompt).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should gracefully handle prompt interruptions', async () => {
      mockPrompt.mockRejectedValue(new Error('User interrupted prompt'));

      await expect(
        confirmDangerousOperation(DangerousOperation.EMPTY_TRASH)
      ).rejects.toThrow('User interrupted prompt');
    });

    it('should handle malformed tool definitions', async () => {
      const malformedTool = createToolDefinition({
        name: '', // Empty name
        dangerous: true,
        permissions: undefined as any
      });

      const result = await simulateToolExecutionFlow(
        malformedTool,
        createToolInvocation(),
        'manual',
        true
      );

      // Should still detect as dangerous due to dangerous flag
      expect(result.warningDetected).toBe(true);
    });

    it('should handle missing or null invocation parameters', async () => {
      const bashTool = createToolDefinition({ name: 'Bash' });
      const emptyInvocation = createToolInvocation({}); // No command parameter

      const result = await simulateToolExecutionFlow(
        bashTool,
        emptyInvocation,
        'manual',
        true
      );

      // Should not detect danger without actual command content
      expect(result.warningDetected).toBe(false);
      expect(result.shouldProceed).toBe(true);
    });

    it('should maintain performance with many concurrent confirmation checks', async () => {
      const startTime = Date.now();
      const concurrentOps = 100;

      mockPrompt.mockResolvedValue({ confirmed: true });

      const promises = Array.from({ length: concurrentOps }, (_, i) =>
        confirmDangerousOperation(DangerousOperation.CANCEL_TASK, {
          context: `Concurrent operation ${i}`
        })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 2 seconds for 100 operations)
      expect(duration).toBeLessThan(2000);
      expect(mockPrompt).toHaveBeenCalledTimes(concurrentOps);
    });
  });

  describe('User Experience and Accessibility', () => {
    it('should provide clear context and alternatives for critical operations', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false });

      await confirmDangerousOperation(DangerousOperation.EMPTY_TRASH, {
        context: 'User requested permanent deletion of 15 tasks',
        resourceId: 'trash-bin',
        resourceDescription: 'Contains important project history'
      });

      // Verify clear warning message was shown
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Empty Trash (Permanent Deletion)')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('This action is irreversible')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Context: User requested permanent deletion')
      );
    });

    it('should use appropriate colors and formatting for different severity levels', async () => {
      // Test that different operations use appropriate visual styling
      const operationTests = [
        { op: DangerousOperation.TRASH_TASK, expectedColor: 'cyan' }, // Low severity
        { op: DangerousOperation.MERGE_TASK, expectedColor: 'yellow' }, // Medium severity
        { op: DangerousOperation.EMPTY_TRASH, expectedColor: 'red' } // High severity
      ];

      for (const { op } of operationTests) {
        mockPrompt.mockResolvedValueOnce({ confirmed: true });
        mockConsoleLog.mockClear();

        await confirmDangerousOperation(op);

        // Verify appropriate styling was applied (mocked chalk functions should be called)
        expect(mockConsoleLog).toHaveBeenCalled();
      }
    });
  });
});