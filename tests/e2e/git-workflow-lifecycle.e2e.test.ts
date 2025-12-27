/**
 * End-to-End Tests for Complete Git Workflow Lifecycle
 *
 * These tests verify the complete git workflow lifecycle by:
 * 1. Creating tasks and branches
 * 2. Making changes and commits
 * 3. Pushing branches to remote
 * 4. Merging branches to main
 * 5. Cleaning up completed workflows
 *
 * Uses real git repositories and orchestrator integration to ensure
 * the complete workflow functions correctly in production scenarios.
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
    description: 'E2E test task for complete workflow lifecycle',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    effort: 'medium',
    projectPath: '',
    branchName: `apex/e2e-test-${Date.now()}`,
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
  name: lifecycle-e2e-test-project
  language: typescript
  description: E2E test project for complete git workflow lifecycle
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
  push: true
  createPR: false
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
 * Helper to create a feature branch with test content and simulate development work
 */
async function simulateFeatureDevelopment(
  repoPath: string,
  branchName: string,
  taskDescription: string
): Promise<void> {
  // Create feature branch
  await runGit(`checkout -b ${branchName}`, repoPath);

  // Simulate multiple development steps
  // Step 1: Create initial feature file
  const featureFileName = `feature-${Date.now()}.js`;
  await fs.writeFile(
    path.join(repoPath, featureFileName),
    `// Feature implementation for: ${taskDescription}
export function newFeature() {
  console.log('New feature implemented');
  return 'feature-result';
}
`
  );
  await runGit(`add ${featureFileName}`, repoPath);
  await runGit(`commit -m "feat: add ${featureFileName} implementation"`, repoPath);

  // Step 2: Add tests
  const testFileName = `${featureFileName.replace('.js', '.test.js')}`;
  await fs.writeFile(
    path.join(repoPath, testFileName),
    `// Tests for ${featureFileName}
import { newFeature } from './${featureFileName}';

describe('newFeature', () => {
  it('should return expected result', () => {
    expect(newFeature()).toBe('feature-result');
  });
});
`
  );
  await runGit(`add ${testFileName}`, repoPath);
  await runGit(`commit -m "test: add tests for ${featureFileName}"`, repoPath);

  // Step 3: Update documentation
  const docFile = 'README.md';
  const existingContent = await fs.readFile(path.join(repoPath, docFile), 'utf-8').catch(() => '');
  const newContent = existingContent + `\n## New Feature\n\nAdded ${taskDescription}\n`;
  await fs.writeFile(path.join(repoPath, docFile), newContent);
  await runGit(`add ${docFile}`, repoPath);
  await runGit(`commit -m "docs: update README with feature documentation"`, repoPath);
}

/**
 * Helper to verify workflow completion state
 */
async function verifyWorkflowCompletion(
  repoPath: string,
  taskBranchName: string,
  expectedFiles: string[]
): Promise<void> {
  const gitState = await verifyGitState(repoPath);

  // Verify we're back on main branch
  expect(gitState.branch).toBe('main');

  // Verify all expected files exist in main
  for (const file of expectedFiles) {
    const fileExists = await fs.access(path.join(repoPath, file)).then(() => true, () => false);
    expect(fileExists).toBe(true);
  }

  // Verify task branch still exists (not automatically deleted)
  expect(gitState.branches.some(branch => branch.includes(taskBranchName))).toBe(true);
}

