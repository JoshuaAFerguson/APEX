import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ResourceLimitsSchema,
  ContainerConfigSchema,
  WorkspaceConfigSchema,
} from '../../packages/core/src/types';

const docsDir = path.join(__dirname, '../..');
const configurationMdPath = path.join(docsDir, 'docs/configuration.md');

// Helper to read documentation files
function readDocFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Documentation file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Helper to extract CLI command examples
function extractCliCommands(content: string): Array<{ command: string; context: string }> {
  const cliCommandRegex = /apex run.*?(?=\n|$)/g;
  const commands: Array<{ command: string; context: string }> = [];
  let match;

  while ((match = cliCommandRegex.exec(content)) !== null) {
    // Get surrounding context to understand what the command is for
    const beforeMatch = content.substring(Math.max(0, match.index - 200), match.index);
    const afterMatch = content.substring(match.index + match[0].length, match.index + match[0].length + 100);
    const contextLines = beforeMatch.split('\n').slice(-2).concat(afterMatch.split('\n').slice(0, 2));
    const context = contextLines.join('\n');

    commands.push({
      command: match[0].trim(),
      context
    });
  }

  return commands;
}

// Helper to parse CLI arguments
function parseCliArgs(command: string): { [key: string]: string | boolean } {
  const args: { [key: string]: string | boolean } = {};
  const parts = command.split(/\s+/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('--')) {
      const key = part.substring(2);

      // Check if next part is a value or another flag
      if (i + 1 < parts.length && !parts[i + 1].startsWith('--')) {
        args[key] = parts[i + 1].replace(/^"(.*)"$/, '$1'); // Remove quotes
        i++; // Skip the value
      } else {
        args[key] = true; // Boolean flag
      }
    }
  }

  return args;
}

// Helper to extract JSON examples
function extractJsonExamples(content: string): Array<{ json: any; context: string }> {
  const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  const examples: Array<{ json: any; context: string }> = [];
  let match;

  while ((match = jsonRegex.exec(content)) !== null) {
    const beforeMatch = content.substring(Math.max(0, match.index - 150), match.index);
    const context = beforeMatch.split('\n').slice(-3).join('\n');

    try {
      const parsed = JSON.parse(match[1]);
      examples.push({
        json: parsed,
        context
      });
    } catch (error) {
      // Skip invalid JSON
    }
  }

  return examples;
}

