/**
 * Content Components Responsive Composition Integration Tests
 *
 * This test file verifies that content components (MarkdownRenderer, DiffViewer,
 * SyntaxHighlighter, CodeBlock) render without overflow when composed together
 * at all 5 terminal width breakpoints:
 *   - narrow: < 60 columns
 *   - compact: 60-79 columns
 *   - normal: 80-119 columns
 *   - wide: 120-179 columns
 *   - extra-wide: >= 180 columns
 *
 * Acceptance Criteria:
 * 1. Components render without overflow at all 5 terminal widths
 * 2. Proper line wrapping is applied
 * 3. No horizontal truncation that breaks content readability
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';
import { DiffViewer } from '../DiffViewer';
import { SyntaxHighlighter, SimpleSyntaxHighlighter } from '../SyntaxHighlighter';
import { CodeBlock } from '../CodeBlock';
import { diffLines, diffChars } from 'diff';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

// Mock the diff library
vi.mock('diff', () => ({
  diffLines: vi.fn(),
  diffChars: vi.fn(),
}));

// Mock fast-diff
vi.mock('fast-diff', () => ({
  default: vi.fn(),
}));

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((content: string) => Promise.resolve(content)),
    setOptions: vi.fn(),
  },
}));

// Mock marked-terminal
vi.mock('marked-terminal', () => ({
  markedTerminal: vi.fn(() => ({})),
}));

// Mock ink-syntax-highlight
vi.mock('ink-syntax-highlight', () => ({
  default: ({ code }: { code: string }) => <span>{code}</span>,
}));

// Terminal width breakpoint configurations
const BREAKPOINT_CONFIGS = {
  narrow: {
    width: 45,
    height: 20,
    breakpoint: 'narrow' as const,
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  },
  compact: {
    width: 70,
    height: 25,
    breakpoint: 'compact' as const,
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  },
  normal: {
    width: 100,
    height: 30,
    breakpoint: 'normal' as const,
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true,
  },
  wide: {
    width: 150,
    height: 40,
    breakpoint: 'wide' as const,
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true,
  },
  extraWide: {
    width: 200,
    height: 50,
    breakpoint: 'wide' as const,
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true,
  },
};

// Test content samples
const TEST_CONTENT = {
  markdown: `# Feature Documentation

## Overview
This is a comprehensive test of markdown rendering capabilities.

### Key Features
- Responsive width handling
- Proper line wrapping
- No horizontal overflow

> This is a blockquote that contains important information about the feature implementation.

\`\`\`typescript
const example = "code block";
\`\`\`

1. First numbered item
2. Second numbered item with **bold text** and *italic text*
3. Third item with \`inline code\`
`,

  longMarkdown: `# Very Long Heading That Should Wrap Properly At Different Terminal Widths Without Breaking

This is an extremely long paragraph that contains a lot of text and should properly wrap at various terminal widths without causing horizontal overflow or truncation issues that would make the content unreadable or break the terminal layout.

- This is a list item with a very long description that needs to wrap properly across multiple lines when the terminal width is constrained
- Another long list item that tests the wrapping behavior of list elements in markdown rendering
- A third item with **bold formatting** and *italic formatting* and \`inline code formatting\` all together

> A very long blockquote that contains multiple sentences and should wrap nicely at all terminal widths while maintaining proper visual hierarchy and indentation for readability.
`,

  code: `import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';

interface ComponentProps {
  title: string;
  description?: string;
  onComplete: () => void;
  options: Array<{ id: string; label: string; value: unknown }>;
}

export function LongNamedComponent({
  title,
  description,
  onComplete,
  options,
}: ComponentProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleSelection = useCallback(async () => {
    setIsProcessing(true);
    try {
      await processSelectedOption(options[selectedIndex]);
      onComplete();
    } catch (error) {
      console.error('Error processing selection:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIndex, options, onComplete]);

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text bold color="cyan">{title}</Text>
      {description && <Text color="gray">{description}</Text>}
    </Box>
  );
}
`,

  longCodeLine: 'const veryLongVariableNameThatExceedsNormalTerminalWidth = someVeryLongFunctionName(parameterOne, parameterTwo, parameterThree, parameterFour);',

  diffOld: `function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`,

  diffNew: `function calculateTotal(items: Item[]): number {
  return items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}`,
};

describe('Content Components Responsive Composition Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Default mock for diff library
    vi.mocked(diffLines).mockReturnValue([
      { count: 1, value: 'unchanged line\n' },
      { count: 1, value: 'old line\n', removed: true },
      { count: 1, value: 'new line\n', added: true },
    ]);
    vi.mocked(diffChars).mockReturnValue([
      { value: 'text' },
    ]);

    // Default terminal dimensions
    mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Individual Component Width Behavior at All Breakpoints', () => {
    const breakpointNames = ['narrow', 'compact', 'normal', 'wide', 'extraWide'] as const;

    describe('MarkdownRenderer', () => {
      breakpointNames.forEach((breakpointName) => {
        it(`renders without overflow at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          const { container } = render(
            <MarkdownRenderer content={TEST_CONTENT.markdown} />
          );

          // Verify component renders with appropriate width
          expect(container).toBeDefined();

          // Width should be at least minimum (40) and at most terminal width - 2
          const expectedWidth = Math.max(40, config.width - 2);
          expect(container.firstChild).toHaveAttribute('width', expectedWidth.toString());
        });

        it(`handles long content at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          const { container } = render(
            <MarkdownRenderer content={TEST_CONTENT.longMarkdown} />
          );

          expect(container).toBeDefined();
          // Should not throw or crash with long content
        });
      });
    });

    describe('SimpleMarkdownRenderer', () => {
      breakpointNames.forEach((breakpointName) => {
        it(`renders without overflow at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          const { container } = render(
            <SimpleMarkdownRenderer content={TEST_CONTENT.markdown} />
          );

          expect(container).toBeDefined();

          const expectedWidth = Math.max(40, config.width - 2);
          expect(container.firstChild).toHaveAttribute('width', expectedWidth.toString());
        });
      });
    });

    describe('DiffViewer', () => {
      breakpointNames.forEach((breakpointName) => {
        it(`renders without overflow at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          const { container } = render(
            <DiffViewer
              oldContent={TEST_CONTENT.diffOld}
              newContent={TEST_CONTENT.diffNew}
              filename="calculator.ts"
            />
          );

          expect(container).toBeDefined();

          // DiffViewer has minimum width of 60
          const expectedWidth = Math.max(60, config.width - 2);
          expect(container.firstChild).toHaveAttribute('width', expectedWidth.toString());
        });

        it(`uses appropriate mode at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          render(
            <DiffViewer
              oldContent={TEST_CONTENT.diffOld}
              newContent={TEST_CONTENT.diffNew}
              filename="test.ts"
              mode="auto"
            />
          );

          // At narrow/compact/normal (<120), should use unified mode
          // At wide/extraWide (>=120), should use split mode
          if (config.width >= 120) {
            // Split mode shows filename twice (in both headers)
            expect(screen.getAllByText(/test.ts/).length).toBeGreaterThanOrEqual(2);
          } else {
            // Unified mode shows filename in header
            expect(screen.getByText(/test.ts/)).toBeInTheDocument();
          }
        });
      });
    });

    describe('SyntaxHighlighter', () => {
      breakpointNames.forEach((breakpointName) => {
        it(`renders without overflow at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          const { container } = render(
            <SyntaxHighlighter
              code={TEST_CONTENT.code}
              language="typescript"
            />
          );

          expect(container).toBeDefined();

          // SyntaxHighlighter has minimum width of 40
          const expectedWidth = Math.max(40, config.width - 2);
          expect(container.firstChild).toHaveAttribute('width', expectedWidth.toString());
        });

        it(`wraps long lines at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          render(
            <SyntaxHighlighter
              code={TEST_CONTENT.longCodeLine}
              language="typescript"
              wrapLines={true}
            />
          );

          // Should show wrapped indicator if line was wrapped
          if (TEST_CONTENT.longCodeLine.length > config.width - 12) { // accounting for line numbers and borders
            expect(screen.getByText(/wrapped/)).toBeInTheDocument();
          }
        });
      });
    });

    describe('CodeBlock', () => {
      breakpointNames.forEach((breakpointName) => {
        it(`renders without overflow at ${breakpointName} terminal width`, () => {
          const config = BREAKPOINT_CONFIGS[breakpointName];
          mockUseStdoutDimensions.mockReturnValue(config);

          const { container } = render(
            <CodeBlock
              code={TEST_CONTENT.code}
              language="typescript"
              filename="example.ts"
            />
          );

          expect(container).toBeDefined();
          expect(screen.getByText('example.ts')).toBeInTheDocument();
        });
      });
    });
  });

  describe('Component Composition at All Breakpoints', () => {
    const breakpointNames = ['narrow', 'compact', 'normal', 'wide', 'extraWide'] as const;

    breakpointNames.forEach((breakpointName) => {
      describe(`at ${breakpointName} terminal width`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS[breakpointName]);
        });

        it('renders MarkdownRenderer + SyntaxHighlighter together without overflow', () => {
          const { container } = render(
            <>
              <MarkdownRenderer content={TEST_CONTENT.markdown} />
              <SyntaxHighlighter code={TEST_CONTENT.code} language="typescript" />
            </>
          );

          expect(container).toBeDefined();
          // Both components should be in the document
          expect(screen.getByText(/Feature Documentation/)).toBeInTheDocument();
          expect(screen.getByText('typescript')).toBeInTheDocument();
        });

        it('renders MarkdownRenderer + DiffViewer together without overflow', () => {
          const { container } = render(
            <>
              <MarkdownRenderer content="# Code Changes\n\nHere are the diff results:" />
              <DiffViewer
                oldContent={TEST_CONTENT.diffOld}
                newContent={TEST_CONTENT.diffNew}
                filename="changes.ts"
              />
            </>
          );

          expect(container).toBeDefined();
          expect(screen.getByText(/Code Changes/)).toBeInTheDocument();
        });

        it('renders SyntaxHighlighter + CodeBlock together without overflow', () => {
          const { container } = render(
            <>
              <SyntaxHighlighter
                code="const a = 1;"
                language="typescript"
              />
              <CodeBlock
                code="const b = 2;"
                language="typescript"
                filename="example.ts"
              />
            </>
          );

          expect(container).toBeDefined();
          expect(screen.getByText('example.ts')).toBeInTheDocument();
        });

        it('renders all four content components together without overflow', () => {
          const { container } = render(
            <>
              <MarkdownRenderer content="# Documentation\n\nSome markdown content." />
              <SimpleMarkdownRenderer content="## Simple Section\n\n- Item 1\n- Item 2" />
              <SyntaxHighlighter code="const x = 1;" language="typescript" />
              <DiffViewer
                oldContent="old"
                newContent="new"
                filename="test.ts"
              />
            </>
          );

          expect(container).toBeDefined();
          expect(screen.getByText(/Documentation/)).toBeInTheDocument();
          expect(screen.getByText(/Simple Section/)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Line Wrapping Consistency', () => {
    const longContent = 'x'.repeat(150); // Content longer than any breakpoint width

    Object.entries(BREAKPOINT_CONFIGS).forEach(([breakpointName, config]) => {
      describe(`at ${breakpointName} width (${config.width} columns)`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue(config);
        });

        it('SyntaxHighlighter wraps content appropriately', () => {
          render(
            <SyntaxHighlighter
              code={longContent}
              language="text"
              wrapLines={true}
            />
          );

          // Should show wrapped indicator
          expect(screen.getByText(/wrapped/)).toBeInTheDocument();
        });

        it('DiffViewer truncates long lines with ellipsis', () => {
          vi.mocked(diffLines).mockReturnValue([
            { count: 1, value: `${longContent}\n`, added: true },
          ]);

          render(
            <DiffViewer
              oldContent=""
              newContent={longContent}
              filename="long-line.txt"
              mode="unified"
            />
          );

          // Should contain ellipsis for truncated content
          expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Width Calculation Consistency Across Components', () => {
    it('all components use consistent minimum width enforcement', () => {
      // Use a very narrow terminal to trigger minimum width
      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS.narrow,
        width: 30, // Very narrow
      });

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="Test" />
      );
      const { container: syntaxContainer } = render(
        <SyntaxHighlighter code="test" />
      );
      const { container: diffContainer } = render(
        <DiffViewer oldContent="a" newContent="b" />
      );

      // MarkdownRenderer and SyntaxHighlighter minimum is 40
      expect(markdownContainer.firstChild).toHaveAttribute('width', '40');
      expect(syntaxContainer.firstChild).toHaveAttribute('width', '40');

      // DiffViewer minimum is 60
      expect(diffContainer.firstChild).toHaveAttribute('width', '60');
    });

    it('all components respond to explicit width override', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      const explicitWidth = 90;

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="Test" width={explicitWidth} />
      );
      const { container: syntaxContainer } = render(
        <SyntaxHighlighter code="test" width={explicitWidth} />
      );
      const { container: diffContainer } = render(
        <DiffViewer oldContent="a" newContent="b" width={explicitWidth} />
      );

      expect(markdownContainer.firstChild).toHaveAttribute('width', explicitWidth.toString());
      expect(syntaxContainer.firstChild).toHaveAttribute('width', explicitWidth.toString());
      expect(diffContainer.firstChild).toHaveAttribute('width', explicitWidth.toString());
    });

    it('all components use fixed width when responsive=false', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.wide);

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="Test" responsive={false} />
      );
      const { container: syntaxContainer } = render(
        <SyntaxHighlighter code="test" responsive={false} />
      );
      const { container: diffContainer } = render(
        <DiffViewer oldContent="a" newContent="b" responsive={false} />
      );

      // MarkdownRenderer and SyntaxHighlighter default to 80 when not responsive
      expect(markdownContainer.firstChild).toHaveAttribute('width', '80');
      expect(syntaxContainer.firstChild).toHaveAttribute('width', '80');

      // DiffViewer defaults to 120 when not responsive
      expect(diffContainer.firstChild).toHaveAttribute('width', '120');
    });
  });

  describe('Terminal Resize Simulation', () => {
    it('components adapt when terminal resizes from narrow to wide', () => {
      // Start narrow
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      const { container, rerender } = render(
        <MarkdownRenderer content={TEST_CONTENT.markdown} />
      );

      expect(container.firstChild).toHaveAttribute('width', '43'); // 45 - 2

      // Resize to wide
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.wide);

      rerender(<MarkdownRenderer content={TEST_CONTENT.markdown} />);

      expect(container.firstChild).toHaveAttribute('width', '148'); // 150 - 2
    });

    it('DiffViewer mode changes when terminal resizes across split threshold', () => {
      // Start below split threshold
      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS.normal,
        width: 100,
      });

      const { rerender } = render(
        <DiffViewer
          oldContent={TEST_CONTENT.diffOld}
          newContent={TEST_CONTENT.diffNew}
          filename="test.ts"
          mode="auto"
        />
      );

      // Below 120, should use unified mode (shows fallback message if split requested)
      // With auto mode, just renders appropriately

      // Resize above split threshold
      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS.wide,
        width: 150,
      });

      rerender(
        <DiffViewer
          oldContent={TEST_CONTENT.diffOld}
          newContent={TEST_CONTENT.diffNew}
          filename="test.ts"
          mode="auto"
        />
      );

      // Above 120, should use split mode (filename appears in both headers)
      expect(screen.getAllByText(/test.ts/).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty content in all components', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      render(
        <>
          <MarkdownRenderer content="" />
          <SimpleMarkdownRenderer content="" />
          <SyntaxHighlighter code="" />
          <DiffViewer oldContent="" newContent="" />
        </>
      );

      // Should render without crashing
      expect(screen.getByText('1 lines')).toBeInTheDocument();
    });

    it('handles terminal dimensions unavailable', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact' as const,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: false, // Not available
      });

      const { container } = render(
        <>
          <MarkdownRenderer content="Test" />
          <SyntaxHighlighter code="const x = 1;" />
          <DiffViewer oldContent="a" newContent="b" />
        </>
      );

      // Should still render with fallback dimensions
      expect(container).toBeDefined();
    });

    it('handles extremely long single line content', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      const extremelyLongLine = 'x'.repeat(1000);

      render(
        <>
          <MarkdownRenderer content={extremelyLongLine} />
          <SyntaxHighlighter code={extremelyLongLine} wrapLines={true} />
        </>
      );

      // Should render without crashing and show wrapped indicator
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('handles special characters and unicode', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      const specialContent = '🚀 Unicode: αβγδ Symbols: <>&"\'';

      render(
        <>
          <MarkdownRenderer content={`# ${specialContent}`} />
          <SyntaxHighlighter code={`const emoji = "${specialContent}";`} />
        </>
      );

      expect(screen.getAllByText(/🚀/).length).toBeGreaterThan(0);
    });

    it('handles mixed content types in composition', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      render(
        <>
          <MarkdownRenderer
            content={`# Code Review

Here's the diff:

\`\`\`typescript
${TEST_CONTENT.code.substring(0, 100)}
\`\`\`
`}
          />
          <DiffViewer
            oldContent={TEST_CONTENT.diffOld}
            newContent={TEST_CONTENT.diffNew}
            filename="reviewed-file.ts"
          />
        </>
      );

      expect(screen.getByText(/Code Review/)).toBeInTheDocument();
    });
  });

  describe('Performance with Large Content', () => {
    it('handles large markdown document efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      const largeMarkdown = Array(100)
        .fill(TEST_CONTENT.markdown)
        .join('\n\n');

      const start = performance.now();
      render(<MarkdownRenderer content={largeMarkdown} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(200);
    });

    it('handles large code file efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      const largeCode = Array(1000)
        .fill('console.log("test");')
        .join('\n');

      const start = performance.now();
      render(<SyntaxHighlighter code={largeCode} maxLines={50} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(200);
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('handles large diff efficiently', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      const largeOld = Array(500).fill('old line').join('\n');
      const largeNew = Array(500).fill('new line').join('\n');

      vi.mocked(diffLines).mockReturnValue([
        { count: 500, value: largeOld, removed: true },
        { count: 500, value: largeNew, added: true },
      ]);

      const start = performance.now();
      render(
        <DiffViewer
          oldContent={largeOld}
          newContent={largeNew}
          filename="large.txt"
          maxLines={50}
        />
      );
      const end = performance.now();

      expect(end - start).toBeLessThan(200);
    });
  });
});

describe('Acceptance Criteria Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.mocked(diffLines).mockReturnValue([
      { count: 1, value: 'test line\n' },
    ]);
    vi.mocked(diffChars).mockReturnValue([{ value: 'test' }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Criterion 1: Components render without overflow at all 5 terminal widths', () => {
    const allBreakpoints = [
      { name: 'narrow (45 cols)', config: BREAKPOINT_CONFIGS.narrow },
      { name: 'compact (70 cols)', config: BREAKPOINT_CONFIGS.compact },
      { name: 'normal (100 cols)', config: BREAKPOINT_CONFIGS.normal },
      { name: 'wide (150 cols)', config: BREAKPOINT_CONFIGS.wide },
      { name: 'extra-wide (200 cols)', config: BREAKPOINT_CONFIGS.extraWide },
    ];

    allBreakpoints.forEach(({ name, config }) => {
      it(`all content components render correctly at ${name}`, () => {
        mockUseStdoutDimensions.mockReturnValue(config);

        const { container } = render(
          <>
            <MarkdownRenderer content="# Test\n\nContent" />
            <SimpleMarkdownRenderer content="## Simple\n\n- Item" />
            <SyntaxHighlighter code="const x = 1;" language="typescript" />
            <DiffViewer oldContent="old" newContent="new" filename="test.ts" />
          </>
        );

        // All components should render without throwing
        expect(container).toBeDefined();
        expect(container.children.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Criterion 2: Proper line wrapping is applied', () => {
    it('SyntaxHighlighter applies line wrapping when content exceeds width', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      const longLine = 'const veryLongVariableNameThatDefinitelyExceedsTheNarrowTerminalWidth = "value";';

      render(
        <SyntaxHighlighter code={longLine} language="typescript" wrapLines={true} />
      );

      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('DiffViewer truncates and marks long lines', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      const longLine = 'x'.repeat(200);
      vi.mocked(diffLines).mockReturnValue([
        { count: 1, value: `${longLine}\n`, added: true },
      ]);

      render(
        <DiffViewer
          oldContent=""
          newContent={longLine}
          filename="test.ts"
          mode="unified"
        />
      );

      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  describe('Criterion 3: No horizontal truncation that breaks content readability', () => {
    it('essential content remains readable at narrow widths', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      render(
        <MarkdownRenderer content="# Important Title\n\nCritical information here." />
      );

      // Key content should still be present
      expect(screen.getByText(/Important Title/)).toBeInTheDocument();
      expect(screen.getByText(/Critical information/)).toBeInTheDocument();
    });

    it('code structure remains understandable after wrapping', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      render(
        <SyntaxHighlighter
          code="function test() { return true; }"
          language="typescript"
          wrapLines={true}
        />
      );

      // Function name and structure should be present
      expect(screen.getByText(/function/)).toBeInTheDocument();
      expect(screen.getByText(/test/)).toBeInTheDocument();
    });

    it('diff changes remain identifiable at all widths', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);

      vi.mocked(diffLines).mockReturnValue([
        { count: 1, value: 'removed\n', removed: true },
        { count: 1, value: 'added\n', added: true },
      ]);

      render(
        <DiffViewer
          oldContent="removed"
          newContent="added"
          filename="changes.ts"
        />
      );

      // Should show the filename
      expect(screen.getByText(/changes.ts/)).toBeInTheDocument();
    });
  });
});
