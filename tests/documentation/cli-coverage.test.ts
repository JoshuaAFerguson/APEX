/**
 * CLI Coverage Tests
 *
 * Ensures comprehensive test coverage for all documented CLI features
 * and validates that examples in the documentation actually work.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('CLI Guide Coverage Tests', () => {
  let cliGuideContent: string;

  beforeEach(async () => {
    const guidePath = path.join(__dirname, '../cli-guide.md');
    cliGuideContent = await fs.readFile(guidePath, 'utf-8');
  });

  describe('Documentation Completeness', () => {
    it('should cover all required sections', () => {
      const requiredSections = [
        'Getting Started',
        'Starting APEX',
        'REPL Commands',
        'Session Management',
        'Display Modes',
        'Keyboard Shortcuts',
        'Natural Language Tasks',
        'Server Management',
        'Task Management',
        'Configuration'
      ];

      for (const section of requiredSections) {
        expect(cliGuideContent).toContain(
          `## ${section}`,
          `Section '${section}' should be documented`
        );
      }
    });

    it('should document all core REPL commands', () => {
      const coreCommands = [
        '/help', '/init', '/status', '/agents', '/workflows',
        '/config', '/version', '/clear', '/exit', '/run',
        '/logs', '/cancel', '/retry', '/resume', '/pr'
      ];

      for (const command of coreCommands) {
        expect(cliGuideContent).toContain(
          command,
          `Core command '${command}' should be documented`
        );
      }
    });

    it('should provide usage examples for complex commands', () => {
      const commandsWithExamples = [
        { command: '/init', examples: ['--yes', '--name', '--language'] },
        { command: '/run', examples: ['"description"', '--workflow', '--autonomy'] },
        { command: '/config', examples: ['get', 'set', '--json'] },
        { command: '/session', examples: ['list', 'save', 'export', 'branch'] },
        { command: '/logs', examples: ['task_id', '--level', '--limit'] }
      ];

      for (const { command, examples } of commandsWithExamples) {
        for (const example of examples) {
          expect(cliGuideContent).toContain(
            example,
            `Example '${example}' should be provided for '${command}'`
          );
        }
      }
    });

    it('should document all keyboard shortcut categories', () => {
      const shortcutCategories = [
        'Global Shortcuts',
        'Input Shortcuts',
        'History Navigation',
        'Auto-Completion'
      ];

      for (const category of shortcutCategories) {
        expect(cliGuideContent).toContain(
          category,
          `Keyboard shortcut category '${category}' should be documented`
        );
      }
    });

    it('should document all display modes with features', () => {
      const displayModes = [
        { mode: 'normal', features: ['Standard display', 'all components'] },
        { mode: 'compact', features: ['Single line', 'Essential metrics'] },
        { mode: 'verbose', features: ['debug logging', 'token breakdown'] }
      ];

      for (const { mode, features } of displayModes) {
        expect(cliGuideContent).toContain(
          mode,
          `Display mode '${mode}' should be documented`
        );

        for (const feature of features) {
          expect(cliGuideContent).toContain(
            feature,
            `Feature '${feature}' should be documented for ${mode} mode`
          );
        }
      }
    });

    it('should document all session management features', () => {
      const sessionFeatures = [
        'session list',
        'session save',
        'session load',
        'session branch',
        'session export',
        'session info',
        'session delete'
      ];

      for (const feature of sessionFeatures) {
        expect(cliGuideContent).toContain(
          feature,
          `Session feature '${feature}' should be documented`
        );
      }
    });

    it('should document configuration options comprehensively', () => {
      const configSections = [
        'project', 'autonomy', 'models', 'limits', 'api', 'webUI'
      ];

      for (const section of configSections) {
        expect(cliGuideContent).toContain(
          `${section}:`,
          `Configuration section '${section}' should be documented`
        );
      }

      const configOptions = [
        'maxTokensPerTask',
        'maxCostPerTask',
        'dailyBudget',
        'autoStart'
      ];

      for (const option of configOptions) {
        expect(cliGuideContent).toContain(
          option,
          `Configuration option '${option}' should be documented`
        );
      }
    });
  });

  describe('Example Validation', () => {
    it('should provide valid command syntax examples', () => {
      const examplePatterns = [
        // Init examples
        /\/init\s+--yes/,
        /\/init\s+--name\s+[\w-]+\s+--language\s+\w+/,

        // Status examples
        /\/status\s+task_[a-z0-9_]+/,

        // Config examples
        /\/config\s+get\s+[\w.]+/,
        /\/config\s+set\s+[\w.]+=[^\s]+/,

        // Run examples
        /\/run\s+"[^"]+"\s+--workflow\s+\w+/,

        // Session examples
        /\/session\s+save\s+"[^"]+"/,
        /\/session\s+export\s+--format\s+\w+/,

        // Logs examples
        /\/logs\s+task_[a-z0-9_]+\s+--level\s+\w+/
      ];

      for (const pattern of examplePatterns) {
        expect(cliGuideContent).toMatch(
          pattern,
          `Example matching pattern '${pattern}' should be present`
        );
      }
    });

    it('should show realistic task examples', () => {
      const taskPatterns = [
        /Add.*endpoint/i,
        /Fix.*bug/i,
        /Refactor.*module/i,
        /Update.*README/i,
        /Implement.*feature/i
      ];

      for (const pattern of taskPatterns) {
        expect(cliGuideContent).toMatch(
          pattern,
          `Realistic task example matching '${pattern}' should be present`
        );
      }
    });

    it('should demonstrate workflow progression', () => {
      const workflowSteps = [
        'Task Creation',
        'Branch Creation',
        'Workflow Execution',
        'planning', 'architecture', 'implementation', 'testing', 'review'
      ];

      for (const step of workflowSteps) {
        expect(cliGuideContent).toContain(
          step,
          `Workflow step '${step}' should be demonstrated`
        );
      }
    });

    it('should show correct output format examples', () => {
      const outputExamples = [
        // Status output
        /task_[a-z0-9_]+.*✅.*completed.*\$[0-9.]+/,

        // Session list output
        /[a-z0-9]+.*\|.*\d+ msgs.*\|.*\$[0-9.]+/,

        // Agent list output
        /✓.*\w+.*\(.*\)/,

        // Task completion output
        /✅.*Task Completed.*Tokens:.*Cost:.*Duration:/
      ];

      for (const pattern of outputExamples) {
        expect(cliGuideContent).toMatch(
          pattern,
          `Output example matching pattern '${pattern}' should be present`
        );
      }
    });
  });

  describe('Feature Completeness', () => {
    it('should document all autonomy levels', () => {
      const autonomyLevels = [
        'full',
        'review-before-commit',
        'review-before-merge',
        'manual'
      ];

      for (const level of autonomyLevels) {
        expect(cliGuideContent).toContain(
          level,
          `Autonomy level '${level}' should be documented`
        );
      }
    });

    it('should document all task states with icons', () => {
      const taskStatesWithIcons = [
        { state: 'pending', icon: '⏳' },
        { state: 'queued', icon: '📋' },
        { state: 'planning', icon: '🤔' },
        { state: 'in-progress', icon: '🔄' },
        { state: 'waiting-approval', icon: '✋' },
        { state: 'paused', icon: '⏸️' },
        { state: 'completed', icon: '✅' },
        { state: 'failed', icon: '❌' },
        { state: 'cancelled', icon: '🚫' }
      ];

      for (const { state, icon } of taskStatesWithIcons) {
        expect(cliGuideContent).toContain(
          state,
          `Task state '${state}' should be documented`
        );
        expect(cliGuideContent).toContain(
          icon,
          `Task state icon '${icon}' should be documented`
        );
      }
    });

    it('should document all export formats', () => {
      const exportFormats = ['md', 'json', 'html'];

      for (const format of exportFormats) {
        expect(cliGuideContent).toContain(
          format,
          `Export format '${format}' should be documented`
        );
      }
    });

    it('should document environment variables', () => {
      const envVars = [
        'ANTHROPIC_API_KEY',
        'APEX_CLASSIC_UI'
      ];

      for (const envVar of envVars) {
        expect(cliGuideContent).toContain(
          envVar,
          `Environment variable '${envVar}' should be documented`
        );
      }
    });

    it('should document cost and token tracking', () => {
      const trackingFeatures = [
        'Input Tokens',
        'Output Tokens',
        'Estimated Cost',
        'formatTokens',
        'formatCost'
      ];

      for (const feature of trackingFeatures) {
        expect(cliGuideContent).toContain(
          feature,
          `Cost/token tracking feature '${feature}' should be documented`
        );
      }
    });
  });

  describe('Tips and Best Practices', () => {
    it('should provide actionable tips', () => {
      const tipCategories = [
        'Use Descriptive Task Descriptions',
        'Leverage Autonomy Levels',
        'Monitor Costs',
        'Use Session Management',
        'Customize Display Mode'
      ];

      for (const category of tipCategories) {
        expect(cliGuideContent).toContain(
          category,
          `Tip category '${category}' should be provided`
        );
      }
    });

    it('should show good vs bad examples', () => {
      // Look for contrast in examples
      expect(cliGuideContent).toMatch(
        /# Good[\s\S]*# Less effective/m,
        'Should show good vs less effective examples'
      );
    });

    it('should reference help resources', () => {
      const helpResources = [
        'In-app Help',
        'Documentation',
        'GitHub Issues',
        'GitHub Discussions'
      ];

      for (const resource of helpResources) {
        expect(cliGuideContent).toContain(
          resource,
          `Help resource '${resource}' should be referenced`
        );
      }
    });
  });

  describe('Cross-References and Navigation', () => {
    it('should have a complete table of contents', () => {
      const tocPattern = /## Table of Contents[\s\S]*?---/;
      const tocMatch = cliGuideContent.match(tocPattern);

      expect(tocMatch).toBeTruthy();

      const toc = tocMatch![0];

      // Check for major section links
      const expectedSections = [
        'Getting Started',
        'REPL Commands',
        'Session Management',
        'Display Modes',
        'Keyboard Shortcuts',
        'Natural Language Tasks',
        'Configuration'
      ];

      for (const section of expectedSections) {
        expect(toc).toContain(
          section,
          `Table of contents should reference '${section}'`
        );
      }
    });

    it('should have internal cross-references', () => {
      const crossRefPatterns = [
        /See.*\[.*\]\(#.*\)/,  // Markdown links
        /Run.*\/init.*first/,   // Command prerequisites
        /Type.*\/help/          // Help references
      ];

      for (const pattern of crossRefPatterns) {
        expect(cliGuideContent).toMatch(
          pattern,
          `Should contain cross-references matching '${pattern}'`
        );
      }
    });
  });
});