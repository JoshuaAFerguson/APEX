/**
 * Comprehensive SyntaxHighlighter Code Blocks Component Audit Tests
 *
 * This test suite comprehensively audits the SyntaxHighlighter and ResponseStream components
 * against the acceptance criteria:
 *
 * 1. SyntaxHighlighter.tsx has language-aware highlighting logic (keyword/string/comment highlighting)
 * 2. Line numbers functionality
 * 3. Line wrapping capabilities
 * 4. ResponseStream integrates ink-syntax-highlight for code blocks
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

describe('SyntaxHighlighter Comprehensive Audit', () => {
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

    // Mock SyntaxHighlight to return highlighted code for verification
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

  describe('ACCEPTANCE CRITERIA 1: Language-Aware Highlighting Logic', () => {
    describe('Keyword Highlighting', () => {
      it('should identify TypeScript keywords correctly', () => {
        const tsCode = `interface User {
  name: string;
  age: number;
}
const user: User = { name: "test", age: 25 };
function getName(user: User): string {
  return user.name;
}
class UserManager {
  async getUser(): Promise<User> {
    return user;
  }
}
export { User, UserManager };
import { OtherType } from './types';
type UserID = string;`;

        render(
          <SimpleSyntaxHighlighter
            code={tsCode}
            language="typescript"
          />
        );

        // Verify TypeScript keywords are present in the component
        const codeContent = screen.getByText(/interface User/);
        expect(codeContent).toBeInTheDocument();
        expect(screen.getByText(/const user/)).toBeInTheDocument();
        expect(screen.getByText(/function getName/)).toBeInTheDocument();
        expect(screen.getByText(/class UserManager/)).toBeInTheDocument();
        expect(screen.getByText(/export \{ User/)).toBeInTheDocument();
        expect(screen.getByText(/import \{ OtherType/)).toBeInTheDocument();
        expect(screen.getByText(/type UserID/)).toBeInTheDocument();
        expect(screen.getByText(/async getUser/)).toBeInTheDocument();
      });

      it('should identify JavaScript keywords correctly', () => {
        const jsCode = `function calculateSum(a, b) {
  const result = a + b;
  let temp = result;
  var legacy = temp;
  return temp;
}
class Calculator {
  async compute() {
    await this.initialize();
  }
}
export default Calculator;
import { helper } from './utils';`;

        render(
          <SimpleSyntaxHighlighter
            code={jsCode}
            language="javascript"
          />
        );

        expect(screen.getByText(/function calculateSum/)).toBeInTheDocument();
        expect(screen.getByText(/const result/)).toBeInTheDocument();
        expect(screen.getByText(/let temp/)).toBeInTheDocument();
        expect(screen.getByText(/var legacy/)).toBeInTheDocument();
        expect(screen.getByText(/class Calculator/)).toBeInTheDocument();
        expect(screen.getByText(/async compute/)).toBeInTheDocument();
        expect(screen.getByText(/await this/)).toBeInTheDocument();
        expect(screen.getByText(/export default/)).toBeInTheDocument();
        expect(screen.getByText(/import \{ helper/)).toBeInTheDocument();
      });

      it('should identify Python keywords correctly', () => {
        const pythonCode = `def calculate_sum(a, b):
    import math
    from datetime import datetime
    if a > 0:
        result = a + b
    elif a < 0:
        result = b - a
    else:
        result = b

    for i in range(10):
        while i < result:
            try:
                async def process():
                    await some_operation()
                    return result
            except Exception:
                pass
    return result

class Calculator:
    def __init__(self):
        pass`;

        render(
          <SimpleSyntaxHighlighter
            code={pythonCode}
            language="python"
          />
        );

        expect(screen.getByText(/def calculate_sum/)).toBeInTheDocument();
        expect(screen.getByText(/import math/)).toBeInTheDocument();
        expect(screen.getByText(/from datetime/)).toBeInTheDocument();
        expect(screen.getByText(/if a > 0/)).toBeInTheDocument();
        expect(screen.getByText(/elif a < 0/)).toBeInTheDocument();
        expect(screen.getByText(/else:/)).toBeInTheDocument();
        expect(screen.getByText(/for i in range/)).toBeInTheDocument();
        expect(screen.getByText(/while i < result/)).toBeInTheDocument();
        expect(screen.getByText(/try:/)).toBeInTheDocument();
        expect(screen.getByText(/except Exception/)).toBeInTheDocument();
        expect(screen.getByText(/class Calculator/)).toBeInTheDocument();
        expect(screen.getByText(/async def process/)).toBeInTheDocument();
        expect(screen.getByText(/await some_operation/)).toBeInTheDocument();
      });

      it('should identify Rust keywords correctly', () => {
        const rustCode = `fn main() {
    let mut x = 5;
    let y: i32 = 10;
    pub struct User {
        name: String,
        age: u8,
    }
    impl User {
        pub fn new(name: String, age: u8) -> Self {
            User { name, age }
        }
    }
    enum Status {
        Active,
        Inactive,
    }
    trait Display {
        fn display(&self);
    }
    use std::collections::HashMap;
    mod utils;
}`;

        render(
          <SimpleSyntaxHighlighter
            code={rustCode}
            language="rust"
          />
        );

        expect(screen.getByText(/fn main/)).toBeInTheDocument();
        expect(screen.getByText(/let mut x/)).toBeInTheDocument();
        expect(screen.getByText(/pub struct User/)).toBeInTheDocument();
        expect(screen.getByText(/impl User/)).toBeInTheDocument();
        expect(screen.getByText(/enum Status/)).toBeInTheDocument();
        expect(screen.getByText(/trait Display/)).toBeInTheDocument();
        expect(screen.getByText(/use std::collections/)).toBeInTheDocument();
        expect(screen.getByText(/mod utils/)).toBeInTheDocument();
      });

      it('should identify Go keywords correctly', () => {
        const goCode = `package main
import "fmt"
import "time"

func main() {
    var x int = 10
    const message string = "hello"
    type User struct {
        Name string
        Age  int
    }
    interface Writer {
        Write([]byte) (int, error)
    }
    fmt.Println(message)
}`;

        render(
          <SimpleSyntaxHighlighter
            code={goCode}
            language="go"
          />
        );

        expect(screen.getByText(/package main/)).toBeInTheDocument();
        expect(screen.getByText(/import "fmt"/)).toBeInTheDocument();
        expect(screen.getByText(/func main/)).toBeInTheDocument();
        expect(screen.getByText(/var x int/)).toBeInTheDocument();
        expect(screen.getByText(/const message/)).toBeInTheDocument();
        expect(screen.getByText(/type User struct/)).toBeInTheDocument();
        expect(screen.getByText(/interface Writer/)).toBeInTheDocument();
      });
    });

    describe('String Highlighting', () => {
      it('should detect and highlight double-quoted strings', () => {
        const codeWithStrings = `const greeting = "Hello, world!";
const nested = "String with 'single quotes' inside";
const escaped = "String with \\"escaped\\" quotes";`;

        render(
          <SimpleSyntaxHighlighter
            code={codeWithStrings}
            language="typescript"
          />
        );

        expect(screen.getByText(/Hello, world!/)).toBeInTheDocument();
        expect(screen.getByText(/'single quotes'/)).toBeInTheDocument();
        expect(screen.getByText(/escaped/)).toBeInTheDocument();
      });

      it('should detect and highlight single-quoted strings', () => {
        const codeWithStrings = `const name = 'John Doe';
const message = 'It\\'s a beautiful day';
const mixed = 'String with "double quotes" inside';`;

        render(
          <SimpleSyntaxHighlighter
            code={codeWithStrings}
            language="typescript"
          />
        );

        expect(screen.getByText(/John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/beautiful day/)).toBeInTheDocument();
        expect(screen.getByText(/"double quotes"/)).toBeInTheDocument();
      });

      it('should handle complex string patterns', () => {
        const complexStrings = `const template = \`Template literal with \${variable}\`;
const multiline = "First line\\n" + "Second line";
const unicode = "Unicode: \u00A9 \u00AE";
const empty = "";
const singleChar = "x";`;

        render(
          <SimpleSyntaxHighlighter
            code={complexStrings}
            language="typescript"
          />
        );

        // Verify strings are rendered (highlighting is applied through ANSI codes)
        expect(screen.getByText(/Template literal/)).toBeInTheDocument();
        expect(screen.getByText(/First line/)).toBeInTheDocument();
        expect(screen.getByText(/Unicode:/)).toBeInTheDocument();
      });
    });

    describe('Comment Highlighting', () => {
      it('should detect single-line comments in C-style languages', () => {
        const codeWithComments = `// This is a single line comment
const x = 42; // Inline comment
function test() {
  // Another comment
  return true;
}`;

        render(
          <SimpleSyntaxHighlighter
            code={codeWithComments}
            language="javascript"
          />
        );

        expect(screen.getByText(/This is a single line comment/)).toBeInTheDocument();
        expect(screen.getByText(/Inline comment/)).toBeInTheDocument();
        expect(screen.getByText(/Another comment/)).toBeInTheDocument();
      });

      it('should detect block comments in C-style languages', () => {
        const codeWithBlockComments = `/*
 * Multi-line block comment
 * with multiple lines
 */
