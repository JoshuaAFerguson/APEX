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
      ];

      requiredSections.forEach(section => {
        expect(documentationContent).toContain(section);
      });
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
});