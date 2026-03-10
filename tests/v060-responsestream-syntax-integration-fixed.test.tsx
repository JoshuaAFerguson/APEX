import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * V0.6.0 ResponseStream Syntax Highlighting Integration Tests
 *
 * These tests specifically verify the ResponseStream integration with ink-syntax-highlight
 * for code block rendering as required by the acceptance criteria.
 */

// Mock ink-syntax-highlight to verify integration
vi.mock('ink-syntax-highlight', () => ({
  default: ({ language, code }: { language: string; code: string }) =>
    React.createElement(
      'span',
      {
        'data-testid': 'ink-syntax-highlight',
        'data-language': language,
        'data-code': code,
      },
      code
    ),
}));

import { ResponseStream, ResponseStreamProps } from '../packages/cli/src/ui/components/ResponseStream';

describe('V0.6.0 ResponseStream Syntax Integration', () => {
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

      // Verify syntax highlighting elements are present
      const highlightedElements = screen.getAllByTestId('ink-syntax-highlight');
      expect(highlightedElements.length).toBeGreaterThan(0);

      // Check that language was passed correctly
      const typescriptElements = highlightedElements.filter(
        el => el.getAttribute('data-language') === 'typescript'
      );
      expect(typescriptElements.length).toBeGreaterThan(0);

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
      const highlightedElements = screen.getAllByTestId('ink-syntax-highlight');
      const languages = Array.from(new Set(
        highlightedElements.map(el => el.getAttribute('data-language'))
      ));

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
      const highlightedElements = screen.getAllByTestId('ink-syntax-highlight');
      const languages = Array.from(new Set(
        highlightedElements.map(el => el.getAttribute('data-language'))
      ));

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

    it('should render code blocks in compact mode without syntax highlighting', () => {
      render(
        <ResponseStream
          content={testCodeBlock}
          displayMode="compact"
        />
      );

      // In compact mode, should show simplified view
      expect(screen.getByText(/typescript/)).toBeInTheDocument();

      // Should not use ink-syntax-highlight in compact mode (uses simplified display)
      expect(screen.queryByTestId('ink-syntax-highlight')).not.toBeInTheDocument();
    });

    it('should render code blocks in normal mode with syntax highlighting', () => {
      render(
        <ResponseStream
          content={testCodeBlock}
          displayMode="normal"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getAllByTestId('ink-syntax-highlight').length).toBeGreaterThan(0);

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
      expect(screen.getAllByTestId('ink-syntax-highlight').length).toBeGreaterThan(0);

      // Should show line numbers in verbose mode
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getAllByText('│').length).toBeGreaterThan(0);
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
      expect(screen.getAllByTestId('ink-syntax-highlight').length).toBeGreaterThan(0);

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
      expect(screen.getAllByTestId('ink-syntax-highlight').length).toBeGreaterThan(0);
    });
  });
});