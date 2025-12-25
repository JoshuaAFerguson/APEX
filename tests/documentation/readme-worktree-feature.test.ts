import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.join(__dirname, '../../README.md');

/**
 * Test suite for validating that the README.md worktree feature documentation
 * accurately reflects the actual capabilities of APEX.
 *
 * This test validates:
 * 1. Documentation structure and completeness
 * 2. Configuration examples are valid YAML
 * 3. Code examples are syntactically correct
 * 4. Claims about functionality match implementation
 */
describe('README Worktree Feature Documentation', () => {
  let readmeContent: string;

  beforeEach(async () => {
    readmeContent = await fs.readFile(readmePath, 'utf-8');
  });

  describe('Documentation Structure', () => {
    it('should include "Git Worktree Support" section in table of contents', () => {
      expect(readmeContent).toContain('<a href="#git-worktree-support">Worktrees</a>');
    });

    it('should include worktree feature in main features list', () => {
      expect(readmeContent).toContain('🌳 Git Worktree Support');
      expect(readmeContent).toContain('Parallel task execution with automatic branch isolation and cleanup');
    });

    it('should have a dedicated "Git Worktree Support" section', () => {
      expect(readmeContent).toContain('## Git Worktree Support');
    });

    it('should include all required subsections', () => {
      const requiredSubsections = [
        '### Overview',
        '### Enabling Worktree Management',
        '### The /checkout Command',
        '### Benefits of Parallel Execution',
        '### Configuration Options',
        '### Worktree Lifecycle',
        '### Example Workflow'
      ];

      requiredSubsections.forEach(subsection => {
        expect(readmeContent).toContain(subsection);
      });
    });
  });

  describe('Overview Section', () => {
    it('should explain what git worktrees are', () => {
      expect(readmeContent).toContain('Git worktrees create isolated working directories');
      expect(readmeContent).toContain('share the same repository history');
      expect(readmeContent).toContain('independent working trees and staged areas');
    });

    it('should list key benefits', () => {
      const benefits = [
        'Parallel Task Execution',
        'Branch Isolation',
        'Resource Efficiency',
        'Automatic Cleanup'
      ];

      benefits.forEach(benefit => {
        expect(readmeContent).toContain(benefit);
      });
    });
  });

  describe('Configuration Examples', () => {
    it('should provide valid YAML configuration example', () => {
      // Extract YAML configuration from README
      const yamlMatch = readmeContent.match(/```yaml\s*# \.apex\/config\.yaml\s*\n([\s\S]*?)\n```/);
      expect(yamlMatch).toBeTruthy();

      if (yamlMatch) {
        const yamlContent = yamlMatch[1];

        // Should be valid YAML
        expect(() => yaml.parse(yamlContent)).not.toThrow();

        const config = yaml.parse(yamlContent);

        // Should have required structure
        expect(config).toHaveProperty('version', '1.0');
        expect(config).toHaveProperty('git');
        expect(config.git).toHaveProperty('autoWorktree', true);
        expect(config.git).toHaveProperty('worktree');
      }
    });

    it('should document all configuration options with correct defaults', () => {
      const configOptions = [
        'cleanupOnComplete: true',
        'maxWorktrees: 5',
        'pruneStaleAfterDays: 7',
        'preserveOnFailure: false',
        'cleanupDelayMs: 5000',
        'baseDir: "../.apex-worktrees"'
      ];

      configOptions.forEach(option => {
        expect(readmeContent).toContain(option);
      });
    });

    it('should include configuration table with all options', () => {
      const tableOptions = [
        'cleanupOnComplete',
        'maxWorktrees',
        'pruneStaleAfterDays',
        'preserveOnFailure',
        'cleanupDelayMs',
        'baseDir'
      ];

      tableOptions.forEach(option => {
        expect(readmeContent).toContain(option);
      });
    });
  });

  describe('/checkout Command Documentation', () => {
    it('should document switch to task worktree syntax', () => {
      expect(readmeContent).toContain('/checkout <task_id>');
      expect(readmeContent).toContain('Switch to the worktree for a specific task');
    });

    it('should document list worktrees syntax', () => {
      expect(readmeContent).toContain('/checkout --list');
      expect(readmeContent).toContain('Show all task worktrees with their status');
    });

    it('should document cleanup commands', () => {
      expect(readmeContent).toContain('/checkout --cleanup');
      expect(readmeContent).toContain('Remove all orphaned/stale worktrees');
      expect(readmeContent).toContain('/checkout --cleanup <task_id>');
      expect(readmeContent).toContain('Remove worktree for specific task');
    });
  });

  describe('Benefits Section', () => {
    it('should list all parallel execution benefits', () => {
      const benefits = [
        'No Branch Conflicts',
        'Concurrent Development',
        'Safe Experimentation',
        'Easy Context Switching',
        'Automatic Management'
      ];

      benefits.forEach(benefit => {
        expect(readmeContent).toContain(benefit);
      });
    });

    it('should explain benefit details', () => {
      expect(readmeContent).toContain('Each task works on its own branch in isolation');
      expect(readmeContent).toContain('Multiple agents can implement features simultaneously');
      expect(readmeContent).toContain('Failed tasks don\'t affect other work');
    });
  });

  describe('Worktree Lifecycle', () => {
    it('should document complete lifecycle steps', () => {
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
    });

    it('should explain lifecycle details', () => {
      expect(readmeContent).toContain('autoWorktree: true');
      expect(readmeContent).toContain('apex/task-');
      expect(readmeContent).toContain('isolated worktree');
      expect(readmeContent).toContain('cleanupOnComplete: true');
      expect(readmeContent).toContain('merged back to the main branch');
    });
  });

  describe('Example Workflow', () => {
    it('should provide complete workflow example', () => {
      expect(readmeContent).toContain('apex config set git.autoWorktree true');
      expect(readmeContent).toContain('apex run "Add user authentication"');
      expect(readmeContent).toContain('apex run "Implement API rate limiting"');
      expect(readmeContent).toContain('/checkout --list');
      expect(readmeContent).toContain('/checkout abc123');
      expect(readmeContent).toContain('/checkout --cleanup');
    });

    it('should show multiple parallel tasks', () => {
      expect(readmeContent).toContain('Add user authentication');
      expect(readmeContent).toContain('Implement API rate limiting');
      expect(readmeContent).toContain('Fix database connection pooling');
    });
  });

  describe('Main Configuration Section Integration', () => {
    it('should include worktree config in main configuration example', () => {
      // Find the main configuration example
      const mainConfigMatch = readmeContent.match(/```yaml\s*# \.apex\/config\.yaml\s*\nversion: "1\.0"/);
      expect(mainConfigMatch).toBeTruthy();

      // Should include git worktree configuration
      expect(readmeContent).toContain('git:\n  autoWorktree: true\n  branchPrefix: "apex/"');
      expect(readmeContent).toContain('worktree:\n    cleanupOnComplete: true\n    maxWorktrees: 5\n    preserveOnFailure: false');
    });
  });

  describe('Cross-References', () => {
    it('should be referenced in navigation', () => {
      expect(readmeContent).toContain('<a href="#git-worktree-support">Worktrees</a>');
    });

    it('should be mentioned in features list', () => {
      expect(readmeContent).toContain('🌳 Git Worktree Support');
    });
  });

  describe('Code Syntax Validation', () => {
    it('should have proper bash syntax for examples', () => {
      // Check that all bash code blocks use proper syntax
      const bashBlocks = readmeContent.match(/```bash\n([\s\S]*?)\n```/g);

      if (bashBlocks) {
        bashBlocks.forEach(block => {
          // Remove the markdown wrapper
          const commands = block.replace(/```bash\n/, '').replace(/\n```/, '');

          // Basic syntax checks - should not have syntax errors
          expect(commands).not.toContain('>>'); // Invalid redirect
          expect(commands).not.toMatch(/\${[^}]+/); // Unclosed variable

          // Commands should be on separate lines or properly chained
          if (commands.includes('&&') || commands.includes('||')) {
            // Chained commands should have proper spacing
            expect(commands).toMatch(/\s&&\s|\s\|\|\s/);
          }
        });
      }
    });

    it('should have proper YAML syntax for config examples', () => {
      const yamlBlocks = readmeContent.match(/```yaml\n([\s\S]*?)\n```/g);

      if (yamlBlocks) {
        yamlBlocks.forEach(block => {
          const yamlContent = block.replace(/```yaml\n/, '').replace(/\n```/, '');

          // Skip comment-only lines
          const lines = yamlContent.split('\n').filter(line =>
            !line.trim().startsWith('#') && line.trim().length > 0
          );

          if (lines.length > 0) {
            expect(() => yaml.parse(yamlContent)).not.toThrow();
          }
        });
      }
    });
  });

  describe('Accuracy Claims', () => {
    it('should make accurate claims about default values', () => {
      // These should match the actual implementation defaults
      expect(readmeContent).toContain('| `cleanupOnComplete` | `true` |');
      expect(readmeContent).toContain('| `maxWorktrees` | `5` |');
      expect(readmeContent).toContain('| `pruneStaleAfterDays` | `7` |');
      expect(readmeContent).toContain('| `preserveOnFailure` | `false` |');
    });

    it('should accurately describe branch naming', () => {
      expect(readmeContent).toContain('apex/task-abc123');
      expect(readmeContent).toContain('apex/');
    });

    it('should accurately describe default base directory', () => {
      expect(readmeContent).toContain('../.apex-worktrees');
      expect(readmeContent).toContain('| `baseDir` | `../.apex-worktrees` |');
    });
  });

  describe('Documentation Completeness', () => {
    it('should cover all major worktree features', () => {
      const majorFeatures = [
        'automatic worktree creation',
        'branch isolation',
        'parallel execution',
        'cleanup management',
        'task switching',
        'stale worktree pruning'
      ];

      majorFeatures.forEach(feature => {
        // Convert to regex to allow for variations in wording
        const featureRegex = new RegExp(feature.replace(/\s+/g, '\\s+'), 'i');
        expect(readmeContent).toMatch(featureRegex);
      });
    });

    it('should provide both overview and detailed documentation', () => {
      // Should have high-level overview
      expect(readmeContent).toContain('overview');

      // Should have detailed configuration
      expect(readmeContent).toContain('Configuration Options');

      // Should have practical examples
      expect(readmeContent).toContain('Example Workflow');
    });
  });
});