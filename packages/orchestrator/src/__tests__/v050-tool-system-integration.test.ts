/**
 * Integration Test Suite for v0.5.0 Tool System Features
 *
 * This test suite validates the integration of key v0.5.0 features:
 * - ToolActionStore for tracking tool executions and file modifications
 * - LinterPlugin system for code quality enforcement
 * - PolicyEnforcer for approval gates and autonomy control
 * - Tool permission management and approval workflows
 * - File snapshot and undo capabilities
 *
 * @module orchestrator/__tests__/v050-tool-system-integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { TaskStore, ToolActionStore } from '../store';
import { PolicyEnforcer } from '../policy/policy-enforcer';
import { BaseLinterPlugin, type LintResult, type LintIssue, type LinterPluginMetadata, type LinterExecuteOptions, type FixResult } from '../linter/plugin';
import type {
  Task,
  ToolAction,
  FileSnapshot,
  PolicyConfig,
  PolicyViolation,
  ApprovalRule,
} from '@apexcli/core';

// ============================================================================
// Test Fixtures and Mocks
// ============================================================================

/**
 * Mock ESLint-like linter plugin for testing
 */
class MockESLintPlugin extends BaseLinterPlugin {
  get metadata(): LinterPluginMetadata {
    return {
      id: 'eslint-test',
      name: 'ESLint Test',
      description: 'Mock ESLint plugin for testing',
      supportedExtensions: ['.js', '.ts', '.jsx', '.tsx'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0-test',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const issues: LintIssue[] = [];

    // Simulate finding issues in TypeScript files
    if (options.files?.some(f => f.endsWith('.ts'))) {
      issues.push({
        filePath: options.files.find(f => f.endsWith('.ts'))!,
        line: 1,
        column: 1,
        severity: 'error',
        ruleId: 'no-unused-vars',
        message: 'Unused variable detected',
        fix: {
          description: 'Remove unused variable',
          replacements: [{ startOffset: 0, endOffset: 10, text: '' }],
        },
      });
    }

    return {
      success: issues.length === 0,
      issues,
      filesChecked: options.files?.length || 0,
      filesWithIssues: issues.length > 0 ? 1 : 0,
      duration: 100,
    };
  }

  parse(output: string): LintIssue[] {
    // Simple parsing for test
    return [];
  }

  async fix(issues: LintIssue[]): Promise<FixResult> {
    return {
      success: true,
      filesFixed: issues.length > 0 ? 1 : 0,
      issuesFixed: issues.length,
      unfixedIssues: [],
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getToolVersion(): Promise<string | null> {
    return '8.0.0';
  }
}

/**
 * Creates a comprehensive test task
 */
function createTestTask(projectPath: string): Task {
  return {
    id: `v050-test-task-${Date.now()}`,
    description: 'v0.5.0 tool system integration test task',
    workflow: 'feature',
    autonomy: 'supervised',
    status: 'running',
    priority: 'normal',
    projectPath,
    branchName: 'feature/v050-tool-system',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1500,
      outputTokens: 800,
      totalTokens: 2300,
      estimatedCost: 0.12,
    },
    logs: [],
    artifacts: [],
  };
}

/**
 * Creates a policy configuration for testing
 */
function createTestPolicyConfig(): PolicyConfig {
  return {
    version: '1.0',
    enforcement: 'enforce',
    enabled: true,
    allowedPaths: {
      mode: 'allowlist',
      allow: ['src/**/*.{js,ts,jsx,tsx}', 'tests/**/*.test.{js,ts}'],
      block: ['node_modules/**', 'config/**', 'build/**'],
      sensitive: ['docs/**', 'scripts/**'],
    },
    approvalRules: [
      {
        id: 'file-operations',
        name: 'File Operations',
        description: 'Require approval for certain file operations',
        urgency: 'medium',
        condition: {
          type: 'file-pattern',
          pattern: 'src/**/*.{json,config}',
          operation: 'write',
        },
        enabled: true,
      },
      {
        id: 'cost-threshold',
        name: 'Cost Threshold',
        description: 'Require approval for high-cost operations',
        urgency: 'low',
        condition: {
          type: 'cost-threshold',
          threshold: 1.0,
        },
        enabled: true,
      },
    ],
  };
}

// ============================================================================
// Main Integration Test Suite
// ============================================================================

describe('v0.5.0 Tool System Integration', () => {
  let testDir: string;
  let taskStore: TaskStore;
  let toolActionStore: ToolActionStore;
  let policyEnforcer: PolicyEnforcer;
  let eslintPlugin: MockESLintPlugin;
  let testTask: Task;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-v050-integration-'));

    // Initialize stores
    taskStore = new TaskStore(testDir);
    await taskStore.initialize();

    toolActionStore = new ToolActionStore(taskStore, {
      maxActionsPerTask: 100,
      maxAgeDays: 7,
      keepUndoneSnapshots: true,
      maxSnapshotStorageMB: 10,
    });

    // Initialize policy enforcer
    const policyConfig = createTestPolicyConfig();
    policyEnforcer = new PolicyEnforcer(policyConfig);

    // Initialize linter plugin
    eslintPlugin = new MockESLintPlugin();

    // Create test task
    testTask = createTestTask(testDir);
    await taskStore.addTask(testTask);

    // Create test project structure
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'tests'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'docs'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Action Tracking with Policy Enforcement', () => {
    it('should track tool actions with policy validation', async () => {
      // Create a source file
      const sourceFile = path.join(testDir, 'src', 'index.ts');
      const originalContent = `export function hello() {
  const unused = 'variable';
  console.log('Hello, world!');
}`;

      await fs.writeFile(sourceFile, originalContent, 'utf8');

      // Validate file access with policy enforcer
      const violations = policyEnforcer.validateFilePath(sourceFile);
      expect(violations).toHaveLength(0); // Should be allowed

      // Create snapshots before modification
      const beforeSnapshot = await toolActionStore.createFileSnapshot(sourceFile, {
        operation: 'lint-fix',
        tool: 'eslint',
      });

      // Run linter
      const lintResult = await eslintPlugin.execute({
        files: [sourceFile],
        fix: true,
      });

      expect(lintResult.success).toBe(false); // Should find issues
      expect(lintResult.issues).toHaveLength(1);
      expect(lintResult.issues[0].ruleId).toBe('no-unused-vars');

      // Apply fixes (simulate content change)
      const fixedContent = originalContent.replace("const unused = 'variable';\n  ", '');
      await fs.writeFile(sourceFile, fixedContent, 'utf8');

      // Create after snapshot
      const afterSnapshot = await toolActionStore.createFileSnapshot(sourceFile, {
        operation: 'lint-fix',
        tool: 'eslint',
      });

      // Record tool action
      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'eslint',
        input: { files: [sourceFile], fix: true },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 150,
        result: { fixed: 1, issues: 0 },
        error: undefined,
        status: 'completed' as const,
      };

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        toolExecution,
        [sourceFile],
        [beforeSnapshot],
        [afterSnapshot],
        'lint-fix'
      );

      // Verify tool action tracking
      expect(action.execution.toolName).toBe('eslint');
      expect(action.modifiedFiles).toContain(sourceFile);
      expect(action.beforeSnapshots).toHaveLength(1);
      expect(action.afterSnapshots).toHaveLength(1);
      expect(action.canUndo).toBe(true);
      expect(action.actionGroup).toBe('lint-fix');

      // Verify content differences
      expect(action.beforeSnapshots[0].content).toContain('unused');
      expect(action.afterSnapshots[0].content).not.toContain('unused');
    });

    it('should enforce policy violations for sensitive files', async () => {
      // Try to access a sensitive file (marked as sensitive in policy)
      const docsFile = path.join(testDir, 'docs', 'README.md');
      const docsContent = '# Project Documentation\n\nThis is a test project.';

      await fs.writeFile(docsFile, docsContent, 'utf8');

      // Validate file access - should trigger policy violation
      const violations = policyEnforcer.validateFilePath(docsFile);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('file-access');
      expect(violations[0].severity).toBe('warning'); // Sensitive, not blocked
      expect(violations[0].resource).toBe(docsFile);
    });

    it('should block access to forbidden paths', async () => {
      // Try to access a blocked file
      const buildFile = path.join(testDir, 'build', 'output.js');
      await fs.mkdir(path.join(testDir, 'build'), { recursive: true });
      await fs.writeFile(buildFile, 'console.log("built file");', 'utf8');

      const violations = policyEnforcer.validateFilePath(buildFile);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('file-access');
      expect(violations[0].severity).toBe('error'); // Blocked
      expect(violations[0].resource).toBe(buildFile);
    });
  });

