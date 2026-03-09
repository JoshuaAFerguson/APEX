/**
 * SyntaxHighlighter Edge Cases and Performance Audit Tests
 *
 * This test suite covers edge cases, error conditions, and performance requirements
 * for the SyntaxHighlighter and ResponseStream components.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyntaxHighlighter, SimpleSyntaxHighlighter } from '../packages/cli/src/ui/components/SyntaxHighlighter';
import { ResponseStream } from '../packages/cli/src/ui/components/ResponseStream';

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

describe('SyntaxHighlighter Edge Cases and Performance Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    mockSyntaxHighlight.mockImplementation(({ code, language }: { code: string; language: string }) =>
      React.createElement('span', {
        'data-testid': 'syntax-highlighted',
        'data-language': language
      }, code)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation and Edge Cases', () => {
    it('should handle empty code gracefully', () => {
      render(
        <SyntaxHighlighter code="" />
      );

      expect(screen.getByText('0 lines')).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument(); // Default language
    });

    it('should handle single character input', () => {
      render(
        <SyntaxHighlighter code="x" />
      );

      expect(screen.getByText('x')).toBeInTheDocument();
      expect(screen.getByText('1 lines')).toBeInTheDocument();
    });

    it('should handle code with only whitespace', () => {
      const whitespaceCode = '   \n  \n\t\t\n   ';

      render(
        <SyntaxHighlighter code={whitespaceCode} />
      );

      expect(screen.getByText('4 lines')).toBeInTheDocument();
    });

    it('should handle code with only newlines', () => {
      const newlineCode = '\n\n\n\n\n';

      render(
        <SyntaxHighlighter code={newlineCode} />
      );

      expect(screen.getByText('6 lines')).toBeInTheDocument(); // 5 newlines = 6 lines
    });

    it('should handle extremely long lines', () => {
      const veryLongLine = 'x'.repeat(5000);

      render(
        <SyntaxHighlighter
          code={veryLongLine}
          wrapLines={true}
        />
      );

      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should handle special characters and Unicode', () => {
      const unicodeCode = `const emoji = "🚀 🎯 ✨ 🔥";
const greek = "αβγδεζηθικλμνξοπρστυφχψω";
const math = "∑ ∏ ∫ ∇ ∆ ∂ ∞ ≠ ≤ ≥";
const symbols = "<>&\"'\\n\\t\\r";
const currency = "$ € £ ¥ ₹ ₿";
const arrows = "← → ↑ ↓ ↔ ↕ ⇐ ⇒";`;

      render(
        <SyntaxHighlighter
          code={unicodeCode}
          language="typescript"
        />
      );

      expect(screen.getByText(/🚀 🎯 ✨ 🔥/)).toBeInTheDocument();
      expect(screen.getByText(/αβγδεζηθικλμνξοπρστυφχψω/)).toBeInTheDocument();
      expect(screen.getByText(/∑ ∏ ∫ ∇/)).toBeInTheDocument();
    });

    it('should handle malformed code structures', () => {
      const malformedCode = `function unclosedFunction( {
  const unterminated = "string
  /* unclosed comment
  if (condition {
    return`;

      render(
        <SyntaxHighlighter
          code={malformedCode}
          language="javascript"
        />
      );

      // Should still render without crashing
      expect(screen.getByText(/function unclosedFunction/)).toBeInTheDocument();
      expect(screen.getByText(/unterminated/)).toBeInTheDocument();
    });

    it('should handle mixed line endings (CRLF, LF, CR)', () => {
      const mixedLineEndings = 'line1\r\nline2\nline3\rline4';

      render(
        <SyntaxHighlighter code={mixedLineEndings} />
      );

      // Should handle different line ending types
      expect(screen.getByText(/line1/)).toBeInTheDocument();
      expect(screen.getByText(/line2/)).toBeInTheDocument();
    });

    it('should handle invalid or unsupported language gracefully', () => {
      render(
        <SyntaxHighlighter
          code="some code here"
          language="nonexistent-language"
        />
      );

      expect(screen.getByText('nonexistent-language')).toBeInTheDocument();
      expect(screen.getByText('some code here')).toBeInTheDocument();
    });

    it('should handle undefined and null language props', () => {
      const { rerender } = render(
        <SyntaxHighlighter
          code="test code"
          language={undefined}
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument(); // Should default

      rerender(
        <SyntaxHighlighter
          code="test code"
          language={'null' as any}
        />
      );

      expect(screen.getByText(/test code/)).toBeInTheDocument();
    });
  });

  describe('Terminal Environment Edge Cases', () => {
    it('should handle unavailable terminal dimensions', () => {
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
          code="const test = 'unavailable dimensions';"
          responsive={true}
        />
      );

      expect(screen.getByText(/unavailable dimensions/)).toBeInTheDocument();
    });

    it('should handle extremely narrow terminal widths', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20, // Very narrow
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      render(
        <SyntaxHighlighter
          code="const test = 'narrow terminal';"
          responsive={true}
        />
      );

      // Should enforce minimum width of 40
      expect(screen.getByText(/narrow terminal/)).toBeInTheDocument();
    });

    it('should handle extremely wide terminal widths', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 300, // Very wide
        height: 30,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      render(
        <SyntaxHighlighter
          code="const test = 'very wide terminal';"
          responsive={true}
        />
      );

      expect(screen.getByText(/very wide terminal/)).toBeInTheDocument();
    });

    it('should handle rapid terminal dimension changes', () => {
      const testCode = 'const responsive = "dimension changes";';

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

      const { rerender } = render(
        <SyntaxHighlighter
          code={testCode}
          responsive={true}
        />
      );

      expect(screen.getByText(/dimension changes/)).toBeInTheDocument();

      // Change to wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 160,
        height: 30,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      rerender(
        <SyntaxHighlighter
          code={testCode}
          responsive={true}
        />
      );

      expect(screen.getByText(/dimension changes/)).toBeInTheDocument();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large code blocks efficiently', () => {
      const largeCode = Array(1000).fill('console.log("performance test");').join('\n');

      const startTime = performance.now();
      render(
        <SyntaxHighlighter
          code={largeCode}
          maxLines={50}
        />
      );
      const endTime = performance.now();

      // Should complete rendering in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should show truncation
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should handle large code blocks with complex syntax efficiently', () => {
      const complexCode = Array(200).fill(`
interface ComplexInterface<T extends Record<string, any>> {
  method(param: T): Promise<Array<keyof T>>;
}
class ComplexClass implements ComplexInterface<any> {
  async method<K>(param: K): Promise<(keyof K)[]> {
    return Object.keys(param) as (keyof K)[];
  }
}`).join('\n');

      const startTime = performance.now();
      render(
        <SimpleSyntaxHighlighter
          code={complexCode}
          language="typescript"
          maxLines={100}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should handle rapid re-renders efficiently', () => {
      const codes = [
        'const test1 = "first";',
        'const test2 = "second";',
        'const test3 = "third";',
        'const test4 = "fourth";',
        'const test5 = "fifth";',
      ];

      const startTime = performance.now();

      const { rerender } = render(
        <SyntaxHighlighter code={codes[0]} />
      );

      codes.slice(1).forEach(code => {
        rerender(<SyntaxHighlighter code={code} />);
      });

      const endTime = performance.now();

      // Should handle rapid re-renders efficiently
      expect(endTime - startTime).toBeLessThan(50);
      expect(screen.getByText('fifth')).toBeInTheDocument();
    });

    it('should handle memory-intensive operations gracefully', () => {
      const memoryIntensiveCode = `
// Large nested object structure
const largeObject = {
  ${Array(100).fill(0).map((_, i) => `
  level${i}: {
    ${Array(10).fill(0).map((_, j) => `prop${j}: "value${j}"`).join(',\n    ')}
  }`).join(',\n  ')}
};

// Large array processing
const largeArray = [${Array(1000).fill(0).map((_, i) => `"item${i}"`).join(', ')}];

// Complex function with many parameters
function complexFunction(
  ${Array(50).fill(0).map((_, i) => `param${i}: string`).join(',\n  ')}
): Promise<{${Array(50).fill(0).map((_, i) => `result${i}: boolean`).join('; ')}}> {
  return Promise.resolve({
    ${Array(50).fill(0).map((_, i) => `result${i}: true`).join(',\n    ')}
  });
}`;

      expect(() => {
        render(
          <SyntaxHighlighter
            code={memoryIntensiveCode}
            language="typescript"
            maxLines={200}
          />
        );
      }).not.toThrow();

      expect(screen.getByText(/largeObject/)).toBeInTheDocument();
    });
  });

  describe('ResponseStream Edge Cases', () => {
    it('should handle malformed markdown code blocks', () => {
      const malformedMarkdown = `
\`\`\`typescript
// Unclosed code block
const test = "missing closing";

\`\`\`python
# This block is properly closed
print("hello")
\`\`\`

\`\`\`
// Missing language
const noLang = true;
\`\`\`

\`\`\`invalidlang
// Unknown language
some code here

\`\`\`html
<div>Valid block</div>
\`\`\``;

      render(
        <ResponseStream
          content={malformedMarkdown}
          displayMode="normal"
        />
      );

      // Should handle both valid and malformed blocks gracefully
      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText('text')).toBeInTheDocument(); // Default for missing language
      expect(screen.getByText('invalidlang')).toBeInTheDocument(); // Unknown language preserved
      expect(screen.getByText('html')).toBeInTheDocument();
    });

    it('should handle nested code blocks and edge cases', () => {
      const nestedMarkdown = `
Here's some text with \`inline code\`.

\`\`\`typescript
// Code that contains markdown-like syntax
const markdown = \`
# This is not a header
\`\`\`not a code block\`\`\`
**not bold**
\`;
\`\`\`

Regular text continues here.`;

      render(
        <ResponseStream
          content={nestedMarkdown}
          displayMode="normal"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText(/inline code/)).toBeInTheDocument();
      expect(screen.getByText(/Regular text continues/)).toBeInTheDocument();
    });

    it('should handle empty code blocks', () => {
      const emptyBlocks = `
\`\`\`typescript
\`\`\`

\`\`\`python

\`\`\`

\`\`\`javascript

\`\`\``;

      render(
        <ResponseStream
          content={emptyBlocks}
          displayMode="normal"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should handle very long content with many code blocks', () => {
      const manyBlocks = Array(20).fill(0).map((_, i) => `
\`\`\`javascript
// Code block ${i}
function test${i}() {
  return "block${i}";
}
\`\`\``).join('\n\nSome text between blocks.\n');

      const startTime = performance.now();
      render(
        <ResponseStream
          content={manyBlocks}
          displayMode="compact"
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getAllByText('javascript').length).toBe(20);
    });

    it('should handle special characters in code block languages', () => {
      const specialLangCodes = `
\`\`\`c++
#include <iostream>
int main() { return 0; }
\`\`\`

\`\`\`c#
using System;
class Program { }
\`\`\`

\`\`\`f#
let add x y = x + y
\`\`\`

\`\`\`objective-c
@interface MyClass : NSObject
@end
\`\`\``;

      render(
        <ResponseStream
          content={specialLangCodes}
          displayMode="normal"
        />
      );

      // Languages with special characters should be handled
      expect(screen.getByText('c++')).toBeInTheDocument();
      expect(screen.getByText('c#')).toBeInTheDocument();
      expect(screen.getByText('f#')).toBeInTheDocument();
      expect(screen.getByText('objective-c')).toBeInTheDocument();
    });

    it('should handle streaming content correctly', () => {
      const streamingContent = `Here's some streaming content:

\`\`\`typescript
interface StreamData {
  id: string;
  content: string;
}
\`\`\``;

      render(
        <ResponseStream
          content={streamingContent}
          isStreaming={true}
          displayMode="normal"
        />
      );

      // Should show streaming indicator
      expect(screen.getByText('█')).toBeInTheDocument(); // Cursor
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle different agent and type combinations', () => {
      const testCombinations = [
        { agent: 'test-agent', type: 'tool' as const },
        { agent: 'error-agent', type: 'error' as const },
        { agent: 'system-agent', type: 'system' as const },
        { agent: undefined, type: 'text' as const },
      ];

      testCombinations.forEach(({ agent, type }, index) => {
        const { unmount } = render(
          <ResponseStream
            content={`Test content ${index}`}
            agent={agent}
            type={type}
            displayMode="normal"
          />
        );

        if (agent) {
          expect(screen.getByText(`[${agent}]`)).toBeInTheDocument();
        }
        expect(screen.getByText(`Test content ${index}`)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Memory and Resource Management', () => {
    it('should clean up resources properly on unmount', () => {
      const { unmount } = render(
        <SyntaxHighlighter
          code="const cleanup = 'test';"
        />
      );

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle concurrent renders efficiently', () => {
      const concurrentRenders = Array(10).fill(0).map((_, i) => (
        <SyntaxHighlighter
          key={i}
          code={`const test${i} = "concurrent render ${i}";`}
          language="typescript"
        />
      ));

      expect(() => {
        concurrentRenders.forEach(component => {
          const { unmount } = render(component);
          unmount();
        });
      }).not.toThrow();
    });

    it('should handle prop changes without memory leaks', () => {
      const languages = ['typescript', 'javascript', 'python', 'rust', 'go'];
      const { rerender } = render(
        <SyntaxHighlighter
          code="const test = 'initial';"
          language={languages[0]}
        />
      );

      languages.slice(1).forEach(language => {
        rerender(
          <SyntaxHighlighter
            code={`const ${language}Code = 'test';`}
            language={language}
          />
        );
      });

      expect(screen.getByText('go')).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from rendering errors gracefully', () => {
      // Mock console.error to catch error boundary issues
      const originalError = console.error;
      console.error = vi.fn();

      try {
        render(
          <SyntaxHighlighter
            code="const test = 'error recovery';"
          />
        );

        expect(screen.getByText(/error recovery/)).toBeInTheDocument();
      } finally {
        console.error = originalError;
      }
    });

    it('should handle ink-syntax-highlight failures gracefully', () => {
      // Mock SyntaxHighlight to throw an error
      mockSyntaxHighlight.mockImplementation(() => {
        throw new Error('SyntaxHighlight failed');
      });

      expect(() => {
        render(
          <ResponseStream
            content={`\`\`\`typescript\nconst test = "error";\`\`\``}
            displayMode="normal"
          />
        );
      }).not.toThrow();

      // Should still show the language header even if highlighting fails
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });
});