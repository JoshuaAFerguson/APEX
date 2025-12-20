import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse } from '../StreamingText';
import { MarkdownRenderer, SimpleMarkdownRenderer } from '../MarkdownRenderer';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(),
    setOptions: vi.fn(),
  },
}));

// Mock marked-terminal
vi.mock('marked-terminal', () => ({
  markedTerminal: vi.fn(() => ({})),
}));

describe('Responsive Width Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Default mock for marked.parse
    const { marked } = require('marked');
    marked.parse.mockImplementation((content: string) => {
      // Simple mock implementation
      return content.replace(/^# (.+)/gm, '<h1>$1</h1>')
                   .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.+?)\*/g, '<em>$1</em>');
    });

    // Default dimensions
    mockUseStdoutDimensions.mockReturnValue({
      width: 80,
      height: 24,
      breakpoint: 'normal',
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Component consistency across terminal sizes', () => {
    const testContent = "This is test content that should behave consistently across different components";

    it('should have consistent width behavior across all components in narrow terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      // Render all components
      const { container: streamingContainer } = render(
        <StreamingText text={testContent} isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content={testContent} />
      );

      const { container: simpleMarkdownContainer } = render(
        <SimpleMarkdownRenderer content={testContent} />
      );

      // All should enforce minimum width of 40
      expect(streamingContainer.firstChild).toHaveAttribute('width', '40');
      expect(markdownContainer.firstChild).toHaveAttribute('width', '40');
      expect(simpleMarkdownContainer.firstChild).toHaveAttribute('width', '40');
    });

    it('should have consistent width behavior in normal terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
      });

      // Render all components
      const { container: streamingContainer } = render(
        <StreamingText text={testContent} isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content={testContent} />
      );

      const { container: simpleMarkdownContainer } = render(
        <SimpleMarkdownRenderer content={testContent} />
      );

      // All should use width - 2 = 118
      expect(streamingContainer.firstChild).toHaveAttribute('width', '118');
      expect(markdownContainer.firstChild).toHaveAttribute('width', '118');
      expect(simpleMarkdownContainer.firstChild).toHaveAttribute('width', '118');
    });

    it('should have consistent width behavior in wide terminals', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
      });

      // Render all components
      const { container: streamingContainer } = render(
        <StreamingText text={testContent} isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content={testContent} />
      );

      const { container: simpleMarkdownContainer } = render(
        <SimpleMarkdownRenderer content={testContent} />
      );

      // All should use width - 2 = 198
      expect(streamingContainer.firstChild).toHaveAttribute('width', '198');
      expect(markdownContainer.firstChild).toHaveAttribute('width', '198');
      expect(simpleMarkdownContainer.firstChild).toHaveAttribute('width', '198');
    });
  });

  describe('StreamingResponse integration with responsive components', () => {
    it('should properly integrate with responsive StreamingText', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 25,
        breakpoint: 'normal',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="This is a streaming response with responsive width behavior"
          agent="developer"
          isComplete={true}
        />
      );

      // Should render the response content
      expect(screen.getByText(/This is a streaming response/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('✓ Complete')).toBeInTheDocument();
    });

    it('should handle nested responsive components properly', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      // StreamingResponse contains StreamingText internally
      render(
        <StreamingResponse
          content="Testing nested responsive behavior in compact terminals"
          agent="tester"
          isStreaming={false}
          isComplete={true}
        />
      );

      // Content should be properly rendered
      expect(screen.getByText(/Testing nested responsive/)).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('Terminal resize simulation', () => {
    it('should adapt when terminal size changes from wide to narrow', () => {
      // Start with wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 40,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { container, rerender } = render(
        <StreamingText text="Responsive text that adapts to terminal changes" isComplete={true} />
      );

      // Should use wide width initially
      expect(container.firstChild).toHaveAttribute('width', '148');

      // Simulate terminal resize to narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      rerender(
        <StreamingText text="Responsive text that adapts to terminal changes" isComplete={true} />
      );

      // Should now use minimum width
      expect(container.firstChild).toHaveAttribute('width', '40');
    });

    it('should adapt when terminal size changes from narrow to wide', () => {
      // Start with narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 35,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container, rerender } = render(
        <MarkdownRenderer content="# Adaptive markdown content" />
      );

      // Should use minimum width initially
      expect(container.firstChild).toHaveAttribute('width', '40');

      // Simulate terminal resize to wide
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
      });

      rerender(
        <MarkdownRenderer content="# Adaptive markdown content" />
      );

      // Should now use wide width
      expect(container.firstChild).toHaveAttribute('width', '178');
    });
  });

  describe('Explicit width vs responsive width', () => {
    it('should honor explicit width over responsive calculations for all components', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 40,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const explicitWidth = 75;

      // Test all components with explicit width
      const { container: streamingContainer } = render(
        <StreamingText text="Explicit width test" width={explicitWidth} isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="# Explicit width test" width={explicitWidth} />
      );

      const { container: simpleMarkdownContainer } = render(
        <SimpleMarkdownRenderer content="# Explicit width test" width={explicitWidth} />
      );

      // All should use explicit width
      expect(streamingContainer.firstChild).toHaveAttribute('width', explicitWidth.toString());
      expect(markdownContainer.firstChild).toHaveAttribute('width', explicitWidth.toString());
      expect(simpleMarkdownContainer.firstChild).toHaveAttribute('width', explicitWidth.toString());
    });

    it('should disable responsive behavior when responsive=false for all components', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 40,
        breakpoint: 'normal',
        isAvailable: true,
      });

      // Test all components with responsive=false
      const { container: streamingContainer } = render(
        <StreamingText text="Non-responsive test" responsive={false} isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="# Non-responsive test" responsive={false} />
      );

      const { container: simpleMarkdownContainer } = render(
        <SimpleMarkdownRenderer content="# Non-responsive test" responsive={false} />
      );

      // StreamingText should not have width when responsive=false and no explicit width
      expect(streamingContainer.firstChild).not.toHaveAttribute('width');

      // Markdown components should use default width of 80
      expect(markdownContainer.firstChild).toHaveAttribute('width', '80');
      expect(simpleMarkdownContainer.firstChild).toHaveAttribute('width', '80');
    });
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle useStdoutDimensions hook failure gracefully', () => {
      // Mock hook to return undefined/null values
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback
        height: 24,
        breakpoint: 'normal',
        isAvailable: false,
      });

      // All components should still work with fallback values
      const { container: streamingContainer } = render(
        <StreamingText text="Fallback test" isComplete={true} />
      );

      const { container: markdownContainer } = render(
        <MarkdownRenderer content="# Fallback test" />
      );

      // Should use fallback dimensions
      expect(streamingContainer.firstChild).toHaveAttribute('width', '78');
      expect(markdownContainer.firstChild).toHaveAttribute('width', '78');
    });

    it('should handle extremely small and large terminal sizes', () => {
      // Test extremely small terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Extremely small
        height: 5,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { container: smallContainer } = render(
        <StreamingText text="Very narrow test" isComplete={true} />
      );

      // Should enforce minimum width
      expect(smallContainer.firstChild).toHaveAttribute('width', '40');

      // Test extremely large terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 500, // Extremely large
        height: 100,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const { container: largeContainer } = render(
        <StreamingText text="Very wide test" isComplete={true} />
      );

      // Should handle large width gracefully
      expect(largeContainer.firstChild).toHaveAttribute('width', '498');
    });
  });

  describe('Content overflow and wrapping integration', () => {
    it('should handle long content consistently across components in narrow terminals', () => {
      const longContent = 'This is an extremely long line of text that should be handled consistently across all responsive components when the terminal width is constrained to test proper text wrapping and overflow behavior in narrow terminals';

      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 20,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      // Render all components with long content
      render(<StreamingText text={longContent} isComplete={true} />);
      render(<MarkdownRenderer content={longContent} />);
      render(<SimpleMarkdownRenderer content={longContent} />);

      // All should render the content (specific text wrapping behavior depends on implementation)
      expect(screen.getAllByText(/This is an extremely long/)).toHaveLength(3);
    });

    it('should handle markdown-specific content formatting with responsive width', () => {
      const markdownContent = `
# Main Header That Is Very Long And Should Wrap Properly

This is a paragraph with **bold text** and *italic text* and \`inline code\`.

## Subheader

- List item one with long text that should wrap
- List item two with even longer text that definitely needs wrapping
- List item three

> This is a blockquote with very long text that should wrap properly in narrow terminals while maintaining proper formatting and visual hierarchy

\`\`\`javascript
const longVariableName = 'This is a code block with long content that should also respect terminal width constraints';
\`\`\`
      `;

      mockUseStdoutDimensions.mockReturnValue({
        width: 70,
        height: 30,
        breakpoint: 'compact',
        isAvailable: true,
      });

      render(<MarkdownRenderer content={markdownContent} />);
      render(<SimpleMarkdownRenderer content={markdownContent} />);

      // Both markdown renderers should handle the content
      expect(screen.getAllByText(/Main Header/)).toHaveLength(2);
      expect(screen.getAllByText(/This is a paragraph/)).toHaveLength(2);
    });
  });
});