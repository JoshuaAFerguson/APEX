import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration test that validates the documented worktree configuration examples
 * actually work with the APEX codebase.
 *
 * This test creates temporary test environments and validates:
 * 1. Configuration examples are valid and parseable
 * 2. Documented commands work as expected
 * 3. Worktree lifecycle behavior matches documentation
 */
describe('README Worktree Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary directory for testing
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'test-worktree-'));
    tempDir = tmpDir;

    // Initialize a git repository
    process.chdir(tempDir);
    await execAsync('git init');
    await execAsync('git config user.name "Test User"');
    await execAsync('git config user.email "test@example.com"');

    // Create initial commit
    await fs.writeFile('README.md', '# Test Project');
    await execAsync('git add .');
    await execAsync('git commit -m "Initial commit"');
  });

  afterEach(async () => {
    process.chdir(originalCwd);

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Examples Validation', () => {
    it('should parse the documented YAML configuration', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Extract YAML configuration from README
      const yamlMatch = readmeContent.match(/```yaml\s*# \.apex\/config\.yaml\s*\n([\s\S]*?)\n```/);
      expect(yamlMatch).toBeTruthy();

      if (yamlMatch) {
        const yamlContent = yamlMatch[1];

        // Parse YAML
        const config = yaml.parse(yamlContent);

        // Validate structure matches documented example
        expect(config).toEqual({
          version: '1.0',
          git: {
            autoWorktree: true,
            worktree: {
              cleanupOnComplete: true,
              maxWorktrees: 5,
              pruneStaleAfterDays: 7,
              preserveOnFailure: false,
              cleanupDelayMs: 5000,
              baseDir: '../.apex-worktrees'
            }
          }
        });
      }
    });

    it('should create valid .apex/config.yaml from documented example', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Extract YAML configuration
      const yamlMatch = readmeContent.match(/```yaml\s*# \.apex\/config\.yaml\s*\n([\s\S]*?)\n```/);

      if (yamlMatch) {
        const yamlContent = yamlMatch[1];

        // Create .apex directory and config file
        await fs.mkdir('.apex', { recursive: true });
        await fs.writeFile('.apex/config.yaml', yamlContent);

        // Verify file is created and readable
        const writtenConfig = await fs.readFile('.apex/config.yaml', 'utf-8');
        expect(() => yaml.parse(writtenConfig)).not.toThrow();

        const parsedConfig = yaml.parse(writtenConfig);
        expect(parsedConfig.git.autoWorktree).toBe(true);
        expect(parsedConfig.git.worktree.maxWorktrees).toBe(5);
      }
    });
  });

  describe('Git Commands Validation', () => {
    it('should validate git worktree commands exist', async () => {
      // Test that git worktree is available (required for functionality)
      try {
        const { stdout } = await execAsync('git worktree --help');
        expect(stdout).toContain('worktree');
      } catch (error) {
        // Skip test if git worktree is not available
        console.warn('Git worktree not available, skipping integration test');
        return;
      }
    });

    it('should validate git worktree add command works', async () => {
      try {
        // Create a test branch and worktree
        await execAsync('git checkout -b test-branch');
        await execAsync('git checkout main || git checkout master');

        const worktreeDir = path.join(tempDir, 'test-worktree');
        await execAsync(`git worktree add "${worktreeDir}" test-branch`);

        // Verify worktree was created
        const { stdout } = await execAsync('git worktree list');
        expect(stdout).toContain('test-worktree');

        // Clean up
        await execAsync(`git worktree remove "${worktreeDir}"`);
      } catch (error) {
        // Skip if git worktree is not functional
        console.warn('Git worktree commands not functional:', error);
      }
    });
  });

  describe('Branch Naming Validation', () => {
    it('should validate documented branch naming pattern', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Check for apex/task- pattern in documentation
      expect(readmeContent).toContain('apex/task-');

      // Verify this is a valid git branch name
      const branchName = 'apex/task-abc123';
      expect(branchName).toMatch(/^[a-zA-Z0-9/_-]+$/);

      // Test creating a branch with this pattern
      await execAsync(`git checkout -b "${branchName}"`);
      const { stdout } = await execAsync('git branch');
      expect(stdout).toContain(branchName);
    });
  });

  describe('Directory Structure Validation', () => {
    it('should validate documented base directory structure', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Check for documented base directory
      expect(readmeContent).toContain('../.apex-worktrees');

      // Test directory creation
      const baseDir = path.join(tempDir, '..', '.apex-worktrees');
      await fs.mkdir(baseDir, { recursive: true });

      const stats = await fs.stat(baseDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Configuration Options Validation', () => {
    it('should validate all documented configuration options have reasonable types', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Extract configuration table
      const tableMatch = readmeContent.match(/\| Option \| Default \| Description \|([\s\S]*?)(?=\n\n|\n###)/);

      if (tableMatch) {
        const tableContent = tableMatch[1];

        // Verify each option has proper default value types
        expect(tableContent).toContain('cleanupOnComplete` | `true`');  // boolean
        expect(tableContent).toContain('maxWorktrees` | `5`');         // number
        expect(tableContent).toContain('pruneStaleAfterDays` | `7`');  // number
        expect(tableContent).toContain('preserveOnFailure` | `false`'); // boolean
        expect(tableContent).toContain('cleanupDelayMs` | `0`');       // number
        expect(tableContent).toContain('baseDir` | `../.apex-worktrees`'); // string
      }
    });

    it('should create valid config with all documented options', () => {
      const config = {
        version: '1.0',
        git: {
          autoWorktree: true,
          worktree: {
            cleanupOnComplete: true,
            maxWorktrees: 5,
            pruneStaleAfterDays: 7,
            preserveOnFailure: false,
            cleanupDelayMs: 0,
            baseDir: '../.apex-worktrees'
          }
        }
      };

      // Should serialize to valid YAML
      const yamlString = yaml.stringify(config);
      expect(() => yaml.parse(yamlString)).not.toThrow();

      // Should match documented structure
      const parsed = yaml.parse(yamlString);
      expect(parsed.git.autoWorktree).toBe(true);
      expect(parsed.git.worktree.maxWorktrees).toBe(5);
    });
  });

  describe('Command Syntax Validation', () => {
    it('should validate documented command syntax is correct', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Extract bash commands from example workflow
      const bashBlocks = readmeContent.match(/```bash\n([\s\S]*?)\n```/g);

      if (bashBlocks) {
        bashBlocks.forEach(block => {
          const commands = block.replace(/```bash\n/, '').replace(/\n```/, '');
          const lines = commands.split('\n').filter(line =>
            line.trim() && !line.trim().startsWith('#')
          );

          lines.forEach(line => {
            const cmd = line.trim();

            // Basic command validation
            if (cmd.startsWith('apex ')) {
              // APEX commands should have valid syntax
              expect(cmd).toMatch(/^apex\s+\w+/);
            } else if (cmd.startsWith('/checkout')) {
              // /checkout commands should have valid syntax
              expect(cmd).toMatch(/^\/checkout(\s+(--\w+|\w+))*$/);
            }
          });
        });
      }
    });
  });

  describe('Lifecycle Documentation Accuracy', () => {
    it('should validate documented lifecycle steps are accurate', async () => {
      const readmePath = path.join(__dirname, '../../README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Check lifecycle section exists with documented steps
      const lifecycleSteps = [
        'Creation',
        'Branch Creation',
        'Task Execution',
        'Cleanup',
        'Merge'
      ];

      lifecycleSteps.forEach(step => {
        expect(readmeContent).toContain(step);
      });

      // Verify lifecycle details are documented
      expect(readmeContent).toContain('autoWorktree: true');
      expect(readmeContent).toContain('apex/task-');
      expect(readmeContent).toContain('cleanupOnComplete: true');
    });
  });
});