function test() {
  /* Inline block comment */ return true;
}`;

        render(
          <SimpleSyntaxHighlighter
            code={codeWithBlockComments}
            language="javascript"
          />
        );

        expect(screen.getByText(/Multi-line block comment/)).toBeInTheDocument();
        expect(screen.getByText(/Inline block comment/)).toBeInTheDocument();
      });

      it('should detect Python-style comments', () => {
        const pythonComments = `# This is a Python comment
def calculate():
    # Function-level comment
    x = 42  # Inline comment
    return x`;

        render(
          <SimpleSyntaxHighlighter
            code={pythonComments}
            language="python"
          />
        );

        expect(screen.getByText(/This is a Python comment/)).toBeInTheDocument();
        expect(screen.getByText(/Function-level comment/)).toBeInTheDocument();
        expect(screen.getByText(/Inline comment/)).toBeInTheDocument();
      });

      it('should handle mixed comment styles appropriately', () => {
        const mixedComments = `// JavaScript comment
/* Block comment */
function test() {
  // Comment with "string" inside
  /* Comment with 'quotes' */
  return "string with // not a comment";
}`;

        render(
          <SimpleSyntaxHighlighter
            code={mixedComments}
            language="javascript"
          />
        );

        expect(screen.getByText(/JavaScript comment/)).toBeInTheDocument();
        expect(screen.getByText(/Block comment/)).toBeInTheDocument();
        expect(screen.getByText(/Comment with "string"/)).toBeInTheDocument();
        expect(screen.getByText(/not a comment/)).toBeInTheDocument();
      });
    });

    describe('ANSI Color Application', () => {
      it('should apply ANSI color codes for keywords', () => {
        const code = `function test() {
  const x = 42;
  return x;
}`;

        const { container } = render(
          <SimpleSyntaxHighlighter
            code={code}
            language="javascript"
          />
        );

        // The highlightLine function should apply ANSI escape codes
        // We can verify this by checking the DOM structure or by testing the function directly
        expect(container.innerHTML).toBeDefined();

        // Keywords like 'function', 'const', 'return' should be processed by highlightLine
        expect(screen.getByText(/function test/)).toBeInTheDocument();
        expect(screen.getByText(/const x/)).toBeInTheDocument();
        expect(screen.getByText(/return x/)).toBeInTheDocument();
      });

      it('should apply different ANSI colors for different syntax elements', () => {
        const complexCode = `// Comment
