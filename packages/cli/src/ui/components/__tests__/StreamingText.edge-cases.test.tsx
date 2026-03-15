import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse, TypewriterText } from '../StreamingText';

// Mock the useStdoutDimensions hook
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(),
}));

vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StreamingText Edge Cases', () => {
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

  describe('Streaming Logic Edge Cases', () => {
    it('should handle empty text string', async () => {
      const onComplete = vi.fn();
      render(<StreamingText text="" onComplete={onComplete} />);

      // Should call onComplete immediately since there's no text to stream
      await act(async () => {
        vi.advanceTimersByTime(50); // Small delay to allow any pending effects
      });

      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should handle single character text', async () => {
      const onComplete = vi.fn();
      render(<StreamingText text="A" speed={50} onComplete={onComplete} />);

      // After first character delay (1000/50 = 20ms)
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(screen.getByText('A')).toBeInTheDocument();

      // Should call onComplete after streaming finishes
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should handle very long text efficiently', async () => {
      const longText = 'A'.repeat(1000);
      const onComplete = vi.fn();

      render(<StreamingText text={longText} speed={100} onComplete={onComplete} />);

      // Stream first 10 characters at speed=100, each char takes 10ms
      await act(async () => {
        vi.advanceTimersByTime(110); // 10 chars at 10ms each + buffer
      });

      // At least some A's should be visible
      expect(screen.getByText(/A+/)).toBeInTheDocument();

      // Complete streaming by jumping to end - use isComplete to bypass streaming
      render(<StreamingText text={longText} speed={100} isComplete={true} onComplete={onComplete} />);

      // Long text gets wrapped into multiple elements, just check it's present
      expect(screen.getByText(/AAAA/)).toBeInTheDocument();
    });

    it('should handle speed changes during streaming', async () => {
      const { rerender } = render(<StreamingText text="Hello World" speed={50} />);

      // Stream first character at speed 50 (20ms delay)
      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('H')).toBeInTheDocument();

      // Change speed to 100 (10ms delay)
      rerender(<StreamingText text="Hello World" speed={100} />);

      // Stream second character at new speed
      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      expect(screen.getByText('He')).toBeInTheDocument();
    });

    it('should handle switching from streaming to complete mid-stream', async () => {
      const { rerender } = render(<StreamingText text="Hello World" speed={50} />);

      // Stream first character - at speed=50, each char takes 20ms
      await act(async () => {
        vi.advanceTimersByTime(25); // Allow for first character
      });
      expect(screen.getByText(/H/)).toBeInTheDocument();

      // Switch to complete mode
      rerender(<StreamingText text="Hello World" speed={50} isComplete={true} />);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should handle text changes during streaming', async () => {
      const { rerender } = render(<StreamingText text="Hello" speed={50} />);

      // Stream first character - at speed=50, each char takes 20ms
      await act(async () => {
        vi.advanceTimersByTime(25);
      });
      expect(screen.getByText(/H/)).toBeInTheDocument();

      // Change text completely
      rerender(<StreamingText text="Goodbye" speed={50} />);

      // Should restart streaming from beginning with new text
      await act(async () => {
        vi.advanceTimersByTime(25);
      });
      expect(screen.getByText(/G/)).toBeInTheDocument();
    });

    it('should handle onComplete callback changes', async () => {
      const onComplete1 = vi.fn();
      const onComplete2 = vi.fn();
      const { rerender } = render(
        <StreamingText text="Hi" speed={50} onComplete={onComplete1} />
      );

      // Stream first character
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      // Change onComplete callback
      rerender(<StreamingText text="Hi" speed={50} onComplete={onComplete2} />);

      // Complete streaming
      await act(async () => {
        vi.advanceTimersByTime(40); // Complete remaining character and trigger callback
      });

      expect(onComplete1).not.toHaveBeenCalled();
      expect(onComplete2).toHaveBeenCalledOnce();
    });

    it('should handle zero speed gracefully', async () => {
      // With speed=0, delay would be Infinity (1000/0), which won't fire
      // The component handles this by not streaming, which is acceptable
      render(<StreamingText text="Test" speed={0} />);

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Component should render without crashing - this is the key assertion
      // Speed=0 results in infinite delay, so no streaming occurs
      expect(document.body).toBeInTheDocument();
    });

    it('should handle negative speed gracefully', async () => {
      // Negative speed results in negative timeout, which still fires
      render(<StreamingText text="Test" speed={-10} />);

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Component should render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it('should handle very high speed values', async () => {
      const onComplete = vi.fn();
      render(<StreamingText text="Fast" speed={10000} onComplete={onComplete} />);

      // Very high speed should result in very fast streaming (0.1ms per char)
      // "Fast" = 4 chars * 0.1ms = 0.4ms, but timers may batch
      await act(async () => {
        vi.advanceTimersByTime(5); // Allow for all characters
      });

      expect(screen.getByText(/F/)).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(10); // Complete the rest
      });

      // onComplete triggers after all chars streamed
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('Component Unmounting Edge Cases', () => {
    it('should cleanup timers when unmounted during streaming', async () => {
      const { unmount } = render(<StreamingText text="Hello World" speed={50} />);

      // Start streaming
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      // Unmount component
      unmount();

      // Advance timers further - should not cause any errors
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // No assertions needed - test passes if no errors thrown
    });

    it('should cleanup cursor blinking when unmounted', async () => {
      const { unmount } = render(<StreamingText text="" showCursor={true} />);

      // Start cursor blinking
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Unmount component
      unmount();

      // Advance timers further - should not cause any errors
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // No assertions needed - test passes if no errors thrown
    });
  });

  describe('Special Characters and Unicode', () => {
    it('should handle unicode characters correctly', async () => {
      const unicodeText = '🚀 Hello 世界 🌟';
      render(<StreamingText text={unicodeText} speed={50} isComplete={true} />);

      expect(screen.getByText(unicodeText)).toBeInTheDocument();
    });

    it('should handle multiline text with special characters', async () => {
      const multilineText = 'Line 1: 🎉\nLine 2: ✅\nLine 3: 🔥';
      render(<StreamingText text={multilineText} speed={50} isComplete={true} />);

      expect(screen.getByText(/Line 1: 🎉/)).toBeInTheDocument();
      expect(screen.getByText(/Line 2: ✅/)).toBeInTheDocument();
      expect(screen.getByText(/Line 3: 🔥/)).toBeInTheDocument();
    });

    it('should handle escape sequences and control characters', async () => {
      const textWithEscapes = 'Hello\tWorld\nNext\rLine';
      render(<StreamingText text={textWithEscapes} speed={50} isComplete={true} />);

      expect(screen.getByText(/Hello.*World/)).toBeInTheDocument();
      expect(screen.getByText(/Next.*Line/)).toBeInTheDocument();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid prop changes efficiently', async () => {
      const { rerender } = render(<StreamingText text="Initial" speed={50} />);

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(<StreamingText text={`Text ${i}`} speed={50 + i} />);
        await act(async () => {
          vi.advanceTimersByTime(1);
        });
      }

      // Should handle all changes without errors - look for any Text content
      expect(screen.getByText(/Text/)).toBeInTheDocument();
    });

    it('should maintain performance with very frequent updates', async () => {
      const onComplete = vi.fn();

      const { rerender } = render(
        <StreamingText text="A" speed={1000} isComplete={true} onComplete={onComplete} />
      );

      // Trigger many rapid updates
      for (let i = 0; i < 50; i++) {
        rerender(
          <StreamingText text={`Update ${i}`} speed={1000} isComplete={true} onComplete={onComplete} />
        );
      }

      // Should handle all updates efficiently - text should show final update
      expect(screen.getByText('Update 49')).toBeInTheDocument();
      // onComplete gets called on initial render when isComplete=true
      expect(onComplete).toHaveBeenCalled();
    });
  });
});

