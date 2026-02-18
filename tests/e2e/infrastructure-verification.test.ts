/**
 * @fileoverview Infrastructure verification test for APEX E2E test suite
 *
 * This test verifies that the E2E test infrastructure is properly configured
 * and can execute basic operations. It serves as a smoke test for the
 * testing environment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('E2E Infrastructure Verification', () => {
  let testDir: string;

  beforeEach(async () => {
    // Use the global E2E helpers that should be available
    expect(globalThis.apexE2EHelpers).toBeDefined();
    testDir = await globalThis.apexE2EHelpers.createTempDir('infra-test-');
  });

  describe('Global E2E Helpers', () => {
    it('should provide all required helper functions', () => {
      const helpers = globalThis.apexE2EHelpers;

      expect(helpers.createTempDir).toBeInstanceOf(Function);
      expect(helpers.registerTempDir).toBeInstanceOf(Function);
      expect(helpers.registerOrchestrator).toBeInstanceOf(Function);
      expect(helpers.registerServer).toBeInstanceOf(Function);
      expect(helpers.registerStore).toBeInstanceOf(Function);
      expect(helpers.createTempGitRepo).toBeInstanceOf(Function);
      expect(helpers.createBareGitRepo).toBeInstanceOf(Function);
      expect(helpers.cleanupAll).toBeInstanceOf(Function);
      expect(helpers.waitFor).toBeInstanceOf(Function);
      expect(helpers.createTestId).toBeInstanceOf(Function);
      expect(helpers.createApexProject).toBeInstanceOf(Function);
    });
  });

  describe('Temporary Directory Management', () => {
    it('should create unique temporary directories', async () => {
      const dir1 = await globalThis.apexE2EHelpers.createTempDir('test1-');
      const dir2 = await globalThis.apexE2EHelpers.createTempDir('test2-');

      expect(dir1).toBeDefined();
      expect(dir2).toBeDefined();
      expect(dir1).not.toBe(dir2);

      // Verify directories exist
      const stat1 = await fs.stat(dir1);
      const stat2 = await fs.stat(dir2);
      expect(stat1.isDirectory()).toBe(true);
      expect(stat2.isDirectory()).toBe(true);

      // Verify they have the correct prefixes
      expect(path.basename(dir1)).toMatch(/^test1-/);
      expect(path.basename(dir2)).toMatch(/^test2-/);
    });

    it('should register directories for cleanup', async () => {
      const customDir = await globalThis.apexE2EHelpers.createTempDir('custom-');

      // Write a test file to verify directory exists
      await fs.writeFile(path.join(customDir, 'test.txt'), 'test content');

      const fileExists = await fs.access(path.join(customDir, 'test.txt'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe('Git Repository Helpers', () => {
    it('should create valid git repositories', async () => {
      const repoDir = await globalThis.apexE2EHelpers.createTempGitRepo('test-repo-');

      // Verify .git directory exists
      const gitDir = path.join(repoDir, '.git');
      const gitStat = await fs.stat(gitDir);
      expect(gitStat.isDirectory()).toBe(true);

      // Verify README.md was created
      const readmePath = path.join(repoDir, 'README.md');
      const readmeExists = await fs.access(readmePath)
        .then(() => true)
        .catch(() => false);
      expect(readmeExists).toBe(true);
    });

    it('should create valid bare git repositories', async () => {
      const bareRepoDir = await globalThis.apexE2EHelpers.createBareGitRepo('bare-repo-');

      // Verify it's a bare repo (has HEAD file directly)
      const headPath = path.join(bareRepoDir, 'HEAD');
      const headExists = await fs.access(headPath)
        .then(() => true)
        .catch(() => false);
      expect(headExists).toBe(true);

      // Verify config indicates it's bare
      const configPath = path.join(bareRepoDir, 'config');
      const configContent = await fs.readFile(configPath, 'utf8');
      expect(configContent).toContain('bare = true');
    });
  });

  describe('Test Utilities', () => {
    it('should generate unique test IDs', () => {
      const id1 = globalThis.apexE2EHelpers.createTestId('test');
      const id2 = globalThis.apexE2EHelpers.createTestId('test');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_\d+_[a-z0-9]+$/);
    });

    it('should provide waitFor utility with timeout', async () => {
      let counter = 0;

      const result = await globalThis.apexE2EHelpers.waitFor(
        () => {
          counter++;
          return counter >= 3 ? 'success' : false;
        },
        { timeout: 5000, interval: 10 }
      );

      expect(result).toBe('success');
      expect(counter).toBeGreaterThanOrEqual(3);
    });

    it('should timeout when condition is never met', async () => {
      await expect(
        globalThis.apexE2EHelpers.waitFor(
          () => false,
          { timeout: 100, interval: 10, message: 'Test timeout' }
        )
      ).rejects.toThrow('Test timeout (timeout: 100ms)');
    });
  });

  describe('APEX Project Creation', () => {
    it('should create a valid APEX project structure', async () => {
      const projectDir = await globalThis.apexE2EHelpers.createTempDir('project-');

      await globalThis.apexE2EHelpers.createApexProject(projectDir, {
        projectName: 'test-project',
        includeAgents: true,
        includeWorkflows: true,
        initGit: true
      });

      // Verify .apex directory structure
      const apexDir = path.join(projectDir, '.apex');
      const apexStat = await fs.stat(apexDir);
      expect(apexStat.isDirectory()).toBe(true);

      // Verify config file
      const configPath = path.join(apexDir, 'config.yaml');
      const configExists = await fs.access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(configExists).toBe(true);

      // Verify agents directory
      const agentsDir = path.join(apexDir, 'agents');
      const agentsStat = await fs.stat(agentsDir);
      expect(agentsStat.isDirectory()).toBe(true);

      // Verify workflows directory
      const workflowsDir = path.join(apexDir, 'workflows');
      const workflowsStat = await fs.stat(workflowsDir);
      expect(workflowsStat.isDirectory()).toBe(true);

      // Verify git initialization
      const gitDir = path.join(projectDir, '.git');
      const gitStat = await fs.stat(gitDir);
      expect(gitStat.isDirectory()).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should be running in E2E test mode', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.APEX_TEST_MODE).toBe('e2e');
    });
  });
});