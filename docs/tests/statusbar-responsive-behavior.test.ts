/**
 * StatusBar Responsive Behavior Tests
 *
 * Validates that the StatusBar responsive behavior documentation
 * accurately describes the component's adaptive display logic.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('StatusBar Responsive Behavior Documentation', () => {
  let cliGuideContent: string;
  let v030FeaturesContent: string;

  beforeAll(() => {
    const cliGuidePath = path.join(__dirname, '../cli-guide.md');
    const v030FeaturesPath = path.join(__dirname, '../features/v030-features.md');

    cliGuideContent = fs.readFileSync(cliGuidePath, 'utf-8');
    v030FeaturesContent = fs.readFileSync(v030FeaturesPath, 'utf-8');
  });

  describe('Responsive System Documentation', () => {
    it('should document the 3-tier responsive system accurately', () => {
      expect(cliGuideContent).toContain('### Responsive Behavior');
      expect(cliGuideContent).toContain('automatically adapts to your terminal width using a priority-based system');

      const responsiveTable = cliGuideContent.substring(
        cliGuideContent.indexOf('| Terminal Width | Display Tier | Elements Shown |'),
        cliGuideContent.indexOf('**Responsive Features:**')
      );

      expect(responsiveTable).toContain('| < 60 columns | Narrow | CRITICAL + HIGH priority only, abbreviated labels |');
      expect(responsiveTable).toContain('| 60-160 columns | Normal | CRITICAL + HIGH + MEDIUM priority, full labels |');
      expect(responsiveTable).toContain('| > 160 columns | Wide | All priority levels, full labels + extended details |');
    });

    it('should document responsive features with specific examples', () => {
      expect(cliGuideContent).toContain('**Responsive Features:**');
      expect(cliGuideContent).toContain('**Automatic abbreviation**');
      expect(cliGuideContent).toContain('**Progressive hiding**');

      // Should have specific abbreviation examples
      expect(cliGuideContent).toContain('tokens:` → `tk:`');
      expect(cliGuideContent).toContain('in narrow terminals');
      expect(cliGuideContent).toContain('Lower priority elements disappear first when space is limited');
    });

    it('should document intelligent width detection', () => {
      expect(cliGuideContent).toContain('intelligently adapts');
      expect(cliGuideContent).toContain('terminal width and display modes');
      expect(cliGuideContent).toContain('critical information is always visible');
    });
  });

  describe('Display Mode Behavior Documentation', () => {
    it('should document compact mode behavior', () => {
      expect(cliGuideContent).toContain('#### Compact Mode');
      expect(cliGuideContent).toContain('Minimal elements only');
      expect(cliGuideContent).toContain('Essential status information');
      expect(cliGuideContent).toContain('Forces most aggressive space optimization');
      expect(cliGuideContent).toContain('regardless of terminal width');
    });

    it('should document normal mode behavior', () => {
      expect(cliGuideContent).toContain('#### Normal Mode');
      expect(cliGuideContent).toContain('Responsive to terminal width');
      expect(cliGuideContent).toContain('Shows standard development information');
      expect(cliGuideContent).toContain('Balances information density with readability');
    });

    it('should document verbose mode behavior', () => {
      expect(cliGuideContent).toContain('#### Verbose Mode');
      expect(cliGuideContent).toContain('Shows maximum information regardless of terminal width');
      expect(cliGuideContent).toContain('All 21 possible elements when data is available');
      expect(cliGuideContent).toContain('Detailed timing breakdown');
      expect(cliGuideContent).toContain('Token input→output breakdown');
      expect(cliGuideContent).toContain('Session cost tracking');
      expect(cliGuideContent).toContain('Mode indicator');
    });
  });

  describe('Priority-based Element Documentation', () => {
    it('should document priority levels with clear descriptions', () => {
      const priorityTable = cliGuideContent.substring(
        cliGuideContent.indexOf('#### Priority System'),
        cliGuideContent.indexOf('#### Left Side Elements')
      );

      expect(priorityTable).toContain('| **CRITICAL** | Always shown | Core functionality indicators | All widths, all modes |');
      expect(priorityTable).toContain('| **HIGH** | Essential | Important status information | Normal+ terminal widths |');
      expect(priorityTable).toContain('| **MEDIUM** | Standard | Detailed progress information | Wide terminal widths |');
      expect(priorityTable).toContain('| **LOW** | Extended | Additional context and debug info | Wide terminals, verbose mode |');
    });

    it('should categorize elements by priority correctly', () => {
      // CRITICAL elements - should always be visible
      const criticalElements = [
        'Connection Status',
        'Git Branch',
        'Agent Indicator',
        'Workflow Stage'
      ];

      criticalElements.forEach(element => {
        const elementSection = cliGuideContent.substring(
          cliGuideContent.indexOf(`**${element}**`),
          cliGuideContent.indexOf('**', cliGuideContent.indexOf(`**${element}**`) + element.length + 4)
        );
        expect(elementSection).toContain('**Priority:** CRITICAL');
      });

      // HIGH elements - visible in normal+ terminals
      const highElements = [
        'Subtask Progress',
        'Token Count',
        'Cost Display',
        'Model Indicator',
        'Session Timer'
      ];

      highElements.forEach(element => {
        const elementSection = cliGuideContent.substring(
          cliGuideContent.indexOf(`**${element}**`),
          cliGuideContent.indexOf('**', cliGuideContent.indexOf(`**${element}**`) + element.length + 4)
        );
        expect(elementSection).toContain('**Priority:** HIGH');
      });
    });

    it('should show progressive visibility for each element', () => {
      // Each element should have a visibility table showing when it appears
      const visibilityTables = cliGuideContent.match(/\*\*Visibility:\*\*[\s\S]*?\| Wide \|.*?\|/g);
      expect(visibilityTables).toBeTruthy();
      expect(visibilityTables!.length).toBeGreaterThan(15);

      // Should use consistent width categories
      visibilityTables!.forEach(table => {
        expect(table).toContain('| Width | Compact | Normal | Verbose |');
        expect(table).toContain('|-------|---------|--------|---------|');
      });
    });
  });

  describe('Terminal Width Breakpoint Documentation', () => {
    it('should document specific width thresholds', () => {
      // Main responsive table
      expect(cliGuideContent).toContain('< 60 columns');
      expect(cliGuideContent).toContain('60-160 columns');
      expect(cliGuideContent).toContain('> 160 columns');

      // Also in v030-features.md
      expect(v030FeaturesContent).toContain('< 60 columns');
      expect(v030FeaturesContent).toContain('60-160 columns');
      expect(v030FeaturesContent).toContain('> 160 columns');
    });

    it('should describe behavior at each breakpoint', () => {
      const responsiveSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Responsive Behavior'),
        cliGuideContent.indexOf('### Color Coding Reference')
      );

      expect(responsiveSection).toContain('Narrow');
      expect(responsiveSection).toContain('Normal');
      expect(responsiveSection).toContain('Wide');
      expect(responsiveSection).toContain('abbreviated labels');
      expect(responsiveSection).toContain('full labels');
      expect(responsiveSection).toContain('extended details');
    });

    it('should explain the rationale for breakpoints', () => {
      expect(cliGuideContent).toContain('priority-based system');
      expect(cliGuideContent).toContain('critical information is always visible');
      expect(cliGuideContent).toContain('adapts to your terminal width');
      expect(cliGuideContent).toContain('ensures critical information is always visible');
    });
  });

  describe('Abbreviation System Documentation', () => {
    it('should document specific abbreviation mappings', () => {
      const abbreviations = [
        { full: 'tokens:', short: 'tk:' },
        { full: 'model:', short: 'mod:' },
        { full: 'session:', short: 'sess:' },
        { full: 'active:', short: 'act:' },
        { full: 'cost:', short: '' } // Empty abbreviation
      ];

      abbreviations.forEach(({ full, short }) => {
        if (short === '') {
          // Cost uses empty abbreviation (no label when abbreviated)
          expect(cliGuideContent).toContain(`\`${full}\` → (no label)`);
        } else {
          expect(cliGuideContent).toContain(`\`${full}\` → \`${short}\``);
        }
      });
    });

    it('should explain abbreviation behavior', () => {
      expect(cliGuideContent).toContain('Labels automatically shorten');
      expect(cliGuideContent).toContain('in narrow terminals');
      expect(cliGuideContent).toContain('narrow terminals');
      expect(cliGuideContent).toContain('show full labels');
      expect(cliGuideContent).toContain('show abbreviated labels');

      // Should also be documented in v030-features.md
      expect(v030FeaturesContent).toContain('**Smart Abbreviations:**');
      expect(v030FeaturesContent).toContain('Labels automatically shorten in narrow terminals');
    });

    it('should document when abbreviations are used', () => {
      expect(cliGuideContent).toContain('Automatic abbreviation');
      expect(cliGuideContent).toContain('when space is limited');
      expect(cliGuideContent).toContain('Progressive hiding');
      expect(cliGuideContent).toContain('Lower priority elements disappear first');
    });
  });

  describe('Element Layout Documentation', () => {
    it('should document left and right side element organization', () => {
      expect(cliGuideContent).toContain('#### Left Side Elements');
      expect(cliGuideContent).toContain('#### Right Side Elements');

      // Left side elements
      const leftSideSection = cliGuideContent.substring(
        cliGuideContent.indexOf('#### Left Side Elements'),
        cliGuideContent.indexOf('#### Right Side Elements')
      );

      const leftElements = [
        'Connection Status',
        'Git Branch',
        'Agent Indicator',
        'Workflow Stage',
        'Subtask Progress'
      ];

      leftElements.forEach(element => {
        expect(leftSideSection).toContain(element);
      });

      // Right side elements
      const rightSideSection = cliGuideContent.substring(
        cliGuideContent.indexOf('#### Right Side Elements'),
        cliGuideContent.indexOf('### Color Coding Reference')
      );

      const rightElements = [
        'Token Count',
        'Cost Display',
        'Model Indicator',
        'Session Timer'
      ];

      rightElements.forEach(element => {
        expect(rightSideSection).toContain(element);
      });
    });

    it('should show logical element ordering in visual examples', () => {
      const visualExample = cliGuideContent.substring(
        cliGuideContent.indexOf('**Full StatusBar'),
        cliGuideContent.indexOf('**Verbose Mode')
      );

      // Should show left-to-right order in the visual
      const exampleContent = visualExample.match(/│ ● .* │/)?.[0];
      expect(exampleContent).toBeTruthy();

      // Connection should come first
      expect(exampleContent?.indexOf('●')).toBeLessThan(exampleContent?.indexOf('⎇') || 100);
      // Branch should come before agent
      expect(exampleContent?.indexOf('⎇')).toBeLessThan(exampleContent?.indexOf('⚡') || 100);
      // Agent should come before stage
      expect(exampleContent?.indexOf('⚡')).toBeLessThan(exampleContent?.indexOf('▶') || 100);
      // Stage should come before progress
      expect(exampleContent?.indexOf('▶')).toBeLessThan(exampleContent?.indexOf('📋') || 100);

      // Tokens should come before cost on right side
      expect(exampleContent?.indexOf('tokens:')).toBeLessThan(exampleContent?.indexOf('cost:') || 1000);
      // Model should come before timer
      expect(exampleContent?.indexOf('model:')).toBeLessThan(exampleContent?.indexOf('05:23') || 1000);
    });
  });

  describe('Responsive Behavior Examples', () => {
    it('should provide realistic examples for different widths', () => {
      // Should show how the StatusBar would look at different widths
      const examples = [
        'Wide Terminal, Normal Mode',
        'Verbose Mode (Additional Elements)'
      ];

      examples.forEach(example => {
        expect(cliGuideContent).toContain(example);
      });

      // Should show realistic terminal content
      expect(cliGuideContent).toContain('45.2k'); // Realistic token count
      expect(cliGuideContent).toContain('$0.1523'); // Realistic cost
      expect(cliGuideContent).toContain('05:23'); // Realistic timer
      expect(cliGuideContent).toContain('[2/5]'); // Realistic progress
    });

    it('should demonstrate progressive information hiding', () => {
      // Verbose mode should show more information
      const verboseExample = cliGuideContent.substring(
        cliGuideContent.indexOf('**Verbose Mode'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Should show additional elements only in verbose
      expect(verboseExample).toContain('💾 my-session'); // Session name
      expect(verboseExample).toContain('api:3000'); // API port
      expect(verboseExample).toContain('web:3001'); // Web port
      expect(verboseExample).toContain('12.5k→8.2k'); // Token breakdown
      expect(verboseExample).toContain('total: 20.7k'); // Total tokens
      expect(verboseExample).toContain('session: $1.25'); // Session cost
      expect(verboseExample).toContain('active: 3m42s'); // Active time
      expect(verboseExample).toContain('idle: 1m18s'); // Idle time
      expect(verboseExample).toContain('stage: 45s'); // Stage timer
      expect(verboseExample).toContain('🔍 VERBOSE'); // Mode indicator
    });

    it('should explain the benefits of responsive behavior', () => {
      expect(cliGuideContent).toContain('ensures critical information is always visible');
      expect(cliGuideContent).toContain('adapts to any terminal size');
      expect(cliGuideContent).toContain('priority-based element display');
      expect(cliGuideContent).toContain('intelligently adapts');

      // Should explain why this is useful
      const responsiveSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Responsive Behavior'),
        cliGuideContent.indexOf('### Color Coding Reference')
      );

      expect(responsiveSection).toContain('when space is limited');
      expect(responsiveSection).toContain('wide terminal');
      expect(responsiveSection).toContain('narrow terminal');
      expect(responsiveSection).toContain('automatically');
    });
  });

  describe('Mode-specific Behavior Documentation', () => {
    it('should document how modes override responsive behavior', () => {
      // Compact mode should override width-based decisions
      expect(cliGuideContent).toContain('Forces most aggressive space optimization');
      expect(cliGuideContent).toContain('regardless of terminal width');

      // Verbose mode should show everything
      expect(cliGuideContent).toContain('Shows maximum information regardless of terminal width');
      expect(cliGuideContent).toContain('All 21 possible elements when data is available');

      // Normal mode should be responsive
      expect(cliGuideContent).toContain('Responsive to terminal width');
      expect(cliGuideContent).toContain('Balances information density with readability');
    });

    it('should document mode activation commands', () => {
      const troubleshootingSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Troubleshooting'),
        cliGuideContent.indexOf('---')
      );

      expect(troubleshootingSection).toContain('/compact');
      expect(troubleshootingSection).toContain('/verbose');
      expect(troubleshootingSection).toContain('Switch to verbose mode');
      expect(troubleshootingSection).toContain('Use compact mode');
    });

    it('should explain when to use each mode', () => {
      // Compact mode use cases
      expect(cliGuideContent).toContain('reduces rendering complexity');
      expect(cliGuideContent).toContain('Minimal elements only');

      // Verbose mode use cases
      expect(cliGuideContent).toContain('Detailed timing breakdown');
      expect(cliGuideContent).toContain('Token input→output breakdown');
      expect(cliGuideContent).toContain('Session cost tracking');

      // Normal mode use cases
      expect(cliGuideContent).toContain('standard development information');
      expect(cliGuideContent).toContain('Balances information density');
    });
  });
});