/**
 * Comprehensive unit tests for ThoughtDisplay component
 * Tests all functionality in isolation from AgentPanel integration
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { ThoughtDisplay, ThoughtDisplayProps } from '../ThoughtDisplay';
import type { DisplayMode } from '@apexcli/core';

// Mock Ink components for unit testing
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) =>
    React.createElement('div', { 'data-testid': 'box', ...props }, children),
  Text: ({ children, ...props }: any) =>
    React.createElement('span', { 'data-testid': 'text', ...props }, children),
}));

describe('ThoughtDisplay Component Unit Tests', () => {
  const defaultProps: ThoughtDisplayProps = {
    thinking: 'Default thinking content',
    agent: 'test-agent',
    displayMode: 'normal',
    compact: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering Behavior', () => {
    it('renders thinking content with agent name in normal mode', () => {
      render(<ThoughtDisplay {...defaultProps} />);

      expect(screen.getByTestId('box')).toBeInTheDocument();
      expect(screen.getByText(/test-agent thinking/)).toBeInTheDocument();
      expect(screen.getByText('Default thinking content')).toBeInTheDocument();
    });

    it('renders with correct structure and styling', () => {
      const { container } = render(<ThoughtDisplay {...defaultProps} />);

      const boxes = container.querySelectorAll('[data-testid="box"]');
      const texts = container.querySelectorAll('[data-testid="text"]');

      // Should have nested box structure
      expect(boxes.length).toBeGreaterThan(1);
      // Should have multiple text elements (header and content)
      expect(texts.length).toBeGreaterThan(1);
    });

    it('includes thinking emoji in header', () => {
      render(<ThoughtDisplay {...defaultProps} />);

      expect(screen.getByText(/💭.*thinking/)).toBeInTheDocument();
    });
  });

  describe('DisplayMode Handling', () => {
    it('handles normal display mode correctly', () => {
      const longContent = 'A'.repeat(400);
      render(
        <ThoughtDisplay
          thinking={longContent}
          agent="normal-agent"
          displayMode="normal"
        />
      );

      // Should show truncation for content over 300 chars
      expect(screen.getByText(/\(truncated from 400 chars\)/)).toBeInTheDocument();
      expect(screen.getByText(/A+\.\.\./)).toBeInTheDocument();
    });

    it('handles verbose display mode correctly', () => {
      const longContent = 'B'.repeat(800);
      render(
        <ThoughtDisplay
          thinking={longContent}
          agent="verbose-agent"
          displayMode="verbose"
        />
      );

      // Should NOT show truncation for content under 1000 chars
      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('handles verbose mode with truncation for very long content', () => {
      const veryLongContent = 'C'.repeat(1200);
      render(
        <ThoughtDisplay
          thinking={veryLongContent}
          agent="verbose-agent"
          displayMode="verbose"
        />
      );

      // Should show truncation for content over 1000 chars in verbose mode
      expect(screen.getByText(/\(truncated from 1200 chars\)/)).toBeInTheDocument();
      expect(screen.getByText(/C+\.\.\./)).toBeInTheDocument();
    });

    it('returns empty box in compact display mode', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Should not be visible"
          agent="compact-agent"
          displayMode="compact"
        />
      );

      // Should render an empty box
      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes.length).toBe(1);

      // Should not contain thinking content
      expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
      expect(screen.queryByText(/compact-agent thinking/)).not.toBeInTheDocument();
    });

    it('defaults to normal mode when displayMode is undefined', () => {
      const content300Chars = 'D'.repeat(300);
      render(
        <ThoughtDisplay
          thinking={content300Chars}
          agent="default-agent"
          // displayMode not specified
        />
      );

      // Should use normal mode behavior (no truncation at exactly 300 chars)
      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
      expect(screen.getByText(content300Chars)).toBeInTheDocument();
    });
  });

  describe('Compact Prop Handling', () => {
    it('returns empty box when compact prop is true', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Should not be visible"
          agent="compact-prop-agent"
          compact={true}
        />
      );

      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes.length).toBe(1);

      expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
      expect(screen.queryByText(/compact-prop-agent thinking/)).not.toBeInTheDocument();
    });

    it('renders normally when compact prop is false', () => {
      render(
        <ThoughtDisplay
          thinking="Should be visible"
          agent="non-compact-agent"
          compact={false}
        />
      );

      expect(screen.getByText('Should be visible')).toBeInTheDocument();
      expect(screen.getByText(/non-compact-agent thinking/)).toBeInTheDocument();
    });

    it('defaults to false when compact prop is undefined', () => {
      render(
        <ThoughtDisplay
          thinking="Default compact behavior"
          agent="default-compact-agent"
          // compact not specified
        />
      );

      expect(screen.getByText('Default compact behavior')).toBeInTheDocument();
      expect(screen.getByText(/default-compact-agent thinking/)).toBeInTheDocument();
    });

    it('prioritizes compact prop over displayMode when both suggest hiding', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Should not be visible"
          agent="both-compact-agent"
          compact={true}
          displayMode="compact"
        />
      );

      const boxes = container.querySelectorAll('[data-testid="box"]');
      expect(boxes.length).toBe(1);

      expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
    });
  });

  describe('Truncation Logic', () => {
    it('does not truncate content at exact limit boundaries', () => {
      const exactly300 = 'E'.repeat(300);
      render(
        <ThoughtDisplay
          thinking={exactly300}
          agent="boundary-agent"
          displayMode="normal"
        />
      );

      expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
      expect(screen.getByText(exactly300)).toBeInTheDocument();
    });

    it('truncates content one character over limit', () => {
      const exactly301 = 'F'.repeat(301);
      render(
        <ThoughtDisplay
          thinking={exactly301}
          agent="over-boundary-agent"
          displayMode="normal"
        />
      );

      expect(screen.getByText(/\(truncated from 301 chars\)/)).toBeInTheDocument();
      expect(screen.getByText(/F+\.\.\./)).toBeInTheDocument();
      expect(screen.queryByText(exactly301)).not.toBeInTheDocument();
    });

    it('calculates truncation correctly for different display modes', () => {
      const testCases = [
        { mode: 'normal' as DisplayMode, length: 350, shouldTruncate: true, limit: 300 },
        { mode: 'verbose' as DisplayMode, length: 800, shouldTruncate: false, limit: 1000 },
        { mode: 'verbose' as DisplayMode, length: 1200, shouldTruncate: true, limit: 1000 },
      ];

      testCases.forEach(({ mode, length, shouldTruncate, limit }) => {
        const content = 'X'.repeat(length);
        const { unmount } = render(
          <ThoughtDisplay
            thinking={content}
            agent={`${mode}-${length}-agent`}
            displayMode={mode}
          />
        );

        if (shouldTruncate) {
          expect(screen.getByText(new RegExp(`\\(truncated from ${length} chars\\)`))).toBeInTheDocument();
          expect(screen.getByText(new RegExp(`X+\\.\\.\.`))).toBeInTheDocument();
        } else {
          expect(screen.queryByText(/truncated from/)).not.toBeInTheDocument();
          expect(screen.getByText(content)).toBeInTheDocument();
        }

        unmount();
      });
    });

    it('preserves original content length information in truncation message', () => {
      const originalLength = 12345;
      const longContent = 'G'.repeat(originalLength);

      render(
        <ThoughtDisplay
          thinking={longContent}
          agent="length-info-agent"
          displayMode="normal"
        />
      );

      expect(screen.getByText(`(truncated from ${originalLength} chars)`)).toBeInTheDocument();
    });
  });

  describe('Agent Name Handling', () => {
    it('displays different agent types correctly', () => {
      const agentTypes = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      agentTypes.forEach(agentType => {
        const { unmount } = render(
          <ThoughtDisplay
            thinking={`${agentType} is working`}
            agent={agentType}
          />
        );

        expect(screen.getByText(`💭 ${agentType} thinking`)).toBeInTheDocument();
        expect(screen.getByText(`${agentType} is working`)).toBeInTheDocument();

        unmount();
      });
    });

    it('handles agent names with special characters', () => {
      const specialNames = [
        'agent-with-dashes',
        'agent_with_underscores',
        'Agent With Spaces',
        'agent.with.dots',
        'агент-кириллица', // Cyrillic
        'エージェント', // Japanese
      ];

      specialNames.forEach(name => {
        const { unmount } = render(
          <ThoughtDisplay
            thinking="Special character test"
            agent={name}
          />
        );

        expect(screen.getByText(`💭 ${name} thinking`)).toBeInTheDocument();

        unmount();
      });
    });

    it('handles empty agent name gracefully', () => {
      render(
        <ThoughtDisplay
          thinking="Empty agent name test"
          agent=""
        />
      );

      expect(screen.getByText('💭  thinking')).toBeInTheDocument();
      expect(screen.getByText('Empty agent name test')).toBeInTheDocument();
    });

    it('handles very long agent names', () => {
      const longAgentName = 'very-very-very-long-agent-name-that-might-cause-display-issues-in-some-scenarios';

      render(
        <ThoughtDisplay
          thinking="Long agent name test"
          agent={longAgentName}
        />
      );

      expect(screen.getByText(`💭 ${longAgentName} thinking`)).toBeInTheDocument();
    });
  });

  describe('Thinking Content Edge Cases', () => {
    it('handles empty thinking content', () => {
      render(
        <ThoughtDisplay
          thinking=""
          agent="empty-content-agent"
        />
      );

      expect(screen.getByText('💭 empty-content-agent thinking')).toBeInTheDocument();
      // Empty content should still create the structure
      expect(screen.getByText('')).toBeInTheDocument();
    });

    it('handles thinking content with only whitespace', () => {
      const whitespaceContent = '   \t\n\r   ';

      render(
        <ThoughtDisplay
          thinking={whitespaceContent}
          agent="whitespace-agent"
        />
      );

      expect(screen.getByText('💭 whitespace-agent thinking')).toBeInTheDocument();
      expect(screen.getByText(whitespaceContent)).toBeInTheDocument();
    });

    it('handles multiline thinking content', () => {
      const multilineContent = `Line 1 of thinking
Line 2 of thinking
Line 3 of thinking`;

      render(
        <ThoughtDisplay
          thinking={multilineContent}
          agent="multiline-agent"
        />
      );

      expect(screen.getByText('💭 multiline-agent thinking')).toBeInTheDocument();
      expect(screen.getByText(multilineContent)).toBeInTheDocument();
    });

    it('handles thinking content with special characters and symbols', () => {
      const specialContent = `
        Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?
        Unicode: 🚀 💡 ⚡ 🎯
        Math: ∑∆∞∫∂∇⊕⊗
        Quotes: "double" 'single' \`backtick\`
      `;

      render(
        <ThoughtDisplay
          thinking={specialContent}
          agent="special-chars-agent"
        />
      );

      expect(screen.getByText('💭 special-chars-agent thinking')).toBeInTheDocument();
      expect(screen.getByText(specialContent)).toBeInTheDocument();
    });

    it('handles thinking content with HTML-like strings', () => {
      const htmlLikeContent = '<div>This looks like HTML but should be treated as text</div>';

      render(
        <ThoughtDisplay
          thinking={htmlLikeContent}
          agent="html-like-agent"
        />
      );

      expect(screen.getByText('💭 html-like-agent thinking')).toBeInTheDocument();
      expect(screen.getByText(htmlLikeContent)).toBeInTheDocument();
    });

    it('handles thinking content with escape sequences', () => {
      const escapeContent = 'Content with \\n newlines \\t tabs \\r returns and \\\" quotes';

      render(
        <ThoughtDisplay
          thinking={escapeContent}
          agent="escape-agent"
        />
      );

      expect(screen.getByText('💭 escape-agent thinking')).toBeInTheDocument();
      expect(screen.getByText(escapeContent)).toBeInTheDocument();
    });
  });

  describe('Component Integration Points', () => {
    it('provides correct props structure for Ink components', () => {
      const { container } = render(
        <ThoughtDisplay
          thinking="Integration test content"
          agent="integration-agent"
        />
      );

      const boxes = container.querySelectorAll('[data-testid="box"]');
      const texts = container.querySelectorAll('[data-testid="text"]');

      // Should have the expected structure
      expect(boxes.length).toBeGreaterThan(0);
      expect(texts.length).toBeGreaterThan(0);

      // Should contain expected content
      expect(screen.getByText('Integration test content')).toBeInTheDocument();
      expect(screen.getByText(/integration-agent thinking/)).toBeInTheDocument();
    });

    it('maintains referential stability for static content', () => {
      const staticProps = {
        thinking: 'Static content',
        agent: 'static-agent',
        displayMode: 'normal' as DisplayMode,
        compact: false,
      };

      const { rerender } = render(<ThoughtDisplay {...staticProps} />);

      const initialContent = screen.getByText('Static content');
      const initialHeader = screen.getByText(/static-agent thinking/);

      // Re-render with same props
      rerender(<ThoughtDisplay {...staticProps} />);

      // Content should still be there
      expect(screen.getByText('Static content')).toBeInTheDocument();
      expect(screen.getByText(/static-agent thinking/)).toBeInTheDocument();
    });

    it('responds correctly to prop changes', () => {
      const initialProps: ThoughtDisplayProps = {
        thinking: 'Initial content',
        agent: 'changeable-agent',
        displayMode: 'normal',
      };

      const { rerender } = render(<ThoughtDisplay {...initialProps} />);

      expect(screen.getByText('Initial content')).toBeInTheDocument();
      expect(screen.getByText(/changeable-agent thinking/)).toBeInTheDocument();

      // Change thinking content
      rerender(
        <ThoughtDisplay
          {...initialProps}
          thinking="Updated content"
        />
      );

      expect(screen.getByText('Updated content')).toBeInTheDocument();
      expect(screen.queryByText('Initial content')).not.toBeInTheDocument();

      // Change agent name
      rerender(
        <ThoughtDisplay
          {...initialProps}
          thinking="Updated content"
          agent="new-agent-name"
        />
      );

      expect(screen.getByText(/new-agent-name thinking/)).toBeInTheDocument();
      expect(screen.queryByText(/changeable-agent thinking/)).not.toBeInTheDocument();

      // Change display mode
      rerender(
        <ThoughtDisplay
          {...initialProps}
          thinking="Updated content"
          agent="new-agent-name"
          displayMode="compact"
        />
      );

      // Should hide content in compact mode
      expect(screen.queryByText('Updated content')).not.toBeInTheDocument();
      expect(screen.queryByText(/new-agent-name thinking/)).not.toBeInTheDocument();
    });
  });

  describe('Performance Characteristics', () => {
    it('renders efficiently with large content', () => {
      const largeContent = 'Large content string. '.repeat(10000); // ~200KB

      const startTime = performance.now();

      render(
        <ThoughtDisplay
          thinking={largeContent}
          agent="performance-agent"
          displayMode="verbose"
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with large content
      expect(renderTime).toBeLessThan(100); // Less than 100ms

      // Content should be truncated appropriately
      expect(screen.getByText(/\(truncated from/)).toBeInTheDocument();
    });

    it('handles rapid re-renders efficiently', () => {
      const contents = Array.from({ length: 100 }, (_, i) => `Content ${i}`);

      const startTime = performance.now();

      const { rerender } = render(
        <ThoughtDisplay
          thinking={contents[0]}
          agent="rapid-render-agent"
        />
      );

      // Rapid re-renders
      contents.forEach(content => {
        rerender(
          <ThoughtDisplay
            thinking={content}
            agent="rapid-render-agent"
          />
        );
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle 100 re-renders quickly
      expect(totalTime).toBeLessThan(1000); // Less than 1 second

      // Final content should be correct
      expect(screen.getByText('Content 99')).toBeInTheDocument();
    });
  });
});