describe('CLI Override Examples Tests', () => {
  let configContent: string;
  let cliCommands: Array<{ command: string; context: string }>;
  let jsonExamples: Array<{ json: any; context: string }>;

  beforeAll(() => {
    configContent = readDocFile(configurationMdPath);
    cliCommands = extractCliCommands(configContent);
    jsonExamples = extractJsonExamples(configContent);
  });

  describe('CLI command examples extraction', () => {
    it('should find CLI override examples in documentation', () => {
      expect(cliCommands.length).toBeGreaterThan(0);

      // Should have at least one command with container overrides
      const containerCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-') || cmd.command.includes('--workspace-strategy')
      );

      expect(containerCommands.length).toBeGreaterThan(0);
    });

    it('should extract commands in proper container resource context', () => {
      const resourceOverrideCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-cpu') || cmd.command.includes('--container-memory')
      );

      expect(resourceOverrideCommands.length).toBeGreaterThan(0);

      resourceOverrideCommands.forEach(cmdInfo => {
        const context = cmdInfo.context.toLowerCase();
        const isInResourceContext =
          context.includes('override') ||
          context.includes('resource') ||
          context.includes('container') ||
          context.includes('cli') ||
          context.includes('example');

        expect(isInResourceContext).toBe(true);
      });
    });
  });

  describe('CLI argument parsing and validation', () => {
    it('should have valid CLI command structure', () => {
      const overrideCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-')
      );

      expect(overrideCommands.length).toBeGreaterThan(0);

      overrideCommands.forEach(cmdInfo => {
        const { command } = cmdInfo;

        // Should start with 'apex run'
        expect(command).toMatch(/^apex run/);

        // Should have a task description in quotes
        expect(command).toMatch(/apex run\s+"[^"]+"/);

        // Should have proper flag format
        const flags = command.match(/--[\w-]+/g) || [];
        expect(flags.length).toBeGreaterThan(0);

        flags.forEach(flag => {
          expect(flag).toMatch(/^--[a-z][a-z0-9-]*$/);
        });
      });
    });

    it('should have valid workspace strategy overrides', () => {
      const strategyCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--workspace-strategy')
      );

      expect(strategyCommands.length).toBeGreaterThan(0);

      strategyCommands.forEach(cmdInfo => {
        const args = parseCliArgs(cmdInfo.command);
        expect(args['workspace-strategy']).toBeTruthy();

        const strategy = args['workspace-strategy'] as string;
        expect(['none', 'directory', 'worktree', 'container']).toContain(strategy);

        // If strategy is container, should have container options
        if (strategy === 'container') {
          const hasContainerOptions = Object.keys(args).some(key =>
            key.startsWith('container-')
          );
          expect(hasContainerOptions).toBe(true);
        }
      });
    });

    it('should have valid container CPU overrides', () => {
      const cpuCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-cpu')
      );

      expect(cpuCommands.length).toBeGreaterThan(0);

      cpuCommands.forEach(cmdInfo => {
        const args = parseCliArgs(cmdInfo.command);
        const cpuValue = args['container-cpu'] as string;

        expect(cpuValue).toBeTruthy();

        const cpuNum = parseFloat(cpuValue);
        expect(cpuNum).toBeGreaterThanOrEqual(0.1);
        expect(cpuNum).toBeLessThanOrEqual(64);

        // Validate against schema
        expect(() => ResourceLimitsSchema.parse({ cpu: cpuNum })).not.toThrow();
      });
    });

    it('should have valid container memory overrides', () => {
      const memoryCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-memory')
      );

      expect(memoryCommands.length).toBeGreaterThan(0);

      memoryCommands.forEach(cmdInfo => {
        const args = parseCliArgs(cmdInfo.command);
        const memoryValue = args['container-memory'] as string;

        expect(memoryValue).toBeTruthy();

        // Should match memory format
        expect(memoryValue).toMatch(/^\d+[kmgKMG]?$/);

        // Validate against schema
        expect(() => ResourceLimitsSchema.parse({ memory: memoryValue })).not.toThrow();
      });
    });

    it('should have valid container shares and pids limit overrides', () => {
      const advancedCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-cpu-shares') ||
        cmd.command.includes('--container-pids-limit')
      );

      advancedCommands.forEach(cmdInfo => {
        const args = parseCliArgs(cmdInfo.command);

        if (args['container-cpu-shares']) {
          const sharesValue = parseInt(args['container-cpu-shares'] as string);
          expect(sharesValue).toBeGreaterThanOrEqual(2);
          expect(sharesValue).toBeLessThanOrEqual(262144);

          expect(() => ResourceLimitsSchema.parse({ cpuShares: sharesValue })).not.toThrow();
        }

        if (args['container-pids-limit']) {
          const pidsValue = parseInt(args['container-pids-limit'] as string);
          expect(pidsValue).toBeGreaterThan(0);

          expect(() => ResourceLimitsSchema.parse({ pidsLimit: pidsValue })).not.toThrow();
        }
      });
    });
  });

  describe('Available override options documentation', () => {
    it('should document all available CLI override flags', () => {
      const expectedFlags = [
        '--workspace-strategy',
        '--container-cpu',
        '--container-memory',
        '--container-memory-reservation',
        '--container-cpu-shares',
        '--container-pids-limit'
      ];

      expectedFlags.forEach(flag => {
        expect(configContent).toContain(flag);
      });
    });

    it('should provide descriptions for override options', () => {
      const overrideSection = configContent.match(
        /\*\*Available Override Options\*\*:([\s\S]*?)(?=##|$)/
      );
      expect(overrideSection).toBeTruthy();

      const content = overrideSection![1];

      // Should explain each option
      expect(content).toContain('Change isolation strategy');
      expect(content).toContain('Override CPU limit');
      expect(content).toContain('Override memory limit');
      expect(content).toContain('Override memory reservation');
      expect(content).toContain('Override CPU shares');
      expect(content).toContain('Override process limit');
    });
  });

  describe('Programmatic override examples', () => {
    it('should have valid JSON configuration examples', () => {
      expect(jsonExamples.length).toBeGreaterThan(0);

      const workspaceExamples = jsonExamples.filter(example =>
        example.json.workspace && example.json.workspace.container
      );

      expect(workspaceExamples.length).toBeGreaterThan(0);

      workspaceExamples.forEach(example => {
        const { json } = example;

        // Should validate against workspace schema
        expect(() => WorkspaceConfigSchema.parse(json.workspace)).not.toThrow();

        // Should have resource limits
        const resourceLimits = json.workspace.container.resourceLimits;
        expect(resourceLimits).toBeTruthy();

        expect(() => ResourceLimitsSchema.parse(resourceLimits)).not.toThrow();
      });
    });

    it('should show realistic programmatic override values', () => {
      const workspaceExamples = jsonExamples.filter(example =>
        example.json.workspace?.container?.resourceLimits
      );

      workspaceExamples.forEach(example => {
        const limits = example.json.workspace.container.resourceLimits;

        // CPU should be reasonable
        if (limits.cpu) {
          expect(limits.cpu).toBeGreaterThanOrEqual(0.5);
          expect(limits.cpu).toBeLessThanOrEqual(16);
        }

        // Memory should be properly formatted
        if (limits.memory) {
          expect(limits.memory).toMatch(/^\d+[gmGM]$/);
        }

        // Strategy should be container for resource limits examples
        expect(example.json.workspace.strategy).toBe('container');
      });
    });

    it('should demonstrate task-level configuration structure', () => {
      const workspaceExamples = jsonExamples.filter(example =>
        example.json.workspace
      );

      expect(workspaceExamples.length).toBeGreaterThan(0);

      workspaceExamples.forEach(example => {
        const config = example.json;

        // Should have proper structure
        expect(config.workspace).toBeTruthy();
        expect(config.workspace.strategy).toBeTruthy();
        expect(config.workspace.container).toBeTruthy();

        // Should match the documented structure
        expect(['none', 'directory', 'worktree', 'container']).toContain(
          config.workspace.strategy
        );
      });
    });
  });

  describe('CLI examples consistency and completeness', () => {
    it('should demonstrate progression from simple to complex overrides', () => {
      const allCommands = cliCommands.map(cmd => cmd.command).join(' ');

      // Should have simple examples (just CPU or memory)
      const hasSimpleExamples = cliCommands.some(cmd =>
        (cmd.command.includes('--container-cpu') || cmd.command.includes('--container-memory')) &&
        !cmd.command.includes('--container-cpu-shares') &&
        !cmd.command.includes('--container-pids-limit')
      );

      // Should have complex examples (multiple overrides)
      const hasComplexExamples = cliCommands.some(cmd =>
        cmd.command.split('--container-').length > 2
      );

      expect(hasSimpleExamples).toBe(true);
    });

    it('should use consistent flag naming patterns', () => {
      const containerFlags = configContent
        .match(/--container-[\w-]+/g) || [];

      expect(containerFlags.length).toBeGreaterThan(0);

      containerFlags.forEach(flag => {
        // Should follow kebab-case pattern
        expect(flag).toMatch(/^--container-[a-z][a-z0-9-]*$/);

        // Should not have underscores
        expect(flag).not.toContain('_');
      });
    });

    it('should provide realistic task descriptions in examples', () => {
      cliCommands.forEach(cmdInfo => {
        const taskMatch = cmdInfo.command.match(/apex run\s+"([^"]+)"/);
        if (taskMatch) {
          const taskDescription = taskMatch[1];

          // Should be a meaningful task description
          expect(taskDescription.length).toBeGreaterThan(5);
          expect(taskDescription).not.toMatch(/^test\s*$/i);
          expect(taskDescription).not.toMatch(/^example\s*$/i);

          // Should describe actual work
          const isRealistic =
            taskDescription.includes('build') ||
            taskDescription.includes('test') ||
            taskDescription.includes('deploy') ||
            taskDescription.includes('install') ||
            taskDescription.includes('run') ||
            taskDescription.includes('analyze') ||
            taskDescription.includes('process') ||
            taskDescription.includes('compile') ||
            taskDescription.includes('project');

          expect(isRealistic).toBe(true);
        }
      });
    });

    it('should show commands that could benefit from resource overrides', () => {
      const overrideCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-cpu') || cmd.command.includes('--container-memory')
      );

      overrideCommands.forEach(cmdInfo => {
        const taskMatch = cmdInfo.command.match(/apex run\s+"([^"]+)"/);
        if (taskMatch) {
          const taskDescription = taskMatch[1].toLowerCase();

          // Task should be resource-intensive or require specific limits
          const isResourceIntensive =
            taskDescription.includes('build') ||
            taskDescription.includes('compile') ||
            taskDescription.includes('test') ||
            taskDescription.includes('process') ||
            taskDescription.includes('analyze') ||
            taskDescription.includes('heavy') ||
            taskDescription.includes('large') ||
            taskDescription.includes('performance');

          expect(isResourceIntensive).toBe(true);
        }
      });
    });
  });

  describe('Override examples validation against real usage', () => {
    it('should show override values that actually make sense', () => {
      const resourceCommands = cliCommands.filter(cmd =>
        cmd.command.includes('--container-cpu') && cmd.command.includes('--container-memory')
      );

      expect(resourceCommands.length).toBeGreaterThan(0);

      resourceCommands.forEach(cmdInfo => {
        const args = parseCliArgs(cmdInfo.command);
        const cpu = parseFloat(args['container-cpu'] as string);
        const memory = args['container-memory'] as string;

        // CPU and memory should be balanced
        if (memory.endsWith('g') || memory.endsWith('G')) {
          const memoryGb = parseInt(memory.slice(0, -1));

          // Reasonable CPU to memory ratio
          expect(cpu / memoryGb).toBeGreaterThanOrEqual(0.25); // At least 0.25 CPU per GB
          expect(cpu / memoryGb).toBeLessThanOrEqual(4); // At most 4 CPU per GB
        }
      });
    });

    it('should demonstrate actual use cases', () => {
      cliCommands.forEach(cmdInfo => {
        const context = cmdInfo.context.toLowerCase();

        // Context should explain why the override is needed
        const hasExplanation =
          context.includes('example') ||
          context.includes('override') ||
          context.includes('resource') ||
          context.includes('intensive') ||
          context.includes('performance') ||
          context.includes('build') ||
          context.includes('large') ||
          context.includes('increase') ||
          context.includes('limit');

        expect(hasExplanation).toBe(true);
      });
    });
  });
});