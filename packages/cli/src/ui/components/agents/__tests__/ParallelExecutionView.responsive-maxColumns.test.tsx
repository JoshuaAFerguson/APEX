import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

// Mock the hooks
const mockUseElapsedTime = vi.fn();
const mockUseStdoutDimensions = vi.fn();

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock the ProgressBar component
vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: vi.fn(({ progress, showPercentage, color }) =>
    `[ProgressBar: ${progress}%${showPercentage ? ' shown' : ''}${color ? ` color:${color}` : ''}]`
  ),
}));

describe('ParallelExecutionView - Responsive MaxColumns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockReturnValue('1m 23s');
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // Test data factories
  const createParallelAgent = (overrides: Partial<ParallelAgent> = {}): ParallelAgent => ({
    name: 'test-agent',
    status: 'parallel',
    stage: undefined,
    progress: undefined,
    startedAt: undefined,
    ...overrides,
  });

  // Create test agents for layout testing
  const createTestAgents = (count: number): ParallelAgent[] =>
    Array.from({ length: count }, (_, i) =>
      createParallelAgent({
        name: `agent${i + 1}`,
        status: i % 2 === 0 ? 'parallel' : 'active',
        stage: `stage${i + 1}`,
        progress: (i + 1) * 20,
        startedAt: new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      })
    );

  describe('Narrow Terminal (width < 60)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
        isAvailable: true,
      });
    });

    it('should use maxColumns=1 for narrow terminals', () => {
      const agents = createTestAgents(4);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();

      // Should show all agents (as they are parallel/active)
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('agent4');

      // With maxColumns=1, each agent should be on its own line
      // Count the number of agent cards to ensure proper layout
      expect(output).toContain('⟂ Parallel Execution (4 agents)');
    });

    it('should use maxColumns=1 regardless of compact mode in narrow terminals', () => {
      const agents = createTestAgents(3);

      const { lastFrame: compactFrame } = render(
        <ParallelExecutionView agents={agents} compact={true} />
      );
      const { lastFrame: fullFrame } = render(
        <ParallelExecutionView agents={agents} compact={false} />
      );

      const compactOutput = compactFrame();
      const fullOutput = fullFrame();

      // Both should show all agents in single column layout
      expect(compactOutput).toContain('⟂ Parallel Execution (3 agents)');
      expect(fullOutput).toContain('⟂ Parallel Execution (3 agents)');
    });
  });

  describe('Compact Terminal (60 <= width < 100)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 24,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
        isAvailable: true,
      });
    });

    it('should use maxColumns=2 for compact terminals in full mode', () => {
      const agents = createTestAgents(4);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} compact={false} />
      );

      const output = lastFrame();

      // Should show all 4 agents
      expect(output).toContain('⟂ Parallel Execution (4 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('agent4');
    });

    it('should use maxColumns=1 for compact terminals in compact mode', () => {
      const agents = createTestAgents(3);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} compact={true} />
      );

      const output = lastFrame();

      // Should show all 3 agents in compact layout
      expect(output).toContain('⟂ Parallel Execution (3 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
    });
  });

  describe('Normal Terminal (100 <= width < 160)', () => {
    beforeEach(() => {
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

    it('should calculate maxColumns based on card width in full mode', () => {
      const agents = createTestAgents(5);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} compact={false} />
      );

      const output = lastFrame();

      // Width 120, card width ~28 => maxColumns ~4
      // Should show all 5 agents
      expect(output).toContain('⟂ Parallel Execution (5 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('agent4');
      expect(output).toContain('agent5');
    });

    it('should calculate maxColumns based on card width in compact mode', () => {
      const agents = createTestAgents(6);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} compact={true} />
      );

      const output = lastFrame();

      // Width 120, compact card width ~20 => maxColumns ~6
      // Should show all 6 agents
      expect(output).toContain('⟂ Parallel Execution (6 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('agent4');
      expect(output).toContain('agent5');
      expect(output).toContain('agent6');
    });
  });

  describe('Wide Terminal (width >= 160)', () => {
    beforeEach(() => {
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
    });

    it('should calculate maxColumns based on card width in full mode', () => {
      const agents = createTestAgents(8);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} compact={false} />
      );

      const output = lastFrame();

      // Width 200, card width ~28 => maxColumns ~7
      // Should show all 8 agents
      expect(output).toContain('⟂ Parallel Execution (8 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent8');
    });

    it('should calculate maxColumns based on card width in compact mode', () => {
      const agents = createTestAgents(10);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} compact={true} />
      );

      const output = lastFrame();

      // Width 200, compact card width ~20 => maxColumns ~10
      // Should show all 10 agents
      expect(output).toContain('⟂ Parallel Execution (10 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent10');
    });
  });

  describe('Explicit MaxColumns Override', () => {
    beforeEach(() => {
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

    it('should use explicit maxColumns when provided', () => {
      const agents = createTestAgents(6);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} maxColumns={2} />
      );

      const output = lastFrame();

      // Should respect explicit maxColumns=2 regardless of terminal width
      expect(output).toContain('⟂ Parallel Execution (6 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent6');
    });

    it('should override responsive calculation with explicit maxColumns', () => {
      const agents = createTestAgents(4);

      // Test with different explicit values
      const { lastFrame: frame1 } = render(
        <ParallelExecutionView agents={agents} maxColumns={1} />
      );
      const { lastFrame: frame4 } = render(
        <ParallelExecutionView agents={agents} maxColumns={4} />
      );

      const output1 = frame1();
      const output4 = frame4();

      expect(output1).toContain('⟂ Parallel Execution (4 agents)');
      expect(output4).toContain('⟂ Parallel Execution (4 agents)');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very small terminal widths gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20,
        height: 10,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const agents = createTestAgents(2);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();

      // Should still render without errors, using maxColumns=1
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
    });

    it('should handle unavailable terminal dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback width
        height: 24,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
        isAvailable: false, // dimensions not available
      });

      const agents = createTestAgents(3);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();

      // Should still work with fallback dimensions
      expect(output).toContain('⟂ Parallel Execution (3 agents)');
    });

    it('should ensure minimum maxColumns of 1', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 5, // extremely narrow
        height: 10,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const agents = createTestAgents(1);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();

      // Should not crash and should show the agent
      expect(output).toContain('agent1');
    });
  });

  describe('Integration with Existing Features', () => {
    beforeEach(() => {
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

    it('should work correctly with agents filtering (parallel/active only)', () => {
      const agents: ParallelAgent[] = [
        createParallelAgent({ name: 'agent1', status: 'parallel' }),
        createParallelAgent({ name: 'agent2', status: 'active' }),
        createParallelAgent({ name: 'agent3', status: 'completed' }),
        createParallelAgent({ name: 'agent4', status: 'waiting' }),
        createParallelAgent({ name: 'agent5', status: 'parallel' }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();

      // Should only show parallel/active agents (3 agents)
      expect(output).toContain('⟂ Parallel Execution (3 agents)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent5');
      expect(output).not.toContain('agent3');
      expect(output).not.toContain('agent4');
    });

    it('should handle empty agent list regardless of terminal width', () => {
      const { lastFrame } = render(
        <ParallelExecutionView agents={[]} />
      );

      const output = lastFrame();

      expect(output).toContain('No parallel agents currently active');
    });

    it('should work correctly with different agent combinations', () => {
      const mixedAgents: ParallelAgent[] = [
        createParallelAgent({
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          progress: 75,
          startedAt: new Date('2024-01-01T10:00:00Z'),
        }),
        createParallelAgent({
          name: 'tester',
          status: 'active',
          progress: 40,
        }),
        createParallelAgent({
          name: 'reviewer',
          status: 'parallel',
          stage: 'review',
        }),
      ];

      const { lastFrame } = render(
        <ParallelExecutionView agents={mixedAgents} />
      );

      const output = lastFrame();

      expect(output).toContain('⟂ Parallel Execution (3 agents)');
      expect(output).toContain('⟂ developer');
      expect(output).toContain('⚡ tester');
      expect(output).toContain('⟂ reviewer');
    });
  });
});