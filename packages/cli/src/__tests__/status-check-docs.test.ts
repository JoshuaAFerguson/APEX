/**
 * Status Command --check-docs Flag Tests
 * Tests the CLI status command with --check-docs flag for outdated documentation detection
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import chalk from 'chalk';
import { commands, CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { OutdatedDocumentation } from '@apexcli/core';

// Mock dependencies
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((text) => `cyan(${text})`),
    green: vi.fn((text) => `green(${text})`),
    red: vi.fn((text) => `red(${text})`),
    yellow: vi.fn((text) => `yellow(${text})`),
    blue: vi.fn((text) => `blue(${text})`),
    gray: vi.fn((text) => `gray(${text})`),
    bold: {
      red: vi.fn((text) => `bold.red(${text})`),
      yellow: vi.fn((text) => `bold.yellow(${text})`),
      blue: vi.fn((text) => `bold.blue(${text})`),
    },
  },
}));

vi.mock('@apexcli/orchestrator');

describe('Status Command --check-docs Flag', () => {
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let ctx: CliContext;
  let consoleSpy: MockedFunction<typeof console.log>;
  let statusCommand: typeof commands[0]['handler'];

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockOrchestrator = {
      getDocumentationAnalysis: vi.fn(),
      getTask: vi.fn(),
      listTasks: vi.fn(),
    };

    ctx = {
      cwd: '/test/project',
      initialized: true,
      config: {} as any,
      orchestrator: mockOrchestrator as ApexOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Find the status command
    statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
    expect(statusCommand).toBeDefined();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Flag Parsing', () => {
    it('should detect --check-docs flag correctly', async () => {
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue([]);

      await statusCommand(ctx, ['--check-docs']);

      expect(getDocumentationAnalysis).toHaveBeenCalled();
    });

    it('should filter out --check-docs from task ID arguments', async () => {
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue([]);

      await statusCommand(ctx, ['task123', '--check-docs']);

      expect(getDocumentationAnalysis).toHaveBeenCalled();
      // Should not try to get task with '--check-docs' as ID
    });

    it('should work with --check-docs flag in different positions', async () => {
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue([]);

      // Test different argument positions
      await statusCommand(ctx, ['--check-docs', 'somearg']);
      expect(getDocumentationAnalysis).toHaveBeenCalled();

      vi.clearAllMocks();

      await statusCommand(ctx, ['arg1', '--check-docs', 'arg2']);
      expect(getDocumentationAnalysis).toHaveBeenCalled();
    });

    it('should handle regular status command when no --check-docs flag', async () => {
      const listTasks = mockOrchestrator.listTasks as MockedFunction<any>;
      listTasks.mockResolvedValue([]);

      await statusCommand(ctx, []);

      expect(mockOrchestrator.getDocumentationAnalysis).not.toHaveBeenCalled();
      expect(listTasks).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should display error when APEX not initialized', async () => {
      const uninitializedCtx = { ...ctx, initialized: false, orchestrator: null };

      await statusCommand(uninitializedCtx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        'red(APEX not initialized. Run /init first.)'
      );
    });

    it('should handle getDocumentationAnalysis throwing an error', async () => {
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockRejectedValue(new Error('Analysis failed'));

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        'red(❌ Failed to analyze documentation: Error: Analysis failed)'
      );
    });

    it('should handle undefined orchestrator gracefully', async () => {
      const ctxWithoutOrchestrator = { ...ctx, orchestrator: null };

      await statusCommand(ctxWithoutOrchestrator, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        'red(APEX not initialized. Run /init first.)'
      );
    });
  });

  describe('No Issues Found', () => {
    it('should display success message when no outdated docs found', async () => {
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue([]);

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        'green(✓ No outdated documentation detected.\n)'
      );
    });
  });

  describe('Issues Display', () => {
    it('should display high severity issues with red coloring', async () => {
      const highSeverityIssues: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Package version is outdated in documentation',
          line: 10,
          suggestion: 'Update to version 2.0.0',
          severity: 'high',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(highSeverityIssues);

      await statusCommand(ctx, ['--check-docs']);

      // Check that high severity section header is displayed
      expect(consoleSpy).toHaveBeenCalledWith('bold.red(🔴 High Severity Issues:)');

      // Check that issue details are displayed with red coloring
      expect(consoleSpy).toHaveBeenCalledWith(
        'red(  • 🔢 Package version is outdated in documentation)'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'gray(    Location: README.md:10)'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'gray(    Suggestion: Update to version 2.0.0)'
      );
    });

    it('should display medium severity issues with yellow coloring', async () => {
      const mediumSeverityIssues: OutdatedDocumentation[] = [
        {
          file: 'docs/api.md',
          type: 'deprecated-api',
          description: 'References deprecated API endpoint',
          line: 25,
          severity: 'medium',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(mediumSeverityIssues);

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith('bold.yellow(🟡 Medium Severity Issues:)');
      expect(consoleSpy).toHaveBeenCalledWith(
        'yellow(  • ⚠️ References deprecated API endpoint)'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'gray(    Location: docs/api.md:25)'
      );
    });

    it('should display low severity issues with blue coloring', async () => {
      const lowSeverityIssues: OutdatedDocumentation[] = [
        {
          file: 'CHANGELOG.md',
          type: 'stale-reference',
          description: 'Old date in changelog entry',
          severity: 'low',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(lowSeverityIssues);

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith('bold.blue(🔵 Low Severity Issues:)');
      expect(consoleSpy).toHaveBeenCalledWith(
        'blue(  • 🗓️ Old date in changelog entry)'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'gray(    Location: CHANGELOG.md)'
      );
    });

    it('should handle issues without line numbers', async () => {
      const issuesWithoutLine: OutdatedDocumentation[] = [
        {
          file: 'package.json',
          type: 'version-mismatch',
          description: 'Package version mismatch',
          severity: 'high',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(issuesWithoutLine);

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        'gray(    Location: package.json)'
      );
    });

    it('should handle issues without suggestions', async () => {
      const issuesWithoutSuggestion: OutdatedDocumentation[] = [
        {
          file: 'docs/guide.md',
          type: 'broken-link',
          description: 'Broken external link',
          line: 15,
          severity: 'medium',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(issuesWithoutSuggestion);

      await statusCommand(ctx, ['--check-docs']);

      // Should not display suggestion line
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Suggestion:')
      );
    });

    it('should display mixed severity issues correctly grouped', async () => {
      const mixedSeverityIssues: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Critical version mismatch',
          severity: 'high',
        },
        {
          file: 'docs/api.md',
          type: 'deprecated-api',
          description: 'Minor API deprecation',
          severity: 'medium',
        },
        {
          file: 'CHANGELOG.md',
          type: 'stale-reference',
          description: 'Old reference',
          severity: 'low',
        },
        {
          file: 'package.json',
          type: 'version-mismatch',
          description: 'Another critical issue',
          severity: 'high',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(mixedSeverityIssues);

      await statusCommand(ctx, ['--check-docs']);

      // Verify all severity sections are displayed
      expect(consoleSpy).toHaveBeenCalledWith('bold.red(🔴 High Severity Issues:)');
      expect(consoleSpy).toHaveBeenCalledWith('bold.yellow(🟡 Medium Severity Issues:)');
      expect(consoleSpy).toHaveBeenCalledWith('bold.blue(🔵 Low Severity Issues:)');

      // Verify summary
      expect(consoleSpy).toHaveBeenCalledWith(
        'cyan(📊 Summary:)'
      );
      expect(consoleSpy).toHaveBeenCalledWith('  Total Issues: 4');
      expect(consoleSpy).toHaveBeenCalledWith(
        '  High: red(2) | Medium: yellow(1) | Low: blue(1)\n'
      );
    });

    it('should display summary with correct counts', async () => {
      const issues: OutdatedDocumentation[] = [
        { file: 'a.md', type: 'version-mismatch', description: 'Issue 1', severity: 'high' },
        { file: 'b.md', type: 'deprecated-api', description: 'Issue 2', severity: 'high' },
        { file: 'c.md', type: 'broken-link', description: 'Issue 3', severity: 'medium' },
        { file: 'd.md', type: 'outdated-example', description: 'Issue 4', severity: 'low' },
        { file: 'e.md', type: 'stale-reference', description: 'Issue 5', severity: 'low' },
        { file: 'f.md', type: 'broken-link', description: 'Issue 6', severity: 'low' },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(issues);

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith('  Total Issues: 6');
      expect(consoleSpy).toHaveBeenCalledWith(
        '  High: red(2) | Medium: yellow(1) | Low: blue(3)\n'
      );
    });
  });

  describe('Documentation Type Emojis', () => {
    it('should use correct emojis for each documentation type', async () => {
      const allTypes: OutdatedDocumentation[] = [
        { file: 'a.md', type: 'version-mismatch', description: 'Version issue', severity: 'high' },
        { file: 'b.md', type: 'deprecated-api', description: 'API issue', severity: 'medium' },
        { file: 'c.md', type: 'broken-link', description: 'Link issue', severity: 'medium' },
        { file: 'd.md', type: 'outdated-example', description: 'Example issue', severity: 'low' },
        { file: 'e.md', type: 'stale-reference', description: 'Reference issue', severity: 'low' },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(allTypes);

      await statusCommand(ctx, ['--check-docs']);

      // Check for correct emojis
      expect(consoleSpy).toHaveBeenCalledWith('red(  • 🔢 Version issue)');
      expect(consoleSpy).toHaveBeenCalledWith('yellow(  • ⚠️ API issue)');
      expect(consoleSpy).toHaveBeenCalledWith('yellow(  • 🔗 Link issue)');
      expect(consoleSpy).toHaveBeenCalledWith('blue(  • 📝 Example issue)');
      expect(consoleSpy).toHaveBeenCalledWith('blue(  • 🗓️ Reference issue)');
    });

    it('should use default emoji for unknown documentation types', async () => {
      const unknownTypeIssue: OutdatedDocumentation[] = [
        {
          file: 'test.md',
          type: 'unknown-type' as any,
          description: 'Unknown issue type',
          severity: 'medium',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(unknownTypeIssue);

      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith('yellow(  • 📄 Unknown issue type)');
    });
  });
});