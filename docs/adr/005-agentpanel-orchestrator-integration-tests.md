# ADR-005: AgentPanel Integration Tests with Orchestrator Events

## Status
Proposed

## Context

The AgentPanel component currently has extensive unit and visual tests for:
- Agent transitions and handoff animations (`AgentPanel.integration.test.tsx`)
- Parallel execution scenarios (`AgentPanel.parallel-integration.test.tsx`)
- Edge cases and timing precision (`AgentPanel.parallel-edge-cases.test.tsx`, `AgentPanel.handoff-timing.test.tsx`)

However, these tests primarily mock the `useAgentHandoff` hook and test the component in isolation. The acceptance criteria requires:
1. Integration tests verify AgentPanel responds to **parallel execution events**
2. Tests verify handoff animations trigger on **agent changes**
3. Tests in `AgentPanel.integration.test.tsx` pass

The key gap is testing the connection between **orchestrator events** and the AgentPanel's response to those events.

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Test Environment                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────────┐         ┌────────────────────┐                │
│   │ Mock Orchestrator│ emit   │ Event-to-State     │                │
│   │ EventEmitter     │ ────────│ Adapter Hook       │                │
│   │                  │ events │ useOrchestratorEvents│               │
│   │ Events:          │        │                    │                │
│   │ • agent:transition│       │ Transforms events  │                │
│   │ • stage:parallel-│        │ into AgentPanel    │                │
│   │   started        │        │ props:             │                │
│   │ • stage:parallel-│        │ • currentAgent     │                │
│   │   completed      │        │ • showParallel     │                │
│   │ • task:stage-   │        │ • parallelAgents   │                │
│   │   changed        │        │                    │                │
│   └─────────────────┘        └─────────┬──────────┘                │
│                                         │                            │
│                                         │ props                      │
│                                         ▼                            │
│                              ┌────────────────────┐                 │
│                              │    AgentPanel      │                 │
│                              │                    │                 │
│                              │ ┌────────────────┐ │                 │
│                              │ │useAgentHandoff │ │                 │
│                              │ │(internal hook) │ │                 │
│                              │ └────────────────┘ │                 │
│                              │                    │                 │
│                              │ ┌────────────────┐ │                 │
│                              │ │HandoffIndicator│ │                 │
│                              │ └────────────────┘ │                 │
│                              └────────────────────┘                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Technical Design

#### 1. Test Utility: Mock Orchestrator Event Emitter

Create a test helper that simulates orchestrator events:

```typescript
// Location: packages/cli/src/__tests__/mock-orchestrator.ts

import { EventEmitter } from 'eventemitter3';
import type { OrchestratorEvents } from '@apexcli/orchestrator';
import type { AgentInfo } from '../ui/components/agents/AgentPanel';

export interface MockOrchestratorOptions {
  initialAgent?: string;
  taskId?: string;
}

export class MockOrchestrator extends EventEmitter<OrchestratorEvents> {
  private currentAgent: string | null = null;
  private previousAgent: string | null = null;
  private parallelAgents: AgentInfo[] = [];
  private isParallelExecution = false;

  constructor(options: MockOrchestratorOptions = {}) {
    super();
    this.currentAgent = options.initialAgent || null;
  }

  // Simulate agent transition
  transitionToAgent(taskId: string, agentName: string): void {
    this.previousAgent = this.currentAgent;
    this.currentAgent = agentName;
    this.emit('agent:transition', taskId, this.previousAgent, agentName);
    this.emit('task:stage-changed', { id: taskId } as any, agentName);
  }

  // Simulate parallel execution start
  startParallelExecution(
    taskId: string,
    stages: string[],
    agents: string[]
  ): void {
    this.isParallelExecution = true;
    this.parallelAgents = agents.map((name, i) => ({
      name,
      status: 'parallel' as const,
      stage: stages[i],
      progress: 0,
    }));
    this.emit('stage:parallel-started', taskId, stages, agents);
  }

  // Simulate parallel execution completion
  completeParallelExecution(taskId: string): void {
    this.isParallelExecution = false;
    this.parallelAgents = [];
    this.emit('stage:parallel-completed', taskId);
  }

  // Update parallel agent progress
  updateParallelProgress(
    agentName: string,
    progress: number,
    stage?: string
  ): void {
    const agent = this.parallelAgents.find(a => a.name === agentName);
    if (agent) {
      agent.progress = progress;
      if (stage) agent.stage = stage;
    }
  }

  // Get current state for assertions
  getState() {
    return {
      currentAgent: this.currentAgent,
      previousAgent: this.previousAgent,
      isParallelExecution: this.isParallelExecution,
      parallelAgents: [...this.parallelAgents],
    };
  }
}
```

#### 2. Test Hook: useOrchestratorEvents (for test integration)

This hook bridges orchestrator events to AgentPanel state:

