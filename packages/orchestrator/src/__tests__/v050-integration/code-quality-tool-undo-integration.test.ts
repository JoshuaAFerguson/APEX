/**
 * Integration tests for Code Quality with Tool Actions and Undo
 *
 * Tests verify:
 * 1. Lint-after-edit creates proper snapshots for undo
 * 2. Auto-fix changes are tracked in ToolActionStore
 * 3. Undo reverts lint fixes correctly
 * 4. Type checking integration with edit tools
 * 5. TDD mode manages test/impl file pairs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  createTestEnvironment,
  createTestTask,
  createTestFiles,
  expectToolActionUndoable,
  expectToolActionNotUndoable,
} from './test-utils';
import { BaseLinterPlugin, type LintResult, type LintIssue, type FixResult } from '../../linter/plugin';
import { TDDExecutor } from '../../tdd-executor';

import type {
  Task,
  ToolAction,
  FileSnapshot,
} from '@apexcli/core';

/**
 * Mock TypeScript-like linter plugin for testing
 */
class MockTypeScriptLinter extends BaseLinterPlugin {
  get metadata() {
    return {
      id: 'typescript-mock',
      name: 'TypeScript Mock Linter',
      description: 'Mock TypeScript linter for testing',
      supportedExtensions: ['.ts', '.tsx'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0-test',
    };
  }

  async execute(options: any): Promise<LintResult> {
    const issues: LintIssue[] = [];

    // Simulate finding common TypeScript issues
    if (options.files?.some((f: string) => f.endsWith('.ts'))) {
      const tsFile = options.files.find((f: string) => f.endsWith('.ts'));
      const content = await fs.readFile(tsFile, 'utf8');

      // Detect unused variables
      if (content.includes('const unused')) {
        issues.push({
          filePath: tsFile,
          line: content.split('\n').findIndex(line => line.includes('const unused')) + 1,
          column: 1,
          severity: 'error',
          ruleId: 'no-unused-vars',
          message: 'Variable is declared but never used',
          fix: {
            description: 'Remove unused variable',
            replacements: [{
              startOffset: content.indexOf('const unused'),
              endOffset: content.indexOf('\n', content.indexOf('const unused')) + 1,
              text: '',
            }],
          },
        });
      }

      // Detect missing type annotations
      if (content.includes('function ') && !content.includes(': string') && !content.includes(': number')) {
        issues.push({
          filePath: tsFile,
          line: content.split('\n').findIndex(line => line.includes('function ')) + 1,
          column: 1,
          severity: 'warning',
          ruleId: 'explicit-function-return-type',
          message: 'Missing return type annotation',
          fix: {
            description: 'Add return type annotation',
            replacements: [{
              startOffset: content.indexOf(') {'),
              endOffset: content.indexOf(') {'),
              text: ': string',
            }],
          },
        });
      }
    }

    return {
      success: issues.length === 0,
      issues,
      filesChecked: options.files?.length || 0,
      filesWithIssues: issues.length > 0 ? 1 : 0,
      duration: 150,
    };
  }

  parse(output: string): LintIssue[] {
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
    return '5.0.0';
  }
}

describe('Code Quality + Tool Actions + Undo Integration', () => {
  let testEnv: Awaited<ReturnType<typeof createTestEnvironment>>;
  let testTask: Task;
  let testFiles: Awaited<ReturnType<typeof createTestFiles>>;
  let tsLinter: MockTypeScriptLinter;
  let tddExecutor: TDDExecutor;

  beforeEach(async () => {
    testEnv = await createTestEnvironment();
    testTask = createTestTask(testEnv.testDir);
    await testEnv.taskStore.addTask(testTask);

    testFiles = await createTestFiles(testEnv.testDir);

    // Initialize linter and TDD executor
    tsLinter = new MockTypeScriptLinter();
    tddExecutor = new TDDExecutor({
      toolActionStore: testEnv.toolActionStore,
      linterPlugin: tsLinter,
      testRunner: 'vitest',
      watchMode: false,
    });

    // Grant all permissions
    await testEnv.permissionManager.grantPermission('file', 'allow-always');
    await testEnv.permissionManager.grantPermission('edit', 'allow-always');
    await testEnv.permissionManager.grantPermission('lint', 'allow-always');
  });

  afterEach(async () => {
    await testEnv.cleanup();
    vi.restoreAllMocks();
  });

  describe('Lint-Fix-Undo Cycle', () => {
    it('should create before/after snapshots during lint fix', async () => {
      // Create file with lint issues
      const sourceContent = `
export function greet(name) {
  const unused = 'variable';
  return \`Hello, \${name}!\`;
}`.trim();

      await fs.writeFile(testFiles.sourceFile, sourceContent, 'utf8');

      // Create before snapshot
      const beforeSnapshot = await testEnv.toolActionStore.createFileSnapshot(
        testFiles.sourceFile,
        { operation: 'lint-fix', stage: 'pre-lint' }
      );

      // Run linter to detect issues
      const lintResult = await tsLinter.execute({
        files: [testFiles.sourceFile],
        fix: false,
      });

      expect(lintResult.issues.length).toBeGreaterThan(0);
      expect(lintResult.issues.some(issue => issue.ruleId === 'no-unused-vars')).toBe(true);

      // Apply fixes
      const fixedContent = sourceContent
        .replace(/const unused = 'variable';\n  /g, '')
        .replace('function greet(name)', 'function greet(name): string');

      await fs.writeFile(testFiles.sourceFile, fixedContent, 'utf8');

      // Create after snapshot
      const afterSnapshot = await testEnv.toolActionStore.createFileSnapshot(
        testFiles.sourceFile,
        { operation: 'lint-fix', stage: 'post-lint' }
      );

      // Record the lint-fix action
      const lintAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'lint-fix-1',
          toolName: 'typescript-lint-fix',
          input: { files: [testFiles.sourceFile], autoFix: true },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: lintResult.duration,
          result: {
            success: true,
            issuesFixed: lintResult.issues.length,
            filesModified: 1,
          },
          status: 'completed' as const,
        },
        [testFiles.sourceFile],
        [beforeSnapshot],
        [afterSnapshot],
        'lint-fix'
      );

      // Verify snapshots
      expect(lintAction.beforeSnapshots).toHaveLength(1);
      expect(lintAction.afterSnapshots).toHaveLength(1);
      expect(lintAction.beforeSnapshots[0].content).toContain('const unused');
      expect(lintAction.afterSnapshots[0].content).not.toContain('const unused');
      expect(lintAction.afterSnapshots[0].content).toContain(': string');

      expectToolActionUndoable(lintAction);
    });

    it('should mark lint fix actions as undoable', async () => {
      const sourceContent = `
function calculate(x, y) {
  const unused = 'temp';
  return x + y;
}`.trim();

      await fs.writeFile(testFiles.sourceFile, sourceContent, 'utf8');

      // Perform lint-fix with snapshots
      const beforeSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);

      const fixedContent = sourceContent
        .replace(/const unused = 'temp';\n  /g, '')
        .replace('function calculate(x, y)', 'function calculate(x, y): number');

      await fs.writeFile(testFiles.sourceFile, fixedContent, 'utf8');

      const afterSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);

      const action = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'lint-action',
          toolName: 'typescript-lint',
          input: { autoFix: true },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { fixed: true },
          status: 'completed' as const,
        },
        [testFiles.sourceFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      expectToolActionUndoable(action);
      expect(action.actionType).toBe('modification');
      expect(action.modifiedFiles).toContain(testFiles.sourceFile);
    });

