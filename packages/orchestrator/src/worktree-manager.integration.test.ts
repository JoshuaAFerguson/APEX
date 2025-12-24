import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorktreeManager, WorktreeError } from './worktree-manager';
import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Integration tests for WorktreeManager
 * These tests run against a real git repository
 * Note: These tests require git to be available in the environment
 */
describe('WorktreeManager Integration Tests', () => {
  let worktreeManager: WorktreeManager;
  let tempDir: string;
  let testRepoDir: string;
  let worktreeBaseDir: string;

  beforeEach(async () => {
    // Create a temporary test repository
    tempDir = await fs.mkdtemp('/tmp/apex-worktree-test-');
    testRepoDir = join(tempDir, 'test-repo');
    worktreeBaseDir = join(tempDir, 'worktrees');

    // Initialize git repository
    await fs.mkdir(testRepoDir, { recursive: true });
    await execAsync('git init', { cwd: testRepoDir });
    await execAsync('git config user.email "test@example.com"', { cwd: testRepoDir });
    await execAsync('git config user.name "Test User"', { cwd: testRepoDir });

    // Create initial commit
    await fs.writeFile(join(testRepoDir, 'README.md'), '# Test Repository\n');
    await execAsync('git add .', { cwd: testRepoDir });
    await execAsync('git commit -m "Initial commit"', { cwd: testRepoDir });

    // Initialize WorktreeManager
    worktreeManager = new WorktreeManager({
      projectPath: testRepoDir,
      config: {
        baseDir: worktreeBaseDir,
        maxWorktrees: 3,
        cleanupOnComplete: true,
        pruneStaleAfterDays: 1,
      },
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create and manage worktrees successfully', async () => {
    const taskId = 'integration-test-task';
    const branchName = 'feature/integration-test';

    // Create a worktree
    const worktreePath = await worktreeManager.createWorktree(taskId, branchName);

    expect(worktreePath).toBe(join(worktreeBaseDir, `task-${taskId}`));

    // Verify the worktree directory exists
    await expect(fs.access(worktreePath)).resolves.not.toThrow();

    // Verify we can find the worktree
    const worktreeInfo = await worktreeManager.getWorktree(taskId);
    expect(worktreeInfo).not.toBeNull();
    expect(worktreeInfo?.taskId).toBe(taskId);
    expect(worktreeInfo?.branch).toBe(branchName);
    expect(worktreeInfo?.path).toBe(worktreePath);

    // Switch to the worktree (this mainly validates the path exists)
    const switchedPath = await worktreeManager.switchToWorktree(taskId);
    expect(switchedPath).toBe(worktreePath);

    // List worktrees and verify our worktree is included
    const worktrees = await worktreeManager.listWorktrees();
    expect(worktrees.length).toBeGreaterThanOrEqual(2); // main + our worktree

    const ourWorktree = worktrees.find(w => w.taskId === taskId);
    expect(ourWorktree).toBeDefined();
    expect(ourWorktree?.branch).toBe(branchName);

    // Delete the worktree
    const deleted = await worktreeManager.deleteWorktree(taskId);
    expect(deleted).toBe(true);

    // Verify the worktree is gone
    const deletedWorktree = await worktreeManager.getWorktree(taskId);
    expect(deletedWorktree).toBeNull();

    // Verify directory is cleaned up
    await expect(fs.access(worktreePath)).rejects.toThrow();
  });

  it('should handle worktree creation errors gracefully', async () => {
    const taskId = 'invalid-branch-test';
    const invalidBranchName = 'feature/..invalid'; // Invalid branch name

    // This should fail due to invalid branch name
    await expect(
      worktreeManager.createWorktree(taskId, invalidBranchName)
    ).rejects.toThrow(WorktreeError);

    // Verify no partial worktree was created
    const worktreeInfo = await worktreeManager.getWorktree(taskId);
    expect(worktreeInfo).toBeNull();
  });

  it('should enforce maximum worktree limits', async () => {
    const maxWorktrees = 3;

    // Create worktrees up to the limit
    const createdWorktrees = [];
    for (let i = 0; i < maxWorktrees; i++) {
      const taskId = `limit-test-${i}`;
      const branchName = `feature/limit-test-${i}`;

      const worktreePath = await worktreeManager.createWorktree(taskId, branchName);
      createdWorktrees.push({ taskId, worktreePath });
    }

    // Try to create one more - this should fail
    await expect(
      worktreeManager.createWorktree('limit-test-overflow', 'feature/overflow')
    ).rejects.toThrow('Maximum number of worktrees (3) reached');

    // Clean up created worktrees
    for (const { taskId } of createdWorktrees) {
      await worktreeManager.deleteWorktree(taskId);
    }
  });

  it('should list all worktrees with correct metadata', async () => {
    const taskId = 'list-test-task';
    const branchName = 'feature/list-test';

    // Create a worktree
    await worktreeManager.createWorktree(taskId, branchName);

    // List worktrees
    const worktrees = await worktreeManager.listWorktrees();

    // Should have at least main worktree + our test worktree
    expect(worktrees.length).toBeGreaterThanOrEqual(2);

    // Check main worktree
    const mainWorktree = worktrees.find(w => w.isMain);
    expect(mainWorktree).toBeDefined();
    expect(mainWorktree?.path).toBe(testRepoDir);

    // Check our test worktree
    const testWorktree = worktrees.find(w => w.taskId === taskId);
    expect(testWorktree).toBeDefined();
    expect(testWorktree?.branch).toBe(branchName);
    expect(testWorktree?.isMain).toBe(false);
    expect(testWorktree?.head).toBeDefined();

    // Clean up
    await worktreeManager.deleteWorktree(taskId);
  });

  it('should handle cleanup of orphaned worktrees', async () => {
    const taskId = 'cleanup-test-task';
    const branchName = 'feature/cleanup-test';

    // Create a worktree
    const worktreePath = await worktreeManager.createWorktree(taskId, branchName);

    // Manually create an old timestamp to simulate a stale worktree
    const oldTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    await fs.utimes(worktreePath, oldTime, oldTime);

    // Run cleanup
    const cleanedUp = await worktreeManager.cleanupOrphanedWorktrees();

    // Our test worktree should be in the cleaned up list
    expect(cleanedUp).toContain(taskId);

    // Verify the worktree is gone
    const deletedWorktree = await worktreeManager.getWorktree(taskId);
    expect(deletedWorktree).toBeNull();
  });

  it('should provide correct configuration', () => {
    const config = worktreeManager.getConfig();

    expect(config.maxWorktrees).toBe(3);
    expect(config.cleanupOnComplete).toBe(true);
    expect(config.pruneStaleAfterDays).toBe(1);

    // Should be a copy, not the original
    config.maxWorktrees = 999;
    expect(worktreeManager.getConfig().maxWorktrees).toBe(3);
  });

  it('should return correct base directory', () => {
    const baseDir = worktreeManager.getWorktreeBaseDir();
    expect(baseDir).toBe(worktreeBaseDir);
  });
});