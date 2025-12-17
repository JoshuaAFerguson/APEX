import React from 'react';
import { Box, Text } from 'ink';
import type { AgentInfo } from './AgentPanel.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { ProgressBar } from '../ProgressIndicators.js';

export interface VerboseAgentRowProps {
  agent: AgentInfo;
  isActive: boolean;
  color: string;
}

/**
 * VerboseAgentRow - Enhanced agent row for verbose display mode
 * Shows detailed debug information for active agents including:
 * - Token usage (input→output format)
 * - Turn count
 * - Last tool call
 * - Error count (if any)
 */
export function VerboseAgentRow({
  agent,
  isActive,
  color,
}: VerboseAgentRowProps): React.ReactElement {
  const shouldShowElapsed = agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  const shouldShowProgressBar = (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Main agent row */}
      <Box>
        <Text color={isActive ? color : 'gray'}>
          {getStatusIcon(agent.status)}{' '}
        </Text>
        <Text color={isActive ? color : 'gray'} bold={isActive}>
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

      {/* Progress bar */}
      {shouldShowProgressBar && (
        <Box marginLeft={2} marginTop={1}>
          <ProgressBar
            progress={agent.progress!}
            width={30}
            showPercentage={true}
            color={color}
            animated={false}
          />
        </Box>
      )}

      {/* Verbose debug information - only for active agents with debug info */}
      {isActive && agent.debugInfo && (
        <Box marginLeft={4} marginTop={1} flexDirection="column">
          {agent.debugInfo.tokensUsed && (
            <Text color="gray" dimColor>
              🔢 Tokens: {formatTokens(agent.debugInfo.tokensUsed.input)}→{formatTokens(agent.debugInfo.tokensUsed.output)}
            </Text>
          )}
          {agent.debugInfo.turnCount !== undefined && (
            <Text color="gray" dimColor>
              🔄 Turns: {agent.debugInfo.turnCount}
            </Text>
          )}
          {agent.debugInfo.lastToolCall && (
            <Text color="gray" dimColor>
              🔧 Last tool: {agent.debugInfo.lastToolCall}
            </Text>
          )}
          {agent.debugInfo.errorCount !== undefined && agent.debugInfo.errorCount > 0 && (
            <Text color="red" dimColor>
              ❌ Errors: {agent.debugInfo.errorCount}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// Helper functions
function getStatusIcon(status: AgentInfo['status']): string {
  const icons: Record<AgentInfo['status'], string> = {
    active: '⚡',
    waiting: '○',
    completed: '✓',
    idle: '·',
    parallel: '⟂',
  };
  return icons[status];
}

function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}