import React from 'react';
import { render } from 'ink-testing-library';
import { AgentPanel, AgentInfo } from '../AgentPanel.js';

describe('AgentPanel with ParallelExecutionView integration', () => {
  const mockAgents: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
    },
    {
      name: 'architect',
      status: 'active',
      stage: 'architecture',
      progress: 75,
      startedAt: new Date(Date.now() - 60000),
    },
  ];

  const mockParallelAgents: AgentInfo[] = [
    {
      name: 'developer',
      status: 'parallel',
      stage: 'implementation',
      progress: 65,
      startedAt: new Date(Date.now() - 30000),
    },
    {
      name: 'tester',
      status: 'parallel',
      stage: 'unit-testing',
      progress: 40,
      startedAt: new Date(Date.now() - 45000),
    },
    {
      name: 'reviewer',
      status: 'parallel',
      stage: 'code-review',
      progress: 80,
      startedAt: new Date(Date.now() - 20000),
    },
  ];

  it('should show detailed parallel view when useDetailedParallelView is true', () => {
    const { lastFrame } = render(
      <AgentPanel
        agents={mockAgents}
        currentAgent="architect"
        showParallel={true}
        parallelAgents={mockParallelAgents}
        useDetailedParallelView={true}
      />
    );

    const output = lastFrame();

    // Should show the main agent panel
    expect(output).toContain('Active Agents');
    expect(output).toContain('architect');

    // Should show detailed parallel execution view
    expect(output).toContain('⟂ Parallel Execution (3 agents)');
    expect(output).toContain('developer');
    expect(output).toContain('implementation');
    expect(output).toContain('65%');

    // Should show side-by-side layout with borders (indicating cards)
    expect(output).toMatch(/┌.*┐/); // Should have card borders
  });

  it('should show traditional parallel view when useDetailedParallelView is false', () => {
    const { lastFrame } = render(
      <AgentPanel
        agents={mockAgents}
        currentAgent="architect"
        showParallel={true}
        parallelAgents={mockParallelAgents}
        useDetailedParallelView={false}
      />
    );

    const output = lastFrame();

    // Should show the main agent panel
    expect(output).toContain('Active Agents');
    expect(output).toContain('architect');

    // Should show traditional parallel execution section
    expect(output).toContain('⟂ Parallel Execution');
    expect(output).toContain('developer');

    // Should not show the detailed card layout (fewer borders)
    const borderCount = (output.match(/┌/g) || []).length;
    expect(borderCount).toBeLessThan(5); // Fewer borders than detailed view
  });

  it('should not show parallel section when showParallel is false', () => {
    const { lastFrame } = render(
      <AgentPanel
        agents={mockAgents}
        currentAgent="architect"
        showParallel={false}
        parallelAgents={mockParallelAgents}
        useDetailedParallelView={true}
      />
    );

    const output = lastFrame();

    // Should not show any parallel execution section
    expect(output).not.toContain('⟂ Parallel Execution');
    expect(output).not.toContain('developer');
  });

  it('should not show parallel section when parallelAgents length is 1 or less', () => {
    const { lastFrame } = render(
      <AgentPanel
        agents={mockAgents}
        currentAgent="architect"
        showParallel={true}
        parallelAgents={[mockParallelAgents[0]]} // Only one agent
        useDetailedParallelView={true}
      />
    );

    const output = lastFrame();

    // Should not show parallel execution section with only 1 agent
    expect(output).not.toContain('⟂ Parallel Execution');
  });

  it('should work in compact mode without showing parallel details', () => {
    const { lastFrame } = render(
      <AgentPanel
        agents={mockAgents}
        currentAgent="architect"
        compact={true}
        showParallel={true}
        parallelAgents={mockParallelAgents}
        useDetailedParallelView={true}
      />
    );

    const output = lastFrame();

    // In compact mode, should show inline parallel agents
    expect(output).toContain('architect');
    expect(output).toContain('⟂'); // Parallel symbol
    expect(output).toContain('developer');

    // Should not show the detailed cards in compact mode
    expect(output).not.toContain('⟂ Parallel Execution (3 agents)');
  });

  it('should handle agent type conversion correctly', () => {
    const { lastFrame } = render(
      <AgentPanel
        agents={mockAgents}
        currentAgent="architect"
        showParallel={true}
        parallelAgents={mockParallelAgents}
        useDetailedParallelView={true}
      />
    );

    const output = lastFrame();

    // Verify that all parallel agent information is preserved
    expect(output).toContain('developer');
    expect(output).toContain('tester');
    expect(output).toContain('reviewer');
    expect(output).toContain('implementation');
    expect(output).toContain('unit-testing');
    expect(output).toContain('code-review');
  });
});