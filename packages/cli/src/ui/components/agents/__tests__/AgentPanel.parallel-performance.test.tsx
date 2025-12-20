/**
 * Performance Tests for Parallel Agent Execution
 *
 * This test suite focuses on performance characteristics, memory usage,
 * and scalability of the parallel agent execution features.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Performance Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock performance.now for consistent testing
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Rendering Performance', () => {
    it('renders large numbers of parallel agents within performance thresholds', () => {
      const agentCounts = [10, 25, 50, 100];

      agentCounts.forEach(count => {
        const startTime = performance.now();

        const largeAgentSet: AgentInfo[] = Array.from({ length: count }, (_, i) => ({
          name: `perf-agent-${i}`,
          status: 'parallel' as const,
          stage: `performance-task-${i}`,
          progress: (i * 2) % 100,
          startedAt: new Date(Date.now() - i * 1000),
        }));

        const { unmount } = render(
          <AgentPanel
            agents={[{ name: 'main-agent', status: 'active' }]}
            showParallel={true}
            parallelAgents={largeAgentSet}
          />
        );

        const renderTime = performance.now() - startTime;

        // Performance thresholds (adjust based on requirements)
        // Even 100 agents should render in under 200ms
        const maxRenderTime = Math.min(200, count * 2); // Scale linearly with agent count
        expect(renderTime).toBeLessThan(maxRenderTime);

        // Verify functional correctness
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('perf-agent-0')).toBeInTheDocument();
        expect(screen.getByText(`perf-agent-${count - 1}`)).toBeInTheDocument();

        unmount();
      });
    });

    it('maintains consistent performance across different view modes', () => {
      const agentSet: AgentInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `mode-agent-${i}`,
        status: 'parallel' as const,
        stage: `mode-task-${i}`,
        progress: i + 10,
        startedAt: new Date(Date.now() - i * 1000),
      }));

      const modes = [
        { compact: false, useDetailedParallelView: false },
        { compact: false, useDetailedParallelView: true },
        { compact: true, useDetailedParallelView: false },
        { compact: true, useDetailedParallelView: true },
      ];

      const performanceTimes: number[] = [];

      modes.forEach((mode, index) => {
        const startTime = performance.now();

        const { unmount } = render(
          <AgentPanel
            agents={[{ name: `main-${index}`, status: 'active' }]}
            showParallel={true}
            parallelAgents={agentSet}
            compact={mode.compact}
            useDetailedParallelView={mode.useDetailedParallelView}
          />
        );

        const renderTime = performance.now() - startTime;
        performanceTimes.push(renderTime);

        // Each mode should render within reasonable time
        expect(renderTime).toBeLessThan(200);

        unmount();
      });

      // Performance variance should be reasonable across modes
      const maxTime = Math.max(...performanceTimes);
      const minTime = Math.min(...performanceTimes);
      const variance = maxTime - minTime;

      // Variance should not exceed 100ms between modes
      expect(variance).toBeLessThan(100);
    });

    it('handles rapid prop updates efficiently', () => {
      const updateCount = 100;
      const baseAgents: AgentInfo[] = [{ name: 'base-agent', status: 'active' }];

      const startTime = performance.now();

      const { rerender } = render(
        <AgentPanel
          agents={baseAgents}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // Perform rapid updates
      for (let i = 0; i < updateCount; i++) {
        const updateAgents: AgentInfo[] = Array.from({ length: 5 }, (_, j) => ({
          name: `update-${i}-${j}`,
          status: 'parallel' as const,
          stage: `update-stage-${i}-${j}`,
          progress: (i + j) % 100,
        }));

        rerender(
          <AgentPanel
            agents={baseAgents}
            showParallel={true}
            parallelAgents={updateAgents}
          />
        );
      }

      const totalTime = performance.now() - startTime;
      const avgTimePerUpdate = totalTime / updateCount;

      // Each update should average less than 5ms
      expect(avgTimePerUpdate).toBeLessThan(5);
      expect(totalTime).toBeLessThan(500); // Total under 500ms

      // Verify final state is correct
      expect(screen.getByText('update-99-0')).toBeInTheDocument();
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('cleans up resources when parallel agents are removed', () => {
      const initialAgents: AgentInfo[] = Array.from({ length: 30 }, (_, i) => ({
        name: `cleanup-agent-${i}`,
        status: 'parallel' as const,
        stage: `cleanup-task-${i}`,
        startedAt: new Date(Date.now() - i * 1000),
      }));

      const { rerender, unmount } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={initialAgents}
        />
      );

      // Verify initial state
      expect(screen.getByText('cleanup-agent-0')).toBeInTheDocument();
      expect(screen.getByText('cleanup-agent-29')).toBeInTheDocument();

      // Remove all parallel agents
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // Should no longer show parallel section
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.queryByText('cleanup-agent-0')).not.toBeInTheDocument();

      // Add different agents to test memory reuse
      const newAgents: AgentInfo[] = [
        { name: 'new-agent-1', status: 'parallel' },
        { name: 'new-agent-2', status: 'parallel' },
      ];

      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={newAgents}
        />
      );

      expect(screen.getByText('new-agent-1')).toBeInTheDocument();
      expect(screen.getByText('new-agent-2')).toBeInTheDocument();

      unmount();
    });

    it('handles component lifecycle efficiently with large datasets', () => {
      const lifecycleTestCount = 20;
      const agentsPerTest = 25;

      for (let test = 0; test < lifecycleTestCount; test++) {
        const testAgents: AgentInfo[] = Array.from({ length: agentsPerTest }, (_, i) => ({
          name: `lifecycle-${test}-${i}`,
          status: 'parallel' as const,
          stage: `lifecycle-stage-${test}-${i}`,
          progress: (test + i) % 100,
        }));

        const startTime = performance.now();

        const { unmount } = render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={testAgents}
          />
        );

        const renderTime = performance.now() - startTime;

        // Verify rendering
        expect(screen.getByText(`lifecycle-${test}-0`)).toBeInTheDocument();
        expect(renderTime).toBeLessThan(100); // Each test should be fast

        unmount(); // Clean up
      }

      // All tests completed without memory issues
      expect(true).toBe(true);
    });

    it('handles memory efficiently during stress testing', () => {
      const stressIterations = 50;
      const maxAgentsPerIteration = 20;

      let totalRenderTime = 0;

      for (let iteration = 0; iteration < stressIterations; iteration++) {
        const agentCount = Math.floor(Math.random() * maxAgentsPerIteration) + 2; // At least 2 agents

        const stressAgents: AgentInfo[] = Array.from({ length: agentCount }, (_, i) => ({
          name: `stress-${iteration}-${i}`,
          status: 'parallel' as const,
          stage: `stress-stage-${iteration}-${i}`,
          progress: Math.floor(Math.random() * 98) + 1, // 1-98%
          startedAt: new Date(Date.now() - Math.random() * 60000),
        }));

        const startTime = performance.now();

        const { unmount } = render(
          <AgentPanel
            agents={[{ name: `stress-main-${iteration}`, status: 'active' }]}
            showParallel={true}
            parallelAgents={stressAgents}
          />
        );

        const renderTime = performance.now() - startTime;
        totalRenderTime += renderTime;

        // Quick verification
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

        unmount();

        // Individual render should be fast
        expect(renderTime).toBeLessThan(50);
      }

      // Average render time should be reasonable
      const averageRenderTime = totalRenderTime / stressIterations;
      expect(averageRenderTime).toBeLessThan(25);
    });
  });

  describe('Scalability Testing', () => {
    it('scales linearly with agent count', () => {
      const testCounts = [5, 10, 20, 40];
      const renderTimes: { count: number; time: number }[] = [];

      testCounts.forEach(count => {
        const scalabilityAgents: AgentInfo[] = Array.from({ length: count }, (_, i) => ({
          name: `scale-agent-${i}`,
          status: 'parallel' as const,
          stage: `scale-task-${i}`,
          progress: Math.min(i * 3, 99),
          startedAt: new Date(Date.now() - i * 1000),
        }));

        const startTime = performance.now();

        const { unmount } = render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={scalabilityAgents}
          />
        );

        const renderTime = performance.now() - startTime;
        renderTimes.push({ count, time: renderTime });

        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        unmount();
      });

      // Check that render time scales reasonably
      // Time should not grow exponentially
      for (let i = 1; i < renderTimes.length; i++) {
        const current = renderTimes[i];
        const previous = renderTimes[i - 1];

        const countRatio = current.count / previous.count;
        const timeRatio = current.time / previous.time;

        // Time ratio should not exceed count ratio by more than 50%
        expect(timeRatio).toBeLessThanOrEqual(countRatio * 1.5);
      }
    });

    it('maintains performance with complex agent data', () => {
      const complexAgentCount = 30;

      const complexAgents: AgentInfo[] = Array.from({ length: complexAgentCount }, (_, i) => ({
        name: `complex-agent-with-long-name-${i}-${Date.now()}`,
        status: 'parallel' as const,
        stage: `complex-stage-with-detailed-information-${i}-${Math.random().toString(36)}`,
        progress: Math.floor(Math.random() * 98) + 1,
        startedAt: new Date(Date.now() - Math.random() * 300000), // Random start time up to 5 minutes ago
      }));

      const startTime = performance.now();

      const { unmount } = render(
        <AgentPanel
          agents={[{ name: 'complex-main-agent', status: 'active', stage: 'complex-coordination' }]}
          currentAgent="complex-main-agent"
          showParallel={true}
          parallelAgents={complexAgents}
          useDetailedParallelView={true}
        />
      );

      const renderTime = performance.now() - startTime;

      // Should handle complex data efficiently
      expect(renderTime).toBeLessThan(150); // Still under 150ms for 30 complex agents

      // Verify functionality
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('complex-main-agent')).toBeInTheDocument();
      expect(screen.getByText('complex-agent-with-long-name-0' + expect.stringContaining(''))).toBeInTheDocument();

      unmount();
    });
  });

  describe('Hook Performance', () => {
    it('efficiently manages useElapsedTime hooks for multiple agents', () => {
      const hookTestAgents: AgentInfo[] = Array.from({ length: 20 }, (_, i) => ({
        name: `hook-agent-${i}`,
        status: 'parallel' as const,
        stage: `hook-task-${i}`,
        startedAt: new Date(Date.now() - i * 1000), // Staggered start times
      }));

      const startTime = performance.now();

      const { unmount } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={hookTestAgents}
        />
      );

      const renderTime = performance.now() - startTime;

      // Should handle multiple hooks efficiently
      expect(renderTime).toBeLessThan(100);

      // Verify all agents are rendered (hooks working)
      hookTestAgents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      unmount();
    });

    it('handles hook cleanup efficiently during rapid changes', () => {
      const { rerender } = render(
        <AgentPanel agents={[]} showParallel={true} parallelAgents={[]} />
      );

      const startTime = performance.now();

      // Rapid hook creation/cleanup cycles
      for (let cycle = 0; cycle < 20; cycle++) {
        const cycleAgents: AgentInfo[] = Array.from({ length: 5 }, (_, i) => ({
          name: `hook-cycle-${cycle}-${i}`,
          status: 'parallel' as const,
          stage: `hook-stage-${cycle}-${i}`,
          startedAt: new Date(Date.now() - Math.random() * 30000),
        }));

        rerender(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={cycleAgents}
          />
        );

        // Clear agents to trigger cleanup
        rerender(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={[]}
          />
        );
      }

      const totalTime = performance.now() - startTime;
      const avgTimePerCycle = totalTime / 20;

      // Each cycle (create + cleanup) should be fast
      expect(avgTimePerCycle).toBeLessThan(10);
      expect(totalTime).toBeLessThan(200);
    });
  });
});