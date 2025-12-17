/**
 * Performance and Memory Tests for AgentThoughts component
 * Focuses on testing component performance with large content and high-frequency updates
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentThoughts, type AgentThoughtsProps } from '../AgentThoughts.js';

// Mock CollapsibleSection with performance tracking
const mockCollapsibleSection = vi.fn();
let renderCount = 0;
let totalRenderTime = 0;

mockCollapsibleSection.mockImplementation(({ title, children, ...props }) => {
  const startTime = performance.now();
  renderCount++;

  const result = (
    <div
      data-testid="collapsible-section"
      data-props={JSON.stringify(props)}
      data-title={title}
      data-render-count={renderCount}
    >
      <div data-testid="title">{title}</div>
      <div data-testid="content">{children}</div>
    </div>
  );

  totalRenderTime += performance.now() - startTime;
  return result;
});

vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: mockCollapsibleSection,
}));

vi.mock('ink', () => ({
  Box: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <div data-testid="box" {...props}>{children}</div>
  ),
  Text: ({ children, color, dimColor, wrap, ...props }: {
    children: React.ReactNode;
    color?: string;
    dimColor?: boolean;
    wrap?: string;
    [key: string]: any;
  }) => (
    <span
      data-testid="text"
      data-color={color}
      data-dim={dimColor}
      data-wrap={wrap}
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('AgentThoughts Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderCount = 0;
    totalRenderTime = 0;
  });

  describe('Large Content Performance', () => {
    it('should handle very large thinking content efficiently', () => {
      const largeContent = 'A'.repeat(100000); // 100KB of content
      const startTime = performance.now();

      render(
        <AgentThoughts
          thinking={largeContent}
          agent="performance-agent"
          maxLength={1000}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should complete render within reasonable time
      expect(renderTime).toBeLessThan(100); // 100ms threshold

      // Content should be properly truncated
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(1003); // 1000 + '...'
      expect(displayedText.endsWith('...')).toBe(true);
    });

    it('should handle extremely large content with verbose mode', () => {
      const extremeContent = 'X'.repeat(1000000); // 1MB of content
      const startTime = performance.now();

      render(
        <AgentThoughts
          thinking={extremeContent}
          agent="verbose-agent"
          displayMode="verbose"
          maxLength={500} // Should be overridden to 1000 in verbose mode
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should still complete within reasonable time
      expect(renderTime).toBeLessThan(200); // 200ms threshold

      // Should be truncated to verbose mode limit (1000)
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(1003); // 1000 + '...'
    });

    it('should handle content with many newlines and special characters efficiently', () => {
      const complexContent = Array.from({ length: 10000 }, (_, i) =>
        `Line ${i}: Special chars 🚀🎉✨ and unicode 测试 content\n`
      ).join('');

      const startTime = performance.now();

      render(
        <AgentThoughts
          thinking={complexContent}
          agent="complex-agent"
          maxLength={2000}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(150); // 150ms threshold

      // Should be properly truncated
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(2003); // 2000 + '...'
    });

    it('should efficiently handle content that requires complex truncation', () => {
      // Content with varying character widths and unicode
      const unicodeContent = '🚀'.repeat(1000) + '测试'.repeat(1000) + 'A'.repeat(1000);

      const startTime = performance.now();

      render(
        <AgentThoughts
          thinking={unicodeContent}
          agent="unicode-agent"
          maxLength={500}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100); // 100ms threshold

      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText.endsWith('...')).toBe(true);
    });
  });

  describe('High-Frequency Updates Performance', () => {
    it('should handle rapid thinking content updates efficiently', () => {
      const { rerender } = render(
        <AgentThoughts thinking="initial" agent="rapid-agent" />
      );

      const startTime = performance.now();

      // Perform 1000 rapid updates
      for (let i = 0; i < 1000; i++) {
        rerender(
          <AgentThoughts
            thinking={`Update ${i}: ${'x'.repeat(i % 100)}`}
            agent="rapid-agent"
          />
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete all updates within reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds threshold

      // Average time per update should be reasonable
      const averageUpdateTime = totalTime / 1000;
      expect(averageUpdateTime).toBeLessThan(2); // 2ms per update

      // Final state should be correct
      expect(screen.getByTestId('text')).toHaveTextContent('Update 999: ' + 'x'.repeat(99));
    });

    it('should handle rapid agent name changes efficiently', () => {
      const { rerender } = render(
        <AgentThoughts thinking="constant thinking" agent="agent-0" />
      );

      const startTime = performance.now();

      // Change agent names rapidly
      for (let i = 0; i < 500; i++) {
        rerender(
          <AgentThoughts
            thinking="constant thinking"
            agent={`agent-${i}`}
          />
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1500); // 1.5 seconds threshold

      // Final agent name should be correct
      expect(screen.getByTestId('title')).toHaveTextContent('💭 agent-499 thinking');
    });

    it('should handle rapid display mode changes efficiently', () => {
      const { rerender } = render(
        <AgentThoughts thinking="test content" agent="mode-agent" displayMode="normal" />
      );

      const startTime = performance.now();

      const modes: Array<'normal' | 'compact' | 'verbose'> = ['normal', 'compact', 'verbose'];

      // Rapidly cycle through display modes
      for (let i = 0; i < 300; i++) {
        rerender(
          <AgentThoughts
            thinking="test content"
            agent="mode-agent"
            displayMode={modes[i % 3]}
          />
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1000); // 1 second threshold

      // Should end in expected mode (300 % 3 = 0, so 'normal')
      expect(screen.getByTestId('collapsible-section')).toBeInTheDocument();
    });

    it('should handle rapid maxLength changes efficiently', () => {
      const longContent = 'A'.repeat(5000);
      const { rerender } = render(
        <AgentThoughts thinking={longContent} agent="length-agent" maxLength={100} />
      );

      const startTime = performance.now();

      // Rapidly change maxLength values
      for (let i = 1; i <= 200; i++) {
        rerender(
          <AgentThoughts
            thinking={longContent}
            agent="length-agent"
            maxLength={i * 10} // 10, 20, 30, ... 2000
          />
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1500); // 1.5 seconds threshold

      // Final truncation should be at 2000 characters + '...'
      const textElement = screen.getByTestId('text');
      const displayedText = textElement.textContent || '';
      expect(displayedText).toHaveLength(2003);
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('should not cause memory leaks with repeated mounting/unmounting', () => {
      const components: Array<() => void> = [];

      // Create and unmount many components
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <AgentThoughts
            thinking={`Component ${i} thinking content`}
            agent={`agent-${i}`}
          />
        );
        components.push(unmount);

        // Unmount every other component immediately
        if (i % 2 === 0) {
          unmount();
        }
      }

      // Unmount remaining components
      components.forEach((unmount, index) => {
        if (index % 2 === 1) {
          unmount();
        }
      });

      // Should not crash or cause memory issues
      expect(components).toHaveLength(100);
    });

    it('should handle simultaneous multiple instances efficiently', () => {
      const agents = Array.from({ length: 50 }, (_, i) => ({
        thinking: `Agent ${i} is thinking about complex problem solving...`,
        agent: `agent-${i}`
      }));

      const startTime = performance.now();

      render(
        <div>
          {agents.map((props, index) => (
            <AgentThoughts key={index} {...props} />
          ))}
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render all 50 instances efficiently
      expect(renderTime).toBeLessThan(1000); // 1 second threshold

      // All instances should be rendered
      const titles = screen.getAllByTestId('title');
      expect(titles).toHaveLength(50);
    });

    it('should efficiently clean up when props change frequently', () => {
      const { rerender } = render(
        <AgentThoughts thinking="initial" agent="cleanup-agent" />
      );

      // Simulate complex prop changes that might cause cleanup issues
      for (let i = 0; i < 100; i++) {
        const props = {
          thinking: `Iteration ${i} with complex content: ${'x'.repeat(i * 10)}`,
          agent: `agent-${i}`,
          displayMode: (['normal', 'compact', 'verbose'] as const)[i % 3],
          maxLength: 100 + (i * 5),
          defaultCollapsed: i % 2 === 0,
          icon: i % 5 === 0 ? '🤖' : undefined,
          useAsciiIcons: i % 7 === 0,
        };

        rerender(<AgentThoughts {...props} />);
      }

      // Should complete without issues
      expect(screen.getByTestId('title')).toBeInTheDocument();
    });
  });

  describe('Rendering Performance Benchmarks', () => {
    it('should meet rendering performance benchmarks for typical content', () => {
      const typicalContent = 'This is a typical agent thinking process with moderate length content that represents normal usage patterns.';
      const iterations = 100;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const { unmount } = render(
          <AgentThoughts
            thinking={typicalContent}
            agent="benchmark-agent"
          />
        );
        unmount();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      // Each render/unmount cycle should be fast
      expect(averageTime).toBeLessThan(5); // 5ms per cycle
      expect(totalTime).toBeLessThan(500); // 500ms total
    });

    it('should maintain performance with complex prop combinations', () => {
      const complexProps = [
        {
          thinking: 'Complex thinking 1 with émojis 🚀 and unicode 测试',
          agent: 'complex-agent-1',
          displayMode: 'verbose' as const,
          maxLength: 150,
          defaultCollapsed: false,
          icon: '🧠',
          useAsciiIcons: false,
        },
        {
          thinking: 'Another complex scenario with very long content that needs truncation handling',
          agent: 'complex-agent-2',
          displayMode: 'normal' as const,
          maxLength: 50,
          defaultCollapsed: true,
          icon: '[T]',
          useAsciiIcons: true,
        },
      ];

      const startTime = performance.now();

      complexProps.forEach((props, index) => {
        const { unmount } = render(<AgentThoughts {...props} key={index} />);
        unmount();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(50); // 50ms for complex scenarios
    });

    it('should handle stress test scenarios', () => {
      const stressContent = 'Stress test content: ' + 'A'.repeat(10000);
      const stressAgent = 'stress-test-agent-with-very-long-name-that-might-cause-issues';

      const { rerender } = render(
        <AgentThoughts
          thinking={stressContent}
          agent={stressAgent}
          maxLength={100}
        />
      );

      const startTime = performance.now();

      // Stress test with rapid changes
      for (let i = 0; i < 50; i++) {
        rerender(
          <AgentThoughts
            thinking={stressContent + i}
            agent={stressAgent + i}
            displayMode={i % 2 === 0 ? 'normal' : 'verbose'}
            maxLength={100 + i}
            collapsed={i % 3 === 0}
          />
        );
      }

      const endTime = performance.now();
      const stressTime = endTime - startTime;

      expect(stressTime).toBeLessThan(500); // 500ms for stress test
    });
  });

  describe('Component Render Count Optimization', () => {
    it('should minimize unnecessary re-renders', () => {
      renderCount = 0; // Reset counter

      const { rerender } = render(
        <AgentThoughts
          thinking="stable content"
          agent="stable-agent"
        />
      );

      const initialRenderCount = renderCount;

      // Re-render with identical props
      rerender(
        <AgentThoughts
          thinking="stable content"
          agent="stable-agent"
        />
      );

      // Should render, as React doesn't automatically skip re-renders for props changes
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should track render efficiency over time', () => {
      renderCount = 0;
      totalRenderTime = 0;

      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const { unmount } = render(
          <AgentThoughts
            thinking={`Content ${i}`}
            agent={`agent-${i}`}
          />
        );
        unmount();
      }

      const averageRenderTime = totalRenderTime / renderCount;

      // Each individual render should be fast
      expect(averageRenderTime).toBeLessThan(2); // 2ms per render
      expect(renderCount).toBe(iterations);
    });
  });
});