/**
 * End-to-End Tests for APEX Merge Command
 *
 * This test suite verifies merge command functionality with real git operations:
 * - Standard merge with merge commits
 * - Squash merge with single commit
 * - Merge conflict detection and handling
 * - Merge after push sequence workflows
 * - Main branch update verification
 *
 * Uses real git repositories and orchestrator integration to ensure
 * merge operations work correctly in production scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator, type MergeTaskBranchResult } from '@apexcli/orchestrator';
import type { Task } from '@apexcli/core';

const execAsync = promisify(exec);

/**
 * Helper function to run git commands with better error handling
 */
async function runGit(args: string, cwd: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const result = await execAsync(`git ${args}`, {
      cwd,
      env: { ...process.env, GIT_EDITOR: 'true' }, // Prevent interactive editor prompts
      timeout: 30000,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      success: true,
    };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || '',
      success: false,
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
    // Disable git hooks for testing
    await runGit('config core.hooksPath /dev/null', repoPath);
  }
}

/**
 * Helper function to create a test task
 */
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'E2E test task for merge functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'completed',
    priority: 'normal',
    effort: 'medium',
    projectPath: '',
    branchName: `apex/test-merge-${Date.now()}`,
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
  name: merge-e2e-test-project
  language: typescript
  description: E2E test project for merge commands
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
  const [currentBranch, status, log, branches] = await Promise.all([
    runGit('rev-parse --abbrev-ref HEAD', repoPath),
    runGit('status --porcelain', repoPath),
    runGit('log --oneline -10', repoPath),
    runGit('branch -a', repoPath),
  ]);

  return {
    branch: currentBranch.stdout.trim(),
    isClean: status.stdout.trim() === '',
    status: status.stdout,
    recentCommits: log.stdout.trim().split('\n').filter(line => line.trim()),
    branches: branches.stdout.trim().split('\n').filter(line => line.trim()),
  };
}

/**
 * Helper to create a feature branch with test content
 */
async function createFeatureBranch(
  repoPath: string,
  branchName: string,
  fileName = 'feature.txt',
  content = 'Feature content'
): Promise<void> {
  await runGit(`checkout -b ${branchName}`, repoPath);
  await fs.writeFile(path.join(repoPath, fileName), `${content} for ${branchName}\n`);
  await runGit(`add ${fileName}`, repoPath);
  await runGit(`commit -m "feat: add ${fileName}"`, repoPath);
}

/**
 * Helper to simulate conflicting changes
 */
async function createConflictingBranches(repoPath: string, conflictFile = 'conflict.txt'): Promise<{
  featureBranch1: string;
  featureBranch2: string;
}> {
  // Create initial version of conflict file on main
  await fs.writeFile(path.join(repoPath, conflictFile), 'Original content\n');
  await runGit(`add ${conflictFile}`, repoPath);
  await runGit('commit -m "feat: add original conflict file"', repoPath);

  // Create first feature branch with changes
  const featureBranch1 = 'apex/feature-conflict-1';
  await runGit(`checkout -b ${featureBranch1}`, repoPath);
  await fs.writeFile(path.join(repoPath, conflictFile), 'Feature 1 content\nSome additional line\n');
  await runGit(`add ${conflictFile}`, repoPath);
  await runGit('commit -m "feat: update conflict file in feature-1"', repoPath);

  // Switch to main and create second feature branch
  await runGit('checkout main', repoPath);
  const featureBranch2 = 'apex/feature-conflict-2';
  await runGit(`checkout -b ${featureBranch2}`, repoPath);
  await fs.writeFile(path.join(repoPath, conflictFile), 'Feature 2 content\nDifferent additional line\n');
  await runGit(`add ${conflictFile}`, repoPath);
  await runGit('commit -m "feat: update conflict file in feature-2"', repoPath);

  // Return to main for merge testing
  await runGit('checkout main', repoPath);

  return { featureBranch1, featureBranch2 };
}

