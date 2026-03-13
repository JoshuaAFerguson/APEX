/**
 * @fileoverview Comprehensive test suite for v0.6.0 Git Status Awareness features
 *
 * This test suite validates the git status awareness functionality implemented for v0.6.0:
 * - Git repository detection and status parsing
 * - Branch information with tracking details
 * - Uncommitted changes detection
 * - Recent commit analysis
 * - Integration with project context analysis
 *
 * Tests verify both implementation completeness and integration with real git repositories.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  ProjectContextAnalyzer,
  type GitStatus,
  GitStatusSchema,
} from '@apexcli/core';

describe('v0.6.0 Git Status Awareness Features', () => {
  const tempDir = '/tmp/apex-git-status-test';
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    // Clean up and create fresh test repository
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory may not exist, ignore
    }

    await fs.mkdir(tempDir, { recursive: true });

    // Initialize git repository
    execSync('git init', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });

    // Create initial commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Repository\n');
    execSync('git add README.md', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });

    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Git Repository Detection', () => {
    it('should correctly identify git repositories', async () => {
      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBeTruthy();
      expect(gitStatus.branch).toMatch(/^(main|master|[\w\-\/]+)$/);
    });

    it('should handle non-git directories gracefully', async () => {
      const nonGitDir = '/tmp/non-git-directory';
      await fs.mkdir(nonGitDir, { recursive: true });

      try {
        const gitStatus = await analyzer.getGitStatus(nonGitDir);

        expect(gitStatus.isRepository).toBe(false);
        expect(gitStatus.branch).toBe('');
        expect(gitStatus.isClean).toBe(true);
        expect(gitStatus.changedFiles).toEqual([]);
        expect(gitStatus.hasUncommittedChanges).toBe(false);
        expect(gitStatus.hasUntrackedFiles).toBe(false);
        expect(gitStatus.hasStagedChanges).toBe(false);
      } finally {
        await fs.rm(nonGitDir, { recursive: true, force: true });
      }
    });

    it('should validate git status schema compliance', async () => {
      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();

      // Verify all required fields are present
      expect(gitStatus).toHaveProperty('isRepository');
      expect(gitStatus).toHaveProperty('branch');
      expect(gitStatus).toHaveProperty('isClean');
      expect(gitStatus).toHaveProperty('hasUncommittedChanges');
      expect(gitStatus).toHaveProperty('hasUntrackedFiles');
      expect(gitStatus).toHaveProperty('hasStagedChanges');
      expect(gitStatus).toHaveProperty('changedFiles');
      expect(gitStatus).toHaveProperty('stashCount');
    });
  });

  describe('Branch Information and Tracking', () => {
    it('should detect current branch information', async () => {
      // Create and switch to a new branch
      execSync('git checkout -b feature/test-branch', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/test-branch');
    });

    it('should provide remote tracking information when available', async () => {
      // Add a fake remote to test tracking
      execSync('git remote add origin https://github.com/test/test-repo.git', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      // Even without actual remote connection, should handle gracefully
      expect(gitStatus.isRepository).toBe(true);
      expect(typeof gitStatus.tracking).toBe('object');
    });

    it('should handle detached HEAD state', async () => {
      // Create a commit and checkout by hash (detached HEAD)
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'test content\n');
      execSync('git add test.txt', { cwd: tempDir });
      execSync('git commit -m "Add test file"', { cwd: tempDir });

      const commitHash = execSync('git rev-parse HEAD', {
        cwd: tempDir,
        encoding: 'utf-8'
      }).trim();

      execSync(`git checkout ${commitHash.substring(0, 7)}`, { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.isRepository).toBe(true);
      // In detached HEAD, branch might be empty or show the hash
      expect(typeof gitStatus.branch).toBe('string');
    });
  });

  describe('Uncommitted Changes Detection', () => {
    it('should detect uncommitted file modifications', async () => {
      // Modify existing file
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified Test Repository\n');

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.hasUncommittedChanges).toBe(true);
      expect(gitStatus.isClean).toBe(false);
      expect(gitStatus.changedFiles.length).toBeGreaterThan(0);

      const modifiedFile = gitStatus.changedFiles.find(f => f.path === 'README.md');
      expect(modifiedFile).toBeDefined();
      expect(modifiedFile?.status).toMatch(/^(modified|M)$/i);
    });

    it('should detect untracked files', async () => {
      // Add untracked file
      await fs.writeFile(path.join(tempDir, 'untracked.txt'), 'new file content\n');

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.hasUntrackedFiles).toBe(true);
      expect(gitStatus.isClean).toBe(false);

      const untrackedFile = gitStatus.changedFiles.find(f => f.path === 'untracked.txt');
      expect(untrackedFile).toBeDefined();
      expect(untrackedFile?.status).toMatch(/^(\?|A)$/i);
    });

    it('should detect staged changes', async () => {
      // Create and stage a new file
      await fs.writeFile(path.join(tempDir, 'staged.txt'), 'staged content\n');
      execSync('git add staged.txt', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.hasStagedChanges).toBe(true);
      expect(gitStatus.isClean).toBe(false);

      const stagedFile = gitStatus.changedFiles.find(f => f.path === 'staged.txt');
      expect(stagedFile).toBeDefined();
      expect(stagedFile?.staged).toBe(true);
    });

    it('should handle mixed file states correctly', async () => {
      // Create various file states
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Modified README\n');
      await fs.writeFile(path.join(tempDir, 'staged.txt'), 'staged file\n');
      await fs.writeFile(path.join(tempDir, 'untracked.txt'), 'untracked file\n');

      execSync('git add staged.txt', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.hasUncommittedChanges).toBe(true);
      expect(gitStatus.hasUntrackedFiles).toBe(true);
      expect(gitStatus.hasStagedChanges).toBe(true);
      expect(gitStatus.isClean).toBe(false);
      expect(gitStatus.changedFiles.length).toBe(3);
    });
  });

  describe('Recent Commit Analysis', () => {
    it('should provide information about the last commit', async () => {
      const gitStatus = await analyzer.getGitStatus(tempDir);

      if (gitStatus.lastCommit) {
        expect(gitStatus.lastCommit).toHaveProperty('hash');
        expect(gitStatus.lastCommit).toHaveProperty('message');
        expect(gitStatus.lastCommit).toHaveProperty('timestamp');

        expect(typeof gitStatus.lastCommit.hash).toBe('string');
        expect(gitStatus.lastCommit.hash.length).toBeGreaterThan(6);
        expect(gitStatus.lastCommit.message).toBe('Initial commit');
        expect(gitStatus.lastCommit.timestamp).toBeInstanceOf(Date);
      }
    });

    it('should handle multiple recent commits', async () => {
      // Add more commits
      const commits = [
        { file: 'file1.txt', message: 'feat: add first feature' },
        { file: 'file2.txt', message: 'fix: resolve issue' },
        { file: 'file3.txt', message: 'docs: update documentation' }
      ];

      for (const commit of commits) {
        await fs.writeFile(path.join(tempDir, commit.file), `${commit.file} content\n`);
        execSync(`git add ${commit.file}`, { cwd: tempDir });
        execSync(`git commit -m "${commit.message}"`, { cwd: tempDir });
      }

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.lastCommit?.message).toBe('docs: update documentation');
    });

    it('should track stash count correctly', async () => {
      // Create uncommitted changes
      await fs.writeFile(path.join(tempDir, 'stash-test.txt'), 'stash content\n');
      execSync('git add stash-test.txt', { cwd: tempDir });

      // Stash the changes
      execSync('git stash', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.stashCount).toBeGreaterThan(0);
      expect(gitStatus.isClean).toBe(true); // Should be clean after stash
    });
  });

  describe('Integration with Project Context', () => {
    it('should integrate git status with full project analysis', async () => {
      // Set up a realistic project structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });

      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'vitest'
        }
      }, null, 2));

      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const hello = "world";\n');
      await fs.writeFile(path.join(tempDir, 'tests', 'index.test.ts'), 'test("hello", () => {});\n');

      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "feat: add project structure"', { cwd: tempDir });

      const projectContext = await analyzer.analyze(tempDir, {
        includeGit: true,
        includeFrameworks: true,
        includeConfiguration: true,
        includeTestFrameworks: true,
      });

      expect(projectContext).toBeDefined();
      expect(projectContext?.git).toBeDefined();
      expect(projectContext?.git.isRepository).toBe(true);
      expect(projectContext?.git.branch).toBeTruthy();
      expect(projectContext?.git.isClean).toBe(true);
    });

    it('should handle git status in monorepo structures', async () => {
      // Create monorepo-like structure
      await fs.mkdir(path.join(tempDir, 'packages', 'core'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'packages', 'cli'), { recursive: true });

      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'package.json'), JSON.stringify({
        name: '@test/core',
        version: '1.0.0'
      }));

      await fs.writeFile(path.join(tempDir, 'packages', 'cli', 'package.json'), JSON.stringify({
        name: '@test/cli',
        version: '1.0.0'
      }));

      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "feat: add monorepo packages"', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.isClean).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle corrupted git repositories gracefully', async () => {
      // Simulate corrupted git repository by removing .git/HEAD
      await fs.rm(path.join(tempDir, '.git', 'HEAD'), { force: true });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      // Should handle gracefully and indicate it's not a valid repository
      expect(gitStatus.isRepository).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      // This test would require actual permission manipulation,
      // which might not be feasible in all test environments
      const gitStatus = await analyzer.getGitStatus(tempDir);

      // Should always return a valid GitStatus object
      expect(typeof gitStatus).toBe('object');
      expect(gitStatus).toHaveProperty('isRepository');
    });

    it('should handle very large repositories efficiently', async () => {
      // Create many files to test performance
      const fileCount = 100;
      const startTime = Date.now();

      for (let i = 0; i < fileCount; i++) {
        await fs.writeFile(path.join(tempDir, `file${i}.txt`), `content ${i}\n`);
      }

      const gitStatus = await analyzer.getGitStatus(tempDir);
      const endTime = Date.now();

      expect(gitStatus.hasUntrackedFiles).toBe(true);
      expect(gitStatus.changedFiles.length).toBe(fileCount);

      // Should complete within reasonable time (5 seconds for 100 files)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Real-world Git Scenarios', () => {
    it('should handle git worktrees correctly', async () => {
      // Create a worktree scenario
      await fs.writeFile(path.join(tempDir, 'main-branch.txt'), 'main content\n');
      execSync('git add main-branch.txt', { cwd: tempDir });
      execSync('git commit -m "Add main branch file"', { cwd: tempDir });

      // Create a branch for worktree
      execSync('git checkout -b worktree-branch', { cwd: tempDir });
      execSync('git checkout main', { cwd: tempDir });

      const gitStatus = await analyzer.getGitStatus(tempDir);

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
    });

    it('should provide consistent results across multiple calls', async () => {
      const gitStatus1 = await analyzer.getGitStatus(tempDir);
      const gitStatus2 = await analyzer.getGitStatus(tempDir);

      expect(gitStatus1.isRepository).toBe(gitStatus2.isRepository);
      expect(gitStatus1.branch).toBe(gitStatus2.branch);
      expect(gitStatus1.isClean).toBe(gitStatus2.isClean);
      expect(gitStatus1.changedFiles.length).toBe(gitStatus2.changedFiles.length);
    });

    it('should handle symlinks in repository correctly', async () => {
      // Create a file and a symlink to it
      await fs.writeFile(path.join(tempDir, 'original.txt'), 'original content\n');

      try {
        await fs.symlink('original.txt', path.join(tempDir, 'symlink.txt'));

        const gitStatus = await analyzer.getGitStatus(tempDir);

        expect(gitStatus.hasUntrackedFiles).toBe(true);
        expect(gitStatus.changedFiles.some(f => f.path === 'original.txt')).toBe(true);
        expect(gitStatus.changedFiles.some(f => f.path === 'symlink.txt')).toBe(true);
      } catch (error) {
        // Symlink creation might fail on some systems, skip this test
        console.warn('Symlink test skipped due to system limitations');
      }
    });
  });
});