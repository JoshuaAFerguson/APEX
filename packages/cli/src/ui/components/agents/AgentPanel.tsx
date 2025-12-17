import React from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';
import { useAgentHandoff } from '../../hooks/useAgentHandoff.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { HandoffIndicator } from './HandoffIndicator.js';
import { ProgressBar } from '../ProgressIndicators.js';
import { ParallelExecutionView, ParallelAgent } from './ParallelExecutionView.js';
import { VerboseAgentRow } from './VerboseAgentRow.js';

export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date; // When the agent started working
  // Verbose mode debug fields
  debugInfo?: {
    tokensUsed?: { input: number; output: number };
    stageStartedAt?: Date;
    lastToolCall?: string;
    turnCount?: number;
    errorCount?: number;
  };
}

export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
  useDetailedParallelView?: boolean;
  displayMode?: DisplayMode;
}

const agentColors: Record<string, string> = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};

const statusIcons: Record<AgentInfo['status'], string> = {
  active: '⚡',
  waiting: '○',
  completed: '✓',
  idle: '·',
  parallel: '⟂',
};

export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
  showParallel = false,
  parallelAgents = [],
  useDetailedParallelView = false,
  displayMode = 'normal',
}: AgentPanelProps): React.ReactElement {
  // Use handoff animation hook to track agent transitions
  const handoffState = useAgentHandoff(currentAgent);

  // Determine if we should use compact display based on displayMode or compact prop
  const useCompactDisplay = compact || displayMode === 'compact';

  if (useCompactDisplay) {
    // Single line: ⚡developer[42s] | ○tester | ○reviewer with handoff indicator
    return (
      <Box>
        {agents.map((agent, index) => {
          const shouldShowElapsed = agent.status === 'active' && agent.startedAt;
          const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

          return (
            <React.Fragment key={agent.name}>
              <Text color={agent.name === currentAgent ? (agent.status === 'parallel' ? 'cyan' : agentColors[agent.name]) : 'gray'}>
                {statusIcons[agent.status]}
                {agent.name}
                {agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && ` ${agent.progress}%`}
                {shouldShowElapsed && `[${elapsedTime}]`}
              </Text>
              {index < agents.length - 1 && <Text color="gray"> │ </Text>}
            </React.Fragment>
          );
        })}
        {/* Show parallel agents in compact mode */}
        {showParallel && parallelAgents.length > 1 && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="cyan">⟂</Text>
            {parallelAgents.map((agent, index) => {
              const shouldShowElapsed = agent.status === 'parallel' && agent.startedAt;
              const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

              return (
                <React.Fragment key={agent.name}>
                  <Text color="cyan">
                    {agent.name}
                    {agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && ` ${agent.progress}%`}
                    {shouldShowElapsed && `[${elapsedTime}]`}
                  </Text>
                  {index < parallelAgents.length - 1 && <Text color="cyan">,</Text>}
                </React.Fragment>
              );
            })}
          </>
        )}
        {/* Show handoff animation in compact mode */}
        <HandoffIndicator
          animationState={handoffState}
          agentColors={agentColors}
          compact={true}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="cyan" bold>
        Active Agents
      </Text>

      {/* Show handoff animation in full mode */}
      <HandoffIndicator
        animationState={handoffState}
        agentColors={agentColors}
        compact={false}
      />

      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => (
          displayMode === 'verbose' ? (
            <VerboseAgentRow
              key={agent.name}
              agent={agent}
              isActive={agent.name === currentAgent}
              color={agentColors[agent.name] || 'white'}
            />
          ) : (
            <AgentRow
              key={agent.name}
              agent={agent}
              isActive={agent.name === currentAgent}
              displayMode={displayMode}
            />
          )
        ))}
      </Box>

      {/* Parallel execution section */}
      {showParallel && parallelAgents.length > 1 && (
        useDetailedParallelView ? (
          <ParallelExecutionView
            agents={parallelAgents.map(agent => ({
              name: agent.name,
              status: agent.status,
              stage: agent.stage,
              progress: agent.progress,
              startedAt: agent.startedAt,
            }))}
            compact={false}
          />
        ) : (
          <ParallelSection agents={parallelAgents} />
        )
      )}
    </Box>
  );
}

function AgentRow({
  agent,
  isActive,
  displayMode = 'normal',
}: {
  agent: AgentInfo;
  isActive: boolean;
  displayMode?: DisplayMode;
}): React.ReactElement {
  const color = agentColors[agent.name] || 'white';
  // Use cyan color for parallel agents
  const finalColor = agent.status === 'parallel' ? 'cyan' : color;

  // Track elapsed time for active agents with a start time
  const shouldShowElapsed = agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  // Show progress bar for active/parallel agents with progress between 0-100 (exclusive)
  const shouldShowProgressBar = (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? finalColor : 'gray'}>
          {statusIcons[agent.status]}{' '}
        </Text>
        <Text color={isActive ? finalColor : 'gray'} bold={isActive}>
          {agent.name}
        </Text>
        {agent.stage && (
          <Text color="gray" dimColor>
            {' '}({agent.stage})
          </Text>
        )}
        {shouldShowElapsed && (
          <Text color="gray" dimColor>
            {' '}[{elapsedTime}]
          </Text>
        )}
      </Box>
      {shouldShowProgressBar && (
        <Box marginLeft={2} marginTop={1}>
          <ProgressBar
            progress={agent.progress!}
            width={30}
            showPercentage={true}
            color={finalColor}
            animated={false}
          />
        </Box>
      )}
    </Box>
  );
}

function ParallelSection({
  agents,
}: {
  agents: AgentInfo[];
}): React.ReactElement {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan" bold>
        <Text>⟂ Parallel Execution</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => {
          // Track elapsed time for parallel agents with a start time
          const shouldShowElapsed = agent.status === 'parallel' && agent.startedAt;
          const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

          // Show progress bar for parallel agents with progress between 0-100 (exclusive)
          const shouldShowProgressBar = agent.status === 'parallel' &&
            agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

          return (
            <Box key={agent.name} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="cyan">
                  ⟂{' '}
                </Text>
                <Text color="cyan" bold>
                  {agent.name}
                </Text>
                {agent.stage && (
                  <Text color="gray" dimColor>
                    {' '}({agent.stage})
                  </Text>
                )}
                {shouldShowElapsed && (
                  <Text color="gray" dimColor>
                    {' '}[{elapsedTime}]
                  </Text>
                )}
              </Box>
              {shouldShowProgressBar && (
                <Box marginLeft={2} marginTop={1}>
                  <ProgressBar
                    progress={agent.progress!}
                    width={30}
                    showPercentage={true}
                    color="cyan"
                    animated={false}
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}