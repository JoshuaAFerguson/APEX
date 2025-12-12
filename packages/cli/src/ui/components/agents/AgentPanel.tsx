import React from 'react';
import { Box, Text } from 'ink';

export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle';
  stage?: string;
  progress?: number; // 0-100
}

export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
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
};

export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
}: AgentPanelProps): React.ReactElement {
  if (compact) {
    // Single line: ⚡developer | ○tester | ○reviewer
    return (
      <Box>
        {agents.map((agent, index) => (
          <React.Fragment key={agent.name}>
            <Text color={agent.name === currentAgent ? agentColors[agent.name] : 'gray'}>
              {statusIcons[agent.status]}
              {agent.name}
            </Text>
            {index < agents.length - 1 && <Text color="gray"> │ </Text>}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="cyan" bold>
        Active Agents
      </Text>
      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => (
          <AgentRow
            key={agent.name}
            agent={agent}
            isActive={agent.name === currentAgent}
          />
        ))}
      </Box>
    </Box>
  );
}

function AgentRow({
  agent,
  isActive,
}: {
  agent: AgentInfo;
  isActive: boolean;
}): React.ReactElement {
  const color = agentColors[agent.name] || 'white';

  return (
    <Box>
      <Text color={isActive ? color : 'gray'}>
        {statusIcons[agent.status]}{' '}
      </Text>
      <Text color={isActive ? color : 'gray'} bold={isActive}>
        {agent.name}
      </Text>
      {agent.stage && (
        <Text color="gray" dimColor>
          {' '}({agent.stage})
        </Text>
      )}
      {agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && (
        <Text color="gray">
          {' '}{agent.progress}%
        </Text>
      )}
    </Box>
  );
}