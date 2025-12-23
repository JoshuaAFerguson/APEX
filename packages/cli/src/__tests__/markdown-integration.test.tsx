import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from './test-utils';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../ui/components/MarkdownRenderer';

/**
 * Integration tests for Markdown Rendering System
 * Tests the actual markdown examples described in the v0.3.0 documentation
 */
describe('Markdown Integration Tests - v0.3.0 Documentation Examples', () => {
  describe('Documentation Example Rendering', () => {
    it('renders header elements exactly as shown in documentation', () => {
      const headerExample = `# Primary Header
## Secondary Header
### Tertiary Header`;

      render(<SimpleMarkdownRenderer content={headerExample} />);

      // Verify headers are rendered with correct hierarchy
      expect(screen.getByText('Primary Header')).toBeInTheDocument();
      expect(screen.getByText('Secondary Header')).toBeInTheDocument();
      expect(screen.getByText('Tertiary Header')).toBeInTheDocument();
    });

    it('renders list elements as documented', () => {
      const listExample = `### Unordered Lists
- Feature planning
- Code implementation
- Testing and validation
- Documentation updates

### Ordered Lists
1. Initialize project structure
2. Configure development environment
3. Implement core features
4. Write comprehensive tests`;

      render(<SimpleMarkdownRenderer content={listExample} />);

      // Verify list content is rendered
      expect(screen.getByText('Feature planning')).toBeInTheDocument();
      expect(screen.getByText('Code implementation')).toBeInTheDocument();
      expect(screen.getByText('Initialize project structure')).toBeInTheDocument();
      expect(screen.getByText('Configure development environment')).toBeInTheDocument();
    });

    it('renders inline code elements from documentation examples', () => {
      const inlineCodeExample = `Use the \`npm install\` command to install dependencies. Configure your environment with \`API_KEY=your_key\` and run \`npm start\` to begin development.`;

      render(<SimpleMarkdownRenderer content={inlineCodeExample} />);

      // Verify inline code is rendered
      expect(screen.getByText(/npm install/)).toBeInTheDocument();
      expect(screen.getByText(/API_KEY=your_key/)).toBeInTheDocument();
      expect(screen.getByText(/npm start/)).toBeInTheDocument();
    });

    it('renders blockquote elements as shown in documentation', () => {
      const blockquoteExample = `> **Important**: Always validate user input before processing authentication tokens.
>
> This prevents security vulnerabilities and ensures your application maintains
> proper data integrity throughout the authentication flow.`;

      render(<SimpleMarkdownRenderer content={blockquoteExample} />);

      // Verify blockquote content is rendered
      expect(screen.getByText(/Important/)).toBeInTheDocument();
      expect(screen.getByText(/security vulnerabilities/)).toBeInTheDocument();
      expect(screen.getByText(/data integrity/)).toBeInTheDocument();
    });

    it('renders text emphasis elements correctly', () => {
      const emphasisExample = `The authentication system supports **strong emphasis** for critical information,
*italic emphasis* for subtle highlights, and ***combined emphasis*** for maximum
impact when documenting important implementation details.`;

      render(<SimpleMarkdownRenderer content={emphasisExample} />);

      // Verify emphasis is rendered
      expect(screen.getByText(/strong emphasis/)).toBeInTheDocument();
      expect(screen.getByText(/italic emphasis/)).toBeInTheDocument();
      expect(screen.getByText(/combined emphasis/)).toBeInTheDocument();
    });
  });

  describe('Complex Documentation Examples', () => {
    it('renders the authentication implementation example from docs', () => {
      const authImplementationExample = `## Implementation Plan

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

      render(<SimpleMarkdownRenderer content={authImplementationExample} />);

      // Verify all elements are rendered correctly
      expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
      expect(screen.getByText('LoginForm Component')).toBeInTheDocument();
      expect(screen.getByText('AuthContext Provider')).toBeInTheDocument();
      expect(screen.getByText(/Email\/password validation/)).toBeInTheDocument();
      expect(screen.getByText(/Next Steps/)).toBeInTheDocument();
    });

    it('renders MarkdownRenderer API examples from documentation', () => {
      const apiExample = `### Basic Usage:

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
  highlightLanguage="auto"
  showLineNumbers={false}
  theme="auto"
  responsive={true}
  streaming={true}
  onRenderComplete={() => handleComplete()}
  customStyles={{
    header: { color: 'cyan', bold: true },
    code: { backgroundColor: 'gray', color: 'white' },
    emphasis: { color: 'yellow' }
  }}
/>
\`\`\``;

      render(<SimpleMarkdownRenderer content={apiExample} />);

      // Verify API documentation elements are rendered
      expect(screen.getByText('Basic Usage:')).toBeInTheDocument();
      expect(screen.getByText('Advanced Configuration:')).toBeInTheDocument();
      expect(screen.getByText(/import.*MarkdownRenderer/)).toBeInTheDocument();
      expect(screen.getByText(/customStyles/)).toBeInTheDocument();
    });

    it('renders TypeScript configuration examples', () => {
      const configExample = `#### Component Properties:

\`\`\`typescript
interface MarkdownRendererProps {
  content: string;                    // Raw markdown content
  highlightLanguage?: string;         // Syntax highlighting language
  showLineNumbers?: boolean;          // Show line numbers in code blocks
  theme?: 'dark' | 'light' | 'auto';  // Color theme
  maxWidth?: number;                  // Maximum rendering width
  responsive?: boolean;               // Responsive layout adaptation
  streaming?: boolean;                // Character-by-character rendering
  onRenderComplete?: () => void;      // Callback when rendering completes
  customStyles?: StyleOverrides;      // Custom styling overrides
}
\`\`\``;

      render(<SimpleMarkdownRenderer content={configExample} />);

      // Verify TypeScript interface is rendered
      expect(screen.getByText('Component Properties:')).toBeInTheDocument();
      expect(screen.getByText(/MarkdownRendererProps/)).toBeInTheDocument();
      expect(screen.getByText(/content: string/)).toBeInTheDocument();
    });
  });

  describe('Streaming Integration Examples', () => {
    it('renders streaming markdown response example', () => {
      const streamingExample = `// Streaming markdown response from agent
<StreamingResponse
  agent="📝 documentation"
  content={markdownResponse}
  renderAsMarkdown={true}
  isStreaming={true}
  onComplete={() => setShowNext(true)}
/>

// Agent response with markdown content
const agentResponse = \`
## Implementation Plan

I'll create the authentication system with these components:

1. **LoginForm Component**
   - Email/password validation
   - Submit handling with loading states
   - Error message display

2. **AuthContext Provider**
   - User state management
   - Token storage and validation
   - Login/logout functions

\\\\\\*\\*\\*typescript
// Example implementation
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {}
});
\\\\\\*\\*\\*

> **Next Steps**: After reviewing this plan, I'll implement each component with full TypeScript support and comprehensive error handling.
\`;`;

      render(<SimpleMarkdownRenderer content={streamingExample} />);

      // Verify streaming integration example is rendered
      expect(screen.getByText(/StreamingResponse/)).toBeInTheDocument();
      expect(screen.getByText(/renderAsMarkdown={true}/)).toBeInTheDocument();
      expect(screen.getByText(/agentResponse/)).toBeInTheDocument();
    });
  });

  describe('Responsive Layout Testing', () => {
    it('adapts content for narrow terminal width', () => {
      const responsiveContent = `# Authentication Setup

Follow these steps to implement secure authentication:

1. Install dependencies: \`npm install jsonwebtoken bcryptjs express-rate-limit\`
2. Configure environment variables for JWT secrets
3. Create authentication middleware with proper error handling
4. Implement protected route wrapper component

> **Security Note**: Always use HTTPS in production`;

      const { container } = render(
        <SimpleMarkdownRenderer content={responsiveContent} width={30} />
      );

      // Verify narrow width is applied
      expect(container.firstChild).toHaveAttribute('width', '30');
      expect(screen.getByText('Authentication Setup')).toBeInTheDocument();
    });

    it('adapts content for wide terminal width', () => {
      const responsiveContent = `# JWT Authentication Implementation Guide

This comprehensive guide covers all aspects of implementing secure JWT authentication in your React application with TypeScript support and comprehensive error handling.

## Prerequisites

- Node.js >= 18.0.0
- React >= 18.0.0 with TypeScript
- Express.js backend with JWT support

## Implementation Steps

1. **Install Required Dependencies**
   \`\`\`bash
   npm install jsonwebtoken bcryptjs express-rate-limit cors helmet
   npm install @types/jsonwebtoken @types/bcryptjs --save-dev
   \`\`\`

2. **Configure Environment Variables**
   \`\`\`env
   JWT_SECRET=your-super-secure-jwt-secret-key
   JWT_EXPIRES_IN=24h
   REFRESH_TOKEN_SECRET=your-refresh-token-secret
   \`\`\``;

      const { container } = render(
        <SimpleMarkdownRenderer content={responsiveContent} width={120} />
      );

      // Verify wide width is applied
      expect(container.firstChild).toHaveAttribute('width', '120');
      expect(screen.getByText('JWT Authentication Implementation Guide')).toBeInTheDocument();
      expect(screen.getByText('Prerequisites')).toBeInTheDocument();
    });
  });

  describe('Performance Testing with Documentation Examples', () => {
    it('handles large documentation content efficiently', () => {
      // Create a large markdown document similar to the v0.3.0 features documentation
      const largeDocContent = Array.from({ length: 50 }, (_, i) => `
## Section ${i + 1}: Feature Implementation

This section describes the implementation of feature ${i + 1} in the APEX v0.3.0 system.

### Overview

The feature provides **enhanced functionality** with the following benefits:

- Improved user experience
- Better performance metrics
- Enhanced security features
- Streamlined workflow integration

### Code Example

\`\`\`typescript
interface Feature${i + 1}Config {
  enabled: boolean;
  options: {
    performance: 'high' | 'medium' | 'low';
    security: SecurityLevel;
    caching: boolean;
  };
  callbacks: {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
  };
}

const config: Feature${i + 1}Config = {
  enabled: true,
  options: {
    performance: 'high',
    security: SecurityLevel.STRICT,
    caching: true
  },
  callbacks: {
    onSuccess: () => console.log('Feature ${i + 1} initialized'),
    onError: (error) => console.error('Failed to initialize:', error)
  }
};
\`\`\`

> **Implementation Note**: This feature requires careful consideration of performance implications and security requirements.

### Best Practices

1. Always validate input parameters
2. Implement proper error handling
3. Use TypeScript for type safety
4. Follow established patterns
5. Write comprehensive tests

---
`).join('\n');

      const start = performance.now();
      render(<SimpleMarkdownRenderer content={largeDocContent} />);
      const end = performance.now();

      // Should handle large content efficiently (< 200ms for test environment)
      expect(end - start).toBeLessThan(200);

      // Verify content is rendered
      expect(screen.getByText('Section 1: Feature Implementation')).toBeInTheDocument();
      expect(screen.getByText('Section 50: Feature Implementation')).toBeInTheDocument();
    });

    it('processes complex nested structures efficiently', () => {
      const complexContent = `# APEX v0.3.0 Features Overview

## Core Features

### 1. Rich Terminal UI Framework

APEX v0.3.0 introduces a complete Ink-based React framework:

- **Component-based architecture** for complex UI layouts
- **Real-time updates** with React state management
- **Responsive design** with 4-tier breakpoint system

#### StreamingText Component

\`\`\`typescript
<StreamingText
  text="Implementing your feature..."
  speed={50}
  showCursor={true}
  onComplete={() => console.log('Done!')}
/>
\`\`\`

### 2. Streaming Response Rendering

#### Visual Output Example:

\`\`\`
┌─────────────────────────────────────────────┐
│ 🤖 Developer Agent                          │
├─────────────────────────────────────────────┤
│ Analyzing your codebase...▊                 │
│                                             │
│ I can see you're working on a React app    │
│ with TypeScript. Let me implement the      │
│ user authentication feature you requested▊ │
│                                             │
│ ✓ Complete                                  │
└─────────────────────────────────────────────┘
\`\`\`

> **Performance Note**: All streaming components are optimized for performance with character-based streaming at configurable speeds.

### 3. Advanced Display Modes

#### Responsive Width System

All streaming components automatically adapt to terminal width:

1. **Narrow terminal** (< 60 columns) - Compact display
2. **Compact terminal** (60-79 columns) - Reduced information
3. **Normal terminal** (80-119 columns) - Standard display
4. **Wide terminal** (120+ columns) - Full information

#### Breakpoint-Aware Layout

\`\`\`typescript
const { width, height, breakpoint } = useStdoutDimensions();
// Breakpoint values: 'narrow' | 'compact' | 'normal' | 'wide'
\`\`\``;

      const start = performance.now();
      render(<SimpleMarkdownRenderer content={complexContent} />);
      const end = performance.now();

      // Should handle complex nested content efficiently
      expect(end - start).toBeLessThan(100);

      // Verify complex structure is rendered
      expect(screen.getByText('APEX v0.3.0 Features Overview')).toBeInTheDocument();
      expect(screen.getByText('Rich Terminal UI Framework')).toBeInTheDocument();
      expect(screen.getByText('StreamingText Component')).toBeInTheDocument();
    });
  });

  describe('Error Handling with Real Examples', () => {
    it('handles malformed markdown from documentation gracefully', () => {
      const malformedExample = `# Authentication Guide

This guide shows how to implement **authentication without proper closing

## Installation Steps

1. Install dependencies: \`npm install jsonwebtoken
2. Configure your environment variables
3. Create the authentication middleware

\`\`\`typescript
// Incomplete code block
const config = {
  secret: process.env.JWT_SECRET

> **Important**: Always validate your configuration`;

      expect(() => {
        render(<SimpleMarkdownRenderer content={malformedExample} />);
      }).not.toThrow();

      // Should still render the valid parts
      expect(screen.getByText('Authentication Guide')).toBeInTheDocument();
      expect(screen.getByText('Installation Steps')).toBeInTheDocument();
    });

    it('recovers from mixed content formatting errors', () => {
      const mixedErrorContent = `### Configuration **Examples

Here are some configuration examples:

- **Database Config** without closing
- *Cache Settings without closing
- Normal list item

\`\`\`js
const config = {
  // Missing closing brace
  db: 'mongodb://localhost'
\`\`\`

> Blockquote without proper **emphasis handling`;

      expect(() => {
        render(<SimpleMarkdownRenderer content={mixedErrorContent} />);
      }).not.toThrow();

      // Should render whatever it can parse
      expect(screen.getByText(/Configuration/)).toBeInTheDocument();
      expect(screen.getByText(/Database Config/)).toBeInTheDocument();
    });
  });
});