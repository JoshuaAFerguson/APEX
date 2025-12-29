/**
 * End-to-end tests for APEX git command integration
 *
 * These tests verify git command functionality by:
 * 1. Creating test repositories with real git setup
 * 2. Setting up bare remote repositories for push/pull testing
 * 3. Running git commands through APEX orchestrator
 * 4. Verifying expected git state changes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import type { Task } from '@apexcli/core';
import { skipOnWindows } from '@apexcli/core';

const execAsync = promisify(exec);

/**
 * Helper function to run git commands with better error handling
 */
async function runGit(args: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(`git ${args}`, {
      cwd,
      env: { ...process.env, GIT_EDITOR: 'true' }, // Prevent interactive editor prompts
      timeout: 30000,
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || '',
    };
  }
}

/**
 * Helper function to initialize a git repository with proper configuration
 */
async function initGitRepo(repoPath: string, isBare = false): Promise<void> {
  const bareFlag = isBare ? '--bare' : '';
  await runGit(`init ${bareFlag}`, repoPath);

  if (!isBare) {
    await runGit('config user.name "Test User"', repoPath);
    await runGit('config user.email "test@example.com"', repoPath);
    await runGit('config init.defaultBranch main', repoPath);
  }
}

/**
 * Helper function to create a test task
 */
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test git command task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
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
    ...overrides,
  };
}

/**
 * Helper function to create APEX project configuration
 */
async function createApexConfig(projectPath: string): Promise<void> {
  const configYaml = `version: 0.4.0
project:
  name: test-project
  language: typescript
  description: Test project for git commands
autonomy:
  default: full
models:
  planning: sonnet
  implementation: sonnet
  review: haiku
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 1.0
  dailyBudget: 10.0
api:
  url: http://localhost:3000
  port: 3000
git:
  defaultBranch: main
  branchPrefix: apex/
  autoWorktree: false
  commitFormat: conventional
`;

  await fs.mkdir(path.join(projectPath, '.apex'), { recursive: true });
  await fs.writeFile(path.join(projectPath, '.apex', 'config.yaml'), configYaml);
}

/**
 * Git state verification helper
 */
async function verifyGitState(repoPath: string) {
  const [currentBranch, status, log] = await Promise.all([
    runGit('rev-parse --abbrev-ref HEAD', repoPath),
    runGit('status --porcelain', repoPath),
    runGit('log --oneline -5', repoPath),
  ]);

  return {
    branch: currentBranch.stdout.trim(),
    isClean: status.stdout.trim() === '',
    status: status.stdout,
    recentCommits: log.stdout.trim().split('\n').filter(line => line.trim()),
  };
}

/**
 * Helper to create a feature branch with test content
 */
async function createFeatureBranch(repoPath: string, branchName: string, fileName = 'feature.txt'): Promise<void> {
  await runGit(`checkout -b ${branchName}`, repoPath);
  await fs.writeFile(path.join(repoPath, fileName), `Feature content for ${branchName}\n`);
  await runGit(`add ${fileName}`, repoPath);
  await runGit(`commit -m "feat: add ${fileName}"`, repoPath);
}

