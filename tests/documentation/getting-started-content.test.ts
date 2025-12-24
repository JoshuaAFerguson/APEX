/**
 * Getting Started Content Validation Tests
 *
 * Lightweight tests to validate the content of getting-started.md
 * without requiring complex setup or external dependencies.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Getting Started Documentation Content', () => {
  let content: string;

  beforeAll(() => {
    const docPath = path.join(__dirname, '../getting-started.md');
    content = fs.readFileSync(docPath, 'utf-8');
  });

  describe('v0.3.0 Feature Documentation', () => {
    it('should document rich terminal interface features', () => {
      expect(content).toContain('Terminal Interface (v0.3.0)');
      expect(content).toContain('rich terminal interface');
      expect(content).toContain('real-time updates');
      expect(content).toContain('enhanced visual feedback');
    });

    it('should include progress indicator examples', () => {
      expect(content).toContain('Progress Indicators');
      expect(content).toMatch(/\[■■■■■■■░░░\]/);
      expect(content).toContain('Stage Progress');
      expect(content).toContain('Recent Actions');
    });

    it('should document interactive controls', () => {
      expect(content).toContain('Interactive Controls');
      expect(content).toContain('Space');
      expect(content).toContain('Pause/resume');
      expect(content).toContain('q');
      expect(content).toContain('Quit task');
    });

    it('should show color-coded output system', () => {
      expect(content).toContain('Color-coded Output');
      expect(content).toContain('🟢');
      expect(content).toContain('🟡');
      expect(content).toContain('🔴');
      expect(content).toContain('🔵');
    });
  });

  describe('Session Management Features', () => {
    it('should document session management basics', () => {
      expect(content).toContain('Session Management Basics');
      expect(content).toContain('session state');
      expect(content).toContain('workflow continuity');
    });

    it('should document session commands', () => {
      expect(content).toContain('apex sessions');
      expect(content).toContain('apex resume');
      expect(content).toContain('apex attach');
      expect(content).toContain('task_abc123_def456');
    });

    it('should document session persistence', () => {
      expect(content).toContain('Session Persistence');
      expect(content).toContain('survive terminal disconnections');
      expect(content).toContain('.apex/apex.db');
      expect(content).toContain('Progress is preserved');
    });

    it('should document background execution', () => {
      expect(content).toContain('Background Execution');
      expect(content).toContain('--background');
      expect(content).toContain('apex status --background');
    });
  });

  describe('Tab Completion and Keyboard Shortcuts', () => {
    it('should document tab completion', () => {
      expect(content).toContain('Tab Completion');
      expect(content).toContain('intelligent tab completion');
      expect(content).toContain('apex <tab>');
    });

    it('should list available commands for completion', () => {
      expect(content).toContain('init, run, status, logs, sessions, serve');
    });

    it('should document autonomy level completion', () => {
      expect(content).toContain('--autonomy <tab>');
      expect(content).toContain('full, review-before-commit, review-before-merge, manual');
    });

    it('should include shortcuts table', () => {
      expect(content).toContain('| Shortcut | Action |');
      expect(content).toContain('Ctrl+C');
      expect(content).toContain('Ctrl+Z');
      expect(content).toContain('Tab');
    });

    it('should document shell completion setup', () => {
      expect(content).toContain('completion bash');
      expect(content).toContain('completion zsh');
      expect(content).toContain('completion fish');
      expect(content).toContain('~/.bashrc');
      expect(content).toContain('~/.zshrc');
    });
  });

  describe('Onboarding Flow', () => {
    it('should have numbered setup steps', () => {
      expect(content).toContain('1. Set Your API Key');
      expect(content).toContain('2. Initialize Your Project');
      expect(content).toContain('3. Review the Configuration');
      expect(content).toContain('4. Run Your First Task');
    });

    it('should include API key setup', () => {
      expect(content).toContain('export ANTHROPIC_API_KEY');
      expect(content).toContain('~/.bashrc');
    });

    it('should document project initialization', () => {
      expect(content).toContain('apex init');
      expect(content).toContain('Project name');
      expect(content).toContain('Language');
      expect(content).toContain('Framework');
    });

    it('should show realistic task example', () => {
      expect(content).toContain('Add a health check endpoint to the API');
      expect(content).toContain('Understanding the Output');
    });
  });

  describe('Installation Documentation', () => {
    it('should document installation options', () => {
      expect(content).toContain('Global Installation (Recommended)');
      expect(content).toContain('Use npx');
      expect(content).toContain('Local Development');
    });

    it('should include proper commands', () => {
      expect(content).toContain('npm install -g @apexcli/cli');
      expect(content).toContain('npx @apexcli/cli');
      expect(content).toContain('npm link');
    });

    it('should list prerequisites', () => {
      expect(content).toContain('Node.js 18 or higher');
      expect(content).toContain('Anthropic API Key');
      expect(content).toContain('Git');
    });
  });

  describe('Autonomy Levels', () => {
    it('should document all autonomy levels', () => {
      expect(content).toMatch(/\|\s*Level\s*\|\s*Description\s*\|/);
      expect(content).toContain('full');
      expect(content).toContain('review-before-commit');
      expect(content).toContain('review-before-merge');
      expect(content).toContain('manual');
    });

    it('should show usage examples', () => {
      expect(content).toContain('--autonomy manual');
    });
  });

  describe('CLI Guide Reference', () => {
    it('should link to CLI guide', () => {
      expect(content).toContain('cli-guide.md');
      expect(content).toContain('CLI Guide');
      expect(content).toContain('Complete command reference and advanced features');
    });

    it('should be in next steps section', () => {
      const nextStepsIndex = content.indexOf('## Next Steps');
      const cliGuideIndex = content.indexOf('cli-guide.md');
      expect(nextStepsIndex).toBeGreaterThan(-1);
      expect(cliGuideIndex).toBeGreaterThan(nextStepsIndex);
    });
  });

  describe('Troubleshooting', () => {
    it('should include common issues', () => {
      expect(content).toContain('APEX not initialized');
      expect(content).toContain('ANTHROPIC_API_KEY not set');
      expect(content).toContain('Task exceeds budget');
      expect(content).toContain('Agent makes wrong decisions');
    });

    it('should provide solutions', () => {
      expect(content).toContain('apex init');
      expect(content).toContain('export ANTHROPIC_API_KEY');
      expect(content).toContain('max_cost_per_task');
    });
  });

  describe('Document Structure', () => {
    it('should have proper markdown structure', () => {
      expect(content).toMatch(/^# Getting Started with APEX/m);
      expect(content).toContain('## Prerequisites');
      expect(content).toContain('## Installation');
      expect(content).toContain('## Quick Start');
    });

    it('should include code blocks', () => {
      const codeBlocks = content.match(/```[\s\S]*?```/g);
      expect(codeBlocks).toBeTruthy();
      expect(codeBlocks!.length).toBeGreaterThan(10);
    });

    it('should have navigation links', () => {
      expect(content).toContain('[Configure your agents](agents.md)');
      expect(content).toContain('[Define workflows](workflows.md)');
      expect(content).toContain('[API Reference](api-reference.md)');
      expect(content).toContain('[Best Practices](best-practices.md)');
    });
  });

  describe('Examples and Formatting', () => {
    it('should show cost and token information', () => {
      expect(content).toContain('Tokens:');
      expect(content).toContain('Cost:');
      expect(content).toContain('Duration:');
    });

    it('should include terminal output examples', () => {
      expect(content).toContain('🚀');
      expect(content).toContain('Task created:');
      expect(content).toContain('Branch:');
      expect(content).toContain('Workflow:');
    });

    it('should format configuration properly', () => {
      expect(content).toContain('version: "1.0"');
      expect(content).toContain('autonomy:');
      expect(content).toContain('limits:');
      expect(content).toContain('max_cost_per_task: 10.00');
    });
  });
});