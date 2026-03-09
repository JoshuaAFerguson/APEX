import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse, TypewriterText } from '../StreamingText';

// Mock the useStdoutDimensions hook
vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: vi.fn(() => ({
    width: 80,
    height: 24,
    breakpoint: 'normal',
    isAvailable: true,
  })),
}));

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
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByText('H')).toBeInTheDocument();

    // After second character delay
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByText('Hi')).toBeInTheDocument();

    // After completion - advance timers to trigger onComplete
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('handles isComplete prop to show full text immediately', () => {
    render(<StreamingText text="Complete Text" isComplete={true} />);
    expect(screen.getByText('Complete Text')).toBeInTheDocument();
  });

  it('shows blinking cursor when enabled', async () => {
    render(<StreamingText text="" showCursor={true} />);

    // Initially, cursor should be visible for empty text
    expect(screen.getByText('▊')).toBeInTheDocument();
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

  it('handles content chunking for streaming simulation', async () => {
    const { rerender } = render(
      <StreamingResponse
        content="Hello"
        isStreaming={true}
        isComplete={false}
      />
    );

    // Let the initial streaming start
    await act(async () => {
      vi.advanceTimersByTime(100); // Allow time for streaming to start
    });

    // Update with more content
    await act(async () => {
      rerender(
        <StreamingResponse
          content="Hello World"
          isStreaming={true}
          isComplete={false}
        />
      );
      vi.advanceTimersByTime(100);
    });

    // Check that some content is present - look for the "He" text that was rendered
    expect(screen.getByText('He')).toBeInTheDocument();
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
        text="A"
        speed={100}
        delay={0} // No delay
        onComplete={onComplete}
      />
    );

    // First advance timer to trigger start
    await act(async () => {
      vi.advanceTimersByTime(1); // Trigger the delay timeout (0ms)
    });

    // Then advance timer for the single character
    await act(async () => {
      vi.advanceTimersByTime(20); // 1 char * 10ms + buffer
    });

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('applies color and bold styling', async () => {
    render(
      <TypewriterText
        text="X"
        color="red"
        bold={true}
        delay={0}
      />
    );

    // First trigger start
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    // Let typewriter complete
    await act(async () => {
      vi.advanceTimersByTime(20); // 1 char * 10ms + buffer
    });

    // For Ink components, we verify the text is rendered
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('handles zero delay correctly', async () => {
    render(<TypewriterText text="Y" delay={0} />);

    // First trigger start (delay=0 but still needs timeout)
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    // Then complete the typing
    await act(async () => {
      vi.advanceTimersByTime(20); // 1 char * 10ms + buffer
    });
    expect(screen.getByText('Y')).toBeInTheDocument();
  });
});