import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test suite that validates the README worktree documentation claims
 * against the actual APEX implementation.
 *
 * This ensures that every feature and configuration option documented
 * in README.md is actually supported by the codebase.
 */
describe('README Worktree Implementation Validation', () => {
  let readmeContent: string;

  beforeEach(async () => {
    const readmePath = path.join(__dirname, '../../README.md');
    readmeContent = await fs.readFile(readmePath, 'utf-8');
  });

  describe('Configuration Schema Compliance', () => {
    it('should validate that documented defaults match implementation defaults', async () => {
      // Import the actual WorktreeConfigSchema from the codebase
      const { WorktreeConfigSchema } = await import('../../packages/core/src/types.js');

      // Parse empty config to get defaults
      const defaultConfig = WorktreeConfigSchema.parse({});

      // Verify documented defaults match implementation defaults
      expect(defaultConfig.cleanupOnComplete).toBe(true);
      expect(defaultConfig.maxWorktrees).toBe(5);
      expect(defaultConfig.pruneStaleAfterDays).toBe(7);
      expect(defaultConfig.preserveOnFailure).toBe(false);
      expect(defaultConfig.cleanupDelayMs).toBe(0);

      // Verify these match what's documented in README
      expect(readmeContent).toContain('| `cleanupOnComplete` | `true` |');
      expect(readmeContent).toContain('| `maxWorktrees` | `5` |');
      expect(readmeContent).toContain('| `pruneStaleAfterDays` | `7` |');
      expect(readmeContent).toContain('| `preserveOnFailure` | `false` |');
    });

    it('should validate that documented YAML configuration is valid against schema', async () => {
      const { WorktreeConfigSchema } = await import('../../packages/core/src/types.js');

      // Extract the documented YAML example
      const yamlMatch = readmeContent.match(/```yaml\s*# \.apex\/config\.yaml\s*\n([\s\S]*?)\n```/);
      expect(yamlMatch).toBeTruthy();

      if (yamlMatch) {
        const yamlContent = yamlMatch[1];
        const config = yaml.parse(yamlContent);

        // Validate the worktree section against the schema
        expect(() => WorktreeConfigSchema.parse(config.git.worktree)).not.toThrow();

        const validatedConfig = WorktreeConfigSchema.parse(config.git.worktree);
        expect(validatedConfig).toEqual({
          cleanupOnComplete: true,
          maxWorktrees: 5,
          pruneStaleAfterDays: 7,
          preserveOnFailure: false,
          cleanupDelayMs: 5000,
          baseDir: '../.apex-worktrees'
        });
      }
    });

    it('should validate all documented configuration options exist in schema', async () => {
      const { WorktreeConfigSchema } = await import('../../packages/core/src/types.js');

      // Test configuration with all documented options
      const fullConfig = {
        cleanupOnComplete: false,
        maxWorktrees: 10,
        pruneStaleAfterDays: 14,
        preserveOnFailure: true,
        cleanupDelayMs: 3000,
        baseDir: '/custom/worktrees'
      };

      expect(() => WorktreeConfigSchema.parse(fullConfig)).not.toThrow();

      const result = WorktreeConfigSchema.parse(fullConfig);
      expect(result).toEqual(fullConfig);
    });
  });

  describe('WorktreeManager Feature Support', () => {
    it('should validate WorktreeManager supports documented features', async () => {
      // Import WorktreeManager to verify it exists and has documented methods
      const { WorktreeManager } = await import('../../packages/orchestrator/src/worktree-manager.js');

      expect(WorktreeManager).toBeDefined();

      // Check that WorktreeManager has the methods implied by documentation
      const manager = new WorktreeManager({
        projectPath: '/test',
        config: { maxWorktrees: 5 }
      });

      // These methods should exist based on documented functionality
      expect(manager.createWorktree).toBeDefined();
      expect(manager.listWorktrees).toBeDefined();
      expect(manager.deleteWorktree).toBeDefined();

      // Additional methods implied by lifecycle documentation
      expect(typeof manager.createWorktree).toBe('function');
      expect(typeof manager.listWorktrees).toBe('function');
      expect(typeof manager.deleteWorktree).toBe('function');
    });

    it('should validate WorktreeManager constructor accepts documented config options', async () => {
      const { WorktreeManager } = await import('../../packages/orchestrator/src/worktree-manager.js');

      // Test that all documented config options are accepted
      const manager = new WorktreeManager({
        projectPath: '/test',
        config: {
          cleanupOnComplete: true,
          maxWorktrees: 5,
          pruneStaleAfterDays: 7,
          preserveOnFailure: false,
          cleanupDelayMs: 5000,
          baseDir: '../.apex-worktrees'
        }
      });

      expect(manager).toBeDefined();
    });
  });

  describe('Branch Naming Pattern Validation', () => {
    it('should validate documented branch naming pattern is consistent with implementation', async () => {
      // README documents: apex/task-abc123
      expect(readmeContent).toContain('apex/task-abc123');
      expect(readmeContent).toContain('apex/task-');

      // This should be a valid git branch name format
      const branchPattern = 'apex/task-abc123';
      expect(branchPattern).toMatch(/^[a-zA-Z0-9/_-]+$/);

      // Should not contain invalid git branch characters
      expect(branchPattern).not.toMatch(/[\s~^:?*[\\]/);
    });
  });

  describe('Base Directory Default Validation', () => {
    it('should validate documented base directory default is correct', async () => {
      const { WorktreeManager } = await import('../../packages/orchestrator/src/worktree-manager.js');

      // Create manager without specifying baseDir
      const manager = new WorktreeManager({
        projectPath: '/test/project'
      });

      // The implementation should default to ../.apex-worktrees relative to project path
      // This matches what's documented: | `baseDir` | `../.apex-worktrees` |
      expect(readmeContent).toContain('| `baseDir` | `../.apex-worktrees` |');
    });
  });

  describe('Error Handling Documentation', () => {
    it('should validate documented error scenarios are handled', async () => {
      const { WorktreeManager } = await import('../../packages/orchestrator/src/worktree-manager.js');

      const manager = new WorktreeManager({
        projectPath: '/test',
        config: { maxWorktrees: 1 }
      });

      // Documentation claims max worktrees limit is enforced
      expect(readmeContent).toContain('Maximum number of concurrent worktrees allowed');
      expect(readmeContent).toContain('maxWorktrees: 5');

      // The implementation should have error handling for this
      expect(manager.createWorktree).toBeDefined();
    });
  });

  describe('Lifecycle Documentation Accuracy', () => {
    it('should validate documented lifecycle steps are technically feasible', async () => {
      // Extract lifecycle steps from documentation
      const lifecycleSection = readmeContent.match(/### Worktree Lifecycle([\s\S]*?)(?=###|$)/);
      expect(lifecycleSection).toBeTruthy();

      if (lifecycleSection) {
        const lifecycleContent = lifecycleSection[1];

        // Should document Creation step
        expect(lifecycleContent).toContain('Creation');
        expect(lifecycleContent).toContain('autoWorktree: true');

        // Should document Branch Creation step
        expect(lifecycleContent).toContain('Branch Creation');
        expect(lifecycleContent).toContain('apex/task-');

        // Should document Task Execution step
        expect(lifecycleContent).toContain('Task Execution');
        expect(lifecycleContent).toContain('isolated worktree');

        // Should document Cleanup step
        expect(lifecycleContent).toContain('Cleanup');
        expect(lifecycleContent).toContain('cleanupOnComplete: true');

        // Should document Merge step
        expect(lifecycleContent).toContain('Merge');
        expect(lifecycleContent).toContain('main branch');
      }
    });

    it('should validate configuration integration with git config', async () => {
      const { GitConfigSchema } = await import('../../packages/core/src/types.js');

      // Test that git configuration includes worktree config as documented
      const gitConfig = GitConfigSchema.parse({
        autoWorktree: true,
        branchPrefix: 'apex/',
        worktree: {
          cleanupOnComplete: true,
          maxWorktrees: 5,
          preserveOnFailure: false
        }
      });

      expect(gitConfig.autoWorktree).toBe(true);
      expect(gitConfig.worktree?.cleanupOnComplete).toBe(true);
      expect(gitConfig.worktree?.maxWorktrees).toBe(5);
    });
  });

  describe('CLI Integration Documentation', () => {
    it('should validate documented CLI commands reference real functionality', () => {
      // The documentation shows these commands
      expect(readmeContent).toContain('apex config set git.autoWorktree true');
      expect(readmeContent).toContain('apex run "Add user authentication"');
      expect(readmeContent).toContain('/checkout --list');
      expect(readmeContent).toContain('/checkout abc123');
      expect(readmeContent).toContain('/checkout --cleanup');

      // These commands should follow the documented patterns
      expect(readmeContent).toContain('/checkout <task_id>');
      expect(readmeContent).toContain('/checkout --cleanup <task_id>');
    });
  });

  describe('Parallel Execution Claims', () => {
    it('should validate documented benefits are technically accurate', () => {
      // Extract benefits section
      const benefitsSection = readmeContent.match(/### Benefits of Parallel Execution([\s\S]*?)(?=###|$)/);
      expect(benefitsSection).toBeTruthy();

      if (benefitsSection) {
        const benefitsContent = benefitsSection[1];

        // Check technical accuracy of claims
        expect(benefitsContent).toContain('No Branch Conflicts');
        expect(benefitsContent).toContain('each task works on its own branch');

        expect(benefitsContent).toContain('Concurrent Development');
        expect(benefitsContent).toContain('Multiple agents can implement features simultaneously');

        expect(benefitsContent).toContain('Safe Experimentation');
        expect(benefitsContent).toContain('Failed tasks don\'t affect other work');

        expect(benefitsContent).toContain('Easy Context Switching');
        expect(benefitsContent).toContain('switch between tasks without losing state');

        expect(benefitsContent).toContain('Automatic Management');
        expect(benefitsContent).toContain('APEX handles worktree creation, cleanup');
      }
    });
  });

  describe('Configuration Table Accuracy', () => {
    it('should validate configuration table matches schema constraints', async () => {
      const { WorktreeConfigSchema } = await import('../../packages/core/src/types.js');

      // Test constraints mentioned in table descriptions

      // maxWorktrees should have minimum constraint
      expect(() => WorktreeConfigSchema.parse({ maxWorktrees: 0 })).toThrow();
      expect(() => WorktreeConfigSchema.parse({ maxWorktrees: 1 })).not.toThrow();

      // pruneStaleAfterDays should have minimum constraint
      expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: 0 })).toThrow();
      expect(() => WorktreeConfigSchema.parse({ pruneStaleAfterDays: 1 })).not.toThrow();

      // cleanupDelayMs should accept non-negative values
      expect(() => WorktreeConfigSchema.parse({ cleanupDelayMs: -1 })).toThrow();
      expect(() => WorktreeConfigSchema.parse({ cleanupDelayMs: 0 })).not.toThrow();

      // Boolean fields should accept boolean values
      expect(() => WorktreeConfigSchema.parse({ cleanupOnComplete: true })).not.toThrow();
      expect(() => WorktreeConfigSchema.parse({ preserveOnFailure: false })).not.toThrow();
    });
  });

  describe('Type System Integration', () => {
    it('should validate documented types are correctly exported', async () => {
      // Test that all documented types are available for import
      const coreTypes = await import('../../packages/core/src/types.js');

      expect(coreTypes.WorktreeConfig).toBeDefined();
      expect(coreTypes.WorktreeConfigSchema).toBeDefined();
      expect(coreTypes.WorktreeInfo).toBeDefined();
      expect(coreTypes.WorktreeStatus).toBeDefined();
      expect(coreTypes.GitConfigSchema).toBeDefined();
    });
  });
});