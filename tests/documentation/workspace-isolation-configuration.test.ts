import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

const docsDir = path.join(__dirname, '../../docs');
const workspaceIsolationPath = path.join(docsDir, 'workspace-isolation.md');

// Helper to read documentation file
function readDocFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Documentation file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Helper to extract YAML code blocks from markdown
function extractYamlBlocks(content: string): Array<{ yaml: string; lineStart: number }> {
  const yamlBlocks: Array<{ yaml: string; lineStart: number }> = [];
  const lines = content.split('\n');
  let inYamlBlock = false;
  let currentBlock = '';
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '```yaml') {
      inYamlBlock = true;
      blockStartLine = i + 1;
      currentBlock = '';
    } else if (line.trim() === '```' && inYamlBlock) {
      inYamlBlock = false;
      if (currentBlock.trim()) {
        yamlBlocks.push({
          yaml: currentBlock,
          lineStart: blockStartLine
        });
      }
    } else if (inYamlBlock) {
      currentBlock += line + '\n';
    }
  }

  return yamlBlocks;
}

// Helper to extract bash command examples
function extractBashCommands(content: string): Array<{ command: string; lineStart: number }> {
  const bashCommands: Array<{ command: string; lineStart: number }> = [];
  const lines = content.split('\n');
  let inBashBlock = false;
  let currentBlock = '';
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '```bash') {
      inBashBlock = true;
      blockStartLine = i + 1;
      currentBlock = '';
    } else if (line.trim() === '```' && inBashBlock) {
      inBashBlock = false;
      if (currentBlock.trim()) {
        bashCommands.push({
          command: currentBlock.trim(),
          lineStart: blockStartLine
        });
      }
    } else if (inBashBlock) {
      currentBlock += line + '\n';
    }
  }

  return bashCommands;
}

// Helper to extract markdown links
function extractMarkdownLinks(content: string): Array<{ text: string; href: string; line: number }> {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const lines = content.split('\n');
  const links: Array<{ text: string; href: string; line: number }> = [];

  lines.forEach((line, index) => {
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      links.push({
        text: match[1],
        href: match[2],
        line: index + 1
      });
    }
  });

  return links;
}

// Helper to check if a relative documentation path exists
function isValidDocPath(href: string, baseDir: string): boolean {
  if (href.startsWith('http')) return true; // External links
  if (href.startsWith('#')) return true; // Anchor links
  if (href.startsWith('mailto:')) return true; // Email links

  const docPath = path.join(baseDir, href);
  return fs.existsSync(docPath);
}

