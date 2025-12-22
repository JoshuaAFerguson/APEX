/**
 * Hook for integrating AgentPanel with orchestrator events
 * Transforms orchestrator events into AgentPanel props and state
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ApexOrchestrator } from '@apex/orchestrator';
import type { AgentInfo } from '../components/agents/AgentPanel.js';
import type { VerboseDebugData } from '@apex/core';

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
  /** Verbose debug data populated from orchestrator events */
  verboseData?: VerboseDebugData;
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

  // Derive agents list from workflow
  const derivedAgents = useMemo(() => (
    workflow ? workflow.stages.map(stage => ({
      name: stage.agent,
      status: 'idle' as const,
      stage: stage.name,
    })) : []
  ), [workflow]);
  const derivedAgentsByName = useMemo(() => (
    new Map(derivedAgents.map(agent => [agent.name, agent]))
  ), [derivedAgents]);

  const [state, setState] = useState<OrchestratorEventState>(() => ({
    agents: derivedAgents,
    parallelAgents: [],
    showParallelPanel: false,
    subtaskProgress: { completed: 0, total: 0 },
  }));
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // VerboseDebugData state for tracking detailed metrics
  const [verboseData, setVerboseData] = useState<VerboseDebugData>(() => ({
    agentTokens: {},
    timing: {
      stageStartTime: new Date(),
      agentResponseTimes: {},
      toolUsageTimes: {},
    },
    agentDebug: {
      conversationLength: {},
      toolCallCounts: {},
      errorCounts: {},
      retryAttempts: {},
    },
    metrics: {
      tokensPerSecond: 0,
      averageResponseTime: 0,
      toolEfficiency: {},
    },
  }));

  // Refs for timing calculations (not triggering re-renders)
  const agentStartTimeRef = useRef<Map<string, Date>>(new Map());
  const toolStartTimeRef = useRef<Map<string, Date>>(new Map());
  const totalTokensRef = useRef<number>(0);
  const stageStartTimeRef = useRef<Date>(new Date());

  // Debug logging helper
  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useOrchestratorEvents] ${message}`, data || '');
    }
  }, [debug]);

  useEffect(() => {
    if (workflow && derivedAgents.length > 0 && stateRef.current.agents.length === 0) {
      const nextState = {
        ...stateRef.current,
        agents: derivedAgents,
      };
      stateRef.current = nextState;
      setState(nextState);
    }
  }, [workflow, derivedAgents.length]);

  const mergeAgentsWithWorkflow = useCallback((currentAgents: AgentInfo[], nextAgents: AgentInfo[]) => {
    const currentAgentMap = new Map(currentAgents.map(agent => [agent.name, agent]));
    return nextAgents.map(agent => {
      const existing = currentAgentMap.get(agent.name);
      if (!existing) {
        return agent;
      }
      return {
        ...agent,
        status: existing.status,
        progress: existing.progress,
        startedAt: existing.startedAt,
        debugInfo: existing.debugInfo,
      };
    });
  }, []);

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

  const ensureAgentEntry = useCallback((agents: AgentInfo[], agentName?: string, status?: AgentInfo['status']) => {
    if (!agentName) {
      return agents;
    }

    const existing = agents.find(agent => agent.name === agentName);
    if (existing) {
      return agents;
    }

    const baseAgent = derivedAgentsByName.get(agentName);
    return [
      ...agents,
      {
        ...(baseAgent ?? { name: agentName }),
        status: status ?? 'idle',
      },
    ];
  }, [derivedAgentsByName]);

  // Helper to update agent debug info
  const updateAgentDebugInfo = useCallback((
    agents: AgentInfo[],
    agentName: string,
    updater: (debugInfo?: AgentInfo['debugInfo']) => AgentInfo['debugInfo'],
    fallbackAgent?: AgentInfo,
    allowAdd: boolean = true
  ): AgentInfo[] => {
    let found = false;
    const updatedAgents = agents.map(agent => {
      if (agent.name === agentName) {
        found = true;
        return {
          ...agent,
          debugInfo: updater(agent.debugInfo),
        };
      }
      return agent;
    });

    if (!found) {
      if (!allowAdd) {
        return updatedAgents;
      }

      const baseAgent: AgentInfo = fallbackAgent ?? {
        name: agentName,
        status: 'idle',
      };
      return [
        ...updatedAgents,
        {
          ...baseAgent,
          debugInfo: updater(baseAgent.debugInfo),
        },
      ];
    }

    return updatedAgents;
  }, []);

  // Event handlers
  useEffect(() => {
    if (!orchestrator) return;

    const handleAgentTransition = (
      eventTaskId: string,
      fromAgent: string | null,
      toAgent: string
    ) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Agent transition', { from: fromAgent, to: toAgent, taskId: eventTaskId });

      const now = new Date();

      // Calculate response time for previous agent
      if (fromAgent) {
        const agentStartTime = agentStartTimeRef.current.get(fromAgent);
        if (agentStartTime) {
          const responseTime = now.getTime() - agentStartTime.getTime();
          setVerboseData((prev: VerboseDebugData) => ({
            ...prev,
            timing: {
              ...prev.timing,
              agentResponseTimes: {
                ...prev.timing.agentResponseTimes,
                [fromAgent]: (prev.timing.agentResponseTimes[fromAgent] || 0) + responseTime,
              },
            },
          }));
        }
      }

      // Start timing for new agent
      agentStartTimeRef.current.set(toAgent, now);

      // Set stageStartedAt for the new agent
      const prevState = stateRef.current;
      let updatedAgents = updateAgentStatus(
        prevState.agents.length > 0 ? prevState.agents : derivedAgents,
        toAgent,
        fromAgent || undefined
      );
      updatedAgents = ensureAgentEntry(updatedAgents, toAgent, 'active');
      updatedAgents = ensureAgentEntry(updatedAgents, fromAgent ?? undefined, 'completed');

      const nextState = {
        ...prevState,
        currentAgent: toAgent,
        previousAgent: fromAgent || undefined,
        agents: updatedAgents.map(agent =>
          agent.name === toAgent
            ? { ...agent, debugInfo: { ...agent.debugInfo, stageStartedAt: now } }
            : agent
        ),
        currentTaskId: eventTaskId,
      };

      stateRef.current = nextState;
      setState(nextState);
    };

    // Stage change handler (fallback if agent:transition not available)
    const handleStageChange = (task: any, stageName: string) => {
      if (taskId && task.id !== taskId) return;

      log('Stage change', { stage: stageName, taskId: task.id });

      const now = new Date();
      const stageAgent = workflow?.stages.find(s => s.name === stageName)?.agent;

      // Calculate previous stage duration if applicable
      const prevStageStart = stageStartTimeRef.current;
      const stageDuration = now.getTime() - prevStageStart.getTime();

      // Update stage timing
      stageStartTimeRef.current = now;
      totalTokensRef.current = 0; // Reset for new stage

      setVerboseData((prev: VerboseDebugData) => ({
        ...prev,
        timing: {
          ...prev.timing,
          stageStartTime: now,
          stageEndTime: undefined,
          stageDuration: undefined,
          // Keep accumulated agentResponseTimes and toolUsageTimes
        },
      }));

      if (stageAgent) {
        const currentState = stateRef.current;
        const updatedAgents = updateAgentStatus(
          currentState.agents.length > 0 ? currentState.agents : derivedAgents,
          stageAgent,
          currentState.currentAgent
        );

        const nextState = {
          ...currentState,
          currentAgent: stageAgent,
          previousAgent: currentState.currentAgent,
          agents: updatedAgents,
          currentTaskId: task.id,
        };
        stateRef.current = nextState;
        setState(nextState);
      }
    };

    // Parallel execution start handler
    const handleParallelStart = (eventTaskId: string, stages?: string[], agents?: string[]) => {
      if (taskId && eventTaskId !== taskId) return;

      const safeStages = stages ?? [];
      const safeAgents = agents ?? [];

      log('Parallel execution started', { stages: safeStages, agents: safeAgents, taskId: eventTaskId });

      const parallelAgents = safeAgents.map((agent, index) => ({
        name: agent,
        status: 'parallel' as const,
        stage: safeStages[index],
      }));

      const nextState = {
        ...stateRef.current,
        parallelAgents,
        showParallelPanel: safeAgents.length > 1,
        currentTaskId: eventTaskId,
      };
      stateRef.current = nextState;
      setState(nextState);
    };

    // Parallel execution complete handler
    const handleParallelComplete = (eventTaskId: string) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Parallel execution completed', { taskId: eventTaskId });

      const nextState = {
        ...stateRef.current,
        parallelAgents: [],
        showParallelPanel: false,
      };
      stateRef.current = nextState;
      setState(nextState);
    };

    // Task lifecycle handlers
    const handleTaskStart = (task: any) => {
      if (taskId && task.id !== taskId) return;

      log('Task started', { taskId: task.id });

      const nextState = {
        ...stateRef.current,
        currentTaskId: task.id,
        agents: derivedAgents,
        subtaskProgress: { completed: 0, total: 0 },
      };
      stateRef.current = nextState;
      setState(nextState);
    };

    const handleTaskComplete = (task: any) => {
      if (taskId && task.id !== taskId) return;

      log('Task completed', { taskId: task.id });

      setState((prev: OrchestratorEventState) => ({
        ...prev,
        currentAgent: undefined,
        previousAgent: undefined,
        currentTaskId: undefined,
        parallelAgents: [],
        showParallelPanel: false,
        subtaskProgress: undefined,
      }));
    };

    const handleTaskFail = (task: any, error: Error) => {
      if (taskId && task.id !== taskId) return;

      log('Task failed', { taskId: task.id, error: error.message });

      setState((prev: OrchestratorEventState) => ({
        ...prev,
        currentAgent: undefined,
        previousAgent: undefined,
        currentTaskId: undefined,
        parallelAgents: [],
        showParallelPanel: false,
        subtaskProgress: undefined,
      }));
    };

    // Subtask handlers
    const handleSubtaskCreated = (subtask: any, parentTaskId: string) => {
      if (taskId && parentTaskId !== taskId) return;

      log('Subtask created', { subtaskId: subtask.id, parentTaskId });

      setState((prev: OrchestratorEventState) => ({
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

      setState((prev: OrchestratorEventState) => ({
        ...prev,
        subtaskProgress: prev.subtaskProgress ? {
          completed: prev.subtaskProgress.completed + 1,
          total: prev.subtaskProgress.total,
        } : { completed: 1, total: 1 },
      }));
    };

    // Debug info handlers - adapted to match OrchestratorEvents signatures
    const handleUsageUpdated = (
      eventTaskId: string,
      usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number }
    ) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Usage updated', { taskId: eventTaskId, tokens: usage });

      // Get current agent name from state
      const currentAgentName = stateRef.current.currentAgent;
      if (!currentAgentName) return;

      // Update agentTokens in verboseData
      setVerboseData((prev: VerboseDebugData) => {
        const prevAgentTokens = prev.agentTokens[currentAgentName] || {
          inputTokens: 0,
          outputTokens: 0,
        };

        const newAgentTokens = {
          ...prev.agentTokens,
          [currentAgentName]: {
            inputTokens: prevAgentTokens.inputTokens + usage.inputTokens,
            outputTokens: prevAgentTokens.outputTokens + usage.outputTokens,
            estimatedCost: usage.estimatedCost,
          },
        };

        // Calculate tokens per second metric
        const now = Date.now();
        const elapsed = (now - stageStartTimeRef.current.getTime()) / 1000;
        totalTokensRef.current += usage.totalTokens;
        const tokensPerSecond = elapsed > 0 ? totalTokensRef.current / elapsed : 0;

        return {
          ...prev,
          agentTokens: newAgentTokens,
          metrics: {
            ...prev.metrics,
            tokensPerSecond,
          },
        };
      });

      // Also update agent's debugInfo for immediate display
      setState((prev: OrchestratorEventState) => ({
        ...prev,
        agents: updateAgentDebugInfo(
          prev.agents,
          currentAgentName,
          (debugInfo) => ({
            ...debugInfo,
            tokensUsed: {
              input: (debugInfo?.tokensUsed?.input || 0) + usage.inputTokens,
              output: (debugInfo?.tokensUsed?.output || 0) + usage.outputTokens,
            },
          }),
          derivedAgentsByName.get(currentAgentName),
          Boolean(derivedAgentsByName.get(currentAgentName))
        ),
      }));
    };

    const handleToolUse = (
      eventTaskId: string,
      tool: string,
      _input: unknown
    ) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Tool use', { taskId: eventTaskId, tool });

      const currentAgentName = stateRef.current.currentAgent;
      const now = new Date();

      // Track tool call completion if there's a previous tool in progress
      const prevToolStart = toolStartTimeRef.current.get(tool);
      if (prevToolStart) {
        const duration = now.getTime() - prevToolStart.getTime();
        setVerboseData((prev: VerboseDebugData) => ({
          ...prev,
          timing: {
            ...prev.timing,
            toolUsageTimes: {
              ...prev.timing.toolUsageTimes,
              [tool]: (prev.timing.toolUsageTimes[tool] || 0) + duration,
            },
          },
        }));
      }

      // Start timing for this tool call
      toolStartTimeRef.current.set(tool, now);

      // Update agentDebug tool call counts
      if (currentAgentName) {
        setVerboseData((prev: VerboseDebugData) => {
          const agentToolCounts = prev.agentDebug.toolCallCounts[currentAgentName] || {};
          return {
            ...prev,
            agentDebug: {
              ...prev.agentDebug,
              toolCallCounts: {
                ...prev.agentDebug.toolCallCounts,
                [currentAgentName]: {
                  ...agentToolCounts,
                  [tool]: (agentToolCounts[tool] || 0) + 1,
                },
              },
            },
          };
        });

        // Update agent's debugInfo.lastToolCall
        setState((prev: OrchestratorEventState) => ({
          ...prev,
          agents: updateAgentDebugInfo(
            prev.agents,
            currentAgentName,
            (debugInfo) => ({
              ...debugInfo,
              lastToolCall: tool,
            }),
            derivedAgentsByName.get(currentAgentName),
            Boolean(derivedAgentsByName.get(currentAgentName))
          ),
        }));
      }
    };

    const handleAgentThinking = (eventTaskId: string, agentName: string, thinking: string) => {
      if (taskId && eventTaskId !== taskId) return;

      log('Agent thinking', { agent: agentName, thinking: thinking.substring(0, 100) + (thinking.length > 100 ? '...' : '') });

      const baseState = stateRef.current;
      const nextAgents = updateAgentDebugInfo(
        baseState.agents.length > 0 ? baseState.agents : derivedAgents,
        agentName,
        (debugInfo) => ({
          ...debugInfo,
          thinking: thinking,
        }),
        derivedAgentsByName.get(agentName),
        Boolean(derivedAgentsByName.get(agentName))
      );

      const nextState = {
        ...baseState,
        agents: nextAgents,
      };
      stateRef.current = nextState;
      setState(nextState);
    };

    // Agent message handler for conversation length tracking
    const handleAgentMessage = (eventTaskId: string, _message: unknown) => {
      if (taskId && eventTaskId !== taskId) return;

      const currentAgentName = stateRef.current.currentAgent;
      if (!currentAgentName) return;

      log('Agent message', { taskId: eventTaskId, agent: currentAgentName });

      // Update conversation length in VerboseDebugData
      setVerboseData((prev: VerboseDebugData) => ({
        ...prev,
        agentDebug: {
          ...prev.agentDebug,
          conversationLength: {
            ...prev.agentDebug.conversationLength,
            [currentAgentName]: (prev.agentDebug.conversationLength[currentAgentName] || 0) + 1,
          },
        },
      }));
    };

    const handleAgentTurn = (event: { taskId: string; agentName: string; turnNumber: number }) => {
      if (taskId && event.taskId !== taskId) return;

      log('Agent turn', event);

      setState((prev: OrchestratorEventState) => ({
        ...prev,
        agents: updateAgentDebugInfo(
          prev.agents,
          event.agentName,
          (debugInfo) => ({
            ...debugInfo,
            turnCount: event.turnNumber,
          }),
          derivedAgentsByName.get(event.agentName),
          Boolean(derivedAgentsByName.get(event.agentName))
        ),
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

    // Register debug event listeners
    orchestrator.on('usage:updated', handleUsageUpdated);
    orchestrator.on('agent:tool-use', handleToolUse);
    orchestrator.on('agent:message', handleAgentMessage);
    orchestrator.on('agent:thinking', handleAgentThinking);
    orchestrator.on('agent:turn', handleAgentTurn);

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

      // Cleanup debug event listeners
      orchestrator.off('usage:updated', handleUsageUpdated);
      orchestrator.off('agent:tool-use', handleToolUse);
      orchestrator.off('agent:message', handleAgentMessage);
      orchestrator.off('agent:thinking', handleAgentThinking);
      orchestrator.off('agent:turn', handleAgentTurn);

      log('Event listeners cleaned up');
    };
  }, [orchestrator, taskId, workflow, log, derivedAgents, derivedAgentsByName, updateAgentStatus, updateAgentDebugInfo, ensureAgentEntry]);

  useEffect(() => {
    if (derivedAgents.length === 0) {
      return;
    }

    const currentAgents = stateRef.current.agents;
    const currentNames = currentAgents.map(agent => agent.name).join('|');
    const derivedNames = derivedAgents.map(agent => agent.name).join('|');

    if (currentNames === derivedNames) {
      return;
    }

    const mergedAgents = mergeAgentsWithWorkflow(currentAgents, derivedAgents);
    const nextState = {
      ...stateRef.current,
      agents: mergedAgents,
    };
    stateRef.current = nextState;
    setState(nextState);
  }, [derivedAgents, mergeAgentsWithWorkflow]);

  // Initialize agents from workflow if not already set
  useEffect(() => {
    if (derivedAgents.length > 0 && state.agents.length === 0) {
      setState(prev => ({
        ...prev,
        agents: derivedAgents,
      }));
    }
  }, [derivedAgents, state.agents.length]);

  // Calculate derived metrics based on accumulated data
  useEffect(() => {
    setVerboseData(prev => {
      // Calculate average response time
      const responseTimes = Object.values(prev.timing.agentResponseTimes);
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      // Calculate tool efficiency (assuming successful calls for now)
      const toolEfficiency: Record<string, number> = {};
      Object.entries(prev.agentDebug.toolCallCounts).forEach(([agentName, toolCounts]) => {
        Object.entries(toolCounts).forEach(([toolName, count]) => {
          // For now, assume 100% efficiency - this would need actual success/failure tracking
          toolEfficiency[toolName] = 1.0;
        });
      });

      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          averageResponseTime,
          toolEfficiency,
        },
      };
    });
  }, [verboseData.timing.agentResponseTimes, verboseData.agentDebug.toolCallCounts]);

  return {
    ...state,
    verboseData,
  };
}
