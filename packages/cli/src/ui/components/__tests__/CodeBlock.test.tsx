import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { CodeBlock } from '../CodeBlock';

// Mock ink-syntax-highlight
vi.mock('ink-syntax-highlight', () => ({
  default: ({ language, code }: { language: string; code: string }) =>
    React.createElement('span', { 'data-testid': `highlighted-${language}` }, code)
}));

/**
 * Test suite for CodeBlock component
 * Tests the CodeBlock component functionality including language mapping and display
 */
describe('CodeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders code with default settings', () => {
      render(
        <CodeBlock code="const test = 'hello';" />
      );

      expect(screen.getByText("const test = 'hello';")).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('renders with custom language', () => {
      render(
        <CodeBlock
          code="print('hello world')"
          language="python"
        />
      );

      expect(screen.getByText("print('hello world')")).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('displays filename when provided', () => {
      render(
        <CodeBlock
          code="console.log('test');"
          language="javascript"
          filename="test.js"
        />
      );

      expect(screen.getByText('test.js')).toBeInTheDocument();
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('shows line numbers by default', () => {
      const multilineCode = `line 1
line 2
line 3`;

      render(
        <CodeBlock code={multilineCode} />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getAllByText('│')).toHaveLength(3);
    });

    it('hides line numbers when disabled', () => {
      const multilineCode = `line 1
line 2`;

      render(
        <CodeBlock
          code={multilineCode}
          showLineNumbers={false}
        />
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
      expect(screen.queryByText('│')).not.toBeInTheDocument();
    });
  });

  describe('Language Mapping', () => {
    const languageMappingTests = [
      { alias: 'ts', expected: 'typescript' },
      { alias: 'js', expected: 'javascript' },
      { alias: 'py', expected: 'python' },
      { alias: 'rb', expected: 'ruby' },
      { alias: 'sh', expected: 'bash' },
      { alias: 'shell', expected: 'bash' },
      { alias: 'yml', expected: 'yaml' },
      { alias: 'md', expected: 'markdown' },
    ];

    languageMappingTests.forEach(({ alias, expected }) => {
      it(`maps ${alias} to ${expected}`, () => {
        render(
          <CodeBlock
            code="test code"
            language={alias}
          />
        );

        expect(screen.getByText(expected)).toBeInTheDocument();
        expect(screen.getByTestId(`highlighted-${expected}`)).toBeInTheDocument();
      });
    });

    it('preserves unknown languages as-is', () => {
      render(
        <CodeBlock
          code="test code"
          language="customlang"
        />
      );

      expect(screen.getByText('customlang')).toBeInTheDocument();
    });

    it('handles case-insensitive language input', () => {
      render(
        <CodeBlock
          code="test code"
          language="TypeScript"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  describe('Content Handling', () => {
    it('handles empty code gracefully', () => {
      render(
        <CodeBlock code="" />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('handles single line code', () => {
      render(
        <CodeBlock code="const x = 42;" />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText("const x = 42;")).toBeInTheDocument();
    });

    it('handles multi-line code correctly', () => {
      const code = `function test() {
  return 'hello';
}`;

      render(
        <CodeBlock code={code} />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles code with special characters', () => {
      const codeWithSpecialChars = `const emoji = "🚀";
const symbols = "<>&'\"";
const unicode = "αβγδ";`;

      render(
        <CodeBlock code={codeWithSpecialChars} />
      );

      expect(screen.getByText(/🚀/)).toBeInTheDocument();
      expect(screen.getByText(/<>&/)).toBeInTheDocument();
      expect(screen.getByText(/αβγδ/)).toBeInTheDocument();
    });

    it('handles indented code correctly', () => {
      const indentedCode = `if (true) {
  const nested = 'value';
    if (nested) {
      console.log('deep');
    }
}`;

      render(
        <CodeBlock code={indentedCode} />
      );

      // Should preserve indentation
      expect(screen.getByText('const nested')).toBeInTheDocument();
    });
  });

  describe('Header Display', () => {
    it('shows only language when no filename provided', () => {
      render(
        <CodeBlock
          code="test"
          language="python"
        />
      );

      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('shows both filename and language when both provided', () => {
      render(
        <CodeBlock
          code="test"
          language="python"
          filename="script.py"
        />
      );

      expect(screen.getByText('script.py')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('handles long filenames gracefully', () => {
      const longFilename = 'very-long-filename-that-might-cause-layout-issues.tsx';

      render(
        <CodeBlock
          code="test"
          filename={longFilename}
        />
      );

      expect(screen.getByText(longFilename)).toBeInTheDocument();
    });

    it('does not show header when no filename or language', () => {
      // This shouldn't happen in practice since language defaults to 'typescript'
      render(
        <CodeBlock code="test" />
      );

      // Should still show default language
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  describe('Language-Specific Examples', () => {
    it('renders TypeScript interface correctly', () => {
      const tsCode = `interface User {
  id: string;
  name: string;
  email: string;
}`;

      render(
        <CodeBlock
          code={tsCode}
          language="typescript"
          filename="types.ts"
        />
      );

      expect(screen.getByText('types.ts')).toBeInTheDocument();
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByTestId('highlighted-typescript')).toBeInTheDocument();
    });

    it('renders Python function correctly', () => {
      const pythonCode = `def calculate_sum(a: int, b: int) -> int:
    """Calculate the sum of two numbers."""
    return a + b`;

      render(
        <CodeBlock
          code={pythonCode}
          language="python"
          filename="calculator.py"
        />
      );

      expect(screen.getByText('calculator.py')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('renders JSON configuration correctly', () => {
      const jsonCode = `{
  "name": "test-package",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}`;

      render(
        <CodeBlock
          code={jsonCode}
          language="json"
          filename="package.json"
        />
      );

      expect(screen.getByText('package.json')).toBeInTheDocument();
      expect(screen.getByText('json')).toBeInTheDocument();
    });

    it('renders shell script correctly', () => {
      const shellCode = `#!/bin/bash
echo "Starting deployment..."
npm run build
npm run deploy`;

      render(
        <CodeBlock
          code={shellCode}
          language="bash"
          filename="deploy.sh"
        />
      );

      expect(screen.getByText('deploy.sh')).toBeInTheDocument();
      expect(screen.getByText('bash')).toBeInTheDocument();
    });

    it('renders YAML config correctly', () => {
      const yamlCode = `version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
  db:
    image: postgres:13`;

      render(
        <CodeBlock
          code={yamlCode}
          language="yaml"
          filename="docker-compose.yml"
        />
      );

      expect(screen.getByText('docker-compose.yml')).toBeInTheDocument();
      expect(screen.getByText('yaml')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long single lines', () => {
      const longCode = 'const veryLongVariableNameThatExceedsNormalLineLengthAndMightCauseLayoutIssues = "test value that is also quite long";';

      render(
        <CodeBlock code={longCode} />
      );

      expect(screen.getByText(/veryLongVariableNameThatExceedsNormalLineLengthAndMightCauseLayoutIssues/)).toBeInTheDocument();
    });

    it('handles code with only whitespace', () => {
      const whitespaceCode = '   \n  \n   ';

      render(
        <CodeBlock code={whitespaceCode} />
      );

      // Should render the whitespace lines
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles mixed line endings', () => {
      const mixedLineEndings = 'line1\nline2\r\nline3\rline4';

      render(
        <CodeBlock code={mixedLineEndings} />
      );

      // Should handle different line endings gracefully
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('handles code with null or undefined', () => {
      render(
        <CodeBlock code={null as any} />
      );

      // Should not crash, though this is an edge case
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });
  });

  describe('Integration with ink-syntax-highlight', () => {
    it('passes correct language to syntax highlighter', () => {
      render(
        <CodeBlock
          code="function test() {}"
          language="javascript"
        />
      );

      expect(screen.getByTestId('highlighted-javascript')).toBeInTheDocument();
    });

    it('passes each line to syntax highlighter when line numbers enabled', () => {
      const multilineCode = 'line1\nline2\nline3';

      render(
        <CodeBlock
          code={multilineCode}
          language="python"
        />
      );

      // Each line should be highlighted separately
      expect(screen.getByTestId('highlighted-python')).toBeInTheDocument();
    });

    it('passes entire code block to syntax highlighter when line numbers disabled', () => {
      const multilineCode = 'line1\nline2\nline3';

      render(
        <CodeBlock
          code={multilineCode}
          language="python"
          showLineNumbers={false}
        />
      );

      expect(screen.getByTestId('highlighted-python')).toBeInTheDocument();
    });
  });
});