  describe('Approval Gate Integration', () => {
    it('should trigger approval requirements based on policy rules', async () => {
      const configFile = path.join(testDir, 'src', 'config.json');

      // Check if approval is required for config file modification
      const approvalCheck = policyEnforcer.checkApprovalRequired({
        filePaths: [configFile],
        operation: 'write',
        estimatedCost: 0.15,
      });

      expect(approvalCheck.required).toBe(true);
      expect(approvalCheck.triggeredRules).toHaveLength(1);
      expect(approvalCheck.triggeredRules[0].id).toBe('file-operations');
      expect(approvalCheck.urgency).toBe('medium');
    });

    it('should trigger cost-based approval requirements', async () => {
      const sourceFile = path.join(testDir, 'src', 'large-operation.ts');

      // Check if approval is required for high-cost operation
      const approvalCheck = policyEnforcer.checkApprovalRequired({
        filePaths: [sourceFile],
        operation: 'write',
        estimatedCost: 1.5, // Exceeds threshold
      });

      expect(approvalCheck.required).toBe(true);
      expect(approvalCheck.triggeredRules).toHaveLength(1);
      expect(approvalCheck.triggeredRules[0].id).toBe('cost-threshold');
      expect(approvalCheck.urgency).toBe('low');
    });

    it('should not require approval for normal operations', async () => {
      const sourceFile = path.join(testDir, 'src', 'normal.ts');

      const approvalCheck = policyEnforcer.checkApprovalRequired({
        filePaths: [sourceFile],
        operation: 'read',
        estimatedCost: 0.05,
      });

      expect(approvalCheck.required).toBe(false);
      expect(approvalCheck.triggeredRules).toHaveLength(0);
    });
  });

