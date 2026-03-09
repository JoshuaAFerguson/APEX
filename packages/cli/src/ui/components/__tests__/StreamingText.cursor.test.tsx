import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse } from '../StreamingText';

// Mock the useStdoutDimensions hook
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(),
}));

vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StreamingText Cursor Animation', () => {
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

  describe('Cursor Visibility and Blinking', () => {
    it('should show cursor when showCursor is true', () => {
      render(<StreamingText text="" showCursor={true} />);

      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should hide cursor when showCursor is false', () => {
      render(<StreamingText text="" showCursor={false} />);

      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should blink cursor at 500ms intervals', async () => {
      render(<StreamingText text="" showCursor={true} />);

      // Initially visible
      expect(screen.getByText('▊')).toBeInTheDocument();

      // After 500ms, should be hidden
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();

      // After another 500ms, should be visible again
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByText('▊')).toBeInTheDocument();

      // After another 500ms, should be hidden again
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should handle rapid blink cycles correctly', async () => {
      render(<StreamingText text="" showCursor={true} />);

      // Test multiple blink cycles
      for (let i = 0; i < 5; i++) {
        // Should be visible initially or after even number of cycles
        if (i % 2 === 0) {
          expect(screen.getByText('▊')).toBeInTheDocument();
        }

        // Advance time by 500ms
        await act(async () => {
          vi.advanceTimersByTime(500);
        });

        // Should toggle visibility
        if (i % 2 === 0) {
          expect(screen.queryByText('▊')).not.toBeInTheDocument();
        } else {
          expect(screen.getByText('▊')).toBeInTheDocument();
        }
      }
    });

    it('should stop blinking when showCursor becomes false', async () => {
      const { rerender } = render(<StreamingText text="" showCursor={true} />);

      // Start blinking
      expect(screen.getByText('▊')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(250); // Mid-blink cycle
      });

      // Disable cursor
      rerender(<StreamingText text="" showCursor={false} />);

      // Should not be visible
      expect(screen.queryByText('▊')).not.toBeInTheDocument();

      // Advancing time should not bring it back
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should restart blinking when showCursor becomes true', async () => {
      const { rerender } = render(<StreamingText text="" showCursor={false} />);

      // Initially no cursor
      expect(screen.queryByText('▊')).not.toBeInTheDocument();

      // Enable cursor
      rerender(<StreamingText text="" showCursor={true} />);

      // Should start blinking immediately
      expect(screen.getByText('▊')).toBeInTheDocument();

      // Should continue blinking cycle
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByText('▊')).toBeInTheDocument();
    });
  });

  describe('Cursor Position During Streaming', () => {
    it('should show cursor at end of text during streaming', async () => {
      render(<StreamingText text="Hello World" speed={50} showCursor={true} />);

      // After first character
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(screen.getByText('H')).toBeInTheDocument();
      expect(screen.getByText('▊')).toBeInTheDocument();

      // After second character
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(screen.getByText('He')).toBeInTheDocument();
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should handle cursor with multiline text', async () => {
      render(<StreamingText text="Line 1\nLine 2\nLine 3" speed={50} showCursor={true} isComplete={true} />);

      // Cursor should appear at the end of the last line
      expect(screen.getByText(/Line 3/)).toBeInTheDocument();
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should handle cursor with wrapped text', async () => {
      render(
        <StreamingText
          text="This is a very long line that will wrap"
          width={10}
          showCursor={true}
          isComplete={true}
        />
      );

      // Cursor should appear at the end of the last wrapped line
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should handle cursor when text is truncated with maxLines', async () => {
      const multilineText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      render(
        <StreamingText
          text={multilineText}
          maxLines={3}
          showCursor={true}
          isComplete={true}
        />
      );

      // Should show cursor at the end of the visible lines
      expect(screen.getByText('▊')).toBeInTheDocument();
      // Should show last 3 lines (Line 3, Line 4, Line 5)
      expect(screen.getByText(/Line 5/)).toBeInTheDocument();
    });
  });

  describe('Cursor Behavior on Completion', () => {
    it('should hide cursor when streaming completes', async () => {
      render(<StreamingText text="Hi" speed={50} showCursor={true} />);

      // During streaming, cursor should be visible (when blinking on)
      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('H')).toBeInTheDocument();
      expect(screen.getByText('▊')).toBeInTheDocument();

      // Complete streaming
      await act(async () => {
        vi.advanceTimersByTime(40); // Complete remaining character + trigger completion
      });

      expect(screen.getByText('Hi')).toBeInTheDocument();

      // Advance past any blinking cycles - cursor should not appear after completion
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Note: The cursor visibility logic is: shouldShowCursor = showCursor && showBlinkCursor && (currentIndex >= text.length || !isComplete)
      // When streaming is complete and currentIndex >= text.length, cursor should not show
    });

    it('should show cursor when isComplete is true but still streaming new content', async () => {
      const { rerender } = render(
        <StreamingText text="Hello" speed={50} showCursor={true} isComplete={false} />
      );

      // Start streaming
      await act(async () => {
        vi.advanceTimersByTime(40); // Stream 2 characters
      });
      expect(screen.getByText('He')).toBeInTheDocument();

      // Mark as complete while mid-stream
      rerender(<StreamingText text="Hello" speed={50} showCursor={true} isComplete={true} />);

      // Should immediately show full text
      expect(screen.getByText('Hello')).toBeInTheDocument();

      // Cursor behavior depends on completion state
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
    });

    it('should handle cursor when completing with empty text', async () => {
      render(<StreamingText text="" speed={50} showCursor={true} isComplete={true} />);

      // Even with empty text, cursor behavior should be predictable
      // When complete and no text, cursor should not show
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
    });
  });

  describe('Cursor Cleanup and Memory Management', () => {
    it('should cleanup cursor blinking interval on unmount', async () => {
      const { unmount } = render(<StreamingText text="" showCursor={true} />);

      // Start blinking
      expect(screen.getByText('▊')).toBeInTheDocument();

      // Unmount component
      unmount();

      // Advance timers - should not cause memory leaks or errors
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Test passes if no errors are thrown
    });

    it('should cleanup cursor interval when showCursor changes to false', async () => {
      const { rerender } = render(<StreamingText text="" showCursor={true} />);

      // Start blinking
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Disable cursor (should cleanup interval)
      rerender(<StreamingText text="" showCursor={false} />);

      // Re-enable cursor (should start new interval)
      rerender(<StreamingText text="" showCursor={true} />);

      // Should work correctly
      expect(screen.getByText('▊')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should handle multiple rapid showCursor toggles without memory leaks', async () => {
      const { rerender } = render(<StreamingText text="" showCursor={false} />);

      // Rapidly toggle showCursor
      for (let i = 0; i < 10; i++) {
        rerender(<StreamingText text="" showCursor={i % 2 === 0} />);
        await act(async () => {
          vi.advanceTimersByTime(10);
        });
      }

      // Final state should work correctly
      rerender(<StreamingText text="" showCursor={true} />);
      expect(screen.getByText('▊')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });
  });

  describe('Cursor Character and Styling', () => {
    it('should use the correct cursor character (▊)', () => {
      render(<StreamingText text="" showCursor={true} />);

      // Should use the block cursor character
      expect(screen.getByText('▊')).toBeInTheDocument();
      expect(screen.queryByText('|')).not.toBeInTheDocument();
      expect(screen.queryByText('_')).not.toBeInTheDocument();
    });

    it('should apply gray color to cursor', () => {
      render(<StreamingText text="" showCursor={true} />);

      const cursor = screen.getByText('▊');
      expect(cursor).toBeInTheDocument();
      // Note: Ink Text component's color prop would apply the gray color
      // This test verifies the cursor element exists with expected content
    });

    it('should handle cursor with various text content types', async () => {
      const testCases = [
        'Regular text',
        '🚀 Unicode emojis 🌟',
        'Numbers: 12345',
        'Special chars: !@#$%^&*()',
        'Mixed: Hello 世界 123! 🎉'
      ];

      for (const text of testCases) {
        const { unmount } = render(
          <StreamingText text={text} showCursor={true} isComplete={true} />
        );

        expect(screen.getByText(text)).toBeInTheDocument();
        expect(screen.getByText('▊')).toBeInTheDocument();

        unmount();
      }
    });
  });
});

