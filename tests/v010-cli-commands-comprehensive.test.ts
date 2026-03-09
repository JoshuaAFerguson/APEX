/**
 * Comprehensive test suite for v0.1.0 CLI commands
 * Tests all 6 target commands: init, run, status, agents, workflows, logs
 *
 * This test verifies that each command:
 * 1. Exists and is properly defined
 * 2. Has a functional implementation (not stub)
 * 3. Has proper error handling
 * 4. Has appropriate validation and business logic
 * 5. Integrates correctly with the APEX ecosystem
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestProjectSetup {
  projectDir: string;
  cleanup: () => Promise<void>;
}

interface CLICommandTest {
  command: string;
  aliases: string[];
  description: string;
  usage?: string;
  requiresInit: boolean;
  expectedFeatures: string[];
}

const TARGET_COMMANDS: CLICommandTest[] = [
  {
    command: 'init',
    aliases: [],
    description: 'Initialize APEX in the current project',
    usage: '/init [--yes] [--name <name>] [--language <lang>] [--framework <fw>]',
    requiresInit: false,
    expectedFeatures: [
      'argument parsing',
      'user interaction',
      'configuration creation',
      'file system operations',
      'error handling'
    ]
  },
  {
    command: 'run',
    aliases: ['r'],
    description: 'Run a task with specific options',
    usage: '/run "<description>" [--workflow <name>] [--autonomy <level>] [--diff-preview] [--dry-run]',
    requiresInit: true,
    expectedFeatures: [
      'argument parsing',
      'orchestrator integration',
      'task execution',
      'workflow management',
      'error handling'
    ]
  },
  {
    command: 'status',
    aliases: ['s'],
    description: 'Show task status or check outdated documentation',
    usage: '/status [task_id] [--check-docs] [--include-archived]',
    requiresInit: true,
    expectedFeatures: [
      'argument parsing',
      'data loading',
      'formatted display',
      'filtering',
      'error handling'
    ]
  },
  {
    command: 'agents',
    aliases: ['a'],
    description: 'List available agents',
    requiresInit: true,
    expectedFeatures: [
      'data loading',
      'formatted display',
      'configuration access',
      'error handling'
    ]
  },
  {
    command: 'workflows',
    aliases: ['w'],
    description: 'List available workflows',
    requiresInit: true,
    expectedFeatures: [
      'data loading',
      'formatted display',
      'file system operations',
      'error handling'
    ]
  },
  {
    command: 'logs',
    aliases: ['l'],
    description: 'Show task logs',
    usage: '/logs <task_id>',
    requiresInit: true,
    expectedFeatures: [
      'argument parsing',
      'data loading',
      'formatted display',
      'orchestrator integration',
      'error handling'
    ]
  }
];

describe('v0.1.0 CLI Commands - Comprehensive Test Suite', () => {
  let cliSourceCode: string;
  let cliSourcePath: string;

  beforeAll(async () => {
    cliSourcePath = path.join(process.cwd(), 'packages/cli/src/index.ts');

    try {
      cliSourceCode = await fs.readFile(cliSourcePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load CLI source code: ${error}`);
    }
  });

  describe('Command Definition Verification', () => {
    test('all 6 target commands should be defined', () => {
      for (const cmd of TARGET_COMMANDS) {
        const commandRegex = new RegExp(`name: ['"]${cmd.command}['"]`, 'g');
        const match = commandRegex.test(cliSourceCode);

        expect(match, `Command '${cmd.command}' should be defined in CLI source`).toBe(true);
      }
    });

    test('each command should have proper structure', () => {
      for (const cmd of TARGET_COMMANDS) {
        const commandBlockRegex = new RegExp(
          `name: ['"]${cmd.command}['"],\\s*` +
          `aliases: \\[.*?\\],\\s*` +
          `description: ['"][^'"]+['"](?:,\\s*` +
          `usage: ['"][^'"]+['"])?.*?` +
          `handler: async \\(.*?\\) => \\{`,
          'gs'
        );

        const match = commandBlockRegex.test(cliSourceCode);
        expect(match, `Command '${cmd.command}' should have proper structure`).toBe(true);
      }
    });

    test('commands should have correct aliases', () => {
      for (const cmd of TARGET_COMMANDS) {
        if (cmd.aliases.length === 0) continue;

        const aliasPattern = cmd.aliases.map(alias => `['"]${alias}['"]`).join('|');
        const aliasRegex = new RegExp(`name: ['"]${cmd.command}['"].*?aliases: \\[.*?(${aliasPattern}).*?\\]`, 'gs');

        const match = aliasRegex.test(cliSourceCode);
        expect(match, `Command '${cmd.command}' should have correct aliases: ${cmd.aliases.join(', ')}`).toBe(true);
      }
    });
  });

  describe('Handler Implementation Analysis', () => {
    test('command handlers should not be stubs', () => {
      for (const cmd of TARGET_COMMANDS) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);

        expect(handlerContent, `Handler for '${cmd.command}' should be extractable`).toBeTruthy();

        const isStub = isStubImplementation(handlerContent!);
        expect(isStub, `Command '${cmd.command}' should not be a stub implementation`).toBe(false);
      }
    });

    test('command handlers should have sufficient complexity', () => {
      for (const cmd of TARGET_COMMANDS) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);
        const complexity = calculateHandlerComplexity(handlerContent!);

        // All v0.1.0 commands should be at least 'medium' complexity
        expect(
          complexity.level,
          `Command '${cmd.command}' should have medium or complex implementation (got ${complexity.level}, ${complexity.lines} lines, ${complexity.features} features)`
        ).not.toBe('simple');
      }
    });

    test('command handlers should have error handling', () => {
      for (const cmd of TARGET_COMMANDS) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);

        // Some commands have try/catch blocks, others have proper error checking and early returns
        const hasTryCatch = /try\s*\{|catch\s*\(|\.catch\(/.test(handlerContent!);
        const hasErrorChecking = /if\s*\(.*\)\s*\{[\s\S]*console\.log\(chalk\.red/.test(handlerContent!);
        const hasErrorHandling = hasTryCatch || hasErrorChecking;

        expect(
          hasErrorHandling,
          `Command '${cmd.command}' should have error handling (try/catch or error checking with red console output)`
        ).toBe(true);
      }
    });

    test('commands requiring init should check initialization status', () => {
      const commandsRequiringInit = TARGET_COMMANDS.filter(cmd => cmd.requiresInit);

      for (const cmd of commandsRequiringInit) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);
        const hasInitCheck = /if\s*\(.*(?:initialized|ctx\.initialized)/.test(handlerContent!);

        expect(
          hasInitCheck,
          `Command '${cmd.command}' should check initialization status`
        ).toBe(true);
      }
    });

    test('commands with arguments should parse them properly', () => {
      const commandsWithArgs = TARGET_COMMANDS.filter(cmd => cmd.usage?.includes('[') || cmd.usage?.includes('<'));

      for (const cmd of commandsWithArgs) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);
        const hasArgParsing = /args\[|args\.|\.includes\(|\.startsWith\(/.test(handlerContent!);

        expect(
          hasArgParsing,
          `Command '${cmd.command}' should parse arguments properly`
        ).toBe(true);
      }
    });
  });

  describe('Feature Implementation Verification', () => {
    test('init command should create configuration', () => {
      const handlerContent = extractCommandHandler(cliSourceCode, 'init');

      // Should use initializeApex function
      expect(handlerContent).toContain('initializeApex');

      // Should handle argument parsing and configuration
      const hasArgParsing = /args\[/.test(handlerContent!);
      expect(hasArgParsing, 'Init command should parse arguments').toBe(true);

      // Should create orchestrator and load config
      const hasConfigSetup = /loadConfig|ApexOrchestrator/.test(handlerContent!);
      expect(hasConfigSetup, 'Init command should setup configuration and orchestrator').toBe(true);
    });

    test('run command should integrate with orchestrator', () => {
      const handlerContent = extractCommandHandler(cliSourceCode, 'run');

      // Should call executeTask function (which integrates with orchestrator)
      expect(handlerContent).toContain('executeTask');

      // Should handle workflow options
      expect(handlerContent).toMatch(/--workflow/);

      // Should check for orchestrator initialization
      expect(handlerContent).toMatch(/ctx\.orchestrator/);
    });

    test('status command should display task information', () => {
      const handlerContent = extractCommandHandler(cliSourceCode, 'status');

      // Should load task data
      const hasDataLoading = /getTask|loadTask|orchestrator/.test(handlerContent!);
      expect(hasDataLoading, 'Status command should load task data').toBe(true);

      // Should format output
      const hasFormatting = /table|boxen|chalk/.test(handlerContent!);
      expect(hasFormatting, 'Status command should format output').toBe(true);
    });

    test('agents command should list available agents', () => {
      const handlerContent = extractCommandHandler(cliSourceCode, 'agents');

      // Should load agents
      expect(handlerContent).toContain('loadAgents');

      // Should display agent information
      const hasDisplay = /console\.log|table|boxen/.test(handlerContent!);
      expect(hasDisplay, 'Agents command should display agent information').toBe(true);
    });

    test('workflows command should list available workflows', () => {
      const handlerContent = extractCommandHandler(cliSourceCode, 'workflows');

      // Should load workflows
      expect(handlerContent).toContain('loadWorkflows');

      // Should display workflow information
      const hasDisplay = /console\.log|table|boxen/.test(handlerContent!);
      expect(hasDisplay, 'Workflows command should display workflow information').toBe(true);
    });

    test('logs command should display task logs', () => {
      const handlerContent = extractCommandHandler(cliSourceCode, 'logs');

      // Should require task ID
      const hasTaskIdCheck = /taskId|args\[0\]/.test(handlerContent!);
      expect(hasTaskIdCheck, 'Logs command should require task ID').toBe(true);

      // Should use orchestrator
      const hasOrchestratorUsage = /orchestrator\./.test(handlerContent!);
      expect(hasOrchestratorUsage, 'Logs command should use orchestrator').toBe(true);
    });
  });

  describe('Integration and Quality Checks', () => {
    test('all commands should use consistent patterns', () => {
      const patterns = {
        errorMessages: /chalk\.red/,
        successMessages: /chalk\.green/,
        warningMessages: /chalk\.yellow/,
        infoMessages: /chalk\.blue|chalk\.cyan/
      };

      for (const cmd of TARGET_COMMANDS) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);

        // Each command should use colored output for better UX
        const usesColoredOutput = Object.values(patterns).some(pattern =>
          pattern.test(handlerContent!)
        );

        expect(
          usesColoredOutput,
          `Command '${cmd.command}' should use colored output for better user experience`
        ).toBe(true);
      }
    });

    test('commands should have appropriate help text', () => {
      for (const cmd of TARGET_COMMANDS) {
        // Check that description exists and is meaningful
        const descriptionRegex = new RegExp(`name: ['"]${cmd.command}['"].*?description: ['"]([^'"]+)['"]`, 'gs');
        const match = descriptionRegex.exec(cliSourceCode);

        expect(match, `Command '${cmd.command}' should have description`).toBeTruthy();

        const description = match![1];
        expect(description.length, `Command '${cmd.command}' description should be meaningful`).toBeGreaterThan(10);
        expect(description, `Command '${cmd.command}' description should match expected`).toBe(cmd.description);
      }
    });

    test('command handlers should be properly typed', () => {
      // Check that handlers use proper TypeScript patterns
      const handlerPattern = /handler: async \(ctx(?:: ApexContext)?, args(?:: string\[\])?\) => \{/;

      for (const cmd of TARGET_COMMANDS) {
        const commandStart = cliSourceCode.indexOf(`name: '${cmd.command}'`);
        const commandSection = cliSourceCode.substring(commandStart, commandStart + 2000);

        // Should have properly typed handler
        const isProperlyTyped = handlerPattern.test(commandSection);
        expect(
          isProperlyTyped,
          `Command '${cmd.command}' handler should use proper TypeScript typing`
        ).toBe(true);
      }
    });
  });

  describe('Performance and Efficiency', () => {
    test('command handlers should not have obvious performance issues', () => {
      const performanceAntiPatterns = [
        /while\s*\(true\)/, // Infinite loops
        /for\s*\(.*\.length.*\).*for\s*\(.*\.length.*\)/, // Nested loops over arrays
        /setTimeout.*setTimeout/, // Multiple setTimeout calls
        /setInterval/, // SetInterval usage
      ];

      for (const cmd of TARGET_COMMANDS) {
        const handlerContent = extractCommandHandler(cliSourceCode, cmd.command);

        for (const pattern of performanceAntiPatterns) {
          const hasAntiPattern = pattern.test(handlerContent!);
          expect(
            hasAntiPattern,
            `Command '${cmd.command}' should not have performance anti-patterns`
          ).toBe(false);
        }
      }
    });
  });
});

// Helper Functions

function extractCommandHandler(sourceCode: string, commandName: string): string | null {
  const commandRegex = new RegExp(`name: ['"]${commandName}['"]`, 'g');
  const match = commandRegex.exec(sourceCode);

  if (!match) return null;

  const startIndex = match.index;
  const handlerMatch = sourceCode.substring(startIndex).match(/handler: async \(.*?\) => \{/);

  if (!handlerMatch) return null;

  const handlerStart = startIndex + handlerMatch.index! + handlerMatch[0].length;

  // Find matching closing brace
  let braceCount = 1;
  let i = handlerStart;
  while (i < sourceCode.length && braceCount > 0) {
    if (sourceCode[i] === '{') braceCount++;
    if (sourceCode[i] === '}') braceCount--;
    i++;
  }

  return sourceCode.substring(handlerStart, i - 1);
}

function isStubImplementation(handlerContent: string): boolean {
  const cleanContent = handlerContent.trim();

  // Check for stub indicators
  const stubPatterns = [
    /console\.log\(['"]Not implemented['"]?\)/,
    /throw new Error\(['"]Not implemented['"]?\)/,
    /TODO:/,
    /STUB/,
    /PLACEHOLDER/
  ];

  const hasStubPattern = stubPatterns.some(pattern => pattern.test(cleanContent));

  // Check if it's too simple (less than 5 meaningful lines)
  const meaningfulLines = cleanContent.split('\n')
    .filter(line => line.trim().length > 0)
    .filter(line => !line.trim().startsWith('//'))
    .filter(line => !line.trim().startsWith('/*'))
    .filter(line => line.trim() !== '{' && line.trim() !== '}');

  const tooSimple = meaningfulLines.length < 5;

  return hasStubPattern || tooSimple;
}

function calculateHandlerComplexity(handlerContent: string): {
  level: 'simple' | 'medium' | 'complex';
  lines: number;
  features: number;
} {
  const lines = handlerContent.split('\n').filter(line => line.trim().length > 0);

  // Count features
  const featurePatterns = [
    /console\.log/,
    /chalk\./,
    /if\s*\(/,
    /try\s*\{/,
    /await\s+/,
    /inquirer\./,
    /spawn\(/,
    /\.filter\(/,
    /\.map\(/,
    /orchestrator\./,
    /loadAgents|loadWorkflows/,
  ];

  const features = featurePatterns.filter(pattern => pattern.test(handlerContent)).length;

  let level: 'simple' | 'medium' | 'complex';
  if (lines.length < 10 || features < 3) level = 'simple';
  else if (lines.length < 50 || features < 6) level = 'medium';
  else level = 'complex';

  return { level, lines: lines.length, features };
}