```typescript
// Location: packages/cli/src/ui/hooks/useOrchestratorEvents.ts

import { useState, useEffect } from 'react';
import type { EventEmitter } from 'eventemitter3';
import type { OrchestratorEvents } from '@apexcli/orchestrator';
import type { AgentInfo } from '../components/agents/AgentPanel';

export interface OrchestratorState {
  currentAgent: string | undefined;
  showParallel: boolean;
  parallelAgents: AgentInfo[];
  agents: AgentInfo[];
}

export function useOrchestratorEvents(
  orchestrator: EventEmitter<OrchestratorEvents>,
  taskId: string,
  baseAgents: AgentInfo[]
): OrchestratorState {
  const [currentAgent, setCurrentAgent] = useState<string | undefined>();
  const [showParallel, setShowParallel] = useState(false);
  const [parallelAgents, setParallelAgents] = useState<AgentInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>(baseAgents);

  useEffect(() => {
    const handleAgentTransition = (
      tid: string,
      _from: string | null,
      to: string
    ) => {
      if (tid === taskId) {
        setCurrentAgent(to);
        // Update agent status in list
        setAgents(prev =>
          prev.map(a => ({
            ...a,
            status: a.name === to ? 'active' :
                   a.status === 'active' ? 'completed' : a.status,
          }))
        );
      }
    };

    const handleParallelStarted = (
      tid: string,
      stages: string[],
      agentNames: string[]
    ) => {
      if (tid === taskId) {
        setShowParallel(true);
        setParallelAgents(
          agentNames.map((name, i) => ({
            name,
            status: 'parallel',
            stage: stages[i],
            progress: 0,
          }))
        );
      }
    };

    const handleParallelCompleted = (tid: string) => {
      if (tid === taskId) {
        setShowParallel(false);
        setParallelAgents([]);
      }
    };

    orchestrator.on('agent:transition', handleAgentTransition);
    orchestrator.on('stage:parallel-started', handleParallelStarted);
    orchestrator.on('stage:parallel-completed', handleParallelCompleted);

    return () => {
      orchestrator.off('agent:transition', handleAgentTransition);
      orchestrator.off('stage:parallel-started', handleParallelStarted);
      orchestrator.off('stage:parallel-completed', handleParallelCompleted);
    };
  }, [orchestrator, taskId]);

  return { currentAgent, showParallel, parallelAgents, agents };
}
```

#### 3. Integration Test Structure

New test file: `AgentPanel.orchestrator-integration.test.tsx`

```typescript
// packages/cli/src/ui/components/agents/__tests__/AgentPanel.orchestrator-integration.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { MockOrchestrator } from '../../../__tests__/mock-orchestrator';
import { useOrchestratorEvents } from '../../../hooks/useOrchestratorEvents';

// Test wrapper component that connects orchestrator to AgentPanel
function ConnectedAgentPanel({
  orchestrator,
  taskId,
  baseAgents,
}: {
  orchestrator: MockOrchestrator;
  taskId: string;
  baseAgents: AgentInfo[];
}) {
  const { currentAgent, showParallel, parallelAgents, agents } =
    useOrchestratorEvents(orchestrator, taskId, baseAgents);

  return (
    <AgentPanel
      agents={agents}
      currentAgent={currentAgent}
      showParallel={showParallel}
      parallelAgents={parallelAgents}
    />
  );
}

describe('AgentPanel - Orchestrator Event Integration', () => {
  // Test scenarios:
  // 1. Agent transitions via orchestrator events
  // 2. Parallel execution events triggering UI updates
  // 3. Handoff animations responding to agent:transition events
  // 4. Complex workflow scenarios
});
```

### Test Scenarios

#### Scenario 1: Agent Transition Events

```typescript
it('triggers handoff animation when orchestrator emits agent:transition', async () => {
  const orchestrator = new MockOrchestrator({ initialAgent: 'planner' });
  const taskId = 'test_task_1';

  render(
    <ConnectedAgentPanel
      orchestrator={orchestrator}
      taskId={taskId}
      baseAgents={mockAgents}
    />
  );

  // Initially showing planner
  expect(screen.getByText('planner')).toBeInTheDocument();

  // Emit agent transition
  act(() => {
    orchestrator.transitionToAgent(taskId, 'developer');
  });

  // Should trigger handoff animation
  await waitFor(() => {
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('planner')).toBeInTheDocument(); // from
    expect(screen.getByText('developer')).toBeInTheDocument(); // to
  });
});
```

#### Scenario 2: Parallel Execution Events

```typescript
it('shows parallel section when orchestrator emits stage:parallel-started', async () => {
  const orchestrator = new MockOrchestrator();
  const taskId = 'test_task_2';

  render(
    <ConnectedAgentPanel
      orchestrator={orchestrator}
      taskId={taskId}
      baseAgents={mockAgents}
    />
  );

  // Initially no parallel execution
  expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

  // Emit parallel started
  act(() => {
    orchestrator.startParallelExecution(
      taskId,
      ['code-review', 'testing'],
      ['reviewer', 'tester']
    );
  });

  // Should show parallel section
  await waitFor(() => {
    expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    expect(screen.getByText('reviewer')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
  });

  // Emit parallel completed
  act(() => {
    orchestrator.completeParallelExecution(taskId);
  });

  // Should hide parallel section
  await waitFor(() => {
    expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
  });
});
```

