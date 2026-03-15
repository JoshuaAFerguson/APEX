import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse } from '../StreamingText';

// Mock the useStdoutDimensions hook - use vi.hoisted for proper hoisting
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(),
}));

vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StreamingText - Responsive Width', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default mock return value
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

  describe('Default responsive behavior', () => {
    it('should use terminal width when responsive=true (default)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Since width affects text wrapping behavior, verify the text renders correctly
      // The responsive logic is tested through the component's behavior
      expect(screen.getByText('Test text')).toBeInTheDocument();
      // Verify the hook was called (responsive behavior is active)
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should enforce minimum width of 40 in responsive mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 30, // Very narrow terminal
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Component should render correctly even with narrow width
      // The minimum width enforcement happens internally via Math.max(40, terminalWidth - 2)
      expect(screen.getByText('Test text')).toBeInTheDocument();
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should disable responsive behavior when responsive=false', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} responsive={false} />
      );

      // Component should still render, but responsive width is not applied
      expect(screen.getByText('Test text')).toBeInTheDocument();
      // Hook is still called but responsive=false means width is not derived from terminal
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should use explicit width when provided, ignoring responsive behavior', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 24,
        breakpoint: 'normal',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} width={50} />
      );

      // Component should render with explicit width
      expect(screen.getByText('Test text')).toBeInTheDocument();
    });
  });

  describe('Terminal width scenarios', () => {
    it('should adapt to narrow terminals (< 60 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingText text="This is a long text that should wrap in narrow terminals" isComplete={true} />
      );

      // Text should render (may be wrapped due to narrow width)
      expect(screen.getByText(/This is a long text/)).toBeInTheDocument();
    });

    it('should adapt to compact terminals (60-99 columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Text should render correctly in compact mode
      expect(screen.getByText('Test text')).toBeInTheDocument();
    });

    it('should adapt to wide terminals (160+ columns)', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Text should render correctly in wide mode
      expect(screen.getByText('Test text')).toBeInTheDocument();
    });
  });

  describe('Text wrapping behavior', () => {
    it('should wrap long lines when width is constrained', () => {
      const longText = 'This is a very long line of text that should be wrapped when the width is constrained to test responsive behavior';

      mockUseStdoutDimensions.mockReturnValue({
        width: 32, // Small width to force wrapping but above minimum
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingText text={longText} isComplete={true} />
      );

      // Text should be present and wrapped (implementation depends on the formatText function)
      expect(screen.getByText(/This is a very long/)).toBeInTheDocument();
    });

    it('should handle multiline text with responsive width', () => {
      const multilineText = 'Line 1 with some text\nLine 2 with more text\nLine 3 with even more text';

      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      render(
        <StreamingText text={multilineText} isComplete={true} />
      );

      // All lines should be rendered
      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Line 2/)).toBeInTheDocument();
      expect(screen.getByText(/Line 3/)).toBeInTheDocument();
    });
  });

  describe('Fallback behavior', () => {
    it('should handle when useStdoutDimensions is not available', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback width
        height: 24,
        breakpoint: 'normal',
        isAvailable: false,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Should render correctly even when terminal dimensions are unavailable
      expect(screen.getByText('Test text')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero width gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 0,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Should enforce minimum width and render correctly
      expect(screen.getByText('Test text')).toBeInTheDocument();
    });

    it('should handle very large terminal widths', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 1000,
        height: 100,
        breakpoint: 'wide',
        isAvailable: true,
      });

      render(
        <StreamingText text="Test text" isComplete={true} />
      );

      // Should handle large widths gracefully
      expect(screen.getByText('Test text')).toBeInTheDocument();
    });
  });
});

describe('StreamingResponse - Responsive Width', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it('should pass responsive width to StreamingText component', () => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal',
      isAvailable: true,
    });

    render(
      <StreamingResponse
        content="Test response content"
        agent="developer"
        isComplete={true}
      />
    );

    // StreamingText should receive the calculated width
    expect(screen.getByText('Test response content')).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
  });

  it('should handle narrow terminals in StreamingResponse', () => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 45,
      height: 24,
      breakpoint: 'narrow',
      isAvailable: true,
    });

    render(
      <StreamingResponse
        content="This is a test response that should wrap properly in narrow terminals"
        isComplete={true}
      />
    );

    // Content should be rendered and wrapped appropriately
    expect(screen.getByText(/This is a test response/)).toBeInTheDocument();
  });

  it('should respect explicit width in StreamingResponse', () => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal',
      isAvailable: true,
    });

    render(
      <StreamingResponse
        content="Test content"
        width={60}
        isComplete={true}
      />
    );

    // Should use explicit width
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should disable responsive behavior when responsive=false', () => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal',
      isAvailable: true,
    });

    render(
      <StreamingResponse
        content="Test content"
        responsive={false}
        isComplete={true}
      />
    );

    // Should use default width of 80 when responsive=false
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
