/**
 * Getting Started Documentation Validation Tests
 *
 * This test suite validates that the documentation in docs/getting-started.md
 * accurately reflects v0.3.0 features including:
 * - Rich terminal UI features
 * - Session management basics
 * - Tab completion and keyboard shortcuts
 * - Updated onboarding flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

// Import actual implementations to validate against
import { commands } from '../../packages/cli/src/index.js';
import { ShortcutManager } from '../../packages/cli/src/services/ShortcutManager.js';
import { SessionStore } from '../../packages/cli/src/services/SessionStore.js';
import { CompletionEngine } from '../../packages/cli/src/services/CompletionEngine.js';

describe('Getting Started Documentation Validation', () => {
  let gettingStartedContent: string;

  beforeEach(async () => {
    const docPath = path.join(__dirname, '../getting-started.md');
    gettingStartedContent = await fs.readFile(docPath, 'utf-8');
  });

  describe('v0.3.0 Rich Terminal UI Documentation', () => {
    it('should document rich terminal interface features', () => {
      expect(gettingStartedContent).toContain('Terminal Interface (v0.3.0)');
      expect(gettingStartedContent).toContain('rich terminal interface');
      expect(gettingStartedContent).toContain('real-time updates');
      expect(gettingStartedContent).toContain('enhanced visual feedback');
    });

    it('should document progress indicators correctly', () => {
      expect(gettingStartedContent).toContain('Progress Indicators');
      expect(gettingStartedContent).toContain('Tasks display live progress');
      expect(gettingStartedContent).toContain('detailed stage information');

      // Check for visual progress bar representation
      expect(gettingStartedContent).toMatch(/\[■■■■■■■░░░\]/);
      expect(gettingStartedContent).toContain('Stage Progress');
    });

    it('should document interactive controls', () => {
      expect(gettingStartedContent).toContain('Interactive Controls');
      expect(gettingStartedContent).toContain('keyboard shortcuts');

      // Verify documented controls match implementation
      const controlsSection = gettingStartedContent.match(/Interactive Controls[\s\S]*?###/)?.[0] || '';
      expect(controlsSection).toContain('Space');
      expect(controlsSection).toContain('Pause/resume');
      expect(controlsSection).toContain('q');
      expect(controlsSection).toContain('Quit task');
      expect(controlsSection).toContain('l');
      expect(controlsSection).toContain('View detailed logs');
      expect(controlsSection).toContain('Enter');
      expect(controlsSection).toContain('Approve current stage');
    });

    it('should document color-coded output system', () => {
      expect(gettingStartedContent).toContain('Color-coded Output');

      // Verify emoji/color indicators are documented
      expect(gettingStartedContent).toContain('🟢 Success indicators');
      expect(gettingStartedContent).toContain('🟡 Warnings and reviews');
      expect(gettingStartedContent).toContain('🔴 Errors and failures');
      expect(gettingStartedContent).toContain('🔵 Information and status updates');
    });

    it('should include realistic terminal output examples', () => {
      // Check for example terminal output blocks
      expect(gettingStartedContent).toMatch(/```[\s\S]*?Task Progress[\s\S]*?```/);
      expect(gettingStartedContent).toContain('🚀 APEX Task:');
      expect(gettingStartedContent).toContain('Recent Actions:');
      expect(gettingStartedContent).toContain('Tokens:');
      expect(gettingStartedContent).toContain('Cost:');
      expect(gettingStartedContent).toContain('Elapsed:');
    });
  });

  describe('Session Management Documentation', () => {
    let sessionStore: SessionStore;

    beforeEach(() => {
      sessionStore = new SessionStore();
    });

    it('should document session management basics', () => {
      expect(gettingStartedContent).toContain('Session Management Basics');
      expect(gettingStartedContent).toContain('session state');
      expect(gettingStartedContent).toContain('workflow continuity');
    });

    it('should document active session commands', () => {
      const sessionCommands = [
        'apex sessions',
        'apex resume',
        'apex attach'
      ];

      for (const command of sessionCommands) {
        expect(gettingStartedContent).toContain(
          command,
          `Session command '${command}' should be documented in getting started`
        );
      }
    });

    it('should document session persistence features', () => {
      expect(gettingStartedContent).toContain('Session Persistence');
      expect(gettingStartedContent).toContain('survive terminal disconnections');
      expect(gettingStartedContent).toContain('system restarts');
      expect(gettingStartedContent).toContain('.apex/apex.db');
      expect(gettingStartedContent).toContain('Progress is preserved');
      expect(gettingStartedContent).toContain('Resume where you left off');
    });

    it('should document background execution', () => {
      expect(gettingStartedContent).toContain('Background Execution');
      expect(gettingStartedContent).toContain('--background');
      expect(gettingStartedContent).toContain('apex status --background');
    });

    it('should provide realistic session examples', () => {
      // Check for task ID format examples
      expect(gettingStartedContent).toMatch(/task_[a-z0-9_]+/);
      expect(gettingStartedContent).toContain('task_abc123_def456');
    });
  });

  describe('Tab Completion and Keyboard Shortcuts', () => {
    let completionEngine: CompletionEngine;
    let shortcutManager: ShortcutManager;

    beforeEach(() => {
      completionEngine = new CompletionEngine();
      shortcutManager = new ShortcutManager();
    });

    it('should document tab completion system', () => {
      expect(gettingStartedContent).toContain('Tab Completion');
      expect(gettingStartedContent).toContain('intelligent tab completion');
      expect(gettingStartedContent).toContain('faster workflows');
    });

    it('should document command completion examples', () => {
      expect(gettingStartedContent).toContain('apex <tab>');
      expect(gettingStartedContent).toContain('init, run, status, logs, sessions, serve');
      expect(gettingStartedContent).toContain('task_<tab>');
      expect(gettingStartedContent).toContain('--autonomy <tab>');
      expect(gettingStartedContent).toContain('full, review-before-commit, review-before-merge, manual');
    });

    it('should document essential keyboard shortcuts', () => {
      const documentedShortcuts = [
        { shortcut: 'Ctrl+C', action: 'Graceful task termination' },
        { shortcut: 'Ctrl+Z', action: 'Pause task' },
        { shortcut: '↑/↓', action: 'Navigate command history' },
        { shortcut: 'Tab', action: 'Auto-complete commands/options' },
        { shortcut: 'Ctrl+L', action: 'Clear terminal' }
      ];

      for (const { shortcut, action } of documentedShortcuts) {
        expect(gettingStartedContent).toContain(shortcut);
        expect(gettingStartedContent).toContain(action);
      }
    });

    it('should document tab completion setup for different shells', () => {
      const shells = ['bash', 'zsh', 'fish'];

      for (const shell of shells) {
        expect(gettingStartedContent).toContain(shell);
        expect(gettingStartedContent).toContain(`completion ${shell}`);
      }

      // Check for setup commands
      expect(gettingStartedContent).toContain('eval "$(apex completion bash)"');
      expect(gettingStartedContent).toContain('~/.bashrc');
      expect(gettingStartedContent).toContain('~/.zshrc');
      expect(gettingStartedContent).toContain('| source');
    });

    it('should include shortcuts table with proper formatting', () => {
      // Verify the shortcuts table exists and is properly formatted
      expect(gettingStartedContent).toMatch(/\| Shortcut \| Action \|/);
      expect(gettingStartedContent).toMatch(/\|----------|---------|/);
    });
  });

  describe('Autonomy Levels Documentation', () => {
    it('should document all autonomy levels', () => {
      const autonomyLevels = [
        { level: 'full', description: 'Complete autonomy' },
        { level: 'review-before-commit', description: 'Pauses before each commit' },
        { level: 'review-before-merge', description: 'Creates PR and waits' },
        { level: 'manual', description: 'Pauses at each stage' }
      ];

      for (const { level, description } of autonomyLevels) {
        expect(gettingStartedContent).toContain(level);
        expect(gettingStartedContent).toContain(description);
      }
    });

    it('should document autonomy level usage', () => {
      expect(gettingStartedContent).toContain('--autonomy manual');
      expect(gettingStartedContent).toContain('override per-task');
    });
  });

  describe('Link to CLI Guide', () => {
    it('should include link to cli-guide.md', () => {
      expect(gettingStartedContent).toContain('cli-guide.md');
      expect(gettingStartedContent).toContain('CLI Guide');
      expect(gettingStartedContent).toContain('Complete command reference and advanced features');
    });

    it('should position CLI guide link appropriately', () => {
      const nextStepsIndex = gettingStartedContent.indexOf('## Next Steps');
      const cliGuideIndex = gettingStartedContent.indexOf('cli-guide.md');

      expect(nextStepsIndex).toBeGreaterThan(-1);
      expect(cliGuideIndex).toBeGreaterThan(-1);
      expect(cliGuideIndex).toBeGreaterThan(nextStepsIndex);
    });
  });

  describe('Improved Onboarding Flow', () => {
    it('should provide clear step-by-step initialization', () => {
      const steps = ['Set Your API Key', 'Initialize Your Project', 'Review the Configuration', 'Run Your First Task'];

      for (const step of steps) {
        expect(gettingStartedContent).toContain(step);
      }
    });

    it('should include realistic task examples', () => {
      expect(gettingStartedContent).toContain('Add a health check endpoint to the API');
      expect(gettingStartedContent).toContain('Understanding the Output');
    });

    it('should document the workflow stages clearly', () => {
      const stages = ['planning', 'implementation'];

      for (const stage of stages) {
        expect(gettingStartedContent).toContain(`Stage: ${stage}`);
      }
    });

    it('should show cost and token information', () => {
      expect(gettingStartedContent).toContain('Tokens:');
      expect(gettingStartedContent).toContain('Cost:');
      expect(gettingStartedContent).toContain('Duration:');
    });
  });

  describe('Code Examples and Formatting', () => {
    it('should use proper markdown formatting for code blocks', () => {
      const codeBlockPattern = /```[\s\S]*?```/g;
      const codeBlocks = gettingStartedContent.match(codeBlockPattern);

      expect(codeBlocks).toBeTruthy();
      expect(codeBlocks!.length).toBeGreaterThan(5);
    });

    it('should include proper shell commands', () => {
      expect(gettingStartedContent).toContain('npm install -g @apexcli/cli');
      expect(gettingStartedContent).toContain('export ANTHROPIC_API_KEY=');
      expect(gettingStartedContent).toContain('apex init');
      expect(gettingStartedContent).toContain('apex run');
    });

    it('should format configuration examples correctly', () => {
      expect(gettingStartedContent).toContain('config.yaml');
      expect(gettingStartedContent).toContain('version: "1.0"');
      expect(gettingStartedContent).toContain('autonomy:');
      expect(gettingStartedContent).toContain('limits:');
    });
  });

  describe('Installation Options', () => {
    it('should document all installation methods', () => {
      expect(gettingStartedContent).toContain('Global Installation (Recommended)');
      expect(gettingStartedContent).toContain('Use npx');
      expect(gettingStartedContent).toContain('Local Development');
    });

    it('should include proper installation commands', () => {
      expect(gettingStartedContent).toContain('npm install -g @apexcli/cli');
      expect(gettingStartedContent).toContain('npx @apexcli/cli');
      expect(gettingStartedContent).toContain('git clone');
      expect(gettingStartedContent).toContain('npm link');
    });
  });

  describe('Troubleshooting Section', () => {
    it('should include common troubleshooting scenarios', () => {
      const troubleshootingScenarios = [
        'APEX not initialized',
        'ANTHROPIC_API_KEY not set',
        'Task exceeds budget',
        'Agent makes wrong decisions'
      ];

      for (const scenario of troubleshootingScenarios) {
        expect(gettingStartedContent).toContain(scenario);
      }
    });

    it('should provide actionable solutions', () => {
      expect(gettingStartedContent).toContain('apex init');
      expect(gettingStartedContent).toContain('export ANTHROPIC_API_KEY');
      expect(gettingStartedContent).toContain('max_cost_per_task');
      expect(gettingStartedContent).toContain('acceptance criteria');
    });
  });

  describe('Prerequisites and Environment Setup', () => {
    it('should list all required prerequisites', () => {
      expect(gettingStartedContent).toContain('Node.js 18 or higher');
      expect(gettingStartedContent).toContain('Anthropic API Key');
      expect(gettingStartedContent).toContain('Git');
    });

    it('should provide links to required resources', () => {
      expect(gettingStartedContent).toContain('https://nodejs.org/');
      expect(gettingStartedContent).toContain('https://console.anthropic.com/');
    });
  });

  describe('Document Structure and Flow', () => {
    it('should have logical section ordering', () => {
      const sections = [
        '## Prerequisites',
        '## Installation',
        '## Quick Start',
        '## Terminal Interface (v0.3.0)',
        '## Session Management Basics',
        '## Keyboard Shortcuts & Tab Completion',
        '## Next Steps'
      ];

      let lastIndex = -1;
      for (const section of sections) {
        const currentIndex = gettingStartedContent.indexOf(section);
        expect(currentIndex).toBeGreaterThan(lastIndex,
          `Section "${section}" should appear after previous sections`);
        lastIndex = currentIndex;
      }
    });

    it('should include proper navigation links', () => {
      expect(gettingStartedContent).toContain('[CLI Guide](cli-guide.md)');
      expect(gettingStartedContent).toContain('[Configure your agents](agents.md)');
      expect(gettingStartedContent).toContain('[Define workflows](workflows.md)');
      expect(gettingStartedContent).toContain('[API Reference](api-reference.md)');
      expect(gettingStartedContent).toContain('[Best Practices](best-practices.md)');
    });
  });
});