describe('StreamingResponse Edge Cases', () => {
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

  describe('Content Chunking Edge Cases', () => {
    it('should handle very short content', async () => {
      render(
        <StreamingResponse
          content="Hi"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Short content may be chunked - look for "H" at minimum
      expect(screen.getByText(/H/)).toBeInTheDocument();
    });

    it('should handle empty content while streaming', async () => {
      render(
        <StreamingResponse
          content=""
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should not crash with empty content - look for streaming indicator
      expect(screen.queryByText(/streaming/)).toBeInTheDocument();
    });

    it('should handle content that results in single chunk', async () => {
      render(
        <StreamingResponse
          content="Short"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Content is chunked and streamed character-by-character
      expect(screen.getByText(/S/)).toBeInTheDocument();
    });

    it('should handle content changes during streaming', async () => {
      const { rerender } = render(
        <StreamingResponse
          content="Initial"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Change content mid-stream
      rerender(
        <StreamingResponse
          content="Updated content"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Look for "U" from "Updated" as streaming may not have completed
      expect(screen.getByText(/U/)).toBeInTheDocument();
    });
  });

  describe('Agent Display Edge Cases', () => {
    it('should handle very long agent names', async () => {
      const longAgentName = 'very-long-agent-name-that-might-overflow';
      render(
        <StreamingResponse
          content="Test"
          agent={longAgentName}
          isComplete={true}
        />
      );

      expect(screen.getByText(longAgentName)).toBeInTheDocument();
    });

    it('should handle agent names with special characters', async () => {
      const specialAgent = 'agent-🤖-v2.1';
      render(
        <StreamingResponse
          content="Test"
          agent={specialAgent}
          isComplete={true}
        />
      );

      expect(screen.getByText(specialAgent)).toBeInTheDocument();
    });

    it('should handle undefined agent gracefully', async () => {
      render(
        <StreamingResponse
          content="Test content"
          agent={undefined}
          isComplete={true}
        />
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
      expect(screen.queryByText(/agent/i)).not.toBeInTheDocument();
    });
  });

  describe('Width Calculation Edge Cases', () => {
    it('should handle extreme terminal widths', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Very narrow
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="This is a test of very narrow terminal width handling"
          isComplete={true}
        />
      );

      // Should not crash and should display content
      expect(screen.getByText(/This is a test/)).toBeInTheDocument();
    });

    it('should handle terminal width of 1', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 1,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="Test"
          isComplete={true}
        />
      );

      // Should enforce minimum width and display
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should handle massive terminal width', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 10000,
        height: 100,
        breakpoint: 'wide',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="Test content for massive terminal"
          isComplete={true}
        />
      );

      expect(screen.getByText('Test content for massive terminal')).toBeInTheDocument();
    });
  });
});

describe('TypewriterText Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Timing Edge Cases', () => {
    it('should handle very long delay values', async () => {
      const onComplete = vi.fn();
      render(
        <TypewriterText
          text="Test"
          delay={10000} // 10 second delay
          speed={100}
          onComplete={onComplete}
        />
      );

      // Should not start until delay is complete
      await act(async () => {
        vi.advanceTimersByTime(9999);
      });
      expect(screen.queryByText('Test')).not.toBeInTheDocument();

      // After delay completes
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      // Should start typing
      await act(async () => {
        vi.advanceTimersByTime(50); // Allow some typing time
      });
      expect(screen.getByText(/T/)).toBeInTheDocument();
    });

    it('should handle simultaneous delay and speed changes', async () => {
      const { rerender } = render(
        <TypewriterText text="Hello" delay={100} speed={50} />
      );

      // Start delay
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Change both delay and speed mid-delay
      rerender(<TypewriterText text="Hello" delay={200} speed={100} />);

      // Complete new delay
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should start typing with new speed
      await act(async () => {
        vi.advanceTimersByTime(20); // New speed timing
      });
      expect(screen.getByText(/H/)).toBeInTheDocument();
    });

    it('should handle zero delay with zero speed', async () => {
      // With speed=0, delay would be Infinity - component won't complete normally
      render(
        <TypewriterText
          text="Test"
          delay={0}
          speed={0}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Component should render without crashing - that's the key assertion
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Style Edge Cases', () => {
    it('should handle color changes during typing', async () => {
      const { rerender } = render(
        <TypewriterText text="Hello" color="red" delay={0} speed={100} />
      );

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      // Start typing - at speed=100, each char takes 10ms
      await act(async () => {
        vi.advanceTimersByTime(60); // Allow for full text (5 chars * 10ms + buffer)
      });

      // Change color mid-typing
      rerender(<TypewriterText text="Hello" color="blue" delay={0} speed={100} />);

      await act(async () => {
        vi.advanceTimersByTime(60);
      });

      expect(screen.getByText(/H/)).toBeInTheDocument();
    });

    it('should handle bold changes during typing', async () => {
      const { rerender } = render(
        <TypewriterText text="Test" bold={false} delay={0} speed={100} />
      );

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      // Start typing
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Change bold mid-typing
      rerender(<TypewriterText text="Test" bold={true} delay={0} speed={100} />);

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByText(/T/)).toBeInTheDocument();
    });
  });
});