import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponseStream, ResponseStreamProps } from '../packages/cli/src/ui/components/ResponseStream';

/**
 * V0.6.0 ResponseStream Syntax Highlighting Integration Tests
 *
 * These tests specifically verify the ResponseStream integration with ink-syntax-highlight
 * for code block rendering as required by the acceptance criteria.
 */

// Mock ink-syntax-highlight to verify integration
const mockSyntaxHighlight = vi.fn();
vi.mock('ink-syntax-highlight', () => ({
  default: mockSyntaxHighlight,
}));

describe('V0.6.0 ResponseStream Syntax Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SyntaxHighlight to return code with highlighting data
    mockSyntaxHighlight.mockImplementation(({ language, code }: { language: string; code: string }) =>
      React.createElement(
        'span',
        {
          'data-testid': 'ink-syntax-highlight',
          'data-language': language,
          'data-code': code,
        },
        code
      )
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Code Block Parsing and Rendering', () => {
    it('should parse markdown code blocks and call ink-syntax-highlight', () => {
      const content = `Here's some TypeScript code:

\`\`\`typescript
interface User {
  name: string;
  age: number;
}

const user: User = {
  name: "John",
  age: 30
};
\`\`\`

This completes the example.`;

      render(
        <ResponseStream
          content={content}
          displayMode="normal"
        />
      );

      // Verify ink-syntax-highlight was called for each line
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Check that language was passed correctly
      const calls = mockSyntaxHighlight.mock.calls;
      calls.forEach(call => {
        expect(call[0]).toHaveProperty('language', 'typescript');
        expect(call[0]).toHaveProperty('code');
      });

      // Verify the language header is shown
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle multiple code blocks with different languages', () => {
      const content = `\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

And here's the Python version:

\`\`\`python
def greet(name):
    print(f"Hello, {name}!")
\`\`\`

Finally, some Go:

\`\`\`go
func greet(name string) {
    fmt.Printf("Hello, %s!\\n", name)
}
\`\`\``;

      render(
        <ResponseStream
          content={content}
          displayMode="verbose"
        />
      );

      // Verify all languages were processed
      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText('go')).toBeInTheDocument();

      // Verify ink-syntax-highlight was called with different languages
      const calls = mockSyntaxHighlight.mock.calls;
      const languages = calls.map(call => call[0].language);

      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('go');
    });

    it('should map language aliases correctly before calling ink-syntax-highlight', () => {
      const content = `\`\`\`js
const test = "JavaScript alias";
\`\`\`

\`\`\`ts
interface Test {
  value: string;
}
\`\`\`

\`\`\`py
def hello():
    return "Python alias"
\`\`\`

\`\`\`sh
echo "Shell alias"
\`\`\``;

      render(
        <ResponseStream
          content={content}
          displayMode="normal"
        />
      );

      // Verify language mapping occurred before calling ink-syntax-highlight
      const calls = mockSyntaxHighlight.mock.calls;
      const languages = calls.map(call => call[0].language);

      expect(languages).toContain('javascript'); // js -> javascript
      expect(languages).toContain('typescript'); // ts -> typescript
      expect(languages).toContain('python');     // py -> python
      expect(languages).toContain('bash');       // sh -> bash
    });
  });

  describe('Display Mode Integration', () => {
    const testCodeBlock = `\`\`\`typescript
interface Config {
  apiUrl: string;
  timeout: number;
}

const config: Config = {
  apiUrl: "https://api.example.com",
  timeout: 5000
};

function initialize(config: Config): void {
  // Setup logic here
  console.log("Initializing with config:", config);
}
\`\`\``;

    it('should render code blocks in compact mode without line numbers', () => {
      render(
        <ResponseStream
          content={testCodeBlock}
          displayMode="compact"
        />
      );

      // In compact mode, should show simplified view
      expect(screen.getByText(/typescript/)).toBeInTheDocument();

      // Should not call ink-syntax-highlight in compact mode (uses simplified display)
      expect(mockSyntaxHighlight).not.toHaveBeenCalled();
    });

    it('should render code blocks in normal mode with syntax highlighting', () => {
      render(
        <ResponseStream
          content={testCodeBlock}
          displayMode="normal"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Should not show line numbers in normal mode
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('should render code blocks in verbose mode with line numbers and syntax highlighting', () => {
      render(
        <ResponseStream
          content={testCodeBlock}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Should show line numbers in verbose mode
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('│')).toBeInTheDocument();
    });
  });

  describe('Line-by-Line Processing', () => {
    it('should call ink-syntax-highlight for each line of code', () => {
      const multiLineCode = `\`\`\`javascript
function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

console.log(factorial(5));
\`\`\``;

      render(
        <ResponseStream
          content={multiLineCode}
          displayMode="verbose"
        />
      );

      // Count the number of non-empty lines in the code block
      const codeContent = multiLineCode.match(/```javascript\n([\s\S]*?)\n```/)?.[1] || '';
      const codeLines = codeContent.split('\n').filter(line => line.trim() !== '');

      // Verify ink-syntax-highlight was called for each non-empty line
      expect(mockSyntaxHighlight).toHaveBeenCalledTimes(codeLines.length);

      // Verify each call received the correct parameters
      const calls = mockSyntaxHighlight.mock.calls;
      calls.forEach((call, index) => {
        expect(call[0]).toHaveProperty('language', 'javascript');
        expect(call[0]).toHaveProperty('code');
        expect(typeof call[0].code).toBe('string');
      });
    });

    it('should handle empty lines in code blocks', () => {
      const codeWithEmptyLines = `\`\`\`typescript
function test() {

  const value = "hello";

  return value;

}
\`\`\``;

      render(
        <ResponseStream
          content={codeWithEmptyLines}
          displayMode="verbose"
        />
      );

      // Should handle empty lines gracefully
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Verify empty lines are processed
      const calls = mockSyntaxHighlight.mock.calls;
      const emptyLineCalls = calls.filter(call => call[0].code.trim() === '');
      expect(emptyLineCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle code blocks without language specification', () => {
      const noLanguageBlock = `\`\`\`
const defaultLanguage = "should work";
console.log(defaultLanguage);
\`\`\``;

      render(
        <ResponseStream
          content={noLanguageBlock}
          displayMode="normal"
        />
      );

      // Should default to 'text' or handle gracefully
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      const calls = mockSyntaxHighlight.mock.calls;
      calls.forEach(call => {
        expect(call[0]).toHaveProperty('language');
        // Language should be 'text' or empty string, but not undefined
        expect(typeof call[0].language).toBe('string');
      });
    });

    it('should handle malformed code blocks gracefully', () => {
      const malformedBlocks = `
\`\`\`typescript
function incomplete(
// Missing closing backticks

\`\`\`
// Missing language and content

\`\`\`javascript
function complete() {
  return "this should work";
}
\`\`\``;

      render(
        <ResponseStream
          content={malformedBlocks}
          displayMode="normal"
        />
      );

      // Should handle well-formed blocks while ignoring malformed ones
      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(mockSyntaxHighlight).toHaveBeenCalled();
    });

    it('should handle very long code lines', () => {
      const longLineCode = `\`\`\`javascript
const veryLongVariableNameThatExceedsNormalTerminalWidthAndMightCauseIssuesWithRenderingOrPerformanceIfNotHandledProperly = "test";
\`\`\``;

      render(
        <ResponseStream
          content={longLineCode}
          displayMode="normal"
        />
      );

      // Should handle long lines without crashing
      expect(mockSyntaxHighlight).toHaveBeenCalled();
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should handle special characters in code', () => {
      const specialCharCode = `\`\`\`typescript
const emoji = "🚀 ⚡ 💡";
const unicode = "αβγδε ñáéíóú 中文字符";
const symbols = "\\"quotes\\" 'apostrophes' <>&";
const escape = "\\n\\t\\r\\\\";
\`\`\``;

      render(
        <ResponseStream
          content={specialCharCode}
          displayMode="normal"
        />
      );

      expect(mockSyntaxHighlight).toHaveBeenCalled();
      expect(screen.getByText('typescript')).toBeInTheDocument();

      // Verify special characters are passed to syntax highlighter
      const calls = mockSyntaxHighlight.mock.calls;
      const allCode = calls.map(call => call[0].code).join('');
      expect(allCode).toContain('🚀');
      expect(allCode).toContain('αβγδε');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large code blocks efficiently', () => {
      const largeCodeBlock = `\`\`\`javascript
${Array(100).fill('console.log("Performance test line");').join('\n')}
\`\`\``;

      const startTime = performance.now();
      render(
        <ResponseStream
          content={largeCodeBlock}
          displayMode="normal"
        />
      );
      const endTime = performance.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(200);

      // Should have called syntax highlighter for all lines
      expect(mockSyntaxHighlight).toHaveBeenCalledTimes(100);
    });

    it('should handle multiple large code blocks', () => {
      const multipleBlocks = Array(5).fill(0).map((_, i) => `
\`\`\`javascript
// Block ${i + 1}
${Array(20).fill(`console.log("Block ${i + 1}, line");`).join('\n')}
\`\`\``).join('\n\nSome text between blocks.\n\n');

      render(
        <ResponseStream
          content={multipleBlocks}
          displayMode="normal"
        />
      );

      // Should handle multiple blocks without performance degradation
      expect(mockSyntaxHighlight).toHaveBeenCalledTimes(100); // 5 blocks * 20 lines

      // All blocks should be rendered
      expect(screen.getAllByText('javascript')).toHaveLength(5);
    });
  });

  describe('Integration with Content Parsing', () => {
    it('should preserve non-code content while highlighting code blocks', () => {
      const mixedContent = `# Heading

This is some regular text with **bold** and *italic* formatting.

\`\`\`typescript
interface Example {
  value: string;
}
\`\`\`

More text with \`inline code\` and [links](http://example.com).

\`\`\`python
def example():
    return "hello"
\`\`\`

Final paragraph.`;

      render(
        <ResponseStream
          content={mixedContent}
          displayMode="normal"
        />
      );

      // Should render both code blocks
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();

      // Should preserve text formatting
      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText('Final paragraph.')).toBeInTheDocument();

      // Verify syntax highlighting was called for code blocks only
      expect(mockSyntaxHighlight).toHaveBeenCalled();
    });

    it('should handle nested markdown structures with code blocks', () => {
      const nestedContent = `## API Documentation

### Authentication

\`\`\`typescript
interface AuthConfig {
  apiKey: string;
  endpoint: string;
}
\`\`\`

#### Usage Example

1. First, set up your config:

\`\`\`javascript
const config = {
  apiKey: "your-key-here",
  endpoint: "https://api.example.com"
};
\`\`\`

2. Then make your request:

\`\`\`javascript
const response = await fetch(config.endpoint, {
  headers: {
    'Authorization': \`Bearer \${config.apiKey}\`
  }
});
\`\`\``;

      render(
        <ResponseStream
          content={nestedContent}
          displayMode="normal"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getAllByText('javascript')).toHaveLength(2);

      // Should preserve markdown structure
      expect(screen.getByText('API Documentation')).toBeInTheDocument();
      expect(screen.getByText('Authentication')).toBeInTheDocument();
      expect(screen.getByText('Usage Example')).toBeInTheDocument();
    });
  });

  describe('Component Props Integration', () => {
    it('should respect ResponseStream props while handling code blocks', () => {
      const content = `\`\`\`typescript
const test = "props integration";
\`\`\``;

      const props: ResponseStreamProps = {
        content,
        isStreaming: true,
        agent: 'test-agent',
        type: 'tool',
        displayMode: 'verbose'
      };

      render(<ResponseStream {...props} />);

      // Should show agent information
      expect(screen.getByText('[test-agent]')).toBeInTheDocument();

      // Should handle syntax highlighting in verbose mode
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Should show streaming indicator
      expect(screen.getByText('█')).toBeInTheDocument();
    });

    it('should handle different response types with code blocks', () => {
      const content = `Error in code:

\`\`\`typescript
function buggy() {
  // This has an error
  return undefined.property;
}
\`\`\``;

      render(
        <ResponseStream
          content={content}
          type="error"
          displayMode="normal"
        />
      );

      expect(screen.getByText('✗')).toBeInTheDocument(); // Error prefix
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(mockSyntaxHighlight).toHaveBeenCalled();
    });
  });
});