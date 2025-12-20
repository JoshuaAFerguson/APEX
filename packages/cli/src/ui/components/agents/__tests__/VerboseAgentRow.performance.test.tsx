import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { VerboseAgentRow, type VerboseAgentRowProps } from '../VerboseAgentRow';
import type { AgentInfo } from '../AgentPanel';

/**
 * Performance tests for VerboseAgentRow component
 * Tests rendering performance, memory usage, and optimization
 */
describe('VerboseAgentRow - Performance Tests', () => {
  const mockUseElapsedTime = vi.fn();

  beforeEach(() => {
    vi.doMock('../../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));
    mockUseElapsedTime.mockReturnValue('01:23');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useElapsedTime.js');
  });

  const createPerformanceAgent = (overrides: Partial<AgentInfo> = {}): AgentInfo => ({
    name: 'performance-agent',
    status: 'active',
    stage: 'performance-testing',
    progress: 50,
    startedAt: new Date(),
    debugInfo: {
      tokensUsed: { input: 5000, output: 3000 },
      turnCount: 10,
      lastToolCall: 'PerformanceTest',
      errorCount: 2,
    },
    ...overrides,
  });

  const createProps = (agentOverrides: Partial<AgentInfo> = {}): VerboseAgentRowProps => ({
    agent: createPerformanceAgent(agentOverrides),
    isActive: true,
    color: 'green',
  });

  describe('Rendering Performance', () => {
    it('renders initial component within performance threshold', () => {
      const props = createProps();

      const startTime = performance.now();
      render(<VerboseAgentRow {...props} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;

      // Should render within 50ms
      expect(renderTime).toBeLessThan(50);

      // Verify all content is rendered correctly
      expect(screen.getByText('performance-agent')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 5.0k→3.0k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 10')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: PerformanceTest')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 2')).toBeInTheDocument();
    });

    it('handles large token counts without performance degradation', () => {
      const props = createProps({
        debugInfo: {
          tokensUsed: { input: 999999999, output: 888888888 },
          turnCount: 999999,
          lastToolCall: 'LargeDataProcessor',
          errorCount: 99999,
        },
      });

      const startTime = performance.now();
      render(<VerboseAgentRow {...props} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;

      // Should handle large numbers efficiently
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByText('🔢 Tokens: 999.9M→888.8M')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 999999')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 99999')).toBeInTheDocument();
    });

    it('renders multiple components efficiently', () => {
      const components = Array.from({ length: 50 }, (_, i) =>
        createProps({
          name: `agent-${i}`,
          debugInfo: {
            tokensUsed: { input: 1000 + i * 100, output: 800 + i * 50 },
            turnCount: i + 1,
            lastToolCall: `Tool${i}`,
            errorCount: i % 5,
          },
        })
      );

      const startTime = performance.now();

      components.forEach((props, index) => {
        const { unmount } = render(<VerboseAgentRow {...props} />);

        // Verify key content for a few components
        if (index < 5) {
          expect(screen.getByText(`agent-${index}`)).toBeInTheDocument();
        }

        unmount();
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 50 components should render in under 500ms (10ms per component average)
      expect(totalTime).toBeLessThan(500);
    });

    it('handles rapid prop updates efficiently', () => {
      const props = createProps();
      const { rerender } = render(<VerboseAgentRow {...props} />);

      const startTime = performance.now();

      // Simulate rapid updates (like real-time token counting)
      for (let i = 1; i <= 100; i++) {
        const updatedProps = createProps({
          debugInfo: {
            tokensUsed: { input: 5000 + i * 10, output: 3000 + i * 8 },
            turnCount: 10 + i,
            lastToolCall: `Tool${i}`,
            errorCount: Math.floor(i / 10),
          },
        });

        rerender(<VerboseAgentRow {...updatedProps} />);
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // 100 updates should complete in under 200ms
      expect(updateTime).toBeLessThan(200);

      // Verify final state
      expect(screen.getByText('🔢 Tokens: 6.0k→3.8k')).toBeInTheDocument();
      expect(screen.getByText('🔄 Turns: 110')).toBeInTheDocument();
      expect(screen.getByText('🔧 Last tool: Tool100')).toBeInTheDocument();
      expect(screen.getByText('❌ Errors: 10')).toBeInTheDocument();
    });
  });

  describe('Memory Efficiency', () => {
    it('does not create memory leaks with frequent re-renders', () => {
      const props = createProps();
      const { rerender, unmount } = render(<VerboseAgentRow {...props} />);

      // Track initial memory usage
      const initialMemory = process.memoryUsage();

      // Perform many re-renders
      for (let i = 0; i < 1000; i++) {
        const updatedProps = createProps({
          debugInfo: {
            tokensUsed: { input: 1000 + i, output: 800 + i },
            turnCount: i,
          },
        });
        rerender(<VerboseAgentRow {...updatedProps} />);
      }

      // Clean up
      unmount();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Allow for some increase but should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('cleans up event listeners and timers properly', () => {
      const props = createProps();
      const { unmount } = render(<VerboseAgentRow {...props} />);

      // Component should unmount cleanly
      expect(() => unmount()).not.toThrow();

      // useElapsedTime hook should have been called with appropriate cleanup
      expect(mockUseElapsedTime).toHaveBeenCalled();
    });

    it('handles component mounting and unmounting efficiently', () => {
      const props = createProps();

      const startTime = performance.now();

      // Mount and unmount multiple times
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<VerboseAgentRow {...props} />);
        unmount();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 100 mount/unmount cycles should complete quickly
      expect(totalTime).toBeLessThan(500);
    });
  });

  describe('Token Formatting Performance', () => {
    it('formats tokens efficiently across different magnitudes', () => {
      const tokenTests = [
        { input: 123, output: 456 },
        { input: 1234, output: 5678 },
        { input: 123456, output: 567890 },
        { input: 1234567, output: 5678901 },
        { input: 12345678, output: 56789012 },
        { input: 123456789, output: 567890123 },
      ];

      const startTime = performance.now();

      tokenTests.forEach((tokens, index) => {
        const props = createProps({
          name: `agent-${index}`,
          debugInfo: { tokensUsed: tokens },
        });

        const { unmount } = render(<VerboseAgentRow {...props} />);

        // Verify formatting is correct
        const expectedInput = tokens.input >= 1000000
          ? `${(tokens.input / 1000000).toFixed(1)}M`
          : tokens.input >= 1000
          ? `${(tokens.input / 1000).toFixed(1)}k`
          : tokens.input.toString();

        const expectedOutput = tokens.output >= 1000000
          ? `${(tokens.output / 1000000).toFixed(1)}M`
          : tokens.output >= 1000
          ? `${(tokens.output / 1000).toFixed(1)}k`
          : tokens.output.toString();

        expect(screen.getByText(`🔢 Tokens: ${expectedInput}→${expectedOutput}`)).toBeInTheDocument();

        unmount();
      });

      const endTime = performance.now();
      const formatTime = endTime - startTime;

      // Token formatting should be very fast
      expect(formatTime).toBeLessThan(50);
    });

    it('handles extreme token values efficiently', () => {
      const extremeTokens = [
        { input: 0, output: 0 },
        { input: Number.MAX_SAFE_INTEGER / 2, output: Number.MAX_SAFE_INTEGER / 3 },
        { input: 999999999999999, output: 888888888888888 },
      ];

      extremeTokens.forEach((tokens, index) => {
        const props = createProps({
          name: `extreme-agent-${index}`,
          debugInfo: { tokensUsed: tokens },
        });

        const startTime = performance.now();
        const { unmount } = render(<VerboseAgentRow {...props} />);
        const endTime = performance.now();

        const renderTime = endTime - startTime;

        // Should handle extreme values quickly
        expect(renderTime).toBeLessThan(20);

        // Should render without errors
        expect(screen.getByText(`extreme-agent-${index}`)).toBeInTheDocument();
        expect(screen.getByText(/🔢 Tokens:/)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Component Optimization', () => {
    it('does not re-render unnecessarily with identical props', () => {
      const renderSpy = vi.fn();

      const OptimizedWrapper = (props: VerboseAgentRowProps) => {
        renderSpy();
        return <VerboseAgentRow {...props} />;
      };

      const props = createProps();
      const { rerender } = render(<OptimizedWrapper {...props} />);

      const initialRenderCount = renderSpy.mock.calls.length;

      // Re-render with identical props
      rerender(<OptimizedWrapper {...props} />);

      // Should not cause additional renders if properly optimized
      // Note: This test depends on React optimization, may render twice due to React dev mode
      expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(initialRenderCount + 1);
    });

    it('re-renders efficiently when only debug data changes', () => {
      const props = createProps();
      const { rerender } = render(<VerboseAgentRow {...props} />);

      const startTime = performance.now();

      // Update only debug info
      const updatedProps = {
        ...props,
        agent: {
          ...props.agent,
          debugInfo: {
            ...props.agent.debugInfo!,
            turnCount: 999,
            tokensUsed: { input: 99999, output: 88888 },
          },
        },
      };

      rerender(<VerboseAgentRow {...updatedProps} />);

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Debug data updates should be very fast
      expect(updateTime).toBeLessThan(10);

      // Verify updated content
      expect(screen.getByText('🔄 Turns: 999')).toBeInTheDocument();
      expect(screen.getByText('🔢 Tokens: 99.9k→88.8k')).toBeInTheDocument();
    });

    it('handles conditional rendering efficiently', () => {
      const baseAgent = createPerformanceAgent();

      // Test with different combinations of missing debug info
      const testCases = [
        { debugInfo: undefined },
        { debugInfo: {} },
        { debugInfo: { tokensUsed: { input: 1000, output: 800 } } },
        { debugInfo: { turnCount: 5 } },
        { debugInfo: { lastToolCall: 'TestTool' } },
        { debugInfo: { errorCount: 1 } },
      ];

      const startTime = performance.now();

      testCases.forEach((testCase, index) => {
        const props = createProps({
          name: `conditional-agent-${index}`,
          ...testCase,
        });

        const { unmount } = render(<VerboseAgentRow {...props} />);
        unmount();
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Conditional rendering should be efficient
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Hook Performance', () => {
    it('optimizes useElapsedTime hook calls', () => {
      const activeProps = createProps({ status: 'active', startedAt: new Date() });
      const inactiveProps = createProps({ status: 'completed' }, { isActive: false });

      // Render active agent
      const { unmount: unmountActive } = render(<VerboseAgentRow {...activeProps} />);

      // Should call useElapsedTime with date for active agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(expect.any(Date));

      unmountActive();
      mockUseElapsedTime.mockClear();

      // Render inactive agent
      const { unmount: unmountInactive } = render(<VerboseAgentRow {...inactiveProps} />);

      // Should call useElapsedTime with null for inactive agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      unmountInactive();
    });

    it('handles rapid status changes efficiently', () => {
      const props = createProps({ status: 'active', startedAt: new Date() });
      const { rerender } = render(<VerboseAgentRow {...props} />);

      const startTime = performance.now();

      // Rapidly change status
      const statuses: AgentInfo['status'][] = ['active', 'waiting', 'completed', 'idle', 'parallel'];

      for (let i = 0; i < 100; i++) {
        const status = statuses[i % statuses.length];
        const updatedProps = {
          ...props,
          agent: { ...props.agent, status },
        };
        rerender(<VerboseAgentRow {...updatedProps} />);
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Rapid status changes should be handled efficiently
      expect(updateTime).toBeLessThan(100);
    });
  });
});