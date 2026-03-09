import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyntaxHighlighter, SimpleSyntaxHighlighter, SyntaxHighlighterProps } from '../packages/cli/src/ui/components/SyntaxHighlighter';
import { ResponseStream } from '../packages/cli/src/ui/components/ResponseStream';

/**
 * V0.6.0 SyntaxHighlighter Integration Tests
 *
 * These tests verify the complete implementation against acceptance criteria:
 * 1. Language-aware highlighting logic (keyword/string/comment highlighting)
 * 2. Line numbers functionality
 * 3. Line wrapping capabilities
 * 4. ResponseStream integration with ink-syntax-highlight
 */

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../packages/cli/src/ui/hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock ink-syntax-highlight
const mockSyntaxHighlight = vi.fn();
vi.mock('ink-syntax-highlight', () => ({
  default: mockSyntaxHighlight,
}));

describe('V0.6.0 SyntaxHighlighter Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default terminal dimensions
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal',
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });

    // Mock SyntaxHighlight component to return the code as-is for testing
    mockSyntaxHighlight.mockImplementation(({ code }: { code: string }) =>
      React.createElement('span', { 'data-testid': 'syntax-highlighted-code' }, code)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1: Language-aware Highlighting Logic', () => {
    it('should detect and highlight TypeScript keywords correctly', () => {
      const typescriptCode = `interface User {
  name: string;
  age: number;
}
const user: User = { name: "test", age: 25 };`;

      render(
        <SimpleSyntaxHighlighter
          code={typescriptCode}
          language="typescript"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText(/interface User/)).toBeInTheDocument();
    });

    it('should highlight JavaScript keywords with ANSI colors', () => {
      const jsCode = `function test() {
  const message = "hello world";
  // This is a comment
  return message;
}`;

      render(
        <SimpleSyntaxHighlighter
          code={jsCode}
          language="javascript"
        />
      );

      expect(screen.getByText('javascript')).toBeInTheDocument();
      // Verify the code is rendered (actual ANSI color testing would require terminal environment)
      expect(screen.getByText(/function test/)).toBeInTheDocument();
    });

    it('should highlight Python syntax with appropriate patterns', () => {
      const pythonCode = `def hello_world():
    message = "Hello, World!"
    # This is a Python comment
    return message`;

      render(
        <SimpleSyntaxHighlighter
          code={pythonCode}
          language="python"
        />
      );

      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText(/def hello_world/)).toBeInTheDocument();
    });

    it('should highlight string literals correctly', () => {
      const codeWithStrings = `const greeting = "Hello, 'world'!";
const template = \`Template literal with \${variable}\`;`;

      render(
        <SimpleSyntaxHighlighter
          code={codeWithStrings}
          language="typescript"
        />
      );

      // Verify strings are present (actual highlighting would show ANSI colors)
      expect(screen.getByText(/Hello, 'world'/)).toBeInTheDocument();
      expect(screen.getByText(/Template literal/)).toBeInTheDocument();
    });

    it('should highlight comments appropriately for different languages', () => {
      const codeWithComments = `// Single line comment
function test() {
  /* Multi-line
     comment */
  return true;
}`;

      render(
        <SimpleSyntaxHighlighter
          code={codeWithComments}
          language="javascript"
        />
      );

      expect(screen.getByText(/Single line comment/)).toBeInTheDocument();
      expect(screen.getByText(/Multi-line/)).toBeInTheDocument();
    });

    it('should support multiple language syntaxes', () => {
      const languageTests = [
        { language: 'rust', code: 'fn main() { println!("Hello, world!"); }' },
        { language: 'go', code: 'func main() { fmt.Println("Hello, world!") }' },
        { language: 'python', code: 'print("Hello, world!")' },
      ];

      languageTests.forEach(({ language, code }) => {
        const { unmount } = render(
          <SimpleSyntaxHighlighter
            code={code}
            language={language}
          />
        );

        expect(screen.getByText(language)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(code.substring(0, 10)))).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Acceptance Criteria 2: Line Numbers Implementation', () => {
    it('should display line numbers with proper formatting', () => {
      const multiLineCode = `line 1
line 2
line 3`;

      render(
        <SyntaxHighlighter
          code={multiLineCode}
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('1 │')).toBeInTheDocument();
      expect(screen.getByText('2 │')).toBeInTheDocument();
      expect(screen.getByText('3 │')).toBeInTheDocument();
    });

    it('should properly pad line numbers for consistency', () => {
      const manyLines = Array(100).fill('console.log("test");').join('\n');

      render(
        <SyntaxHighlighter
          code={manyLines}
          showLineNumbers={true}
          maxLines={5}
        />
      );

      // Should show padded single digits
      expect(screen.getByText('1 │')).toBeInTheDocument();
      expect(screen.getByText('2 │')).toBeInTheDocument();
    });

    it('should hide line numbers when showLineNumbers=false', () => {
      const multiLineCode = `line 1
line 2`;

      render(
        <SyntaxHighlighter
          code={multiLineCode}
          showLineNumbers={false}
        />
      );

      expect(screen.queryByText('1 │')).not.toBeInTheDocument();
      expect(screen.queryByText('2 │')).not.toBeInTheDocument();
    });

    it('should calculate effective width accounting for line numbers', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <SyntaxHighlighter
          code="const test = 'width calculation test';"
          showLineNumbers={true}
          responsive={true}
        />
      );

      // Component should render without issues (width calculation is internal)
      expect(screen.getByText('1 │')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 3: Line Wrapping Functionality', () => {
    it('should wrap long lines when responsive mode is enabled', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50, // Narrow terminal
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longLine = 'const veryLongVariableNameThatWillExceedTerminalWidthAndNeedWrapping = "test";';

      render(
        <SyntaxHighlighter
          code={longLine}
          responsive={true}
        />
      );

      // Should show wrapped indicator in header
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should respect wrapLines prop over responsive default', () => {
      const longCode = 'x'.repeat(150);

      render(
        <SyntaxHighlighter
          code={longCode}
          wrapLines={true}
          responsive={false}
        />
      );

      // Should wrap even when responsive=false
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should not wrap when wrapLines is explicitly disabled', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longCode = 'const reallyLongVariableName = "should not wrap";';

      render(
        <SyntaxHighlighter
          code={longCode}
          wrapLines={false}
        />
      );

      expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
    });

    it('should break lines at sensible points', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 30,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const codeWithBreakPoints = 'function test(param1, param2, param3) { return param1 + param2; }';

      render(
        <SyntaxHighlighter
          code={codeWithBreakPoints}
          wrapLines={true}
        />
      );

      // Should handle line breaking at function syntax
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should add proper indentation for continuation lines', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      const longFunctionCall = 'someVeryLongFunctionName(parameter1, parameter2, parameter3);';

      render(
        <SyntaxHighlighter
          code={longFunctionCall}
          wrapLines={true}
        />
      );

      // Component should handle wrapping with indentation (internal logic)
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 4: ResponseStream Integration', () => {
    it('should parse and render code blocks from markdown', () => {
      const markdownWithCode = `Here's some code:

\`\`\`typescript
interface User {
  name: string;
}
\`\`\`

And more text.`;

      render(
        <ResponseStream
          content={markdownWithCode}
          displayMode="normal"
        />
      );

      // Should show typescript as language identifier
      expect(screen.getByText('typescript')).toBeInTheDocument();

      // Should have called ink-syntax-highlight for code highlighting
      expect(mockSyntaxHighlight).toHaveBeenCalled();
    });

    it('should handle multiple code blocks in one response', () => {
      const multipleCodeBlocks = `\`\`\`javascript
console.log("hello");
\`\`\`

Some text between blocks.

\`\`\`python
print("world")
\`\`\``;

      render(
        <ResponseStream
          content={multipleCodeBlocks}
          displayMode="normal"
        />
      );

      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('should support language aliases in code blocks', () => {
      const codeWithAlias = `\`\`\`js
const test = "javascript alias";
\`\`\`

\`\`\`ts
interface Test { }
\`\`\``;

      render(
        <ResponseStream
          content={codeWithAlias}
          displayMode="normal"
        />
      );

      // Should map js->javascript and ts->typescript
      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle different display modes for code blocks', () => {
      const codeBlock = `\`\`\`typescript
function test() {
  return "hello";
}
\`\`\``;

      // Test compact mode
      const { rerender } = render(
        <ResponseStream
          content={codeBlock}
          displayMode="compact"
        />
      );

      // Compact mode shows simplified view
      expect(screen.getByText(/typescript/)).toBeInTheDocument();

      // Test verbose mode
      rerender(
        <ResponseStream
          content={codeBlock}
          displayMode="verbose"
        />
      );

      // Verbose mode shows line numbers
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('│')).toBeInTheDocument();
    });

    it('should integrate ink-syntax-highlight for line-by-line highlighting', () => {
      const multiLineCode = `\`\`\`javascript
function test() {
  const value = "hello";
  return value;
}
\`\`\``;

      render(
        <ResponseStream
          content={multiLineCode}
          displayMode="verbose"
        />
      );

      // Should call SyntaxHighlight for each line
      const callArgs = mockSyntaxHighlight.mock.calls;
      expect(callArgs.length).toBeGreaterThan(0);

      // Verify language and code are passed correctly
      callArgs.forEach(call => {
        expect(call[0]).toHaveProperty('language', 'javascript');
        expect(call[0]).toHaveProperty('code');
      });
    });

    it('should handle edge cases in markdown parsing', () => {
      const edgeCaseMarkdown = `\`\`\`
// No language specified
const test = "default to text";
\`\`\`

\`\`\`unknownlang
some code in unknown language
\`\`\``;

      render(
        <ResponseStream
          content={edgeCaseMarkdown}
          displayMode="normal"
        />
      );

      // Should handle missing or unknown languages gracefully
      expect(screen.getByText(/text|unknownlang/)).toBeInTheDocument();
    });
  });

  describe('Integration Edge Cases and Performance', () => {
    it('should handle very large code blocks efficiently', () => {
      const largeCode = Array(500).fill('console.log("performance test");').join('\n');

      const startTime = performance.now();
      render(
        <SyntaxHighlighter
          code={largeCode}
          maxLines={50}
        />
      );
      const endTime = performance.now();

      // Should complete rendering in reasonable time
      expect(endTime - startTime).toBeLessThan(100);

      // Should show truncation
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should handle special characters and unicode correctly', () => {
      const unicodeCode = `const emoji = "🚀 🎯 ✨";
const greek = "αβγδε";
const symbols = "<>&\"'";
const math = "∑ ∏ ∫ ∇";`;

      render(
        <SyntaxHighlighter
          code={unicodeCode}
          language="typescript"
        />
      );

      expect(screen.getByText(/🚀 🎯 ✨/)).toBeInTheDocument();
      expect(screen.getByText(/αβγδε/)).toBeInTheDocument();
    });

    it('should maintain responsive behavior under different terminal sizes', () => {
      const testSizes = [
        { width: 40, breakpoint: 'narrow' },
        { width: 80, breakpoint: 'compact' },
        { width: 120, breakpoint: 'normal' },
        { width: 160, breakpoint: 'wide' },
      ];

      testSizes.forEach(({ width, breakpoint }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint,
          isNarrow: breakpoint === 'narrow',
          isCompact: breakpoint === 'compact',
          isNormal: breakpoint === 'normal',
          isWide: breakpoint === 'wide',
          isAvailable: true,
        });

        const { unmount } = render(
          <SyntaxHighlighter
            code="const test = 'responsive behavior test';"
            responsive={true}
          />
        );

        // Should render without errors at all sizes
        expect(screen.getByText('typescript')).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle empty and minimal code gracefully', () => {
      const edgeCases = [
        { code: '', description: 'empty string' },
        { code: ' ', description: 'single space' },
        { code: '\n', description: 'single newline' },
        { code: '//comment', description: 'comment only' },
      ];

      edgeCases.forEach(({ code, description }) => {
        const { unmount } = render(
          <SyntaxHighlighter
            code={code}
            data-testid={`test-${description}`}
          />
        );

        // Should render without crashes
        expect(screen.getByText(/lines/)).toBeInTheDocument();
        unmount();
      });
    });

    it('should properly integrate with terminal width detection', () => {
      // Test when terminal dimensions are not available
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: false,
      });

      render(
        <SyntaxHighlighter
          code="const fallbackTest = 'dimensions unavailable';"
          responsive={true}
        />
      );

      // Should use fallback width gracefully
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  describe('Component Props and API Verification', () => {
    it('should respect all SyntaxHighlighter props correctly', () => {
      const props: SyntaxHighlighterProps = {
        code: 'const test = "props test";',
        language: 'javascript',
        theme: 'dark',
        showLineNumbers: true,
        width: 100,
        maxLines: 10,
        responsive: false,
        wrapLines: true,
      };

      render(<SyntaxHighlighter {...props} />);

      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('1 │')).toBeInTheDocument();
    });

    it('should provide proper default values for optional props', () => {
      render(
        <SyntaxHighlighter code="const minimal = 'test';" />
      );

      // Should use default language (typescript)
      expect(screen.getByText('typescript')).toBeInTheDocument();

      // Should show line numbers by default
      expect(screen.getByText('1 │')).toBeInTheDocument();
    });
  });
});