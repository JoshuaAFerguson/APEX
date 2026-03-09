import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyntaxHighlighter, SimpleSyntaxHighlighter } from '../packages/cli/src/ui/components/SyntaxHighlighter';
import { ResponseStream } from '../packages/cli/src/ui/components/ResponseStream';

/**
 * V0.6.0 SyntaxHighlighter Edge Cases and Error Handling Tests
 *
 * These tests verify robust handling of edge cases, error conditions,
 * and stress scenarios for the SyntaxHighlighter components.
 */

// Mock dependencies
const mockUseStdoutDimensions = vi.fn();
vi.mock('../packages/cli/src/ui/hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

const mockSyntaxHighlight = vi.fn();
vi.mock('ink-syntax-highlight', () => ({
  default: mockSyntaxHighlight,
}));

describe('V0.6.0 SyntaxHighlighter Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    mockSyntaxHighlight.mockImplementation(({ code }: { code: string }) =>
      React.createElement('span', { 'data-testid': 'syntax-highlight' }, code)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation and Sanitization', () => {
    it('should handle null and undefined code gracefully', () => {
      const testCases = [
        { code: null as any, expected: '0 lines' },
        { code: undefined as any, expected: '0 lines' },
      ];

      testCases.forEach(({ code, expected }) => {
        expect(() => {
          render(<SyntaxHighlighter code={code} />);
        }).not.toThrow();

        if (expected) {
          expect(screen.getByText(expected)).toBeInTheDocument();
        }
      });
    });

    it('should handle non-string code values', () => {
      const nonStringValues = [
        { code: 42 as any, description: 'number' },
        { code: true as any, description: 'boolean' },
        { code: {} as any, description: 'object' },
        { code: [] as any, description: 'array' },
      ];

      nonStringValues.forEach(({ code, description }) => {
        expect(() => {
          render(<SyntaxHighlighter code={code} />);
        }).not.toThrow();
      });
    });

    it('should handle extremely long code without memory issues', () => {
      // Create a 1MB string
      const hugeLine = 'x'.repeat(1024 * 1024);
      const hugeCode = Array(100).fill(hugeLine).join('\\n');

      expect(() => {
        render(
          <SyntaxHighlighter
            code={hugeCode}
            maxLines={10} // Limit rendering
          />
        );
      }).not.toThrow();

      // Should show truncation
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should handle malicious input attempts', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '${process.exit(1)}',
        '\\x00\\x01\\x02', // Null bytes and control characters
        'eval("malicious code")',
        '"><script>alert(1)</script>',
      ];

      maliciousInputs.forEach(maliciousCode => {
        expect(() => {
          render(<SyntaxHighlighter code={maliciousCode} />);
        }).not.toThrow();

        // Should render as plain text, not execute
        expect(screen.getByText(new RegExp(maliciousCode.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))).toBeInTheDocument();
      });
    });
  });

  describe('Terminal Dimension Edge Cases', () => {
    it('should handle zero terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 0,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: false,
      });

      expect(() => {
        render(
          <SyntaxHighlighter
            code="const test = 'zero width';"
            responsive={true}
          />
        );
      }).not.toThrow();

      // Should use minimum width
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle negative terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: -50,
        height: -20,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      expect(() => {
        render(
          <SyntaxHighlighter
            code="const test = 'negative dimensions';"
            responsive={true}
          />
        );
      }).not.toThrow();

      // Should fallback to minimum width
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle extremely large terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 999999,
        height: 999999,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        isAvailable: true,
      });

      expect(() => {
        render(
          <SyntaxHighlighter
            code="const test = 'huge terminal';"
            responsive={true}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle missing terminal dimension hook', () => {
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook not available');
      });

      expect(() => {
        render(
          <SyntaxHighlighter
            code="const test = 'hook error';"
            responsive={true}
          />
        );
      }).toThrow(); // Should propagate hook errors for debugging
    });
  });

  describe('Language and Syntax Edge Cases', () => {
    it('should handle unsupported languages gracefully', () => {
      const unsupportedLanguages = [
        'nonexistent',
        'fakeLang',
        '../../etc/passwd', // Path injection attempt
        '<script>',         // HTML injection attempt
        'null',
        'undefined',
      ];

      unsupportedLanguages.forEach(language => {
        expect(() => {
          render(
            <SimpleSyntaxHighlighter
              code="const test = 'unsupported';"
              language={language}
            />
          );
        }).not.toThrow();

        expect(screen.getByText(language)).toBeInTheDocument();
      });
    });

    it('should handle extremely nested code structures', () => {
      const deeplyNested = Array(1000).fill(0).reduce((acc, _) => `{${acc}}`, 'center');

      expect(() => {
        render(
          <SyntaxHighlighter
            code={deeplyNested}
            maxLines={10}
          />
        );
      }).not.toThrow();

      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should handle code with mixed line endings', () => {
      const mixedLineEndings = 'line1\\r\\nline2\\nline3\\rline4';

      expect(() => {
        render(<SyntaxHighlighter code={mixedLineEndings} />);
      }).not.toThrow();

      // Should handle different line ending types
      expect(screen.getByText(/lines/)).toBeInTheDocument();
    });

    it('should handle binary and non-text content', () => {
      const binaryLike = '\\x00\\x01\\xFF\\xDEADBEEF';
      const nonText = String.fromCharCode(0, 1, 2, 255, 254, 253);

      [binaryLike, nonText].forEach(content => {
        expect(() => {
          render(<SyntaxHighlighter code={content} />);
        }).not.toThrow();
      });
    });
  });

  describe('Line Wrapping Edge Cases', () => {
    it('should handle lines with no break points', () => {
      const noBreakPoints = 'x'.repeat(200); // No spaces or punctuation

      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      });

      expect(() => {
        render(
          <SyntaxHighlighter
            code={noBreakPoints}
            wrapLines={true}
          />
        );
      }).not.toThrow();

      // Should still wrap, even without ideal break points
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should handle lines shorter than minimum wrap length', () => {
      const shortLine = 'x';

      expect(() => {
        render(
          <SyntaxHighlighter
            code={shortLine}
            wrapLines={true}
          />
        );
      }).not.toThrow();

      // Should not show wrapped indicator for short lines
      expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
    });

    it('should handle wrapping with extreme terminal sizes', () => {
      const testCases = [
        { width: 1, description: 'single character width' },
        { width: 5, description: 'very narrow' },
        { width: 10000, description: 'extremely wide' },
      ];

      testCases.forEach(({ width, description }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: width < 40 ? 'narrow' : 'wide',
          isNarrow: width < 40,
          isCompact: false,
          isNormal: false,
          isWide: width > 140,
          isAvailable: true,
        });

        expect(() => {
          render(
            <SyntaxHighlighter
              code="const reallyLongVariableNameThatWillTestWrapping = 'test';"
              wrapLines={true}
            />
          );
        }, description).not.toThrow();
      });
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle rapid re-renders without memory leaks', () => {
      const { rerender } = render(<SyntaxHighlighter code="initial" />);

      // Simulate rapid prop changes
      for (let i = 0; i < 100; i++) {
        rerender(
          <SyntaxHighlighter
            code={`iteration ${i}`}
            language={i % 2 === 0 ? 'javascript' : 'typescript'}
            showLineNumbers={i % 2 === 0}
            wrapLines={i % 3 === 0}
          />
        );
      }

      expect(screen.getByText(/iteration 99/)).toBeInTheDocument();
    });

    it('should handle concurrent renders', async () => {
      const promises = Array(10).fill(0).map((_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            render(
              <SyntaxHighlighter
                code={`concurrent ${i}`}
                key={`concurrent-${i}`}
              />
            );
            resolve();
          }, Math.random() * 10);
        })
      );

      await Promise.all(promises);
      expect(screen.getByText(/concurrent/)).toBeInTheDocument();
    });

    it('should handle extremely large line counts', () => {
      const manyLines = Array(50000).fill('console.log("line");').join('\\n');

      const startTime = performance.now();
      render(
        <SyntaxHighlighter
          code={manyLines}
          maxLines={100} // Limit for performance
        />
      );
      const endTime = performance.now();

      // Should complete in reasonable time even with huge input
      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });
  });

  describe('ResponseStream Edge Cases', () => {
    it('should handle malformed markdown code blocks', () => {
      const malformedBlocks = [
        '\\`\\`\\`typescript\\ncode without closing',
        '\\`\\`\\`\\nno language specified',
        '\\`\\`\\`invalid-lang-123\\ncode\\`\\`\\`',
        'text \\`\\`\\`mixed\\ncode\\`\\`\\` text',
        '\\`\\`\\`nested \\`\\`\\` blocks\\`\\`\\`',
      ];

      malformedBlocks.forEach(content => {
        expect(() => {
          render(
            <ResponseStream
              content={content}
              displayMode="normal"
            />
          );
        }).not.toThrow();
      });
    });

    it('should handle extremely nested markdown structures', () => {
      const deepMarkdown = Array(100).fill(0).reduce((acc, _) =>
        `> ${acc}\\n> \\`\\`\\`typescript\\n> const nested = true;\\n> \\`\\`\\``, 'base'
      );

      expect(() => {
        render(
          <ResponseStream
            content={deepMarkdown}
            displayMode="normal"
          />
        );
      }).not.toThrow();
    });

    it('should handle content with mixed encodings', () => {
      const mixedContent = `
\\`\\`\\`typescript
const emoji = "🚀⚡💡";
const chinese = "你好世界";
const arabic = "مرحبا بالعالم";
const russian = "Привет мир";
\\`\\`\\``;

      expect(() => {
        render(
          <ResponseStream
            content={mixedContent}
            displayMode="normal"
          />
        );
      }).not.toThrow();

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle ink-syntax-highlight errors gracefully', () => {
      mockSyntaxHighlight.mockImplementation(() => {
        throw new Error('Syntax highlighting failed');
      });

      expect(() => {
        render(
          <ResponseStream
            content="\\`\\`\\`javascript\\nconsole.log('test');\\n\\`\\`\\`"
            displayMode="normal"
          />
        );
      }).toThrow(); // Should propagate highlighting errors for debugging
    });
  });

  describe('Component Lifecycle Edge Cases', () => {
    it('should handle unmounting during rendering', () => {
      const { unmount } = render(
        <SyntaxHighlighter code="const test = 'unmount';" />
      );

      // Should unmount without errors
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle prop changes during render', () => {
      const TestComponent = () => {
        const [code, setCode] = React.useState('initial');
        const [showLines, setShowLines] = React.useState(true);

        React.useEffect(() => {
          // Simulate rapid prop changes
          const interval = setInterval(() => {
            setCode(prev => prev + ' updated');
            setShowLines(prev => !prev);
          }, 1);

          setTimeout(() => clearInterval(interval), 10);

          return () => clearInterval(interval);
        }, []);

        return (
          <SyntaxHighlighter
            code={code}
            showLineNumbers={showLines}
          />
        );
      };

      expect(() => {
        render(<TestComponent />);
      }).not.toThrow();
    });

    it('should handle context changes gracefully', () => {
      const ContextProvider = ({ children }: { children: React.ReactNode }) => {
        const [value, setValue] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => setValue(prev => prev + 1), 1);
          setTimeout(() => clearInterval(interval), 10);
          return () => clearInterval(interval);
        }, []);

        return (
          <div data-context-value={value}>
            {children}
          </div>
        );
      };

      expect(() => {
        render(
          <ContextProvider>
            <SyntaxHighlighter code="const contextTest = 'test';" />
          </ContextProvider>
        );
      }).not.toThrow();
    });
  });

  describe('Cross-Platform Edge Cases', () => {
    it('should handle different text encodings', () => {
      const encodings = [
        'UTF-8: 你好',
        'Latin-1: café',
        'Cyrillic: привет',
        'Arabic: مرحبا',
        'Hebrew: שלום',
      ];

      encodings.forEach(text => {
        expect(() => {
          render(<SyntaxHighlighter code={text} />);
        }).not.toThrow();
      });
    });

    it('should handle platform-specific line endings consistently', () => {
      const platforms = [
        { name: 'Unix/Linux', ending: '\\n' },
        { name: 'Windows', ending: '\\r\\n' },
        { name: 'Classic Mac', ending: '\\r' },
        { name: 'Mixed', ending: '\\r\\n\\n\\r' },
      ];

      platforms.forEach(({ name, ending }) => {
        const code = `line1${ending}line2${ending}line3`;

        expect(() => {
          render(
            <SyntaxHighlighter
              code={code}
              data-testid={`platform-${name}`}
            />
          );
        }, name).not.toThrow();
      });
    });

    it('should handle different terminal color capabilities', () => {
      const colorTests = [
        { colors: true, description: 'full color support' },
        { colors: false, description: 'no color support' },
      ];

      colorTests.forEach(({ colors, description }) => {
        // Mock color detection
        const originalEnv = process.env.FORCE_COLOR;
        process.env.FORCE_COLOR = colors ? '1' : '0';

        try {
          expect(() => {
            render(
              <SimpleSyntaxHighlighter
                code="const colorTest = 'test';"
                language="javascript"
              />
            );
          }, description).not.toThrow();
        } finally {
          process.env.FORCE_COLOR = originalEnv;
        }
      });
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    it('should not leak event listeners', () => {
      const initialListeners = process.listenerCount('beforeExit');

      const { unmount } = render(
        <SyntaxHighlighter code="const cleanup = 'test';" />
      );

      unmount();

      const finalListeners = process.listenerCount('beforeExit');
      expect(finalListeners).toBe(initialListeners);
    });

    it('should handle garbage collection appropriately', () => {
      // Create many components to test memory management
      const components = Array(100).fill(0).map((_, i) => (
        <SyntaxHighlighter
          key={i}
          code={`const test${i} = 'memory test';`}
        />
      ));

      expect(() => {
        render(<div>{components}</div>);
      }).not.toThrow();
    });

    it('should handle interrupted rendering', () => {
      const InterruptComponent = () => {
        const [shouldRender, setShouldRender] = React.useState(true);

        React.useEffect(() => {
          // Interrupt rendering after a brief moment
          setTimeout(() => setShouldRender(false), 1);
        }, []);

        return shouldRender ? (
          <SyntaxHighlighter code="const interrupted = 'test';" />
        ) : null;
      };

      expect(() => {
        render(<InterruptComponent />);
      }).not.toThrow();
    });
  });
});