#### Scenario 3: Rapid Agent Transitions

```typescript
it('handles rapid agent transitions from orchestrator events', async () => {
  const orchestrator = new MockOrchestrator({ initialAgent: 'planner' });
  const taskId = 'test_task_3';

  render(
    <ConnectedAgentPanel
      orchestrator={orchestrator}
      taskId={taskId}
      baseAgents={mockAgents}
    />
  );

  // Rapid fire transitions
  act(() => {
    orchestrator.transitionToAgent(taskId, 'architect');
  });

  // Small delay then next transition
  await act(async () => {
    await new Promise(r => setTimeout(r, 100));
    orchestrator.transitionToAgent(taskId, 'developer');
  });

  // Should show latest transition animation
  await waitFor(() => {
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('architect')).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
  });
});
```

#### Scenario 4: Full Workflow Integration

```typescript
it('handles complete workflow with sequential and parallel stages', async () => {
  const orchestrator = new MockOrchestrator();
  const taskId = 'test_task_4';

  render(
    <ConnectedAgentPanel
      orchestrator={orchestrator}
      taskId={taskId}
      baseAgents={mockAgents}
    />
  );

  // Phase 1: Planning (sequential)
  act(() => {
    orchestrator.transitionToAgent(taskId, 'planner');
  });

  await waitFor(() => {
    expect(screen.getByText('planner')).toBeInTheDocument();
  });

  // Phase 2: Architecture (sequential)
  act(() => {
    orchestrator.transitionToAgent(taskId, 'architect');
  });

  await waitFor(() => {
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  // Wait for animation
  await act(async () => {
    await new Promise(r => setTimeout(r, 2100));
  });

  // Phase 3: Implementation (sequential)
  act(() => {
    orchestrator.transitionToAgent(taskId, 'developer');
  });

  // Phase 4: Review + Testing (parallel)
  await act(async () => {
    await new Promise(r => setTimeout(r, 100));
    orchestrator.startParallelExecution(
      taskId,
      ['code-review', 'unit-testing', 'security-scan'],
      ['reviewer', 'tester', 'security']
    );
  });

  await waitFor(() => {
    expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    expect(screen.getByText('reviewer')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
  });

  // Phase 5: Deployment (sequential after parallel completes)
  act(() => {
    orchestrator.completeParallelExecution(taskId);
    orchestrator.transitionToAgent(taskId, 'devops');
  });

  await waitFor(() => {
    expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    expect(screen.getByText('devops')).toBeInTheDocument();
  });
});
```

### File Structure

```
packages/cli/src/
├── __tests__/
│   ├── mock-orchestrator.ts          # NEW: Mock orchestrator for tests
│   └── test-utils.tsx                # EXISTING: Enhanced with orchestrator utils
├── ui/
│   ├── hooks/
│   │   ├── useAgentHandoff.ts        # EXISTING
│   │   └── useOrchestratorEvents.ts  # NEW: Bridge hook for tests
│   └── components/
│       └── agents/
│           └── __tests__/
│               ├── AgentPanel.integration.test.tsx           # EXISTING
│               ├── AgentPanel.parallel-integration.test.tsx  # EXISTING
│               ├── AgentPanel.handoff-timing.test.tsx        # EXISTING
│               └── AgentPanel.orchestrator-integration.test.tsx  # NEW
```

### Key Design Decisions

1. **Event-Driven Architecture**: Tests use real EventEmitter patterns matching the orchestrator's actual implementation
2. **Adapter Pattern**: The `useOrchestratorEvents` hook transforms orchestrator events into AgentPanel-compatible props
3. **Real Animation Testing**: Tests allow real animation timers to run where timing precision matters
4. **Isolation**: Mock orchestrator is independent of actual orchestrator, making tests fast and reliable
5. **Coverage**: Tests cover sequential transitions, parallel execution, and mixed workflows

## Consequences

### Positive
- Tests verify actual event flow from orchestrator to UI
- Reusable mock orchestrator for other component tests
- Clear separation between unit tests and integration tests
- Tests document expected orchestrator event contracts

### Negative
- Some tests will take longer due to real timer delays
- Additional test infrastructure to maintain
- Need to keep mock orchestrator in sync with real orchestrator events

## Implementation Notes

1. The `useOrchestratorEvents` hook is primarily a test utility but could be promoted to production code if needed
2. Mock orchestrator should be updated whenever `OrchestratorEvents` interface changes
3. Tests should use `vi.useFakeTimers()` selectively - only where timing precision is critical
4. Parallel execution tests may need `waitFor` with longer timeouts due to animation duration

## Related
- `AgentPanel.integration.test.tsx` - existing integration tests
- `packages/orchestrator/src/index.ts` - orchestrator event definitions
- `useAgentHandoff.ts` - animation state management hook
