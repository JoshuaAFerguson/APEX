/**
 * Comprehensive Getting Started Documentation Tests
 *
 * This test suite validates that all v0.3.0 features documented in
 * getting-started.md are accurate, complete, and provide proper guidance.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe.skip('Getting Started Documentation - Comprehensive Validation', () => {
  let content: string;
  let sections: Record<string, string>;

  beforeAll(() => {
    const docPath = path.join(__dirname, '../getting-started.md');
    content = fs.readFileSync(docPath, 'utf-8');

    // Parse document into sections
    sections = parseDocumentSections(content);
  });

  describe('Acceptance Criteria Validation', () => {
    it('should include rich terminal UI features', () => {
      expect(content).toContain('Terminal Interface (v0.3.0)');
      expect(sections['Terminal Interface (v0.3.0)']).toBeDefined();

      const terminalSection = sections['Terminal Interface (v0.3.0)'];
      expect(terminalSection).toContain('Progress Indicators');
      expect(terminalSection).toContain('Interactive Controls');
      expect(terminalSection).toContain('Color-coded Output');
      expect(terminalSection).toMatch(/\[■■■■■■■░░░\]/);
    });

    it('should include session management basics', () => {
      expect(content).toContain('Session Management Basics');
      expect(sections['Session Management Basics']).toBeDefined();

      const sessionSection = sections['Session Management Basics'];
      expect(sessionSection).toContain('Active Sessions');
      expect(sessionSection).toContain('Session Persistence');
      expect(sessionSection).toContain('Background Execution');
      expect(sessionSection).toContain('apex sessions');
      expect(sessionSection).toContain('apex resume');
      expect(sessionSection).toContain('apex attach');
    });

    it('should include tab completion and keyboard shortcuts', () => {
      expect(content).toContain('Keyboard Shortcuts & Tab Completion');
      expect(sections['Keyboard Shortcuts & Tab Completion']).toBeDefined();

      const shortcutSection = sections['Keyboard Shortcuts & Tab Completion'];
      expect(shortcutSection).toContain('Tab Completion');
      expect(shortcutSection).toContain('Essential Shortcuts');
      expect(shortcutSection).toContain('Setup Tab Completion');
    });

    it('should link to cli-guide.md for detailed reference', () => {
      expect(content).toContain('cli-guide.md');
      expect(content).toContain('Complete command reference and advanced features');

      const nextStepsSection = sections['Next Steps'];
      expect(nextStepsSection).toBeDefined();
      expect(nextStepsSection).toContain('cli-guide.md');
    });
  });

  describe('Feature Coverage Validation', () => {
    it('should document all v0.3.0 terminal features', () => {
      const terminalFeatures = [
        'rich terminal interface',
        'real-time updates',
        'progress indicators',
        'interactive controls',
        'color-coded output',
        'visual feedback'
      ];

      for (const feature of terminalFeatures) {
        expect(content.toLowerCase()).toContain(feature.toLowerCase());
      }
    });

    it('should document session management commands', () => {
      const sessionCommands = [
        'apex sessions',
        'apex resume',
        'apex attach',
        '--background'
      ];

      for (const command of sessionCommands) {
        expect(content).toContain(command);
      }
    });

    it('should document keyboard shortcuts properly', () => {
      const shortcuts = [
        'Space',
        'Ctrl+C',
        'Ctrl+Z',
        'Tab',
        'Enter'
      ];

      for (const shortcut of shortcuts) {
        expect(content).toContain(shortcut);
      }
    });
  });

  describe('Onboarding Flow Validation', () => {
    it('should have clear step-by-step structure', () => {
      const steps = [
        '1. Set Your API Key',
        '2. Initialize Your Project',
        '3. Review the Configuration',
        '4. Run Your First Task'
      ];

      for (const step of steps) {
        expect(content).toContain(step);
      }
    });

    it('should provide actionable examples', () => {
      expect(content).toContain('export ANTHROPIC_API_KEY=');
      expect(content).toContain('apex init');
      expect(content).toContain('apex run "Add a health check endpoint to the API"');
    });

    it('should explain the output users will see', () => {
      expect(content).toContain('Understanding the Output');
      expect(content).toContain('Task created:');
      expect(content).toContain('Tokens:');
      expect(content).toContain('Cost:');
      expect(content).toContain('Duration:');
    });
  });

  describe('Technical Accuracy Validation', () => {
    it('should use correct command syntax', () => {
      // Validate installation commands
      expect(content).toContain('npm install -g @apexcli/cli');
      expect(content).toContain('npx @apexcli/cli <command>');

      // Validate API key setup
      expect(content).toMatch(/export ANTHROPIC_API_KEY=.*your_api_key_here/);

      // Validate completion setup
      expect(content).toContain('eval "$(apex completion bash)"');
      expect(content).toContain('apex completion fish | source');
    });

    it('should use realistic examples', () => {
      // Task IDs should follow actual format
      expect(content).toMatch(/task_[a-z0-9]+_[a-z0-9]+/);

      // Branch names should follow convention
      expect(content).toContain('apex/abc123-add-health-check');

      // Configuration should be valid YAML
      expect(content).toContain('version: "1.0"');
      expect(content).toContain('max_cost_per_task: 10.00');
    });

    it('should include proper file paths', () => {
      expect(content).toContain('.apex/config.yaml');
      expect(content).toContain('.apex/apex.db');
      expect(content).toContain('~/.bashrc');
      expect(content).toContain('~/.zshrc');
    });
  });

  describe('Documentation Quality Validation', () => {
    it('should have proper markdown structure', () => {
      expect(content).toMatch(/^# Getting Started with APEX$/m);

      // Should have logical heading hierarchy
      const h2Headings = content.match(/^## .+$/gm) || [];
      expect(h2Headings.length).toBeGreaterThan(5);

      const h3Headings = content.match(/^### .+$/gm) || [];
      expect(h3Headings.length).toBeGreaterThan(10);
    });

    it('should include sufficient code examples', () => {
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      expect(codeBlocks.length).toBeGreaterThan(15);

      // Should include various code block types
      expect(content).toContain('```bash');
      expect(content).toContain('```yaml');
    });

    it('should have appropriate link references', () => {
      const internalLinks = [
        '[CLI Guide](cli-guide.md)',
        '[Configure your agents](agents.md)',
        '[Define workflows](workflows.md)',
        '[API Reference](api-reference.md)',
        '[Best Practices](best-practices.md)'
      ];

      for (const link of internalLinks) {
        expect(content).toContain(link);
      }
    });
  });

  describe('User Experience Validation', () => {
    it('should provide troubleshooting guidance', () => {
      const troubleshootingSection = sections['Troubleshooting'];
      expect(troubleshootingSection).toBeDefined();

      expect(troubleshootingSection).toContain('APEX not initialized');
      expect(troubleshootingSection).toContain('ANTHROPIC_API_KEY not set');
      expect(troubleshootingSection).toContain('Task exceeds budget');
      expect(troubleshootingSection).toContain('Agent makes wrong decisions');
    });

    it('should include helpful tips and context', () => {
      // Should explain workflow stages
      expect(content).toContain('planning');
      expect(content).toContain('implementation');
      expect(content).toContain('Create a feature branch');
      expect(content).toContain('Create a pull request');
    });

    it('should provide clear autonomy level explanations', () => {
      const autonomyLevels = ['full', 'review-before-commit', 'review-before-merge', 'manual'];

      for (const level of autonomyLevels) {
        expect(content).toContain(level);
      }

      // Should explain what each level does
      expect(content).toContain('Complete autonomy');
      expect(content).toContain('Pauses before each commit');
      expect(content).toContain('Creates PR and waits');
      expect(content).toContain('Pauses at each stage');
    });
  });
});

// Helper function to parse document into sections
function parseDocumentSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h2Match || h3Match) {
      // Save previous section
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n');
      }

      // Start new section
      currentSection = (h2Match || h3Match)![1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n');
  }

  return sections;
}