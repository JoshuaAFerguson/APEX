/**
 * Hook for integrating AgentPanel with orchestrator events
 * Transforms orchestrator events into AgentPanel props and state
 */

import { useState, useEffect, useCallback } from 'react';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import type { AgentInfo } from '../components/agents/AgentPanel.js';

export interface OrchestratorEventState {
  /** Current active agent */
  currentAgent?: string;
  /** Previous agent for transition tracking */
  previousAgent?: string;
  /** List of agents derived from workflow and current status */
  agents: AgentInfo[];
  /** Agents currently running in parallel */
  parallelAgents: AgentInfo[];
  /** Whether to show parallel execution panel */
  showParallelPanel: boolean;
  /** Current task being processed */
  currentTaskId?: string;
  /** Subtask progress tracking */
  subtaskProgress?: { completed: number; total: number };
}

export interface UseOrchestratorEventsOptions {
  /** The orchestrator instance to listen to */
  orchestrator?: ApexOrchestrator;
  /** Task ID to filter events for */
  taskId?: string;
  /** Workflow definition to derive agent list */
  workflow?: {
    stages: Array<{
      name: string;
      agent: string;
    }>;
  };
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Custom hook that bridges orchestrator events to AgentPanel props
 * Listens to orchestrator events and maintains agent state accordingly
 */
export function useOrchestratorEvents(options: UseOrchestratorEventsOptions = {}): OrchestratorEventState {
  const { orchestrator, taskId, workflow, debug = false } = options;

  const [state, setState] = useState<OrchestratorEventState>({
    agents: [],
    parallelAgents: [],
    showParallelPanel: false,
    subtaskProgress: { completed: 0, total: 0 },
  });

  // Debug logging helper
  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useOrchestratorEvents] ${message}`, data || '');
    }
  }, [debug]);

  // Derive agents list from workflow
  const derivedAgents = workflow ? workflow.stages.map(stage => ({
    name: stage.agent,
    status: 'idle' as const,
    stage: stage.name,
  })) : [];

  // Update agent status based on current and previous agents
  const updateAgentStatus = useCallback((agents: AgentInfo[], current?: string, previous?: string): AgentInfo[] => {
    return agents.map(agent => {
      if (agent.name === current) {
        return { ...agent, status: 'active' as const };
      } else if (agent.name === previous) {
        return { ...agent, status: 'completed' as const };
      } else {
        // Maintain existing status for other agents
        return agent;
      }
    });
  }, []);

  // Event handlers
  useEffect(() => {
    if (!orchestrator) return;

    // Agent transition handler
    const handleAgentTransition = (eventTaskId: string, fromAgent: string | null, toAgent: string) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Agent transition', { from: fromAgent, to: toAgent, taskId: eventTaskId });

      setState(prev => {
        const updatedAgents = updateAgentStatus(prev.agents.length > 0 ? prev.agents : derivedAgents, toAgent, fromAgent || undefined);

        return {
          ...prev,
          currentAgent: toAgent,
          previousAgent: fromAgent || undefined,
          agents: updatedAgents,
          currentTaskId: eventTaskId,
        };
      });
    };

    // Stage change handler (fallback if agent:transition not available)
    const handleStageChange = (task: any, stageName: string) => {
      if (taskId && task.id !== taskId) return;

      log('Stage change', { stage: stageName, taskId: task.id });

      // Try to derive agent from workflow
      const stageAgent = workflow?.stages.find(s => s.name === stageName)?.agent;

      if (stageAgent) {
        setState(prev => {
          const updatedAgents = updateAgentStatus(prev.agents.length > 0 ? prev.agents : derivedAgents, stageAgent, prev.currentAgent);

          return {
            ...prev,
            currentAgent: stageAgent,
            previousAgent: prev.currentAgent,
            agents: updatedAgents,
            currentTaskId: task.id,
          };
        });
      }
    };

    // Parallel execution start handler
    const handleParallelStart = (eventTaskId: string, stages: string[], agents: string[]) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Parallel execution started', { stages, agents, taskId: eventTaskId });

      setState(prev => {
        const parallelAgents = agents.map((agent, index) => ({
          name: agent,
          status: 'parallel' as const,
          stage: stages[index],
        }));

        return {
          ...prev,
          parallelAgents,
          showParallelPanel: agents.length > 1,
          currentTaskId: eventTaskId,
        };
      });
    };

    // Parallel execution complete handler
    const handleParallelComplete = (eventTaskId: string) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Parallel execution completed', { taskId: eventTaskId });

      setState(prev => ({
        ...prev,
        parallelAgents: [],
        showParallelPanel: false,
      }));
    };

    // Task lifecycle handlers
    const handleTaskStart = (task: any) => {
      if (taskId && task.id !== taskId) return;

      log('Task started', { taskId: task.id });

      setState(prev => ({
        ...prev,
        currentTaskId: task.id,
        agents: derivedAgents,
        subtaskProgress: { completed: 0, total: 0 },
      }));
    };

    const handleTaskComplete = (task: any) => {
      if (taskId && task.id !== taskId) return;

      log('Task completed', { taskId: task.id });

      setState(prev => ({
        ...prev,
        currentAgent: undefined,
        previousAgent: undefined,
        parallelAgents: [],
        showParallelPanel: false,
        subtaskProgress: undefined,
      }));
    };

    const handleTaskFail = (task: any, error: Error) => {
      if (taskId && task.id !== taskId) return;

      log('Task failed', { taskId: task.id, error: error.message });

      setState(prev => ({
        ...prev,
        currentAgent: undefined,
        previousAgent: undefined,
        parallelAgents: [],
        showParallelPanel: false,
        subtaskProgress: undefined,
      }));
    };

    // Subtask handlers
    const handleSubtaskCreated = (subtask: any, parentTaskId: string) => {
      if (taskId && parentTaskId !== taskId) return;

      log('Subtask created', { subtaskId: subtask.id, parentTaskId });

      setState(prev => ({
        ...prev,
        subtaskProgress: prev.subtaskProgress ? {
          completed: prev.subtaskProgress.completed,
          total: prev.subtaskProgress.total + 1,
        } : { completed: 0, total: 1 },
      }));
    };

    const handleSubtaskCompleted = (subtask: any, parentTaskId: string) => {
      if (taskId && parentTaskId !== taskId) return;

      log('Subtask completed', { subtaskId: subtask.id, parentTaskId });

      setState(prev => ({
        ...prev,
        subtaskProgress: prev.subtaskProgress ? {
          completed: prev.subtaskProgress.completed + 1,
          total: prev.subtaskProgress.total,
        } : { completed: 1, total: 1 },
      }));
    };

    // Register event listeners
    orchestrator.on('agent:transition', handleAgentTransition);
    orchestrator.on('task:stage-changed', handleStageChange);
    orchestrator.on('stage:parallel-started', handleParallelStart);
    orchestrator.on('stage:parallel-completed', handleParallelComplete);
    orchestrator.on('task:started', handleTaskStart);
    orchestrator.on('task:completed', handleTaskComplete);
    orchestrator.on('task:failed', handleTaskFail);
    orchestrator.on('subtask:created', handleSubtaskCreated);
    orchestrator.on('subtask:completed', handleSubtaskCompleted);

    log('Event listeners registered');

    // Cleanup function
    return () => {
      orchestrator.off('agent:transition', handleAgentTransition);
      orchestrator.off('task:stage-changed', handleStageChange);
      orchestrator.off('stage:parallel-started', handleParallelStart);
      orchestrator.off('stage:parallel-completed', handleParallelComplete);
      orchestrator.off('task:started', handleTaskStart);
      orchestrator.off('task:completed', handleTaskComplete);
      orchestrator.off('task:failed', handleTaskFail);
      orchestrator.off('subtask:created', handleSubtaskCreated);
      orchestrator.off('subtask:completed', handleSubtaskCompleted);

      log('Event listeners cleaned up');
    };
  }, [orchestrator, taskId, workflow, log, derivedAgents, updateAgentStatus]);

  // Initialize agents from workflow if not already set
  useEffect(() => {
    if (derivedAgents.length > 0 && state.agents.length === 0) {
      setState(prev => ({
        ...prev,
        agents: derivedAgents,
      }));
    }
  }, [derivedAgents, state.agents.length]);

  return state;
}