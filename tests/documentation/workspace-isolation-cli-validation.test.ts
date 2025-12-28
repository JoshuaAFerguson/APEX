import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const docsDir = path.join(__dirname, '../../docs');
const workspaceIsolationPath = path.join(docsDir, 'workspace-isolation.md');

// Helper to read documentation file
function readDocFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Documentation file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Helper to extract bash command blocks
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

// Helper to extract individual commands from command blocks
function parseCommandBlock(commandBlock: string): string[] {
  const lines = commandBlock.split('\n');
  const commands: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      commands.push(trimmed);
    }
  }

  return commands;
}

describe('Workspace Isolation CLI Command Validation', () => {
  let content: string;

  beforeAll(() => {
    content = readDocFile(workspaceIsolationPath);
  });

  describe('CLI Command Syntax', () => {
    it('should have properly formatted apex run commands', () => {
      const bashCommands = extractBashCommands(content);
      const apexCommands = bashCommands.flatMap(block =>
        parseCommandBlock(block.command).filter(cmd => cmd.startsWith('apex run'))
      );

      expect(apexCommands.length).toBeGreaterThan(3);

      apexCommands.forEach(command => {
        // All apex run commands should have proper basic syntax
        expect(command).toMatch(/^apex run /);

        // Should have quoted task descriptions
        expect(command).toMatch(/apex run "[^"]+"/);
      });
    });

    it('should validate isolation mode parameter syntax', () => {
      const isolationModeCommands = content.match(/apex run [^\\n]* --isolation-mode \w+/g);
      expect(isolationModeCommands).toBeTruthy();
      expect(isolationModeCommands!.length).toBeGreaterThan(0);

      const validModes = ['full', 'worktree', 'shared'];

      isolationModeCommands!.forEach(command => {
        const modeMatch = command.match(/--isolation-mode (\w+)/);
        expect(modeMatch).toBeTruthy();

        const mode = modeMatch![1];
        expect(validModes).toContain(mode);
      });
    });

    it('should validate container resource parameter syntax', () => {
      const containerCommands = content.match(/--container-\w+[^\n]*/g);
      expect(containerCommands).toBeTruthy();
      expect(containerCommands!.length).toBeGreaterThan(0);

      const validContainerParams = [
        '--container-cpu',
        '--container-memory',
        '--container-memory-reservation'
      ];

      containerCommands!.forEach(commandPart => {
        const paramMatch = commandPart.match(/--container-(\w+)/);
        expect(paramMatch).toBeTruthy();

        const fullParam = '--container-' + paramMatch![1];
        expect(validContainerParams).toContain(fullParam);
      });
    });

    it('should validate boolean parameter syntax', () => {
      const booleanParams = [
        '--cleanup-on-complete',
        '--preserve-on-failure'
      ];

      booleanParams.forEach(param => {
        const regex = new RegExp(`${param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (true|false)`, 'g');
        const matches = content.match(regex);

        if (matches) {
          matches.forEach(match => {
            expect(match).toMatch(/ (true|false)$/);
          });
        }
      });
    });

    it('should have consistent parameter naming conventions', () => {
      const allParams = content.match(/--[\w-]+/g);
      expect(allParams).toBeTruthy();

      const uniqueParams = [...new Set(allParams!)];

      uniqueParams.forEach(param => {
        // All parameters should use kebab-case
        expect(param).toMatch(/^--[a-z][a-z0-9-]*[a-z0-9]$/);

        // Should not use underscores
        expect(param).not.toContain('_');

        // Should not end with hyphen
        expect(param).not.toMatch(/-$/);
      });
    });
  });

  describe('Command Examples Completeness', () => {
    it('should include examples for all isolation modes', () => {
      const requiredExamples = [
        'apex run "implement feature" --isolation-mode full',
        'apex run "fix bug" --isolation-mode worktree --preserve-on-failure',
        'apex run "task" --isolation-mode shared'
      ];

      requiredExamples.forEach(example => {
        expect(content).toContain(example);
      });
    });

    it('should include resource override examples', () => {
      const resourceExamples = [
        '--container-cpu 4',
        '--container-memory "8g"',
        '--container-memory-reservation "4g"'
      ];

      resourceExamples.forEach(example => {
        expect(content).toContain(example);
      });
    });

    it('should include multiline command examples', () => {
      // Check for line continuation in complex commands
      const multilinePattern = /apex run "task"[^\\n]*\\\s*\n\s*--/;
      expect(content).toMatch(multilinePattern);
    });

    it('should include cleanup behavior examples', () => {
      const cleanupExamples = [
        '--cleanup-on-complete false',
        '--preserve-on-failure true'
      ];

      cleanupExamples.forEach(example => {
        expect(content).toContain(example);
      });
    });
  });

  describe('Troubleshooting Commands', () => {
    it('should include diagnostic commands', () => {
      const diagnosticCommands = [
        'git init',
        'git stash',
        'docker info',
        'docker ps --filter "label=apex.managed=true"',
        'git worktree list'
      ];

      diagnosticCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });

    it('should include verbose debugging commands', () => {
      const debugCommands = [
        'apex run "task" --verbose --debug --isolation-mode full'
      ];

      debugCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });

    it('should include health check commands', () => {
      const healthCheckCommands = [
        'apex logs <task-id> --show-workspace'
      ];

      healthCheckCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });

    it('should include Git troubleshooting commands', () => {
      const gitCommands = [
        'git init',
        'git stash'
      ];

      gitCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });

    it('should include Docker troubleshooting commands', () => {
      const dockerCommands = [
        'docker info'
      ];

      dockerCommands.forEach(command => {
        expect(content).toContain(command);
      });
    });
  });

  describe('Command Context and Usage', () => {
    it('should provide commands in appropriate sections', () => {
      // Quick Start section should have basic examples
      const quickStartMatch = content.match(/## Quick Start([\s\S]*?)## Isolation Modes/);
      expect(quickStartMatch).toBeTruthy();

      const quickStartContent = quickStartMatch![1];
      expect(quickStartContent).toContain('apex run');
      expect(quickStartContent).toContain('--isolation-mode');
    });

    it('should provide advanced commands in advanced sections', () => {
      const advancedMatch = content.match(/## Advanced Configuration([\s\S]*?)## Integration/);
      expect(advancedMatch).toBeTruthy();

      const advancedContent = advancedMatch![1];

      // Advanced section may contain more complex command patterns
      expect(advancedContent.length).toBeGreaterThan(0);
    });

    it('should provide troubleshooting commands in troubleshooting section', () => {
      const troubleshootingMatch = content.match(/## Troubleshooting([\s\S]*?)## Best Practices/);
      expect(troubleshootingMatch).toBeTruthy();

      const troubleshootingContent = troubleshootingMatch![1];
      expect(troubleshootingContent).toContain('git');
      expect(troubleshootingContent).toContain('docker');
      expect(troubleshootingContent).toContain('apex');
    });
  });

  describe('Parameter Value Validation', () => {
    it('should use valid memory format strings', () => {
      const memoryValues = content.match(/"[0-9]+[gmkGMK]"/g);
      expect(memoryValues).toBeTruthy();

      const uniqueMemoryValues = [...new Set(memoryValues!)];

      uniqueMemoryValues.forEach(value => {
        // Remove quotes and check format
        const unquoted = value.slice(1, -1);
        expect(unquoted).toMatch(/^[0-9]+[gmkGMK]$/);
      });
    });

    it('should use valid CPU count values', () => {
      const cpuMatches = content.match(/--container-cpu (\d+)/g);

      if (cpuMatches) {
        cpuMatches.forEach(match => {
          const cpuValue = match.match(/(\d+)$/);
          expect(cpuValue).toBeTruthy();

          const cpu = parseInt(cpuValue![1]);
          expect(cpu).toBeGreaterThan(0);
          expect(cpu).toBeLessThanOrEqual(32); // Reasonable upper limit
        });
      }
    });

    it('should use valid timeout values', () => {
      // Look for timeout values in YAML examples (will be extracted and validated)
      const timeoutPattern = /installTimeout:\s*(\d+)/g;
      const matches = content.match(timeoutPattern);

      if (matches) {
        matches.forEach(match => {
          const timeoutMatch = match.match(/(\d+)/);
          expect(timeoutMatch).toBeTruthy();

          const timeout = parseInt(timeoutMatch![1]);
          expect(timeout).toBeGreaterThan(0);
          expect(timeout).toBeLessThanOrEqual(3600000); // 1 hour max
        });
      }
    });

    it('should quote task descriptions properly', () => {
      const taskDescriptions = content.match(/apex run "([^"]+)"/g);
      expect(taskDescriptions).toBeTruthy();
      expect(taskDescriptions!.length).toBeGreaterThan(0);

      taskDescriptions!.forEach(taskDesc => {
        // Should start with 'apex run "' and end with '"'
        expect(taskDesc).toMatch(/^apex run "[^"]+"/);

        // Task description should not be empty
        const description = taskDesc.match(/apex run "([^"]+)"/);
        expect(description![1].length).toBeGreaterThan(0);
      });
    });
  });

  describe('Command Documentation Consistency', () => {
    it('should use consistent parameter naming across examples', () => {
      const parameterUsages = new Map<string, string[]>();

      // Extract all parameter usages
      const paramMatches = content.match(/--[\w-]+\s+[^\s\\]+/g);

      if (paramMatches) {
        paramMatches.forEach(match => {
          const [param, value] = match.split(/\s+/);
          if (!parameterUsages.has(param)) {
            parameterUsages.set(param, []);
          }
          parameterUsages.get(param)!.push(value);
        });
      }

      // Validate consistency for common parameters
      const booleanParams = ['--cleanup-on-complete', '--preserve-on-failure'];

      booleanParams.forEach(param => {
        const values = parameterUsages.get(param);
        if (values) {
          values.forEach(value => {
            expect(['true', 'false']).toContain(value);
          });
        }
      });
    });

    it('should maintain consistent command structure', () => {
      const apexRunCommands = content.match(/apex run "[^"]*"[^\\n]*/g);

      if (apexRunCommands) {
        apexRunCommands.forEach(command => {
          // All commands should start with 'apex run "text"'
          expect(command).toMatch(/^apex run "[^"]+"/);

          // Parameters should come after the task description
          if (command.includes('--')) {
            expect(command).toMatch(/^apex run "[^"]+" .* --/);
          }
        });
      }
    });

    it('should provide examples for documented features', () => {
      // Check that each documented feature has corresponding CLI examples
      const featuresToCheck = [
        { feature: 'mode: full', cliExample: '--isolation-mode full' },
        { feature: 'mode: worktree', cliExample: '--isolation-mode worktree' },
        { feature: 'mode: shared', cliExample: '--isolation-mode shared' },
        { feature: 'cleanupOnComplete', cliExample: '--cleanup-on-complete' },
        { feature: 'preserveOnFailure', cliExample: '--preserve-on-failure' }
      ];

      featuresToCheck.forEach(({ feature, cliExample }) => {
        if (content.includes(feature)) {
          expect(content).toContain(cliExample);
        }
      });
    });
  });
});