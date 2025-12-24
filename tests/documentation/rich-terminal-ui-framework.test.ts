/**
 * Rich Terminal UI Framework Documentation Tests
 *
 * Validates that the Rich Terminal UI Framework section in getting-started.md
 * properly documents all 8 UI framework features with descriptions and examples
 * as specified in ADR-049.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Rich Terminal UI Framework Documentation', () => {
  let content: string;

  beforeAll(() => {
    const docPath = path.join(__dirname, '../getting-started.md');
    content = fs.readFileSync(docPath, 'utf-8');
  });

  describe('Rich Terminal UI Framework Section Existence', () => {
    it('should contain Rich Terminal UI Framework section', () => {
      expect(content).toContain('## Rich Terminal UI Framework');
      expect(content).toContain("APEX's terminal interface is built on a modern React-based framework");
      expect(content).toContain('8 core UI capabilities');
      expect(content).toContain('interactive CLI');
    });

    it('should include framework introduction and overview', () => {
      expect(content).toContain('designed for exceptional developer experience');
      expect(content).toContain('This section covers the 8 core UI capabilities');
      expect(content).toContain('that power the interactive CLI');
    });
  });

  describe('Feature 1: Ink-based Rendering', () => {
    it('should document Ink-based rendering with React patterns', () => {
      expect(content).toContain('### Ink-based Rendering');
      expect(content).toContain('APEX uses Ink, a React renderer for CLI applications');
      expect(content).toContain('component-based terminal interfaces');
      expect(content).toContain('familiar React patterns');
    });

    it('should include component tree visualization', () => {
      expect(content).toContain('Components render as a tree, just like React DOM');
      expect(content).toContain('┌─ App ─────────────────────────────────┐');
      expect(content).toContain('├─ Banner');
      expect(content).toContain('├─ StatusBar');
      expect(content).toContain('├─ TaskProgress');
      expect(content).toContain('├─ AgentPanel');
      expect(content).toContain('└─ InputPrompt');
      expect(content).toContain('└───────────────────────────────────────┘');
    });

    it('should describe architectural benefits', () => {
      expect(content).toContain('component architecture enables maintainable');
      expect(content).toContain('testable terminal interfaces');
      expect(content).toContain('proper state management');
      expect(content).toContain('event handling');
    });
  });

  describe('Feature 2: Streaming & Real-time Updates', () => {
    it('should document streaming and real-time updates', () => {
      expect(content).toContain('### Streaming & Real-time Updates');
      expect(content).toContain('Experience live updates as agents work');
      expect(content).toContain('character-by-character streaming');
      expect(content).toContain('animated cursors');
    });

    it('should include streaming output example', () => {
      expect(content).toContain('Streaming output with live cursor:');
      expect(content).toContain('┌──────────────────────────────────────┐');
      expect(content).toContain('│ The agent is analyzing your code...▊ │');
      expect(content).toContain('└──────────────────────────────────────┘');
    });

    it('should describe user experience benefits', () => {
      expect(content).toContain('Text appears dynamically with typewriter effects');
      expect(content).toContain('creating an engaging real-time development experience');
      expect(content).toContain('shows exactly what agents are thinking and doing');
    });
  });

  describe('Feature 3: Markdown Rendering', () => {
    it('should document markdown rendering capabilities', () => {
      expect(content).toContain('### Markdown Rendering');
      expect(content).toContain('Rich markdown content renders with full formatting support');
      expect(content).toContain('making documentation and responses easy to read');
    });

    it('should include markdown formatting examples', () => {
      expect(content).toContain('Markdown renders with full formatting:');
      expect(content).toContain('# Header 1                    (cyan, bold)');
      expect(content).toContain('## Header 2                   (blue, bold)');
      expect(content).toContain('• Bullet points              (yellow bullets)');
      expect(content).toContain('1. Numbered lists            (yellow numbers)');
      expect(content).toContain('> Blockquotes               (gray with │ prefix)');
      expect(content).toContain('`inline code`               (highlighted background)');
    });

    it('should describe formatting capabilities', () => {
      expect(content).toContain('Headers, lists, blockquotes, and inline code');
      expect(content).toContain('all render with appropriate colors and formatting');
      expect(content).toContain('for maximum readability');
    });
  });

  describe('Feature 4: Syntax Highlighting', () => {
    it('should document syntax highlighting feature', () => {
      expect(content).toContain('### Syntax Highlighting');
      expect(content).toContain('Code blocks receive full syntax highlighting');
      expect(content).toContain('for supported languages');
      expect(content).toContain('TypeScript, JavaScript, Python, Rust, Go');
    });

    it('should include code block example', () => {
      expect(content).toContain('┌─ typescript ────────── 5 lines ──┐');
      expect(content).toContain('│  1 │ const greeting = "Hello";   │');
      expect(content).toContain('│  2 │ function sayHello() {       │');
      expect(content).toContain('│  3 │   // This is a comment      │');
      expect(content).toContain('│  4 │   console.log(greeting);    │');
      expect(content).toContain('│  5 │ }                           │');
      expect(content).toContain('└──────────────────────────────────┘');
    });

    it('should describe syntax highlighting features', () => {
      expect(content).toContain('Keywords, strings, and comments are color-coded');
      expect(content).toContain('with line numbers');
      expect(content).toContain('Code automatically wraps for narrow terminals');
      expect(content).toContain('while preserving readability');
    });
  });

  describe('Feature 5: Diff Views', () => {
    it('should document diff view capabilities', () => {
      expect(content).toContain('### Diff Views');
      expect(content).toContain('View code changes with comprehensive diff rendering');
      expect(content).toContain('supporting three display modes');
    });

    it('should include unified diff example', () => {
      expect(content).toContain('Unified diff view:');
      expect(content).toContain('--- src/api.ts');
      expect(content).toContain('+++ src/api.ts');
      expect(content).toContain('@@ -1,3 +1,4 @@');
      expect(content).toContain("  import express from 'express';");
      expect(content).toContain("+  import cors from 'cors';        ← added (green)");
      expect(content).toContain('  const app = express();');
      expect(content).toContain('-  app.listen(3000);               ← removed (red)');
      expect(content).toContain('+  app.listen(process.env.PORT);   ← added (green)');
    });

    it('should describe diff view features', () => {
      expect(content).toContain('Unified, split, and inline modes');
      expect(content).toContain('automatically adapt to your terminal width');
      expect(content).toContain('Line numbers, hunk headers');
      expect(content).toContain('color-coded additions/deletions');
      expect(content).toContain('make code changes clear');
    });
  });

  describe('Feature 6: Responsive Layouts', () => {
    it('should document responsive layout system', () => {
      expect(content).toContain('### Responsive Layouts');
      expect(content).toContain('The interface adapts to any terminal size');
      expect(content).toContain('using a 4-tier breakpoint system');
    });

    it('should include breakpoint system table', () => {
      expect(content).toContain('Breakpoint System:');
      expect(content).toContain('┌────────────────────────────────────────────────────────────┐');
      expect(content).toContain('│  Narrow   │  Compact  │   Normal   │        Wide          │');
      expect(content).toContain('│  < 60     │  60-99    │  100-159   │       160+           │');
      expect(content).toContain('│  cols     │  cols     │   cols     │       cols           │');
      expect(content).toContain('├───────────┼───────────┼────────────┼──────────────────────┤');
      expect(content).toContain('│ Minimal   │ Condensed │ Standard   │ Full with extras     │');
      expect(content).toContain('│ UI only   │ display   │ display    │ split diffs, etc.    │');
      expect(content).toContain('└────────────────────────────────────────────────────────────┘');
    });

    it('should describe responsive behavior', () => {
      expect(content).toContain('Components automatically adjust their layout');
      expect(content).toContain('information density, and visual elements');
      expect(content).toContain('based on available space');
      expect(content).toContain('using the `useStdoutDimensions` hook');
    });
  });

  describe('Feature 7: Theme Support', () => {
    it('should document theme support system', () => {
      expect(content).toContain('### Theme Support');
      expect(content).toContain('Comprehensive theming supports both dark and light modes');
      expect(content).toContain('with agent-specific color schemes');
    });

    it('should include agent color scheme example', () => {
      expect(content).toContain('Agent Colors (Dark Theme):');
      expect(content).toContain('🟡 planner    - Yellow');
      expect(content).toContain('🔵 architect  - Blue');
      expect(content).toContain('🟢 developer  - Green');
      expect(content).toContain('🟣 reviewer   - Magenta');
      expect(content).toContain('🔵 tester     - Cyan');
      expect(content).toContain('🔴 devops     - Red');
    });

    it('should describe theme system features', () => {
      expect(content).toContain('The ThemeProvider manages consistent colors');
      expect(content).toContain('across all UI components');
      expect(content).toContain('syntax highlighting, and diff views');
      expect(content).toContain('with automatic adaptation for different terminal capabilities');
    });
  });

  describe('Feature 8: Progress Indicators', () => {
    it('should document progress indicator types', () => {
      expect(content).toContain('### Progress Indicators');
      expect(content).toContain('Multiple progress indicator types');
      expect(content).toContain('provide clear feedback on task execution');
    });

    it('should include progress indicator examples', () => {
      expect(content).toContain('Progress indicators:');
      expect(content).toContain('[■■■■■■■░░░] 70%            ← Progress bar');
      expect(content).toContain('◐ Loading...                 ← Spinner');
      expect(content).toContain('Step 2 of 4: implementation  ← Step progress');
    });

    it('should describe progress indicator features', () => {
      expect(content).toContain('Progress bars show completion percentages');
      expect(content).toContain('spinners indicate background activity');
      expect(content).toContain('step indicators track workflow stage progress');
      expect(content).toContain('Multi-task views coordinate progress across parallel operations');
    });
  });

  describe('Section Completeness and Structure', () => {
    it('should contain all 8 features as separate subsections', () => {
      const inkSection = content.includes('### Ink-based Rendering');
      const streamingSection = content.includes('### Streaming & Real-time Updates');
      const markdownSection = content.includes('### Markdown Rendering');
      const syntaxSection = content.includes('### Syntax Highlighting');
      const diffSection = content.includes('### Diff Views');
      const responsiveSection = content.includes('### Responsive Layouts');
      const themeSection = content.includes('### Theme Support');
      const progressSection = content.includes('### Progress Indicators');

      expect(inkSection).toBe(true);
      expect(streamingSection).toBe(true);
      expect(markdownSection).toBe(true);
      expect(syntaxSection).toBe(true);
      expect(diffSection).toBe(true);
      expect(responsiveSection).toBe(true);
      expect(themeSection).toBe(true);
      expect(progressSection).toBe(true);
    });

    it('should have proper markdown heading hierarchy', () => {
      const richUISection = content.indexOf('## Rich Terminal UI Framework');
      const firstFeature = content.indexOf('### Ink-based Rendering');

      expect(richUISection).toBeGreaterThan(-1);
      expect(firstFeature).toBeGreaterThan(richUISection);
    });

    it('should include visual examples for each feature', () => {
      // Count ASCII art boxes and visual elements
      const boxCount = (content.match(/┌─.*─┐/g) || []).length;
      const tableCount = (content.match(/├─.*─┤/g) || []).length;

      // Should have multiple visual examples throughout
      expect(boxCount).toBeGreaterThan(3);
      expect(tableCount).toBeGreaterThan(0);
    });

    it('should maintain consistent formatting style', () => {
      // Each feature should have a description paragraph
      const featureHeaders = content.match(/### [A-Z].*$/gm) || [];
      expect(featureHeaders.length).toBe(8);

      // Check that each feature has associated content
      featureHeaders.forEach(header => {
        const headerIndex = content.indexOf(header);
        const nextHeaderIndex = content.indexOf('###', headerIndex + 1);
        const sectionContent = nextHeaderIndex > -1
          ? content.slice(headerIndex, nextHeaderIndex)
          : content.slice(headerIndex);

        // Each section should have meaningful content
        expect(sectionContent.length).toBeGreaterThan(200);
      });
    });
  });

  describe('Cross-references and Integration', () => {
    it('should properly integrate with existing sections', () => {
      const terminalInterfaceIndex = content.indexOf('## Terminal Interface (v0.3.0)');
      const richUIIndex = content.indexOf('## Rich Terminal UI Framework');

      // Rich UI section should come after Terminal Interface section
      expect(terminalInterfaceIndex).toBeGreaterThan(-1);
      expect(richUIIndex).toBeGreaterThan(terminalInterfaceIndex);
    });

    it('should reference related concepts from other sections', () => {
      // Should reference concepts that appear elsewhere in the document
      expect(content).toContain('Display Modes');
      expect(content).toContain('Input Preview');
      expect(content).toContain('React');
      expect(content).toContain('terminal');
    });

    it('should maintain document flow and readability', () => {
      // Check that the section doesn't disrupt document structure
      const headings = content.match(/^##?\s+.+$/gm) || [];
      const richUIHeadingIndex = headings.findIndex(h => h.includes('Rich Terminal UI Framework'));

      expect(richUIHeadingIndex).toBeGreaterThan(-1);
      // Should be logically placed in the document
      expect(richUIHeadingIndex).toBeLessThan(headings.length - 2);
    });
  });
});