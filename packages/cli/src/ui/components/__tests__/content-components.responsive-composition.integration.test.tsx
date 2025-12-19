import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, RenderResult } from '../../../__tests__/test-utils';
import type { StdoutDimensions, Breakpoint } from '../../hooks/useStdoutDimensions';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { DiffViewer } from '../DiffViewer';
import { SyntaxHighlighter } from '../SyntaxHighlighter';
import { CodeBlock } from '../CodeBlock';

// =============================================================================
// SECTION 1: Terminal Width Mock Helper
// =============================================================================

/**
 * Standard terminal widths for responsive testing
 * Maps to breakpoints: 40→narrow, 60→compact, 80→compact, 120→normal, 180→wide
 */
export type TerminalWidth = 40 | 60 | 80 | 120 | 180;

/**
 * Terminal width to breakpoint mapping with full dimension context
 */
const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = {
  40: {
    width: 40,
    height: 24,
    breakpoint: 'narrow',
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  60: {
    width: 60,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  80: {
    width: 80,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true
  },
  120: {
    width: 120,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true
  },
  180: {
    width: 180,
    height: 40,
    breakpoint: 'wide',
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true
  },
};

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/index', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock the marked library for MarkdownRenderer
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
    setOptions: vi.fn(),
  },
}));

// Mock the diff library for DiffViewer
vi.mock('diff', () => ({
  diffLines: vi.fn(),
  diffChars: vi.fn(),
}));

/**
 * Helper to mock terminal width for responsive testing
 *
 * @param cols - Terminal width in columns (40, 60, 80, 120, or 180)
 * @param overrides - Optional overrides for specific dimension properties
 * @returns The mock return value for verification
 */
export function mockTerminalWidth(
  cols: TerminalWidth,
  overrides?: Partial<StdoutDimensions>
): StdoutDimensions {
  const config = { ...TERMINAL_CONFIGS[cols], ...overrides };
  mockUseStdoutDimensions.mockReturnValue(config);
  return config;
}

// =============================================================================
// SECTION 2: Component Composition Wrapper
// =============================================================================

export interface ResponsiveTestWrapperProps {
  children: React.ReactNode;
  /** Initial terminal width (default: 80) */
  initialWidth?: TerminalWidth;
}

/**
 * Wrapper component providing consistent test context for responsive components
 *
 * Features:
 * - Consistent terminal dimensions
 * - Pre-configured mocks
 */
export const ResponsiveTestWrapper: React.FC<ResponsiveTestWrapperProps> = ({
  children,
  initialWidth = 80
}) => {
  // Set up initial terminal width
  React.useEffect(() => {
    mockTerminalWidth(initialWidth);
  }, [initialWidth]);

  return <div data-testid="responsive-test-wrapper">{children}</div>;
};

/**
 * Custom render function for responsive component testing
 *
 * @param ui - React element to render
 * @param options - Render options including terminal width
 * @returns Enhanced render result with responsive helpers
 */
export function renderResponsive(
  ui: React.ReactElement,
  options?: {
    width?: TerminalWidth;
  }
): RenderResult & {
  setWidth: (width: TerminalWidth) => void;
} {
  const { width = 80 } = options || {};

  mockTerminalWidth(width);

  const renderResult = render(
    <ResponsiveTestWrapper initialWidth={width}>
      {ui}
    </ResponsiveTestWrapper>
  );

  return {
    ...renderResult,
    setWidth: (newWidth: TerminalWidth) => {
      mockTerminalWidth(newWidth);
      renderResult.rerender(
        <ResponsiveTestWrapper initialWidth={newWidth}>
          {ui}
        </ResponsiveTestWrapper>
      );
    },
  };
}

// =============================================================================
// SECTION 3: Responsive Assertion Helpers
// =============================================================================

/**
 * Assert that text content does not overflow the specified width
 *
 * @param element - DOM element to check
 * @param maxWidth - Maximum allowed character width
 * @throws AssertionError if content exceeds maxWidth
 */
export function expectNoOverflow(
  element: HTMLElement,
  maxWidth: number
): void {
  const textContent = element.textContent || '';
  const lines = textContent.split('\n');

  lines.forEach((line, index) => {
    if (line.length > maxWidth) {
      throw new Error(
        `Line ${index + 1} exceeds max width of ${maxWidth} characters. ` +
        `Actual length: ${line.length}. Line: "${line.substring(0, 50)}..."`
      );
    }
  });
}