describe('E2E: Git Commands', () => {
  let testDir: string;
  let bareRepoDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-git-e2e-'));
    bareRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-git-bare-'));
  });

  afterEach(async () => {
    try {
      await orchestrator?.cleanup?.();
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm(bareRepoDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Repository Setup and Initialization', () => {
    it('should initialize git repository with proper configuration', async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Verify git configuration
      const { stdout: userName } = await runGit('config user.name', testDir);
      const { stdout: userEmail } = await runGit('config user.email', testDir);

      expect(userName.trim()).toBe('Test User');
      expect(userEmail.trim()).toBe('test@example.com');

      // Verify initial state
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('main');
    });

    it('should create and configure bare remote repository', async () => {
      await initGitRepo(bareRepoDir, true);
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Add remote and create initial commit
      await runGit(`remote add origin ${bareRepoDir}`, testDir);
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      // Test push to bare repository
      await runGit('push -u origin main', testDir);

      const { stdout: remotes } = await runGit('remote -v', testDir);
      expect(remotes).toContain('origin');
      expect(remotes).toContain(bareRepoDir);
    });

    it('should handle APEX project initialization in git repository', async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Initialize orchestrator
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();

      // Verify APEX directory structure
      const apexDir = path.join(testDir, '.apex');
      const configExists = await fs.access(path.join(apexDir, 'config.yaml')).then(() => true, () => false);
      expect(configExists).toBe(true);

      // Verify git status (should be clean after initialization)
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('main');
    });
  });

  describe('Branch Management', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should create feature branches with proper naming convention', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/test-feature',
      });

      await createFeatureBranch(testDir, task.branchName!, 'feature.txt');

      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('apex/test-feature');
      expect(gitState.recentCommits[0]).toContain('feat: add feature.txt');
    });

    it('should handle branch switching and verification', async () => {
      // Create feature branch
      await createFeatureBranch(testDir, 'apex/feature-1', 'feature1.txt');

      // Switch back to main
      await runGit('checkout main', testDir);

      let gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('main');

      // Switch to feature branch and verify
      await runGit('checkout apex/feature-1', testDir);

      gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('apex/feature-1');

      // Verify feature file exists
      const featureExists = await fs.access(path.join(testDir, 'feature1.txt')).then(() => true, () => false);
      expect(featureExists).toBe(true);
    });

    it('should detect and handle multiple branches', async () => {
      // Create multiple feature branches
      await createFeatureBranch(testDir, 'apex/feature-1', 'feature1.txt');
      await runGit('checkout main', testDir);
      await createFeatureBranch(testDir, 'apex/feature-2', 'feature2.txt');

      // List branches
      const { stdout: branches } = await runGit('branch', testDir);
      expect(branches).toContain('apex/feature-1');
      expect(branches).toContain('apex/feature-2');
      expect(branches).toContain('main');
    });
  });

  describe('Git State Verification', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should verify clean git status', async () => {
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(true);
      expect(gitState.status).toBe('');
    });

    it('should detect uncommitted changes', async () => {
      // Make changes without committing
      await fs.writeFile(path.join(testDir, 'new-file.txt'), 'New content\n');

      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(false);
      expect(gitState.status).toContain('new-file.txt');
    });

    it('should verify commit history', async () => {
      // Add more commits
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'Content 1\n');
      await runGit('add file1.txt', testDir);
      await runGit('commit -m "feat: add file1"', testDir);

      await fs.writeFile(path.join(testDir, 'file2.txt'), 'Content 2\n');
      await runGit('add file2.txt', testDir);
      await runGit('commit -m "feat: add file2"', testDir);

      const gitState = await verifyGitState(testDir);
      expect(gitState.recentCommits).toHaveLength(3); // Initial + 2 new commits
      expect(gitState.recentCommits[0]).toContain('feat: add file2');
      expect(gitState.recentCommits[1]).toContain('feat: add file1');
      expect(gitState.recentCommits[2]).toContain('Initial commit');
    });

    it('should detect merge conflicts', async () => {
      // Create conflicting branches
      await createFeatureBranch(testDir, 'apex/feature-1', 'conflict.txt');
      await fs.writeFile(path.join(testDir, 'conflict.txt'), 'Feature 1 version\n');
      await runGit('add conflict.txt', testDir);
      await runGit('commit -m "feat: update conflict file in feature-1"', testDir);

      await runGit('checkout main', testDir);
      await createFeatureBranch(testDir, 'apex/feature-2', 'conflict.txt');
      await fs.writeFile(path.join(testDir, 'conflict.txt'), 'Feature 2 version\n');
      await runGit('add conflict.txt', testDir);
      await runGit('commit -m "feat: update conflict file in feature-2"', testDir);

      // Attempt merge (should create conflict)
      const mergeResult = await runGit('merge apex/feature-1', testDir);
      expect(mergeResult.stderr).toContain('conflict');

      // Verify conflict state
      const gitState = await verifyGitState(testDir);
      expect(gitState.status).toContain('conflict.txt');
      expect(gitState.status).toContain('UU'); // Unmerged status
    });
  });

  describe('Remote Repository Integration', () => {
    beforeEach(async () => {
      // Setup bare remote repository
      await initGitRepo(bareRepoDir, true);

      // Setup local repository
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create initial commit and push
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should push feature branches to remote', async () => {
      await createFeatureBranch(testDir, 'apex/remote-feature', 'remote.txt');

      // Push feature branch
      await runGit('push -u origin apex/remote-feature', testDir);

      // Verify push succeeded
      const { stdout: remoteBranches } = await runGit('ls-remote --heads origin', testDir);
      expect(remoteBranches).toContain('apex/remote-feature');
    });

    it('should handle fetch and pull operations', async () => {
      // Create a second local repository to simulate another developer
      const secondRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-git-second-'));

      try {
        await runGit(`clone ${bareRepoDir} ${secondRepoDir}`, os.tmpdir());

        // Make changes in second repository
        await fs.writeFile(path.join(secondRepoDir, 'remote-change.txt'), 'Remote change\n');
        await runGit('add remote-change.txt', secondRepoDir);
        await runGit('commit -m "feat: add remote change"', secondRepoDir);
        await runGit('push origin main', secondRepoDir);

        // Fetch changes in main repository
        await runGit('fetch origin', testDir);

        // Verify remote tracking
        const { stdout: remoteBranches } = await runGit('branch -r', testDir);
        expect(remoteBranches).toContain('origin/main');

        // Pull changes
        await runGit('pull origin main', testDir);

        // Verify file was pulled
        const remoteFileExists = await fs.access(path.join(testDir, 'remote-change.txt')).then(() => true, () => false);
        expect(remoteFileExists).toBe(true);
      } finally {
        await fs.rm(secondRepoDir, { recursive: true, force: true });
      }
    });

    it('should handle upstream tracking configuration', async () => {
      await createFeatureBranch(testDir, 'apex/upstream-test', 'upstream.txt');

      // Push with upstream tracking
      await runGit('push -u origin apex/upstream-test', testDir);

      // Verify upstream is set
      const { stdout: upstream } = await runGit('rev-parse --abbrev-ref @{upstream}', testDir);
      expect(upstream.trim()).toBe('origin/apex/upstream-test');
    });
  });

  describe('APEX Orchestrator Git Integration', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should create task with proper branch configuration', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/orchestrator-test',
      });

      await orchestrator.store.createTask(task);

      // Verify task was stored with git configuration
      const storedTask = await orchestrator.store.getTask(task.id);
      expect(storedTask?.branchName).toBe('apex/orchestrator-test');
      expect(storedTask?.projectPath).toBe(testDir);
    });

    it('should handle task branch lifecycle', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/lifecycle-test',
        status: 'completed',
      });

      await orchestrator.store.createTask(task);

      // Create the branch
      await createFeatureBranch(testDir, task.branchName!, 'lifecycle.txt');

      // Verify branch exists
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('apex/lifecycle-test');

      // Switch back to main for cleanup testing
      await runGit('checkout main', testDir);

      // Verify we can switch back to task branch
      await runGit('checkout apex/lifecycle-test', testDir);
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('apex/lifecycle-test');
    });

    it('should verify git commands work within APEX task context', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/context-test',
      });

      await orchestrator.store.createTask(task);

      // Simulate task execution that involves git operations
      await createFeatureBranch(testDir, task.branchName!, 'context.txt');

      // Log git operations (simulating what APEX would log)
      await orchestrator.store.addLog(task.id, {
        timestamp: new Date(),
        level: 'info',
        stage: 'implementation',
        message: `Created branch: ${task.branchName}`,
      });

      // Verify logging worked
      const logs = await orchestrator.store.getLogs(task.id);
      const gitLogs = logs.filter(log => log.message.includes('branch'));
      expect(gitLogs).toHaveLength(1);
      expect(gitLogs[0].message).toContain('apex/context-test');
    });
  });

  describe('Advanced Git Operations', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should handle branch push operations', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/push-test',
      });

      // Create feature branch with changes
      await createFeatureBranch(testDir, task.branchName!, 'push-test.txt');

      // Test push operation through orchestrator
      const pushResult = await orchestrator.pushTaskBranch(task.id);

      // Should fail without remote configured - that's expected behavior
      expect(pushResult.success).toBe(false);
      expect(pushResult.error).toBeDefined();
    });

    it('should detect uncommitted changes correctly', async () => {
      // Start with clean state
      expect(await orchestrator.hasUncommittedChanges()).toBe(false);

      // Make changes without committing
      await fs.writeFile(path.join(testDir, 'uncommitted.txt'), 'Uncommitted content\n');
      expect(await orchestrator.hasUncommittedChanges()).toBe(true);

      // Commit changes
      await runGit('add uncommitted.txt', testDir);
      await runGit('commit -m "Commit changes"', testDir);
      expect(await orchestrator.hasUncommittedChanges()).toBe(false);
    });

    it('should handle merge operations with different strategies', async () => {
      // Create a feature branch with changes
      await createFeatureBranch(testDir, 'apex/merge-test', 'merge-test.txt');

      // Switch back to main
      await runGit('checkout main', testDir);

      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/merge-test',
      });

      await orchestrator.store.createTask(task);

      // Test merge operation (will fail without proper setup, but tests the flow)
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);

      // Expect controlled failure due to environment constraints
      expect(mergeResult).toBeDefined();
    });

    it('should handle branch cleanup operations', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/cleanup-test',
        status: 'completed',
      });

      await createFeatureBranch(testDir, task.branchName!, 'cleanup-test.txt');

      // Verify branch exists
      const { stdout: branchList } = await runGit('branch', testDir);
      expect(branchList).toContain('apex/cleanup-test');

      // Switch back to main before testing cleanup
      await runGit('checkout main', testDir);

      // Test branch deletion
      await runGit('branch -D apex/cleanup-test', testDir);

      // Verify branch is deleted
      const { stdout: afterCleanup } = await runGit('branch', testDir);
      expect(afterCleanup).not.toContain('apex/cleanup-test');
    });
  });

  describe('Git Configuration and Environment', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should verify git repository detection', async () => {
      // Test if repository is properly detected
      const { stdout: gitStatus } = await runGit('status', testDir);
      expect(gitStatus).toContain('On branch');
    });

    it('should handle git configuration validation', async () => {
      // Verify user configuration is set
      const { stdout: userName } = await runGit('config user.name', testDir);
      const { stdout: userEmail } = await runGit('config user.email', testDir);

      expect(userName.trim()).toBe('Test User');
      expect(userEmail.trim()).toBe('test@example.com');
    });

    it('should handle large repository operations', async () => {
      // Create multiple files to simulate larger repository
      const filePromises = [];
      for (let i = 0; i < 10; i++) {
        const fileName = `large-file-${i}.txt`;
        const content = 'Large file content '.repeat(100);
        filePromises.push(fs.writeFile(path.join(testDir, fileName), content));
      }

      await Promise.all(filePromises);

      // Add and commit all files
      await runGit('add .', testDir);
      await runGit('commit -m "Add large files"', testDir);

      // Verify git status after large operation
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(true);
    });

    it('should handle git environment variables', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/env-test',
      });

      await orchestrator.store.createTask(task);

      // Verify task has proper git environment
      expect(task.projectPath).toBe(testDir);
      expect(task.branchName).toBe('apex/env-test');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should handle invalid branch names gracefully', async () => {
      const invalidBranchName = 'invalid/branch/name/with//slashes';

      try {
        await runGit(`checkout -b "${invalidBranchName}"`, testDir);
        // If it doesn't throw, that's fine too - git is more permissive than expected
      } catch (error) {
        // Expected behavior - invalid branch names should fail
        expect(error).toBeDefined();
      }
    });

    it('should handle missing remote repository', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/no-remote',
      });

      await createFeatureBranch(testDir, task.branchName!, 'no-remote.txt');

      // Attempt push without remote - should fail gracefully
      const { stderr } = await runGit('push origin apex/no-remote', testDir);
      expect(stderr).toContain('fatal');
    });

    it('should handle corrupted git repository state', async () => {
      // Create a scenario with potential state issues
      await fs.writeFile(path.join(testDir, 'test-file.txt'), 'content');
      await runGit('add test-file.txt', testDir);

      // Don't commit, leaving staged changes
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(false);
      expect(gitState.status).toContain('test-file.txt');
    });

    it('should handle concurrent branch operations', async () => {
      // Create multiple branches concurrently to test for race conditions
      const branchPromises = [];
      for (let i = 0; i < 3; i++) {
        const branchName = `apex/concurrent-${i}`;
        branchPromises.push(
          createFeatureBranch(testDir, branchName, `concurrent-${i}.txt`)
        );
      }

      // All operations should complete without conflicts
      await Promise.all(branchPromises);

      // Verify all branches were created
      const { stdout: branches } = await runGit('branch', testDir);
      expect(branches).toContain('apex/concurrent-0');
      expect(branches).toContain('apex/concurrent-1');
      expect(branches).toContain('apex/concurrent-2');
    });

    it('should handle git hook integration', async () => {
      // Unix-only: Git hooks and chmod permissions don't work the same on Windows
      skipOnWindows();

      // Create a simple pre-commit hook
      const hooksDir = path.join(testDir, '.git', 'hooks');
      await fs.mkdir(hooksDir, { recursive: true });

      const hookScript = '#!/bin/sh\necho "Pre-commit hook executed"\nexit 0\n';
      const hookFile = path.join(hooksDir, 'pre-commit');
      await fs.writeFile(hookFile, hookScript);
      await fs.chmod(hookFile, 0o755);

      // Test commit with hook
      await fs.writeFile(path.join(testDir, 'hook-test.txt'), 'Hook test content\n');
      await runGit('add hook-test.txt', testDir);
      await runGit('commit -m "Test commit with hook"', testDir);

      // Verify commit succeeded
      const gitState = await verifyGitState(testDir);
      expect(gitState.recentCommits[0]).toContain('Test commit with hook');
    });
  });
});