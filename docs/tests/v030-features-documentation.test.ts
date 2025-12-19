import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Test suite for v0.3.0 Features Documentation
 * This test validates that the documentation examples and features described
 * in docs/features/v030-features.md are accurate and comprehensive.
 */
describe('v0.3.0 Features Documentation Tests', () => {
  const documentationPath = join(process.cwd(), 'docs', 'features', 'v030-features.md');
  let documentationContent: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Read the documentation file
    documentationContent = readFileSync(documentationPath, 'utf-8');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Documentation Structure Validation', () => {
    it('should have valid markdown structure with proper headers', () => {
      expect(documentationContent).toContain('# APEX v0.3.0 Features Overview');
      expect(documentationContent).toContain('## Overview');
      expect(documentationContent).toContain('## Core Features');
      expect(documentationContent).toContain('### 1. Rich Terminal UI Framework');
      expect(documentationContent).toContain('### 2. Streaming Response Rendering');
    });

    it('should contain all required feature sections', () => {
      const requiredSections = [
        'Rich Terminal UI Framework',
        'Streaming Response Rendering',
        'Advanced Display Modes',
        'Multi-Agent Visualization',
        'Status Bar and Information Display',
        'Natural Language Interface',
        'Enhanced Input Experience',
        'Progress Indicators and Feedback',
        'Session Management',
        'Keyboard Shortcuts',
        'Syntax Highlighting and Code Display',
        'Markdown Rendering System',
      ];

      requiredSections.forEach(section => {
        expect(documentationContent).toContain(section);
      });
    });

    it('should include comprehensive markdown rendering section', () => {
      expect(documentationContent).toContain('### 12. Markdown Rendering System');
      expect(documentationContent).toContain('#### Comprehensive Markdown Support');
      expect(documentationContent).toContain('#### Header Elements');
      expect(documentationContent).toContain('#### List Elements');
      expect(documentationContent).toContain('#### Code Block Elements');
      expect(documentationContent).toContain('#### Inline Code Elements');
      expect(documentationContent).toContain('#### Blockquote Elements');
      expect(documentationContent).toContain('#### Text Emphasis Elements');
      expect(documentationContent).toContain('#### MarkdownRenderer Component API');
    });

    it('should include implementation architecture section', () => {
      expect(documentationContent).toContain('## Implementation Architecture');
      expect(documentationContent).toContain('### Component Structure');
      expect(documentationContent).toContain('### Responsive System');
      expect(documentationContent).toContain('### Streaming Performance');
    });

    it('should have usage examples and best practices', () => {
      expect(documentationContent).toContain('## Usage Examples');
      expect(documentationContent).toContain('## Best Practices');
      expect(documentationContent).toContain('## Technical Specifications');
    });
  });

  describe('Code Examples Validation', () => {
    it('should include TypeScript code examples for StreamingText', () => {
      expect(documentationContent).toContain('```typescript');
      expect(documentationContent).toContain('StreamingText');
      expect(documentationContent).toContain('speed={50}');
      expect(documentationContent).toContain('showCursor={true}');
      expect(documentationContent).toContain('onComplete=');
      expect(documentationContent).toContain('import { StreamingText }');
    });

    it('should include StreamingResponse component examples', () => {
      expect(documentationContent).toContain('StreamingResponse');
      expect(documentationContent).toContain('agent=');
      expect(documentationContent).toContain('isStreaming=');
      expect(documentationContent).toContain('isComplete=');
      expect(documentationContent).toContain('onComplete=');
    });

    it('should include TypewriterText component examples', () => {
      expect(documentationContent).toContain('TypewriterText');
      expect(documentationContent).toContain('speed={100}');
      expect(documentationContent).toContain('delay={500}');
      expect(documentationContent).toContain('color=');
      expect(documentationContent).toContain('bold=');
      expect(documentationContent).toContain('🎉 Task Completed Successfully!');
    });

    it('should include responsive layout code examples', () => {
      expect(documentationContent).toContain('useStdoutDimensions');
      expect(documentationContent).toContain('breakpoint');
      expect(documentationContent).toContain("'narrow' | 'compact' | 'normal' | 'wide'");
      expect(documentationContent).toContain('width: number');
      expect(documentationContent).toContain('height: number');
    });

    it('should validate import statements are consistent', () => {
      const importPattern = /import.*from.*@apex\/cli/g;
      const imports = documentationContent.match(importPattern);

      if (imports && imports.length > 0) {
        imports.forEach(importStatement => {
          expect(importStatement).toMatch(/@apex\/cli/);
        });
      }
    });
  });

  describe('Visual Output Examples Validation', () => {
    it('should include ASCII art terminal mockups', () => {
      // Check for box drawing characters used in terminal UI examples
      expect(documentationContent).toContain('┌─');
      expect(documentationContent).toContain('└─');
      expect(documentationContent).toContain('├─');
      expect(documentationContent).toContain('│');
    });

    it('should include agent emoji indicators in examples', () => {
      const agentEmojis = ['🤖', '🏗️', '📋', '🧪', '🔧', '📝'];

      agentEmojis.forEach(emoji => {
        expect(documentationContent).toContain(emoji);
      });
    });

    it('should include status indicators in visual examples', () => {
      const statusIndicators = ['●', '✓', '⏸', '→', '⟂', '▊'];

      statusIndicators.forEach(indicator => {
        expect(documentationContent).toContain(indicator);
      });
    });

    it('should show streaming cursor animation in examples', () => {
      expect(documentationContent).toContain('▊'); // Block cursor character
      expect(documentationContent).toContain('streaming...');
      expect(documentationContent).toContain('● streaming...');
    });

    it('should include responsive width demonstrations', () => {
      expect(documentationContent).toContain('Narrow terminal (< 60 columns)');
      expect(documentationContent).toContain('Wide terminal (>= 120 columns)');
      expect(documentationContent).toContain('Compact terminal (60-79 columns)');
      expect(documentationContent).toContain('Normal terminal (80-119 columns)');
    });
  });

  describe('Feature Specifications Validation', () => {
    it('should document streaming performance specifications', () => {
      expect(documentationContent).toContain('50-100 characters per second');
      expect(documentationContent).toContain('configurable');
      expect(documentationContent).toContain('Performance Metrics');
      expect(documentationContent).toContain('<50ms for input handling');
      expect(documentationContent).toContain('<10MB for standard sessions');
    });

    it('should include comprehensive keyboard shortcuts', () => {
      const shortcuts = [
        'Ctrl+C', 'Ctrl+D', 'Ctrl+L', 'Ctrl+R',
        'Tab', 'Shift+Enter', 'Space', '↑/↓',
        'Ctrl+U', 'Ctrl+W', 'Ctrl+A/E',
        'Ctrl+S', 'Ctrl+O', 'Ctrl+B'
      ];

      shortcuts.forEach(shortcut => {
        expect(documentationContent).toContain(shortcut);
      });
    });

    it('should document agent panel features', () => {
      expect(documentationContent).toContain('Agent Panel');
      expect(documentationContent).toContain('handoff arrows');
      expect(documentationContent).toContain('parallel execution');
      expect(documentationContent).toContain('subtask tree');
      expect(documentationContent).toContain('expand/collapse');
      expect(documentationContent).toContain('interactive controls');
    });

    it('should document status bar components', () => {
      expect(documentationContent).toContain('⚡ APEX v0.3.0');
      expect(documentationContent).toContain('🪙 1.2K↑ 3.4K↓'); // Token counters
      expect(documentationContent).toContain('💰 $0.12'); // Cost tracker
      expect(documentationContent).toContain('⏱️ 00:04:23'); // Timer
      expect(documentationContent).toContain('🌿 main'); // Git branch
    });

    it('should include session management features', () => {
      expect(documentationContent).toContain('Session Persistence');
      expect(documentationContent).toContain('Session Export');
      expect(documentationContent).toContain('/sessions');
      expect(documentationContent).toContain('/load');
      expect(documentationContent).toContain('/export');
      expect(documentationContent).toContain('/branch');
    });
  });

  describe('Technical Documentation Accuracy', () => {
    it('should document correct component file paths', () => {
      expect(documentationContent).toContain('packages/cli/src/ui/components/');
      expect(documentationContent).toContain('StreamingText.tsx');
      expect(documentationContent).toContain('MarkdownRenderer.tsx');
      expect(documentationContent).toContain('AgentPanel.tsx');
      expect(documentationContent).toContain('StatusBar.tsx');
    });

    it('should include correct dependency list', () => {
      const dependencies = [
        'ink', 'ink-syntax-highlight', 'marked',
        'shiki', 'fuse.js'
      ];

      dependencies.forEach(dep => {
        expect(documentationContent).toContain(dep);
      });
    });

    it('should document correct breakpoint thresholds', () => {
      expect(documentationContent).toContain('narrow: < 60');
      expect(documentationContent).toContain('compact: 60-79');
      expect(documentationContent).toContain('normal: 80-119');
      expect(documentationContent).toContain('wide: 120+');
    });

    it('should include terminal compatibility information', () => {
      expect(documentationContent).toContain('iTerm2');
      expect(documentationContent).toContain('Terminal.app');
      expect(documentationContent).toContain('Windows Terminal');
      expect(documentationContent).toContain('GNOME Terminal');
      expect(documentationContent).toContain('256-color');
      expect(documentationContent).toContain('Unicode Support');
    });
  });

  describe('Migration and Compatibility', () => {
    it('should document v0.2.x migration path', () => {
      expect(documentationContent).toContain('Migration from v0.2.x');
      expect(documentationContent).toContain('automatically gain');
      expect(documentationContent).toContain('No configuration changes');
      expect(documentationContent).toContain('Backward compatible');
      expect(documentationContent).toContain('Enhanced output');
    });

    it('should mention compatibility preservation', () => {
      expect(documentationContent).toContain('maintains full compatibility');
      expect(documentationContent).toContain('dramatically improving');
      expect(documentationContent).toContain('user experience');
    });
  });

  describe('Documentation Quality Checks', () => {
    it('should have proper section numbering', () => {
      const numberedSections = [
        '### 1.', '### 2.', '### 3.', '### 4.',
        '### 5.', '### 6.', '### 7.', '### 8.',
        '### 9.', '### 10.', '### 11.'
      ];

      numberedSections.forEach(section => {
        expect(documentationContent).toContain(section);
      });
    });

    it('should include comprehensive examples for each feature', () => {
      // Each major section should have usage examples
      const sectionsWithExamples = [
        'StreamingText Component',
        'StreamingResponse Component',
        'TypewriterText Component',
        'Agent Panel with Handoff Animations',
        'Persistent Status Bar',
        'Advanced Input with Preview'
      ];

      sectionsWithExamples.forEach(section => {
        expect(documentationContent).toContain(section);
      });
    });

    it('should maintain consistent formatting', () => {
      // Check for consistent code block formatting
      const codeBlocks = documentationContent.match(/```[\w]*\n[\s\S]*?\n```/g);
      expect(codeBlocks).toBeTruthy();
      expect(codeBlocks!.length).toBeGreaterThan(20); // Should have many examples

      // Check for consistent visual example formatting
      const visualBlocks = documentationContent.match(/```\n[\s\S]*?┌─[\s\S]*?└─[\s\S]*?\n```/g);
      expect(visualBlocks).toBeTruthy();
      expect(visualBlocks!.length).toBeGreaterThan(10); // Should have many visual examples
    });

    it('should have proper internal links and references', () => {
      // Should reference other sections appropriately
      expect(documentationContent).toContain('as documented');
      expect(documentationContent).toContain('described above');
      expect(documentationContent).toContain('mentioned in');
    });
  });

  describe('Markdown Rendering Documentation Validation', () => {
    it('should document all supported markdown elements', () => {
      const supportedElements = [
        'Headers (h1, h2, h3)',
        'Unordered and ordered lists',
        'Code blocks with syntax highlighting',
        'Inline code formatting',
        'Blockquotes',
        'Bold and italic text emphasis'
      ];

      supportedElements.forEach(element => {
        expect(documentationContent).toContain(element);
      });
    });

    it('should include before/after markdown examples', () => {
      expect(documentationContent).toContain('**Raw Markdown:**');
      expect(documentationContent).toContain('**Rendered Output:**');

      // Check for specific examples
      expect(documentationContent).toContain('```markdown\n# Primary Header\n## Secondary Header\n### Tertiary Header\n```');
      expect(documentationContent).toContain('```markdown\n### Unordered Lists\n- Feature planning');
      expect(documentationContent).toContain('```markdown\n### Ordered Lists\n1. Initialize project structure');
    });

    it('should include MarkdownRenderer component API documentation', () => {
      expect(documentationContent).toContain('MarkdownRenderer Component API');
      expect(documentationContent).toContain('**Basic Usage:**');
      expect(documentationContent).toContain('**Advanced Configuration:**');
      expect(documentationContent).toContain('**Component Properties:**');

      // API properties
      expect(documentationContent).toContain('content: string');
      expect(documentationContent).toContain('highlightLanguage?: string');
      expect(documentationContent).toContain('showLineNumbers?: boolean');
      expect(documentationContent).toContain('theme?: \'dark\' | \'light\' | \'auto\'');
      expect(documentationContent).toContain('responsive?: boolean');
      expect(documentationContent).toContain('streaming?: boolean');
      expect(documentationContent).toContain('onRenderComplete?: () => void');
    });

    it('should include responsive layout examples for markdown', () => {
      expect(documentationContent).toContain('#### Responsive Markdown Layout');
      expect(documentationContent).toContain('**Wide Terminal (120+ columns):**');
      expect(documentationContent).toContain('**Compact Terminal (60-79 columns):**');

      // Should show markdown content adapted to different terminal widths
      expect(documentationContent).toContain('Authentication Implementation Guide');
      expect(documentationContent).toContain('Auth Implementation');
    });

    it('should document color mapping for markdown elements', () => {
      expect(documentationContent).toContain('#### Color Reference for Markdown Elements');
      expect(documentationContent).toContain('**Color Mapping:**');
      expect(documentationContent).toContain('**Headers**: Cyan bold text');
      expect(documentationContent).toContain('**Bold text**: White bold or bright white');
      expect(documentationContent).toContain('**Italic text**: Yellow or bright yellow');
      expect(documentationContent).toContain('**Inline code**: Gray background with white text');
      expect(documentationContent).toContain('**Code blocks**: Syntax-highlighted');
      expect(documentationContent).toContain('**Blockquotes**: Left cyan border');
    });

    it('should include theme adaptation documentation', () => {
      expect(documentationContent).toContain('**Theme Adaptation:**');
      expect(documentationContent).toContain('// Dark theme (default)');
      expect(documentationContent).toContain('// Light theme');
      expect(documentationContent).toContain('header1: { color: \'cyanBright\', bold: true }');
      expect(documentationContent).toContain('code: { backgroundColor: \'bgGray\', color: \'white\' }');
    });

    it('should document integration with streaming components', () => {
      expect(documentationContent).toContain('#### Integration with Streaming Components');
      expect(documentationContent).toContain('renderAsMarkdown={true}');
      expect(documentationContent).toContain('**Streaming Markdown Output:**');

      // Should show example of streaming markdown with proper formatting
      expect(documentationContent).toContain('📝 documentation ● streaming...');
      expect(documentationContent).toContain('████ Implementation Plan');
    });

    it('should validate markdown examples are properly formatted', () => {
      // Check that all markdown code blocks are properly delimited
      const markdownBlocks = documentationContent.match(/```markdown\n[\s\S]*?\n```/g);
      expect(markdownBlocks).toBeTruthy();
      expect(markdownBlocks!.length).toBeGreaterThan(5);

      // Check that rendered output examples are properly formatted
      const renderedBlocks = documentationContent.match(/```\n[\s\S]*?┌─[\s\S]*?└─[\s\S]*?\n```/g);
      expect(renderedBlocks).toBeTruthy();
      expect(renderedBlocks!.length).toBeGreaterThan(5);
    });

    it('should include comprehensive TypeScript examples', () => {
      // Basic MarkdownRenderer usage
      expect(documentationContent).toContain('import { MarkdownRenderer } from \'@apex/cli/ui/components\';');
      expect(documentationContent).toContain('<MarkdownRenderer');
      expect(documentationContent).toContain('content={markdownString}');

      // Advanced configuration examples
      expect(documentationContent).toContain('customStyles={{');
      expect(documentationContent).toContain('interface MarkdownRendererProps');
    });
  });

  describe('Content Completeness', () => {
    it('should be substantial documentation (>40KB)', () => {
      expect(documentationContent.length).toBeGreaterThan(40000);
    });

    it('should cover all v0.3.0 features mentioned in overview', () => {
      // Extract features from overview and verify they have dedicated sections
      const overviewMatch = documentationContent.match(/## Overview([\s\S]*?)## Core Features/);
      expect(overviewMatch).toBeTruthy();

      const overview = overviewMatch![1];
      expect(overview).toContain('Rich Terminal UI');
      expect(overview).toContain('streaming output');
      expect(overview).toContain('multi-agent orchestration');
    });

    it('should provide actionable implementation guidance', () => {
      expect(documentationContent).toContain('Usage Examples');
      expect(documentationContent).toContain('Best Practices');
      expect(documentationContent).toContain('Implementation Architecture');
      expect(documentationContent).toContain('Performance Considerations');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing documentation file gracefully', () => {
      expect(() => {
        const content = readFileSync(documentationPath, 'utf-8');
        expect(content).toBeDefined();
      }).not.toThrow();
    });

    it('should validate all code examples have proper syntax', () => {
      // Extract TypeScript code blocks
      const tsCodeBlocks = documentationContent.match(/```typescript\n([\s\S]*?)\n```/g);

      if (tsCodeBlocks) {
        tsCodeBlocks.forEach(block => {
          // Basic syntax validation - should have proper JSX/TSX structure
          const code = block.replace(/```typescript\n/, '').replace(/\n```$/, '');

          // Should not have obviously malformed JSX
          expect(code).not.toMatch(/<[^>]*[^\/]>[\s\S]*?<\/[^>]*>/); // No malformed closing tags

          // If it contains React elements, should have proper structure
          if (code.includes('React.createElement') || code.includes('<')) {
            expect(code).not.toContain('< >'); // No malformed JSX
          }
        });
      }
    });
  });

  describe('Natural Language Interface Documentation Validation', () => {
    it('should contain comprehensive intent detection examples', () => {
      expect(documentationContent).toContain('#### Intent Detection Examples');
      expect(documentationContent).toContain('##### Commands vs Tasks vs Questions');

      // Commands examples
      expect(documentationContent).toContain('**Commands** are recognized by explicit prefixes');
      expect(documentationContent).toContain('🔍 Intent: command');
      expect(documentationContent).toContain('📊 Confidence: 100%');

      // Tasks examples
      expect(documentationContent).toContain('**Tasks** are natural language requests');
      expect(documentationContent).toContain('🔍 Intent: task');
      expect(documentationContent).toContain('🤖 Agent Assignment: architect → planner → developer');

      // Questions examples
      expect(documentationContent).toContain('**Questions** seek information without requiring code changes');
      expect(documentationContent).toContain('🔍 Intent: question');
      expect(documentationContent).toContain('🤖 Agent Assignment: None (direct analysis)');
    });

    it('should include clarification flows for ambiguous input', () => {
      expect(documentationContent).toContain('##### Ambiguous Input Handling');
      expect(documentationContent).toContain('When intent is unclear, APEX engages in clarification flows');
      expect(documentationContent).toContain('apex> Fix the bug');
      expect(documentationContent).toContain('🔍 Intent: task (uncertain)');
      expect(documentationContent).toContain('📊 Confidence: 45%');
      expect(documentationContent).toContain('⚠️ Clarification needed');
      expect(documentationContent).toContain('┌─ Clarification Required');
      expect(documentationContent).toContain('🔍 What bug would you like me to fix?');
    });

    it('should include contextual suggestions with project context analysis', () => {
      expect(documentationContent).toContain('##### Contextual Suggestions');
      expect(documentationContent).toContain('APEX provides intelligent suggestions based on project context');
      expect(documentationContent).toContain('apex> add auth');
      expect(documentationContent).toContain('🔍 Analyzing project context...');
      expect(documentationContent).toContain('📁 Detected: React + TypeScript project');
      expect(documentationContent).toContain('🔧 Dependencies: @auth0/auth0-react found');
      expect(documentationContent).toContain('💡 Contextual Suggestions:');
      expect(documentationContent).toContain('🔐 Authentication Features:');
      expect(documentationContent).toContain('→ "Add Auth0 login integration"');
    });

    it('should demonstrate multi-step task detection and breakdown', () => {
      expect(documentationContent).toContain('##### Multi-step Task Detection');
      expect(documentationContent).toContain('APEX recognizes complex, multi-step requests');
      expect(documentationContent).toContain('apex> Create a blog system with posts, comments, and user profiles');
      expect(documentationContent).toContain('🔍 Intent: complex_task');
      expect(documentationContent).toContain('🏗️ Multi-step workflow detected');
      expect(documentationContent).toContain('┌─ Task Breakdown');
      expect(documentationContent).toContain('📋 Detected Components:');
      expect(documentationContent).toContain('1️⃣ Blog Posts System');
      expect(documentationContent).toContain('2️⃣ Comments System');
      expect(documentationContent).toContain('3️⃣ User Profiles');
    });

    it('should include context-aware modifications examples', () => {
      expect(documentationContent).toContain('##### Context-Aware Modifications');
      expect(documentationContent).toContain('APEX understands references to previous work');
      expect(documentationContent).toContain('apex> Make the authentication more secure');
      expect(documentationContent).toContain('🔍 Intent: task (context-dependent)');
      expect(documentationContent).toContain('🧠 Context Analysis: Previous authentication task found');
      expect(documentationContent).toContain('🔍 Found previous work: JWT Authentication System');
      expect(documentationContent).toContain('🛡️ Security Enhancement Options:');
    });

    it('should include natural language command patterns', () => {
      expect(documentationContent).toContain('#### Natural Language Command Patterns');
      expect(documentationContent).toContain('##### Imperative Commands');
      expect(documentationContent).toContain('##### Descriptive Requests');
      expect(documentationContent).toContain('##### Problem-Oriented Input');

      // Imperative examples
      expect(documentationContent).toContain('apex> Create a new component called UserProfile');
      expect(documentationContent).toContain('apex> Delete the old authentication code');

      // Descriptive examples
      expect(documentationContent).toContain('apex> I need a way for users to reset their passwords');
      expect(documentationContent).toContain('apex> The search functionality should be faster');

      // Problem-oriented examples
      expect(documentationContent).toContain('apex> The app crashes when users try to checkout');
      expect(documentationContent).toContain('apex> Load times are too slow on the product page');
    });

    it('should use consistent visual formatting and emoji indicators', () => {
      // Intent detection emojis
      expect(documentationContent).toContain('🔍');
      expect(documentationContent).toContain('📊');
      expect(documentationContent).toContain('🤖');
      expect(documentationContent).toContain('⚡');
      expect(documentationContent).toContain('💡');
      expect(documentationContent).toContain('🧠');

      // Box drawing characters for dialogs
      expect(documentationContent).toContain('┌─');
      expect(documentationContent).toContain('└─');
      expect(documentationContent).toContain('│');

      // Consistent prompt format
      const promptPattern = /apex> [^\n]+/g;
      const prompts = documentationContent.match(promptPattern);
      expect(prompts).toBeTruthy();
      expect(prompts!.length).toBeGreaterThan(15);
    });

    it('should include realistic confidence scores and agent assignments', () => {
      // Check for various confidence scores
      const confidenceScores = documentationContent.match(/📊 Confidence: (\d+)%/g);
      expect(confidenceScores).toBeTruthy();
      expect(confidenceScores!.length).toBeGreaterThan(10);

      // Validate confidence score ranges
      confidenceScores!.forEach(match => {
        const score = parseInt(match.match(/\d+/)![0]);
        expect(score).toBeGreaterThanOrEqual(40);
        expect(score).toBeLessThanOrEqual(100);
      });

      // Check for various agent assignments
      expect(documentationContent).toContain('🤖 Agent Assignment: None (direct analysis)');
      expect(documentationContent).toContain('🤖 Agent Assignment: developer');
      expect(documentationContent).toContain('🤖 Agent Assignment: tester → developer');
    });
  });
});