  describe('File Snapshot and Undo System', () => {
    it('should create and manage file snapshots for undo capabilities', async () => {
      const testFile = path.join(testDir, 'src', 'undo-test.ts');
      const originalContent = 'const original = "content";';
      const modifiedContent = 'const modified = "content";';

      await fs.writeFile(testFile, originalContent, 'utf8');

      // Create snapshot before modification
      const beforeSnapshot = await toolActionStore.createFileSnapshot(testFile);
      expect(beforeSnapshot.content).toBe(originalContent);
      expect(beforeSnapshot.checksum).toBe(
        crypto.createHash('sha256').update(originalContent).digest('hex')
      );

      // Modify file
      await fs.writeFile(testFile, modifiedContent, 'utf8');

      // Create snapshot after modification
      const afterSnapshot = await toolActionStore.createFileSnapshot(testFile);
      expect(afterSnapshot.content).toBe(modifiedContent);
      expect(afterSnapshot.checksum).not.toBe(beforeSnapshot.checksum);

      // Record the modification
      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Edit',
        input: { filePath: testFile, newContent: modifiedContent },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 50,
        result: { success: true },
        error: undefined,
        status: 'completed' as const,
      };

      const action = await toolActionStore.recordToolAction(
        testTask.id,
        toolExecution,
        [testFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Verify undo capability
      expect(action.canUndo).toBe(true);
      expect(action.beforeSnapshots[0].content).toBe(originalContent);
      expect(action.afterSnapshots[0].content).toBe(modifiedContent);
    });
  });

  describe('Linter Integration with Tool Tracking', () => {
    it('should integrate linting with tool action tracking', async () => {
      const sourceFiles = [
        path.join(testDir, 'src', 'component.ts'),
        path.join(testDir, 'src', 'utils.ts'),
      ];

      // Create source files with issues
      const componentContent = `export interface Props {
  name: string;
  unused?: string;
}

export function Component(props: Props) {
  return \`Hello \${props.name}\`;
}`;

      const utilsContent = `export function add(a: number, b: number): number {
  const result = a + b;
  const unused = 'variable';
  return result;
}`;

      await fs.writeFile(sourceFiles[0], componentContent, 'utf8');
      await fs.writeFile(sourceFiles[1], utilsContent, 'utf8');

      // Create snapshots before linting
      const beforeSnapshots = await Promise.all(
        sourceFiles.map(file => toolActionStore.createFileSnapshot(file, { stage: 'pre-lint' }))
      );

      // Run linter on multiple files
      const lintResult = await eslintPlugin.execute({
        files: sourceFiles,
        fix: true,
        cwd: testDir,
      });

      expect(lintResult.filesChecked).toBe(2);
      expect(lintResult.issues.length).toBeGreaterThan(0);

      // Apply fixes (simulated)
      const fixedComponentContent = componentContent.replace('unused?: string;', '');
      const fixedUtilsContent = utilsContent.replace("const unused = 'variable';\n  ", '');

      await fs.writeFile(sourceFiles[0], fixedComponentContent, 'utf8');
      await fs.writeFile(sourceFiles[1], fixedUtilsContent, 'utf8');

      // Create snapshots after fixes
      const afterSnapshots = await Promise.all(
        sourceFiles.map(file => toolActionStore.createFileSnapshot(file, { stage: 'post-lint' }))
      );

      // Record the linting action
      const lintExecution = {
        callId: crypto.randomUUID(),
        toolName: 'eslint-fix',
        input: { files: sourceFiles, fix: true },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: lintResult.duration,
        result: {
          success: lintResult.success,
          filesChecked: lintResult.filesChecked,
          issuesFixed: lintResult.issues.length,
        },
        error: undefined,
        status: 'completed' as const,
      };

      const lintAction = await toolActionStore.recordToolAction(
        testTask.id,
        lintExecution,
        sourceFiles,
        beforeSnapshots,
        afterSnapshots,
        'lint-and-fix'
      );

      // Verify comprehensive tracking
      expect(lintAction.modifiedFiles).toEqual(sourceFiles);
      expect(lintAction.beforeSnapshots).toHaveLength(2);
      expect(lintAction.afterSnapshots).toHaveLength(2);
      expect(lintAction.actionGroup).toBe('lint-and-fix');

      // Verify content was actually fixed
      beforeSnapshots.forEach(snapshot => {
        expect(snapshot.content).toContain('unused');
      });
      afterSnapshots.forEach(snapshot => {
        expect(snapshot.content).not.toContain('unused');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle policy enforcer errors gracefully', async () => {
      // Create a policy enforcer with invalid configuration
      const invalidConfig: PolicyConfig = {
        enforcement: 'enforce',
        allowedPaths: {
          mode: 'allowlist',
          allow: ['[invalid-glob-pattern'], // Invalid glob
        },
      };

      const badEnforcer = new PolicyEnforcer(invalidConfig);

      // Should not throw, but may log warnings or return violations
      expect(() => {
        badEnforcer.validateFilePath('/some/path.ts');
      }).not.toThrow();
    });

    it('should handle linter plugin failures', async () => {
      const sourceFile = path.join(testDir, 'src', 'broken.ts');
      await fs.writeFile(sourceFile, 'invalid typescript content ][', 'utf8');

      // Mock a failing linter
      class FailingLinterPlugin extends MockESLintPlugin {
        async execute(options: LinterExecuteOptions): Promise<LintResult> {
          return {
            success: false,
            issues: [],
            filesChecked: 0,
            filesWithIssues: 0,
            duration: 10,
            error: 'Linter process failed',
          };
        }
      }

      const failingLinter = new FailingLinterPlugin();
      const result = await failingLinter.execute({ files: [sourceFile] });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle tool action recording with missing files', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.ts');

      const toolExecution = {
        callId: crypto.randomUUID(),
        toolName: 'Read',
        input: { filePath: nonExistentFile },
        taskId: testTask.id,
        agentName: 'developer',
        stageName: 'implementation',
        startTime: new Date(),
        endTime: new Date(),
        duration: 5,
        result: { success: false },
        error: 'File not found',
        status: 'failed' as const,
      };

      // Should still record the action even if it failed
      const action = await toolActionStore.recordToolAction(
        testTask.id,
        toolExecution
      );

      expect(action.execution.status).toBe('failed');
      expect(action.execution.error).toBe('File not found');
      expect(action.canUndo).toBe(false); // Failed actions can't be undone
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple tool actions efficiently', async () => {
      const numActions = 50;
      const actions: ToolAction[] = [];

      const startTime = Date.now();

      // Record many tool actions
      for (let i = 0; i < numActions; i++) {
        const toolExecution = {
          callId: crypto.randomUUID(),
          toolName: 'TestTool',
          input: { iteration: i },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 10,
          result: { success: true, iteration: i },
          error: undefined,
          status: 'completed' as const,
        };

        const action = await toolActionStore.recordToolAction(testTask.id, toolExecution);
        actions.push(action);
      }

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(actions).toHaveLength(numActions);

      // Verify sequence numbers are assigned correctly
      actions.forEach((action, index) => {
        expect(action.sequenceNumber).toBe(index);
      });
    });
  });
});