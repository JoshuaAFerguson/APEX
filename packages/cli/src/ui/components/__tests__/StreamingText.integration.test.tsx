import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../__tests__/test-utils';
import { StreamingText, StreamingResponse } from '../StreamingText';
import { ResponseStream } from '../ResponseStream';

// Mock the useStdoutDimensions hook
const { mockUseStdoutDimensions } = vi.hoisted(() => ({
  mockUseStdoutDimensions: vi.fn(),
}));

vi.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

describe('StreamingText Integration Tests', () => {
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

  describe('StreamingResponse Integration with StreamingText', () => {
    it('should use StreamingText component internally', async () => {
      // This test verifies that StreamingResponse actually uses StreamingText
      render(
        <StreamingResponse
          content="Hello World"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // StreamingResponse should use StreamingText, which has character-by-character streaming
      // Look for evidence of StreamingText's behavior (cursor and streaming)
      expect(screen.getByText('▊')).toBeInTheDocument();

      // The content should be present
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });

    it('should pass correct props to StreamingText', async () => {
      const onComplete = vi.fn();
      render(
        <StreamingResponse
          content="Test Content"
          isStreaming={true}
          isComplete={false}
          onComplete={onComplete}
          width={60}
          responsive={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Verify StreamingText receives the correct props
      expect(screen.getByText(/Test/)).toBeInTheDocument();
      expect(screen.getByText('▊')).toBeInTheDocument();

      // Complete the stream
      render(
        <StreamingResponse
          content="Test Content"
          isStreaming={false}
          isComplete={true}
          onComplete={onComplete}
          width={60}
          responsive={false}
        />
      );

      expect(onComplete).toHaveBeenCalled();
    });

    it('should handle width calculation and pass to StreamingText', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'normal',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="This is a test of width calculation"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // StreamingText should receive calculated effective width (100 - 2 = 98)
      expect(screen.getByText(/This is a test/)).toBeInTheDocument();
    });

    it('should pass isComplete and showCursor correctly to StreamingText', async () => {
      const { rerender } = render(
        <StreamingResponse
          content="Streaming test"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // When streaming, StreamingText should show cursor
      expect(screen.getByText('▊')).toBeInTheDocument();

      // Complete streaming
      rerender(
        <StreamingResponse
          content="Streaming test"
          isStreaming={false}
          isComplete={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // When complete, StreamingText should not show cursor
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should handle responsive behavior correctly through StreamingText', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        breakpoint: 'compact',
        isAvailable: true,
      });

      const { rerender } = render(
        <StreamingResponse
          content="Long content that should wrap properly in narrow terminal"
          responsive={true}
          isComplete={true}
        />
      );

      expect(screen.getByText(/Long content/)).toBeInTheDocument();

      // Test with responsive disabled
      rerender(
        <StreamingResponse
          content="Long content that should wrap properly in narrow terminal"
          responsive={false}
          isComplete={true}
        />
      );

      expect(screen.getByText(/Long content/)).toBeInTheDocument();
    });
  });

  describe('ResponseStream vs StreamingText Behavior Comparison', () => {
    it('should demonstrate the difference between ResponseStream and StreamingText', async () => {
      // First test ResponseStream behavior
      const { unmount: unmount1 } = render(
        <ResponseStream
          content="Test message"
          isStreaming={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // ResponseStream shows basic streaming cursor (█) - different from StreamingText
      expect(screen.getByText('█')).toBeInTheDocument();
      expect(screen.getByText('Test message')).toBeInTheDocument();

      unmount1();

      // Now test StreamingText behavior
      render(
        <StreamingText
          text="Test message"
          isComplete={false}
          showCursor={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(50); // Allow streaming to progress
      });

      // StreamingText shows different cursor (▊) and character-by-character streaming
      expect(screen.getByText('▊')).toBeInTheDocument();
      // Should show partial text due to character-by-character streaming
      expect(screen.getByText(/T/)).toBeInTheDocument();
    });

    it('should verify ResponseStream has its own streaming implementation (audit finding)', async () => {
      // This test confirms the audit finding that ResponseStream doesn't use StreamingText
      render(
        <ResponseStream
          content="Testing ResponseStream implementation"
          isStreaming={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // ResponseStream shows complete content immediately (no character-by-character)
      expect(screen.getByText('Testing ResponseStream implementation')).toBeInTheDocument();
      // ResponseStream uses █ cursor, not ▊
      expect(screen.getByText('█')).toBeInTheDocument();
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should show that StreamingResponse properly uses StreamingText', async () => {
      render(
        <StreamingResponse
          content="Testing StreamingResponse implementation"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // StreamingResponse uses StreamingText internally
      // Should show ▊ cursor (from StreamingText)
      expect(screen.getByText('▊')).toBeInTheDocument();
      expect(screen.queryByText('█')).not.toBeInTheDocument();

      // Should show character-by-character progress
      expect(screen.getByText(/Test/)).toBeInTheDocument();
    });
  });

  describe('useStdoutDimensions Integration', () => {
    it('should properly integrate with useStdoutDimensions hook', async () => {
      const mockDimensions = {
        width: 120,
        height: 40,
        breakpoint: 'wide' as const,
        isAvailable: true,
      };

      mockUseStdoutDimensions.mockReturnValue(mockDimensions);

      render(
        <StreamingText
          text="Test integration with stdout dimensions"
          responsive={true}
          isComplete={true}
        />
      );

      // Verify hook was called
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // Verify content renders correctly with large terminal width
      expect(screen.getByText('Test integration with stdout dimensions')).toBeInTheDocument();
    });

    it('should handle dimension changes during streaming', async () => {
      // Start with narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { rerender } = render(
        <StreamingText
          text="This text should adapt to terminal width changes"
          speed={50}
          responsive={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100); // Stream some characters
      });

      // Change to wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 40,
        breakpoint: 'wide',
        isAvailable: true,
      });

      rerender(
        <StreamingText
          text="This text should adapt to terminal width changes"
          speed={50}
          responsive={true}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByText(/This text/)).toBeInTheDocument();
    });

    it('should fallback gracefully when useStdoutDimensions is unavailable', async () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback
        height: 24,
        breakpoint: 'normal',
        isAvailable: false,
      });

      render(
        <StreamingText
          text="Test fallback behavior"
          responsive={true}
          isComplete={true}
        />
      );

      // Should still render correctly
      expect(screen.getByText('Test fallback behavior')).toBeInTheDocument();
    });

    it('should handle extreme terminal dimensions', async () => {
      const extremeScenarios = [
        { width: 1, height: 1, breakpoint: 'narrow' as const },
        { width: 5000, height: 1000, breakpoint: 'wide' as const },
        { width: 0, height: 0, breakpoint: 'narrow' as const },
      ];

      for (const dimensions of extremeScenarios) {
        mockUseStdoutDimensions.mockReturnValue({
          ...dimensions,
          isAvailable: true,
        });

        const { unmount } = render(
          <StreamingText
            text="Extreme dimensions test"
            responsive={true}
            isComplete={true}
          />
        );

        // Should not crash with extreme dimensions
        expect(screen.getByText('Extreme dimensions test')).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('Error Handling and Edge Case Integration', () => {
    it('should handle component unmounting during active streaming', async () => {
      const { unmount } = render(
        <StreamingText
          text="This will be unmounted during streaming"
          speed={50}
        />
      );

      // Start streaming
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Unmount during streaming
      unmount();

      // Advance timers to ensure no memory leaks or errors
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Test passes if no errors thrown
    });

    it('should handle rapid prop changes during streaming', async () => {
      const { rerender } = render(
        <StreamingText text="Initial" speed={50} />
      );

      // Rapidly change props
      for (let i = 0; i < 20; i++) {
        rerender(
          <StreamingText
            text={`Update ${i}`}
            speed={50 + i}
            showCursor={i % 2 === 0}
          />
        );

        await act(async () => {
          vi.advanceTimersByTime(5);
        });
      }

      // Should handle all changes gracefully
      expect(screen.getByText(/Update/)).toBeInTheDocument();
    });

    it('should maintain performance with complex streaming scenarios', async () => {
      // Test multiple streaming components simultaneously
      render(
        <div>
          <StreamingText text="Stream 1" speed={50} />
          <StreamingText text="Stream 2" speed={75} />
          <StreamingText text="Stream 3" speed={100} />
          <StreamingResponse content="Response stream" isStreaming={true} />
        </div>
      );

      // Let all streams progress
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // All components should render correctly
      expect(screen.getByText(/Stream 1/)).toBeInTheDocument();
      expect(screen.getByText(/Stream 2/)).toBeInTheDocument();
      expect(screen.getByText(/Stream 3/)).toBeInTheDocument();
      expect(screen.getByText(/Response stream/)).toBeInTheDocument();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should simulate real agent response streaming', async () => {
      // Simulate how StreamingResponse would be used in the App
      const { rerender } = render(
        <StreamingResponse
          content=""
          agent="developer"
          isStreaming={true}
          isComplete={false}
        />
      );

      // Simulate progressive content updates
      const fullResponse = "I'll help you implement that feature. Let me start by analyzing the requirements...";
      const chunks = [
        "I'll help you",
        "I'll help you implement that",
        "I'll help you implement that feature.",
        fullResponse
      ];

      for (let i = 0; i < chunks.length; i++) {
        rerender(
          <StreamingResponse
            content={chunks[i]}
            agent="developer"
            isStreaming={i < chunks.length - 1}
            isComplete={i === chunks.length - 1}
          />
        );

        await act(async () => {
          vi.advanceTimersByTime(100);
        });

        // Should show current content
        expect(screen.getByText(/I'll help you/)).toBeInTheDocument();

        if (i < chunks.length - 1) {
          // Should show streaming indicator
          expect(screen.getByText(/streaming/)).toBeInTheDocument();
        } else {
          // Should show completion indicator
          expect(screen.getByText(/Complete/)).toBeInTheDocument();
        }
      }
    });

    it('should handle App.tsx message rendering integration', async () => {
      // Simulate how ResponseStream is used in App.tsx vs how StreamingResponse should be used
      const message = {
        id: '1',
        content: 'Hello from agent',
        agent: 'developer',
        type: 'text' as const
      };

      // Current App.tsx usage with ResponseStream
      const { unmount: unmount1 } = render(
        <ResponseStream
          content={message.content}
          agent={message.agent}
          type={message.type}
          displayMode="normal"
        />
      );

      expect(screen.getByText('[developer]')).toBeInTheDocument();
      expect(screen.getByText('Hello from agent')).toBeInTheDocument();

      unmount1();

      // How it could work with StreamingResponse
      render(
        <StreamingResponse
          content={message.content}
          agent={message.agent}
          isStreaming={false}
          isComplete={true}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('Hello from agent')).toBeInTheDocument();
      expect(screen.getByText('✓ Complete')).toBeInTheDocument();
    });

    it('should verify character-by-character streaming works as expected', async () => {
      const onComplete = vi.fn();
      render(
        <StreamingText
          text="Hello"
          speed={50} // 20ms per character
          onComplete={onComplete}
        />
      );

      // Verify character-by-character progression
      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('H')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('He')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('Hel')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('Hell')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(screen.getByText('Hello')).toBeInTheDocument();

      // Complete callback should be triggered
      await act(async () => {
        vi.advanceTimersByTime(20);
      });
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });
});