describe('E2E: Merge Command with Real Git Operations', () => {
  let testDir: string;
  let bareRepoDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-merge-e2e-'));
    bareRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-merge-bare-'));
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

  describe('Standard Merge Operations', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit on main
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project for Merge E2E\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should successfully perform standard merge with merge commit', async () => {
      // Create task and feature branch
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/standard-merge-test',
      });

      // Store task in orchestrator
      await orchestrator.store.createTask(task);

      // Create feature branch with changes
      await createFeatureBranch(testDir, task.branchName!, 'feature.js', 'console.log("Hello from feature");');

      // Add another commit to make merge history more realistic
      await fs.writeFile(path.join(testDir, 'utils.js'), 'export function helper() { return "utility"; }\n');
      await runGit('add utils.js', testDir);
      await runGit('commit -m "feat: add utility function"', testDir);

      // Switch back to main before merge
      await runGit('checkout main', testDir);

      // Verify initial state
      const preMergeState = await verifyGitState(testDir);
      expect(preMergeState.branch).toBe('main');
      expect(preMergeState.recentCommits).toHaveLength(1); // Only initial commit

      // Perform merge through orchestrator
      const mergeResult = await orchestrator.mergeTaskBranch(task.id, { squash: false });

      // Verify merge succeeded
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.error).toBeUndefined();
      expect(mergeResult.conflicted).toBeFalsy();
      expect(mergeResult.changedFiles).toEqual(expect.arrayContaining(['feature.js', 'utils.js']));

      // Verify git state after merge
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.branch).toBe('main');
      expect(postMergeState.isClean).toBe(true);
      expect(postMergeState.recentCommits.length).toBeGreaterThan(1);

      // Verify merge commit was created (contains "Merge")
      const mergeCommits = postMergeState.recentCommits.filter(commit => commit.includes('Merge'));
      expect(mergeCommits).toHaveLength(1);

      // Verify feature files are present
      const featureFileExists = await fs.access(path.join(testDir, 'feature.js')).then(() => true, () => false);
      const utilsFileExists = await fs.access(path.join(testDir, 'utils.js')).then(() => true, () => false);
      expect(featureFileExists).toBe(true);
      expect(utilsFileExists).toBe(true);

      // Verify feature branch still exists
      expect(postMergeState.branches.some(b => b.includes(task.branchName!))).toBe(true);
    });

    it('should successfully perform squash merge with single commit', async () => {
      // Create task and feature branch
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/squash-merge-test',
      });

      await orchestrator.store.createTask(task);

      // Create feature branch with multiple commits
      await createFeatureBranch(testDir, task.branchName!, 'feature1.js', 'console.log("Feature 1");');

      // Add more commits to demonstrate squashing
      await fs.writeFile(path.join(testDir, 'feature2.js'), 'console.log("Feature 2");\n');
      await runGit('add feature2.js', testDir);
      await runGit('commit -m "feat: add feature2"', testDir);

      await fs.writeFile(path.join(testDir, 'bugfix.js'), 'console.log("Bug fixed");\n');
      await runGit('add bugfix.js', testDir);
      await runGit('commit -m "fix: resolve critical bug"', testDir);

      // Switch back to main
      await runGit('checkout main', testDir);

      // Count commits on feature branch
      const featureBranchState = await runGit(`log ${task.branchName!} --oneline`, testDir);
      const featureCommits = featureBranchState.stdout.trim().split('\n').length;
      expect(featureCommits).toBeGreaterThan(2); // At least 3 commits (initial + 2 feature commits)

      // Perform squash merge
      const mergeResult = await orchestrator.mergeTaskBranch(task.id, { squash: true });

      // Verify squash merge succeeded
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.error).toBeUndefined();
      expect(mergeResult.changedFiles).toEqual(
        expect.arrayContaining(['feature1.js', 'feature2.js', 'bugfix.js'])
      );

      // Verify git state after squash merge
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.branch).toBe('main');
      expect(postMergeState.isClean).toBe(true);

      // Verify only one new commit was added (squash commit, no merge commit)
      expect(postMergeState.recentCommits).toHaveLength(2); // Initial commit + squash commit

      // Verify no merge commit was created
      const mergeCommits = postMergeState.recentCommits.filter(commit => commit.includes('Merge'));
      expect(mergeCommits).toHaveLength(0);

      // Verify all feature files are present
      const feature1Exists = await fs.access(path.join(testDir, 'feature1.js')).then(() => true, () => false);
      const feature2Exists = await fs.access(path.join(testDir, 'feature2.js')).then(() => true, () => false);
      const bugfixExists = await fs.access(path.join(testDir, 'bugfix.js')).then(() => true, () => false);

      expect(feature1Exists).toBe(true);
      expect(feature2Exists).toBe(true);
      expect(bugfixExists).toBe(true);
    });

    it('should update main branch correctly with proper commit history', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/history-test',
      });

      await orchestrator.store.createTask(task);

      // Create initial main branch state
      await fs.writeFile(path.join(testDir, 'main-file.js'), 'console.log("Main branch file");\n');
      await runGit('add main-file.js', testDir);
      await runGit('commit -m "feat: add main branch file"', testDir);

      // Create feature branch with changes
      await createFeatureBranch(testDir, task.branchName!, 'feature-file.js', 'console.log("Feature branch file");');

      // Switch back to main and add another commit
      await runGit('checkout main', testDir);
      await fs.writeFile(path.join(testDir, 'main-update.js'), 'console.log("Main update");\n');
      await runGit('add main-update.js', testDir);
      await runGit('commit -m "feat: update main branch"', testDir);

      // Record main branch state before merge
      const preMergeCommitCount = (await verifyGitState(testDir)).recentCommits.length;

      // Perform standard merge
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);

      expect(mergeResult.success).toBe(true);

      // Verify main branch is updated correctly
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.branch).toBe('main');

      // Should have more commits after merge
      expect(postMergeState.recentCommits.length).toBeGreaterThan(preMergeCommitCount);

      // Verify all files are present
      const mainFileExists = await fs.access(path.join(testDir, 'main-file.js')).then(() => true, () => false);
      const featureFileExists = await fs.access(path.join(testDir, 'feature-file.js')).then(() => true, () => false);
      const mainUpdateExists = await fs.access(path.join(testDir, 'main-update.js')).then(() => true, () => false);

      expect(mainFileExists).toBe(true);
      expect(featureFileExists).toBe(true);
      expect(mainUpdateExists).toBe(true);

      // Verify commit history contains all expected commits
      const commitMessages = postMergeState.recentCommits.join(' ');
      expect(commitMessages).toContain('main branch file');
      expect(commitMessages).toContain('feature-file.js');
      expect(commitMessages).toContain('update main');
    });
  });

  describe('Merge Conflict Detection and Handling', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Conflict Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should detect merge conflicts and handle gracefully', async () => {
      // Create conflicting branches
      const { featureBranch1, featureBranch2 } = await createConflictingBranches(testDir);

      // First, successfully merge feature-1
      const task1 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch1,
      });
      await orchestrator.store.createTask(task1);

      const merge1Result = await orchestrator.mergeTaskBranch(task1.id);
      expect(merge1Result.success).toBe(true);

      // Now try to merge feature-2, which should conflict
      const task2 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch2,
      });
      await orchestrator.store.createTask(task2);

      const merge2Result = await orchestrator.mergeTaskBranch(task2.id);

      // Verify conflict is detected and handled properly
      expect(merge2Result.success).toBe(false);
      expect(merge2Result.conflicted).toBe(true);
      expect(merge2Result.error).toBeDefined();
      expect(merge2Result.error).toMatch(/conflict|merge/i);

      // Verify git state shows we're still on main (merge was aborted)
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('main');
      expect(gitState.isClean).toBe(true); // Merge should be properly aborted
    });

    it('should handle conflicts in squash merge', async () => {
      // Create conflicting branches
      const { featureBranch1, featureBranch2 } = await createConflictingBranches(testDir);

      // Merge first branch with squash
      const task1 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch1,
      });
      await orchestrator.store.createTask(task1);

      const merge1Result = await orchestrator.mergeTaskBranch(task1.id, { squash: true });
      expect(merge1Result.success).toBe(true);

      // Try to squash merge conflicting branch
      const task2 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch2,
      });
      await orchestrator.store.createTask(task2);

      const merge2Result = await orchestrator.mergeTaskBranch(task2.id, { squash: true });

      // Verify conflict handling for squash merge
      expect(merge2Result.success).toBe(false);
      expect(merge2Result.conflicted).toBe(true);

      // Verify repository state is clean after failed merge attempt
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(true);
    });

    it('should properly abort merge on conflicts and maintain clean state', async () => {
      // Create complex conflicts with multiple files
      const { featureBranch1 } = await createConflictingBranches(testDir, 'conflict1.txt');

      // Create additional conflicting file
      await fs.writeFile(path.join(testDir, 'conflict2.txt'), 'Main branch content\n');
      await runGit('add conflict2.txt', testDir);
      await runGit('commit -m "feat: add second conflict file"', testDir);

      // Modify both files on feature branch
      await runGit(`checkout ${featureBranch1}`, testDir);
      await fs.writeFile(path.join(testDir, 'conflict2.txt'), 'Feature branch content\nAdditional feature line\n');
      await runGit('add conflict2.txt', testDir);
      await runGit('commit -m "feat: modify second conflict file"', testDir);

      await runGit('checkout main', testDir);

      // Merge the first branch to set up conflicts for subsequent merge
      const task1 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch1,
      });
      await orchestrator.store.createTask(task1);

      // This merge should succeed since there's no conflict yet
      const merge1Result = await orchestrator.mergeTaskBranch(task1.id);
      expect(merge1Result.success).toBe(true);

      // Create another conflicting branch
      await runGit('checkout -b apex/another-conflict', testDir);
      await fs.writeFile(path.join(testDir, 'conflict1.txt'), 'Different conflicting content\n');
      await runGit('add conflict1.txt', testDir);
      await runGit('commit -m "feat: create another conflict"', testDir);

      await runGit('checkout main', testDir);

      const task2 = createTestTask({
        projectPath: testDir,
        branchName: 'apex/another-conflict',
      });
      await orchestrator.store.createTask(task2);

      // This should detect conflicts
      const merge2Result = await orchestrator.mergeTaskBranch(task2.id);

      expect(merge2Result.success).toBe(false);
      expect(merge2Result.conflicted).toBe(true);

      // Verify clean abort - no staged files, no merge in progress
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(true);
      expect(gitState.branch).toBe('main');

      // Verify no merge head exists (merge fully aborted)
      const mergeHeadExists = await fs.access(path.join(testDir, '.git', 'MERGE_HEAD')).then(() => true, () => false);
      expect(mergeHeadExists).toBe(false);
    });
  });

  describe('Merge After Push Sequence', () => {
    beforeEach(async () => {
      // Setup bare remote repository
      await initGitRepo(bareRepoDir, true);

      // Setup local repository with remote
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create and push initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Remote Merge Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should handle merge after feature branch has been pushed to remote', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/remote-feature',
      });
      await orchestrator.store.createTask(task);

      // Create feature branch with changes
      await createFeatureBranch(testDir, task.branchName!, 'remote-feature.js', 'console.log("Remote feature");');

      // Push feature branch to remote
      const pushResult = await runGit(`push -u origin ${task.branchName}`, testDir);
      expect(pushResult.success).toBe(true);

      // Verify branch exists on remote
      const remoteBranches = await runGit('ls-remote --heads origin', testDir);
      expect(remoteBranches.stdout).toContain(task.branchName);

      // Switch back to main and perform merge
      await runGit('checkout main', testDir);

      const mergeResult = await orchestrator.mergeTaskBranch(task.id);

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.changedFiles).toContain('remote-feature.js');

      // Verify main branch has been updated locally
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('main');
      expect(gitState.isClean).toBe(true);

      // Verify feature file is present
      const featureFileExists = await fs.access(path.join(testDir, 'remote-feature.js')).then(() => true, () => false);
      expect(featureFileExists).toBe(true);

      // Verify that main can be pushed to remote (no conflicts)
      const pushMainResult = await runGit('push origin main', testDir);
      expect(pushMainResult.success).toBe(true);
    });

    it('should handle merge workflow including push to remote main', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/workflow-test',
      });
      await orchestrator.store.createTask(task);

      // Create feature branch and push it
      await createFeatureBranch(testDir, task.branchName!, 'workflow.js', 'console.log("Workflow test");');
      await runGit(`push -u origin ${task.branchName}`, testDir);

      // Make additional commit on main to simulate ongoing development
      await runGit('checkout main', testDir);
      await fs.writeFile(path.join(testDir, 'main-progress.js'), 'console.log("Main progress");\n');
      await runGit('add main-progress.js', testDir);
      await runGit('commit -m "feat: main branch progress"', testDir);
      await runGit('push origin main', testDir);

      // Perform merge
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);

      // Verify both files exist
      const workflowExists = await fs.access(path.join(testDir, 'workflow.js')).then(() => true, () => false);
      const progressExists = await fs.access(path.join(testDir, 'main-progress.js')).then(() => true, () => false);
      expect(workflowExists).toBe(true);
      expect(progressExists).toBe(true);

      // Complete the workflow by pushing merged main to remote
      const finalPushResult = await runGit('push origin main', testDir);
      expect(finalPushResult.success).toBe(true);

      // Verify remote state by fetching
      await runGit('fetch origin', testDir);
      const remoteStatus = await runGit('status -uno', testDir);
      expect(remoteStatus.stdout).toContain('up to date');
    });

    it('should handle squash merge in push workflow', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/squash-remote-test',
      });
      await orchestrator.store.createTask(task);

      // Create feature branch with multiple commits
      await createFeatureBranch(testDir, task.branchName!, 'feature1.js', 'console.log("Feature 1");');

      await fs.writeFile(path.join(testDir, 'feature2.js'), 'console.log("Feature 2");\n');
      await runGit('add feature2.js', testDir);
      await runGit('commit -m "feat: add feature2"', testDir);

      // Push feature branch
      await runGit(`push -u origin ${task.branchName}`, testDir);

      // Switch to main and perform squash merge
      await runGit('checkout main', testDir);

      const squashMergeResult = await orchestrator.mergeTaskBranch(task.id, { squash: true });

      expect(squashMergeResult.success).toBe(true);
      expect(squashMergeResult.changedFiles).toEqual(
        expect.arrayContaining(['feature1.js', 'feature2.js'])
      );

      // Verify only one commit was added (squash)
      const gitState = await verifyGitState(testDir);
      expect(gitState.recentCommits).toHaveLength(2); // Initial + squash commit

      // Push squashed main to remote
      const pushResult = await runGit('push origin main', testDir);
      expect(pushResult.success).toBe(true);
    });
  });

  describe('Error Cases and Edge Conditions', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Error Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should handle merge attempt when task has no branch', async () => {
      const taskWithoutBranch = createTestTask({
        projectPath: testDir,
        branchName: undefined, // No branch name
      });

      await orchestrator.store.createTask(taskWithoutBranch);

      const mergeResult = await orchestrator.mergeTaskBranch(taskWithoutBranch.id);

      expect(mergeResult.success).toBe(false);
      expect(mergeResult.error).toContain('does not have a branch');
    });

    it('should handle merge attempt with non-existent branch', async () => {
      const taskWithInvalidBranch = createTestTask({
        projectPath: testDir,
        branchName: 'apex/non-existent-branch',
      });

      await orchestrator.store.createTask(taskWithInvalidBranch);

      const mergeResult = await orchestrator.mergeTaskBranch(taskWithInvalidBranch.id);

      expect(mergeResult.success).toBe(false);
      expect(mergeResult.error).toBeDefined();
    });

    it('should handle merge from dirty working directory', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/clean-test',
      });
      await orchestrator.store.createTask(task);

      // Create and checkout feature branch
      await createFeatureBranch(testDir, task.branchName!, 'clean-test.js');

      // Switch to main and make uncommitted changes
      await runGit('checkout main', testDir);
      await fs.writeFile(path.join(testDir, 'dirty-file.js'), 'console.log("Uncommitted changes");\n');

      // Try to merge with dirty working directory
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);

      expect(mergeResult.success).toBe(false);
      expect(mergeResult.error).toBeDefined();
    });

    it('should handle merge with non-existent task ID', async () => {
      const mergeResult = await orchestrator.mergeTaskBranch('non-existent-task-id');

      expect(mergeResult.success).toBe(false);
      expect(mergeResult.error).toContain('Task not found');
    });

    it('should maintain git repository integrity after failed merges', async () => {
      // Create conflicting situation
      const { featureBranch1, featureBranch2 } = await createConflictingBranches(testDir);

      // Successfully merge first branch
      const task1 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch1,
      });
      await orchestrator.store.createTask(task1);
      const merge1 = await orchestrator.mergeTaskBranch(task1.id);
      expect(merge1.success).toBe(true);

      // Attempt to merge conflicting branch
      const task2 = createTestTask({
        projectPath: testDir,
        branchName: featureBranch2,
      });
      await orchestrator.store.createTask(task2);
      const merge2 = await orchestrator.mergeTaskBranch(task2.id);
      expect(merge2.success).toBe(false);

      // Verify repository integrity
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(true);
      expect(gitState.branch).toBe('main');

      // Should be able to perform other git operations
      const statusResult = await runGit('status', testDir);
      expect(statusResult.success).toBe(true);

      const logResult = await runGit('log --oneline -1', testDir);
      expect(logResult.success).toBe(true);
    });
  });
});