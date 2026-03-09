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

describe('StreamingText Performance and Memory Tests', () => {
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

  describe('Memory Leak Prevention', () => {
    it('should cleanup all timers when component unmounts during streaming', async () => {
      // Track timer creation
      const originalSetTimeout = global.setTimeout;
      const originalSetInterval = global.setInterval;
      const originalClearTimeout = global.clearTimeout;
      const originalClearInterval = global.clearInterval;

      let activeTimeouts = 0;
      let activeIntervals = 0;

      global.setTimeout = vi.fn((fn, delay) => {
        activeTimeouts++;
        return originalSetTimeout(fn, delay);
      });

      global.setInterval = vi.fn((fn, delay) => {
        activeIntervals++;
        return originalSetInterval(fn, delay);
      });

      global.clearTimeout = vi.fn((id) => {
        activeTimeouts = Math.max(0, activeTimeouts - 1);
        return originalClearTimeout(id);
      });

      global.clearInterval = vi.fn((id) => {
        activeIntervals = Math.max(0, activeIntervals - 1);
        return originalClearInterval(id);
      });

      const { unmount } = render(
        <StreamingText text="Long streaming text" speed={50} showCursor={true} />
      );

      // Start streaming and cursor blinking
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Verify timers are active
      expect(global.setTimeout).toHaveBeenCalled();
      expect(global.setInterval).toHaveBeenCalled();

      // Unmount component
      unmount();

      // Verify cleanup occurred
      expect(global.clearTimeout).toHaveBeenCalled();
      expect(global.clearInterval).toHaveBeenCalled();

      // Restore original functions
      global.setTimeout = originalSetTimeout;
      global.setInterval = originalSetInterval;
      global.clearTimeout = originalClearTimeout;
      global.clearInterval = originalClearInterval;
    });

    it('should prevent memory leaks with rapid mount/unmount cycles', async () => {
      // Simulate rapid component creation and destruction
      const components: Array<() => void> = [];

      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <StreamingText
            key={i}
            text={`Component ${i} text`}
            speed={100}
            showCursor={true}
          />
        );

        // Start streaming
        await act(async () => {
          vi.advanceTimersByTime(10);
        });

        components.push(unmount);

        // Unmount previous component to simulate rapid cycling
        if (i > 0) {
          components[i - 1]();
        }
      }

      // Cleanup remaining components
      components.forEach(unmount => unmount());

      // Advance timers to ensure no pending operations
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Test passes if no errors or warnings
    });

    it('should cleanup cursor blinking intervals properly', async () => {
      const { rerender, unmount } = render(
        <StreamingText text="Test" showCursor={true} />
      );

      // Start cursor blinking
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Disable cursor multiple times to test interval cleanup
      for (let i = 0; i < 5; i++) {
        rerender(<StreamingText text="Test" showCursor={false} />);
        rerender(<StreamingText text="Test" showCursor={true} />);
        await act(async () => {
          vi.advanceTimersByTime(100);
        });
      }

      // Final unmount
      unmount();

      // No errors should occur
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    });
  });

  describe('Performance with Large Content', () => {
    it('should handle very long text efficiently', async () => {
      const longText = 'A'.repeat(10000);
      const startTime = performance.now();

      render(<StreamingText text={longText} speed={1000} isComplete={true} />);

      const renderTime = performance.now() - startTime;

      // Should render large content quickly (less than 100ms)
      expect(renderTime).toBeLessThan(100);

      // Content should be displayed
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should maintain performance during rapid content updates', async () => {
      const { rerender } = render(<StreamingText text="Initial" speed={100} />);

      const startTime = performance.now();

      // Rapidly update content 100 times
      for (let i = 0; i < 100; i++) {
        const newText = `Update ${i}`;
        rerender(<StreamingText text={newText} speed={100} />);

        // Small time advancement to simulate real conditions
        await act(async () => {
          vi.advanceTimersByTime(1);
        });
      }

      const updateTime = performance.now() - startTime;

      // Should handle rapid updates efficiently (less than 500ms for 100 updates)
      expect(updateTime).toBeLessThan(500);

      expect(screen.getByText(/Update 99/)).toBeInTheDocument();
    });

    it('should efficiently handle text wrapping with long lines', async () => {
      const longLine = 'This is a very long line that should wrap multiple times when displayed in a narrow terminal width and the wrapping algorithm should handle it efficiently without performance degradation '.repeat(20);

      const startTime = performance.now();

      render(
        <StreamingText
          text={longLine}
          width={40}
          isComplete={true}
        />
      );

      const renderTime = performance.now() - startTime;

      // Should handle text wrapping efficiently
      expect(renderTime).toBeLessThan(50);

      expect(screen.getByText(/This is a very long line/)).toBeInTheDocument();
    });
  });

  describe('Concurrent Component Performance', () => {
    it('should handle multiple streaming components efficiently', async () => {
      const componentCount = 20;
      const components = [];

      const startTime = performance.now();

      // Render many streaming components
      for (let i = 0; i < componentCount; i++) {
        components.push(
          <StreamingText
            key={i}
            text={`Component ${i} streaming text`}
            speed={50 + i}
            showCursor={i % 2 === 0}
          />
        );
      }

      render(<div>{components}</div>);

      const renderTime = performance.now() - startTime;

      // Should render multiple components efficiently
      expect(renderTime).toBeLessThan(200);

      // Advance streaming for all components
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Verify some components rendered
      expect(screen.getByText(/Component 0/)).toBeInTheDocument();
      expect(screen.getByText(/Component 19/)).toBeInTheDocument();
    });

    it('should maintain performance with mixed component types', async () => {
      const startTime = performance.now();

      render(
        <div>
          <StreamingText text="Regular streaming" speed={50} />
          <StreamingResponse content="Response stream" isStreaming={true} />
          <TypewriterText text="Typewriter effect" speed={100} delay={0} />
          <StreamingText text="Another stream" speed={75} showCursor={true} />
          <StreamingResponse content="Final response" agent="tester" isComplete={true} />
        </div>
      );

      const renderTime = performance.now() - startTime;

      // Should handle mixed components efficiently
      expect(renderTime).toBeLessThan(100);

      // Advance all animations
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Verify all components rendered
      expect(screen.getByText(/Regular streaming/)).toBeInTheDocument();
      expect(screen.getByText(/Response stream/)).toBeInTheDocument();
      expect(screen.getByText(/Typewriter effect/)).toBeInTheDocument();
      expect(screen.getByText(/Another stream/)).toBeInTheDocument();
      expect(screen.getByText(/Final response/)).toBeInTheDocument();
    });
  });

  describe('Animation Performance', () => {
    it('should maintain smooth cursor animation under load', async () => {
      // Create multiple components with cursor animation
      const cursors = [];
      for (let i = 0; i < 10; i++) {
        cursors.push(
          <StreamingText
            key={i}
            text=""
            showCursor={true}
          />
        );
      }

      render(<div>{cursors}</div>);

      // Test cursor blinking performance over multiple cycles
      const cycleCount = 5;
      const startTime = performance.now();

      for (let cycle = 0; cycle < cycleCount; cycle++) {
        await act(async () => {
          vi.advanceTimersByTime(500); // Complete blink cycle
        });
      }

      const animationTime = performance.now() - startTime;

      // Should handle cursor animation efficiently
      expect(animationTime).toBeLessThan(100);

      // All cursors should be present
      const cursorsOnScreen = screen.getAllByText('▊');
      expect(cursorsOnScreen).toHaveLength(10);
    });

    it('should optimize streaming animation for high-speed text', async () => {
      const mediumText = 'A'.repeat(500);

      const startTime = performance.now();

      render(<StreamingText text={mediumText} speed={10000} />); // Very high speed

      // Let streaming complete
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const streamTime = performance.now() - startTime;

      // High-speed streaming should be efficient
      expect(streamTime).toBeLessThan(100);

      expect(screen.getByText(mediumText)).toBeInTheDocument();
    });
  });

  describe('Resource Management', () => {
    it('should efficiently manage DOM updates during streaming', async () => {
      // Track DOM operations by monitoring queries
      let queryCount = 0;
      const originalQuerySelector = document.querySelector;
      document.querySelector = (...args) => {
        queryCount++;
        return originalQuerySelector.apply(document, args);
      };

      render(<StreamingText text="DOM efficiency test" speed={50} />);

      const initialQueries = queryCount;

      // Stream some characters
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const queriesAfterStreaming = queryCount - initialQueries;

      // Should not cause excessive DOM queries
      expect(queriesAfterStreaming).toBeLessThan(100);

      // Restore original function
      document.querySelector = originalQuerySelector;
    });

    it('should handle prop changes efficiently without unnecessary re-renders', async () => {
      let renderCount = 0;
      const TestWrapper = ({ text, speed }: { text: string; speed: number }) => {
        renderCount++;
        return <StreamingText text={text} speed={speed} />;
      };

      const { rerender } = render(<TestWrapper text="Initial" speed={50} />);

      const initialRenderCount = renderCount;

      // Change prop that should cause re-render
      rerender(<TestWrapper text="Updated" speed={50} />);

      // Should only re-render once for the prop change
      expect(renderCount - initialRenderCount).toBe(1);

      // Change prop that shouldn't affect streaming behavior
      rerender(<TestWrapper text="Updated" speed={50} />);

      // Should not cause additional unnecessary renders
      expect(renderCount - initialRenderCount).toBe(1);
    });
  });

  describe('Stress Testing', () => {
    it('should survive stress test with extreme usage patterns', async () => {
      const stressComponents = [];

      // Create stress scenario
      for (let i = 0; i < 5; i++) {
        stressComponents.push(
          <div key={i}>
            <StreamingText text={`Stress test ${i}`} speed={200} showCursor={true} />
            <StreamingResponse content={`Response ${i}`} isStreaming={true} agent={`agent-${i}`} />
            <TypewriterText text={`Type ${i}`} speed={150} delay={i * 10} />
          </div>
        );
      }

      const startTime = performance.now();

      const { unmount } = render(<div>{stressComponents}</div>);

      // Run stress operations
      for (let operation = 0; operation < 10; operation++) {
        await act(async () => {
          vi.advanceTimersByTime(50);
        });
      }

      const operationTime = performance.now() - startTime;

      // Should handle stress scenario efficiently
      expect(operationTime).toBeLessThan(300);

      // Cleanup
      unmount();

      // Should cleanup without errors
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    });

    it('should maintain stability with rapid state changes', async () => {
      const { rerender } = render(
        <StreamingText text="Stability test" speed={50} showCursor={true} />
      );

      // Rapidly change all possible props
      for (let i = 0; i < 50; i++) {
        rerender(
          <StreamingText
            text={`Test ${i}`}
            speed={50 + (i % 100)}
            showCursor={i % 2 === 0}
            isComplete={i % 3 === 0}
            width={i % 2 === 0 ? 80 : undefined}
            maxLines={i % 4 === 0 ? 5 : undefined}
            responsive={i % 2 === 1}
            onComplete={() => {}}
          />
        );

        await act(async () => {
          vi.advanceTimersByTime(5);
        });
      }

      // Should remain stable
      expect(screen.getByText(/Test 49/)).toBeInTheDocument();
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should optimize memory usage with large text content', async () => {
      // Test with progressively larger content
      const sizes = [100, 500, 1000, 5000];

      for (const size of sizes) {
        const largeText = 'Memory test content. '.repeat(size);

        const { unmount } = render(
          <StreamingText text={largeText} speed={1000} isComplete={true} />
        );

        expect(screen.getByText(largeText)).toBeInTheDocument();

        // Cleanup between tests
        unmount();
      }

      // All tests should pass without memory issues
    });

    it('should efficiently handle text formatting operations', async () => {
      const complexText = 'Line 1\nLine 2\nLong line that should wrap when width is constrained\nLine 4\nFinal line';

      const startTime = performance.now();

      render(
        <StreamingText
          text={complexText}
          width={30}
          maxLines={10}
          isComplete={true}
        />
      );

      const formatTime = performance.now() - startTime;

      // Text formatting should be efficient
      expect(formatTime).toBeLessThan(50);

      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Final line/)).toBeInTheDocument();
    });
  });
});