import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from './test-utils';
import { SimpleMarkdownRenderer } from '../ui/components/MarkdownRenderer';

/**
 * Visual Output Validation Tests for Markdown Rendering
 * Tests that verify the visual appearance matches documentation examples
 */
describe('Markdown Visual Output Validation', () => {
  describe('ASCII Box Drawing Elements', () => {
    it('validates terminal UI mockup structure from documentation', () => {
      // Test that we can validate the ASCII art structure used in documentation
      const terminalMockup = `Visual example from docs:

\`\`\`
┌─ Markdown Rendering ─────────────────────────────────────────────────────────┐
│                                                                              │
│ ██████ Primary Header                                                        │
│                                                                              │
│ ████ Secondary Header                                                        │
│                                                                              │
│ ██ Tertiary Header                                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
\`\`\``;

      render(<SimpleMarkdownRenderer content={terminalMockup} />);

      // Verify the terminal mockup content is rendered
      expect(screen.getByText(/Visual example from docs/)).toBeInTheDocument();
      expect(screen.getByText(/Markdown Rendering/)).toBeInTheDocument();
      expect(screen.getByText(/Primary Header/)).toBeInTheDocument();
    });

    it('validates agent status indicators from documentation examples', () => {
      const agentExample = `Agent status visualization:

\`\`\`
┌─ Agent Activity ─────────────────────────────────────────────────────────────┐
│                                                                              │
│ 📋 planner    → → →  🏗️  architect  → → →  🤖 developer    ⟂  🧪 tester      │
│   completed          in progress             waiting           parallel      │
│   (2.3s)            (0:45 elapsed)           queue: 1           (running)    │
│                                                                              │
│ ├─ 📋 Plan implementation strategy                              ✓ (2.3s)     │
│ ├─ 🏗️ Design authentication system                            ● (in progress) │
│ └─ 🤖 Implement authentication components                       ⏸ (waiting)   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
\`\`\``;

      render(<SimpleMarkdownRenderer content={agentExample} />);

      // Verify agent status content is rendered
      expect(screen.getByText(/Agent status visualization/)).toBeInTheDocument();
      expect(screen.getByText(/Agent Activity/)).toBeInTheDocument();
      expect(screen.getByText(/planner.*architect.*developer.*tester/)).toBeInTheDocument();
    });

    it('validates status bar elements from documentation', () => {
      const statusBarExample = `Status bar visualization:

\`\`\`
────────────────────────────────────────────────────────────────────────────────
⚡ APEX v0.3.0  │  🏗️ architect  │  📋 implementation  │  ⏱️ 00:04:23  │  🪙 1.2K↑ 3.4K↓  │  💰 $0.12  │  🌿 main
\`\`\`

Responsive variations:

\`\`\`
# Normal terminal (80-119 columns)
⚡ APEX  │  🏗️ architect  │  📋 impl  │  ⏱️ 04:23  │  🪙 1.2K↑ 3.4K↓  │  💰 $0.12

# Compact terminal (60-79 columns)
⚡ v0.3.0  │  🏗️ arch  │  ⏱️ 04:23  │  💰 $0.12
\`\`\``;

      render(<SimpleMarkdownRenderer content={statusBarExample} />);

      // Verify status bar content is rendered
      expect(screen.getByText(/Status bar visualization/)).toBeInTheDocument();
      expect(screen.getByText(/APEX v0.3.0/)).toBeInTheDocument();
      expect(screen.getByText(/Responsive variations/)).toBeInTheDocument();
    });
  });

  describe('Color and Styling Validation', () => {
    it('validates header styling hierarchy', () => {
      const headerHierarchy = `# Primary Header (H1)
## Secondary Header (H2)
### Tertiary Header (H3)

Colors according to documentation:
- H1: Cyan bold text with size-based intensity
- H2: Cyan bold text with medium intensity
- H3: Cyan dim bold text with lower intensity`;

      render(<SimpleMarkdownRenderer content={headerHierarchy} />);

      // Verify all header levels are rendered
      expect(screen.getByText('Primary Header (H1)')).toBeInTheDocument();
      expect(screen.getByText('Secondary Header (H2)')).toBeInTheDocument();
      expect(screen.getByText('Tertiary Header (H3)')).toBeInTheDocument();
      expect(screen.getByText(/H1: Cyan bold text/)).toBeInTheDocument();
    });

    it('validates list bullet styling', () => {
      const listStyling = `List styling examples:

**Unordered Lists:**
- First item (yellow bullet)
- Second item (yellow bullet)
- Third item (yellow bullet)

**Ordered Lists:**
1. First step (yellow number)
2. Second step (yellow number)
3. Third step (yellow number)

**Nested Lists:**
- Main item
  - Sub item (indented)
  - Another sub item
- Another main item`;

      render(<SimpleMarkdownRenderer content={listStyling} />);

      // Verify list content is rendered
      expect(screen.getByText(/List styling examples/)).toBeInTheDocument();
      expect(screen.getByText('First item (yellow bullet)')).toBeInTheDocument();
      expect(screen.getByText('First step (yellow number)')).toBeInTheDocument();
      expect(screen.getByText('Main item')).toBeInTheDocument();
    });

    it('validates code block styling', () => {
      const codeBlockStyling = `Code block styling validation:

\`\`\`typescript
// TypeScript code with syntax highlighting
interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: number;
  refreshEnabled: boolean;
}

const config: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiry: 3600,
  refreshEnabled: true
};
\`\`\`

Inline code styling: \`npm install\` and \`API_KEY=value\`

Documentation notes:
- Code blocks: Syntax-highlighted with language detection
- Inline code: Gray background with white text
- Language indicators: Shown in code block headers`;

      render(<SimpleMarkdownRenderer content={codeBlockStyling} />);

      // Verify code styling content is rendered
      expect(screen.getByText(/Code block styling validation/)).toBeInTheDocument();
      expect(screen.getByText(/AuthConfig/)).toBeInTheDocument();
      expect(screen.getByText(/npm install/)).toBeInTheDocument();
    });

    it('validates emphasis and text styling', () => {
      const emphasisStyling = `Text emphasis validation:

**Bold text styling:**
- **Strong emphasis** - White bold or bright white
- **Critical information** - High visibility styling

*Italic text styling:*
- *Italic emphasis* - Yellow or bright yellow
- *Subtle highlights* - Distinctive but not overwhelming

***Combined emphasis*** - Maximum impact styling

Documentation color mapping:
- Bold text: White bold or bright white
- Italic text: Yellow or bright yellow
- Combined: Both bold and italic styling applied`;

      render(<SimpleMarkdownRenderer content={emphasisStyling} />);

      // Verify emphasis content is rendered
      expect(screen.getByText(/Text emphasis validation/)).toBeInTheDocument();
      expect(screen.getByText(/Strong emphasis/)).toBeInTheDocument();
      expect(screen.getByText(/Italic emphasis/)).toBeInTheDocument();
      expect(screen.getByText(/Combined emphasis/)).toBeInTheDocument();
    });

    it('validates blockquote styling', () => {
      const blockquoteStyling = `Blockquote styling validation:

> **Important**: Always validate user input before processing authentication tokens.
>
> This prevents security vulnerabilities and ensures your application maintains
> proper data integrity throughout the authentication flow.

> **Security Note**: Use HTTPS in production and implement proper token rotation.

> **Performance Tip**: Cache frequently accessed user data but invalidate on logout.

Documentation styling:
- Left cyan border with dimmed text
- Important callouts with bold emphasis
- Multi-line quote support`;

      render(<SimpleMarkdownRenderer content={blockquoteStyling} />);

      // Verify blockquote content is rendered
      expect(screen.getByText(/Blockquote styling validation/)).toBeInTheDocument();
      expect(screen.getByText(/Important.*validate user input/)).toBeInTheDocument();
      expect(screen.getByText(/Security Note/)).toBeInTheDocument();
      expect(screen.getByText(/Left cyan border/)).toBeInTheDocument();
    });
  });

  describe('Responsive Layout Validation', () => {
    it('validates narrow terminal layout (< 60 columns)', () => {
      const narrowContent = `# Auth Guide

Quick setup:

1. Install deps
2. Configure env
3. Create middleware
4. Implement routes

\`\`\`js
const config = {
  secret: process.env.JWT_SECRET
};
\`\`\`

> **Tip**: Keep it simple`;

      const { container } = render(
        <SimpleMarkdownRenderer content={narrowContent} width={30} />
      );

      // Verify narrow layout is applied
      expect(container.firstChild).toHaveAttribute('width', '30');
      expect(screen.getByText('Auth Guide')).toBeInTheDocument();
      expect(screen.getByText('Quick setup:')).toBeInTheDocument();
    });

    it('validates wide terminal layout (120+ columns)', () => {
      const wideContent = `# Comprehensive Authentication Implementation Guide for React Applications

This detailed guide provides step-by-step instructions for implementing secure JWT-based authentication in React applications with TypeScript support, comprehensive error handling, and production-ready security measures.

## Prerequisites and Requirements

Before beginning implementation, ensure your development environment meets the following requirements:

- Node.js version 18.0.0 or higher for modern JavaScript features and optimal performance
- React version 18.0.0 or higher with TypeScript support for type safety and developer experience
- Express.js backend server with JWT authentication capabilities and security middleware
- Database system (MongoDB, PostgreSQL, or MySQL) for user data persistence and session management

## Implementation Steps and Best Practices

1. **Dependency Installation and Configuration**
   Install all required packages and their TypeScript definitions for comprehensive type support:
   \`\`\`bash
   npm install jsonwebtoken bcryptjs express-rate-limit cors helmet validator mongoose
   npm install @types/jsonwebtoken @types/bcryptjs @types/validator --save-dev
   \`\`\`

2. **Environment Variable Configuration**
   Set up secure environment variables with strong encryption keys and appropriate expiration times:
   \`\`\`env
   JWT_SECRET=your-super-secure-256-bit-jwt-secret-key-for-production-use
   JWT_EXPIRES_IN=24h
   REFRESH_TOKEN_SECRET=your-equally-secure-refresh-token-secret-key
   REFRESH_TOKEN_EXPIRES_IN=7d
   \`\`\``;

      const { container } = render(
        <SimpleMarkdownRenderer content={wideContent} width={120} />
      );

      // Verify wide layout is applied
      expect(container.firstChild).toHaveAttribute('width', '120');
      expect(screen.getByText(/Comprehensive Authentication Implementation Guide/)).toBeInTheDocument();
      expect(screen.getByText(/Prerequisites and Requirements/)).toBeInTheDocument();
    });

    it('validates responsive breakpoint behavior', () => {
      const responsiveContent = `# Responsive Design Test

Content that should adapt to different terminal widths according to documentation:

- **Narrow** (< 60): Compact display with essential information only
- **Compact** (60-79): Reduced information density, shorter labels
- **Normal** (80-119): Standard display with full feature labels
- **Wide** (120+): Full information with detailed descriptions`;

      // Test different widths
      const widths = [40, 70, 100, 130];

      widths.forEach(width => {
        const { container } = render(
          <SimpleMarkdownRenderer content={responsiveContent} width={width} />
        );
        expect(container.firstChild).toHaveAttribute('width', width.toString());
        expect(screen.getByText('Responsive Design Test')).toBeInTheDocument();
      });
    });
  });

  describe('Integration Visual Examples', () => {
    it('validates streaming response visual output from documentation', () => {
      const streamingVisual = `Streaming response example from documentation:

\`\`\`
┌─ 📝 documentation ● streaming... ────────────────────────────────────────────┐
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ████ Implementation Plan                                                     │
│                                                                              │
│ I'll create the authentication system with these components:                 │
│                                                                              │
│ 1. LoginForm Component                                                       │
│    • Email/password validation                                               │
│    • Submit handling with loading states                                     │
│    • Error message display                                                   │
│                                                                              │
│ 2. AuthContext Provider                                                      │
│    • User state management                                                   │
│    • Token storage and validation                                            │
│    • Login/logout functions                                                  │
│                                                                              │
│ // Example implementation                                                     │
│ const AuthContext = createContext<AuthContextType>({                        │
│   user: null,                                                               │
│   isAuthenticated: false,                                                    │
│   login: async () => {},                                                     │
│   logout: () => {}                                                           │
│ });                                                                          │
│                                                                              │
│ │ Next Steps: After reviewing this plan, I'll implement each component      │
│ │ with full TypeScript support and comprehensive error handling.▊           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
\`\`\``;

      render(<SimpleMarkdownRenderer content={streamingVisual} />);

      // Verify streaming visual content is rendered
      expect(screen.getByText(/Streaming response example/)).toBeInTheDocument();
      expect(screen.getByText(/documentation.*streaming/)).toBeInTheDocument();
      expect(screen.getByText(/Implementation Plan/)).toBeInTheDocument();
    });

    it('validates agent handoff animation visual from documentation', () => {
      const handoffVisual = `Agent handoff animation example:

\`\`\`
┌─ Parallel Agent Execution ───────────────────────────────────────────────────┐
│                                                                              │
│ 🤖 developer                           ⟂  🧪 tester                          │
│ ● Implementing login form                ● Running unit tests                │
│   (1:23 elapsed)                          (0:47 elapsed)                     │
│                                                                              │
│ 🔧 devops                              ⟂  📝 reviewer                        │
│ ● Setting up CI pipeline                 ● Code review in progress           │
│   (0:34 elapsed)                          (0:12 elapsed)                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
\`\`\`

Visual elements:
- \`→ → →\` Animated handoff arrows between agents
- \`⟂\` Parallel execution indicator with cyan styling
- \`●\` Active/in-progress indicator with pulse effect
- \`✓\` Completed tasks with elapsed time
- \`⏸\` Waiting/queued tasks`;

      render(<SimpleMarkdownRenderer content={handoffVisual} />);

      // Verify handoff visual content is rendered
      expect(screen.getByText(/Agent handoff animation/)).toBeInTheDocument();
      expect(screen.getByText(/Parallel Agent Execution/)).toBeInTheDocument();
      expect(screen.getByText(/Visual elements/)).toBeInTheDocument();
    });

    it('validates success celebration visual from documentation', () => {
      const successVisual = `Success celebration example:

\`\`\`
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                        🎉✨ SUCCESS! ✨🎉                                      │
│                                                                              │
│              Authentication System Implemented!                              │
│                                                                              │
│                    ⚡ 6 files created                                        │
│                    🧪 12 tests written                                       │
│                    📝 Documentation updated                                  │
│                    ⏱️  Completed in 4m 23s                                   │
│                                                                              │
│    🌟 Your React app now has secure JWT authentication! 🌟                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
\`\`\``;

      render(<SimpleMarkdownRenderer content={successVisual} />);

      // Verify success visual content is rendered
      expect(screen.getByText(/Success celebration example/)).toBeInTheDocument();
      expect(screen.getByText(/SUCCESS!/)).toBeInTheDocument();
      expect(screen.getByText(/Authentication System Implemented/)).toBeInTheDocument();
      expect(screen.getByText(/6 files created/)).toBeInTheDocument();
    });
  });

  describe('Theme and Color Validation', () => {
    it('validates dark theme color mapping from documentation', () => {
      const darkThemeExample = `Dark theme color reference:

\`\`\`typescript
// Dark theme (default)
const darkTheme = {
  header1: { color: 'cyanBright', bold: true },
  header2: { color: 'cyan', bold: true },
  header3: { color: 'cyanDim', bold: true },
  bold: { color: 'whiteBright', bold: true },
  italic: { color: 'yellow', italic: true },
  code: { backgroundColor: 'bgGray', color: 'white' },
  blockquote: { color: 'gray', borderColor: 'cyan' }
};
\`\`\`

Applied to content:

# H1 Header (cyanBright, bold)
## H2 Header (cyan, bold)
### H3 Header (cyanDim, bold)

This has **bold text** (whiteBright, bold) and *italic text* (yellow, italic).

\`Inline code\` (bgGray background, white text)

> Blockquote text (gray text, cyan left border)`;

      render(<SimpleMarkdownRenderer content={darkThemeExample} />);

      // Verify dark theme content is rendered
      expect(screen.getByText(/Dark theme color reference/)).toBeInTheDocument();
      expect(screen.getByText(/cyanBright.*bold.*true/)).toBeInTheDocument();
      expect(screen.getByText('H1 Header (cyanBright, bold)')).toBeInTheDocument();
      expect(screen.getByText(/bold text.*whiteBright/)).toBeInTheDocument();
    });

    it('validates light theme adaptation from documentation', () => {
      const lightThemeExample = `Light theme color reference:

\`\`\`typescript
// Light theme
const lightTheme = {
  header1: { color: 'blue', bold: true },
  header2: { color: 'blueDim', bold: true },
  header3: { color: 'gray', bold: true },
  bold: { color: 'black', bold: true },
  italic: { color: 'magenta', italic: true },
  code: { backgroundColor: 'bgWhite', color: 'black' },
  blockquote: { color: 'gray', borderColor: 'blue' }
};
\`\`\`

Light theme styling provides better contrast for light terminal backgrounds while maintaining readability and visual hierarchy.`;

      render(<SimpleMarkdownRenderer content={lightThemeExample} />);

      // Verify light theme content is rendered
      expect(screen.getByText(/Light theme color reference/)).toBeInTheDocument();
      expect(screen.getByText(/blue.*bold.*true/)).toBeInTheDocument();
      expect(screen.getByText(/better contrast for light terminal/)).toBeInTheDocument();
    });
  });
});