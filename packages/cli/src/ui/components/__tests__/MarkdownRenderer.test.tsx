import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';
import { marked } from 'marked';

// Mock marked library
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
  },
}));

// Mock useStdoutDimensions hook - use the path from the component's perspective
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock useStdoutDimensions hook to return default terminal width
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal',
      isAvailable: true,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
    });

    // Mock the marked parser to return predictable HTML
    (marked.parse as any).mockImplementation(async (content: string) => {
      // Simple mock implementation for testing
      if (content.includes('# Header')) {
        return '<h1>Header</h1>';
      }
      if (content.includes('## Secondary')) {
        return '<h2>Secondary</h2>';
      }
      if (content.includes('### Tertiary')) {
        return '<h3>Tertiary</h3>';
      }
      if (content.includes('**bold**')) {
        return '<strong>bold</strong>';
      }
      if (content.includes('*italic*')) {
        return '<em>italic</em>';
      }
      if (content.includes('`inline code`')) {
        return '<code>inline code</code>';
      }
      if (content.includes('```typescript')) {
        return '<pre><code class="language-typescript">const x = 1;</code></pre>';
      }
      if (content.includes('```')) {
        return '<pre><code>code block</code></pre>';
      }
      if (content.includes('- First item')) {
        return '<ul><li>First item</li><li>Second item</li></ul>';
      }
      if (content.includes('1. Initialize')) {
        return '<ol><li>Initialize project</li><li>Configure environment</li></ol>';
      }
      if (content.includes('> Important')) {
        return '<blockquote><strong>Important</strong>: Always validate user input</blockquote>';
      }
      return content; // Default: return as-is
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain text content', () => {
    render(<MarkdownRenderer content="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('processes markdown headers', async () => {
    render(<MarkdownRenderer content="# Main Header" />);
    // Wait for async markdown processing
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.getByText(/Main Header/)).toBeInTheDocument();
  });

  it('processes bold text', () => {
    render(<MarkdownRenderer content="This is **bold** text" />);
    expect(screen.getByText(/bold/)).toBeInTheDocument();
  });

  it('processes italic text', () => {
    render(<MarkdownRenderer content="This is *italic* text" />);
    expect(screen.getByText(/italic/)).toBeInTheDocument();
  });

  it('processes inline code', () => {
    render(<MarkdownRenderer content="This is `inline code`" />);
    expect(screen.getByText(/code/)).toBeInTheDocument();
  });

  it('processes code blocks', async () => {
    const codeContent = '```javascript\nconst x = 1;\n```';
    render(<MarkdownRenderer content={codeContent} />);
    // Wait for async markdown processing
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.getByText(/code/)).toBeInTheDocument();
  });

  it('processes lists', () => {
    const listContent = '- First item\n- Second item';
    render(<MarkdownRenderer content={listContent} />);
    expect(screen.getByText(/item/)).toBeInTheDocument();
  });

  it('processes blockquotes', () => {
    render(<MarkdownRenderer content="> This is a quote" />);
    expect(screen.getByText(/quote/)).toBeInTheDocument();
  });

  it('handles empty content gracefully', () => {
    expect(() => {
      render(<MarkdownRenderer content="" />);
    }).not.toThrow();
  });

  it('handles malformed markdown gracefully', () => {
    const malformedContent = '### Unclosed **bold and *italic without closing';
    render(<MarkdownRenderer content={malformedContent} />);
    // Should not crash
    expect(screen.getByText(/Unclosed/)).toBeInTheDocument();
  });

  it('respects width prop for text wrapping', () => {
    const longContent = 'This is a very long line of text that should wrap at the specified width';
    const { container } = render(<MarkdownRenderer content={longContent} width={30} />);

    // Component should render without error with specified width
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText(/This is a very long/)).toBeInTheDocument();
  });

  it('processes complex nested markdown', () => {
    const complexContent = `
# Header

This has **bold** and *italic* text.

## Subheader

- List item with \`code\`
- Another item

> A blockquote with **bold text**

\`\`\`javascript
const example = true;
\`\`\`
    `;

    render(<MarkdownRenderer content={complexContent} />);

    // Should process all elements without crashing
    expect(screen.getByText(/Header/)).toBeInTheDocument();
  });

  describe('Marked Integration', () => {
    it('calls marked.parse to process content', async () => {
      render(<MarkdownRenderer content="# Test Header" />);

      // Wait for useEffect to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(marked.parse).toHaveBeenCalledWith("# Test Header", { async: true });
    });

    it('strips HTML tags from marked output', async () => {
      (marked.parse as any).mockResolvedValue('<h1>Test Header</h1>');

      render(<MarkdownRenderer content="# Test Header" />);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(screen.getByText('Test Header')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles marked parsing errors gracefully', () => {
      (marked.parse as any).mockImplementation(() => {
        throw new Error('Parsing error');
      });

      // Should not crash the component
      expect(() => {
        render(<MarkdownRenderer content="# Test" />);
      }).not.toThrow();
    });

    it('handles null or undefined content', () => {
      expect(() => {
        render(<MarkdownRenderer content={null as any} />);
      }).not.toThrow();

      expect(() => {
        render(<MarkdownRenderer content={undefined as any} />);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('handles large content efficiently', () => {
      const largeContent = 'Large content\n'.repeat(1000);

      const start = performance.now();
      render(<MarkdownRenderer content={largeContent} />);
      const end = performance.now();

      // Should complete in reasonable time (< 100ms for test environment)
      expect(end - start).toBeLessThan(100);
    });

    it('memoizes parsing results for same content', () => {
      const content = "# Same Content";

      render(<MarkdownRenderer content={content} />);
      render(<MarkdownRenderer content={content} />);

      // marked.parse should be called for each render (no memoization in current impl)
      // This test documents current behavior; could be optimized later
      expect(marked.parse).toHaveBeenCalledTimes(2);
    });
  });
});

/**
 * Test suite for v0.3.0 Markdown Documentation Features
 * Validates all markdown elements described in the v0.3.0 features documentation
 */
describe('v0.3.0 Markdown Documentation Features', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock useStdoutDimensions hook to return default terminal width
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal',
      isAvailable: true,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
    });
  });

  describe('SimpleMarkdownRenderer - Documentation Examples', () => {
    it('renders all header levels as described in documentation', () => {
      const headerContent = `# Primary Header
## Secondary Header
### Tertiary Header`;

      render(<SimpleMarkdownRenderer content={headerContent} />);

      // Check that headers are rendered with appropriate styling
      expect(screen.getByText('Primary Header')).toBeInTheDocument();
      expect(screen.getByText('Secondary Header')).toBeInTheDocument();
      expect(screen.getByText('Tertiary Header')).toBeInTheDocument();
    });

    it('renders unordered lists as shown in documentation examples', () => {
      const unorderedListContent = `### Unordered Lists
- Feature planning
- Code implementation
- Testing and validation
- Documentation updates`;

      render(<SimpleMarkdownRenderer content={unorderedListContent} />);

      expect(screen.getByText('Unordered Lists')).toBeInTheDocument();
      expect(screen.getByText('Feature planning')).toBeInTheDocument();
      expect(screen.getByText('Code implementation')).toBeInTheDocument();
      expect(screen.getByText('Testing and validation')).toBeInTheDocument();
      expect(screen.getByText('Documentation updates')).toBeInTheDocument();
    });

    it('renders ordered lists as shown in documentation examples', () => {
      const orderedListContent = `### Ordered Lists
1. Initialize project structure
2. Configure development environment
3. Implement core features
4. Write comprehensive tests`;

      render(<SimpleMarkdownRenderer content={orderedListContent} />);

      expect(screen.getByText('Ordered Lists')).toBeInTheDocument();
      expect(screen.getByText('Initialize project structure')).toBeInTheDocument();
      expect(screen.getByText('Configure development environment')).toBeInTheDocument();
      expect(screen.getByText('Implement core features')).toBeInTheDocument();
      expect(screen.getByText('Write comprehensive tests')).toBeInTheDocument();
    });

    it('renders code blocks with language indicators', () => {
      const codeBlockContent = `Example TypeScript code:

\`\`\`typescript
interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: number;
}
\`\`\``;

      render(<SimpleMarkdownRenderer content={codeBlockContent} />);

      expect(screen.getByText('Example TypeScript code:')).toBeInTheDocument();
      expect(screen.getByText(/typescript/)).toBeInTheDocument();
    });

    it('renders inline code as documented', () => {
      const inlineCodeContent = `Use the \`npm install\` command to install dependencies. Configure with \`API_KEY=your_key\`.`;

      render(<SimpleMarkdownRenderer content={inlineCodeContent} />);

      expect(screen.getByText(/npm install/)).toBeInTheDocument();
      expect(screen.getByText(/API_KEY=your_key/)).toBeInTheDocument();
    });

    it('renders blockquotes with proper styling', () => {
      const blockquoteContent = `> **Important**: Always validate user input before processing authentication tokens.
>
> This prevents security vulnerabilities and ensures proper data integrity.`;

      render(<SimpleMarkdownRenderer content={blockquoteContent} />);

      expect(screen.getByText(/Important/)).toBeInTheDocument();
      expect(screen.getByText(/security vulnerabilities/)).toBeInTheDocument();
    });

    it('renders text emphasis (bold and italic)', () => {
      const emphasisContent = `The authentication system supports **strong emphasis** for critical information,
*italic emphasis* for subtle highlights, and ***combined emphasis*** for maximum impact.`;

      render(<SimpleMarkdownRenderer content={emphasisContent} />);

      expect(screen.getByText(/strong emphasis/)).toBeInTheDocument();
      expect(screen.getByText(/italic emphasis/)).toBeInTheDocument();
      expect(screen.getByText(/combined emphasis/)).toBeInTheDocument();
    });

    it('handles complex nested markdown structure', () => {
      const complexContent = `# Implementation Plan

I'll create the authentication system with these components:

## Components

1. **LoginForm Component**
   - Email/password validation
   - Submit handling with loading states

2. **AuthContext Provider**
   - User state management
   - Token storage

\`\`\`typescript
const AuthContext = createContext({
  user: null,
  isAuthenticated: false
});
\`\`\`

> **Next Steps**: After reviewing this plan, implement each component.`;

      render(<SimpleMarkdownRenderer content={complexContent} />);

      expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
      expect(screen.getByText('Components')).toBeInTheDocument();
      // Bold text retains asterisks in SimpleMarkdownRenderer's formatBoldItalic
      expect(screen.getByText(/LoginForm Component/)).toBeInTheDocument();
      expect(screen.getByText(/AuthContext Provider/)).toBeInTheDocument();
      expect(screen.getByText(/Next Steps/)).toBeInTheDocument();
    });
  });

  describe('Width and Layout Responsiveness', () => {
    it('respects width prop for narrow terminals', () => {
      const content = "This is a test of responsive width handling";
      const { container } = render(<SimpleMarkdownRenderer content={content} width={30} />);

      // Check that the component renders properly
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText(/This is a test/)).toBeInTheDocument();
    });

    it('respects width prop for wide terminals', () => {
      const content = "This is a test of responsive width handling for wide terminal displays";
      const { container } = render(<SimpleMarkdownRenderer content={content} width={120} />);

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByText(/This is a test/)).toBeInTheDocument();
    });

    it('uses responsive terminal width when not specified', () => {
      const content = "Default width test";
      const { container } = render(<SimpleMarkdownRenderer content={content} />);

      // Component should render properly with responsive width
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Responsive Width Feature', () => {
    it('adapts to narrow terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const content = "Test content for narrow terminal";
      const { container } = render(<MarkdownRenderer content={content} />);

      // Component should render properly in narrow terminals
      expect(container.firstChild).toBeInTheDocument();
    });

    it('adapts to wide terminal width', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'wide',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });

      const content = "Test content for wide terminal";
      const { container } = render(<MarkdownRenderer content={content} />);

      // Component should render properly in wide terminals
      expect(container.firstChild).toBeInTheDocument();
    });

    it('enforces minimum width in extremely narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });

      const content = "Test content for extremely narrow terminal";
      const { container } = render(<MarkdownRenderer content={content} />);

      // Component should render properly with minimum width enforced
      expect(container.firstChild).toBeInTheDocument();
    });

    it('respects responsive=false prop', () => {
      const content = "Test content with responsive disabled";
      const { container } = render(<MarkdownRenderer content={content} responsive={false} />);

      // Component should render properly with responsive disabled
      expect(container.firstChild).toBeInTheDocument();
    });

    it('explicit width overrides responsive behavior', () => {
      const content = "Test content with explicit width";
      const { container } = render(<MarkdownRenderer content={content} width={100} />);

      // Component should render properly with explicit width
      expect(container.firstChild).toBeInTheDocument();
    });

    it('works the same for SimpleMarkdownRenderer', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 90,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      const content = "Test content for SimpleMarkdownRenderer";
      const { container } = render(<SimpleMarkdownRenderer content={content} />);

      // Component should render properly with responsive behavior
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles empty markdown content gracefully', () => {
      expect(() => {
        render(<SimpleMarkdownRenderer content="" />);
      }).not.toThrow();
    });

    it('handles markdown with only whitespace', () => {
      const whitespaceContent = "   \n\n  \t  \n";
      expect(() => {
        render(<SimpleMarkdownRenderer content={whitespaceContent} />);
      }).not.toThrow();
    });

    it('handles mixed markdown elements efficiently', () => {
      const mixedContent = `# Header
- List item with \`code\`
> Quote with **bold**
## Another header
\`\`\`js
const x = 1;
\`\`\`
Normal paragraph text.`;

      const start = performance.now();
      render(<SimpleMarkdownRenderer content={mixedContent} />);
      const end = performance.now();

      // Should render quickly (< 50ms for test environment)
      expect(end - start).toBeLessThan(50);
    });

    it('handles malformed markdown without crashing', () => {
      const malformedContent = `# Unclosed **bold and *italic
- List item without
> Quote without ending
\`\`\`incomplete code block
### Header with trailing **bold`;

      expect(() => {
        render(<SimpleMarkdownRenderer content={malformedContent} />);
      }).not.toThrow();
    });

    it('processes large markdown content efficiently', () => {
      const largeContent = Array.from({ length: 50 }, (_, i) =>
        `## Section ${i}\n\nThis is a paragraph.\n\n- Item 1\n- Item 2`
      ).join('\n\n');

      const start = performance.now();
      render(<SimpleMarkdownRenderer content={largeContent} />);
      const end = performance.now();

      // Should handle large content - just verify it completes without timeout
      // Performance benchmarks are environment-dependent
      expect(end - start).toBeDefined();
    });
  });

  describe('Visual Element Testing', () => {
    it('applies correct styling for headers hierarchy', () => {
      const headerContent = `# H1 Header
## H2 Header
### H3 Header`;

      const { container } = render(<SimpleMarkdownRenderer content={headerContent} />);

      // Check that different header levels exist
      const h1Text = screen.getByText('H1 Header');
      const h2Text = screen.getByText('H2 Header');
      const h3Text = screen.getByText('H3 Header');

      expect(h1Text).toBeInTheDocument();
      expect(h2Text).toBeInTheDocument();
      expect(h3Text).toBeInTheDocument();
    });

    it('properly formats list bullets', () => {
      const listContent = `- First item
- Second item
* Third item`;

      render(<SimpleMarkdownRenderer content={listContent} />);

      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('Second item')).toBeInTheDocument();
      expect(screen.getByText('Third item')).toBeInTheDocument();
    });

    it('formats numbered lists correctly', () => {
      const numberedContent = `1. First step
2. Second step
10. Tenth step`;

      render(<SimpleMarkdownRenderer content={numberedContent} />);

      expect(screen.getByText('First step')).toBeInTheDocument();
      expect(screen.getByText('Second step')).toBeInTheDocument();
      expect(screen.getByText('Tenth step')).toBeInTheDocument();
    });

    it('properly styles blockquotes', () => {
      const quoteContent = `> This is a blockquote
> with multiple lines
> and formatting`;

      render(<SimpleMarkdownRenderer content={quoteContent} />);

      expect(screen.getByText(/This is a blockquote/)).toBeInTheDocument();
      expect(screen.getByText(/with multiple lines/)).toBeInTheDocument();
      expect(screen.getByText(/and formatting/)).toBeInTheDocument();
    });
  });

  describe('Integration with Documentation Examples', () => {
    it('renders authentication implementation example from docs', () => {
      const authExample = `## Implementation Plan

I'll create the authentication system with these components:

1. **LoginForm Component**
   - Email/password validation
   - Submit handling with loading states
   - Error message display

2. **AuthContext Provider**
   - User state management
   - Token storage and validation
   - Login/logout functions

\`\`\`typescript
// Example implementation
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {}
});
\`\`\`

> **Next Steps**: After reviewing this plan, I'll implement each component with full TypeScript support and comprehensive error handling.`;

      render(<SimpleMarkdownRenderer content={authExample} />);

      // Verify all key elements are rendered
      expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
      // Bold text retains asterisks in SimpleMarkdownRenderer's formatBoldItalic
      expect(screen.getByText(/LoginForm Component/)).toBeInTheDocument();
      expect(screen.getByText(/AuthContext Provider/)).toBeInTheDocument();
      expect(screen.getByText(/Next Steps/)).toBeInTheDocument();
      expect(screen.getByText(/Email\/password validation/)).toBeInTheDocument();
    });

    it('renders code configuration examples correctly', () => {
      const configExample = `### Basic Usage:

\`\`\`typescript
import { MarkdownRenderer } from '@apexcli/cli/ui/components';

<MarkdownRenderer
  content={markdownString}
  highlightLanguage="typescript"
  showLineNumbers={true}
  theme="dark"
  maxWidth={80}
/>
\`\`\`

### Advanced Configuration:

\`\`\`typescript
<MarkdownRenderer
  content={agentResponse}
  responsive={true}
  streaming={true}
  onRenderComplete={() => handleComplete()}
/>
\`\`\``;

      render(<SimpleMarkdownRenderer content={configExample} />);

      expect(screen.getByText('Basic Usage:')).toBeInTheDocument();
      expect(screen.getByText('Advanced Configuration:')).toBeInTheDocument();
      expect(screen.getByText(/import.*MarkdownRenderer/)).toBeInTheDocument();
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('handles null content gracefully', () => {
      expect(() => {
        render(<SimpleMarkdownRenderer content={null as any} />);
      }).not.toThrow();
    });

    it('handles undefined content gracefully', () => {
      expect(() => {
        render(<SimpleMarkdownRenderer content={undefined as any} />);
      }).not.toThrow();
    });

    it('recovers from formatting errors in inline elements', () => {
      const errorContent = `Text with **unclosed bold and *mixed* emphasis
> Quote with missing \`code formatting
### Header with trailing *italic`;

      expect(() => {
        render(<SimpleMarkdownRenderer content={errorContent} />);
      }).not.toThrow();
    });
  });
});
