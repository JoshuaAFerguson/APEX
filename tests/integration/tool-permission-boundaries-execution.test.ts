/**
 * @fileoverview Tool Permission Boundaries Execution Tests
 *
 * This test suite verifies that tools actually respect permission boundaries
 * during execution, not just during permission checks. It tests real tool
 * execution scenarios with different permission levels.
 *
 * Test Coverage:
 * - Actual tool execution with allow-always, allow-once, and deny permissions
 * - Error handling and messaging when permissions are denied
 * - Permission consumption during real tool execution
 * - Integration with the Claude Agent SDK tool execution pipeline
 *
 * Acceptance Criteria:
 * - Tools respect permission levels during actual execution
 * - Proper error messages are returned when permissions are denied
 * - Allow-once permissions are consumed after actual tool use
 * - Allow-always permissions persist through multiple uses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { ApexOrchestrator } from '@apexcli/orchestrator';
import type { PermissionLevel, Task } from '@apexcli/core';

// Mock the Claude SDK query function
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn().mockImplementation(async ({ tools, messages }) => {
    // Mock tool execution based on permission state
    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage?.content === 'string' && lastMessage.content.includes('READ_FILE')) {
      // Simulate tool execution attempt
      return {
        content: [
          {
            type: 'tool_use',
            id: 'test-tool-use',
            name: 'Read',
            input: { file_path: '/test/file.txt' }
          }
        ],
        usage: { inputTokens: 20, outputTokens: 30 }
      };
    }
    return {
      content: [],
      usage: { inputTokens: 10, outputTokens: 10 }
    };
  }),
  AgentDefinition: {},
  McpServerConfig: {}
}));

describe('Tool Permission Boundaries - Execution', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let testFilePath: string;
  let testDirPath: string;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await mkdtemp(join(tmpdir(), 'apex-tool-execution-test-'));
    testDirPath = join(tempDir, 'test-files');
    await mkdir(testDirPath, { recursive: true });
    testFilePath = join(testDirPath, 'test-file.txt');
    await writeFile(testFilePath, 'Initial test content for execution tests');

    // Create minimal .apex directory structure
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
    await mkdir(join(apexDir, 'agents'), { recursive: true });
    await mkdir(join(apexDir, 'workflows'), { recursive: true });

    // Create test configuration
    const configContent = `
project:
  name: tool-execution-permission-test
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all

agents:
  execution-test-agent:
    role: "Agent for testing tool execution with permissions"
    model: sonnet
    tools: [Read, Write, Edit, Bash, Grep, Glob]

workflows:
  execution-test-workflow:
    name: "Execution Test Workflow"
    agents: [execution-test-agent]
    stages:
      - name: execution-test-stage
        agent: execution-test-agent
        description: "Test stage for tool execution with permissions"

limits:
  maxTasksPerHour: 100
  maxCostPerTask: 10.0
  maxConcurrentTasks: 5
`;

    await writeFile(join(apexDir, 'config.yaml'), configContent);

    // Create test agent file
    await writeFile(
      join(apexDir, 'agents', 'execution-test-agent.md'),
      `---
name: execution-test-agent
description: Agent for testing tool execution with permissions
tools: [Read, Write, Edit, Bash, Grep, Glob]
---

You are an agent that tests tool execution with permission boundaries.`
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator(tempDir);
    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function createTestTask(description: string): Promise<Task> {
    return await orchestrator.createTask({
      description,
      workflowName: 'execution-test-workflow',
      options: {
        autonomy: 'guided',
        timeout: 30000
      }
    });
  }

  async function grantToolPermission(tool: string, scope: string, level: PermissionLevel): Promise<void> {
    await orchestrator.grantPermission(tool, scope, level);
  }

  async function executeTaskAndGetResult(task: Task): Promise<any> {
    const result = await orchestrator.executeTask(task.id);
    return result;
  }

  // ============================================================================
  // Filesystem Tools Execution Tests
  // ============================================================================

  describe('Filesystem Tools - Execution', () => {
    describe('Read Tool Execution', () => {
      it('should successfully read file when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantToolPermission('Read', testFilePath, 'allow-always');

        // Create task that attempts to read the file
        const task = await createTestTask(`READ_FILE: ${testFilePath}`);

        // Execute task - should succeed
        const result = await executeTaskAndGetResult(task);

        // Verify task completed without permission errors
        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();

        // Test multiple uses - should still work with allow-always
        const task2 = await createTestTask(`READ_FILE_AGAIN: ${testFilePath}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('completed');
        expect(result2.error).toBeUndefined();
      });

      it('should read file once then fail when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantToolPermission('Read', testFilePath, 'allow-once');

        // First use should succeed
        const task1 = await createTestTask(`READ_FILE_FIRST: ${testFilePath}`);
        const result1 = await executeTaskAndGetResult(task1);

        expect(result1.status).toBe('completed');
        expect(result1.error).toBeUndefined();

        // Second use should fail due to permission consumption
        const task2 = await createTestTask(`READ_FILE_SECOND: ${testFilePath}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('error');
        expect(result2.error?.message).toContain('permission');
      });

      it('should fail to read file when permission is deny', async () => {
        // Grant deny permission
        await grantToolPermission('Read', testFilePath, 'deny');

        // Create task that attempts to read the file
        const task = await createTestTask(`READ_FILE_DENIED: ${testFilePath}`);

        // Execute task - should fail
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('error');
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain('denied');
      });
    });

    describe('Write Tool Execution', () => {
      it('should successfully write file when permission is allow-always', async () => {
        const newFilePath = join(testDirPath, 'new-write-test.txt');

        // Grant allow-always permission
        await grantToolPermission('Write', newFilePath, 'allow-always');

        // Create task that attempts to write the file
        const task = await createTestTask(`WRITE_FILE: ${newFilePath}`);

        // Execute task - should succeed
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();

        // Test multiple writes - should work with allow-always
        const task2 = await createTestTask(`WRITE_FILE_AGAIN: ${newFilePath}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('completed');
        expect(result2.error).toBeUndefined();
      });

      it('should write file once then fail when permission is allow-once', async () => {
        const newFilePath = join(testDirPath, 'once-write-test.txt');

        // Grant allow-once permission
        await grantToolPermission('Write', newFilePath, 'allow-once');

        // First write should succeed
        const task1 = await createTestTask(`WRITE_FILE_FIRST: ${newFilePath}`);
        const result1 = await executeTaskAndGetResult(task1);

        expect(result1.status).toBe('completed');
        expect(result1.error).toBeUndefined();

        // Second write should fail due to permission consumption
        const task2 = await createTestTask(`WRITE_FILE_SECOND: ${newFilePath}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('error');
        expect(result2.error?.message).toContain('permission');
      });

      it('should fail to write file when permission is deny', async () => {
        const deniedFilePath = join(testDirPath, 'denied-write.txt');

        // Grant deny permission
        await grantToolPermission('Write', deniedFilePath, 'deny');

        // Create task that attempts to write the file
        const task = await createTestTask(`WRITE_FILE_DENIED: ${deniedFilePath}`);

        // Execute task - should fail
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('error');
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain('denied');
      });
    });

    describe('Edit Tool Execution', () => {
      it('should successfully edit file when permission is allow-always', async () => {
        // Grant allow-always permission
        await grantToolPermission('Edit', testFilePath, 'allow-always');

        // Create task that attempts to edit the file
        const task = await createTestTask(`EDIT_FILE: ${testFilePath}`);

        // Execute task - should succeed
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();
      });

      it('should edit file once then fail when permission is allow-once', async () => {
        // Grant allow-once permission
        await grantToolPermission('Edit', testFilePath, 'allow-once');

        // First edit should succeed
        const task1 = await createTestTask(`EDIT_FILE_FIRST: ${testFilePath}`);
        const result1 = await executeTaskAndGetResult(task1);

        expect(result1.status).toBe('completed');
        expect(result1.error).toBeUndefined();

        // Second edit should fail
        const task2 = await createTestTask(`EDIT_FILE_SECOND: ${testFilePath}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('error');
        expect(result2.error?.message).toContain('permission');
      });

      it('should fail to edit file when permission is deny', async () => {
        // Grant deny permission
        await grantToolPermission('Edit', testFilePath, 'deny');

        // Create task that attempts to edit the file
        const task = await createTestTask(`EDIT_FILE_DENIED: ${testFilePath}`);

        // Execute task - should fail
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('error');
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain('denied');
      });
    });
  });

  // ============================================================================
  // Shell Tools Execution Tests
  // ============================================================================

  describe('Shell Tools - Execution', () => {
    describe('Bash Tool Execution', () => {
      it('should execute command when permission is allow-always', async () => {
        const testCommand = 'echo "test execution"';

        // Grant allow-always permission
        await grantToolPermission('Bash', testCommand, 'allow-always');

        // Create task that attempts to execute the command
        const task = await createTestTask(`EXECUTE_BASH: ${testCommand}`);

        // Execute task - should succeed
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();
      });

      it('should execute command once then fail when permission is allow-once', async () => {
        const testCommand = 'echo "once execution"';

        // Grant allow-once permission
        await grantToolPermission('Bash', testCommand, 'allow-once');

        // First execution should succeed
        const task1 = await createTestTask(`EXECUTE_BASH_FIRST: ${testCommand}`);
        const result1 = await executeTaskAndGetResult(task1);

        expect(result1.status).toBe('completed');
        expect(result1.error).toBeUndefined();

        // Second execution should fail
        const task2 = await createTestTask(`EXECUTE_BASH_SECOND: ${testCommand}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('error');
        expect(result2.error?.message).toContain('permission');
      });

      it('should fail to execute command when permission is deny', async () => {
        const deniedCommand = 'echo "denied execution"';

        // Grant deny permission
        await grantToolPermission('Bash', deniedCommand, 'deny');

        // Create task that attempts to execute the command
        const task = await createTestTask(`EXECUTE_BASH_DENIED: ${deniedCommand}`);

        // Execute task - should fail
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('error');
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain('denied');
      });
    });
  });

  // ============================================================================
  // Search Tools Execution Tests
  // ============================================================================

  describe('Search Tools - Execution', () => {
    describe('Grep Tool Execution', () => {
      it('should search when permission is allow-always', async () => {
        const searchPattern = 'test.*content';

        // Grant allow-always permission
        await grantToolPermission('Grep', searchPattern, 'allow-always');

        // Create task that attempts to search
        const task = await createTestTask(`GREP_SEARCH: ${searchPattern}`);

        // Execute task - should succeed
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();
      });

      it('should search once then fail when permission is allow-once', async () => {
        const searchPattern = 'once.*pattern';

        // Grant allow-once permission
        await grantToolPermission('Grep', searchPattern, 'allow-once');

        // First search should succeed
        const task1 = await createTestTask(`GREP_SEARCH_FIRST: ${searchPattern}`);
        const result1 = await executeTaskAndGetResult(task1);

        expect(result1.status).toBe('completed');
        expect(result1.error).toBeUndefined();

        // Second search should fail
        const task2 = await createTestTask(`GREP_SEARCH_SECOND: ${searchPattern}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('error');
        expect(result2.error?.message).toContain('permission');
      });

      it('should fail to search when permission is deny', async () => {
        const deniedPattern = 'denied.*search';

        // Grant deny permission
        await grantToolPermission('Grep', deniedPattern, 'deny');

        // Create task that attempts to search
        const task = await createTestTask(`GREP_SEARCH_DENIED: ${deniedPattern}`);

        // Execute task - should fail
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('error');
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain('denied');
      });
    });

    describe('Glob Tool Execution', () => {
      it('should find files when permission is allow-always', async () => {
        const globPattern = '**/*.txt';

        // Grant allow-always permission
        await grantToolPermission('Glob', globPattern, 'allow-always');

        // Create task that attempts to find files
        const task = await createTestTask(`GLOB_SEARCH: ${globPattern}`);

        // Execute task - should succeed
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();
      });

      it('should find files once then fail when permission is allow-once', async () => {
        const globPattern = 'test/*.md';

        // Grant allow-once permission
        await grantToolPermission('Glob', globPattern, 'allow-once');

        // First search should succeed
        const task1 = await createTestTask(`GLOB_SEARCH_FIRST: ${globPattern}`);
        const result1 = await executeTaskAndGetResult(task1);

        expect(result1.status).toBe('completed');
        expect(result1.error).toBeUndefined();

        // Second search should fail
        const task2 = await createTestTask(`GLOB_SEARCH_SECOND: ${globPattern}`);
        const result2 = await executeTaskAndGetResult(task2);

        expect(result2.status).toBe('error');
        expect(result2.error?.message).toContain('permission');
      });

      it('should fail to find files when permission is deny', async () => {
        const deniedPattern = 'denied/**/*';

        // Grant deny permission
        await grantToolPermission('Glob', deniedPattern, 'deny');

        // Create task that attempts to find files
        const task = await createTestTask(`GLOB_SEARCH_DENIED: ${deniedPattern}`);

        // Execute task - should fail
        const result = await executeTaskAndGetResult(task);

        expect(result.status).toBe('error');
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain('denied');
      });
    });
  });

  // ============================================================================
  // Error Message Verification Tests
  // ============================================================================

  describe('Error Messages and Feedback', () => {
    it('should provide clear error messages for permission denials', async () => {
      // Test different tools with deny permissions
      const testCases = [
        { tool: 'Read', scope: testFilePath, task: 'READ_DENIED_ERROR' },
        { tool: 'Write', scope: join(testDirPath, 'denied.txt'), task: 'WRITE_DENIED_ERROR' },
        { tool: 'Edit', scope: testFilePath, task: 'EDIT_DENIED_ERROR' },
        { tool: 'Bash', scope: 'echo "denied"', task: 'BASH_DENIED_ERROR' },
        { tool: 'Grep', scope: 'denied.*pattern', task: 'GREP_DENIED_ERROR' },
        { tool: 'Glob', scope: 'denied/**/*', task: 'GLOB_DENIED_ERROR' }
      ];

      for (const testCase of testCases) {
        // Grant deny permission
        await grantToolPermission(testCase.tool, testCase.scope, 'deny');

        // Create and execute task
        const task = await createTestTask(testCase.task);
        const result = await executeTaskAndGetResult(task);

        // Verify error message quality
        expect(result.status).toBe('error');
        expect(result.error?.message).toBeDefined();
        expect(result.error?.message).toContain('permission');
        expect(result.error?.message).toContain(testCase.tool.toLowerCase());
        expect(result.error?.message.length).toBeGreaterThan(10); // Meaningful error message
      }
    });

    it('should provide helpful suggestions when permissions are insufficient', async () => {
      // Grant deny permission for a read operation
      await grantToolPermission('Read', testFilePath, 'deny');

      const task = await createTestTask(`READ_FOR_SUGGESTION: ${testFilePath}`);
      const result = await executeTaskAndGetResult(task);

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('permission');

      // Check if suggestion is provided
      const errorMessage = result.error?.message.toLowerCase();
      expect(
        errorMessage?.includes('grant') ||
        errorMessage?.includes('allow') ||
        errorMessage?.includes('permission')
      ).toBe(true);
    });
  });

  // ============================================================================
  // Performance and Concurrency Tests
  // ============================================================================

  describe('Performance and Concurrency', () => {
    it('should handle concurrent permission checks efficiently', async () => {
      const concurrentTasks = 10;
      const tasks: Promise<any>[] = [];

      // Set up permissions for concurrent execution
      for (let i = 0; i < concurrentTasks; i++) {
        await grantToolPermission('Read', `${testFilePath}-${i}`, 'allow-always');
      }

      // Create concurrent tasks
      for (let i = 0; i < concurrentTasks; i++) {
        const task = createTestTask(`CONCURRENT_READ_${i}: ${testFilePath}-${i}`);
        tasks.push(task.then(t => executeTaskAndGetResult(t)));
      }

      // Execute all tasks concurrently
      const results = await Promise.all(tasks);

      // Verify all tasks completed successfully
      results.forEach((result, index) => {
        expect(result.status).toBe('completed');
        expect(result.error).toBeUndefined();
      });
    });

    it('should handle permission state changes during execution', async () => {
      // Start with allow-always permission
      await grantToolPermission('Read', testFilePath, 'allow-always');

      // Create first task
      const task1 = await createTestTask(`READ_BEFORE_CHANGE: ${testFilePath}`);

      // Change permission to deny
      await grantToolPermission('Read', testFilePath, 'deny');

      // Create second task after permission change
      const task2 = await createTestTask(`READ_AFTER_CHANGE: ${testFilePath}`);

      // Execute both tasks
      const result1 = await executeTaskAndGetResult(task1);
      const result2 = await executeTaskAndGetResult(task2);

      // First task should succeed (permission was valid when created/executed)
      expect(result1.status).toBe('completed');

      // Second task should fail (permission was denied when executed)
      expect(result2.status).toBe('error');
      expect(result2.error?.message).toContain('permission');
    });
  });
});