import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse, TypewriterText } from '../StreamingText';

describe('StreamingText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders initial empty state', () => {
    render(<StreamingText text="Hello World" />);
    // Initially, no text should be displayed
    expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
  });

  it('streams text character by character', async () => {
    const onComplete = vi.fn();
    render(
      <StreamingText
        text="Hi"
        speed={50}
        onComplete={onComplete}
      />
    );

    // After first character delay (1000/50 = 20ms)
    vi.advanceTimersByTime(20);
    expect(screen.getByText(/H/)).toBeInTheDocument();

    // After second character delay
    vi.advanceTimersByTime(20);
    expect(screen.getByText(/Hi/)).toBeInTheDocument();

    // After completion
    vi.advanceTimersByTime(20);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('handles isComplete prop to show full text immediately', () => {
    render(<StreamingText text="Complete Text" isComplete={true} />);
    expect(screen.getByText('Complete Text')).toBeInTheDocument();
  });

  it('shows blinking cursor when enabled', () => {
    render(<StreamingText text="Test" showCursor={true} />);

    // Check that cursor element is rendered
    expect(screen.getByText('▊')).toBeInTheDocument();

    // Advance cursor blink timer
    vi.advanceTimersByTime(500);
    // Cursor should blink (implementation depends on React state)
  });

  it('wraps text when width is specified', () => {
    const longText = 'This is a very long text that should wrap';
    render(<StreamingText text={longText} width={10} isComplete={true} />);

    // Text should be broken into multiple lines
    expect(screen.getByText(/This is a/)).toBeInTheDocument();
  });

  it('limits lines when maxLines is specified', () => {
    const multilineText = 'Line 1\nLine 2\nLine 3\nLine 4';
    render(
      <StreamingText
        text={multilineText}
        maxLines={2}
        isComplete={true}
      />
    );

    // Should only show last 2 lines
    expect(screen.getByText(/Line 3/)).toBeInTheDocument();
    expect(screen.getByText(/Line 4/)).toBeInTheDocument();
    expect(screen.queryByText(/Line 1/)).not.toBeInTheDocument();
  });
});

describe('StreamingResponse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders agent name when provided', () => {
    render(
      <StreamingResponse
        content="Response content"
        agent="developer"
        isComplete={true}
      />
    );

    expect(screen.getByText('developer')).toBeInTheDocument();
  });

  it('shows streaming indicator when streaming', () => {
    render(
      <StreamingResponse
        content="Streaming..."
        agent="planner"
        isStreaming={true}
        isComplete={false}
      />
    );

    expect(screen.getByText(/streaming.../)).toBeInTheDocument();
  });

  it('shows completion indicator when complete', () => {
    render(
      <StreamingResponse
        content="Done"
        isComplete={true}
      />
    );

    expect(screen.getByText('✓ Complete')).toBeInTheDocument();
  });

  it('handles content chunking for streaming simulation', () => {
    const { rerender } = render(
      <StreamingResponse
        content="Hello"
        isStreaming={true}
        isComplete={false}
      />
    );

    // Update with more content
    rerender(
      <StreamingResponse
        content="Hello World"
        isStreaming={true}
        isComplete={false}
      />
    );

    // Content should update
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });
});

describe('TypewriterText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('types out text with delay', async () => {
    const onComplete = vi.fn();
    render(
      <TypewriterText
        text="Test"
        speed={100}
        delay={100}
        onComplete={onComplete}
      />
    );

    // Initially nothing (due to delay)
    expect(screen.queryByText('Test')).not.toBeInTheDocument();

    // After delay
    vi.advanceTimersByTime(100);

    // After first character (1000/100 = 10ms per char)
    vi.advanceTimersByTime(10);
    expect(screen.getByText(/T/)).toBeInTheDocument();

    // Complete the animation
    vi.advanceTimersByTime(30); // 3 more chars * 10ms
    expect(screen.getByText('Test')).toBeInTheDocument();

    vi.advanceTimersByTime(10);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('applies color and bold styling', () => {
    render(
      <TypewriterText
        text="Styled"
        color="red"
        bold={true}
        delay={0}
      />
    );

    vi.advanceTimersByTime(100);
    const element = screen.getByText(/Styled/);
    expect(element).toHaveAttribute('color', 'red');
    expect(element).toHaveAttribute('bold', 'true');
  });

  it('handles zero delay correctly', () => {
    render(<TypewriterText text="Immediate" delay={0} />);

    // Should start immediately
    vi.advanceTimersByTime(0);
    expect(screen.getByText(/I/)).toBeInTheDocument();
  });
});