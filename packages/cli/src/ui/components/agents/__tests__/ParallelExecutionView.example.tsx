/**
 * Example demonstrating the ParallelExecutionView component usage
 * This shows how the new detailed parallel agent visualization works
 */

import React from 'react';
import { AgentPanel, AgentInfo } from '../AgentPanel.js';

// Example usage of AgentPanel with ParallelExecutionView
export function ExampleParallelExecution() {
  const mainAgents: AgentInfo[] = [
    {
      name: 'planner',
      status: 'completed',
      stage: 'planning',
    },
    {
      name: 'architect',
      status: 'active',
      stage: 'architecture',
      progress: 85,
      startedAt: new Date(Date.now() - 120000), // 2 minutes ago
    },
  ];

  const parallelAgents: AgentInfo[] = [
    {
      name: 'developer',
      status: 'parallel',
      stage: 'implementation',
      progress: 65,
      startedAt: new Date(Date.now() - 90000), // 1.5 minutes ago
    },
    {
      name: 'tester',
      status: 'parallel',
      stage: 'unit-testing',
      progress: 40,
      startedAt: new Date(Date.now() - 75000), // 1.25 minutes ago
    },
    {
      name: 'reviewer',
      status: 'parallel',
      stage: 'code-review',
      progress: 80,
      startedAt: new Date(Date.now() - 60000), // 1 minute ago
    },
  ];

  return (
    <>
      {/* Traditional parallel view */}
      <AgentPanel
        agents={mainAgents}
        currentAgent="architect"
        showParallel={true}
        parallelAgents={parallelAgents}
        useDetailedParallelView={false} // Traditional view
      />

      {/* New detailed parallel view */}
      <AgentPanel
        agents={mainAgents}
        currentAgent="architect"
        showParallel={true}
        parallelAgents={parallelAgents}
        useDetailedParallelView={true} // New detailed side-by-side view
      />
    </>
  );
}

/**
 * The new ParallelExecutionView provides:
 *
 * 1. Side-by-side agent cards with individual borders
 * 2. Detailed progress visualization with progress bars
 * 3. Individual elapsed time tracking for each parallel agent
 * 4. Stage information prominently displayed
 * 5. Configurable column layout (default 3 columns)
 * 6. Compact mode support for space-constrained scenarios
 * 7. Color-coded status indicators matching agent roles
 *
 * Integration into AgentPanel:
 * - Controlled by `useDetailedParallelView` prop
 * - Falls back to traditional ParallelSection when false
 * - Maintains all existing functionality and compatibility
 * - Only shown when showParallel=true and >=2 parallel agents
 */