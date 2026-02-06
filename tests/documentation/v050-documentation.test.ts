/**
 * @fileoverview Tests for v0.5.0 documentation accuracy and completeness
 *
 * This test suite verifies that all v0.5.0 features are properly documented
 * and that documentation examples are accurate and functional.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

describe('v0.5.0 Documentation Coverage', () => {
  let toolSystemContent: string;
  let readmeContent: string;
  let gettingStartedContent: string;

  beforeAll(async () => {
    // Read documentation files
    toolSystemContent = await readFile(join(process.cwd(), 'docs/tool-system.md'), 'utf-8');
    readmeContent = await readFile(join(process.cwd(), 'README.md'), 'utf-8');
    gettingStartedContent = await readFile(join(process.cwd(), 'docs/getting-started.md'), 'utf-8');
  });

  describe('Tool System Documentation', () => {
    it('should document all built-in tools', () => {
      const requiredTools = [
        'Read Tool',
        'Write Tool',
        'Edit Tool',
        'MultiEdit Tool',
        'Bash Tool',
        'Glob Tool',
        'Grep Tool',
        'WebFetch Tool',
        'WebSearch Tool',
        'Browser Tool',
        'NotebookEdit Tool',
        'TodoWrite Tool'
      ];

      requiredTools.forEach(tool => {
        expect(toolSystemContent).toContain(tool);
      });
    });

    it('should include comprehensive tool examples', () => {
      // Check for TypeScript code examples
      expect(toolSystemContent).toMatch(/```typescript[\s\S]*?```/);

      // Check for specific tool usage examples
      expect(toolSystemContent).toContain('await apex.tools.read');
      expect(toolSystemContent).toContain('await apex.tools.write');
      expect(toolSystemContent).toContain('await apex.tools.edit');
      expect(toolSystemContent).toContain('await apex.tools.bash');
      expect(toolSystemContent).toContain('await apex.tools.browser');
    });

    it('should document tool configuration', () => {
      expect(toolSystemContent).toContain('Tool Configuration');
      expect(toolSystemContent).toContain('Global Tool Settings');
      expect(toolSystemContent).toContain('Per-Tool Configuration');

      // Check for YAML configuration examples
      expect(toolSystemContent).toMatch(/```yaml[\s\S]*?```/);
      expect(toolSystemContent).toContain('tools:');
      expect(toolSystemContent).toContain('enabled:');
      expect(toolSystemContent).toContain('timeout:');
    });

    it('should document permission integration', () => {
      expect(toolSystemContent).toContain('Permission Integration');
      expect(toolSystemContent).toContain('Tool-Specific Permissions');
      expect(toolSystemContent).toContain('Permission Workflows');

      // Check for permission-related examples
      expect(toolSystemContent).toContain('checkToolPermission');
      expect(toolSystemContent).toContain('requestApproval');
    });

    it('should include error handling patterns', () => {
      expect(toolSystemContent).toContain('Error Handling and Recovery');
      expect(toolSystemContent).toContain('Robust Error Handling');
      expect(toolSystemContent).toContain('Automatic Retry Logic');

      // Check for error handling examples
      expect(toolSystemContent).toContain('try {');
      expect(toolSystemContent).toContain('catch (error)');
      expect(toolSystemContent).toContain('retryableExecution');
    });

    it('should document best practices', () => {
      expect(toolSystemContent).toContain('Best Practices');
      expect(toolSystemContent).toContain('Tool Selection');
      expect(toolSystemContent).toContain('Performance Optimization');
      expect(toolSystemContent).toContain('Security Considerations');
    });

    it('should include CLI tool management', () => {
      expect(toolSystemContent).toContain('CLI Tool Management');
      expect(toolSystemContent).toContain('apex tools list');
      expect(toolSystemContent).toContain('apex tools enable');
      expect(toolSystemContent).toContain('apex tools test');
    });

    it('should have complete workflow examples', () => {
      expect(toolSystemContent).toContain('Integration Examples');
      expect(toolSystemContent).toContain('Complete Workflow Example');
      expect(toolSystemContent).toContain('developmentWorkflow');
    });
  });

  describe('Browser Automation Documentation', () => {
    it('should document browser tool capabilities', () => {
      expect(toolSystemContent).toContain('Browser Tool');
      expect(toolSystemContent).toContain('Browser Automation');

      // Check for browser operations
      expect(toolSystemContent).toContain('navigate');
      expect(toolSystemContent).toContain('click');
      expect(toolSystemContent).toContain('type');
      expect(toolSystemContent).toContain('screenshot');
      expect(toolSystemContent).toContain('compareScreenshot');
    });

    it('should include browser configuration options', () => {
      expect(toolSystemContent).toContain('browser:');
      expect(toolSystemContent).toContain('engine:');
      expect(toolSystemContent).toContain('headless:');
      expect(toolSystemContent).toContain('viewport:');
      expect(toolSystemContent).toContain('allowedDomains:');
      expect(toolSystemContent).toContain('blockedDomains:');
    });

    it('should document browser automation features', () => {
      const browserFeatures = [
        'Multi-browser support',
        'Interactive operations',
        'Screenshot capture',
        'Visual regression testing',
        'Element inspection',
        'Form automation',
        'Console log capture'
      ];

      browserFeatures.forEach(feature => {
        expect(toolSystemContent).toContain(feature);
      });
    });
  });

  describe('Permission System Documentation', () => {
    it('should document permission controls', () => {
      expect(toolSystemContent).toContain('permissions:');
      expect(toolSystemContent).toContain('requireConfirmation:');
      expect(toolSystemContent).toContain('allowedOperations:');
      expect(toolSystemContent).toContain('blockedOperations:');
      expect(toolSystemContent).toContain('elevatedOperations:');
    });

    it('should include permission workflow examples', () => {
      expect(toolSystemContent).toContain('Permission Workflows');
      expect(toolSystemContent).toContain('checkToolPermission');
      expect(toolSystemContent).toContain('requestApproval');
      expect(toolSystemContent).toContain('permission.granted');
    });

    it('should document file-based permissions', () => {
      expect(toolSystemContent).toContain('allowedPaths:');
      expect(toolSystemContent).toContain('blockedPaths:');
      expect(toolSystemContent).toContain('src/**');
      expect(toolSystemContent).toContain('node_modules/**');
    });
  });

  describe('README.md Updates', () => {
    it('should mention v0.5.0 features', () => {
      // Check for version reference
      expect(readmeContent).toMatch(/0\.5\.0|v0\.5|version 0\.5/i);
    });

    it('should include tool system overview', () => {
      expect(readmeContent).toMatch(/tool|Tool/);
      expect(readmeContent).toMatch(/automation|Automation/);
    });

    it('should reference new documentation', () => {
      // Should link to or mention tool system documentation
      expect(readmeContent).toMatch(/tool-system|Tool System/i);
    });
  });

  describe('Getting Started Updates', () => {
    it('should include v0.5.0 installation instructions', () => {
      expect(gettingStartedContent).toContain('install');
      expect(gettingStartedContent).toContain('npm');
    });

    it('should mention new features', () => {
      const v050Features = [
        'tool',
        'browser',
        'permission',
        'automation'
      ];

      // At least some v0.5.0 features should be mentioned
      const mentionedFeatures = v050Features.filter(feature =>
        gettingStartedContent.toLowerCase().includes(feature)
      );
      expect(mentionedFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('Code Example Validation', () => {
    it('should have valid TypeScript syntax in examples', () => {
      // Extract TypeScript code blocks
      const tsCodeBlocks = toolSystemContent.match(/```typescript([\s\S]*?)```/g);

      if (tsCodeBlocks) {
        tsCodeBlocks.forEach(block => {
          const code = block.replace(/```typescript\n?/, '').replace(/```$/, '');

          // Basic syntax checks
          expect(code).not.toContain('syntax error');
          expect(code).not.toContain('SyntaxError');

          // Check for proper async/await usage
          if (code.includes('await')) {
            expect(code).toMatch(/async|Promise/);
          }

          // Check for proper import statements if any
          const importLines = code.split('\n').filter(line => line.trim().startsWith('import'));
          importLines.forEach(importLine => {
            expect(importLine).toMatch(/^import\s+.*\s+from\s+['"][^'"]+['"];?$/);
          });
        });
      }
    });

    it('should have valid YAML syntax in configuration examples', () => {
      // Extract YAML code blocks
      const yamlCodeBlocks = toolSystemContent.match(/```yaml([\s\S]*?)```/g);

      if (yamlCodeBlocks) {
        yamlCodeBlocks.forEach(block => {
          const yaml = block.replace(/```yaml\n?/, '').replace(/```$/, '');

          // Basic YAML syntax checks
          expect(yaml).not.toContain('- - -'); // Invalid YAML
          expect(yaml).not.toContain('\t'); // No tabs in YAML

          // Check indentation consistency
          const lines = yaml.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.match(/^\s+/)) {
              const indent = line.match(/^(\s+)/)?.[1];
              if (indent) {
                expect(indent.length % 2).toBe(0); // Even indentation
              }
            }
          });
        });
      }
    });

    it('should have valid bash commands in examples', () => {
      // Extract bash code blocks
      const bashCodeBlocks = toolSystemContent.match(/```bash([\s\S]*?)```/g);

      if (bashCodeBlocks) {
        bashCodeBlocks.forEach(block => {
          const bash = block.replace(/```bash\n?/, '').replace(/```$/, '');

          // Check for common command patterns
          const commands = bash.split('\n').filter(line =>
            line.trim() && !line.trim().startsWith('#')
          );

          commands.forEach(command => {
            // Should not contain obviously invalid characters
            expect(command).not.toContain('<<<');
            expect(command).not.toContain('>>>');

            // Should be valid command structure
            if (command.includes('apex ')) {
              expect(command).toMatch(/apex\s+(tools|config|init|run)/);
            }
          });
        });
      }
    });
  });

  describe('Link Validation', () => {
    it('should have valid internal links', () => {
      // Check for markdown links
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      const links = [...toolSystemContent.matchAll(linkPattern)];

      links.forEach(([, text, url]) => {
        if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/')) {
          // Internal link - should not be empty
          expect(url.trim()).toBeTruthy();
          expect(text.trim()).toBeTruthy();
        }

        if (url.startsWith('#')) {
          // Anchor link - should be properly formatted
          expect(url).toMatch(/^#[a-z0-9-]+$/);
        }
      });
    });

    it('should reference related documentation correctly', () => {
      expect(toolSystemContent).toContain('Related Documentation');

      // Check for links to other docs
      const relatedLinks = [
        'v050-features.md',
        'browser-automation.md',
        'permission-system.md',
        'configuration.md',
        'api-reference.md'
      ];

      relatedLinks.forEach(link => {
        expect(toolSystemContent).toContain(link);
      });
    });
  });

  describe('Completeness Validation', () => {
    it('should have table of contents or navigation', () => {
      // Check for overview/navigation section
      expect(toolSystemContent).toContain('Overview');

      // Should have major sections
      const majorSections = [
        'Built-in Tools',
        'Tool Configuration',
        'Permission Integration',
        'Best Practices'
      ];

      majorSections.forEach(section => {
        expect(toolSystemContent).toContain(section);
      });
    });

    it('should cover all v0.5.0 feature categories', () => {
      const featureCategories = [
        'File Operations',
        'System Commands',
        'Code Search',
        'Web Operations',
        'Browser Automation',
        'Development Tools'
      ];

      featureCategories.forEach(category => {
        expect(toolSystemContent).toContain(category);
      });
    });

    it('should include practical examples for each tool', () => {
      const tools = [
        'read', 'write', 'edit', 'bash', 'glob',
        'grep', 'webFetch', 'browser', 'todoWrite'
      ];

      tools.forEach(tool => {
        // Each tool should have at least one practical example
        expect(toolSystemContent).toMatch(
          new RegExp(`apex\\.tools\\.${tool}|${tool} tool`, 'i')
        );
      });
    });
  });
});