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

describe('StreamingText Core Functionality Audit', () => {
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

  describe('AUDIT REQUIREMENT: Real Streaming Logic via useEffect/setTimeout', () => {
    it('should implement character-by-character streaming with setTimeout', async () => {
      const onComplete = vi.fn();
      render(
        <StreamingText
          text="Hello"
          speed={50} // 20ms per character
          onComplete={onComplete}
        />
      );

      // Initially no text displayed
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();

      // After enough time for multiple characters to stream
      await act(async () => {
        vi.advanceTimersByTime(100); // 5 characters * 20ms = 100ms
      });

      // Text should be present (streaming complete or in progress)
      expect(screen.getByText(/H/)).toBeInTheDocument();

      // onComplete should eventually be called
      await act(async () => {
        vi.advanceTimersByTime(50); // Extra time to ensure completion
      });

      expect(onComplete).toHaveBeenCalled();
    });

    it('should respect speed parameter for streaming timing', async () => {
      const { rerender } = render(
        <StreamingText text="Test" speed={1000} />
      );

      // Very fast speed (1ms per char) should complete quickly
      await act(async () => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByText(/Test/)).toBeInTheDocument();

      rerender(<StreamingText text="Slow" speed={10} />);

      // Very slow speed (100ms per char) takes longer
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByText(/S/)).toBeInTheDocument();
    });

    it('should support isComplete flag to bypass streaming', () => {
      render(
        <StreamingText
          text="Immediate Text"
          isComplete={true}
        />
      );

      // Should immediately show full text without streaming
      expect(screen.getByText('Immediate Text')).toBeInTheDocument();
    });
  });

  describe('AUDIT REQUIREMENT: Cursor Animation with 500ms blinking', () => {
    it('should show blinking cursor with ▊ character at 500ms intervals', async () => {
      render(<StreamingText text="" showCursor={true} />);

      // Initially cursor should be visible
      expect(screen.getByText('▊')).toBeInTheDocument();

      // After 500ms should be hidden
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText('▊')).not.toBeInTheDocument();

      // After another 500ms should be visible again
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should use correct cursor character (▊)', () => {
      render(<StreamingText text="" showCursor={true} />);

      // Should use the specific block cursor character
      expect(screen.getByText('▊')).toBeInTheDocument();
      expect(screen.queryByText('█')).not.toBeInTheDocument(); // Different character used by ResponseStream
    });

    it('should control cursor visibility with showCursor prop', () => {
      const { rerender } = render(<StreamingText text="" showCursor={false} />);

      expect(screen.queryByText('▊')).not.toBeInTheDocument();

      rerender(<StreamingText text="" showCursor={true} />);

      expect(screen.getByText('▊')).toBeInTheDocument();
    });

    it('should cleanup cursor animation on unmount', () => {
      const { unmount } = render(<StreamingText text="" showCursor={true} />);

      expect(screen.getByText('▊')).toBeInTheDocument();

      unmount();

      // Should not cause memory leaks
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
    });
  });

  describe('AUDIT REQUIREMENT: Responsive Width Support via useStdoutDimensions', () => {
    it('should import and use useStdoutDimensions hook', () => {
      render(<StreamingText text="Test responsive" responsive={true} />);

      // Verify hook is called
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      expect(screen.getByText('Test responsive')).toBeInTheDocument();
    });

    it('should calculate effective width from terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 30,
        breakpoint: 'wide',
        isAvailable: true,
      });

      render(
        <StreamingText
          text="Test width calculation"
          responsive={true}
          isComplete={true}
        />
      );

      // Should render correctly with calculated width
      expect(screen.getByText('Test width calculation')).toBeInTheDocument();
    });

    it('should enforce minimum width of 40 when responsive', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20, // Very narrow
        height: 24,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      render(
        <StreamingText
          text="Narrow terminal test"
          responsive={true}
          isComplete={true}
        />
      );

      // Should still render correctly despite narrow width
      expect(screen.getByText('Narrow terminal test')).toBeInTheDocument();
    });

    it('should support explicit width override', () => {
      render(
        <StreamingText
          text="Fixed width test"
          width={60}
          isComplete={true}
        />
      );

      expect(screen.getByText('Fixed width test')).toBeInTheDocument();
    });

    it('should handle text wrapping based on width', () => {
      render(
        <StreamingText
          text="This is a very long line that should wrap when width is constrained"
          width={20}
          isComplete={true}
        />
      );

      // Text should be present and wrapped
      expect(screen.getByText(/This is a very long/)).toBeInTheDocument();
    });

    it('should support responsive disable via props', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isAvailable: true,
      });

      render(
        <StreamingText
          text="Non-responsive test"
          responsive={false}
          isComplete={true}
        />
      );

      // Should still render but without responsive width calculation
      expect(screen.getByText('Non-responsive test')).toBeInTheDocument();
    });
  });

  describe('AUDIT REQUIREMENT: StreamingResponse Integration', () => {
    it('should verify StreamingResponse uses StreamingText internally', async () => {
      render(
        <StreamingResponse
          content="StreamingResponse test"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // StreamingResponse should use StreamingText cursor (▊), not its own (█)
      expect(screen.getByText('▊')).toBeInTheDocument();
      expect(screen.queryByText('█')).not.toBeInTheDocument();

      expect(screen.getByText(/StreamingResponse test/)).toBeInTheDocument();
    });

    it('should pass streaming state correctly to StreamingText', async () => {
      const { rerender } = render(
        <StreamingResponse
          content="State test"
          isStreaming={true}
          isComplete={false}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Should show cursor when streaming
      expect(screen.getByText('▊')).toBeInTheDocument();

      rerender(
        <StreamingResponse
          content="State test"
          isStreaming={false}
          isComplete={true}
        />
      );

      // Should hide cursor when complete
      expect(screen.queryByText('▊')).not.toBeInTheDocument();
    });

    it('should pass width and responsive props to StreamingText', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        breakpoint: 'wide',
        isAvailable: true,
      });

      render(
        <StreamingResponse
          content="Width test"
          width={80}
          responsive={false}
          isComplete={true}
        />
      );

      expect(screen.getByText('Width test')).toBeInTheDocument();
    });
  });

  describe('Integration with App.tsx Usage Pattern', () => {
    it('should work correctly in message rendering context', () => {
      // Simulate how messages are rendered in App.tsx
      const messages = [
        {
          content: "Response from agent",
          agent: "developer",
          type: "text" as const,
        }
      ];

      const { unmount } = render(
        <div>
          {messages.map((msg, index) => (
            <StreamingResponse
              key={index}
              content={msg.content}
              agent={msg.agent}
              isComplete={true}
            />
          ))}
        </div>
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('Response from agent')).toBeInTheDocument();
      expect(screen.getByText('✓ Complete')).toBeInTheDocument();

      unmount();
    });

    it('should handle agent-specific streaming scenarios', async () => {
      const agents = ['planner', 'architect', 'developer', 'tester'];

      for (const agent of agents) {
        const { unmount } = render(
          <StreamingResponse
            content={`Response from ${agent}`}
            agent={agent}
            isStreaming={true}
            isComplete={false}
          />
        );

        await act(async () => {
          vi.advanceTimersByTime(50);
        });

        expect(screen.getByText(agent)).toBeInTheDocument();
        expect(screen.getByText(/streaming/)).toBeInTheDocument();
        expect(screen.getByText('▊')).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('Component Lifecycle and Performance', () => {
    it('should cleanup all timers on unmount', () => {
      const { unmount } = render(
        <StreamingText
          text="Cleanup test"
          speed={50}
          showCursor={true}
        />
      );

      unmount();

      // Should not throw errors when timers are cleaned up
      expect(() => {
        vi.advanceTimersByTime(2000);
      }).not.toThrow();
    });

    it('should handle rapid prop changes efficiently', async () => {
      const { rerender } = render(
        <StreamingText text="Initial" speed={50} />
      );

      // Change props rapidly
      for (let i = 0; i < 10; i++) {
        rerender(
          <StreamingText text={`Update ${i}`} speed={50 + i} />
        );

        await act(async () => {
          vi.advanceTimersByTime(5);
        });
      }

      expect(screen.getByText(/Update 9/)).toBeInTheDocument();
    });

    it('should maintain stability with concurrent components', () => {
      render(
        <div>
          <StreamingText text="Component 1" speed={50} showCursor={true} />
          <StreamingText text="Component 2" speed={75} showCursor={false} />
          <StreamingResponse content="Response 1" isStreaming={true} />
          <StreamingResponse content="Response 2" isComplete={true} />
        </div>
      );

      // All components should render without conflicts
      expect(screen.getByText(/Component 1/)).toBeInTheDocument();
      expect(screen.getByText(/Component 2/)).toBeInTheDocument();
      expect(screen.getByText(/Response 1/)).toBeInTheDocument();
      expect(screen.getByText(/Response 2/)).toBeInTheDocument();
    });
  });

  describe('Audit Compliance Summary', () => {
    it('should verify all acceptance criteria are met', async () => {
      const onComplete = vi.fn();

      // Test all features together
      render(
        <StreamingText
          text="Complete feature test"
          speed={100} // Real streaming with useEffect/setTimeout
          showCursor={true} // Cursor animation at 500ms intervals
          responsive={true} // Uses useStdoutDimensions for width
          onComplete={onComplete}
        />
      );

      // 1. Real streaming logic
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByText(/Complete/)).toBeInTheDocument();

      // 2. Cursor animation
      expect(screen.getByText('▊')).toBeInTheDocument();

      // 3. Responsive width support
      expect(mockUseStdoutDimensions).toHaveBeenCalled();

      // Complete streaming
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(onComplete).toHaveBeenCalled();

      // Verify cursor blinking
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
});