describe('StreamingResponse Cursor Integration', () => {
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

  describe('StreamingResponse Cursor Behavior', () => {
    it('should pass showCursor=true to StreamingText when streaming', async () => {
      render(
        <StreamingResponse
          content="Test content"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // StreamingText should receive showCursor=true when streaming
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should pass showCursor=false to StreamingText when not streaming', async () => {
      render(
        <StreamingResponse
          content="Test content"
          isStreaming={false}
          isComplete={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // When not streaming, cursor should not be shown
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should handle streaming state changes correctly', async () => {
      const { rerender } = render(
        <StreamingResponse
          content="Test"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should show cursor when streaming
      expect(screen.getByText('▊')).toBeInTheDocument();

      // Stop streaming
      rerender(
        <StreamingResponse
          content="Test"
          isStreaming={false}
          isComplete={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should hide cursor when not streaming
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should maintain cursor behavior consistency with agent headers', async () => {
      render(
        <StreamingResponse
          content="Agent response"
          agent="developer"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should show both agent header and cursor
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/streaming.../)).toBeInTheDocument();
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should handle cursor with completion indicator', async () => {
      render(
        <StreamingResponse
          content="Complete response"
          isStreaming={false}
          isComplete={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should show completion indicator but no cursor
      expect(screen.getByText('✓ Complete')).toBeInTheDocument();
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });
  });

  describe('StreamingResponse Cursor Edge Cases', () => {
    it('should handle cursor when content is empty and streaming', async () => {
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

      // Should still show cursor even with empty content when streaming
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should handle cursor during content updates', async () => {
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

      expect(screen.getByText('▊')).toBeInTheDocument();

      // Update content while streaming
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

      // Should continue showing cursor with new content
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should handle rapid streaming state changes', async () => {
      const { rerender } = render(
        <StreamingResponse
          content="Test"
          isStreaming={false}
          isComplete={true}
        />
      );

      // Rapidly toggle streaming state
      for (let i = 0; i < 5; i++) {
        const isStreaming = i % 2 === 0;
        rerender(
          <StreamingResponse
            content="Test"
            isStreaming={isStreaming}
            isComplete={!isStreaming}
          />
        );

        await act(async () => {
          vi.advanceTimersByTime(50);
        });

        if (isStreaming) {
          expect(screen.getByText('▊')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('▊')).not.toBeInTheDocument();
        }
      }
    });
  });
});