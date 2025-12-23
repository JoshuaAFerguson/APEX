/**
 * CLI Guide Documentation Validation Tests
 *
 * This test suite validates that the documentation in docs/cli-guide.md
 * accurately reflects the actual implementation of CLI commands, keyboard
 * shortcuts, session management, and display modes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import the actual implementations to test against
vi.mock('ink-use-stdout-dimensions', () => ({
  default: () => [80, 24],
}));

import { commands } from '../../packages/cli/src/index.js';
import { ShortcutManager } from '../../packages/cli/src/services/ShortcutManager.js';
import { SessionStore } from '../../packages/cli/src/services/SessionStore.js';
import { App } from '../../packages/cli/src/ui/App.js';

describe('CLI Guide Documentation Validation', () => {
  let cliGuideContent: string;

  beforeEach(async () => {
    const guidePath = path.join(__dirname, '../cli-guide.md');
    cliGuideContent = await fs.readFile(guidePath, 'utf-8');
  });

  describe('REPL Commands Documentation', () => {
    it('should document all actual CLI commands', async () => {
      // Extract documented commands from the guide
      const documentedCommands = extractDocumentedCommands(cliGuideContent);

      // Get actual commands from implementation
      const actualCommands = commands.map(cmd => ({
        name: cmd.name,
        aliases: cmd.aliases,
        description: cmd.description,
        usage: cmd.usage
      }));

      // Verify all actual commands are documented
      for (const actualCmd of actualCommands) {
        const documented = documentedCommands.find(doc => doc.name === actualCmd.name);

        expect(documented, `Command '${actualCmd.name}' should be documented`).toBeDefined();

        if (documented) {
          // Verify aliases match
          expect(documented.aliases).toEqual(
            expect.arrayContaining(actualCmd.aliases),
            `Aliases for '${actualCmd.name}' should match implementation`
          );

          // Verify description is similar
          expect(documented.description).toContain(
            actualCmd.description.toLowerCase(),
            `Description for '${actualCmd.name}' should match implementation`
          );
        }
      }
    });

    it('should accurately document command usage patterns', () => {
      const commandUsagePatterns = [
        {
          command: '/init',
          pattern: /\/init \[--yes\] \[--name <name>\] \[--language <lang>\] \[--framework <fw>\]/,
          documented: true
        },
        {
          command: '/status',
          pattern: /\/status \[task_id\]/,
          documented: true
        },
        {
          command: '/config',
          pattern: /\/config \[--json\] \[--get <key>\] \[--set <key>=<value>\]/,
          documented: true
        },
        {
          command: '/logs',
          pattern: /\/logs <task_id> \[--level <level>\] \[--limit <n>\]/,
          documented: true
        },
        {
          command: '/run',
          pattern: /\/run "<description>" \[--workflow <name>\] \[--autonomy <level>\] \[--priority <level>\]/,
          documented: true
        }
      ];

      for (const pattern of commandUsagePatterns) {
        expect(cliGuideContent).toMatch(
          pattern.pattern,
          `Usage pattern for ${pattern.command} should be documented correctly`
        );
      }
    });

    it('should document command options and flags correctly', () => {
      // Test /init command options
      expect(cliGuideContent).toContain('--yes');
      expect(cliGuideContent).toContain('--name');
      expect(cliGuideContent).toContain('--language');
      expect(cliGuideContent).toContain('--framework');

      // Test autonomy levels
      expect(cliGuideContent).toContain('full');
      expect(cliGuideContent).toContain('review-before-commit');
      expect(cliGuideContent).toContain('review-before-merge');
      expect(cliGuideContent).toContain('manual');

      // Test output formats
      expect(cliGuideContent).toContain('--json');
      expect(cliGuideContent).toContain('--format');
    });
  });

  describe('Keyboard Shortcuts Documentation', () => {
    let shortcutManager: ShortcutManager;

    beforeEach(() => {
      shortcutManager = new ShortcutManager();
    });

    it('should document all implemented keyboard shortcuts', () => {
      const actualShortcuts = shortcutManager.getShortcuts();
      const documentedShortcuts = extractKeyboardShortcuts(cliGuideContent);

      for (const actualShortcut of actualShortcuts) {
        const formattedKey = shortcutManager.formatKey(actualShortcut.keys);
        const documented = documentedShortcuts.find(doc =>
          doc.shortcut === formattedKey ||
          doc.description.toLowerCase().includes(actualShortcut.description.toLowerCase().split(' ')[0])
        );

        expect(documented,
          `Keyboard shortcut '${formattedKey}' (${actualShortcut.description}) should be documented`
        ).toBeDefined();
      }
    });

    it('should accurately document shortcut key combinations', () => {
      const keyboardShortcutPatterns = [
        { pattern: /Ctrl\+C.*Cancel current operation/, description: 'Cancel operation' },
        { pattern: /Ctrl\+D.*Exit APEX/, description: 'Exit APEX' },
        { pattern: /Ctrl\+L.*Clear screen/, description: 'Clear screen' },
        { pattern: /Ctrl\+U.*Clear current line/, description: 'Clear line' },
        { pattern: /Ctrl\+W.*Delete word/, description: 'Delete word' },
        { pattern: /Ctrl\+A.*Move cursor to start/, description: 'Move to start' },
        { pattern: /Ctrl\+E.*Move cursor to end/, description: 'Move to end' },
        { pattern: /Ctrl\+P.*Previous history/, description: 'Previous history' },
        { pattern: /Ctrl\+N.*Next history/, description: 'Next history' },
        { pattern: /Tab.*Auto-complete/, description: 'Auto-complete' }
      ];

      for (const shortcut of keyboardShortcutPatterns) {
        expect(cliGuideContent).toMatch(
          shortcut.pattern,
          `Keyboard shortcut for ${shortcut.description} should be documented correctly`
        );
      }
    });

    it('should document shortcut contexts correctly', () => {
      const contextSections = [
        'Global Shortcuts',
        'Input Shortcuts',
        'History Navigation',
        'Auto-Completion'
      ];

      for (const section of contextSections) {
        expect(cliGuideContent).toContain(
          section,
          `Keyboard shortcut section '${section}' should be present`
        );
      }
    });
  });

  describe('Session Management Documentation', () => {
    it('should document all session commands', () => {
      const sessionCommands = [
        '/session list',
        '/session load',
        '/session save',
        '/session branch',
        '/session export',
        '/session delete',
        '/session info'
      ];

      for (const command of sessionCommands) {
        expect(cliGuideContent).toContain(
          command,
          `Session command '${command}' should be documented`
        );
      }
    });

    it('should document session command options', () => {
      const sessionOptions = [
        { command: '/session list', options: ['--all', '--search'] },
        { command: '/session save', options: ['--tags'] },
        { command: '/session branch', options: ['--from'] },
        { command: '/session export', options: ['--format', '--output'] }
      ];

      for (const { command, options } of sessionOptions) {
        for (const option of options) {
          expect(cliGuideContent).toContain(
            option,
            `Option '${option}' for '${command}' should be documented`
          );
        }
      }
    });

    it('should document export formats correctly', () => {
      const exportFormats = ['md', 'json', 'html'];

      for (const format of exportFormats) {
        expect(cliGuideContent).toContain(
          format,
          `Export format '${format}' should be documented`
        );
      }
    });
  });

  describe('Display Modes Documentation', () => {
    it('should document all display modes', () => {
      const displayModes = ['normal', 'compact', 'verbose'];

      for (const mode of displayModes) {
        expect(cliGuideContent).toContain(
          mode,
          `Display mode '${mode}' should be documented`
        );
      }
    });

    it('should document display mode commands', () => {
      const displayModeCommands = [
        '/compact',
        '/verbose',
        '/thoughts',
        '/preview'
      ];

      for (const command of displayModeCommands) {
        expect(cliGuideContent).toContain(
          command,
          `Display mode command '${command}' should be documented`
        );
      }
    });

    it('should document mode-specific features', () => {
      // Compact mode features
      expect(cliGuideContent).toContain('Single line with version');
      expect(cliGuideContent).toContain('Essential metrics only');
      expect(cliGuideContent).toContain('Current agent only');

      // Verbose mode features
      expect(cliGuideContent).toContain('Full debug logging');
      expect(cliGuideContent).toContain('Detailed token breakdown');
      expect(cliGuideContent).toContain('Complete tool input/output');

      // Thoughts features
      expect(cliGuideContent).toContain('AI reasoning');
      expect(cliGuideContent).toContain('thinking process');
    });
  });

  describe('Natural Language Task Examples', () => {
    it('should provide realistic task examples', () => {
      const taskExamples = [
        'Add a health check endpoint',
        'Fix the bug where users can\'t reset',
        'Refactor the authentication module',
        'Add unit tests for the user service',
        'Update the README'
      ];

      for (const example of taskExamples) {
        expect(cliGuideContent).toContain(
          example,
          `Task example '${example}' should be present`
        );
      }
    });

    it('should document task execution flow', () => {
      const flowSteps = [
        'Task Creation',
        'Branch Creation',
        'Workflow Execution',
        'Planning',
        'Architecture',
        'Implementation',
        'Testing',
        'Review',
        'Completion'
      ];

      for (const step of flowSteps) {
        expect(cliGuideContent).toContain(
          step,
          `Workflow step '${step}' should be documented`
        );
      }
    });
  });

  describe('Server Management Documentation', () => {
    it('should document server commands', () => {
      const serverCommands = ['/serve', '/web', '/stop'];

      for (const command of serverCommands) {
        expect(cliGuideContent).toContain(
          command,
          `Server command '${command}' should be documented`
        );
      }
    });

    it('should document auto-start configuration', () => {
      expect(cliGuideContent).toContain('autoStart');
      expect(cliGuideContent).toContain('api:');
      expect(cliGuideContent).toContain('webUI:');
    });

    it('should document default ports', () => {
      expect(cliGuideContent).toContain('3000'); // API default port
      expect(cliGuideContent).toContain('3001'); // Web UI default port
    });
  });

  describe('Configuration Documentation', () => {
    it('should document configuration file structure', () => {
      const configSections = [
        'project:',
        'autonomy:',
        'models:',
        'limits:',
        'api:',
        'webUI:'
      ];

      for (const section of configSections) {
        expect(cliGuideContent).toContain(
          section,
          `Configuration section '${section}' should be documented`
        );
      }
    });

    it('should document configuration options', () => {
      const configOptions = [
        'maxTokensPerTask',
        'maxCostPerTask',
        'dailyBudget',
        'planning',
        'implementation',
        'review'
      ];

      for (const option of configOptions) {
        expect(cliGuideContent).toContain(
          option,
          `Configuration option '${option}' should be documented`
        );
      }
    });
  });

  describe('Task Management Documentation', () => {
    it('should document all task states', () => {
      const taskStates = [
        'pending', 'queued', 'planning', 'in-progress',
        'waiting-approval', 'paused', 'completed', 'failed', 'cancelled'
      ];

      for (const state of taskStates) {
        expect(cliGuideContent).toContain(
          state,
          `Task state '${state}' should be documented`
        );
      }
    });

    it('should document task state icons', () => {
      const stateIcons = ['⏳', '📋', '🤔', '🔄', '✋', '⏸️', '✅', '❌', '🚫'];

      for (const icon of stateIcons) {
        expect(cliGuideContent).toContain(
          icon,
          `Task state icon '${icon}' should be documented`
        );
      }
    });

    it('should document branch naming convention', () => {
      expect(cliGuideContent).toContain('apex/<task_id_prefix>-<slug>');
      expect(cliGuideContent).toContain('apex/abc123-add-health-check');
    });
  });
});

// Helper functions for parsing documentation
function extractDocumentedCommands(content: string) {
  const commands = [];
  const commandRegex = /\| `\/(\w+)` \| `([^`]*)` \| ([^|]*) \|/g;
  let match;

  while ((match = commandRegex.exec(content)) !== null) {
    const [, name, aliasesStr, description] = match;
    const aliases = aliasesStr ? aliasesStr.split(', ').filter(a => a.trim()) : [];
    commands.push({
      name: name.trim(),
      aliases,
      description: description.trim()
    });
  }

  return commands;
}

function extractKeyboardShortcuts(content: string) {
  const shortcuts = [];
  const shortcutRegex = /\| `([^`]+)` \| ([^|]*) \|/g;
  let match;

  while ((match = shortcutRegex.exec(content)) !== null) {
    const [, shortcut, description] = match;
    shortcuts.push({
      shortcut: shortcut.trim(),
      description: description.trim()
    });
  }

  return shortcuts;
}