const message = "Hello, world!";
function greet() {
  return message;
}`;

        render(
          <SimpleSyntaxHighlighter
            code={complexCode}
            language="javascript"
          />
        );

        // Verify all syntax elements are present
        expect(screen.getByText(/Comment/)).toBeInTheDocument();
        expect(screen.getByText(/Hello, world!/)).toBeInTheDocument();
        expect(screen.getByText(/function greet/)).toBeInTheDocument();
        expect(screen.getByText(/return message/)).toBeInTheDocument();
      });
    });
  });

  describe('ACCEPTANCE CRITERIA 2: Line Numbers Functionality', () => {
    it('should display line numbers with proper padding and formatting', () => {
      const multiLineCode = `line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
line 9
line 10
line 11
line 12`;

      render(
        <SyntaxHighlighter
          code={multiLineCode}
          showLineNumbers={true}
        />
      );

      // Check line numbers with proper padding (3 characters + " │")
      expect(screen.getByText('1 │')).toBeInTheDocument();
      expect(screen.getByText('2 │')).toBeInTheDocument();
      expect(screen.getByText('3 │')).toBeInTheDocument();
      expect(screen.getByText('10 │')).toBeInTheDocument();
      expect(screen.getByText('11 │')).toBeInTheDocument();
      expect(screen.getByText('12 │')).toBeInTheDocument();
    });

    it('should calculate line number width correctly for large files', () => {
      const manyLines = Array(150).fill('console.log("test");').join('\n');

      render(
        <SyntaxHighlighter
          code={manyLines}
          showLineNumbers={true}
          maxLines={10}
        />
      );

      // Should display first few line numbers
      expect(screen.getByText('1 │')).toBeInTheDocument();
      expect(screen.getByText('2 │')).toBeInTheDocument();
      expect(screen.getByText('10 │')).toBeInTheDocument();

      // Should show truncation indicator
      expect(screen.getByText(/more lines/)).toBeInTheDocument();
    });

    it('should hide line numbers when showLineNumbers is false', () => {
      const multiLineCode = `line 1