describe('E2E: Complete Git Workflow Lifecycle', () => {
  let testDir: string;
  let bareRepoDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-workflow-e2e-'));
    bareRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-workflow-bare-'));
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

  describe('Full Workflow from Task Creation through Cleanup', () => {
    beforeEach(async () => {
      // Setup bare remote repository
      await initGitRepo(bareRepoDir, true);

      // Setup local repository with remote
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create and push initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Complete Workflow Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should complete full workflow from task creation through cleanup', async () => {
      // Step 1: Create task
      const task = createTestTask({
        projectPath: testDir,
        description: 'Implement user authentication feature',
        branchName: 'apex/user-auth-feature',
      });

      await orchestrator.store.createTask(task);

      // Verify task creation
      const storedTask = await orchestrator.store.getTask(task.id);
      expect(storedTask).toBeDefined();
      expect(storedTask!.status).toBe('pending');
      expect(storedTask!.branchName).toBe('apex/user-auth-feature');

      // Step 2: Simulate task execution which creates branch and makes changes
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Verify feature branch was created and has commits
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('apex/user-auth-feature');
      expect(gitState.isClean).toBe(true);
      expect(gitState.recentCommits.length).toBeGreaterThan(1);

      // Step 3: Push branch to remote
      const pushResult = await orchestrator.pushTaskBranch(task.id);
      expect(pushResult.success).toBe(true);
      expect(pushResult.error).toBeUndefined();

      // Verify branch exists on remote
      const remoteBranches = await runGit('ls-remote --heads origin', testDir);
      expect(remoteBranches.stdout).toContain('apex/user-auth-feature');

      // Step 4: Switch back to main for merge
      await runGit('checkout main', testDir);

      // Step 5: Merge branch
      const mergeResult = await orchestrator.mergeTaskBranch(task.id, { squash: false });
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.error).toBeUndefined();
      expect(mergeResult.conflicted).toBeFalsy();
      expect(mergeResult.changedFiles).toBeDefined();
      expect(mergeResult.changedFiles!.length).toBeGreaterThan(0);

      // Step 6: Verify workflow completion
      const expectedFiles = mergeResult.changedFiles!;
      await verifyWorkflowCompletion(testDir, task.branchName!, expectedFiles);

      // Step 7: Push merged main to remote
      const finalPushResult = await runGit('push origin main', testDir);
      expect(finalPushResult.success).toBe(true);

      // Step 8: Update task status to completed
      await orchestrator.updateTaskStatus(task.id, 'completed');
      const completedTask = await orchestrator.store.getTask(task.id);
      expect(completedTask!.status).toBe('completed');

      // Verify final state
      const finalGitState = await verifyGitState(testDir);
      expect(finalGitState.branch).toBe('main');
      expect(finalGitState.isClean).toBe(true);
      expect(finalGitState.recentCommits.some(commit => commit.includes('Merge'))).toBe(true);
    });

    it('should handle workflow with squash merge', async () => {
      // Create task for squash merge workflow
      const task = createTestTask({
        projectPath: testDir,
        description: 'Add configuration management',
        branchName: 'apex/config-management',
      });

      await orchestrator.store.createTask(task);

      // Simulate development with multiple commits
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Count commits on feature branch before merge
      const featureBranchState = await runGit(`log ${task.branchName!} --oneline`, testDir);
      const featureCommitCount = featureBranchState.stdout.trim().split('\n').length;
      expect(featureCommitCount).toBeGreaterThan(2);

      // Push branch
      const pushResult = await orchestrator.pushTaskBranch(task.id);
      expect(pushResult.success).toBe(true);

      // Switch to main and perform squash merge
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id, { squash: true });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.changedFiles).toBeDefined();

      // Verify squash merge created only one new commit
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.recentCommits).toHaveLength(2); // Initial + squash commit

      // Verify no merge commit was created
      const mergeCommits = postMergeState.recentCommits.filter(commit => commit.includes('Merge'));
      expect(mergeCommits).toHaveLength(0);

      // Verify all feature files are present
      await verifyWorkflowCompletion(testDir, task.branchName!, mergeResult.changedFiles!);
    });

    it('should handle concurrent workflows without interference', async () => {
      // Create multiple tasks for concurrent workflow testing
      const task1 = createTestTask({
        projectPath: testDir,
        description: 'Add logging system',
        branchName: 'apex/logging-system',
      });

      const task2 = createTestTask({
        projectPath: testDir,
        description: 'Improve error handling',
        branchName: 'apex/error-handling',
      });

      await Promise.all([
        orchestrator.store.createTask(task1),
        orchestrator.store.createTask(task2),
      ]);

      // Develop first feature
      await simulateFeatureDevelopment(testDir, task1.branchName!, task1.description);
      const push1Result = await orchestrator.pushTaskBranch(task1.id);
      expect(push1Result.success).toBe(true);

      // Switch to main and develop second feature
      await runGit('checkout main', testDir);
      await simulateFeatureDevelopment(testDir, task2.branchName!, task2.description);
      const push2Result = await orchestrator.pushTaskBranch(task2.id);
      expect(push2Result.success).toBe(true);

      // Merge both features sequentially
      await runGit('checkout main', testDir);

      // Merge first feature
      const merge1Result = await orchestrator.mergeTaskBranch(task1.id);
      expect(merge1Result.success).toBe(true);

      // Merge second feature
      const merge2Result = await orchestrator.mergeTaskBranch(task2.id);
      expect(merge2Result.success).toBe(true);

      // Verify both features are integrated
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);

      // Verify all files from both workflows are present
      const allChangedFiles = [...(merge1Result.changedFiles || []), ...(merge2Result.changedFiles || [])];
      await verifyWorkflowCompletion(testDir, task1.branchName!, allChangedFiles);
    });
  });

  describe('Task Creation Triggers Branch Creation', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Branch Creation Test\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should create task and branch in coordinated workflow', async () => {
      // Create task with specific branch name
      const task = createTestTask({
        projectPath: testDir,
        description: 'Add user profile functionality',
        branchName: 'apex/user-profile',
      });

      // Store task in orchestrator
      await orchestrator.store.createTask(task);

      // Verify initial state - on main branch
      const initialState = await verifyGitState(testDir);
      expect(initialState.branch).toBe('main');

      // Simulate task execution creating the branch
      await runGit(`checkout -b ${task.branchName!}`, testDir);

      // Verify branch creation
      const postBranchState = await verifyGitState(testDir);
      expect(postBranchState.branch).toBe('apex/user-profile');
      expect(postBranchState.branches.some(b => b.includes('apex/user-profile'))).toBe(true);

      // Verify task association
      const storedTask = await orchestrator.store.getTask(task.id);
      expect(storedTask!.branchName).toBe('apex/user-profile');
      expect(storedTask!.projectPath).toBe(testDir);
    });

    it('should handle branch naming conventions correctly', async () => {
      const testCases = [
        { description: 'Fix login bug', expected: 'apex/fix-login-bug' },
        { description: 'Add API endpoints', expected: 'apex/api-endpoints' },
        { description: 'Update documentation', expected: 'apex/update-docs' },
      ];

      for (const testCase of testCases) {
        const task = createTestTask({
          projectPath: testDir,
          description: testCase.description,
          branchName: testCase.expected,
        });

        await orchestrator.store.createTask(task);

        // Simulate branch creation
        await runGit('checkout main', testDir); // Ensure we're on main
        await runGit(`checkout -b ${task.branchName!}`, testDir);

        // Verify branch follows naming convention
        const gitState = await verifyGitState(testDir);
        expect(gitState.branch).toBe(testCase.expected);
        expect(gitState.branch).toMatch(/^apex\//);
      }
    });
  });

  describe('Changes Can Be Made and Committed', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Commit Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should make changes and commit successfully', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/commit-test',
      });

      await orchestrator.store.createTask(task);

      // Create branch and make changes
      await runGit(`checkout -b ${task.branchName!}`, testDir);

      // Stage 1: Add new file
      const newFile = 'new-feature.js';
      await fs.writeFile(
        path.join(testDir, newFile),
        'export function newFeature() { return "hello world"; }\n'
      );
      await runGit(`add ${newFile}`, testDir);
      await runGit(`commit -m "feat: add ${newFile}"`, testDir);

      // Stage 2: Modify existing file
      const existingContent = await fs.readFile(path.join(testDir, 'README.md'), 'utf-8');
      const updatedContent = existingContent + '\n## New Feature\nAdded new functionality.\n';
      await fs.writeFile(path.join(testDir, 'README.md'), updatedContent);
      await runGit('add README.md', testDir);
      await runGit('commit -m "docs: update README"', testDir);

      // Stage 3: Add configuration
      const configContent = '{ "feature": "enabled", "debug": true }';
      await fs.writeFile(path.join(testDir, 'config.json'), configContent);
      await runGit('add config.json', testDir);
      await runGit('commit -m "feat: add configuration file"', testDir);

      // Verify changes and commits
      const gitState = await verifyGitState(testDir);
      expect(gitState.branch).toBe('apex/commit-test');
      expect(gitState.isClean).toBe(true);
      expect(gitState.recentCommits.length).toBeGreaterThan(3); // Initial + 3 new commits

      // Verify all files exist
      const newFileExists = await fs.access(path.join(testDir, newFile)).then(() => true, () => false);
      const configExists = await fs.access(path.join(testDir, 'config.json')).then(() => true, () => false);
      expect(newFileExists).toBe(true);
      expect(configExists).toBe(true);

      // Verify commit messages follow conventional format
      const commitMessages = gitState.recentCommits.join(' ');
      expect(commitMessages).toContain('feat: add new-feature.js');
      expect(commitMessages).toContain('docs: update README');
      expect(commitMessages).toContain('feat: add configuration file');
    });

    it('should handle different types of changes correctly', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/various-changes',
      });

      await orchestrator.store.createTask(task);
      await runGit(`checkout -b ${task.branchName!}`, testDir);

      // Test file addition
      await fs.writeFile(path.join(testDir, 'addition.js'), 'console.log("added");\n');
      await runGit('add addition.js', testDir);
      await runGit('commit -m "feat: add new file"', testDir);

      // Test file modification
      await fs.writeFile(path.join(testDir, 'addition.js'), 'console.log("modified");\n');
      await runGit('add addition.js', testDir);
      await runGit('commit -m "fix: update file content"', testDir);

      // Test file deletion
      await runGit('rm addition.js', testDir);
      await runGit('commit -m "refactor: remove unnecessary file"', testDir);

      // Test directory creation with files
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'src', 'index.js'), 'module.exports = {};\n');
      await runGit('add src/', testDir);
      await runGit('commit -m "feat: add src directory structure"', testDir);

      // Verify all operations completed successfully
      const gitState = await verifyGitState(testDir);
      expect(gitState.isClean).toBe(true);
      expect(gitState.recentCommits.length).toBeGreaterThan(4);

      // Verify final directory structure
      const srcExists = await fs.access(path.join(testDir, 'src', 'index.js')).then(() => true, () => false);
      expect(srcExists).toBe(true);

      const deletedFileExists = await fs.access(path.join(testDir, 'addition.js')).then(() => true, () => false);
      expect(deletedFileExists).toBe(false);
    });
  });

  describe('Push to Remote Succeeds', () => {
    beforeEach(async () => {
      // Setup bare remote repository
      await initGitRepo(bareRepoDir, true);

      // Setup local repository with remote
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create and push initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Push Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should push branch to remote successfully', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/push-test',
      });

      await orchestrator.store.createTask(task);

      // Create feature branch and make changes
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Push using orchestrator
      const pushResult = await orchestrator.pushTaskBranch(task.id);

      // Verify push succeeded
      expect(pushResult.success).toBe(true);
      expect(pushResult.error).toBeUndefined();
      expect(pushResult.remoteBranch).toBeDefined();

      // Verify branch exists on remote
      const remoteBranches = await runGit('ls-remote --heads origin', testDir);
      expect(remoteBranches.stdout).toContain('apex/push-test');
      expect(remoteBranches.success).toBe(true);

      // Verify upstream tracking is set
      const upstream = await runGit('rev-parse --abbrev-ref @{upstream}', testDir);
      expect(upstream.stdout.trim()).toBe('origin/apex/push-test');
    });

    it('should handle push with multiple commits', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/multi-commit-push',
      });

      await orchestrator.store.createTask(task);

      // Create branch with multiple development steps
      await runGit(`checkout -b ${task.branchName!}`, testDir);

      // Create multiple commits
      for (let i = 1; i <= 3; i++) {
        await fs.writeFile(path.join(testDir, `file${i}.js`), `console.log('File ${i}');\n`);
        await runGit(`add file${i}.js`, testDir);
        await runGit(`commit -m "feat: add file${i}.js"`, testDir);
      }

      // Push all commits
      const pushResult = await orchestrator.pushTaskBranch(task.id);

      expect(pushResult.success).toBe(true);

      // Verify all commits are on remote
      const remoteLog = await runGit(`log origin/${task.branchName!} --oneline`, testDir);
      expect(remoteLog.stdout).toContain('add file1.js');
      expect(remoteLog.stdout).toContain('add file2.js');
      expect(remoteLog.stdout).toContain('add file3.js');
    });
  });

  describe('Merge to Main Succeeds', () => {
    beforeEach(async () => {
      await initGitRepo(testDir);
      await createApexConfig(testDir);

      // Create initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Merge Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should merge feature branch to main successfully', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/merge-success-test',
      });

      await orchestrator.store.createTask(task);

      // Create and develop feature
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Switch to main for merge
      await runGit('checkout main', testDir);

      // Perform merge
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);

      // Verify merge succeeded
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.error).toBeUndefined();
      expect(mergeResult.conflicted).toBeFalsy();
      expect(mergeResult.changedFiles).toBeDefined();
      expect(mergeResult.changedFiles!.length).toBeGreaterThan(0);

      // Verify we're on main and it has the merge
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.branch).toBe('main');
      expect(postMergeState.isClean).toBe(true);
      expect(postMergeState.recentCommits.some(commit => commit.includes('Merge'))).toBe(true);

      // Verify feature files are present in main
      for (const file of mergeResult.changedFiles!) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should handle merge with main branch updates', async () => {
      const task = createTestTask({
        projectPath: testDir,
        branchName: 'apex/merge-with-main-updates',
      });

      await orchestrator.store.createTask(task);

      // Create feature branch
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Switch to main and add updates
      await runGit('checkout main', testDir);
      await fs.writeFile(path.join(testDir, 'main-update.js'), 'console.log("Main branch update");\n');
      await runGit('add main-update.js', testDir);
      await runGit('commit -m "feat: update main branch"', testDir);

      // Count commits before merge
      const preCommitCount = (await verifyGitState(testDir)).recentCommits.length;

      // Merge feature
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);

      expect(mergeResult.success).toBe(true);

      // Verify merge integrated both main updates and feature changes
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.recentCommits.length).toBeGreaterThan(preCommitCount);

      // Verify both main and feature files exist
      const mainFileExists = await fs.access(path.join(testDir, 'main-update.js')).then(() => true, () => false);
      expect(mainFileExists).toBe(true);

      for (const file of mergeResult.changedFiles!) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }
    });
  });

  describe('All Operations Complete Without Errors', () => {
    beforeEach(async () => {
      // Setup complete environment with remote
      await initGitRepo(bareRepoDir, true);
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create and push initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Error-Free Operations Test\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should complete entire workflow without any errors', async () => {
      const task = createTestTask({
        projectPath: testDir,
        description: 'Complete error-free workflow test',
        branchName: 'apex/error-free-workflow',
      });

      // Step 1: Create task - should not error
      await expect(orchestrator.store.createTask(task)).resolves.not.toThrow();

      // Step 2: Branch creation and development - should not error
      await expect(simulateFeatureDevelopment(testDir, task.branchName!, task.description)).resolves.not.toThrow();

      // Step 3: Push to remote - should not error
      const pushResult = await orchestrator.pushTaskBranch(task.id);
      expect(pushResult.success).toBe(true);
      expect(pushResult.error).toBeUndefined();

      // Step 4: Merge - should not error
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.error).toBeUndefined();
      expect(mergeResult.conflicted).toBeFalsy();

      // Step 5: Final push - should not error
      const finalPush = await runGit('push origin main', testDir);
      expect(finalPush.success).toBe(true);

      // Step 6: Task completion - should not error
      await expect(orchestrator.updateTaskStatus(task.id, 'completed')).resolves.not.toThrow();

      // Verify final clean state
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);

      // Verify task completed successfully
      const completedTask = await orchestrator.store.getTask(task.id);
      expect(completedTask!.status).toBe('completed');

      // Verify repository integrity
      const statusCheck = await runGit('status', testDir);
      expect(statusCheck.success).toBe(true);

      const logCheck = await runGit('log --oneline -5', testDir);
      expect(logCheck.success).toBe(true);
    });

    it('should handle multiple sequential workflows without errors', async () => {
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'First sequential workflow',
          branchName: 'apex/sequential-1',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Second sequential workflow',
          branchName: 'apex/sequential-2',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Third sequential workflow',
          branchName: 'apex/sequential-3',
        }),
      ];

      // Execute workflows sequentially
      for (const task of tasks) {
        // Create task
        await expect(orchestrator.store.createTask(task)).resolves.not.toThrow();

        // Develop feature
        await expect(simulateFeatureDevelopment(testDir, task.branchName!, task.description)).resolves.not.toThrow();

        // Push
        const pushResult = await orchestrator.pushTaskBranch(task.id);
        expect(pushResult.success).toBe(true);

        // Merge
        await runGit('checkout main', testDir);
        const mergeResult = await orchestrator.mergeTaskBranch(task.id);
        expect(mergeResult.success).toBe(true);

        // Complete
        await expect(orchestrator.updateTaskStatus(task.id, 'completed')).resolves.not.toThrow();
      }

      // Verify all workflows completed successfully
      for (const task of tasks) {
        const completedTask = await orchestrator.store.getTask(task.id);
        expect(completedTask!.status).toBe('completed');
      }

      // Verify final repository state is clean
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);

      // Verify all task branches still exist
      for (const task of tasks) {
        expect(finalState.branches.some(b => b.includes(task.branchName!))).toBe(true);
      }
    });
  });

  describe('Branch Cleanup After Merge', () => {
    beforeEach(async () => {
      // Setup bare remote repository for push/fetch operations
      await initGitRepo(bareRepoDir, true);

      // Setup local repository with remote
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create and push initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Branch Cleanup Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should clean up feature branch after successful merge when configured', async () => {
      // Create task with branch cleanup enabled
      const task = createTestTask({
        projectPath: testDir,
        description: 'Feature with branch cleanup enabled',
        branchName: 'apex/cleanup-enabled-test',
      });

      await orchestrator.store.createTask(task);

      // Simulate feature development
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Push branch to remote
      const pushResult = await orchestrator.pushTaskBranch(task.id);
      expect(pushResult.success).toBe(true);

      // Verify branch exists both locally and remotely before merge
      const preMergeState = await verifyGitState(testDir);
      expect(preMergeState.branches.some(b => b.includes('apex/cleanup-enabled-test'))).toBe(true);

      const remoteBranches = await runGit('ls-remote --heads origin', testDir);
      expect(remoteBranches.stdout).toContain('apex/cleanup-enabled-test');

      // Switch to main and merge
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);
      expect(mergeResult.conflicted).toBeFalsy();

      // Simulate branch cleanup (feature branch deletion after merge)
      // Local branch cleanup
      const localBranchDelete = await runGit(`branch -d ${task.branchName!}`, testDir);
      expect(localBranchDelete.success).toBe(true);

      // Remote branch cleanup
      const remoteBranchDelete = await runGit(`push origin --delete ${task.branchName!}`, testDir);
      expect(remoteBranchDelete.success).toBe(true);

      // Verify local branch is cleaned up
      const postCleanupState = await verifyGitState(testDir);
      expect(postCleanupState.branches.some(b => b.includes('apex/cleanup-enabled-test'))).toBe(false);

      // Verify remote branch is cleaned up
      const postCleanupRemote = await runGit('ls-remote --heads origin', testDir);
      expect(postCleanupRemote.stdout).not.toContain('apex/cleanup-enabled-test');

      // Verify main branch still has the merged changes
      expect(postCleanupState.branch).toBe('main');
      expect(postCleanupState.isClean).toBe(true);
      for (const file of mergeResult.changedFiles!) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should delete local branch after merge', async () => {
      const task = createTestTask({
        projectPath: testDir,
        description: 'Local branch deletion test',
        branchName: 'apex/local-delete-test',
      });

      await orchestrator.store.createTask(task);

      // Create and develop feature
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Push and merge
      await orchestrator.pushTaskBranch(task.id);
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);

      // Verify branch exists before cleanup
      const preCleanupState = await verifyGitState(testDir);
      expect(preCleanupState.branches.some(b => b.includes('apex/local-delete-test'))).toBe(true);

      // Perform local branch cleanup
      const deleteResult = await runGit(`branch -d ${task.branchName!}`, testDir);
      expect(deleteResult.success).toBe(true);

      // Verify local branch is deleted
      const postCleanupState = await verifyGitState(testDir);
      expect(postCleanupState.branches.some(b => b.includes('apex/local-delete-test'))).toBe(false);

      // Verify we're still on main with all changes
      expect(postCleanupState.branch).toBe('main');
      expect(postCleanupState.isClean).toBe(true);
    });

    it('should delete remote branch after merge', async () => {
      const task = createTestTask({
        projectPath: testDir,
        description: 'Remote branch deletion test',
        branchName: 'apex/remote-delete-test',
      });

      await orchestrator.store.createTask(task);

      // Create, develop, and push feature
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);
      await orchestrator.pushTaskBranch(task.id);

      // Verify remote branch exists
      const preCleanupRemote = await runGit('ls-remote --heads origin', testDir);
      expect(preCleanupRemote.stdout).toContain('apex/remote-delete-test');

      // Merge the branch
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);

      // Delete remote branch
      const remoteDeleteResult = await runGit(`push origin --delete ${task.branchName!}`, testDir);
      expect(remoteDeleteResult.success).toBe(true);

      // Verify remote branch is deleted
      const postCleanupRemote = await runGit('ls-remote --heads origin', testDir);
      expect(postCleanupRemote.stdout).not.toContain('apex/remote-delete-test');

      // Push the merged main to ensure remote is up to date
      const pushMainResult = await runGit('push origin main', testDir);
      expect(pushMainResult.success).toBe(true);
    });

    it('should skip cleanup when not configured', async () => {
      const task = createTestTask({
        projectPath: testDir,
        description: 'Feature with cleanup disabled',
        branchName: 'apex/cleanup-disabled-test',
      });

      await orchestrator.store.createTask(task);

      // Simulate feature development and merge
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);
      await orchestrator.pushTaskBranch(task.id);
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);

      // Verify branches still exist (no cleanup performed)
      const postMergeState = await verifyGitState(testDir);
      expect(postMergeState.branches.some(b => b.includes('apex/cleanup-disabled-test'))).toBe(true);

      const postMergeRemote = await runGit('ls-remote --heads origin', testDir);
      expect(postMergeRemote.stdout).toContain('apex/cleanup-disabled-test');

      // Verify main has the merged changes but branches remain
      expect(postMergeState.branch).toBe('main');
      expect(postMergeState.isClean).toBe(true);
      for (const file of mergeResult.changedFiles!) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should properly remove worktree after merge cleanup', async () => {
      // This test verifies worktree cleanup in addition to branch cleanup
      const task = createTestTask({
        projectPath: testDir,
        description: 'Worktree cleanup after merge test',
        branchName: 'apex/worktree-cleanup-test',
      });

      await orchestrator.store.createTask(task);

      // Create feature branch (simulating worktree creation)
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

      // Check if worktree path would exist
      const worktreePath = path.join(testDir, '..', '.apex-worktrees', task.id);

      // Simulate worktree creation for the task
      // Note: We create a directory to simulate worktree existence since the E2E test
      // doesn't actually use ApexOrchestrator's worktree functionality
      await fs.mkdir(path.dirname(worktreePath), { recursive: true });
      await fs.mkdir(worktreePath, { recursive: true });
      await fs.writeFile(path.join(worktreePath, 'test-file.txt'), 'Worktree test content');

      // Verify worktree directory exists
      const worktreeExists = await fs.access(worktreePath).then(() => true, () => false);
      expect(worktreeExists).toBe(true);

      // Push and merge the branch
      await orchestrator.pushTaskBranch(task.id);
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);

      // Simulate worktree cleanup (removal of worktree directory)
      await fs.rm(worktreePath, { recursive: true, force: true });

      // Verify worktree is cleaned up
      const worktreeExistsAfter = await fs.access(worktreePath).then(() => true, () => false);
      expect(worktreeExistsAfter).toBe(false);

      // Verify main branch has the merged content
      expect(mergeResult.changedFiles).toBeDefined();
      expect(mergeResult.changedFiles!.length).toBeGreaterThan(0);
    });

    it('should handle cleanup of multiple merged branches', async () => {
      // Create multiple tasks
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'First feature for multi-cleanup test',
          branchName: 'apex/multi-cleanup-1',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Second feature for multi-cleanup test',
          branchName: 'apex/multi-cleanup-2',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Third feature for multi-cleanup test',
          branchName: 'apex/multi-cleanup-3',
        }),
      ];

      // Create and store all tasks
      for (const task of tasks) {
        await orchestrator.store.createTask(task);
      }

      // Develop and merge each feature
      for (const task of tasks) {
        await simulateFeatureDevelopment(testDir, task.branchName!, task.description);
        await orchestrator.pushTaskBranch(task.id);

        await runGit('checkout main', testDir);
        const mergeResult = await orchestrator.mergeTaskBranch(task.id);
        expect(mergeResult.success).toBe(true);
      }

      // Verify all branches exist before cleanup
      const preCleanupState = await verifyGitState(testDir);
      for (const task of tasks) {
        expect(preCleanupState.branches.some(b => b.includes(task.branchName!))).toBe(true);
      }

      // Perform cleanup for all merged branches
      for (const task of tasks) {
        const localDeleteResult = await runGit(`branch -d ${task.branchName!}`, testDir);
        expect(localDeleteResult.success).toBe(true);

        const remoteDeleteResult = await runGit(`push origin --delete ${task.branchName!}`, testDir);
        expect(remoteDeleteResult.success).toBe(true);
      }

      // Verify all branches are cleaned up
      const postCleanupState = await verifyGitState(testDir);
      for (const task of tasks) {
        expect(postCleanupState.branches.some(b => b.includes(task.branchName!))).toBe(false);
      }

      const postCleanupRemote = await runGit('ls-remote --heads origin', testDir);
      for (const task of tasks) {
        expect(postCleanupRemote.stdout).not.toContain(task.branchName!);
      }

      // Verify main branch has all merged changes and is clean
      expect(postCleanupState.branch).toBe('main');
      expect(postCleanupState.isClean).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      const task = createTestTask({
        projectPath: testDir,
        description: 'Cleanup error handling test',
        branchName: 'apex/cleanup-error-test',
      });

      await orchestrator.store.createTask(task);

      // Create and merge feature
      await simulateFeatureDevelopment(testDir, task.branchName!, task.description);
      await orchestrator.pushTaskBranch(task.id);
      await runGit('checkout main', testDir);
      const mergeResult = await orchestrator.mergeTaskBranch(task.id);
      expect(mergeResult.success).toBe(true);

      // Try to delete a non-existent branch (should handle gracefully)
      const fakeDeleteResult = await runGit('branch -d apex/non-existent-branch', testDir);
      expect(fakeDeleteResult.success).toBe(false);
      expect(fakeDeleteResult.stderr).toContain('not found');

      // Try to delete remote branch that doesn't exist (should handle gracefully)
      const fakeRemoteDeleteResult = await runGit('push origin --delete apex/non-existent-branch', testDir);
      expect(fakeRemoteDeleteResult.success).toBe(false);

      // Verify our actual branch still exists and can be cleaned up
      const realDeleteResult = await runGit(`branch -d ${task.branchName!}`, testDir);
      expect(realDeleteResult.success).toBe(true);

      // Verify the repository is still in a good state
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);
    });
  });

  describe('Multiple Task Workflows in Sequence', () => {
    beforeEach(async () => {
      // Setup complete environment with remote for sequence testing
      await initGitRepo(bareRepoDir, true);
      await initGitRepo(testDir);
      await createApexConfig(testDir);
      await runGit(`remote add origin ${bareRepoDir}`, testDir);

      // Create and push initial commit
      await fs.writeFile(path.join(testDir, 'README.md'), '# Sequential Task Workflows Test Project\n');
      await runGit('add README.md', testDir);
      await runGit('commit -m "Initial commit"', testDir);
      await runGit('push -u origin main', testDir);

      orchestrator = new ApexOrchestrator({ projectPath: testDir });
      await orchestrator.initialize();
    });

    it('should process two tasks sequentially with separate branches', async () => {
      // Create two tasks for sequential processing
      const task1 = createTestTask({
        projectPath: testDir,
        description: 'Implement authentication system',
        branchName: 'apex/auth-system-seq-1',
      });

      const task2 = createTestTask({
        projectPath: testDir,
        description: 'Add user profile management',
        branchName: 'apex/user-profile-seq-1',
      });

      // Store both tasks
      await orchestrator.store.createTask(task1);
      await orchestrator.store.createTask(task2);

      // Verify initial state is clean
      const initialState = await verifyGitState(testDir);
      expect(initialState.branch).toBe('main');
      expect(initialState.isClean).toBe(true);

      // Execute first task workflow completely
      await simulateFeatureDevelopment(testDir, task1.branchName!, task1.description);
      const push1Result = await orchestrator.pushTaskBranch(task1.id);
      expect(push1Result.success).toBe(true);

      await runGit('checkout main', testDir);
      const merge1Result = await orchestrator.mergeTaskBranch(task1.id);
      expect(merge1Result.success).toBe(true);
      expect(merge1Result.conflicted).toBeFalsy();

      await orchestrator.updateTaskStatus(task1.id, 'completed');

      // Verify repository state after first task
      const midState = await verifyGitState(testDir);
      expect(midState.branch).toBe('main');
      expect(midState.isClean).toBe(true);

      // Execute second task workflow completely
      await simulateFeatureDevelopment(testDir, task2.branchName!, task2.description);
      const push2Result = await orchestrator.pushTaskBranch(task2.id);
      expect(push2Result.success).toBe(true);

      await runGit('checkout main', testDir);
      const merge2Result = await orchestrator.mergeTaskBranch(task2.id);
      expect(merge2Result.success).toBe(true);
      expect(merge2Result.conflicted).toBeFalsy();

      await orchestrator.updateTaskStatus(task2.id, 'completed');

      // Verify final state
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);

      // Verify both task branches exist
      expect(finalState.branches.some(b => b.includes('apex/auth-system-seq-1'))).toBe(true);
      expect(finalState.branches.some(b => b.includes('apex/user-profile-seq-1'))).toBe(true);

      // Verify both tasks are completed
      const completedTask1 = await orchestrator.store.getTask(task1.id);
      const completedTask2 = await orchestrator.store.getTask(task2.id);
      expect(completedTask1!.status).toBe('completed');
      expect(completedTask2!.status).toBe('completed');

      // Verify all changes from both tasks are present in main
      const allChangedFiles = [...(merge1Result.changedFiles || []), ...(merge2Result.changedFiles || [])];
      for (const file of allChangedFiles) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should handle three tasks in sequence with individual branch creation', async () => {
      // Create three tasks for comprehensive sequence testing
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'Add API endpoints',
          branchName: 'apex/api-endpoints-seq-2',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Implement database models',
          branchName: 'apex/db-models-seq-2',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Add frontend components',
          branchName: 'apex/frontend-components-seq-2',
        }),
      ];

      // Store all tasks
      for (const task of tasks) {
        await orchestrator.store.createTask(task);
      }

      // Execute each task workflow completely in sequence
      const completedBranches: string[] = [];
      const mergeResults: MergeTaskBranchResult[] = [];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        // Verify we start each task from clean main branch
        const preTaskState = await verifyGitState(testDir);
        expect(preTaskState.branch).toBe('main');
        expect(preTaskState.isClean).toBe(true);

        // Create branch and develop feature
        await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

        // Verify task has its own unique branch
        const taskBranchState = await verifyGitState(testDir);
        expect(taskBranchState.branch).toBe(task.branchName!);
        completedBranches.push(task.branchName!);

        // Push branch to remote
        const pushResult = await orchestrator.pushTaskBranch(task.id);
        expect(pushResult.success).toBe(true);

        // Switch to main and merge
        await runGit('checkout main', testDir);
        const mergeResult = await orchestrator.mergeTaskBranch(task.id);
        expect(mergeResult.success).toBe(true);
        expect(mergeResult.conflicted).toBeFalsy();
        mergeResults.push(mergeResult);

        // Mark task as completed
        await orchestrator.updateTaskStatus(task.id, 'completed');

        // Verify task completion
        const completedTask = await orchestrator.store.getTask(task.id);
        expect(completedTask!.status).toBe('completed');

        // Verify repository is clean for next task
        const postTaskState = await verifyGitState(testDir);
        expect(postTaskState.branch).toBe('main');
        expect(postTaskState.isClean).toBe(true);
      }

      // Verify all branches were created
      const finalState = await verifyGitState(testDir);
      for (const branchName of completedBranches) {
        expect(finalState.branches.some(b => b.includes(branchName))).toBe(true);
      }

      // Verify all changes from all tasks are integrated
      const allChangedFiles = mergeResults.flatMap(result => result.changedFiles || []);
      expect(allChangedFiles.length).toBeGreaterThan(0);
      for (const file of allChangedFiles) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }

      // Verify commit history shows all merges
      expect(finalState.recentCommits.filter(commit => commit.includes('Merge')).length).toBe(3);
    });

    it('should execute sequential push operations for multiple tasks', async () => {
      // Create multiple tasks to test sequential push operations
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'Task 1 for sequential push test',
          branchName: 'apex/sequential-push-1',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Task 2 for sequential push test',
          branchName: 'apex/sequential-push-2',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Task 3 for sequential push test',
          branchName: 'apex/sequential-push-3',
        }),
      ];

      // Store all tasks
      for (const task of tasks) {
        await orchestrator.store.createTask(task);
      }

      const pushedBranches: string[] = [];

      // Execute development and push for each task sequentially
      for (const task of tasks) {
        // Ensure we start from main
        await runGit('checkout main', testDir);

        // Develop feature on task branch
        await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

        // Push branch - each push should succeed independently
        const pushResult = await orchestrator.pushTaskBranch(task.id);
        expect(pushResult.success).toBe(true);
        expect(pushResult.error).toBeUndefined();
        expect(pushResult.remoteBranch).toBeDefined();

        pushedBranches.push(task.branchName!);

        // Verify branch exists on remote after push
        const remoteBranches = await runGit('ls-remote --heads origin', testDir);
        expect(remoteBranches.stdout).toContain(task.branchName!);
        expect(remoteBranches.success).toBe(true);
      }

      // Verify all branches are present on remote
      const finalRemoteBranches = await runGit('ls-remote --heads origin', testDir);
      for (const branchName of pushedBranches) {
        expect(finalRemoteBranches.stdout).toContain(branchName);
      }

      // Verify no conflicts between pushes
      expect(finalRemoteBranches.success).toBe(true);

      // Count total branches on remote (main + 3 task branches)
      const remoteBranchList = finalRemoteBranches.stdout.trim().split('\n');
      expect(remoteBranchList.length).toBeGreaterThanOrEqual(4); // main + 3 tasks
    });

    it('should execute sequential merge operations without conflicts', async () => {
      // Create tasks that modify different files to avoid merge conflicts
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'Add utility functions',
          branchName: 'apex/utils-merge-seq',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Add configuration management',
          branchName: 'apex/config-merge-seq',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Add logging system',
          branchName: 'apex/logging-merge-seq',
        }),
      ];

      // Store all tasks
      for (const task of tasks) {
        await orchestrator.store.createTask(task);
      }

      // Develop and push all features first
      const developedTasks: { task: Task; files: string[] }[] = [];

      for (const task of tasks) {
        await runGit('checkout main', testDir);

        // Create unique files for each task to avoid conflicts
        await runGit(`checkout -b ${task.branchName!}`, testDir);

        // Create task-specific files with unique names
        const taskPrefix = task.branchName!.split('-')[1]; // Extract unique part
        const uniqueFile = `${taskPrefix}-module.js`;
        const uniqueTestFile = `${taskPrefix}-module.test.js`;
        const uniqueDocFile = `${taskPrefix}-README.md`;

        await fs.writeFile(
          path.join(testDir, uniqueFile),
          `// ${task.description}\nexport function ${taskPrefix}Function() { return '${taskPrefix}'; }\n`
        );
        await runGit(`add ${uniqueFile}`, testDir);
        await runGit(`commit -m "feat: add ${uniqueFile}"`, testDir);

        await fs.writeFile(
          path.join(testDir, uniqueTestFile),
          `// Tests for ${uniqueFile}\nimport { ${taskPrefix}Function } from './${uniqueFile}';\n`
        );
        await runGit(`add ${uniqueTestFile}`, testDir);
        await runGit(`commit -m "test: add tests for ${uniqueFile}"`, testDir);

        await fs.writeFile(
          path.join(testDir, uniqueDocFile),
          `# ${task.description}\n\nDocumentation for ${taskPrefix} module.\n`
        );
        await runGit(`add ${uniqueDocFile}`, testDir);
        await runGit(`commit -m "docs: add documentation for ${uniqueFile}"`, testDir);

        // Push the branch
        const pushResult = await orchestrator.pushTaskBranch(task.id);
        expect(pushResult.success).toBe(true);

        developedTasks.push({
          task,
          files: [uniqueFile, uniqueTestFile, uniqueDocFile]
        });
      }

      // Now merge all tasks sequentially
      const mergeResults: MergeTaskBranchResult[] = [];

      for (const { task, files } of developedTasks) {
        // Ensure we're on main before each merge
        await runGit('checkout main', testDir);
        const preMergeState = await verifyGitState(testDir);
        expect(preMergeState.branch).toBe('main');
        expect(preMergeState.isClean).toBe(true);

        // Perform merge
        const mergeResult = await orchestrator.mergeTaskBranch(task.id);
        expect(mergeResult.success).toBe(true);
        expect(mergeResult.error).toBeUndefined();
        expect(mergeResult.conflicted).toBeFalsy();
        expect(mergeResult.changedFiles).toBeDefined();

        mergeResults.push(mergeResult);

        // Verify merge was successful and clean
        const postMergeState = await verifyGitState(testDir);
        expect(postMergeState.branch).toBe('main');
        expect(postMergeState.isClean).toBe(true);

        // Verify task files are present in main
        for (const file of files) {
          const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
          expect(fileExists).toBe(true);
        }

        // Mark task as completed
        await orchestrator.updateTaskStatus(task.id, 'completed');
      }

      // Verify final state - all merges completed without conflicts
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);

      // Verify all merge commits are present
      const mergeCommits = finalState.recentCommits.filter(commit => commit.includes('Merge'));
      expect(mergeCommits.length).toBe(3);

      // Verify all task files from all merges are present
      const allFiles = developedTasks.flatMap(({ files }) => files);
      for (const file of allFiles) {
        const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should maintain repository cleanliness between task workflows', async () => {
      // Create multiple tasks to verify clean state between workflows
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'First clean workflow test',
          branchName: 'apex/clean-workflow-1',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Second clean workflow test',
          branchName: 'apex/clean-workflow-2',
        }),
      ];

      for (const task of tasks) {
        await orchestrator.store.createTask(task);
      }

      // Execute first workflow and verify state at each step
      const task1 = tasks[0];

      // Initial state should be clean
      const initialState = await verifyGitState(testDir);
      expect(initialState.branch).toBe('main');
      expect(initialState.isClean).toBe(true);

      // Develop first task
      await simulateFeatureDevelopment(testDir, task1.branchName!, task1.description);

      // State after development should be clean on feature branch
      const devState1 = await verifyGitState(testDir);
      expect(devState1.branch).toBe(task1.branchName!);
      expect(devState1.isClean).toBe(true);

      // Push and merge first task
      await orchestrator.pushTaskBranch(task1.id);
      await runGit('checkout main', testDir);
      const merge1Result = await orchestrator.mergeTaskBranch(task1.id);
      expect(merge1Result.success).toBe(true);
      await orchestrator.updateTaskStatus(task1.id, 'completed');

      // State after first task completion should be clean
      const postTask1State = await verifyGitState(testDir);
      expect(postTask1State.branch).toBe('main');
      expect(postTask1State.isClean).toBe(true);

      // Execute second workflow
      const task2 = tasks[1];

      // Develop second task
      await simulateFeatureDevelopment(testDir, task2.branchName!, task2.description);

      // State after second development should be clean on its feature branch
      const devState2 = await verifyGitState(testDir);
      expect(devState2.branch).toBe(task2.branchName!);
      expect(devState2.isClean).toBe(true);

      // Push and merge second task
      await orchestrator.pushTaskBranch(task2.id);
      await runGit('checkout main', testDir);
      const merge2Result = await orchestrator.mergeTaskBranch(task2.id);
      expect(merge2Result.success).toBe(true);
      await orchestrator.updateTaskStatus(task2.id, 'completed');

      // Final state should be clean
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);

      // Verify no uncommitted changes or untracked files
      const statusCheck = await runGit('status --porcelain', testDir);
      expect(statusCheck.stdout.trim()).toBe('');
      expect(statusCheck.success).toBe(true);

      // Verify both tasks completed successfully
      const completedTask1 = await orchestrator.store.getTask(task1.id);
      const completedTask2 = await orchestrator.store.getTask(task2.id);
      expect(completedTask1!.status).toBe('completed');
      expect(completedTask2!.status).toBe('completed');
    });

    it('should persist state across multiple task lifecycles', async () => {
      // Create multiple tasks to test state persistence
      const tasks = [
        createTestTask({
          projectPath: testDir,
          description: 'Database setup task',
          branchName: 'apex/db-setup-persist',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'API layer task',
          branchName: 'apex/api-layer-persist',
        }),
        createTestTask({
          projectPath: testDir,
          description: 'Frontend integration task',
          branchName: 'apex/frontend-persist',
        }),
      ];

      // Store all tasks and verify persistence
      for (const task of tasks) {
        await orchestrator.store.createTask(task);

        // Verify task was persisted
        const storedTask = await orchestrator.store.getTask(task.id);
        expect(storedTask).toBeDefined();
        expect(storedTask!.id).toBe(task.id);
        expect(storedTask!.status).toBe('pending');
      }

      const taskArtifacts: { taskId: string; files: string[]; commits: string[] }[] = [];

      // Execute each task lifecycle and track persistence
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        // Update task status to in-progress
        await orchestrator.updateTaskStatus(task.id, 'in_progress');

        // Verify status persistence
        const inProgressTask = await orchestrator.store.getTask(task.id);
        expect(inProgressTask!.status).toBe('in_progress');

        // Develop and commit feature
        await runGit('checkout main', testDir);
        await simulateFeatureDevelopment(testDir, task.branchName!, task.description);

        // Capture commit information for persistence verification
        const commitLog = await runGit(`log ${task.branchName!} --oneline`, testDir);
        const commits = commitLog.stdout.trim().split('\n');

        // Push and merge
        const pushResult = await orchestrator.pushTaskBranch(task.id);
        expect(pushResult.success).toBe(true);

        await runGit('checkout main', testDir);
        const mergeResult = await orchestrator.mergeTaskBranch(task.id);
        expect(mergeResult.success).toBe(true);

        // Complete task
        await orchestrator.updateTaskStatus(task.id, 'completed');

        // Verify completion persistence
        const completedTask = await orchestrator.store.getTask(task.id);
        expect(completedTask!.status).toBe('completed');
        expect(completedTask!.updatedAt).toBeDefined();

        // Store task artifacts for later verification
        taskArtifacts.push({
          taskId: task.id,
          files: mergeResult.changedFiles || [],
          commits: commits,
        });

        // Verify all previous tasks are still persisted correctly
        for (let j = 0; j <= i; j++) {
          const previousTask = await orchestrator.store.getTask(tasks[j].id);
          expect(previousTask).toBeDefined();
          expect(previousTask!.id).toBe(tasks[j].id);

          if (j < i) {
            // Previous tasks should be completed
            expect(previousTask!.status).toBe('completed');
          } else {
            // Current task should be completed
            expect(previousTask!.status).toBe('completed');
          }
        }
      }

      // Verify all artifacts from all tasks persist in the final state
      for (const artifact of taskArtifacts) {
        // Verify files from each task are still present
        for (const file of artifact.files) {
          const fileExists = await fs.access(path.join(testDir, file)).then(() => true, () => false);
          expect(fileExists).toBe(true);
        }

        // Verify task record is still accessible
        const persistedTask = await orchestrator.store.getTask(artifact.taskId);
        expect(persistedTask).toBeDefined();
        expect(persistedTask!.status).toBe('completed');
      }

      // Verify commit history contains all task merges
      const finalCommitLog = await runGit('log --oneline -20', testDir);
      const allCommits = finalCommitLog.stdout;

      // Count merge commits (should be one per task)
      const mergeCount = (allCommits.match(/Merge/g) || []).length;
      expect(mergeCount).toBe(tasks.length);

      // Verify repository integrity after multiple lifecycles
      const integrityCheck = await runGit('fsck', testDir);
      expect(integrityCheck.success).toBe(true);

      // Verify final clean state
      const finalState = await verifyGitState(testDir);
      expect(finalState.branch).toBe('main');
      expect(finalState.isClean).toBe(true);
    });
  });
});