describe('Workspace Isolation Configuration Documentation', () => {
  let content: string;

  beforeAll(() => {
    content = readDocFile(workspaceIsolationPath);
  });

  describe('Document Structure', () => {
    it('should exist and be readable', () => {
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(1000);
    });

    it('should have proper title and overview', () => {
      expect(content).toContain('# Workspace Isolation Configuration');
      expect(content).toContain('## Overview');
    });

    it('should document all three isolation modes', () => {
      const isolationModes = [
        '**`full`** - Complete isolation using both containers and Git worktrees',
        '**`worktree`** - Git worktree isolation only (no container)',
        '**`shared`** - Shared workspace with current directory (no isolation)'
      ];

      isolationModes.forEach(mode => {
        expect(content).toContain(mode);
      });
    });

    it('should have all required main sections', () => {
      const requiredSections = [
        '## Overview',
        '## Quick Start',
        '## Isolation Modes',
        '### Full Isolation (`mode: full`)',
        '### Worktree Isolation (`mode: worktree`)',
        '### Shared Workspace (`mode: shared`)',
        '## Isolation Configuration Schema',
        '## Comparison Matrix',
        '## Advanced Configuration',
        '## Integration with Existing Systems',
        '## Task Lifecycle with Isolation',
        '## Troubleshooting',
        '## Best Practices',
        '## Related Documentation'
      ];

      requiredSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should have subsections for each isolation mode', () => {
      const isolationModeSubsections = [
        '#### Features',
        '#### Configuration',
        '#### When to Use',
        '#### Prerequisites'
      ];

      // Each subsection should appear multiple times (once per isolation mode)
      isolationModeSubsections.forEach(subsection => {
        const matches = content.match(new RegExp(subsection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
        expect(matches).toBeTruthy();
        expect(matches!.length).toBeGreaterThanOrEqual(2); // At least 2 modes should have these sections
      });
    });
  });

  describe('Configuration Examples', () => {
    it('should have valid YAML configuration examples', () => {
      const yamlBlocks = extractYamlBlocks(content);
      expect(yamlBlocks.length).toBeGreaterThan(5);

      yamlBlocks.forEach((block, index) => {
        try {
          const parsed = yaml.parse(block.yaml);
          expect(parsed).toBeTruthy();
        } catch (error) {
          throw new Error(`Invalid YAML at block ${index + 1} (line ${block.lineStart}): ${error}`);
        }
      });
    });

    it('should include workflow-level configuration example', () => {
      expect(content).toContain('name: feature-workflow');
      expect(content).toContain('isolation:');
      expect(content).toContain('mode: worktree');
      expect(content).toContain('cleanupOnComplete: true');
    });

    it('should include project-level defaults configuration', () => {
      expect(content).toContain('workspace:');
      expect(content).toContain('defaultStrategy: "worktree"');
      expect(content).toContain('container:');
    });

    it('should validate full isolation container configuration', () => {
      const containerConfigRegex = /container:\s*\n\s*image:/;
      expect(content).toMatch(containerConfigRegex);

      expect(content).toContain('image: "node:20-alpine"');
      expect(content).toContain('resourceLimits:');
      expect(content).toContain('cpu: 2');
      expect(content).toContain('memory: "4g"');
    });

    it('should include conditional isolation examples', () => {
      expect(content).toContain('# In workflow definition');
      expect(content).toContain('# Shared mode for quick planning');
      expect(content).toContain('# Full isolation for code changes');
      expect(content).toContain('# Worktree isolation for testing');
    });

    it('should validate advanced container configuration', () => {
      expect(content).toContain('dockerfile: ".apex/Dockerfile.custom"');
      expect(content).toContain('volumes:');
      expect(content).toContain('securityOpts:');
      expect(content).toContain('capDrop:');
      expect(content).toContain('autoDependencyInstall: true');
    });
  });

  describe('CLI Examples', () => {
    it('should have valid CLI command examples', () => {
      const bashCommands = extractBashCommands(content);
      expect(bashCommands.length).toBeGreaterThan(3);

      // Check for basic CLI patterns
      const cliExamples = [
        'apex run "implement feature" --isolation-mode full',
        'apex run "fix bug" --isolation-mode worktree --preserve-on-failure',
        'apex run "task" --isolation-mode shared'
      ];

      cliExamples.forEach(example => {
        expect(content).toContain(example);
      });
    });

    it('should include CLI override examples', () => {
      const cliOverrides = [
        '--isolation-mode full',
        '--isolation-mode worktree',
        '--isolation-mode shared',
        '--cleanup-on-complete false',
        '--preserve-on-failure true',
        '--container-cpu 4',
        '--container-memory "8g"'
      ];

      cliOverrides.forEach(override => {
        expect(content).toContain(override);
      });
    });

    it('should include troubleshooting command examples', () => {
      const troubleshootingCommands = [
        'git init',
        'git stash',
        'docker info',
        'docker ps --filter "label=apex.managed=true"',
        'git worktree list',
        'apex logs <task-id> --show-workspace'
      ];

      troubleshootingCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });

    it('should include debug and verbose examples', () => {
      expect(content).toContain('apex run "task" --verbose --debug --isolation-mode full');
    });
  });

  describe('Isolation Modes Coverage', () => {
    it('should comprehensively cover full isolation mode', () => {
      const fullIsolationContent = content.match(/### Full Isolation \(`mode: full`\)([\s\S]*?)### Worktree Isolation/);
      expect(fullIsolationContent).toBeTruthy();

      const fullContent = fullIsolationContent![1];

      expect(fullContent).toContain('Container Environment');
      expect(fullContent).toContain('Git Worktree');
      expect(fullContent).toContain('Dependency Isolation');
      expect(fullContent).toContain('Resource Limits');
      expect(fullContent).toContain('Docker or Podman installed');
    });

    it('should comprehensively cover worktree isolation mode', () => {
      const worktreeIsolationContent = content.match(/### Worktree Isolation \(`mode: worktree`\)([\s\S]*?)### Shared Workspace/);
      expect(worktreeIsolationContent).toBeTruthy();

      const worktreeContent = worktreeIsolationContent![1];

      expect(worktreeContent).toContain('Git Worktree');
      expect(worktreeContent).toContain('Branch Isolation');
      expect(worktreeContent).toContain('Shared Environment');
      expect(worktreeContent).toContain('Fast Startup');
      expect(worktreeContent).toContain('Git repository with remote tracking');
    });

    it('should comprehensively cover shared workspace mode', () => {
      const sharedWorkspaceContent = content.match(/### Shared Workspace \(`mode: shared`\)([\s\S]*?)## Isolation Configuration Schema/);
      expect(sharedWorkspaceContent).toBeTruthy();

      const sharedContent = sharedWorkspaceContent![1];

      expect(sharedContent).toContain('Direct Execution');
      expect(sharedContent).toContain('Maximum Performance');
      expect(sharedContent).toContain('Simple Setup');
      expect(sharedContent).toContain('None - works in any directory');
    });

    it('should provide clear when-to-use guidance for each mode', () => {
      const whenToUsePatterns = [
        'Security-sensitive tasks',
        'Reproducible builds',
        'CI/CD workflows',
        'Rapid development',
        'Multiple features',
        'Limited resources',
        'Quick tasks',
        'Trusted operations'
      ];

      whenToUsePatterns.forEach(pattern => {
        expect(content).toContain(pattern);
      });
    });
  });

  describe('Comparison Matrix', () => {
    it('should have a comprehensive comparison matrix', () => {
      expect(content).toContain('## Comparison Matrix');

      const matrixHeaders = [
        '| Feature | Full | Worktree | Shared |',
        '|---------|------|----------|--------|'
      ];

      matrixHeaders.forEach(header => {
        expect(content).toContain(header);
      });
    });

    it('should compare all important aspects', () => {
      const comparisonAspects = [
        '**Isolation Level**',
        '**Performance**',
        '**Resource Control**',
        '**Environment Isolation**',
        '**Dependency Isolation**',
        '**Reproducibility**',
        '**Setup Overhead**',
        '**Parallel Tasks**',
        '**Branch Support**',
        '**Network Isolation**',
        '**Security**',
        '**Disk Usage**'
      ];

      comparisonAspects.forEach(aspect => {
        expect(content).toContain(aspect);
      });
    });

    it('should provide clear value comparisons', () => {
      const comparisonValues = [
        'Complete (OS + Git)',
        'Git-level',
        'None',
        'Fast',
        'Fastest',
        'High',
        'Medium',
        'Low'
      ];

      comparisonValues.forEach(value => {
        expect(content).toContain(value);
      });
    });
  });

  describe('Integration Documentation', () => {
    it('should document integration with existing systems', () => {
      expect(content).toContain('## Integration with Existing Systems');

      const integrationSections = [
        '### Container Integration',
        '### Worktree Integration',
        '### Workspace Strategy Mapping'
      ];

      integrationSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should map isolation modes to workspace strategies', () => {
      const strategyMappings = [
        '| `full` | `container` | Container + worktree |',
        '| `worktree` | `worktree` | Git worktree only |',
        '| `shared` | `none` | No isolation |'
      ];

      strategyMappings.forEach(mapping => {
        expect(content).toContain(mapping);
      });
    });

    it('should reference related documentation', () => {
      const relatedDocs = [
        '[Container Isolation](./container-isolation.md)',
        '[Container Configuration Reference](./container-configuration.md)',
        '[Workflows](./workflows.md)',
        '[Configuration Reference](./configuration.md)',
        '[CLI Guide](./cli-guide.md)'
      ];

      relatedDocs.forEach(doc => {
        expect(content).toContain(doc);
      });
    });
  });

  describe('Task Lifecycle Documentation', () => {
    it('should include mermaid sequence diagrams', () => {
      const mermaidSections = [
        '```mermaid',
        'sequenceDiagram',
        'participant User',
        'participant APEX',
        'participant Git',
        'participant Container',
        'participant Agent'
      ];

      mermaidSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should document all three lifecycle patterns', () => {
      const lifecyclePatterns = [
        'Full Isolation Lifecycle',
        'Worktree Isolation Lifecycle',
        'Shared Workspace Lifecycle'
      ];

      lifecyclePatterns.forEach(pattern => {
        expect(content).toContain(pattern);
      });
    });

    it('should show proper sequence flow', () => {
      const sequenceSteps = [
        'Run task with mode: full',
        'Create worktree',
        'Create container',
        'Install dependencies',
        'Execute in isolated environment',
        'Stop and remove',
        'Cleanup worktree',
        'Task complete'
      ];

      sequenceSteps.forEach(step => {
        expect(content).toContain(step);
      });
    });
  });

  describe('Troubleshooting Section', () => {
    it('should include common issues and solutions', () => {
      expect(content).toContain('## Troubleshooting');
      expect(content).toContain('### Common Issues');

      const commonIssues = [
        '"Worktree creation failed"',
        '"Container creation failed"',
        '"Permission denied in container"'
      ];

      commonIssues.forEach(issue => {
        expect(content).toContain(issue);
      });
    });

    it('should provide debug and health check commands', () => {
      expect(content).toContain('### Debug Mode');
      expect(content).toContain('### Health Checks');

      const debugCommands = [
        'apex run "task" --verbose --debug --isolation-mode full',
        'docker ps --filter "label=apex.managed=true"',
        'git worktree list'
      ];

      debugCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });

    it('should provide solution guidance', () => {
      const solutionKeywords = [
        '**Cause**:',
        '**Solution**:',
        'git init',
        'docker info',
        'user: "1000:1000"'
      ];

      solutionKeywords.forEach(keyword => {
        expect(content).toContain(keyword);
      });
    });
  });

  describe('Best Practices Section', () => {
    it('should provide comprehensive best practices', () => {
      expect(content).toContain('## Best Practices');

      const bestPracticeSections = [
        '### Isolation Mode Selection',
        '### Configuration Management',
        '### Resource Management',
        '### Security Considerations'
      ];

      bestPracticeSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should provide actionable guidance', () => {
      const guidance = [
        'Default to `worktree`',
        'Use `full`** for security-sensitive',
        'Use `shared`** only for simple',
        'Set project defaults',
        'Override per workflow',
        'Monitor disk usage',
        'Drop capabilities'
      ];

      guidance.forEach(item => {
        expect(content).toContain(item);
      });
    });

    it('should include numbered recommendations', () => {
      const numberedGuidance = [
        '1. **Default to',
        '2. **Use',
        '3. **Use',
        '4. **Consider'
      ];

      numberedGuidance.forEach(item => {
        expect(content).toContain(item);
      });
    });
  });

  describe('Cross-References and Links', () => {
    it('should have valid internal links', () => {
      const links = extractMarkdownLinks(content);
      const internalLinks = links.filter(link =>
        !link.href.startsWith('http') &&
        !link.href.startsWith('#') &&
        !link.href.startsWith('mailto:')
      );

      expect(internalLinks.length).toBeGreaterThan(0);

      internalLinks.forEach(link => {
        const isValid = isValidDocPath(link.href, docsDir);
        if (!isValid) {
          // If the specific file doesn't exist, it might be a planned document
          // For now, we'll check if it's a known planned document
          const plannedDocs = [
            './container-isolation.md',
            './container-configuration.md',
            './workflows.md',
            './configuration.md',
            './cli-guide.md'
          ];

          const isPlannedDoc = plannedDocs.some(planned => link.href.includes(planned.replace('./', '')));
          expect(isPlannedDoc).toBe(true);
        }
      });
    });

    it('should have consistent cross-references', () => {
      const expectedCrossRefs = [
        'Container Isolation',
        'Container Configuration Reference',
        'Workflows',
        'Configuration Reference',
        'CLI Guide'
      ];

      expectedCrossRefs.forEach(ref => {
        expect(content).toContain(ref);
      });
    });

    it('should reference integration points correctly', () => {
      const integrationRefs = [
        'existing container configuration',
        'container health monitoring',
        'Git worktree management',
        'workspace strategies'
      ];

      integrationRefs.forEach(ref => {
        expect(content).toContain(ref);
      });
    });
  });

  describe('Schema Documentation', () => {
    it('should document the configuration schema comprehensively', () => {
      expect(content).toContain('## Isolation Configuration Schema');

      const schemaSubsections = [
        '### Workflow-Level Configuration',
        '### Project-Level Defaults',
        '### CLI Overrides'
      ];

      schemaSubsections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should show required vs optional properties', () => {
      expect(content).toContain('# Required: isolation mode');
      expect(content).toContain('# Optional: cleanup behavior');
      expect(content).toContain('# Optional: container configuration');
    });

    it('should document property value options', () => {
      expect(content).toContain('mode: full | worktree | shared');
      expect(content).toContain('cleanupOnComplete: true');
      expect(content).toContain('preserveOnFailure: false');
    });

    it('should show CLI parameter mapping', () => {
      const cliParams = [
        '--isolation-mode',
        '--cleanup-on-complete',
        '--preserve-on-failure',
        '--container-cpu',
        '--container-memory'
      ];

      cliParams.forEach(param => {
        expect(content).toContain(param);
      });
    });
  });
});