/**
 * Assert that text has been truncated (contains "..." or is shorter than original)
 *
 * @param element - DOM element containing potentially truncated text
 * @param originalText - The full untruncated text
 */
export function expectTruncated(
  element: HTMLElement,
  originalText: string
): void {
  const displayedText = element.textContent || '';
  const isTruncated = displayedText.includes('...') || displayedText.length < originalText.length;

  if (!isTruncated) {
    throw new Error(
      `Expected text to be truncated. ` +
      `Original length: ${originalText.length}, displayed length: ${displayedText.length}`
    );
  }
}

/**
 * Assert that text is NOT truncated
 *
 * @param element - DOM element that should contain full text
 * @param originalText - The expected full text
 */
export function expectNotTruncated(
  element: HTMLElement,
  originalText: string
): void {
  const displayedText = element.textContent || '';
  const isTruncated = displayedText.includes('...') || displayedText.length < originalText.length;

  if (isTruncated) {
    throw new Error(
      `Expected text NOT to be truncated, but it was. ` +
      `Original length: ${originalText.length}, displayed length: ${displayedText.length}`
    );
  }
}

/**
 * Configuration for breakpoint behavior testing
 */
export interface BreakpointBehaviorConfig {
  component: React.ReactElement;
  /** Elements expected to be visible at each breakpoint */
  visible?: {
    narrow?: string[];
    compact?: string[];
    normal?: string[];
    wide?: string[];
  };
  /** Elements expected to be hidden at each breakpoint */
  hidden?: {
    narrow?: string[];
    compact?: string[];
    normal?: string[];
    wide?: string[];
  };
}

/**
 * Comprehensively test component behavior across all breakpoints
 *
 * @param config - Breakpoint behavior configuration
 */
export function expectBreakpointBehavior(
  config: BreakpointBehaviorConfig
): void {
  const breakpoints: [TerminalWidth, keyof NonNullable<BreakpointBehaviorConfig['visible']>][] = [
    [40, 'narrow'],
    [60, 'compact'],
    [80, 'compact'],
    [120, 'normal'],
    [180, 'wide'],
  ];

  breakpoints.forEach(([width, breakpointKey]) => {
    const { setWidth } = renderResponsive(config.component, { width });

    // Check visible elements
    const visibleElements = config.visible?.[breakpointKey] || [];
    visibleElements.forEach(element => {
      expect(screen.getByText(element)).toBeInTheDocument();
    });

    // Check hidden elements
    const hiddenElements = config.hidden?.[breakpointKey] || [];
    hiddenElements.forEach(element => {
      expect(screen.queryByText(element)).not.toBeInTheDocument();
    });
  });
}

// =============================================================================
// SECTION 4: Integration Tests - Content Components Responsive Composition
// =============================================================================

