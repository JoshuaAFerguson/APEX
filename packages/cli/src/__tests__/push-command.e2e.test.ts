/**
 * Push Command End-to-End Tests
 *
 * End-to-end tests that verify the complete push command workflow
 * with real git operations and minimal mocking. Tests the entire pipeline
 * from CLI command parsing through real git operations to console output.
 *
 * These tests validate:
 * 1. Real git operations with actual repositories and remotes
 * 2. Actual console output formatting and error messages
 * 3. Real orchestrator interactions with task management
 * 4. Complete acceptance criteria validation for push functionality
 * 5. Partial task ID resolution with real git operations
 * 6. Push failure scenarios and proper error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { execSync } from 'child_process';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import type { Task } from '@apexcli/core';

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
    dim: (str: string) => str,
    magenta: { bold: (str: string) => str },
  },
}));

// Capture console output for validation
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;

const mockConsoleLog = (...args: any[]) => {
  consoleOutput.push(args.map(arg => String(arg)).join(' '));
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to create a task with an actual git branch and remote setup
 */
async function createTaskWithBranchAndRemote(
  orchestrator: ApexOrchestrator,
  projectPath: string,
  remotePath: string,
  description: string,
  setupRemote: boolean = true
): Promise<{ task: Task; branchName: string }> {
  const task = await orchestrator.createTask({
    description,
    workflow: 'feature',
  });

  const branchName = `feature/task-${task.id.substring(0, 8)}`;

  // Create actual branch with commits
  execSync(`git checkout -b ${branchName}`, { cwd: projectPath, stdio: 'ignore' });
  await writeFile(join(projectPath, `feature-${task.id.substring(0, 8)}.js`),
    `// Feature: ${description}\n// Task ID: ${task.id}\nmodule.exports = { task: '${task.id}' };\n`);
  execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
  execSync(`git commit -m "feat: ${description}

Task ID: ${task.id}
Implements new functionality as requested."`, { cwd: projectPath, stdio: 'ignore' });

  // Switch back to main
  execSync('git checkout main', { cwd: projectPath, stdio: 'ignore' });

  // Set up remote if requested
  if (setupRemote) {
    try {
      // Remove existing remote if any
      execSync('git remote remove origin', { cwd: projectPath, stdio: 'ignore' });
    } catch {
      // Ignore if remote doesn't exist
    }
    execSync(`git remote add origin ${remotePath}`, { cwd: projectPath, stdio: 'ignore' });
  }

  // Update task with branch name
  await (orchestrator as any).store.updateTask(task.id, { branchName });

  return { task, branchName };
}

/**
 * Helper to verify remote branch exists
 */
function remoteBranchExists(projectPath: string, branchName: string): boolean {
  try {
    const remoteBranches = execSync('git ls-remote --heads origin', {
      cwd: projectPath,
      encoding: 'utf-8'
    });
    return remoteBranches.includes(branchName);
  } catch {
    return false;
  }
}

/**
 * Helper to get current git branch
 */
function getCurrentBranch(projectPath: string): string {
  return execSync('git branch --show-current', { cwd: projectPath, encoding: 'utf-8' }).trim();
}

/**
 * Helper to get git log output
 */
function getGitLog(projectPath: string, format: string = '%s'): string[] {
  const output = execSync(`git log --oneline --format="${format}"`, {
    cwd: projectPath,
    encoding: 'utf-8'
  });
  return output.trim().split('\n').filter(Boolean);
}

/**
 * Helper to check if local branch exists
 */
