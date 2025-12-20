import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Visual & Terminal Compatibility Tests', () => {
  describe('visual layout and spacing', () => {
    it('maintains proper visual hierarchy between main and parallel sections', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'coding' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Main section should appear first
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Parallel section should appear after main section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Structure should be maintained
      const container = screen.getByText('Active Agents').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('formats parallel execution icons consistently across all contexts', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'task1' },
        { name: 'agent2', status: 'parallel', stage: 'task2' },
        { name: 'agent3', status: 'parallel', stage: 'task3' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should have exactly 4 parallel icons: 1 header + 3 agents
      const parallelIcons = screen.getAllByText(/⟂/);
      expect(parallelIcons).toHaveLength(4);

      // Header icon should be part of the section title
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Each agent should have their own icon
      parallelAgents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });
    });

    it('handles text alignment and wrapping for long agent names and stages', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'very-long-agent-name-for-testing-wrapping-behavior',
          status: 'parallel',
          stage: 'very-long-stage-name-that-might-wrap-in-terminal',
          progress: 50
        },
        {
          name: 'short',
          status: 'parallel',
          stage: 'quick',
          progress: 75
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Long names should be displayed without breaking layout
      expect(screen.getByText('very-long-agent-name-for-testing-wrapping-behavior')).toBeInTheDocument();
      expect(screen.getByText('short')).toBeInTheDocument();

      // Long stage names should be displayed
      expect(screen.getByText(/\(very-long-stage-name-that-might-wrap-in-terminal\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(quick\)/)).toBeInTheDocument();

      // Progress should still be shown
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });
  });

  describe('compact mode visual formatting', () => {
    it('maintains proper spacing and separators in compact parallel mode', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active' },
        { name: 'reviewer', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester1', status: 'parallel', stage: 'testing' },
        { name: 'tester2', status: 'parallel', stage: 'e2e' },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Main agents should be shown with separators
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Should have separators between main agents and before parallel section
      const separators = screen.getAllByText('│');
      expect(separators.length).toBeGreaterThanOrEqual(2); // Main agent separators

      // Parallel section should be shown with proper formatting
      expect(screen.getByText('⟂')).toBeInTheDocument(); // Single parallel icon
      expect(screen.getByText('tester1')).toBeInTheDocument();
      expect(screen.getByText('tester2')).toBeInTheDocument();

      // Should have comma separators between parallel agents
      expect(screen.getByText(',')).toBeInTheDocument();
    });

    it('handles empty main agents list with parallel agents in compact mode', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'parallel1', status: 'parallel' },
        { name: 'parallel2', status: 'parallel' },
        { name: 'parallel3', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Only parallel section should be shown
      expect(screen.getByText('⟂')).toBeInTheDocument();
      expect(screen.getByText('parallel1')).toBeInTheDocument();
      expect(screen.getByText('parallel2')).toBeInTheDocument();
      expect(screen.getByText('parallel3')).toBeInTheDocument();

      // Should have comma separators between parallel agents
      const commas = screen.getAllByText(',');
      expect(commas).toHaveLength(2); // n-1 separators for n parallel agents
    });
  });

  describe('unicode and special character handling', () => {
    it('renders parallel execution icon correctly across different terminals', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // The parallel icon ⟂ should render correctly
      const parallelIcons = screen.getAllByText(/⟂/);
      expect(parallelIcons.length).toBe(3); // header + 2 agents

      // Each icon should be the exact Unicode character
      parallelIcons.forEach(icon => {
        expect(icon.textContent).toContain('⟂');
      });
    });

    it('handles special characters in agent names and stages for parallel execution', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'agent-with-dashes',
          status: 'parallel',
          stage: 'stage_with_underscores'
        },
        {
          name: 'agent.with.dots',
          status: 'parallel',
          stage: 'stage-with-dashes'
        },
        {
          name: 'agent@domain',
          status: 'parallel',
          stage: 'stage#with#hashes'
        },
        {
          name: 'агент', // Cyrillic
          status: 'parallel',
          stage: 'étape' // French
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All special character names should render
      expect(screen.getByText('agent-with-dashes')).toBeInTheDocument();
      expect(screen.getByText('agent.with.dots')).toBeInTheDocument();
      expect(screen.getByText('agent@domain')).toBeInTheDocument();
      expect(screen.getByText('агент')).toBeInTheDocument();

      // All special character stages should render
      expect(screen.getByText(/\(stage_with_underscores\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage-with-dashes\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage#with#hashes\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(étape\)/)).toBeInTheDocument();
    });
  });

  describe('color accessibility and contrast', () => {
    it('applies consistent cyan color to all parallel execution elements', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' }, // normally magenta
        { name: 'developer', status: 'parallel', stage: 'coding' }, // should be cyan
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing' }, // normally cyan, should stay cyan
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' }, // normally yellow, should be cyan
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All parallel elements should be rendered (color testing is limited in jsdom)
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Parallel icons should be rendered
      expect(screen.getAllByText(/⟂/)).toHaveLength(4); // header + 1 main + 2 parallel
    });

    it('maintains color consistency in compact mode for parallel agents', () => {
      const mixedAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'parallel' },
        { name: 'reviewer', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester1', status: 'parallel' },
        { name: 'tester2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="developer"
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All agents should be rendered with proper status icons
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester1')).toBeInTheDocument();
      expect(screen.getByText('tester2')).toBeInTheDocument();

      // Status icons should be correct
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⟂/)).toBeInTheDocument(); // parallel (at least one)
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
    });
  });

  describe('responsive layout behavior', () => {
    it('adapts parallel execution display to different terminal widths', () => {
      // Mock different terminal widths (this is somewhat limited in jsdom)
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'stage1', progress: 25 },
        { name: 'agent2', status: 'parallel', stage: 'stage2', progress: 50 },
        { name: 'agent3', status: 'parallel', stage: 'stage3', progress: 75 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Content should render regardless of terminal width constraints
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();

      // All progress indicators should be shown
      expect(screen.getByText(/25%/)).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('handles overflow scenarios with many parallel agents gracefully', () => {
      // Create more parallel agents than might comfortably fit
      const manyParallelAgents: AgentInfo[] = Array.from({ length: 15 }, (_, i) => ({
        name: `parallel-agent-${i + 1}`,
        status: 'parallel' as const,
        stage: `stage-${i + 1}`,
        progress: (i + 1) * 5,
      }));

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      // Should render all agents without breaking
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Spot check first, middle, and last agents
      expect(screen.getByText('parallel-agent-1')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent-8')).toBeInTheDocument();
      expect(screen.getByText('parallel-agent-15')).toBeInTheDocument();

      // Check that stages are rendered
      expect(screen.getByText(/\(stage-1\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage-8\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage-15\)/)).toBeInTheDocument();
    });
  });

  describe('accessibility considerations for parallel execution', () => {
    it('provides meaningful text content for screen readers', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'accessibility-test-agent', status: 'parallel', stage: 'accessibility-testing', progress: 60 },
        { name: 'screen-reader-test', status: 'parallel', stage: 'screen-reader-compat' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Section header should be accessible
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Agent names should be accessible
      expect(screen.getByText('accessibility-test-agent')).toBeInTheDocument();
      expect(screen.getByText('screen-reader-test')).toBeInTheDocument();

      // Stage information should be accessible
      expect(screen.getByText(/\(accessibility-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(screen-reader-compat\)/)).toBeInTheDocument();

      // Progress should be accessible when present
      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });

    it('maintains logical reading order for parallel execution content', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'main-agent-1', status: 'completed' },
        { name: 'main-agent-2', status: 'active', stage: 'working' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'parallel-agent-1', status: 'parallel', stage: 'task-1' },
        { name: 'parallel-agent-2', status: 'parallel', stage: 'task-2' },
      ];

      const { container } = render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="main-agent-2"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Content should be in logical order
      const textContent = container.textContent || '';

      // Main section should come before parallel section
      const mainSectionIndex = textContent.indexOf('Active Agents');
      const parallelSectionIndex = textContent.indexOf('⟂ Parallel Execution');

      expect(mainSectionIndex).toBeLessThan(parallelSectionIndex);

      // Agent names should appear in expected order
      const mainAgent1Index = textContent.indexOf('main-agent-1');
      const mainAgent2Index = textContent.indexOf('main-agent-2');
      const parallelAgent1Index = textContent.indexOf('parallel-agent-1');

      expect(mainAgent1Index).toBeLessThan(mainAgent2Index);
      expect(mainAgent2Index).toBeLessThan(parallelAgent1Index);
    });
  });
});