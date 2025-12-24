/**
 * StatusBar Visual Examples and Color Coding Tests
 *
 * Validates that the StatusBar visual examples and color coding documentation
 * are accurate, comprehensive, and provide clear guidance to users.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('StatusBar Visual Examples and Color Coding', () => {
  let cliGuideContent: string;
  let v030FeaturesContent: string;

  beforeAll(() => {
    const cliGuidePath = path.join(__dirname, '../cli-guide.md');
    const v030FeaturesPath = path.join(__dirname, '../features/v030-features.md');

    cliGuideContent = fs.readFileSync(cliGuidePath, 'utf-8');
    v030FeaturesContent = fs.readFileSync(v030FeaturesPath, 'utf-8');
  });

  describe('Visual Example Structure and Quality', () => {
    it('should include comprehensive visual examples', () => {
      expect(cliGuideContent).toContain('### Visual Example');
      expect(cliGuideContent).toContain('**Full StatusBar (Wide Terminal, Normal Mode):**');
      expect(cliGuideContent).toContain('**Verbose Mode (Additional Elements):**');
    });

    it('should use proper ASCII box drawing for visual examples', () => {
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Visual Example'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Should have proper box drawing characters
      const boxTopRegex = /┌─{10,}┐/;
      const boxBottomRegex = /└─{10,}┘/;
      const boxSideRegex = /│.*│/;

      expect(visualSection).toMatch(boxTopRegex);
      expect(visualSection).toMatch(boxBottomRegex);
      expect(visualSection).toMatch(boxSideRegex);

      // Should have realistic box width (representing terminal width)
      const boxes = visualSection.match(/┌─+┐/g);
      expect(boxes).toBeTruthy();
      boxes!.forEach(box => {
        expect(box.length).toBeGreaterThan(50); // Realistic terminal width
        expect(box.length).toBeLessThan(200); // Not unreasonably wide
      });
    });

    it('should show realistic and consistent data in examples', () => {
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Visual Example'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Connection status
      expect(visualSection).toContain('●'); // Connected

      // Git branch
      expect(visualSection).toContain('⎇ main');

      // Agent indicator
      expect(visualSection).toContain('⚡developer');

      // Workflow stage
      expect(visualSection).toContain('▶implementation');

      // Subtask progress
      expect(visualSection).toContain('📋 [2/5]');

      // Token count
      expect(visualSection).toMatch(/tokens: \d+\.\d+k/);

      // Cost display
      expect(visualSection).toMatch(/cost: \$\d+\.\d+/);

      // Model indicator
      expect(visualSection).toContain('model: sonnet');

      // Session timer
      expect(visualSection).toMatch(/\d{2}:\d{2}/);
    });

    it('should include element annotations in visual examples', () => {
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('**Full StatusBar'),
        cliGuideContent.indexOf('**Verbose Mode')
      );

      // Should have annotation arrows
      expect(visualSection).toContain('↑');

      // Should have labeled annotations
      const annotations = [
        '└─ Session Timer',
        '└─ Model Indicator',
        '└─ Cost Display',
        '└─ Token Count',
        '└─ Subtask Progress',
        '└─ Workflow Stage',
        '└─ Agent Indicator',
        '└─ Git Branch'
      ];

      annotations.forEach(annotation => {
        expect(visualSection).toContain(annotation);
      });

      // Should maintain visual alignment
      const annotationLines = visualSection.split('\n').filter(line => line.includes('↑') || line.includes('└─'));
      expect(annotationLines.length).toBeGreaterThan(8);
    });

    it('should show verbose mode with extended information', () => {
      const verboseSection = cliGuideContent.substring(
        cliGuideContent.indexOf('**Verbose Mode'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Extended elements only in verbose mode
      expect(verboseSection).toContain('💾 my-session'); // Session name
      expect(verboseSection).toContain('api:3000'); // API port
      expect(verboseSection).toContain('web:3001'); // Web UI port
      expect(verboseSection).toContain('12.5k→8.2k'); // Token breakdown
      expect(verboseSection).toContain('total: 20.7k'); // Total tokens
      expect(verboseSection).toContain('session: $1.25'); // Session cost
      expect(verboseSection).toContain('active: 3m42s'); // Active time
      expect(verboseSection).toContain('idle: 1m18s'); // Idle time
      expect(verboseSection).toContain('stage: 45s'); // Stage timer
      expect(verboseSection).toContain('🔍 VERBOSE'); // Mode indicator
    });
  });

  describe('Color Coding Reference Documentation', () => {
    it('should include comprehensive color coding reference', () => {
      expect(cliGuideContent).toContain('### Color Coding Reference');
      expect(cliGuideContent).toContain('The StatusBar uses consistent color coding across all elements');
      expect(cliGuideContent).toContain('| Color | Usage | Examples |');
    });

    it('should document all color categories with usage patterns', () => {
      const colorSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Color Coding Reference'),
        cliGuideContent.indexOf('### Troubleshooting')
      );

      const colorMappings = [
        {
          color: '**Green**',
          usage: 'Success, connected, active processing',
          examples: 'Connection (●), cost amounts, active time'
        },
        {
          color: '**Red**',
          usage: 'Error, disconnected, failed',
          examples: 'Connection (○) when disconnected'
        },
        {
          color: '**Yellow**',
          usage: 'Warning, in-progress, totals',
          examples: 'Branch names, incomplete progress, session costs'
        },
        {
          color: '**Blue**',
          usage: 'Information, models, stage indicators',
          examples: 'Workflow stage (▶), model names, totals'
        },
        {
          color: '**Cyan**',
          usage: 'Progress, data, mode indicators',
          examples: 'Token counts, session names, mode indicators'
        },
        {
          color: '**Magenta**',
          usage: 'Agents, special features',
          examples: 'Agent indicator (⚡), thoughts display'
        },
        {
          color: '**Gray**',
          usage: 'Labels, secondary info, timers',
          examples: 'All labels, session timer, secondary text'
        }
      ];

      colorMappings.forEach(({ color, usage, examples }) => {
        expect(colorSection).toContain(color);
        expect(colorSection).toContain(usage);
        expect(colorSection).toContain(examples);
      });
    });

    it('should provide specific icon and color examples', () => {
      const colorSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Color Coding Reference'),
        cliGuideContent.indexOf('### Troubleshooting')
      );

      // Should mention specific icons with their colors
      expect(colorSection).toContain('Connection (●)'); // Green when connected
      expect(colorSection).toContain('Connection (○)'); // Red when disconnected
      expect(colorSection).toContain('Workflow stage (▶)'); // Blue
      expect(colorSection).toContain('Agent indicator (⚡)'); // Magenta
    });

    it('should explain color coding consistency', () => {
      const colorSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Color Coding Reference'),
        cliGuideContent.indexOf('### Troubleshooting')
      );

      expect(colorSection).toContain('consistent color coding across all elements');
      expect(colorSection).toContain('All labels'); // Consistent labeling
      expect(colorSection).toContain('secondary info'); // Consistent secondary information
    });
  });

  describe('Icon and Symbol Documentation', () => {
    it('should document all icons used in the StatusBar', () => {
      const displayElementsSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      const iconMappings = [
        { element: 'Connection Status', icon: '●/○' },
        { element: 'Git Branch', icon: '⎇' },
        { element: 'Agent Indicator', icon: '⚡' },
        { element: 'Workflow Stage', icon: '▶' },
        { element: 'Subtask Progress', icon: '📋' },
        { element: 'Session Name', icon: '💾' },
        { element: 'Verbose Mode', icon: '🔍' }
      ];

      iconMappings.forEach(({ element, icon }) => {
        const elementSection = displayElementsSection.substring(
          displayElementsSection.indexOf(`**${element}**`),
          displayElementsSection.indexOf('**', displayElementsSection.indexOf(`**${element}**`) + element.length + 4)
        );
        expect(elementSection).toContain(`**Icon:** ${icon}`);
      });
    });

    it('should explain icon meanings and usage', () => {
      const displayElementsSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      // Connection status explanation
      expect(displayElementsSection).toContain('Connected (●) / Disconnected (○)');

      // Agent indicator explanation
      expect(displayElementsSection).toContain('Shows current active agent');

      // Workflow stage explanation
      expect(displayElementsSection).toContain('Current workflow stage name');

      // Progress explanation
      expect(displayElementsSection).toContain('Current subtask index and total count');
    });

    it('should provide icon usage examples in context', () => {
      // Icons should appear in visual examples
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Visual Example'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Icons should be used consistently in examples
      expect(visualSection).toContain('● ⎇'); // Connection + branch
      expect(visualSection).toContain('⚡developer'); // Agent
      expect(visualSection).toContain('▶implementation'); // Stage
      expect(visualSection).toContain('📋 [2/5]'); // Progress
      expect(visualSection).toContain('💾 my-session'); // Session name (verbose)
      expect(visualSection).toContain('🔍 VERBOSE'); // Mode indicator
    });
  });

  describe('Visual Example Consistency Across Files', () => {
    it('should maintain consistent visual examples in v030-features.md', () => {
      expect(v030FeaturesContent).toContain('**Visual Example (Normal Mode, Wide Terminal):**');

      const v030VisualSection = v030FeaturesContent.substring(
        v030FeaturesContent.indexOf('**Visual Example'),
        v030FeaturesContent.indexOf('**Verbose Mode Additions')
      );

      // Should use same box drawing and content structure
      expect(v030VisualSection).toMatch(/┌─+┐/);
      expect(v030VisualSection).toMatch(/│.*●.*⎇.*main.*⚡developer.*▶implementation.*📋.*\[2\/5\].*│/);
      expect(v030VisualSection).toMatch(/└─+┘/);
    });

    it('should provide complementary information in different files', () => {
      // cli-guide.md should have detailed reference
      expect(cliGuideContent).toContain('comprehensive StatusBar documentation');

      // v030-features.md should have feature overview
      expect(v030FeaturesContent).toContain('📋 Complete Documentation');
      expect(v030FeaturesContent).toContain('See the comprehensive [StatusBar Reference]');

      // Should reference each other appropriately
      expect(v030FeaturesContent).toContain('detailed information about all 21 display elements');
    });

    it('should show appropriate level of detail in each file', () => {
      // cli-guide.md should have full documentation
      const cliStatusBarLength = cliGuideContent.substring(
        cliGuideContent.indexOf('## StatusBar Reference'),
        cliGuideContent.indexOf('## Keyboard Shortcuts')
      ).length;

      // v030-features.md should have overview
      const v030StatusBarLength = v030FeaturesContent.substring(
        v030FeaturesContent.indexOf('#### StatusBar Component'),
        v030FeaturesContent.indexOf('#### Responsive Adaptation')
      ).length;

      // CLI guide should be much more comprehensive
      expect(cliStatusBarLength).toBeGreaterThan(v030StatusBarLength * 3);
    });
  });

  describe('Visual Accessibility and Readability', () => {
    it('should use readable ASCII art with proper spacing', () => {
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Visual Example'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Should have proper spacing around elements
      const contentLine = visualSection.match(/│ ● .* │/)?.[0];
      expect(contentLine).toBeTruthy();

      // Should have spaces between elements
      expect(contentLine).toContain(' | '); // Separators between sections
      expect(contentLine).toContain(' ●'); // Space before connection
      expect(contentLine).toContain('│ ●'); // Space after box border
      expect(contentLine).toContain('23 │'); // Space before box border
    });

    it('should maintain consistent box width across examples', () => {
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Visual Example'),
        cliGuideContent.indexOf('### Display Elements')
      );

      const topBorders = visualSection.match(/┌─+┐/g);
      const bottomBorders = visualSection.match(/└─+┘/g);

      expect(topBorders).toBeTruthy();
      expect(bottomBorders).toBeTruthy();
      expect(topBorders!.length).toBe(bottomBorders!.length);

      // All boxes in the same example should be the same width
      topBorders!.forEach((topBorder, index) => {
        expect(topBorder.length).toBe(bottomBorders![index].length);
      });
    });

    it('should use appropriate Unicode characters consistently', () => {
      const visualSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Visual Example'),
        cliGuideContent.indexOf('### Display Elements')
      );

      // Should use box drawing characters consistently
      const boxChars = visualSection.match(/[┌┐└┘├┤│─]/g);
      expect(boxChars).toBeTruthy();
      expect(boxChars!.length).toBeGreaterThan(20);

      // Should use appropriate symbols
      expect(visualSection).toContain('●'); // Solid circle for connected
      expect(visualSection).toContain('⎇'); // Git branch symbol
      expect(visualSection).toContain('⚡'); // Lightning for agent
      expect(visualSection).toContain('▶'); // Play symbol for stage
      expect(visualSection).toContain('📋'); // Clipboard for progress
    });
  });

  describe('Documentation of Element Values and Formats', () => {
    it('should document realistic value formats', () => {
      const displayElementsSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      // Token counts should show realistic formatting
      expect(displayElementsSection).toMatch(/\d+\.\d+k/); // e.g., "45.2k"

      // Costs should show currency formatting
      expect(displayElementsSection).toMatch(/\$\d+\.\d+/); // e.g., "$0.1523"

      // Times should show proper formatting
      expect(displayElementsSection).toMatch(/\d{1,2}:\d{2}/); // e.g., "05:23"
      expect(displayElementsSection).toMatch(/\d+[ms]/); // e.g., "3m42s"

      // Progress should show fraction format
      expect(displayElementsSection).toMatch(/\[\d+\/\d+\]/); // e.g., "[2/5]"
    });

    it('should explain value interpretation', () => {
      const displayElementsSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      // Should explain what different values mean
      expect(displayElementsSection).toContain('Connected'); // Connection status meaning
      expect(displayElementsSection).toContain('current active agent'); // Agent meaning
      expect(displayElementsSection).toContain('workflow stage name'); // Stage meaning
      expect(displayElementsSection).toContain('subtask index'); // Progress meaning
      expect(displayElementsSection).toContain('session duration'); // Timer meaning
    });

    it('should document dynamic vs static values', () => {
      const displayElementsSection = cliGuideContent.substring(
        cliGuideContent.indexOf('### Display Elements'),
        cliGuideContent.indexOf('### Responsive Behavior')
      );

      // Some elements are dynamic
      expect(displayElementsSection).toContain('Updates every second'); // Timer
      expect(displayElementsSection).toContain('real-time'); // Various elements

      // Some elements are more static
      expect(displayElementsSection).toContain('Current git branch'); // Branch
      expect(displayElementsSection).toContain('Model name'); // Model
    });
  });

  describe('Cross-file Visual Consistency', () => {
    it('should use same visual style across all documentation files', () => {
      const allContents = [cliGuideContent, v030FeaturesContent];

      allContents.forEach(content => {
        if (content.includes('StatusBar') && content.includes('┌')) {
          // Should use consistent box drawing style
          expect(content).toMatch(/┌─+┐/);
          expect(content).toMatch(/│.*│/);
          expect(content).toMatch(/└─+┘/);

          // Should use consistent icons
          if (content.includes('● ⎇')) {
            expect(content).toContain('⚡');
            expect(content).toContain('▶');
            expect(content).toContain('📋');
          }
        }
      });
    });

    it('should maintain consistent data values across examples', () => {
      // Both files should use similar realistic example data
      if (cliGuideContent.includes('45.2k') && v030FeaturesContent.includes('45.2k')) {
        expect(cliGuideContent).toContain('$0.1523');
        expect(v030FeaturesContent).toContain('$0.1523');
      }

      if (cliGuideContent.includes('main') && v030FeaturesContent.includes('main')) {
        expect(cliGuideContent).toContain('developer');
        expect(v030FeaturesContent).toContain('developer');
      }
    });

    it('should provide appropriate cross-references', () => {
      // v030-features should reference cli-guide for details
      expect(v030FeaturesContent).toContain('[StatusBar Reference](../cli-guide.md#statusbar-reference)');

      // Should mention the comprehensiveness
      expect(v030FeaturesContent).toContain('📋 Complete Documentation');
      expect(v030FeaturesContent).toContain('all 21 display elements');
      expect(v030FeaturesContent).toContain('visual examples, responsive behavior, and mode variations');
    });
  });
});