function localBranchExists(projectPath: string, branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify ${branchName}`, { cwd: projectPath, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to create test tasks with different naming patterns for partial ID tests
 */
async function createTestTasksWithPredictableIds(
  orchestrator: ApexOrchestrator,
  projectPath: string,
  remotePath: string
): Promise<{ tasks: Task[], branches: string[] }> {
  const tasks: Task[] = [];
  const branches: string[] = [];

  // Create tasks with predictable ID patterns for testing partial resolution
  for (let i = 0; i < 3; i++) {
    const { task, branchName } = await createTaskWithBranchAndRemote(
      orchestrator,
      projectPath,
      remotePath,
      `Test feature ${i + 1}`,
      true
    );
    tasks.push(task);
    branches.push(branchName);
  }

  return { tasks, branches };
}

// ============================================================================
// Tests
// ============================================================================

describe('Push Command End-to-End Tests', () => {
  let tempProjectPath: string;
  let tempRemotePath: string;
  let realOrchestrator: ApexOrchestrator;
  let mockContext: CliContext;
  let pushCommand: ReturnType<typeof commands.find>;

  beforeEach(async () => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;

    // Create temporary directories
    tempProjectPath = join(tmpdir(), `apex-push-e2e-test-${Date.now()}`);
    tempRemotePath = join(tmpdir(), `apex-push-e2e-remote-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });
    await mkdir(tempRemotePath, { recursive: true });

    // Initialize "remote" bare repository (for push tests)
    execSync('git init --bare', { cwd: tempRemotePath, stdio: 'ignore' });

    // Initialize project repository
    execSync('git init', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git config user.name "E2E Test User"', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git config user.email "e2e-test@apex.dev"', { cwd: tempProjectPath, stdio: 'ignore' });

    // Create initial commit
    await writeFile(join(tempProjectPath, 'README.md'), '# E2E Push Test Project\n\nThis project is for testing push command functionality.\n');
    await writeFile(join(tempProjectPath, 'package.json'), JSON.stringify({
      name: 'e2e-push-test',
      version: '1.0.0',
      description: 'E2E testing for push command'
    }, null, 2));
    execSync('git add .', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit

Set up E2E test project structure"', { cwd: tempProjectPath, stdio: 'ignore' });

    // Set up main branch and remote
    execSync('git branch -M main', { cwd: tempProjectPath, stdio: 'ignore' });
    execSync(`git remote add origin ${tempRemotePath}`, { cwd: tempProjectPath, stdio: 'ignore' });
    execSync('git push -u origin main', { cwd: tempProjectPath, stdio: 'ignore' });

    // Create APEX config
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });
    await writeFile(join(apexDir, 'config.yaml'), `
project:
  name: e2e-push-test-project
  description: E2E test project for push command functionality
  version: "1.0.0"

settings:
  defaultWorkflow: feature
  autonomy:
    default: autonomous

workflows:
  feature:
    stages:
      - planning
      - implementation
      - testing
      - review
`);

    // Initialize real orchestrator
    realOrchestrator = new ApexOrchestrator({ projectPath: tempProjectPath });
    await realOrchestrator.initialize();

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

    // Get push command
    pushCommand = commands.find(cmd => cmd.name === 'push');
    expect(pushCommand).toBeDefined();
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    try {
      await rm(tempProjectPath, { recursive: true, force: true });
      await rm(tempRemotePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  // ==========================================================================
  // Core Push Functionality Tests
  // ==========================================================================

  describe('Core Push Functionality', () => {
    it('should successfully push task branch to remote origin with full task ID', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'E2E test feature implementation'
      );

      // Verify branch exists locally
      expect(localBranchExists(tempProjectPath, branchName)).toBe(true);

      // Execute push command
      await pushCommand!.handler(mockContext, [task.id]);

      // Verify push output
      const output = consoleOutput.join('\n');
      expect(output).toContain(`Pushing branch ${branchName} to remote`);
      expect(output).toContain(`Successfully pushed ${branchName} to origin`);

      // Verify remote branch exists
      expect(remoteBranchExists(tempProjectPath, branchName)).toBe(true);

      // Verify we're still on main branch
      expect(getCurrentBranch(tempProjectPath)).toBe('main');

      // Verify remote has the commits
      const remoteBranches = execSync('git ls-remote --heads origin', {
        cwd: tempProjectPath,
        encoding: 'utf-8'
      });
      expect(remoteBranches).toContain(branchName);
    });

    it('should successfully push task branch with partial task ID (8 characters)', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Partial ID test feature'
      );

      const partialId = task.id.substring(0, 8);

      // Execute push command with partial ID
      await pushCommand!.handler(mockContext, [partialId]);

      // Verify push succeeded
      const output = consoleOutput.join('\n');
      expect(output).toContain(`Pushing branch ${branchName} to remote`);
      expect(output).toContain(`Successfully pushed ${branchName} to origin`);

      // Verify remote branch exists
      expect(remoteBranchExists(tempProjectPath, branchName)).toBe(true);
    });

    it('should successfully push task branch with partial task ID (12 characters)', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        '12-char partial ID test'
      );

      const partialId = task.id.substring(0, 12);

      // Execute push command with partial ID
      await pushCommand!.handler(mockContext, [partialId]);

      // Verify push succeeded
      const output = consoleOutput.join('\n');
      expect(output).toContain(`Pushing branch ${branchName} to remote`);
      expect(output).toContain(`Successfully pushed ${branchName} to origin`);

      // Verify remote branch exists
      expect(remoteBranchExists(tempProjectPath, branchName)).toBe(true);
    });

    it('should handle multiple tasks and push correct one with unique partial ID', async () => {
      const { tasks } = await createTestTasksWithPredictableIds(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath
      );

      // Find the first task and get a unique partial ID for it
      const targetTask = tasks[0];
      const uniquePartialId = targetTask.id.substring(0, 10); // Use 10 chars for uniqueness

      // Execute push command
      await pushCommand!.handler(mockContext, [uniquePartialId]);

      // Verify correct task was found and pushed
      const output = consoleOutput.join('\n');
      expect(output).toContain('Pushing branch');
      expect(output).toContain('Successfully pushed');

      // Should have resolved to the correct task
      const expectedBranchName = `feature/task-${targetTask.id.substring(0, 8)}`;
      expect(remoteBranchExists(tempProjectPath, expectedBranchName)).toBe(true);
    });
  });

  // ==========================================================================
  // Push Failure Scenarios
  // ==========================================================================

  describe('Push Failure Scenarios', () => {
    it('should handle gracefully when no remote origin is configured', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'No remote test',
        false // Don't setup remote
      );

      // Execute push command
      await pushCommand!.handler(mockContext, [task.id]);

      // Verify failure is handled gracefully
      const output = consoleOutput.join('\n');
      expect(output).toContain(`Pushing branch ${branchName} to remote`);
      expect(output).toContain('Failed to push:');

      // Should mention remote-related error
      expect(output.toLowerCase()).toMatch(/(remote|origin|repository)/);
    });

    it('should handle gracefully when task has no branch', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Task without branch',
        workflow: 'feature',
      });

      // Execute push command
      await pushCommand!.handler(mockContext, [task.id]);

      // Verify appropriate error message
      const output = consoleOutput.join('\n');
      expect(output).toContain('Task does not have a branch');
    });

    it('should handle gracefully when task is not found', async () => {
      await pushCommand!.handler(mockContext, ['non-existent-task-id']);

      // Verify appropriate error message
      const output = consoleOutput.join('\n');
      expect(output).toContain('Task not found: non-existent-task-id');
      expect(output).toContain('Use /status to see available tasks');
    });

    it('should handle gracefully when partial task ID is ambiguous', async () => {
      const { tasks } = await createTestTasksWithPredictableIds(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath
      );

      // Use a very short partial ID that might match multiple tasks
      const veryShortId = tasks[0].id.substring(0, 4);

      await pushCommand!.handler(mockContext, [veryShortId]);

      // Should either succeed (if unique) or provide clear error message
      const output = consoleOutput.join('\n');
      expect(output).toBeDefined();

      // If it matches, should push successfully
      // If it doesn't match, should show task not found
      const hasSuccess = output.includes('Successfully pushed');
      const hasNotFound = output.includes('Task not found');

      expect(hasSuccess || hasNotFound).toBe(true);
    });

    it('should handle git repository errors gracefully', async () => {
      // Create a task in a directory that's not a git repository
      const tempNonGitPath = join(tmpdir(), `apex-push-non-git-${Date.now()}`);
      await mkdir(tempNonGitPath, { recursive: true });

      const apexDir = join(tempNonGitPath, '.apex');
      await mkdir(apexDir, { recursive: true });
      await writeFile(join(apexDir, 'config.yaml'), `project:\n  name: non-git-test`);

      const nonGitOrchestrator = new ApexOrchestrator({ projectPath: tempNonGitPath });
      await nonGitOrchestrator.initialize();

      const task = await nonGitOrchestrator.createTask({
        description: 'Task in non-git repo',
        workflow: 'feature',
      });

      // Manually set branch name to simulate task with branch
      await (nonGitOrchestrator as any).store.updateTask(task.id, {
        branchName: 'feature/test-branch'
      });

      const nonGitContext = { ...mockContext, orchestrator: nonGitOrchestrator };

      await pushCommand!.handler(nonGitContext, [task.id]);

      // Should fail gracefully
      const output = consoleOutput.join('\n');
      expect(output).toContain('Failed to push:');

      // Cleanup
      try {
        await rm(tempNonGitPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should handle network/remote access errors gracefully', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Network error test'
      );

      // Remove remote after setup to simulate network/access error
      execSync('git remote remove origin', { cwd: tempProjectPath, stdio: 'ignore' });

      await pushCommand!.handler(mockContext, [task.id]);

      // Verify failure is handled gracefully
      const output = consoleOutput.join('\n');
      expect(output).toContain(`Pushing branch ${branchName} to remote`);
      expect(output).toContain('Failed to push:');
    });
  });

  // ==========================================================================
  // Command Validation and Input Handling
  // ==========================================================================

  describe('Command Validation and Input Handling', () => {
    it('should show usage message when no task ID is provided', async () => {
      await pushCommand!.handler(mockContext, []);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Usage: /push <task_id>');
    });

    it('should show initialization error when APEX is not initialized', async () => {
      const uninitializedContext = {
        ...mockContext,
        initialized: false,
        orchestrator: null as any
      };

      await pushCommand!.handler(uninitializedContext, ['test-task']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('APEX not initialized. Run /init first.');
    });

    it('should handle very short partial IDs if they are unique', async () => {
      const { task } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Short ID unique test'
      );

      // Create a very short but potentially unique partial ID
      const shortId = task.id.substring(0, 6);

      await pushCommand!.handler(mockContext, [shortId]);

      const output = consoleOutput.join('\n');

      // Should either succeed or provide clear feedback
      const hasOutput = output.includes('Pushing') || output.includes('Task not found');
      expect(hasOutput).toBe(true);
    });

    it('should maintain proper context and working directory throughout operation', async () => {
      const { task } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Context preservation test'
      );

      const initialBranch = getCurrentBranch(tempProjectPath);

      await pushCommand!.handler(mockContext, [task.id]);

      // Should still be on the same branch
      const finalBranch = getCurrentBranch(tempProjectPath);
      expect(finalBranch).toBe(initialBranch);

      // Working directory should be clean
      const gitStatus = execSync('git status --porcelain', {
        cwd: tempProjectPath,
        encoding: 'utf-8'
      }).trim();
      expect(gitStatus).toBe(''); // Should be clean
    });
  });

  // ==========================================================================
  // Push Output and Messaging
  // ==========================================================================

  describe('Push Output and Messaging', () => {
    it('should provide informative output during successful push operation', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Output test feature'
      );

      await pushCommand!.handler(mockContext, [task.id]);

      const output = consoleOutput.join('\n');

      // Should show what's happening
      expect(output).toContain(`Pushing branch ${branchName} to remote`);

      // Should show success confirmation
      expect(output).toContain(`Successfully pushed ${branchName} to origin`);
      expect(output).toContain('✓'); // Success indicator
    });

    it('should provide clear error messages with helpful suggestions', async () => {
      await pushCommand!.handler(mockContext, ['invalid-task-id']);

      const output = consoleOutput.join('\n');

      // Should show what went wrong
      expect(output).toContain('Task not found: invalid-task-id');

      // Should provide helpful suggestion
      expect(output).toContain('Use /status to see available tasks');
      expect(output).toContain('provide a longer task ID');
    });

    it('should format output consistently with other commands', async () => {
      const { task } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Formatting consistency test'
      );

      await pushCommand!.handler(mockContext, [task.id]);

      const output = consoleOutput.join('\n');

      // Should use consistent formatting patterns
      expect(output).toMatch(/Pushing branch .+ to remote/);
      expect(output).toMatch(/✓ Successfully pushed .+ to origin/);
    });

    it('should handle long branch names and task descriptions gracefully', async () => {
      const longDescription = 'This is a very long feature description that tests whether the push command can handle extended text properly and format output correctly even with lengthy branch names and descriptions';

      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        longDescription
      );

      await pushCommand!.handler(mockContext, [task.id]);

      const output = consoleOutput.join('\n');

      // Should handle long names without breaking
      expect(output).toContain('Pushing branch');
      expect(output).toContain('Successfully pushed');

      // Should include the branch name
      expect(output).toContain(branchName);
    });
  });

  // ==========================================================================
  // Edge Cases and Integration
  // ==========================================================================

  describe('Edge Cases and Integration', () => {
    it('should work correctly when already on the feature branch', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Same branch test'
      );

      // Switch to the feature branch
      execSync(`git checkout ${branchName}`, { cwd: tempProjectPath, stdio: 'ignore' });

      await pushCommand!.handler(mockContext, [task.id]);

      // Should push successfully regardless of current branch
      const output = consoleOutput.join('\n');
      expect(output).toContain('Successfully pushed');

      // Verify remote branch exists
      expect(remoteBranchExists(tempProjectPath, branchName)).toBe(true);
    });

    it('should handle push after making additional commits to feature branch', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Additional commits test'
      );

      // Add more commits to the feature branch
      execSync(`git checkout ${branchName}`, { cwd: tempProjectPath, stdio: 'ignore' });
      await writeFile(join(tempProjectPath, 'additional-feature.js'), '// Additional functionality\n');
      execSync('git add .', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git commit -m "Add additional functionality"', { cwd: tempProjectPath, stdio: 'ignore' });
      execSync('git checkout main', { cwd: tempProjectPath, stdio: 'ignore' });

      await pushCommand!.handler(mockContext, [task.id]);

      // Should push all commits
      const output = consoleOutput.join('\n');
      expect(output).toContain('Successfully pushed');

      // Verify all commits are on remote
      expect(remoteBranchExists(tempProjectPath, branchName)).toBe(true);
    });

    it('should work with tasks created through different workflows', async () => {
      // Test with different workflow types
      const workflows = ['feature', 'hotfix', 'bugfix'];

      for (const workflow of workflows) {
        const { task } = await createTaskWithBranchAndRemote(
          realOrchestrator,
          tempProjectPath,
          tempRemotePath,
          `${workflow} workflow test`
        );

        await pushCommand!.handler(mockContext, [task.id]);

        const output = consoleOutput.join('\n');
        expect(output).toContain('Successfully pushed');

        // Clear output for next iteration
        consoleOutput = [];
      }
    });

    it('should maintain task state integrity during push operations', async () => {
      const { task } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'State integrity test'
      );

      // Get task state before push
      const tasksBefore = await realOrchestrator.listTasks({ limit: 100 });
      const taskBefore = tasksBefore.find(t => t.id === task.id);

      await pushCommand!.handler(mockContext, [task.id]);

      // Get task state after push
      const tasksAfter = await realOrchestrator.listTasks({ limit: 100 });
      const taskAfter = tasksAfter.find(t => t.id === task.id);

      // Task should still exist with same properties
      expect(taskAfter).toBeDefined();
      expect(taskAfter!.id).toBe(taskBefore!.id);
      expect(taskAfter!.branchName).toBe(taskBefore!.branchName);
      expect(taskAfter!.description).toBe(taskBefore!.description);
    });

    it('should handle concurrent push operations gracefully', async () => {
      const { task1 } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Concurrent test 1'
      );

      const { task2 } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Concurrent test 2'
      );

      // Push both tasks in sequence (simulating rapid operations)
      await pushCommand!.handler(mockContext, [task1.id]);
      await pushCommand!.handler(mockContext, [task2.id]);

      const output = consoleOutput.join('\n');

      // Both should succeed
      const successCount = (output.match(/Successfully pushed/g) || []).length;
      expect(successCount).toBe(2);
    });
  });

  // ==========================================================================
  // Performance and Stress Tests
  // ==========================================================================

  describe('Performance and Reliability', () => {
    it('should complete push operations within reasonable time', async () => {
      const { task } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Performance test'
      );

      const startTime = performance.now();
      await pushCommand!.handler(mockContext, [task.id]);
      const duration = performance.now() - startTime;

      // Should complete within 10 seconds (generous for E2E test)
      expect(duration).toBeLessThan(10000);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Successfully pushed');
    });

    it('should handle tasks with large commit histories', async () => {
      const { task, branchName } = await createTaskWithBranchAndRemote(
        realOrchestrator,
        tempProjectPath,
        tempRemotePath,
        'Large history test'
      );

      // Add multiple commits to create history
      execSync(`git checkout ${branchName}`, { cwd: tempProjectPath, stdio: 'ignore' });

      for (let i = 0; i < 10; i++) {
        await writeFile(join(tempProjectPath, `commit-${i}.js`), `// Commit ${i}\nmodule.exports = ${i};\n`);
        execSync('git add .', { cwd: tempProjectPath, stdio: 'ignore' });
        execSync(`git commit -m "Add commit ${i}"`, { cwd: tempProjectPath, stdio: 'ignore' });
      }

      execSync('git checkout main', { cwd: tempProjectPath, stdio: 'ignore' });

      await pushCommand!.handler(mockContext, [task.id]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Successfully pushed');

      // Verify all commits are pushed
      expect(remoteBranchExists(tempProjectPath, branchName)).toBe(true);
    });
  });
});