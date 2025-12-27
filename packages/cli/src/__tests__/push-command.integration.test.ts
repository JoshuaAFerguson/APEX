/**
 * Integration tests for the /push command
 * Tests the complete interaction between CLI and orchestrator git operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { execSync } from 'child_process';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    magenta: { bold: (str: string) => str },
  },
}));

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('Push Command Integration', () => {
  let tempProjectPath: string;
  let mockContext: CliContext;
  let realOrchestrator: ApexOrchestrator;

  beforeEach(async () => {
    mockConsoleLog.mockClear();

    // Create temporary project directory
    tempProjectPath = join(tmpdir(), `apex-push-test-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });

    // Initialize a git repository
    try {
      execSync('git init', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: tempProjectPath, stdio: 'ignore' });

      // Create initial commit
      await writeFile(join(tempProjectPath, 'README.md'), '# Test Project\n');
      execSync('git add README.md', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: tempProjectPath, stdio: 'ignore' });

      // Create main branch
      execSync('git branch -M main', { cwd: tempProjectPath, stdio: 'ignore' });
    } catch (error) {
      console.warn('Git setup failed, some tests may be skipped:', error);
    }

    // Create apex directory structure
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create minimal config
    await writeFile(join(apexDir, 'config.yaml'), `
project:
  name: test-project
  description: Test project for push command integration
`);

    // Create real orchestrator instance
    realOrchestrator = new ApexOrchestrator(tempProjectPath);

    mockContext = {
      cwd: tempProjectPath,
      initialized: true,
      config: {} as any,
      orchestrator: realOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(async () => {
    try {
      await rm(tempProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    mockConsoleLog.mockClear();
  });

  describe('Integration with real orchestrator', () => {
    it('should validate task exists before attempting push', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand).toBeDefined();

      await realOrchestrator.initialize();

      // Test with non-existent task
      await pushCommand?.handler(mockContext, ['non-existent-task']);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found: non-existent-task')
      );
    });

    it('should handle task without branch gracefully', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand).toBeDefined();

      await realOrchestrator.initialize();

      // Create task without branch
      const task = await realOrchestrator.createTask({
        description: 'Test task without branch',
        workflow: 'feature',
      });

      await pushCommand?.handler(mockContext, [task.id]);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task does not have a branch')
      );
    });

    it('should validate git repository exists', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand).toBeDefined();

      // Create orchestrator in directory without git
      const tempDirNoGit = join(tmpdir(), `apex-push-nogit-test-${Date.now()}`);
      await mkdir(tempDirNoGit, { recursive: true });

      const apexDir = join(tempDirNoGit, '.apex');
      await mkdir(apexDir, { recursive: true });
      await writeFile(join(apexDir, 'config.yaml'), `project:\n  name: test`);

      const noGitOrchestrator = new ApexOrchestrator(tempDirNoGit);
      await noGitOrchestrator.initialize();

      const noGitContext = { ...mockContext, orchestrator: noGitOrchestrator };

      const task = await noGitOrchestrator.createTask({
        description: 'Test task',
        workflow: 'feature',
      });

      // Manually set branch name to simulate task with branch
      await (noGitOrchestrator as any).store.updateTask(task.id, {
        branchName: 'feature/test-branch'
      });

      await pushCommand?.handler(noGitContext, [task.id]);

      // Should fail because no git repository
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Failed to push')
      );

      // Cleanup
      try {
        await rm(tempDirNoGit, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should handle push failures gracefully when no remote exists', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand).toBeDefined();

      await realOrchestrator.initialize();

      const task = await realOrchestrator.createTask({
        description: 'Test task with branch',
        workflow: 'feature',
      });

      // Create and checkout a feature branch
      execSync('git checkout -b feature/test-branch', {
        cwd: tempProjectPath,
        stdio: 'ignore'
      });

      // Update task to have branch name
      await (realOrchestrator as any).store.updateTask(task.id, {
        branchName: 'feature/test-branch'
      });

      // Attempt push (should fail since no remote origin)
      await pushCommand?.handler(mockContext, [task.id]);

      const logCalls = mockConsoleLog.mock.calls.flat();
      const hasFailureMessage = logCalls.some(call =>
        typeof call === 'string' && call.includes('Failed to push')
      );

      expect(hasFailureMessage).toBe(true);
    });
  });

  describe('Command error handling integration', () => {
    it('should handle orchestrator initialization errors', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand).toBeDefined();

      // Create context with non-initialized orchestrator
      const uninitializedContext = {
        ...mockContext,
        orchestrator: new ApexOrchestrator('/non-existent-path'),
      };

      await pushCommand?.handler(uninitializedContext, ['test-task']);

      // Should not throw but handle error gracefully
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Task not found')
      );
    });

    it('should handle database connection errors gracefully', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand).toBeDefined();

      // Mock the orchestrator methods to simulate database errors
      const orchestratorWithError = {
        ...realOrchestrator,
        getTask: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      const errorContext = {
        ...mockContext,
        orchestrator: orchestratorWithError,
      };

      // Should not throw but handle the error
      await expect(
        pushCommand?.handler(errorContext, ['test-task'])
      ).resolves.not.toThrow();
    });
  });

  describe('Command alias integration', () => {
    it('should work with shorthand alias "p"', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand?.aliases).toContain('p');

      // Verify the same handler works for alias resolution
      expect(pushCommand?.handler).toBeTypeOf('function');
    });
  });

  describe('Usage message integration', () => {
    it('should show correct usage when called without arguments', async () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');

      await pushCommand?.handler(mockContext, []);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /push <task_id>')
      );
    });

    it('should show correct usage format in command definition', () => {
      const pushCommand = commands.find(cmd => cmd.name === 'push');
      expect(pushCommand?.usage).toBe('/push <task_id>');
    });
  });
});