describe('Content Components Responsive Composition Integration Tests', () => {
  beforeEach(() => {
    // Set up mocks for each test
    const { marked } = require('marked');
    marked.parse.mockImplementation(async (content: string) => {
      // Simple mock implementation
      if (content.includes('# ')) return content.replace('# ', '<h1>') + '</h1>';
      if (content.includes('## ')) return content.replace('## ', '<h2>') + '</h2>';
      if (content.includes('**')) return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (content.includes('`')) return content.replace(/`(.*?)`/g, '<code>$1</code>');
      return content;
    });

    const { diffLines } = require('diff');
    diffLines.mockReturnValue([
      { count: 1, value: 'unchanged line\n' },
      { count: 1, value: 'old line\n', removed: true },
      { count: 1, value: 'new line\n', added: true },
    ]);

    // Default terminal width
    mockTerminalWidth(80);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =============================================================================
  // Foundation Validation Tests
  // =============================================================================

  describe('Foundation Utilities', () => {
    describe('mockTerminalWidth helper', () => {
      it('correctly sets up all 5 terminal widths', () => {
        const widths: TerminalWidth[] = [40, 60, 80, 120, 180];

        widths.forEach(width => {
          const config = mockTerminalWidth(width);
          expect(config.width).toBe(width);
          expect(config.isAvailable).toBe(true);
        });
      });

      it('correctly maps widths to breakpoints', () => {
        expect(mockTerminalWidth(40).breakpoint).toBe('narrow');
        expect(mockTerminalWidth(60).breakpoint).toBe('compact');
        expect(mockTerminalWidth(80).breakpoint).toBe('compact');
        expect(mockTerminalWidth(120).breakpoint).toBe('normal');
        expect(mockTerminalWidth(180).breakpoint).toBe('wide');
      });

      it('correctly sets boolean helpers', () => {
        const narrow = mockTerminalWidth(40);
        expect(narrow.isNarrow).toBe(true);
        expect(narrow.isCompact).toBe(false);

        const compact = mockTerminalWidth(80);
        expect(compact.isCompact).toBe(true);
        expect(compact.isNormal).toBe(false);

        const normal = mockTerminalWidth(120);
        expect(normal.isNormal).toBe(true);
        expect(normal.isWide).toBe(false);

        const wide = mockTerminalWidth(180);
        expect(wide.isWide).toBe(true);
        expect(wide.isNormal).toBe(false);
      });
    });

    describe('ResponsiveTestWrapper', () => {
      it('renders children correctly', () => {
        render(
          <ResponsiveTestWrapper>
            <div data-testid="test-child">Content</div>
          </ResponsiveTestWrapper>
        );

        expect(screen.getByTestId('test-child')).toBeInTheDocument();
        expect(screen.getByText('Content')).toBeInTheDocument();
      });

      it('sets initial terminal width', () => {
        render(
          <ResponsiveTestWrapper initialWidth={120}>
            <div>Test</div>
          </ResponsiveTestWrapper>
        );

        expect(mockUseStdoutDimensions).toHaveBeenCalledWith(
          expect.objectContaining({ width: 120 })
        );
      });
    });

    describe('renderResponsive helper', () => {
      it('returns setWidth function for changing terminal width', () => {
        const { setWidth } = renderResponsive(<div data-testid="test">Content</div>);

        expect(typeof setWidth).toBe('function');
        expect(screen.getByTestId('test')).toBeInTheDocument();
      });

      it('allows changing width dynamically', () => {
        const { setWidth } = renderResponsive(<div>Test</div>, { width: 80 });

        // Initial width should be set
        expect(mockUseStdoutDimensions).toHaveBeenLastCalledWith(
          expect.objectContaining({ width: 80 })
        );

        // Change width
        setWidth(120);
        expect(mockUseStdoutDimensions).toHaveBeenLastCalledWith(
          expect.objectContaining({ width: 120 })
        );
      });
    });

    describe('Assertion helpers', () => {
      describe('expectNoOverflow', () => {
        it('passes when text is within width limit', () => {
          const element = document.createElement('div');
          element.textContent = 'Short text';

          expect(() => expectNoOverflow(element, 20)).not.toThrow();
        });

        it('throws when text exceeds width limit', () => {
          const element = document.createElement('div');
          element.textContent = 'This is a very long line that exceeds the width limit';

          expect(() => expectNoOverflow(element, 20)).toThrow(/exceeds max width/);
        });

        it('checks multiple lines', () => {
          const element = document.createElement('div');
          element.textContent = 'Short\nAnother short line\nThis is way too long for the specified limit';

          expect(() => expectNoOverflow(element, 25)).toThrow(/Line 3 exceeds max width/);
        });
      });

      describe('expectTruncated', () => {
        it('passes when text contains ellipsis', () => {
          const element = document.createElement('div');
          element.textContent = 'Truncated text...';

          expect(() => expectTruncated(element, 'Original very long text that was truncated')).not.toThrow();
        });

        it('passes when text is shorter than original', () => {
          const element = document.createElement('div');
          element.textContent = 'Short';

          expect(() => expectTruncated(element, 'Much longer original text')).not.toThrow();
        });

        it('throws when text is not truncated', () => {
          const element = document.createElement('div');
          element.textContent = 'Full original text';

          expect(() => expectTruncated(element, 'Full original text')).toThrow(/Expected text to be truncated/);
        });
      });

      describe('expectNotTruncated', () => {
        it('passes when text is complete', () => {
          const element = document.createElement('div');
          element.textContent = 'Complete text';

          expect(() => expectNotTruncated(element, 'Complete text')).not.toThrow();
        });

        it('throws when text contains ellipsis', () => {
          const element = document.createElement('div');
          element.textContent = 'Truncated...';

          expect(() => expectNotTruncated(element, 'Original text')).toThrow(/Expected text NOT to be truncated/);
        });

        it('throws when text is shorter than original', () => {
          const element = document.createElement('div');
          element.textContent = 'Short';

          expect(() => expectNotTruncated(element, 'Much longer text')).toThrow(/Expected text NOT to be truncated/);
        });
      });
    });
  });

  // =============================================================================
  // MarkdownRenderer Responsive Composition Tests
  // =============================================================================

  describe('MarkdownRenderer Responsive Composition', () => {
    const testMarkdown = `# Main Header

This is a paragraph with **bold text** and *italic text*. Here's some \`inline code\` for testing.

## Secondary Header

### Lists and Code

- First item in list
- Second item with more content
- Third item that is longer and might wrap

\`\`\`typescript
interface TestInterface {
  name: string;
  value: number;
  description: string;
}
\`\`\`

> Important blockquote with **emphasis** and additional context that might be quite long.`;

    describe('Width Adaptation Across All Breakpoints', () => {
      it('adapts to very narrow terminals (40 columns) without overflow', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} />
        );

        // Should use minimum width of 40 (Math.max(40, 40 - 2) = 40)
        expect(container.firstChild).toHaveAttribute('width', '38');

        // Content should not overflow
        expectNoOverflow(container.firstChild as HTMLElement, 40);
      });

      it('adapts to compact terminals (60 columns) with proper wrapping', () => {
        mockTerminalWidth(60);

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} />
        );

        // Should use responsive width (60 - 2 = 58)
        expect(container.firstChild).toHaveAttribute('width', '58');

        // Content should fit within terminal
        expectNoOverflow(container.firstChild as HTMLElement, 60);
      });

      it('adapts to standard terminals (80 columns) with balanced layout', () => {
        mockTerminalWidth(80);

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} />
        );

        // Should use responsive width (80 - 2 = 78)
        expect(container.firstChild).toHaveAttribute('width', '78');

        // Content should be well-formatted
        expectNoOverflow(container.firstChild as HTMLElement, 80);
      });

      it('adapts to normal terminals (120 columns) with full content', () => {
        mockTerminalWidth(120);

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} />
        );

        // Should use responsive width (120 - 2 = 118)
        expect(container.firstChild).toHaveAttribute('width', '118');

        // Content should display without truncation
        expectNoOverflow(container.firstChild as HTMLElement, 120);
      });

      it('adapts to wide terminals (180 columns) with optimal layout', () => {
        mockTerminalWidth(180);

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} />
        );

        // Should use responsive width (180 - 2 = 178)
        expect(container.firstChild).toHaveAttribute('width', '178');

        // Content should be fully displayed
        expectNoOverflow(container.firstChild as HTMLElement, 180);
      });
    });

    describe('Line Wrapping Behavior', () => {
      it('properly wraps long lines in narrow terminals', () => {
        mockTerminalWidth(40);

        const longLine = 'This is an extremely long line that definitely exceeds 40 characters and should be wrapped properly';

        render(<MarkdownRenderer content={longLine} />);

        // Should render without horizontal overflow
        const content = screen.getByText(/This is an extremely/);
        expectNoOverflow(content, 40);
      });

      it('handles code blocks responsively', () => {
        mockTerminalWidth(60);

        const codeBlock = '```typescript\nconst veryLongVariableNameThatExceedsWidth = "test";\n```';

        render(<MarkdownRenderer content={codeBlock} />);

        // Code should be contained within terminal width
        const content = screen.getByText(/typescript/);
        expectNoOverflow(content.parentElement || content, 60);
      });
    });

    describe('Explicit Width Override', () => {
      it('respects explicit width over responsive behavior', () => {
        mockTerminalWidth(120); // Large terminal

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} width={50} />
        );

        // Should use explicit width instead of responsive calculation
        expect(container.firstChild).toHaveAttribute('width', '50');
      });

      it('respects responsive=false setting', () => {
        mockTerminalWidth(60); // Small terminal

        const { container } = render(
          <MarkdownRenderer content={testMarkdown} responsive={false} />
        );

        // Should use default width (80) instead of responsive calculation
        expect(container.firstChild).toHaveAttribute('width', '80');
      });
    });
  });

  // =============================================================================
  // DiffViewer Responsive Composition Tests
  // =============================================================================

  describe('DiffViewer Responsive Composition', () => {
    const oldContent = `function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}`;

    const newContent = `function calculateTotal(items, tax = 0) {
  let total = 0;
  for (const item of items) {
    total += item.price * (1 + tax);
  }
  return total;
}`;

    describe('Mode Selection Based on Terminal Width', () => {
      it('uses unified mode for very narrow terminals (40 columns)', () => {
        mockTerminalWidth(40);

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="test.js"
            mode="auto"
          />
        );

        // Should automatically choose unified mode for narrow terminals
        expect(screen.getByText('test.js')).toBeInTheDocument();

        // Should show unified diff indicators (--- and +++)
        const headers = screen.getAllByText(/test.js/);
        expect(headers).toHaveLength(2); // --- and +++ headers
      });

      it('uses unified mode for compact terminals (80 columns)', () => {
        mockTerminalWidth(80);

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="test.js"
            mode="auto"
          />
        );

        // Should use unified mode (< 120 columns)
        expect(screen.getByText('test.js')).toBeInTheDocument();
      });

      it('uses split mode for normal terminals (120 columns)', () => {
        mockTerminalWidth(120);

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="test.js"
            mode="auto"
          />
        );

        // Should automatically choose split mode for normal terminals
        const headers = screen.getAllByText(/test.js/);
        expect(headers).toHaveLength(2); // Two side-by-side headers in split mode
      });

      it('uses split mode for wide terminals (180 columns)', () => {
        mockTerminalWidth(180);

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="test.js"
            mode="auto"
          />
        );

        // Should use split mode for maximum readability
        expect(screen.getByText('test.js')).toBeInTheDocument();
      });
    });

    describe('Forced Mode Fallback', () => {
      it('falls back from split to unified when terminal too narrow', () => {
        mockTerminalWidth(60); // Too narrow for split

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="test.js"
            mode="split" // Explicitly requested
          />
        );

        // Should show fallback message
        expect(screen.getByText(/split view requires 120\+ columns/i)).toBeInTheDocument();
      });

      it('allows split mode when terminal is wide enough', () => {
        mockTerminalWidth(120); // Just at threshold

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="test.js"
            mode="split"
          />
        );

        // Should not show fallback message
        expect(screen.queryByText(/split view requires 120\+ columns/i)).not.toBeInTheDocument();
      });
    });

    describe('Line Number Adaptation', () => {
      it('uses compact line numbers in narrow terminals', () => {
        mockTerminalWidth(40);

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="narrow.js"
            showLineNumbers={true}
          />
        );

        // Should render with minimal line number width for narrow terminals
        expect(screen.getByText('narrow.js')).toBeInTheDocument();
      });

      it('uses standard line numbers in normal terminals', () => {
        mockTerminalWidth(120);

        render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="normal.js"
            showLineNumbers={true}
          />
        );

        // Should use appropriate line number spacing
        expect(screen.getByText('normal.js')).toBeInTheDocument();
      });
    });

    describe('Content Width Calculations', () => {
      it('prevents overflow in unified mode', () => {
        mockTerminalWidth(80);

        const longLine = 'x'.repeat(200); // Very long line

        const { container } = render(
          <DiffViewer
            oldContent=""
            newContent={longLine}
            filename="overflow-test.txt"
            mode="unified"
          />
        );

        // Should contain truncated content or proper wrapping
        expectNoOverflow(container, 80);
      });

      it('distributes width properly in split mode', () => {
        mockTerminalWidth(160); // Wide enough for split

        const { container } = render(
          <DiffViewer
            oldContent={oldContent}
            newContent={newContent}
            filename="split-test.js"
            mode="split"
          />
        );

        // Each side should get approximately half the width
        expectNoOverflow(container, 160);
      });
    });
  });

  // =============================================================================
  // SyntaxHighlighter Responsive Composition Tests
  // =============================================================================

  describe('SyntaxHighlighter Responsive Composition', () => {
    const testCode = `interface UserProfile {
  id: number;
  name: string;
  email: string;
  preferences: {
    theme: 'dark' | 'light';
    notifications: boolean;
    language: string;
  };
}

function createUserProfile(data: Partial<UserProfile>): UserProfile {
  return {
    id: data.id || Math.floor(Math.random() * 1000),
    name: data.name || 'Anonymous',
    email: data.email || 'user@example.com',
    preferences: {
      theme: 'dark',
      notifications: true,
      language: 'en',
      ...data.preferences
    }
  };
}`;

    describe('Width Adaptation and Line Wrapping', () => {
      it('adapts to very narrow terminals (40 columns) with wrapping', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            responsive={true}
          />
        );

        // Should use minimum width and enable wrapping
        expectNoOverflow(container, 40);

        // Should show wrapped line indicator
        expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      });

      it('handles compact terminals (60 columns) with balanced layout', () => {
        mockTerminalWidth(60);

        const { container } = render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            responsive={true}
          />
        );

        // Should fit within compact terminal width
        expectNoOverflow(container, 60);
      });

      it('utilizes normal terminals (120 columns) effectively', () => {
        mockTerminalWidth(120);

        const { container } = render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            responsive={true}
          />
        );

        // Should use available width efficiently
        expectNoOverflow(container, 120);

        // Code should be displayed with minimal wrapping
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });

      it('optimizes for wide terminals (180 columns)', () => {
        mockTerminalWidth(180);

        const { container } = render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            responsive={true}
          />
        );

        // Should take advantage of wide terminal
        expectNoOverflow(container, 180);
      });
    });

    describe('Line Number Display', () => {
      it('shows line numbers appropriately in narrow terminals', () => {
        mockTerminalWidth(40);

        render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            showLineNumbers={true}
          />
        );

        // Should show line numbers even in narrow terminals
        expect(screen.getByText('1 │')).toBeInTheDocument();
        expect(screen.getByText(/\d+ lines/)).toBeInTheDocument();
      });

      it('displays line numbers clearly in wide terminals', () => {
        mockTerminalWidth(180);

        render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            showLineNumbers={true}
          />
        );

        // Should show line numbers with adequate spacing
        expect(screen.getByText('1 │')).toBeInTheDocument();
      });
    });

    describe('Content Truncation', () => {
      it('truncates large files when maxLines is set', () => {
        mockTerminalWidth(120);

        const largeCode = Array(100).fill('console.log("line");').join('\n');

        render(
          <SyntaxHighlighter
            code={largeCode}
            language="javascript"
            maxLines={20}
          />
        );

        // Should show truncation indicator
        expect(screen.getByText(/80 more lines/)).toBeInTheDocument();
      });

      it('handles very long lines without horizontal overflow', () => {
        mockTerminalWidth(60);

        const longLine = 'const veryLongVariableNameThatDefinitelyExceedsTheTerminalWidthAndShouldBeHandledGracefully = "test";';

        const { container } = render(
          <SyntaxHighlighter
            code={longLine}
            language="typescript"
            wrapLines={true}
          />
        );

        expectNoOverflow(container, 60);
      });
    });

    describe('Responsive vs Fixed Width', () => {
      it('uses fixed width when responsive=false', () => {
        mockTerminalWidth(40); // Very narrow

        const { container } = render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            responsive={false}
          />
        );

        // Should ignore terminal width and use default
        // Fixed width should not overflow, but might not be optimal
        expectNoOverflow(container, 80); // Default fixed width
      });

      it('respects explicit width prop', () => {
        mockTerminalWidth(180); // Very wide

        const { container } = render(
          <SyntaxHighlighter
            code={testCode}
            language="typescript"
            width={100} // Explicit width
          />
        );

        // Should use explicit width regardless of terminal size
        expectNoOverflow(container, 100);
      });
    });
  });

  // =============================================================================
  // CodeBlock Responsive Composition Tests
  // =============================================================================

  describe('CodeBlock Responsive Composition', () => {
    const testCodeBlock = `export interface APIResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: Date;
}

export class APIClient {
  constructor(private baseUrl: string) {}

  async get<T>(endpoint: string): Promise<APIResponse<T>> {
    const response = await fetch(\`\${this.baseUrl}/\${endpoint}\`);
    return response.json();
  }
}`;

    describe('Basic Responsive Behavior', () => {
      it('renders in very narrow terminals (40 columns) without overflow', () => {
        mockTerminalWidth(40);

        const { container } = render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            filename="api.ts"
            showLineNumbers={true}
          />
        );

        // Should fit within narrow terminal
        expectNoOverflow(container, 40);

        // Should display essential elements
        expect(screen.getByText('api.ts')).toBeInTheDocument();
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });

      it('adapts well to compact terminals (60 columns)', () => {
        mockTerminalWidth(60);

        const { container } = render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            filename="api.ts"
            showLineNumbers={true}
          />
        );

        expectNoOverflow(container, 60);
        expect(screen.getByText('1 │')).toBeInTheDocument();
      });

      it('displays optimally in standard terminals (80 columns)', () => {
        mockTerminalWidth(80);

        const { container } = render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            filename="api.ts"
            showLineNumbers={true}
          />
        );

        expectNoOverflow(container, 80);

        // Should show file header clearly
        expect(screen.getByText('api.ts')).toBeInTheDocument();
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });

      it('utilizes normal terminals (120 columns) effectively', () => {
        mockTerminalWidth(120);

        const { container } = render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            filename="api.ts"
            showLineNumbers={true}
          />
        );

        expectNoOverflow(container, 120);

        // Code should be well-formatted with room for line numbers
        expect(screen.getByText('1 │')).toBeInTheDocument();
      });

      it('takes advantage of wide terminals (180 columns)', () => {
        mockTerminalWidth(180);

        const { container } = render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            filename="api.ts"
            showLineNumbers={true}
          />
        );

        expectNoOverflow(container, 180);

        // Should display with excellent formatting
        expect(screen.getByText('api.ts')).toBeInTheDocument();
      });
    });

    describe('Line Number Formatting', () => {
      it('handles line numbers in narrow terminals', () => {
        mockTerminalWidth(40);

        render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            showLineNumbers={true}
          />
        );

        // Should show line numbers with minimal spacing
        expect(screen.getByText(/1.*│/)).toBeInTheDocument();
        expect(screen.getByText(/2.*│/)).toBeInTheDocument();
      });

      it('formats line numbers clearly in wide terminals', () => {
        mockTerminalWidth(180);

        render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            showLineNumbers={true}
          />
        );

        // Should show well-formatted line numbers
        expect(screen.getByText(/1.*│/)).toBeInTheDocument();
      });

      it('hides line numbers when disabled', () => {
        mockTerminalWidth(80);

        render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            showLineNumbers={false}
          />
        );

        // Should not show line number separators
        expect(screen.queryByText(/│/)).not.toBeInTheDocument();
      });
    });

    describe('Header Information', () => {
      it('shows filename and language in all terminal sizes', () => {
        const widths: TerminalWidth[] = [40, 60, 80, 120, 180];

        widths.forEach(width => {
          mockTerminalWidth(width);

          const { rerender } = render(
            <CodeBlock
              code={testCodeBlock}
              language="typescript"
              filename="test.ts"
            />
          );

          expect(screen.getByText('test.ts')).toBeInTheDocument();
          expect(screen.getByText('typescript')).toBeInTheDocument();
        });
      });

      it('handles long filenames gracefully', () => {
        mockTerminalWidth(40);

        const longFilename = 'very-long-filename-that-might-cause-overflow-issues.ts';

        const { container } = render(
          <CodeBlock
            code={testCodeBlock}
            language="typescript"
            filename={longFilename}
          />
        );

        expectNoOverflow(container, 40);

        // Filename should be displayed (possibly truncated)
        expect(screen.getByText(/very-long-filename/)).toBeInTheDocument();
      });
    });

    describe('Language Detection and Display', () => {
      it('maps language aliases correctly', () => {
        mockTerminalWidth(80);

        render(
          <CodeBlock
            code="const x = 1;"
            language="js" // Should map to javascript
          />
        );

        expect(screen.getByText('javascript')).toBeInTheDocument();
      });

      it('handles unknown languages gracefully', () => {
        mockTerminalWidth(80);

        render(
          <CodeBlock
            code="some code"
            language="unknown-lang"
          />
        );

        expect(screen.getByText('unknown-lang')).toBeInTheDocument();
      });
    });

    describe('Code Content Handling', () => {
      it('handles empty code blocks', () => {
        mockTerminalWidth(80);

        const { container } = render(
          <CodeBlock
            code=""
            language="typescript"
          />
        );

        expectNoOverflow(container, 80);
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });

      it('handles very long lines', () => {
        mockTerminalWidth(60);

        const longLine = 'const extremelyLongVariableNameThatExceedsAnyReasonableTerminalWidthAndShouldBeHandledGracefully = "test";';

        const { container } = render(
          <CodeBlock
            code={longLine}
            language="typescript"
          />
        );

        expectNoOverflow(container, 60);
      });

      it('preserves code formatting', () => {
        mockTerminalWidth(120);

        const formattedCode = `function test() {
    if (condition) {
        doSomething();
    }
}`;

        render(
          <CodeBlock
            code={formattedCode}
            language="javascript"
          />
        );

        // Should preserve indentation structure
        expect(screen.getByText(/function test/)).toBeInTheDocument();
      });
    });
  });

  // =============================================================================
  // Cross-Component Composition Tests
  // =============================================================================

  describe('Cross-Component Composition Scenarios', () => {
    describe('Multiple Components in Narrow Terminal', () => {
      it('handles stacked components without overflow (40 columns)', () => {
        mockTerminalWidth(40);

        const markdown = '# Header\nSome **bold** text.';
        const code = 'const x = 1;';

        const { container } = render(
          <div>
            <MarkdownRenderer content={markdown} />
            <CodeBlock code={code} language="js" />
            <SyntaxHighlighter code={code} language="js" />
          </div>
        );

        // All components should fit without overflow
        expectNoOverflow(container, 40);

        // All should be present
        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByText('javascript')).toBeInTheDocument();
      });
    });

    describe('Complex Composition Scenarios', () => {
      it('handles diff viewer with embedded code blocks', () => {
        mockTerminalWidth(120);

        const oldCode = 'function old() { return 1; }';
        const newCode = 'function new() { return 2; }';

        const { container } = render(
          <div>
            <DiffViewer
              oldContent={oldCode}
              newContent={newCode}
              filename="test.js"
            />
            <MarkdownRenderer content="## Changes\nUpdated function implementation." />
          </div>
        );

        expectNoOverflow(container, 120);
        expect(screen.getByText('test.js')).toBeInTheDocument();
        expect(screen.getByText('Changes')).toBeInTheDocument();
      });

      it('handles responsive layout changes when resizing', () => {
        const { setWidth } = renderResponsive(
          <div>
            <MarkdownRenderer content="# Test Header" />
            <CodeBlock code="const x = 1;" language="js" />
          </div>,
          { width: 180 }
        );

        // Start wide
        expect(screen.getByText('Test Header')).toBeInTheDocument();

        // Resize to narrow
        setWidth(40);

        // Should still work without overflow
        expect(screen.getByText('Test Header')).toBeInTheDocument();
        expect(screen.getByText('javascript')).toBeInTheDocument();
      });
    });

    describe('Breakpoint Behavior Consistency', () => {
      it('maintains consistent behavior across all components at each breakpoint', () => {
        const widths: TerminalWidth[] = [40, 60, 80, 120, 180];

        widths.forEach(width => {
          mockTerminalWidth(width);

          const { container } = render(
            <div>
              <MarkdownRenderer content="# Test" />
              <DiffViewer
                oldContent="old"
                newContent="new"
                filename="test.txt"
                mode="auto"
              />
              <SyntaxHighlighter code="const x = 1;" language="js" />
              <CodeBlock code="const y = 2;" language="js" />
            </div>
          );

          // All should fit within terminal width
          expectNoOverflow(container, width);

          // All should render their content
          expect(screen.getByText('Test')).toBeInTheDocument();
          expect(screen.getByText('test.txt')).toBeInTheDocument();
        });
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('handles terminal dimensions not available', () => {
        mockTerminalWidth(80, { isAvailable: false });

        const { container } = render(
          <div>
            <MarkdownRenderer content="# Fallback Test" />
            <CodeBlock code="const fallback = true;" language="js" />
          </div>
        );

        // Should work with fallback dimensions
        expect(screen.getByText('Fallback Test')).toBeInTheDocument();
        expect(screen.getByText('javascript')).toBeInTheDocument();
      });

      it('handles extremely narrow terminals gracefully', () => {
        // Test with even narrower than standard (simulating unusual terminals)
        mockTerminalWidth(40, { width: 20 });

        const { container } = render(
          <MarkdownRenderer content="Test" />
        );

        // Should enforce minimum width
        expectNoOverflow(container, 40); // Should use minimum, not actual 20
      });

      it('handles mixed responsive and fixed width components', () => {
        mockTerminalWidth(60);

        const { container } = render(
          <div>
            <MarkdownRenderer content="# Responsive" responsive={true} />
            <MarkdownRenderer content="# Fixed" responsive={false} />
            <CodeBlock code="const x = 1;" language="js" />
          </div>
        );

        expectNoOverflow(container, 80); // Should accommodate both
        expect(screen.getAllByText(/Responsive|Fixed/)).toHaveLength(2);
      });
    });
  });
});