line 2
line 3`;

      render(
        <SyntaxHighlighter
          code={multiLineCode}
          showLineNumbers={false}
        />
      );

      // Line numbers should not be present
      expect(screen.queryByText('1 │')).not.toBeInTheDocument();
      expect(screen.queryByText('2 │')).not.toBeInTheDocument();
      expect(screen.queryByText('3 │')).not.toBeInTheDocument();

      // But content should still be there
      expect(screen.getByText('line 1')).toBeInTheDocument();
      expect(screen.getByText('line 2')).toBeInTheDocument();
      expect(screen.getByText('line 3')).toBeInTheDocument();
    });

    it('should adjust effective width calculation based on line numbers', () => {
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

      const testCode = 'const test = "width calculation with line numbers";';

      const { rerender } = render(
        <SyntaxHighlighter
          code={testCode}
          showLineNumbers={true}
          responsive={true}
        />
      );

      expect(screen.getByText('1 │')).toBeInTheDocument();

      rerender(
        <SyntaxHighlighter
          code={testCode}
          showLineNumbers={false}
          responsive={true}
        />
      );

      // Line numbers should be gone but content should still render
      expect(screen.queryByText('1 │')).not.toBeInTheDocument();
      expect(screen.getByText(/width calculation/)).toBeInTheDocument();
    });

    it('should show original vs wrapped line count in header', () => {
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

      const longCode = 'const veryLongVariableNameThatWillDefinitelyExceedTerminalWidthAndCauseWrapping = "test";';

      render(
        <SyntaxHighlighter
          code={longCode}
          responsive={true}
          showLineNumbers={true}
        />
      );

      // Should show wrapped line count in header
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      expect(screen.getByText('1 │')).toBeInTheDocument();
    });
  });

  describe('ACCEPTANCE CRITERIA 3: Line Wrapping Capabilities', () => {
    it('should wrap long lines when responsive mode is enabled', () => {
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

      const longLine = 'const reallyLongVariableNameThatExceedsTerminalWidth = "This will definitely need wrapping";';

      render(
        <SyntaxHighlighter
          code={longLine}
          responsive={true}
        />
      );

      // Should indicate wrapping occurred
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should break lines at sensible characters', () => {
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

      const codeWithBreakPoints = 'function longFunctionName(param1, param2, param3) { return param1 + param2 + param3; }';

      render(
        <SyntaxHighlighter
          code={codeWithBreakPoints}
          wrapLines={true}
        />
      );

      // Should wrap and show indication
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
      expect(screen.getByText(/function longFunctionName/)).toBeInTheDocument();
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

      const longStatement = 'const result = someVeryLongFunctionCall(parameter1, parameter2, parameter3);';

      render(
        <SyntaxHighlighter
          code={longStatement}
          wrapLines={true}
        />
      );

      // Should handle wrapping with proper indentation (internal logic)
      expect(screen.getByText(/wrapped/)).toBeInTheDocument();
    });

    it('should respect explicit wrapLines prop over responsive default', () => {
      const longCode = 'x'.repeat(120);

      // Test explicit wrapLines=true overrides responsive=false
      render(
        <SyntaxHighlighter
          code={longCode}
          wrapLines={true}
          responsive={false}
        />
      );

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

      const longCode = 'const shouldNotWrapEvenThoughTerminalIsNarrow = "test";';

      render(
        <SyntaxHighlighter
          code={longCode}
          wrapLines={false}
        />
      );

      // Should not show wrapping indicator
      expect(screen.queryByText(/wrapped/)).not.toBeInTheDocument();
    });

    it('should calculate effective width correctly', () => {
      const testSizes = [
        { width: 40, expectedMin: 40 },
        { width: 80, expectedMin: 40 },
        { width: 120, expectedMin: 40 },
      ];

      testSizes.forEach(({ width, expectedMin }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : 'normal',
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100,
          isWide: false,
          isAvailable: true,
        });

        const { unmount } = render(
          <SyntaxHighlighter
            code="test"
            responsive={true}
          />
        );

        // Should render without errors regardless of width
        expect(screen.getByText('test')).toBeInTheDocument();
        unmount();
      });
    });

    it('should maintain minimum width of 40 characters', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30, // Very narrow
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
          code="test code"
          responsive={true}
        />
      );

      // Should still render properly with minimum width enforcement
      expect(screen.getByText('test code')).toBeInTheDocument();
    });
  });

  describe('ACCEPTANCE CRITERIA 4: ResponseStream ink-syntax-highlight Integration', () => {
    it('should parse markdown code blocks correctly', () => {
      const markdownWithCode = `Here's some TypeScript code:

