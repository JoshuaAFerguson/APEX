import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task } from '@apexcli/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('ApexOrchestrator.mergeTaskBranch', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let store: TaskStore;
  let testTask: Task;

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test task for merge functionality',
    workflow: 'feature',
    autonomy: 'full',
    status: 'completed',
    priority: 'normal',
    effort: 'medium',
    projectPath: testDir,
    branchName: 'apex/test-feature',
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
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-merge-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create basic config file
    const config = {
      project: { name: 'test-project' },
      autonomy: { default: 'full' },
      models: { planning: 'sonnet', implementation: 'sonnet', review: 'haiku' },
      limits: { maxTokensPerTask: 100000, maxCostPerTask: 1.0, dailyBudget: 10.0 },
      api: { url: 'http://localhost:3000', port: 3000 },
    };

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `project:
  name: ${config.project.name}
autonomy:
  default: ${config.autonomy.default}
models:
  planning: ${config.models.planning}
  implementation: ${config.models.implementation}
  review: ${config.models.review}
limits:
  maxTokensPerTask: ${config.limits.maxTokensPerTask}
  maxCostPerTask: ${config.limits.maxCostPerTask}
  dailyBudget: ${config.limits.dailyBudget}
api:
  url: ${config.api.url}
  port: ${config.api.port}
`
    );

    // Initialize git repository
    await execAsync('git init', { cwd: testDir });
    await execAsync('git config user.name "Test User"', { cwd: testDir });
    await execAsync('git config user.email "test@example.com"', { cwd: testDir });

    // Create initial commit on main branch
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
    await execAsync('git add README.md', { cwd: testDir });
    await execAsync('git commit -m "Initial commit"', { cwd: testDir });

    // Create test branch with changes
    await execAsync('git checkout -b apex/test-feature', { cwd: testDir });
    await fs.writeFile(path.join(testDir, 'feature.txt'), 'This is a test feature\n');
    await execAsync('git add feature.txt', { cwd: testDir });
    await execAsync('git commit -m "Add test feature"', { cwd: testDir });

    // Switch back to main
    await execAsync('git checkout main', { cwd: testDir });

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();
    store = orchestrator.store;

    // Create test task
    testTask = createTestTask();
    await store.createTask(testTask);
  });

  afterEach(async () => {
    try {
      await orchestrator?.cleanup?.();
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('successful merge scenarios', () => {
    it('should successfully perform a standard merge', async () => {
      const result = await orchestrator.mergeTaskBranch(testTask.id);

      expect(result.success).toBe(true);
      expect(result.commitHash).toBeDefined();
      expect(result.changedFiles).toBeDefined();
      expect(result.changedFiles).toEqual(expect.arrayContaining(['feature.txt']));

      // Verify merge commit exists
      const { stdout: logOutput } = await execAsync('git log --oneline', { cwd: testDir });
      expect(logOutput).toMatch(/Merge branch 'apex\/test-feature'/);
    });

    it('should successfully perform a squash merge', async () => {
      const result = await orchestrator.mergeTaskBranch(testTask.id, { squash: true });

      expect(result.success).toBe(true);
      expect(result.commitHash).toBeDefined();
      expect(result.changedFiles).toBeDefined();
      expect(result.changedFiles).toEqual(expect.arrayContaining(['feature.txt']));

      // Verify squash commit message
      const { stdout: logOutput } = await execAsync('git log --oneline -1', { cwd: testDir });
      expect(logOutput).toMatch(/Squash merge of apex\/test-feature/);
    });

    it('should log merge progress', async () => {
      await orchestrator.mergeTaskBranch(testTask.id);

      const logs = await store.getLogs(testTask.id);
      const logMessages = logs.map(log => log.message);

      expect(logMessages).toEqual(expect.arrayContaining([
        expect.stringMatching(/Starting.*merge of branch apex\/test-feature/)
      ]));
      expect(logMessages).toEqual(expect.arrayContaining([
        expect.stringMatching(/Merge completed successfully/)
      ]));
    });

    it('should switch branches if currently on task branch', async () => {
      // Switch to task branch
      await execAsync('git checkout apex/test-feature', { cwd: testDir });

      const result = await orchestrator.mergeTaskBranch(testTask.id);

      expect(result.success).toBe(true);

      // Should be back on main branch
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: testDir });
      expect(currentBranch.trim()).toBe('main');
    });
  });

  describe('error scenarios', () => {
    it('should return error for non-existent task', async () => {
      const result = await orchestrator.mergeTaskBranch('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found: non-existent-id');
    });

    it('should return error for task without branch', async () => {
      const taskWithoutBranch = createTestTask({ branchName: undefined });
      await store.createTask(taskWithoutBranch);

      const result = await orchestrator.mergeTaskBranch(taskWithoutBranch.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task does not have a branch');
    });

    it('should handle merge conflicts gracefully', async () => {
      // Create conflicting changes on main
      await fs.writeFile(path.join(testDir, 'feature.txt'), 'Conflicting content\n');
      await execAsync('git add feature.txt', { cwd: testDir });
      await execAsync('git commit -m "Add conflicting content"', { cwd: testDir });

      const result = await orchestrator.mergeTaskBranch(testTask.id);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/merge conflicts/i);

      // Verify logs contain conflict information
      const logs = await store.getLogs(testTask.id);
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs.some(log => log.message.includes('conflicts'))).toBe(true);
    });

    it('should handle non-existent branch gracefully', async () => {
      const taskWithInvalidBranch = createTestTask({ branchName: 'non-existent-branch' });
      await store.createTask(taskWithInvalidBranch);

      const result = await orchestrator.mergeTaskBranch(taskWithInvalidBranch.id);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Merge failed/);
    });
  });

  describe('git integration', () => {
    it('should handle pull failures gracefully', async () => {
      // Mock git pull to fail (simulate no remote)
      vi.spyOn(require('child_process'), 'exec').mockImplementationOnce((cmd, opts, callback) => {
        if (cmd.includes('git pull')) {
          const error = new Error('No remote configured');
          callback(error, null, null);
        } else {
          // Call original implementation for other commands
          vi.restoreAllMocks();
          return require('child_process').exec(cmd, opts, callback);
        }
      });

      const result = await orchestrator.mergeTaskBranch(testTask.id);

      // Should still succeed even if pull fails
      expect(result.success).toBe(true);

      // Should log warning about pull failure
      const logs = await store.getLogs(testTask.id);
      const warnLogs = logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('Could not pull latest changes'))).toBe(true);

      vi.restoreAllMocks();
    });

    it('should detect main vs master branch correctly', async () => {
      // Create a repo with master branch instead of main
      const masterTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-merge-master-test-'));

      try {
        await execAsync('git init', { cwd: masterTestDir });
        await execAsync('git config user.name "Test User"', { cwd: masterTestDir });
        await execAsync('git config user.email "test@example.com"', { cwd: masterTestDir });

        // Create initial commit on master
        await fs.writeFile(path.join(masterTestDir, 'README.md'), '# Test Project\n');
        await execAsync('git add README.md', { cwd: masterTestDir });
        await execAsync('git commit -m "Initial commit"', { cwd: masterTestDir });
        await execAsync('git branch -m master', { cwd: masterTestDir });

        // Create test branch
        await execAsync('git checkout -b test-branch', { cwd: masterTestDir });
        await fs.writeFile(path.join(masterTestDir, 'test.txt'), 'test\n');
        await execAsync('git add test.txt', { cwd: masterTestDir });
        await execAsync('git commit -m "Add test"', { cwd: masterTestDir });
        await execAsync('git checkout master', { cwd: masterTestDir });

        const masterOrchestrator = new ApexOrchestrator({ projectPath: masterTestDir });
        await masterOrchestrator.initialize();

        const masterTask = createTestTask({
          branchName: 'test-branch',
          projectPath: masterTestDir
        });
        await masterOrchestrator.store.createTask(masterTask);

        const result = await masterOrchestrator.mergeTaskBranch(masterTask.id);

        expect(result.success).toBe(true);

        // Verify we're on master branch after merge
        const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: masterTestDir });
        expect(currentBranch.trim()).toBe('master');

        await masterOrchestrator.cleanup?.();
      } finally {
        await fs.rm(masterTestDir, { recursive: true, force: true });
      }
    });
  });

  describe('squash merge specifics', () => {
    it('should create proper squash commit message', async () => {
      const result = await orchestrator.mergeTaskBranch(testTask.id, { squash: true });

      expect(result.success).toBe(true);

      const { stdout: commitMsg } = await execAsync('git log -1 --format=%B', { cwd: testDir });
      expect(commitMsg).toMatch(/Squash merge of apex\/test-feature/);
      expect(commitMsg).toMatch(/Test task for merge functionality/);
      expect(commitMsg).toMatch(/Generated with.*Claude Code/);
      expect(commitMsg).toMatch(/Co-Authored-By: Claude Sonnet 4/);
    });

    it('should not create merge commit for squash merge', async () => {
      await orchestrator.mergeTaskBranch(testTask.id, { squash: true });

      const { stdout: logOutput } = await execAsync('git log --oneline', { cwd: testDir });
      expect(logOutput).not.toMatch(/Merge branch/);
    });
  });
});