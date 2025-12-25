import { describe, it, expect } from 'vitest';
import { GitConfigSchema, ApexConfigSchema, WorktreeConfigSchema } from '../types';

describe('cleanupDelayMs Integration Tests', () => {
  describe('Configuration Integration', () => {
    it('should work correctly in GitConfig context', () => {
      const gitConfig = GitConfigSchema.parse({
        branchPrefix: 'apex/',
        autoWorktree: true,
        worktree: {
          cleanupDelayMs: 3000,
          maxWorktrees: 8,
          cleanupOnComplete: true,
        },
      });

      expect(gitConfig.autoWorktree).toBe(true);
      expect(gitConfig.worktree?.cleanupDelayMs).toBe(3000);
      expect(gitConfig.worktree?.maxWorktrees).toBe(8);
      expect(gitConfig.worktree?.cleanupOnComplete).toBe(true);
    });

    it('should work correctly in full ApexConfig context', () => {
      const apexConfig = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'nodejs',
        },
        git: {
          branchPrefix: 'apex/',
          autoWorktree: true,
          worktree: {
            baseDir: '/tmp/apex-worktrees',
            cleanupDelayMs: 2500,
            maxWorktrees: 5,
            preserveOnFailure: true,
          },
        },
        limits: {
          maxConcurrentTasks: 3,
        },
      });

      // Verify the cleanupDelayMs is correctly nested and parsed
      expect(apexConfig.git?.worktree?.cleanupDelayMs).toBe(2500);
      expect(apexConfig.git?.autoWorktree).toBe(true);
      expect(apexConfig.git?.worktree?.baseDir).toBe('/tmp/apex-worktrees');
      expect(apexConfig.git?.worktree?.preserveOnFailure).toBe(true);
    });

    it('should maintain defaults when cleanupDelayMs is not specified', () => {
      const apexConfig = ApexConfigSchema.parse({
        project: { name: 'test' },
        git: {
          autoWorktree: true,
          worktree: {
            maxWorktrees: 10,
            // cleanupDelayMs not specified, should default to 0
          },
        },
      });

      expect(apexConfig.git?.worktree?.cleanupDelayMs).toBe(0);
      expect(apexConfig.git?.worktree?.maxWorktrees).toBe(10);
    });

    it('should work with partial worktree configuration', () => {
      const gitConfig = GitConfigSchema.parse({
        autoWorktree: true,
        worktree: {
          cleanupDelayMs: 1500,
          // Other fields should use defaults
        },
      });

      expect(gitConfig.worktree?.cleanupDelayMs).toBe(1500);
      expect(gitConfig.worktree?.cleanupOnComplete).toBe(true); // default
      expect(gitConfig.worktree?.maxWorktrees).toBe(5); // default
      expect(gitConfig.worktree?.preserveOnFailure).toBe(false); // default
    });

    it('should validate cleanupDelayMs in nested configuration', () => {
      // Should reject negative values even in nested config
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test' },
          git: {
            autoWorktree: true,
            worktree: {
              cleanupDelayMs: -1000,
            },
          },
        });
      }).toThrow();

      // Should reject invalid types even in nested config
      expect(() => {
        GitConfigSchema.parse({
          autoWorktree: true,
          worktree: {
            cleanupDelayMs: '5000', // String instead of number
          },
        });
      }).toThrow();
    });
  });

  describe('Real-world configuration scenarios', () => {
    it('should support development team configuration', () => {
      const devTeamConfig = ApexConfigSchema.parse({
        project: {
          name: 'team-project',
          language: 'typescript',
          testCommand: 'npm test',
          buildCommand: 'npm run build',
        },
        git: {
          branchPrefix: 'feature/',
          autoWorktree: true,
          worktree: {
            baseDir: '/shared/worktrees',
            cleanupDelayMs: 10000, // 10 second delay for team debugging
            maxWorktrees: 10,
            cleanupOnComplete: true,
            preserveOnFailure: true,
          },
        },
        limits: {
          maxConcurrentTasks: 5,
          maxTokensPerTask: 100000,
        },
      });

      expect(devTeamConfig.git?.worktree?.cleanupDelayMs).toBe(10000);
      expect(devTeamConfig.git?.worktree?.preserveOnFailure).toBe(true);
    });

    it('should support CI/CD environment configuration', () => {
      const cicdConfig = ApexConfigSchema.parse({
        project: {
          name: 'ci-project',
          language: 'javascript',
        },
        git: {
          branchPrefix: 'ci/',
          autoWorktree: true,
          worktree: {
            cleanupDelayMs: 0, // No delay in CI - immediate cleanup
            maxWorktrees: 3,
            cleanupOnComplete: true,
            preserveOnFailure: false,
          },
        },
        autonomy: {
          default: 'full', // Full automation in CI
        },
      });

      expect(cicdConfig.git?.worktree?.cleanupDelayMs).toBe(0);
      expect(cicdConfig.git?.worktree?.preserveOnFailure).toBe(false);
      expect(cicdConfig.autonomy?.default).toBe('full');
    });

    it('should support production environment configuration', () => {
      const prodConfig = ApexConfigSchema.parse({
        project: {
          name: 'production-project',
          language: 'typescript',
          framework: 'express',
        },
        git: {
          branchPrefix: 'prod/',
          autoWorktree: true,
          worktree: {
            baseDir: '/var/lib/apex/worktrees',
            cleanupDelayMs: 60000, // 1 minute delay for production debugging
            maxWorktrees: 20,
            cleanupOnComplete: true,
            preserveOnFailure: true,
            pruneStaleAfterDays: 30,
          },
        },
        limits: {
          maxConcurrentTasks: 10,
          maxCostPerTask: 50.0,
          dailyBudget: 500.0,
        },
      });

      expect(prodConfig.git?.worktree?.cleanupDelayMs).toBe(60000);
      expect(prodConfig.git?.worktree?.maxWorktrees).toBe(20);
      expect(prodConfig.git?.worktree?.pruneStaleAfterDays).toBe(30);
    });
  });

  describe('Configuration validation edge cases', () => {
    it('should handle configuration without git section', () => {
      const minimalConfig = ApexConfigSchema.parse({
        project: { name: 'minimal' },
      });

      expect(minimalConfig.git?.worktree?.cleanupDelayMs).toBeUndefined();
    });

    it('should handle configuration with git but no worktree section', () => {
      const gitOnlyConfig = ApexConfigSchema.parse({
        project: { name: 'git-only' },
        git: {
          branchPrefix: 'apex/',
          autoWorktree: false,
        },
      });

      expect(gitOnlyConfig.git.autoWorktree).toBe(false);
      expect(gitOnlyConfig.git.worktree).toBeUndefined();
    });

    it('should handle configuration with autoWorktree but no worktree config', () => {
      const autoWorktreeOnlyConfig = ApexConfigSchema.parse({
        project: { name: 'auto-worktree-only' },
        git: {
          autoWorktree: true,
        },
      });

      expect(autoWorktreeOnlyConfig.git.autoWorktree).toBe(true);
      expect(autoWorktreeOnlyConfig.git.worktree).toBeUndefined();
    });

    it('should handle deeply nested configuration access patterns', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'deep-nested' },
        git: {
          autoWorktree: true,
          worktree: {
            cleanupDelayMs: 7500,
          },
        },
      });

      // Test safe navigation patterns that might be used in the code
      const cleanupDelay = config.git?.worktree?.cleanupDelayMs ?? 0;
      expect(cleanupDelay).toBe(7500);

      // Test that this works even when sections are missing
      const configNoGit = ApexConfigSchema.parse({
        project: { name: 'no-git' },
      });

      const defaultDelay = configNoGit.git?.worktree?.cleanupDelayMs ?? 0;
      expect(defaultDelay).toBe(0);
    });
  });

  describe('Type safety in configuration contexts', () => {
    it('should maintain type safety across all configuration levels', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'type-safe' },
        git: {
          autoWorktree: true,
          worktree: {
            cleanupDelayMs: 5000,
            maxWorktrees: 8,
            cleanupOnComplete: false,
          },
        },
      });

      // These should all be properly typed
      expect(typeof config.git?.worktree?.cleanupDelayMs).toBe('number');
      expect(typeof config.git?.worktree?.maxWorktrees).toBe('number');
      expect(typeof config.git?.worktree?.cleanupOnComplete).toBe('boolean');
      expect(typeof config.git?.autoWorktree).toBe('boolean');

      // Values should be what we expect
      expect(config.git?.worktree?.cleanupDelayMs).toBe(5000);
      expect(config.git?.worktree?.maxWorktrees).toBe(8);
      expect(config.git?.worktree?.cleanupOnComplete).toBe(false);
    });

    it('should work with destructuring patterns', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'destructuring-test' },
        git: {
          autoWorktree: true,
          worktree: {
            cleanupDelayMs: 3500,
            preserveOnFailure: true,
          },
        },
      });

      // Common destructuring patterns
      const { git } = config;
      const { worktree } = git || {};
      const { cleanupDelayMs = 0, preserveOnFailure = false } = worktree || {};

      expect(cleanupDelayMs).toBe(3500);
      expect(preserveOnFailure).toBe(true);
    });
  });
});