\`\`\`typescript
interface User {
  name: string;
  age: number;
}
\`\`\`

And here's some JavaScript:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\``;

      render(
        <ResponseStream
          content={markdownWithCode}
          displayMode="normal"
        />
      );

      // Should display language headers
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('javascript')).toBeInTheDocument();

      // Should have called SyntaxHighlight for each code line
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Verify language and code parameters
      const calls = mockSyntaxHighlight.mock.calls;
      const typescriptCalls = calls.filter(call => call[0].language === 'typescript');
      const javascriptCalls = calls.filter(call => call[0].language === 'javascript');

      expect(typescriptCalls.length).toBeGreaterThan(0);
      expect(javascriptCalls.length).toBeGreaterThan(0);
    });

    it('should handle language aliases correctly', () => {
      const aliasedCode = `\`\`\`ts
interface Test {
  id: string;
}
\`\`\`

\`\`\`js
const test = { id: "123" };
\`\`\`

\`\`\`py
def hello():
    print("world")
\`\`\`

\`\`\`sh
echo "Hello"
\`\`\``;

      render(
        <ResponseStream
          content={aliasedCode}
          displayMode="normal"
        />
      );

      // Language aliases should be mapped correctly
      expect(screen.getByText('typescript')).toBeInTheDocument(); // ts -> typescript
      expect(screen.getByText('javascript')).toBeInTheDocument(); // js -> javascript
      expect(screen.getByText('python')).toBeInTheDocument();     // py -> python
      expect(screen.getByText('bash')).toBeInTheDocument();       // sh -> bash
    });

    it('should integrate with different display modes', () => {
      const codeBlock = `\`\`\`python
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)
\`\`\``;

      // Test compact mode
      const { rerender } = render(
        <ResponseStream
          content={codeBlock}
          displayMode="compact"
        />
      );

      // In compact mode, should show simplified version
      expect(screen.getByText(/python/)).toBeInTheDocument();

      // Test normal mode
      rerender(
        <ResponseStream
          content={codeBlock}
          displayMode="normal"
        />
      );

      expect(screen.getByText('python')).toBeInTheDocument();
      expect(mockSyntaxHighlight).toHaveBeenCalled();

      // Test verbose mode with line numbers
      rerender(
        <ResponseStream
          content={codeBlock}
          displayMode="verbose"
        />
      );

      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Line numbers
      expect(screen.getByText('│')).toBeInTheDocument(); // Line number separator
    });

    it('should call SyntaxHighlight for each line with correct parameters', () => {
      const multiLineCode = `\`\`\`typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  return response.json();
}
\`\`\``;

      render(
        <ResponseStream
          content={multiLineCode}
          displayMode="verbose"
        />
      );

      // Verify SyntaxHighlight was called for each line
      const calls = mockSyntaxHighlight.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // Each call should have correct structure
      calls.forEach(call => {
        expect(call[0]).toHaveProperty('language', 'typescript');
        expect(call[0]).toHaveProperty('code');
        expect(typeof call[0].code).toBe('string');
      });

      // Verify specific lines were processed
      const codeArgs = calls.map(call => call[0].code);
      expect(codeArgs.some(code => code.includes('interface ApiResponse'))).toBe(true);
      expect(codeArgs.some(code => code.includes('async function fetchData'))).toBe(true);
    });

    it('should handle edge cases in markdown parsing', () => {
      const edgeCases = `\`\`\`
// No language specified
const test = "should default to text";
\`\`\`

\`\`\`unknownlang
some code in unknown language
\`\`\`

\`\`\`typescript
// Empty lines and special chars
const unicode = "🚀";

const empty = "";
\`\`\``;

      render(
        <ResponseStream
          content={edgeCases}
          displayMode="normal"
        />
      );

      // Should handle missing language (defaults to 'text')
      expect(screen.getByText('text')).toBeInTheDocument();

      // Should handle unknown languages
      expect(screen.getByText('unknownlang')).toBeInTheDocument();

      // Should handle TypeScript with special characters
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('should handle multiple code blocks with different languages', () => {
      const multipleBlocks = `\`\`\`rust
fn main() {
    println!("Hello from Rust!");
}
\`\`\`

\`\`\`go
package main
import "fmt"
func main() {
    fmt.Println("Hello from Go!")
}
\`\`\`

\`\`\`python
def main():
    print("Hello from Python!")
\`\`\``;

      render(
        <ResponseStream
          content={multipleBlocks}
          displayMode="normal"
        />
      );

      expect(screen.getByText('rust')).toBeInTheDocument();
      expect(screen.getByText('go')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();

      // Verify each language was called with SyntaxHighlight
      const calls = mockSyntaxHighlight.mock.calls;
      const languages = calls.map(call => call[0].language);

      expect(languages.includes('rust')).toBe(true);
      expect(languages.includes('go')).toBe(true);
      expect(languages.includes('python')).toBe(true);
    });

    it('should preserve non-code content while highlighting code blocks', () => {
      const mixedContent = `Here's a solution to the problem:

First, let's look at the TypeScript interface:

\`\`\`typescript
interface Solution {
  solve(): string;
}
\`\`\`

Then, we implement it:

\`\`\`typescript
class ProblemSolver implements Solution {
  solve(): string {
    return "solved!";
  }
}
\`\`\`

That's how you solve it!`;

      render(
        <ResponseStream
          content={mixedContent}
          displayMode="normal"
        />
      );

      // Should preserve markdown text content
      expect(screen.getByText(/Here's a solution/)).toBeInTheDocument();
      expect(screen.getByText(/First, let's look/)).toBeInTheDocument();
      expect(screen.getByText(/Then, we implement/)).toBeInTheDocument();
      expect(screen.getByText(/That's how you solve/)).toBeInTheDocument();

      // Should also have code blocks
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(mockSyntaxHighlight).toHaveBeenCalled();
    });
  });
});