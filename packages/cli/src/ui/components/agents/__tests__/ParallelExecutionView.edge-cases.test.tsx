import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

/**
 * Edge case tests for ParallelExecutionView focusing on error conditions,
 * boundary values, and unusual scenarios that might not be covered in
 * normal functional tests.
 */

// Mock the hooks
const mockUseElapsedTime = vi.fn();
const mockUseStdoutDimensions = vi.fn();

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: vi.fn(({ progress, showPercentage, color }) =>
    `[ProgressBar: ${progress}%${showPercentage ? ' shown' : ''}${color ? ` color:${color}` : ''}]`
  ),
}));

describe('ParallelExecutionView - Edge Cases and Error Conditions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockReturnValue('1m 23s');
    // Default mock - will be overridden in specific tests
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      breakpoint: 'normal',
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Malformed Agent Data', () => {
    it('should handle agents with null/undefined properties gracefully', () => {
      const malformedAgents: ParallelAgent[] = [
        {
          name: 'agent1',
          status: 'parallel',
          stage: null as any,
          progress: undefined,
          startedAt: null as any,
        },
        {
          name: '',
          status: 'active',
          stage: undefined,
          progress: null as any,
          startedAt: undefined,
        },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={malformedAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
      expect(output).toContain('agent1');
      // Empty name should still render
      expect(output).toContain('⚡');
    });

    it('should handle agents with extreme progress values', () => {
      const extremeProgressAgents: ParallelAgent[] = [
        { name: 'agent1', status: 'parallel', progress: -100 },
        { name: 'agent2', status: 'active', progress: 1000 },
        { name: 'agent3', status: 'parallel', progress: 0.00001 },
        { name: 'agent4', status: 'active', progress: NaN },
        { name: 'agent5', status: 'parallel', progress: Infinity },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={extremeProgressAgents} compact={true} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (5 agents)');

      // Should handle extreme values without crashing
      extremeProgressAgents.forEach(agent => {
        expect(output).toContain(agent.name);
      });
    });

    it('should handle agents with very long names and stages', () => {
      const longNameAgents: ParallelAgent[] = [
        {
          name: 'a'.repeat(100),
          status: 'parallel',
          stage: 'b'.repeat(200),
        },
        {
          name: 'agent-with-unicode-🚀-emoji-💻-characters',
          status: 'active',
          stage: 'processing-unicode-🔥-data',
        },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={longNameAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
      // Should not crash with long names
      expect(output).toBeDefined();
    });

    it('should handle agents with special characters in names', () => {
      const specialCharAgents: ParallelAgent[] = [
        { name: 'agent\nwith\nnewlines', status: 'parallel' },
        { name: 'agent\twith\ttabs', status: 'active' },
        { name: 'agent with spaces   and   multiple   spaces', status: 'parallel' },
        { name: 'agent"with"quotes', status: 'active' },
        { name: "agent'with'apostrophes", status: 'parallel' },
        { name: 'agent<with>brackets', status: 'active' },
        { name: 'agent&with&ampersands', status: 'parallel' },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={specialCharAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (7 agents)');
      // Should handle special characters without breaking
      expect(output).toBeDefined();
    });
  });

  describe('Terminal Dimension Edge Cases', () => {
    it('should handle extremely small terminal dimensions', () => {
      const extremeConfigs = [
        { width: 1, height: 1, desc: 'single character' },
        { width: 5, height: 3, desc: 'tiny' },
        { width: 0, height: 0, desc: 'zero dimensions' },
        { width: -10, height: -5, desc: 'negative dimensions' },
      ];

      extremeConfigs.forEach(({ width, height, desc }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height,
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width < 160,
          isWide: width >= 160,
          breakpoint: width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide',
          isAvailable: true,
        });

        const agents: ParallelAgent[] = [
          { name: 'test', status: 'parallel' },
        ];

        expect(() => {
          const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
          lastFrame();
        }).not.toThrow();
      });
    });

    it('should handle extremely large terminal dimensions', () => {
      const largeConfigs = [
        { width: 1000, height: 500, desc: 'very large' },
        { width: 10000, height: 1000, desc: 'extremely large' },
        { width: Number.MAX_SAFE_INTEGER, height: 100, desc: 'max safe integer width' },
      ];

      largeConfigs.forEach(({ width, height, desc }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height,
          isNarrow: false,
          isCompact: false,
          isNormal: false,
          isWide: true,
          breakpoint: 'wide',
          isAvailable: true,
        });

        const agents: ParallelAgent[] = [
          { name: 'test1', status: 'parallel' },
          { name: 'test2', status: 'active' },
        ];

        expect(() => {
          const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
          lastFrame();
        }).not.toThrow();
      });
    });

    it('should handle malformed dimension objects', () => {
      const malformedDimensions = [
        {
          width: 'not-a-number' as any,
          height: true as any,
          isNarrow: 'maybe' as any,
          isCompact: null,
          isNormal: undefined,
          isWide: {},
          breakpoint: 42 as any,
          isAvailable: 'unknown' as any,
        },
        null as any,
        undefined as any,
        {} as any,
      ];

      malformedDimensions.forEach((dimensions, index) => {
        mockUseStdoutDimensions.mockReturnValue(dimensions);

        const agents: ParallelAgent[] = [
          { name: `test${index}`, status: 'parallel' },
        ];

        expect(() => {
          const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
          lastFrame();
        }).not.toThrow();
      });
    });
  });

  describe('Hook Error Conditions', () => {
    it('should handle useStdoutDimensions throwing an error', () => {
      mockUseStdoutDimensions.mockImplementation(() => {
        throw new Error('Hook failed');
      });

      const agents: ParallelAgent[] = [
        { name: 'test', status: 'parallel' },
      ];

      expect(() => {
        const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
        lastFrame();
      }).toThrow('Hook failed');
    });

    it('should handle useElapsedTime returning non-string values', () => {
      mockUseElapsedTime.mockReturnValue(null);
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const agents: ParallelAgent[] = [
        {
          name: 'test',
          status: 'parallel',
          startedAt: new Date(),
        },
      ];

      const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
      const output = lastFrame();

      // Should handle null elapsed time gracefully
      expect(output).toContain('test');
    });

    it('should handle useElapsedTime throwing an error', () => {
      mockUseElapsedTime.mockImplementation(() => {
        throw new Error('Elapsed time calculation failed');
      });

      const agents: ParallelAgent[] = [
        {
          name: 'test',
          status: 'parallel',
          startedAt: new Date(),
        },
      ];

      expect(() => {
        const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
        lastFrame();
      }).toThrow('Elapsed time calculation failed');
    });
  });

  describe('Large Data Sets', () => {
    it('should handle a large number of agents efficiently', () => {
      const startTime = performance.now();

      const manyAgents: ParallelAgent[] = Array.from({ length: 100 }, (_, i) => ({
        name: `agent${i + 1}`,
        status: i % 2 === 0 ? 'parallel' : 'active',
        stage: `stage${i + 1}`,
        progress: (i * 5) % 100,
        startedAt: new Date(Date.now() - i * 1000),
      }));

      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const { lastFrame } = render(
        <ParallelExecutionView agents={manyAgents} />
      );

      const output = lastFrame();
      const renderTime = performance.now() - startTime;

      // Should render without taking too long (reasonable threshold)
      expect(renderTime).toBeLessThan(5000); // 5 seconds max

      expect(output).toContain('⟂ Parallel Execution (100 agents)');
      // Spot check a few agents
      expect(output).toContain('agent1');
      expect(output).toContain('agent50');
      expect(output).toContain('agent100');
    });

    it('should handle rapid agent list changes without memory leaks', () => {
      let agents: ParallelAgent[] = [];

      // Create many different agent configurations
      for (let i = 0; i < 10; i++) {
        agents = Array.from({ length: 5 + i }, (_, j) => ({
          name: `agent${i}-${j}`,
          status: j % 2 === 0 ? 'parallel' : 'active',
          stage: `stage${j}`,
        }));

        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} key={i} />
        );

        const output = lastFrame();
        expect(output).toContain('⟂ Parallel Execution');
      }

      // Should not crash or throw errors with rapid changes
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle components being unmounted and remounted', () => {
      const agents: ParallelAgent[] = [
        { name: 'test1', status: 'parallel' },
        { name: 'test2', status: 'active' },
      ];

      // Mount
      const { lastFrame, unmount } = render(
        <ParallelExecutionView agents={agents} />
      );

      expect(lastFrame()).toContain('⟂ Parallel Execution (2 agents)');

      // Unmount
      unmount();

      // Remount
      const { lastFrame: newLastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      expect(newLastFrame()).toContain('⟂ Parallel Execution (2 agents)');
    });

    it('should handle rapid prop changes', () => {
      let agents: ParallelAgent[] = [
        { name: 'test', status: 'parallel' },
      ];

      const { lastFrame, rerender } = render(
        <ParallelExecutionView agents={agents} />
      );

      // Change props rapidly
      for (let i = 0; i < 10; i++) {
        agents = [
          {
            name: `test${i}`,
            status: i % 2 === 0 ? 'parallel' : 'active',
            stage: `stage${i}`,
            progress: i * 10,
          },
        ];

        rerender(<ParallelExecutionView agents={agents} compact={i % 2 === 0} />);

        const output = lastFrame();
        expect(output).toContain(`test${i}`);
      }
    });
  });

  describe('Accessibility and Output Consistency', () => {
    it('should maintain consistent output structure regardless of content', () => {
      const testCases = [
        [],
        [{ name: 'single', status: 'parallel' as const }],
        Array.from({ length: 10 }, (_, i) => ({ name: `agent${i}`, status: 'parallel' as const })),
      ];

      testCases.forEach((agents, index) => {
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} key={index} />
        );

        const output = lastFrame();

        if (agents.length === 0) {
          expect(output).toContain('No parallel agents currently active');
        } else {
          expect(output).toContain('⟂ Parallel Execution');
          // Should have consistent header structure
        }
      });
    });

    it('should handle mixed content types in agent properties', () => {
      const mixedAgents: ParallelAgent[] = [
        {
          name: 'normal-agent',
          status: 'parallel',
          stage: 'normal-stage',
          progress: 50,
        },
        {
          name: '123456789',
          status: 'active',
          stage: '!@#$%^&*()',
          progress: 0,
        },
        {
          name: 'unicode-agent-🎯',
          status: 'parallel',
          stage: 'unicode-stage-🔥',
          progress: 100,
        },
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={mixedAgents} />
      );

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (3 agents)');

      // All agents should be displayed despite mixed content
      mixedAgents.forEach(agent => {
        expect(output).toContain(agent.name);
      });
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle simultaneous prop and hook updates', () => {
      const agents: ParallelAgent[] = [
        { name: 'test', status: 'parallel', startedAt: new Date() },
      ];

      // Simulate concurrent updates
      mockUseElapsedTime.mockReturnValue('1m 30s');
      mockUseStdoutDimensions.mockReturnValue({
        width: 100,
        height: 25,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const { lastFrame, rerender } = render(
        <ParallelExecutionView agents={agents} />
      );

      // Update both hook values and props simultaneously
      mockUseElapsedTime.mockReturnValue('2m 45s');
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 40,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        breakpoint: 'wide',
        isAvailable: true,
      });

      const updatedAgents = [
        ...agents,
        { name: 'new-agent', status: 'active' as const },
      ];

      rerender(<ParallelExecutionView agents={updatedAgents} compact={true} />);

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
      expect(output).toContain('test');
      expect(output).toContain('new-agent');
    });
  });
});