    it('should restore original content on undo', async () => {
      const originalContent = `
function broken(input) {
  const unused = 'debug';
  return input.toUpperCase();
}`.trim();

      await fs.writeFile(testFiles.sourceFile, originalContent, 'utf8');

      // Create lint-fix action with snapshots
      const beforeSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);

      const fixedContent = originalContent
        .replace(/const unused = 'debug';\n  /g, '')
        .replace('function broken(input)', 'function broken(input): string');

      await fs.writeFile(testFiles.sourceFile, fixedContent, 'utf8');

      const afterSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);

      const lintAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'lint-fix-undo-test',
          toolName: 'typescript-lint',
          input: { file: testFiles.sourceFile },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 120,
          result: { success: true },
          status: 'completed' as const,
        },
        [testFiles.sourceFile],
        [beforeSnapshot],
        [afterSnapshot]
      );

      // Verify current content is fixed
      const currentContent = await fs.readFile(testFiles.sourceFile, 'utf8');
      expect(currentContent).not.toContain('const unused');
      expect(currentContent).toContain(': string');

      // Perform undo
      const undoResult = await testEnv.toolActionStore.undoAction(lintAction.id);
      expect(undoResult.success).toBe(true);

      // Verify content is restored
      const restoredContent = await fs.readFile(testFiles.sourceFile, 'utf8');
      expect(restoredContent).toBe(originalContent);
      expect(restoredContent).toContain('const unused = \'debug\'');
      expect(restoredContent).not.toContain(': string');
    });

    it('should track multiple lint fixes as action group', async () => {
      // Create multiple files with issues
      const files = [testFiles.sourceFile, testFiles.testFile];
      const contents = [
        `
function helper(data) {
  const unused1 = 'debug';
  return data.length;
}`.trim(),
        `
import { helper } from '../src/example';

function testHelper(input) {
  const unused2 = 'temp';
  return helper(input);
}`.trim(),
      ];

      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(files[i], contents[i], 'utf8');
      }

      // Create before snapshots for all files
      const beforeSnapshots = await Promise.all(
        files.map(file => testEnv.toolActionStore.createFileSnapshot(file, { stage: 'batch-lint-pre' }))
      );

      // Apply fixes to all files
      const fixedContents = contents.map((content, i) =>
        content
          .replace(/const unused[12] = '[^']+';?\n  /g, '')
          .replace(/function \w+\([^)]+\)/, `$&: ${i === 0 ? 'number' : 'any'}`)
      );

      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(files[i], fixedContents[i], 'utf8');
      }

      // Create after snapshots
      const afterSnapshots = await Promise.all(
        files.map(file => testEnv.toolActionStore.createFileSnapshot(file, { stage: 'batch-lint-post' }))
      );

      // Record batch lint action
      const batchAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'batch-lint-fix',
          toolName: 'typescript-batch-lint',
          input: { files, batchFix: true },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 300,
          result: {
            success: true,
            filesFixed: files.length,
            totalIssuesFixed: 4, // 2 per file
          },
          status: 'completed' as const,
        },
        files,
        beforeSnapshots,
        afterSnapshots,
        'batch-lint-fix'
      );

      // Verify action group tracking
      expect(batchAction.actionGroup).toBe('batch-lint-fix');
      expect(batchAction.modifiedFiles).toEqual(files);
      expect(batchAction.beforeSnapshots).toHaveLength(files.length);
      expect(batchAction.afterSnapshots).toHaveLength(files.length);

      expectToolActionUndoable(batchAction);

      // Verify all files can be undone as a group
      const undoResult = await testEnv.toolActionStore.undoAction(batchAction.id);
      expect(undoResult.success).toBe(true);
      expect(undoResult.filesRestored).toEqual(files);

      // Verify all files are restored
      for (let i = 0; i < files.length; i++) {
        const restoredContent = await fs.readFile(files[i], 'utf8');
        expect(restoredContent).toBe(contents[i]);
      }
    });
  });

  describe('Type Check Integration', () => {
    it('should run type check after TypeScript file edits', async () => {
      const tsContent = `
interface User {
  name: string;
  age: number;
}

function processUser(user: User) {
  return \`\${user.name} is \${user.age} years old\`;
}

// This should cause a type error
const badUser = { name: "John", age: "thirty" };
processUser(badUser);
`.trim();

      await fs.writeFile(testFiles.sourceFile, tsContent, 'utf8');

      // Mock type checker
      const typeCheckResults = {
        success: false,
        errors: [
          {
            file: testFiles.sourceFile,
            line: 9,
            column: 34,
            message: 'Type \'string\' is not assignable to type \'number\'',
            code: 'TS2322',
          },
        ],
        duration: 200,
      };

      // Record edit action with type check
      const editAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'edit-with-typecheck',
          toolName: 'typescript-edit',
          input: { file: testFiles.sourceFile, content: tsContent },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 250,
          result: {
            success: true,
            typeCheck: typeCheckResults,
          },
          status: 'completed' as const,
        }
      );

      // Verify type check metadata
      expect(editAction.execution.result.typeCheck).toBeDefined();
      expect(editAction.execution.result.typeCheck.success).toBe(false);
      expect(editAction.execution.result.typeCheck.errors).toHaveLength(1);
      expect(editAction.execution.result.typeCheck.errors[0].code).toBe('TS2322');
    });

    it('should report type errors without blocking', async () => {
      const invalidTsContent = `
function calculate(x: number, y: string): number {
  return x + y; // Type error: can't add number + string
}
`.trim();

      await fs.writeFile(testFiles.sourceFile, invalidTsContent, 'utf8');

      // Type check should report errors but not fail the action
      const typeCheckAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'typecheck-with-errors',
          toolName: 'typescript-check',
          input: { files: [testFiles.sourceFile] },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 180,
          result: {
            success: true, // Action succeeds even with type errors
            typeErrors: [
              {
                file: testFiles.sourceFile,
                message: 'Operator \'+\' cannot be applied to types \'number\' and \'string\'',
                severity: 'error',
              },
            ],
          },
          status: 'completed' as const,
        }
      );

      expect(typeCheckAction.execution.status).toBe('completed');
      expect(typeCheckAction.execution.result.success).toBe(true);
      expect(typeCheckAction.execution.result.typeErrors).toBeDefined();
    });

    it('should track type check results in tool action metadata', async () => {
      const validTsContent = `
function add(x: number, y: number): number {
  return x + y;
}

export { add };
`.trim();

      await fs.writeFile(testFiles.sourceFile, validTsContent, 'utf8');

      const successfulTypeCheck = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'successful-typecheck',
          toolName: 'typescript-check',
          input: { files: [testFiles.sourceFile] },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 120,
          result: {
            success: true,
            typeErrors: [],
            filesChecked: 1,
            totalLines: validTsContent.split('\n').length,
          },
          status: 'completed' as const,
        }
      );

      // Verify clean type check metadata
      expect(successfulTypeCheck.execution.result.typeErrors).toHaveLength(0);
      expect(successfulTypeCheck.execution.result.filesChecked).toBe(1);
    });
  });

  describe('TDD Mode Integration', () => {
    it('should track test file changes separately from impl', async () => {
      // Create implementation file
      const implContent = `
export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`.trim();

      // Create test file
      const testContent = `
import { fibonacci } from '../src/example';

describe('fibonacci', () => {
  it('should calculate fibonacci numbers', () => {
    expect(fibonacci(0)).toBe(0);
    expect(fibonacci(1)).toBe(1);
    expect(fibonacci(5)).toBe(5);
  });
});`.trim();

      await fs.writeFile(testFiles.sourceFile, implContent, 'utf8');
      await fs.writeFile(testFiles.testFile, testContent, 'utf8');

      // Track test file modification
      const testSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.testFile);
      const testAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'tdd-test-creation',
          toolName: 'test-file-edit',
          input: { testFile: testFiles.testFile, implFile: testFiles.sourceFile },
          taskId: testTask.id,
          agentName: 'tester',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 100,
          result: { success: true, testType: 'unit' },
          status: 'completed' as const,
        },
        [testFiles.testFile],
        [],
        [testSnapshot],
        'tdd-test'
      );

      // Track implementation file modification
      const implSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);
      const implAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'tdd-impl-creation',
          toolName: 'impl-file-edit',
          input: { implFile: testFiles.sourceFile, testFile: testFiles.testFile },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 150,
          result: { success: true, implType: 'algorithm' },
          status: 'completed' as const,
        },
        [testFiles.sourceFile],
        [],
        [implSnapshot],
        'tdd-impl'
      );

      // Verify separate tracking
      expect(testAction.actionGroup).toBe('tdd-test');
      expect(implAction.actionGroup).toBe('tdd-impl');
      expect(testAction.execution.agentName).toBe('tester');
      expect(implAction.execution.agentName).toBe('developer');
      expect(testAction.modifiedFiles).toContain(testFiles.testFile);
      expect(implAction.modifiedFiles).toContain(testFiles.sourceFile);
    });

    it('should run tests after implementation changes', async () => {
      const testResult = await tddExecutor.runTests([testFiles.testFile]);

      const testRunAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'tdd-test-run',
          toolName: 'test-runner',
          input: { testFiles: [testFiles.testFile], runner: 'vitest' },
          taskId: testTask.id,
          agentName: 'tester',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 2000,
          result: testResult,
          status: 'completed' as const,
        }
      );

      expect(testRunAction.execution.result).toBeDefined();
      expect(testRunAction.execution.agentName).toBe('tester');
      expect(testRunAction.execution.stageName).toBe('testing');
    });

    it('should guard against regression in existing tests', async () => {
      // Simulate existing passing tests
      const existingTests = [
        { file: testFiles.testFile, status: 'passed', duration: 150 },
      ];

      // Create implementation change that might break tests
      const modifiedImpl = `
export function fibonacci(n: number): number {
  // Broken implementation
  return n * 2; // Wrong!
}`.trim();

      await fs.writeFile(testFiles.sourceFile, modifiedImpl, 'utf8');

      // Run regression check
      const regressionResult = {
        success: false,
        totalTests: 1,
        passedTests: 0,
        failedTests: 1,
        regressions: [
          {
            testFile: testFiles.testFile,
            test: 'should calculate fibonacci numbers',
            error: 'Expected 5, received 10',
            wasPassingBefore: true,
          },
        ],
      };

      const regressionAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'tdd-regression-check',
          toolName: 'regression-guard',
          input: { implFile: testFiles.sourceFile, existingTests },
          taskId: testTask.id,
          agentName: 'tester',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 1800,
          result: regressionResult,
          status: 'failed' as const,
        },
        [testFiles.sourceFile]
      );

      expect(regressionAction.execution.status).toBe('failed');
      expect(regressionAction.execution.result.regressions).toHaveLength(1);
      expectToolActionNotUndoable(regressionAction); // Failed actions can't be undone
    });
  });

  describe('Complex Code Quality Workflows', () => {
    it('should coordinate lint + type check + test workflow', async () => {
      const sourceContent = `
export function divide(a: number, b: number) {
  const unused = 'debug';
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}`.trim();

      const testContent = `
import { divide } from '../src/example';

test('divide function', () => {
  expect(divide(10, 2)).toBe(5);
  expect(() => divide(10, 0)).toThrow('Division by zero');
});`.trim();

      await fs.writeFile(testFiles.sourceFile, sourceContent, 'utf8');
      await fs.writeFile(testFiles.testFile, testContent, 'utf8');

      // 1. Lint phase
      const beforeLintSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);

      const fixedContent = sourceContent
        .replace(/const unused = 'debug';\n  /g, '')
        .replace('function divide(a: number, b: number)', 'function divide(a: number, b: number): number');

      await fs.writeFile(testFiles.sourceFile, fixedContent, 'utf8');

      const afterLintSnapshot = await testEnv.toolActionStore.createFileSnapshot(testFiles.sourceFile);

      const lintAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'workflow-lint',
          toolName: 'typescript-lint',
          input: { file: testFiles.sourceFile },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 120,
          result: { success: true, issuesFixed: 2 },
          status: 'completed' as const,
        },
        [testFiles.sourceFile],
        [beforeLintSnapshot],
        [afterLintSnapshot],
        'quality-workflow'
      );

      // 2. Type check phase
      const typeCheckAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'workflow-typecheck',
          toolName: 'typescript-check',
          input: { files: [testFiles.sourceFile] },
          taskId: testTask.id,
          agentName: 'developer',
          stageName: 'implementation',
          startTime: new Date(),
          endTime: new Date(),
          duration: 180,
          result: { success: true, typeErrors: [] },
          status: 'completed' as const,
        },
        [],
        [],
        [],
        'quality-workflow'
      );

      // 3. Test phase
      const testAction = await testEnv.toolActionStore.recordToolAction(
        testTask.id,
        {
          callId: 'workflow-test',
          toolName: 'test-runner',
          input: { testFiles: [testFiles.testFile] },
          taskId: testTask.id,
          agentName: 'tester',
          stageName: 'testing',
          startTime: new Date(),
          endTime: new Date(),
          duration: 1500,
          result: { success: true, tests: 2, passed: 2, failed: 0 },
          status: 'completed' as const,
        },
        [],
        [],
        [],
        'quality-workflow'
      );

      // Verify workflow coordination
      const workflowActions = await testEnv.toolActionStore.getActionsForTask(testTask.id);
      const qualityActions = workflowActions.filter(a => a.actionGroup === 'quality-workflow');

      expect(qualityActions).toHaveLength(3);
      expect(qualityActions.some(a => a.execution.toolName === 'typescript-lint')).toBe(true);
      expect(qualityActions.some(a => a.execution.toolName === 'typescript-check')).toBe(true);
      expect(qualityActions.some(a => a.execution.toolName === 'test-runner')).toBe(true);

      // Verify only lint action is undoable (others didn't modify files)
      expectToolActionUndoable(lintAction);
      expectToolActionNotUndoable(typeCheckAction);
      expectToolActionNotUndoable(testAction);
    });
  });
});