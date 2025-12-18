import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { useStdoutDimensions } from '../../hooks/useStdoutDimensions.js';
import { ProgressBar } from '../ProgressIndicators.js';

export interface ParallelAgent {
  name: string;
  status: 'parallel' | 'active' | 'completed' | 'waiting' | 'idle';
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date;
}

export interface ParallelExecutionViewProps {
  agents: ParallelAgent[];
  /** Override automatic maxColumns calculation. If not provided, will adapt based on terminal width */
  maxColumns?: number;
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

const statusIcons: Record<ParallelAgent['status'], string> = {
  parallel: '⟂',
  active: '⚡',
  completed: '✓',
  waiting: '○',
  idle: '·',
};

/**
 * Calculate maxColumns based on terminal width using the breakpoint system
 */
function calculateMaxColumns(
  width: number,
  isNarrow: boolean,
  isCompact: boolean,
  isNormal: boolean,
  isWide: boolean,
  compact: boolean
): number {
  // For narrow terminals, always use 1 column to prevent horizontal overflow
  if (isNarrow) {
    return 1;
  }

  // For compact terminals, use 2 columns unless in compact mode
  if (isCompact) {
    return compact ? 1 : 2;
  }

  // For normal terminals, calculate based on estimated agent card width
  if (isNormal) {
    if (compact) {
      // Compact cards: ~18 characters wide + spacing
      const cardWidth = 20;
      return Math.max(1, Math.floor(width / cardWidth));
    } else {
      // Full cards: ~26 characters wide + spacing
      const cardWidth = 28;
      return Math.max(1, Math.floor(width / cardWidth));
    }
  }

  // For wide terminals, allow more columns
  if (isWide) {
    if (compact) {
      const cardWidth = 20;
      return Math.max(1, Math.floor(width / cardWidth));
    } else {
      const cardWidth = 28;
      return Math.max(1, Math.floor(width / cardWidth));
    }
  }

  // Fallback to default behavior
  return 3;
}

/**
 * ParallelExecutionView component for detailed parallel agent visualization
 * Shows all parallel agents in a grouped view with individual progress side-by-side
 * Dynamically adapts maxColumns based on terminal width
 */
export function ParallelExecutionView({
  agents,
  maxColumns: explicitMaxColumns,
  compact = false,
}: ParallelExecutionViewProps): React.ReactElement {
  // Get terminal dimensions and breakpoint information
  const { width, isNarrow, isCompact, isNormal, isWide } = useStdoutDimensions();

  // Calculate responsive maxColumns based on terminal width
  const responsiveMaxColumns = useMemo(() =>
    calculateMaxColumns(width, isNarrow, isCompact, isNormal, isWide, compact),
    [width, isNarrow, isCompact, isNormal, isWide, compact]
  );

  // Use explicit maxColumns if provided, otherwise use responsive calculation
  const maxColumns = explicitMaxColumns ?? responsiveMaxColumns;
  // Filter to only show parallel or active agents
  const activeParallelAgents = agents.filter(
    agent => agent.status === 'parallel' || agent.status === 'active'
  );

  if (activeParallelAgents.length === 0) {
    return (
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          No parallel agents currently active
        </Text>
      </Box>
    );
  }

  // Group agents into rows based on maxColumns
  const agentRows: ParallelAgent[][] = [];
  for (let i = 0; i < activeParallelAgents.length; i += maxColumns) {
    agentRows.push(activeParallelAgents.slice(i, i + maxColumns));
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan" bold>
        ⟂ Parallel Execution ({activeParallelAgents.length} agents)
      </Text>

      {agentRows.map((row, rowIndex) => (
        <Box key={rowIndex} marginTop={1} flexDirection="row">
          {row.map((agent, colIndex) => (
            <React.Fragment key={agent.name}>
              <ParallelAgentCard
                agent={agent}
                compact={compact}
              />
              {/* Add spacing between columns, but not after the last column */}
              {colIndex < row.length - 1 && <Box width={2} />}
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}

interface ParallelAgentCardProps {
  agent: ParallelAgent;
  compact?: boolean;
}

function ParallelAgentCard({
  agent,
  compact = false,
}: ParallelAgentCardProps): React.ReactElement {
  const agentColor = agentColors[agent.name] || 'white';
  const displayColor = agent.status === 'parallel' ? 'cyan' : agentColor;

  // Track elapsed time for agents with a start time
  const shouldShowElapsed = (agent.status === 'parallel' || agent.status === 'active') && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  // Show progress bar for agents with progress between 0-100 (exclusive)
  const shouldShowProgressBar =
    (agent.status === 'parallel' || agent.status === 'active') &&
    agent.progress !== undefined &&
    agent.progress > 0 &&
    agent.progress < 100;

  if (compact) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={displayColor}
        paddingX={1}
        paddingY={0}
        minWidth={16}
      >
        <Box justifyContent="center">
          <Text color={displayColor}>
            {statusIcons[agent.status]} {agent.name}
          </Text>
        </Box>
        {agent.stage && (
          <Box justifyContent="center">
            <Text color="gray" dimColor>
              {agent.stage}
            </Text>
          </Box>
        )}
        {shouldShowElapsed && (
          <Box justifyContent="center">
            <Text color="gray" dimColor>
              [{elapsedTime}]
            </Text>
          </Box>
        )}
        {shouldShowProgressBar && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={displayColor}>
              {Math.round(agent.progress!)}%
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={displayColor}
      paddingX={2}
      paddingY={1}
      minWidth={24}
    >
      {/* Agent header */}
      <Box justifyContent="center">
        <Text color={displayColor} bold>
          {statusIcons[agent.status]} {agent.name}
        </Text>
      </Box>

      {/* Stage information */}
      {agent.stage && (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>
            Stage: {agent.stage}
          </Text>
        </Box>
      )}

      {/* Elapsed time */}
      {shouldShowElapsed && (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>
            Runtime: [{elapsedTime}]
          </Text>
        </Box>
      )}

      {/* Progress bar */}
      {shouldShowProgressBar && (
        <Box marginTop={1} justifyContent="center">
          <ProgressBar
            progress={agent.progress!}
            width={16}
            showPercentage={true}
            color={displayColor}
            animated={false}
          />
        </Box>
      )}

      {/* Status indicator */}
      <Box justifyContent="center" marginTop={1}>
        <Text color={displayColor} dimColor>
          {agent.status === 'parallel' ? 'Running in Parallel' :
           agent.status === 'active' ? 'Active' :
           agent.status}
        </Text>
      </Box>
    </Box>
  );
}