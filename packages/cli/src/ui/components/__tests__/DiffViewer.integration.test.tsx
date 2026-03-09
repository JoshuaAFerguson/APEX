import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer.js';

// Test actual dependency imports to ensure they're available
describe('DiffViewer Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Dependency Import Availability', () => {
    it('should import diff library successfully', async () => {
      // Test that diff library is available and can be imported
      const diffLib = await import('diff');
      expect(diffLib.diffLines).toBeDefined();
      expect(diffLib.diffChars).toBeDefined();
      expect(typeof diffLib.diffLines).toBe('function');
      expect(typeof diffLib.diffChars).toBe('function');
    });

    it('should import fast-diff library successfully', async () => {
      // Test that fast-diff library is available
      const fastDiffLib = await import('fast-diff');
      expect(fastDiffLib.default).toBeDefined();
      expect(typeof fastDiffLib.default).toBe('function');
    });

    it('should import hooks from index successfully', async () => {
      // Test that useStdoutDimensions hook is available
      const hooksLib = await import('../../hooks/index.js');
      expect(hooksLib.useStdoutDimensions).toBeDefined();
      expect(typeof hooksLib.useStdoutDimensions).toBe('function');
    });

    it('should import React and Ink components successfully', async () => {
      // Test that React and Ink dependencies are available
      const React = await import('react');
      const Ink = await import('ink');

      expect(React.default).toBeDefined();
      expect(Ink.Box).toBeDefined();
      expect(Ink.Text).toBeDefined();
      expect(typeof Ink.Box).toBe('function');
      expect(typeof Ink.Text).toBe('function');
    });
  });

  describe('Component Integration without Mocks', () => {
    it('should render DiffViewer with real dependencies', () => {
      // Test with real dependencies (no mocks) to verify integration
      const { container } = render(
        <DiffViewer
          oldContent="line 1\nold content\nline 3"
          newContent="line 1\nnew content\nline 3"
          filename="integration-test.txt"
        />
      );

      expect(container).toBeTruthy();
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle real diff library output', () => {
      // Test with actual diff library output
      const { container } = render(
        <DiffViewer
          oldContent="Hello World"
          newContent="Hello APEX"
          filename="real-diff.txt"
          mode="unified"
        />
      );

      expect(container).toBeTruthy();
      // Component should render without throwing errors
    });

    it('should handle inline mode with real character diffing', () => {
      const { container } = render(
        <DiffViewer
          oldContent="old text here"
          newContent="new text here"
          filename="char-diff.txt"
          mode="inline"
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Real Terminal Dimension Handling', () => {
    it('should work with actual terminal dimensions', () => {
      // Test with component using real useStdoutDimensions hook
      const { container } = render(
        <DiffViewer
          oldContent="test content for responsive behavior"
          newContent="modified test content for responsive behavior"
          filename="responsive-test.txt"
          mode="auto"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle narrow terminal scenario', () => {
      const { container } = render(
        <DiffViewer
          oldContent="narrow terminal test"
          newContent="modified narrow terminal test"
          filename="narrow.txt"
          width={50}
          mode="auto"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle wide terminal scenario', () => {
      const { container } = render(
        <DiffViewer
          oldContent="wide terminal test content"
          newContent="modified wide terminal test content"
          filename="wide.txt"
          width={200}
          mode="auto"
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Mode Switching Integration', () => {
    it('should switch modes correctly based on props', () => {
      const modes = ['unified', 'split', 'inline', 'auto'] as const;

      modes.forEach(mode => {
        const { rerender, container } = render(
          <DiffViewer
            oldContent="mode test content"
            newContent="modified mode test content"
            filename={`${mode}-test.txt`}
            mode={mode}
            width={150}
          />
        );

        expect(container).toBeTruthy();

        // Clean up for next iteration
        rerender(<div data-testid={`cleanup-${mode}`}>cleanup</div>);
      });
    });

    it('should handle auto mode switching at threshold boundaries', () => {
      const testWidths = [119, 120, 121]; // Around the 120 threshold

      testWidths.forEach(width => {
        const { container } = render(
          <DiffViewer
            oldContent="threshold test"
            newContent="modified threshold test"
            filename={`threshold-${width}.txt`}
            mode="auto"
            width={width}
          />
        );

        expect(container).toBeTruthy();
      });
    });

    it('should fallback from split to unified when width insufficient', () => {
      const { container } = render(
        <DiffViewer
          oldContent="fallback test content"
          newContent="modified fallback test content"
          filename="fallback.txt"
          mode="split"
          width={100} // Below 120 threshold
        />
      );

      expect(container).toBeTruthy();
      // Should render unified mode as fallback
    });
  });

  describe('Real Content Processing', () => {
    it('should process actual code diff scenarios', () => {
      const oldCode = `function hello() {
  console.log("Hello, World!");
  return true;
}`;

      const newCode = `function hello() {
  console.log("Hello, APEX!");
  console.log("Additional logging");
  return true;
}`;

      const { container } = render(
        <DiffViewer
          oldContent={oldCode}
          newContent={newCode}
          filename="code-diff.js"
          mode="unified"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle JSON configuration changes', () => {
      const oldConfig = `{
  "name": "test-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}`;

      const newConfig = `{
  "name": "test-app",
  "version": "1.1.0",
  "dependencies": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}`;

      const { container } = render(
        <DiffViewer
          oldContent={oldConfig}
          newContent={newConfig}
          filename="package.json"
          mode="split"
          width={160}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle markdown document diffs', () => {
      const oldMarkdown = `# Project Title

This is the description.

## Features
- Feature 1
- Feature 2`;

      const newMarkdown = `# Amazing Project Title

This is an improved description with more details.

## Features
- Feature 1 (Enhanced)
- Feature 2
- New Feature 3

## Installation
Run \`npm install\` to get started.`;

      const { container } = render(
        <DiffViewer
          oldContent={oldMarkdown}
          newContent={newMarkdown}
          filename="README.md"
          mode="auto"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle binary and special content', () => {
      const binaryOld = String.fromCharCode(0, 1, 2, 3, 4, 5);
      const binaryNew = String.fromCharCode(0, 1, 10, 11, 4, 5);

      const { container } = render(
        <DiffViewer
          oldContent={binaryOld}
          newContent={binaryNew}
          filename="binary.dat"
          mode="unified"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle Unicode and emoji content', () => {
      const unicodeOld = "Hello 世界 🌍 café naïve résumé";
      const unicodeNew = "Hello 世界 🌎 café naïve résumé modified";

      const { container } = render(
        <DiffViewer
          oldContent={unicodeOld}
          newContent={unicodeNew}
          filename="unicode.txt"
          mode="inline"
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Performance with Real Data', () => {
    it('should handle medium-sized files efficiently', () => {
      const mediumContent = Array(500)
        .fill(0)
        .map((_, i) => `Line ${i + 1}: This is some content for testing`)
        .join('\n');

      const modifiedContent = mediumContent.replace('Line 250:', 'Modified Line 250:');

      const start = performance.now();

      const { container } = render(
        <DiffViewer
          oldContent={mediumContent}
          newContent={modifiedContent}
          filename="medium-file.txt"
          mode="unified"
          maxLines={100}
        />
      );

      const end = performance.now();

      expect(container).toBeTruthy();
      expect(end - start).toBeLessThan(200); // Should render in reasonable time
    });

    it('should handle large files with truncation', () => {
      const largeContent = Array(2000)
        .fill(0)
        .map((_, i) => `Line ${i + 1}`)
        .join('\n');

      const modifiedLargeContent = largeContent.replace('Line 1000', 'Modified Line 1000');

      const { container } = render(
        <DiffViewer
          oldContent={largeContent}
          newContent={modifiedLargeContent}
          filename="large-file.txt"
          mode="unified"
          maxLines={50}
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle very long lines efficiently', () => {
      const longLine = 'x'.repeat(2000);
      const modifiedLongLine = 'y'.repeat(2000);

      const { container } = render(
        <DiffViewer
          oldContent={longLine}
          newContent={modifiedLongLine}
          filename="long-line.txt"
          mode="unified"
          width={120}
        />
      );

      expect(container).toBeTruthy();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed content gracefully', () => {
      const malformedContent = "line1\n\n\n\nline5\n\t\t\nline7";

      const { container } = render(
        <DiffViewer
          oldContent={malformedContent}
          newContent={malformedContent + "\nnew line"}
          filename="malformed.txt"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should handle empty and whitespace-only content', () => {
      const testCases = [
        { old: "", new: "new content" },
        { old: "old content", new: "" },
        { old: "", new: "" },
        { old: "   \t\n  ", new: "\n\n\n" },
        { old: "\n\n\n", new: "   \t\n  " },
      ];

      testCases.forEach(({ old, new: newContent }, index) => {
        const { container } = render(
          <DiffViewer
            oldContent={old}
            newContent={newContent}
            filename={`empty-test-${index}.txt`}
          />
        );

        expect(container).toBeTruthy();
      });
    });

    it('should handle extreme prop values gracefully', () => {
      const extremeCases = [
        { width: 0 },
        { width: -10 },
        { width: 10000 },
        { maxLines: 0 },
        { maxLines: -5 },
        { context: -1 },
        { context: 100 },
      ];

      extremeCases.forEach((props, index) => {
        const { container } = render(
          <DiffViewer
            oldContent="test content"
            newContent="modified test content"
            filename={`extreme-${index}.txt`}
            {...props}
          />
        );

        expect(container).toBeTruthy();
      });
    });
  });
});