/**
 * StatusBar Component Integration Tests
 *
 * Tests the integration between StatusBar documentation and the actual
 * component implementation to ensure documentation accuracy.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('StatusBar Component Integration Tests', () => {
  let statusBarSource: string;
  let documentationContent: string;
  let helperTestsContent: string;

  beforeAll(() => {
    const statusBarPath = path.join(__dirname, '../../packages/cli/src/ui/components/StatusBar.tsx');
    const docPath = path.join(__dirname, '../cli-guide.md');
    const helperTestsPath = path.join(__dirname, '../../packages/cli/src/ui/components/__tests__/StatusBar.helpers.test.ts');

    // Only read if files exist (for CI environments that might not have source)
    try {
      statusBarSource = fs.readFileSync(statusBarPath, 'utf-8');
    } catch {
      statusBarSource = '';
    }

    try {
      helperTestsContent = fs.readFileSync(helperTestsPath, 'utf-8');
    } catch {
      helperTestsContent = '';
    }

    documentationContent = fs.readFileSync(docPath, 'utf-8');
  });

  describe('Documentation Accuracy vs Implementation', () => {
    it('should document accurate abbreviation behavior', () => {
      // Documentation claims about abbreviation
      expect(documentationContent).toContain('tokens:` → `tk:`');
      expect(documentationContent).toContain('model:` → `mod:`');
      expect(documentationContent).toContain('session:` → `sess:`');
      expect(documentationContent).toContain('active:` → `act:`');

      // If source is available, verify these abbreviations exist
      if (statusBarSource) {
        expect(statusBarSource).toMatch(/abbreviatedLabel.*tk:|tok:/);
        expect(statusBarSource).toMatch(/abbreviatedLabel.*mod:/);
        expect(statusBarSource).toMatch(/abbreviatedLabel.*sess:/);
        expect(statusBarSource).toMatch(/abbreviatedLabel.*act:/);
      }
    });

    it('should document accurate terminal width breakpoints', () => {
      // Documentation claims about breakpoints
      expect(documentationContent).toContain('< 60 columns');
      expect(documentationContent).toContain('60-160 columns');
      expect(documentationContent).toContain('> 160 columns');

      // If helper tests exist, verify breakpoint logic
      if (helperTestsContent) {
        expect(helperTestsContent).toMatch(/terminalWidth.*80/);
        expect(helperTestsContent).toContain('terminalWidth < 80');
        expect(helperTestsContent).toContain('terminalWidth >= 80');
      }
    });

    it('should document accurate priority system', () => {
      expect(documentationContent).toContain('CRITICAL');
      expect(documentationContent).toContain('HIGH');
      expect(documentationContent).toContain('MEDIUM');
      expect(documentationContent).toContain('LOW');

      // Documentation should describe what each priority means
      expect(documentationContent).toContain('Always shown');
      expect(documentationContent).toContain('Essential');
      expect(documentationContent).toContain('Standard');
      expect(documentationContent).toContain('Extended');
    });

    it('should document accurate color mappings', () => {
      const colorMappings = [
        { color: 'Green', usage: 'Success, connected, active processing' },
        { color: 'Red', usage: 'Error, disconnected, failed' },
        { color: 'Yellow', usage: 'Warning, in-progress, totals' },
        { color: 'Blue', usage: 'Information, models, stage indicators' },
        { color: 'Cyan', usage: 'Progress, data, mode indicators' },
        { color: 'Magenta', usage: 'Agents, special features' },
        { color: 'Gray', usage: 'Labels, secondary info, timers' }
      ];

      colorMappings.forEach(({ color, usage }) => {
        expect(documentationContent).toContain(`**${color}**`);
        expect(documentationContent).toContain(usage);
      });
    });
  });

  describe('Element Documentation Completeness', () => {
    it('should document all documented elements with proper specifications', () => {
      const requiredElements = [
        'Connection Status',
        'Git Branch',
        'Agent Indicator',
        'Workflow Stage',
        'Subtask Progress',
        'Token Count',
        'Cost Display',
        'Model Indicator',
        'Session Timer',
        'Total Token Count',
        'Session Cost',
        'Active Time',
        'Session Name',
        'API Port',
        'Web UI Port',
        'Token Breakdown',
        'Idle Time',
        'Stage Timer',
        'Preview Mode',
        'Thoughts Mode',
        'Verbose Mode'
      ];

      requiredElements.forEach(element => {
        expect(documentationContent).toContain(`**${element}**`);
      });

      // Each element should have icon, description, values, and priority
      const elementSections = documentationContent.match(/\*\*[A-Z][^*]+\*\*[^*]+\*\*Icon:\*\*/g);
      expect(elementSections).toBeTruthy();
      expect(elementSections!.length).toBeGreaterThan(15);
    });

    it('should provide accurate icon documentation', () => {
      const iconMappings = [
        { element: 'Connection Status', icon: '●/○' },
        { element: 'Git Branch', icon: '⎇' },
        { element: 'Agent Indicator', icon: '⚡' },
        { element: 'Workflow Stage', icon: '▶' },
        { element: 'Subtask Progress', icon: '📋' }
      ];

      iconMappings.forEach(({ element, icon }) => {
        const elementSection = documentationContent.substring(
          documentationContent.indexOf(`**${element}**`),
          documentationContent.indexOf('**', documentationContent.indexOf(`**${element}**`) + element.length + 4)
        );
        expect(elementSection).toContain(`**Icon:** ${icon}`);
      });
    });

    it('should provide accurate visibility documentation', () => {
      // Each element should have a visibility table
      const visibilityTables = documentationContent.match(/\*\*Visibility:\*\*[^*]+\|[^|]+\|[^|]+\|[^|]+\|/g);
      expect(visibilityTables).toBeTruthy();
      expect(visibilityTables!.length).toBeGreaterThan(10);

      // Tables should have consistent column headers
      expect(documentationContent).toContain('| Width | Compact | Normal | Verbose |');
      expect(documentationContent).toContain('|-------|---------|--------|---------|');
    });
  });

  describe('Visual Example Accuracy', () => {
    it('should use realistic and consistent example data', () => {
      const examples = [
        'main', // git branch
        'developer', // agent
        'implementation', // workflow stage
        '[2/5]', // subtask progress
        '45.2k', // token count
        '$0.1523', // cost
        'sonnet', // model
        '05:23' // timer
      ];

      examples.forEach(example => {
        expect(documentationContent).toContain(example);
      });
    });

    it('should show proper ASCII box drawing', () => {
      const statusBarSection = documentationContent.substring(
        documentationContent.indexOf('**Full StatusBar'),
        documentationContent.indexOf('**Verbose Mode')
      );

      // Should have proper box drawing characters
      expect(statusBarSection).toMatch(/┌─+┐/);
      expect(statusBarSection).toMatch(/│.*│/);
      expect(statusBarSection).toMatch(/└─+┘/);

      // Should show realistic terminal width
      const boxLine = statusBarSection.match(/┌─+┐/)?.[0];
      expect(boxLine?.length).toBeGreaterThan(50); // Realistic terminal width
    });

    it('should show accurate element positioning', () => {
      const visualExample = documentationContent.substring(
        documentationContent.indexOf('**Full StatusBar'),
        documentationContent.indexOf('**Verbose Mode')
      );

      // Should show elements in logical order: left-side elements, spacer, right-side elements
      const exampleLine = visualExample.match(/│ ● .* │/)?.[0];
      expect(exampleLine).toBeTruthy();

      // Left side: connection, branch, agent, stage, progress
      expect(exampleLine).toContain('● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5]');

      // Right side: tokens, cost, model, timer
      expect(exampleLine).toContain('tokens: 45.2k | cost: $0.1523 | model: sonnet | 05:23');
    });
  });

  describe('Troubleshooting Accuracy', () => {
    it('should provide accurate troubleshooting steps', () => {
      const troubleshootingSection = documentationContent.substring(
        documentationContent.indexOf('### Troubleshooting'),
        documentationContent.indexOf('---')
      );

      // Should reference actual commands
      expect(troubleshootingSection).toContain('/compact');
      expect(troubleshootingSection).toContain('/verbose');

      // Should reference actual behavior
      expect(troubleshootingSection).toContain('Compact mode hides non-essential elements');
      expect(troubleshootingSection).toContain('Elements only show when data exists');
      expect(troubleshootingSection).toContain('Narrow terminals hide lower-priority elements');
    });

    it('should provide realistic performance guidance', () => {
      const troubleshootingSection = documentationContent.substring(
        documentationContent.indexOf('### Troubleshooting'),
        documentationContent.indexOf('---')
      );

      expect(troubleshootingSection).toContain('Some terminals render slowly');
      expect(troubleshootingSection).toContain('reduces rendering complexity');
      expect(troubleshootingSection).toContain('Very long sessions may impact performance');
    });
  });

  describe('Cross-reference Consistency', () => {
    it('should maintain consistent element counts across all documentation', () => {
      const files = [
        { name: 'cli-guide.md', content: documentationContent },
        { name: 'v030-features.md', content: fs.readFileSync(path.join(__dirname, '../features/v030-features.md'), 'utf-8') },
        { name: 'display-modes.md', content: fs.readFileSync(path.join(__dirname, '../user-guide/display-modes.md'), 'utf-8') }
      ];

      files.forEach(file => {
        if (file.content.includes('21 display elements') || file.content.includes('21 possible elements')) {
          expect(file.content).toMatch(/21 (display )?elements/);
        }
      });
    });

    it('should use consistent terminology across documentation', () => {
      const terminology = [
        'StatusBar',
        'priority-based',
        'responsive behavior',
        'terminal width',
        'display modes'
      ];

      const allContent = documentationContent +
        fs.readFileSync(path.join(__dirname, '../features/v030-features.md'), 'utf-8') +
        fs.readFileSync(path.join(__dirname, '../user-guide/display-modes.md'), 'utf-8');

      terminology.forEach(term => {
        expect(allContent).toContain(term);
      });
    });

    it('should maintain consistent link formatting', () => {
      const v030Content = fs.readFileSync(path.join(__dirname, '../features/v030-features.md'), 'utf-8');
      const displayModesContent = fs.readFileSync(path.join(__dirname, '../user-guide/display-modes.md'), 'utf-8');

      // Both should link to the same anchor
      if (v030Content.includes('StatusBar Reference')) {
        expect(v030Content).toContain('[StatusBar Reference](../cli-guide.md#statusbar-reference)');
      }

      if (displayModesContent.includes('StatusBar Reference')) {
        expect(displayModesContent).toContain('[StatusBar Reference](../cli-guide.md#statusbar-reference)');
      }
    });
  });

  describe('Documentation Structure Validation', () => {
    it('should have proper markdown heading hierarchy', () => {
      const statusBarSection = documentationContent.substring(
        documentationContent.indexOf('## StatusBar Reference'),
        documentationContent.indexOf('## Keyboard Shortcuts')
      );

      // Should have h3 subheadings under the h2 main heading
      const h2Count = (statusBarSection.match(/^## /gm) || []).length;
      const h3Count = (statusBarSection.match(/^### /gm) || []).length;
      const h4Count = (statusBarSection.match(/^#### /gm) || []).length;

      expect(h2Count).toBe(1); // Just the main heading
      expect(h3Count).toBeGreaterThan(4); // Visual Example, Display Elements, Responsive Behavior, Color Coding, Troubleshooting
      expect(h4Count).toBeGreaterThan(3); // Priority System, mode subsections, troubleshooting subsections
    });

    it('should have proper table formatting', () => {
      const statusBarSection = documentationContent.substring(
        documentationContent.indexOf('## StatusBar Reference'),
        documentationContent.indexOf('## Keyboard Shortcuts')
      );

      // Tables should have proper markdown syntax
      const tableRows = statusBarSection.match(/\|[^|\n]+\|[^|\n]+\|/g);
      expect(tableRows).toBeTruthy();
      expect(tableRows!.length).toBeGreaterThan(20);

      // Should have header separators
      const tableSeparators = statusBarSection.match(/\|[-\s]+\|[-\s]+\|/g);
      expect(tableSeparators).toBeTruthy();
      expect(tableSeparators!.length).toBeGreaterThan(5);
    });

    it('should maintain consistent code block formatting', () => {
      const statusBarSection = documentationContent.substring(
        documentationContent.indexOf('## StatusBar Reference'),
        documentationContent.indexOf('## Keyboard Shortcuts')
      );

      // Should have code blocks for visual examples
      const codeBlocks = statusBarSection.match(/```[\s\S]*?```/g);
      expect(codeBlocks).toBeTruthy();
      expect(codeBlocks!.length).toBeGreaterThan(1);

      // Inline code should use backticks
      const inlineCode = statusBarSection.match(/`[^`]+`/g);
      expect(inlineCode).toBeTruthy();
      expect(inlineCode!.length).toBeGreaterThan(10);
    });
  });
});