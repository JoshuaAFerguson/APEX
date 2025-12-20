/**
 * StatusBar Documentation Validation Tests
 *
 * Validates that the StatusBar documentation enhancement meets all acceptance criteria:
 * - Complete StatusBar Reference section with all 21 display elements
 * - Visual examples and responsive behavior documentation
 * - Cross-references between documentation files
 * - Color coding and priority system documentation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('StatusBar Documentation Enhancement Validation', () => {
  let cliGuideContent: string;
  let v030FeaturesContent: string;
  let displayModesContent: string;

  beforeAll(() => {
    const cliGuidePath = path.join(__dirname, '../cli-guide.md');
    const v030FeaturesPath = path.join(__dirname, '../features/v030-features.md');
    const displayModesPath = path.join(__dirname, '../user-guide/display-modes.md');

    cliGuideContent = fs.readFileSync(cliGuidePath, 'utf-8');
    v030FeaturesContent = fs.readFileSync(v030FeaturesPath, 'utf-8');
    displayModesContent = fs.readFileSync(displayModesPath, 'utf-8');
  });

  describe('StatusBar Reference Section Existence and Structure', () => {
    it('should contain StatusBar Reference section in cli-guide.md', () => {
      expect(cliGuideContent).toContain('## StatusBar Reference');
      expect(cliGuideContent).toContain('The StatusBar component provides real-time session and task information');
      expect(cliGuideContent).toContain('sophisticated responsive design with priority-based element display');
    });

    it('should include table of contents entry', () => {
      expect(cliGuideContent).toContain('- [StatusBar Reference](#statusbar-reference)');
    });

    it('should include v0.3.0 new feature callout', () => {
      expect(cliGuideContent).toContain('✨ NEW in v0.3.0');
      expect(cliGuideContent).toContain('completely redesigned with responsive behavior');
      expect(cliGuideContent).toContain('priority-based element visibility');
      expect(cliGuideContent).toContain('mode-specific enhancements');
    });
  });

  describe('Visual Examples Documentation', () => {
    it('should include full StatusBar visual example', () => {
      expect(cliGuideContent).toContain('**Full StatusBar (Wide Terminal, Normal Mode):**');
      expect(cliGuideContent).toContain('┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
      expect(cliGuideContent).toContain('│ ● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5]');
      expect(cliGuideContent).toContain('tokens: 45.2k | cost: $0.1523 | model: sonnet | 05:23');
    });

    it('should include element annotations in visual example', () => {
      expect(cliGuideContent).toContain('↑   ↑       ↑             ↑                  ↑');
      expect(cliGuideContent).toContain('└─ Session Timer');
      expect(cliGuideContent).toContain('└─ Model Indicator');
      expect(cliGuideContent).toContain('└─ Cost Display');
      expect(cliGuideContent).toContain('└─ Token Count');
      expect(cliGuideContent).toContain('└─ Subtask Progress');
      expect(cliGuideContent).toContain('└─ Workflow Stage');
      expect(cliGuideContent).toContain('└─ Agent Indicator');
      expect(cliGuideContent).toContain('└─ Git Branch');
    });

    it('should include verbose mode visual example', () => {
      expect(cliGuideContent).toContain('**Verbose Mode (Additional Elements):**');
      expect(cliGuideContent).toContain('💾 my-session | api:3000 | web:3001');
      expect(cliGuideContent).toContain('tokens: 12.5k→8.2k | total: 20.7k');
      expect(cliGuideContent).toContain('session: $1.25 | model: sonnet');
      expect(cliGuideContent).toContain('active: 3m42s | idle: 1m18s | stage: 45s');
      expect(cliGuideContent).toContain('🔍 VERBOSE');
    });
  });

  describe('Display Elements Documentation', () => {
    it('should document all 21 display elements', () => {
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      // Critical priority elements
      expect(statusBarSection).toContain('**Connection Status**');
      expect(statusBarSection).toContain('**Git Branch**');
      expect(statusBarSection).toContain('**Agent Indicator**');
      expect(statusBarSection).toContain('**Workflow Stage**');

      // High priority elements
      expect(statusBarSection).toContain('**Subtask Progress**');
      expect(statusBarSection).toContain('**Token Count**');
      expect(statusBarSection).toContain('**Cost Display**');
      expect(statusBarSection).toContain('**Model Indicator**');
      expect(statusBarSection).toContain('**Session Timer**');

      // Medium priority elements
      expect(statusBarSection).toContain('**Total Token Count**');
      expect(statusBarSection).toContain('**Session Cost**');
      expect(statusBarSection).toContain('**Active Time**');

      // Low priority elements (verbose mode)
      expect(statusBarSection).toContain('**Session Name**');
      expect(statusBarSection).toContain('**API Port**');
      expect(statusBarSection).toContain('**Web UI Port**');
      expect(statusBarSection).toContain('**Token Breakdown**');
      expect(statusBarSection).toContain('**Idle Time**');
      expect(statusBarSection).toContain('**Stage Timer**');
      expect(statusBarSection).toContain('**Preview Mode**');
      expect(statusBarSection).toContain('**Thoughts Mode**');
      expect(statusBarSection).toContain('**Verbose Mode**');
    });

    it('should include priority system table', () => {
      expect(cliGuideContent).toContain('#### Priority System');
      expect(cliGuideContent).toContain('| Priority | Level | Description | Visibility |');
      expect(cliGuideContent).toContain('| **CRITICAL** | Always shown | Core functionality indicators | All widths, all modes |');
      expect(cliGuideContent).toContain('| **HIGH** | Essential | Important status information | Normal+ terminal widths |');
      expect(cliGuideContent).toContain('| **MEDIUM** | Standard | Detailed progress information | Wide terminal widths |');
      expect(cliGuideContent).toContain('| **LOW** | Extended | Additional context and debug info | Wide terminals, verbose mode |');
    });

    it('should document element specifications for each component', () => {
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      // Check format: Icon, Color, Description, Values, Priority, Visibility table
      expect(statusBarSection).toContain('**Icon:** ●/○');
      expect(statusBarSection).toContain('**Values:** Connected (●) / Disconnected (○)');
      expect(statusBarSection).toContain('**Priority:** CRITICAL');

      // Check that visibility tables are present
      const visibilityTableMatches = statusBarSection.match(/\*\*Visibility:\*\*[\s\S]*?\|.*?\|.*?\|.*?\|/g);
      expect(visibilityTableMatches).toBeTruthy();
      expect(visibilityTableMatches!.length).toBeGreaterThan(15); // Should have visibility tables for most elements
    });
  });

  describe('Responsive Behavior Documentation', () => {
    it('should document the 3-tier responsive system', () => {
      expect(cliGuideContent).toContain('### Responsive Behavior');
      expect(cliGuideContent).toContain('priority-based system');
      expect(cliGuideContent).toContain('| Terminal Width | Display Tier | Elements Shown |');
      expect(cliGuideContent).toContain('| < 60 columns | Narrow | CRITICAL + HIGH priority only, abbreviated labels |');
      expect(cliGuideContent).toContain('| 60-160 columns | Normal | CRITICAL + HIGH + MEDIUM priority, full labels |');
      expect(cliGuideContent).toContain('| > 160 columns | Wide | All priority levels, full labels + extended details |');
    });

    it('should document responsive features', () => {
      expect(cliGuideContent).toContain('**Responsive Features:**');
      expect(cliGuideContent).toContain('**Automatic abbreviation**');
      expect(cliGuideContent).toContain('**Progressive hiding**');
      expect(cliGuideContent).toContain('tokens:` → `tk:');
      expect(cliGuideContent).toContain('Lower priority elements disappear first');
    });

    it('should document display mode behaviors', () => {
      expect(cliGuideContent).toContain('#### Compact Mode');
      expect(cliGuideContent).toContain('#### Normal Mode');
      expect(cliGuideContent).toContain('#### Verbose Mode');

      expect(cliGuideContent).toContain('Shows maximum information regardless of terminal width');
      expect(cliGuideContent).toContain('All 21 possible elements when data is available');
      expect(cliGuideContent).toContain('Detailed timing breakdown');
      expect(cliGuideContent).toContain('Token input→output breakdown');
    });
  });

  describe('Color Coding Documentation', () => {
    it('should include comprehensive color coding reference', () => {
      expect(cliGuideContent).toContain('### Color Coding Reference');
      expect(cliGuideContent).toContain('| Color | Usage | Examples |');

      const colorCodingSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Color Coding Reference'),
        cliGuideContent.indexOf('### Troubleshooting')
      );

      expect(colorCodingSection).toContain('| **Green** | Success, connected, active processing');
      expect(colorCodingSection).toContain('| **Red** | Error, disconnected, failed');
      expect(colorCodingSection).toContain('| **Yellow** | Warning, in-progress, totals');
      expect(colorCodingSection).toContain('| **Blue** | Information, models, stage indicators');
      expect(colorCodingSection).toContain('| **Cyan** | Progress, data, mode indicators');
      expect(colorCodingSection).toContain('| **Magenta** | Agents, special features');
      expect(colorCodingSection).toContain('| **Gray** | Labels, secondary info, timers');
    });

    it('should provide color usage examples', () => {
      const colorCodingSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Color Coding Reference'),
        cliGuideContent.indexOf('### Troubleshooting')
      );

      expect(colorCodingSection).toContain('Connection (●), cost amounts, active time');
      expect(colorCodingSection).toContain('Connection (○) when disconnected');
      expect(colorCodingSection).toContain('Branch names, incomplete progress, session costs');
      expect(colorCodingSection).toContain('Workflow stage (▶), model names, totals');
      expect(colorCodingSection).toContain('Token counts, session names, mode indicators');
      expect(colorCodingSection).toContain('Agent indicator (⚡), thoughts display');
      expect(colorCodingSection).toContain('All labels, session timer, secondary text');
    });
  });

  describe('Troubleshooting Section', () => {
    it('should include troubleshooting section with common issues', () => {
      expect(cliGuideContent).toContain('### Troubleshooting');
      expect(cliGuideContent).toContain('#### Missing Elements');
      expect(cliGuideContent).toContain('#### Abbreviations');
      expect(cliGuideContent).toContain('#### Performance');
    });

    it('should provide solutions for missing elements', () => {
      const troubleshootingSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Troubleshooting'),
        cliGuideContent.indexOf('---')
      );

      expect(troubleshootingSection).toContain('**Check display mode**');
      expect(troubleshootingSection).toContain('**Check terminal width**');
      expect(troubleshootingSection).toContain('**Check data availability**');
      expect(troubleshootingSection).toContain('Compact mode hides non-essential elements');
      expect(troubleshootingSection).toContain('Narrow terminals hide lower-priority elements');
      expect(troubleshootingSection).toContain('Elements only show when data exists');
    });

    it('should provide solutions for abbreviations and performance', () => {
      const troubleshootingSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Troubleshooting'),
        cliGuideContent.indexOf('---')
      );

      expect(troubleshootingSection).toContain('**Widen terminal**');
      expect(troubleshootingSection).toContain('**Switch to verbose mode**');
      expect(troubleshootingSection).toContain('**Reference this guide**');
      expect(troubleshootingSection).toContain('**Check terminal performance**');
      expect(troubleshootingSection).toContain('**Use compact mode**');
      expect(troubleshootingSection).toContain('**Check session complexity**');
    });
  });

  describe('Cross-references in v030-features.md', () => {
    it('should update StatusBar section in v030-features.md', () => {
      expect(v030FeaturesContent).toContain('#### StatusBar Component');
      expect(v030FeaturesContent).toContain('intelligent responsive design with priority-based element visibility');
      expect(v030FeaturesContent).toContain('adapts to terminal width and display modes');
    });

    it('should include reference to comprehensive documentation', () => {
      expect(v030FeaturesContent).toContain('📋 Complete Documentation');
      expect(v030FeaturesContent).toContain('See the comprehensive [StatusBar Reference](../cli-guide.md#statusbar-reference)');
      expect(v030FeaturesContent).toContain('detailed information about all 21 display elements');
      expect(v030FeaturesContent).toContain('visual examples, responsive behavior, and mode variations');
    });

    it('should include visual example in v030-features.md', () => {
      expect(v030FeaturesContent).toContain('**Visual Example (Normal Mode, Wide Terminal):**');
      expect(v030FeaturesContent).toContain('┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
      expect(v030FeaturesContent).toContain('│ ● ⎇ main | ⚡developer | ▶implementation | 📋 [2/5]');
    });

    it('should describe verbose mode additions', () => {
      expect(v030FeaturesContent).toContain('**Verbose Mode Additions:**');
      expect(v030FeaturesContent).toContain('**Detailed Timing**');
      expect(v030FeaturesContent).toContain('**Token Breakdown**');
      expect(v030FeaturesContent).toContain('**Session Costs**');
      expect(v030FeaturesContent).toContain('**Server URLs**');
      expect(v030FeaturesContent).toContain('**Mode Indicators**');
    });

    it('should include responsive adaptation table', () => {
      expect(v030FeaturesContent).toContain('#### Responsive Adaptation');
      expect(v030FeaturesContent).toContain('sophisticated 3-tier responsive system');
      expect(v030FeaturesContent).toContain('| Terminal Width | Display Tier | Elements Shown | Behavior |');
      expect(v030FeaturesContent).toContain('| < 60 columns | Narrow | CRITICAL + HIGH priority | Abbreviated labels, compressed values |');
    });

    it('should document smart abbreviations', () => {
      expect(v030FeaturesContent).toContain('**Smart Abbreviations:**');
      expect(v030FeaturesContent).toContain('Labels automatically shorten in narrow terminals');
      expect(v030FeaturesContent).toContain('`tokens:` becomes `tk:`');
      expect(v030FeaturesContent).toContain('`model:` becomes `mod:`');
    });
  });

  describe('Cross-references in display-modes.md', () => {
    it('should include reference to comprehensive StatusBar documentation', () => {
      expect(displayModesContent).toContain('📖 For Complete Element Documentation');
      expect(displayModesContent).toContain('See the comprehensive [StatusBar Reference](../cli-guide.md#statusbar-reference)');
      expect(displayModesContent).toContain('detailed information about all 21 display elements');
      expect(displayModesContent).toContain('visual examples, color coding, and responsive behavior');
    });

    it('should maintain existing StatusBar behavior table', () => {
      const statusBarSection = displayModesContent.substring(
        displayModesContent.indexOf('### StatusBar'),
        displayModesContent.indexOf('### Progress')
      );

      expect(statusBarSection).toContain('| Component | Normal | Compact | Verbose |');
      expect(statusBarSection).toContain('| Connection Status | ● | ● | ● |');
      expect(statusBarSection).toContain('| Git Branch | ✓ | ✓ | ✓ |');
      expect(statusBarSection).toContain('| Agent | ✓ | ✗ | ✓ |');
      expect(statusBarSection).toContain('| Workflow Stage | ✓ | ✗ | ✓ |');
    });
  });

  describe('Content Quality and Completeness', () => {
    it('should have substantial StatusBar Reference content', () => {
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('## StatusBar Reference'),
        cliGuideContent.indexOf('## Keyboard Shortcuts')
      );

      // Should have extensive content (at least 5000 characters for comprehensive documentation)
      expect(statusBarSection.length).toBeGreaterThan(5000);

      // Should have multiple subsections
      const subsectionCount = (statusBarSection.match(/^### /gm) || []).length;
      expect(subsectionCount).toBeGreaterThan(5);
    });

    it('should include all required visual elements', () => {
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('## StatusBar Reference'),
        cliGuideContent.indexOf('## Keyboard Shortcuts')
      );

      // ASCII art boxes for visual examples
      const boxDrawingChars = (statusBarSection.match(/[┌┐└┘├┤│─]/g) || []).length;
      expect(boxDrawingChars).toBeGreaterThan(50);

      // Tables for documentation
      const tableHeaders = (statusBarSection.match(/\|.*\|.*\|/g) || []).length;
      expect(tableHeaders).toBeGreaterThan(20);

      // Icons and symbols for element documentation
      expect(statusBarSection).toContain('●');
      expect(statusBarSection).toContain('⚡');
      expect(statusBarSection).toContain('▶');
      expect(statusBarSection).toContain('📋');
      expect(statusBarSection).toContain('⎇');
    });

    it('should maintain consistent formatting across all documentation', () => {
      const allFiles = [cliGuideContent, v030FeaturesContent, displayModesContent];

      allFiles.forEach(content => {
        // Check that StatusBar references use consistent formatting
        if (content.includes('StatusBar')) {
          // Should use consistent terminology
          expect(content).toMatch(/StatusBar|statusbar-reference/);

          // Should use consistent link format if linking to reference
          if (content.includes('StatusBar Reference')) {
            expect(content).toMatch(/\[StatusBar Reference\]\([^)]+statusbar-reference\)/);
          }
        }
      });
    });
  });

  describe('Technical Accuracy and Implementation Details', () => {
    it('should accurately describe technical implementation', () => {
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('## StatusBar Reference'),
        cliGuideContent.indexOf('## Keyboard Shortcuts')
      );

      expect(statusBarSection).toContain('priority-based element display');
      expect(statusBarSection).toContain('adapts to your terminal width');
      expect(statusBarSection).toContain('selected display mode');
      expect(statusBarSection).toContain('intelligently adapts');
      expect(statusBarSection).toContain('critical information is always visible');
    });

    it('should provide accurate terminal width breakpoints', () => {
      const allFiles = [cliGuideContent, v030FeaturesContent];

      allFiles.forEach(content => {
        if (content.includes('Terminal Width') && content.includes('Display Tier')) {
          expect(content).toContain('< 60 columns');
          expect(content).toContain('60-160 columns');
          expect(content).toContain('> 160 columns');
          expect(content).toContain('Narrow');
          expect(content).toContain('Normal');
          expect(content).toContain('Wide');
        }
      });
    });

    it('should accurately describe element counts and features', () => {
      // Should consistently reference 21 display elements
      expect(cliGuideContent).toContain('up to 21 different elements');
      expect(cliGuideContent).toContain('All 21 possible elements when data is available');
      expect(v030FeaturesContent).toContain('all 21 display elements');
      expect(displayModesContent).toContain('all 21 display elements');
    });
  });

  describe('User Experience and Usability', () => {
    it('should provide clear navigation and orientation', () => {
      // Table of contents should include StatusBar Reference
      expect(cliGuideContent).toContain('- [StatusBar Reference](#statusbar-reference)');

      // Should have clear section breaks
      expect(cliGuideContent).toContain('---');

      // Should have clear subsection structure
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('## StatusBar Reference'),
        cliGuideContent.indexOf('## Keyboard Shortcuts')
      );

      expect(statusBarSection).toContain('### Visual Example');
      expect(statusBarSection).toContain('### Display Elements');
      expect(statusBarSection).toContain('### Responsive Behavior');
      expect(statusBarSection).toContain('### Color Coding Reference');
      expect(statusBarSection).toContain('### Troubleshooting');
    });

    it('should provide actionable information for users', () => {
      const statusBarSection = cliGuideContent.substring(
        cliGuideContent.indexOf('## StatusBar Reference'),
        cliGuideContent.indexOf('## Keyboard Shortcuts')
      );

      // Should provide commands users can run
      expect(statusBarSection).toContain('/compact');
      expect(statusBarSection).toContain('/verbose');

      // Should explain what to expect in different scenarios
      expect(statusBarSection).toContain('when space is limited');
      expect(statusBarSection).toContain('when data is available');
      expect(statusBarSection).toContain('without an active task');
    });
  });
});