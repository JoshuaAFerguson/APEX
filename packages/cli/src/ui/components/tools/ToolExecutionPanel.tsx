import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { ToolCall } from '../ToolCall.js';
import { ActivityLog, CompactLog } from '../ActivityLog.js';
import { useToolEventLogger, type ToolEventLoggerOptions } from '../../hooks/useToolEventLogger.js';
import type { DisplayMode } from '@apexcli/core';
import { formatDuration } from '@apexcli/core';

export interface ToolExecutionPanelProps extends ToolEventLoggerOptions {
  /** Panel display mode */
  displayMode?: DisplayMode;
  /** Panel width */
  width?: number;
  /** Panel height */
  height?: number;
  /** Whether to show statistics */
  showStats?: boolean;
  /** Whether to show active tool calls */
  showActiveTools?: boolean;
  /** Whether to show tool activity log */
  showActivityLog?: boolean;
  /** Maximum number of recent tool logs to display */
  maxRecentLogs?: number;
  /** Panel title */
  title?: string;
  /** Whether panel is collapsed */
  collapsed?: boolean;
}

/**
 * Comprehensive tool execution visualization panel
 * Shows active tool calls, recent activity, and statistics
 */
export function ToolExecutionPanel({
  orchestrator,
  taskId,
  maxEntries = 100,
  debug = false,
  displayMode = 'normal',
  width,
  height,
  showStats = true,
  showActiveTools = true,
  showActivityLog = true,
  maxRecentLogs = 5,
  title = 'Tool Execution',
  collapsed = false,
}: ToolExecutionPanelProps): React.ReactElement {
  const { toolLogs, activeToolCalls, stats } = useToolEventLogger({
    orchestrator,
    taskId,
    maxEntries,
    debug,
  });

  // Convert active tool calls to ToolCall props
  const activeToolCallsArray = useMemo(() => {
    return Array.from(activeToolCalls.values()).map(event => ({
      toolName: event.toolName,
      input: event.input,
      status: 'running' as const,
      duration: Date.now() - event.timestamp.getTime(),
      displayMode,
    }));
  }, [activeToolCalls, displayMode]);

  // Get recent tool logs for activity display
  const recentToolLogs = useMemo(() => {
    return toolLogs
      .filter(log => log.category === 'tool')
      .slice(-maxRecentLogs);
  }, [toolLogs, maxRecentLogs]);

  // Format statistics
  const formattedStats = useMemo(() => {
    const successRate = stats.totalCalls > 0
      ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1)
      : '0.0';

    return {
      ...stats,
      successRate: `${successRate}%`,
      formattedAverageDuration: formatDuration(stats.averageDuration),
    };
  }, [stats]);

  if (collapsed) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          {title} (collapsed) - {activeToolCallsArray.length} active, {stats.totalCalls} total
        </Text>
      </Box>
    );
  }

  // Compact mode: single line summary
  if (displayMode === 'compact') {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="blue" width={width}>
        <Box justifyContent="space-between" paddingX={1}>
          <Text bold color="blue">{title}</Text>
          <Text color="gray">
            {activeToolCallsArray.length} active | {stats.totalCalls} total | {formattedStats.successRate} success
          </Text>
        </Box>

        {/* Active tools in compact mode */}
        {showActiveTools && activeToolCallsArray.length > 0 && (
          <Box flexDirection="column" paddingX={1}>
            {activeToolCallsArray.map((toolProps, index) => (
              <ToolCall key={index} {...toolProps} displayMode="compact" />
            ))}
          </Box>
        )}

        {/* Compact recent activity */}
        {showActivityLog && recentToolLogs.length > 0 && (
          <Box marginTop={1} paddingX={1}>
            <CompactLog entries={recentToolLogs} maxLines={2} showIcons={false} />
          </Box>
        )}
      </Box>
    );
  }

  // Normal and verbose mode: full panel
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      width={width}
      height={height}
    >
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
        <Text bold color="blue">{title}</Text>
        <Text color="gray">{toolLogs.length} logs</Text>
      </Box>

      {/* Statistics */}
      {showStats && (
        <Box paddingX={1} paddingY={1} borderBottom={true}>
          <Box gap={4}>
            <Text color="gray">
              Total: <Text color="white">{stats.totalCalls}</Text>
            </Text>
            <Text color="gray">
              Success: <Text color="green">{stats.successfulCalls}</Text>
            </Text>
            <Text color="gray">
              Failed: <Text color="red">{stats.failedCalls}</Text>
            </Text>
            <Text color="gray">
              Rate: <Text color={stats.successfulCalls >= stats.failedCalls ? 'green' : 'yellow'}>
                {formattedStats.successRate}
              </Text>
            </Text>
            {stats.totalCalls > 0 && (
              <Text color="gray">
                Avg: <Text color="white">{formattedStats.formattedAverageDuration}</Text>
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Active tool calls */}
      {showActiveTools && (
        <Box flexDirection="column" paddingX={1}>
          {activeToolCallsArray.length > 0 ? (
            <>
              <Box marginBottom={1}>
                <Text bold color="yellow">
                  Active Tool Calls ({activeToolCallsArray.length})
                </Text>
              </Box>
              {activeToolCallsArray.map((toolProps, index) => (
                <ToolCall key={index} {...toolProps} displayMode={displayMode} />
              ))}
            </>
          ) : (
            <Box marginY={1}>
              <Text color="gray" dimColor>
                No active tool calls
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Tool activity log */}
      {showActivityLog && (
        <Box flexGrow={1} marginTop={1}>
          {displayMode === 'verbose' ? (
            <ActivityLog
              entries={toolLogs}
              maxEntries={maxEntries}
              showTimestamps={true}
              showAgents={true}
              displayMode={displayMode}
              title="Tool Activity"
              width={width ? width - 2 : undefined}
              height={height ? Math.max(8, height - 8) : undefined}
            />
          ) : (
            <Box flexDirection="column" paddingX={1}>
              <Box marginBottom={1}>
                <Text bold color="blue">
                  Recent Activity ({recentToolLogs.length})
                </Text>
              </Box>
              <CompactLog
                entries={recentToolLogs}
                maxLines={maxRecentLogs}
                showIcons={true}
                showTimestamps={displayMode === 'normal'}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Footer */}
      <Box paddingX={1} borderTop={true}>
        <Text color="gray" dimColor>
          Tool execution monitoring • Press 't' for detailed view
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Simple tool status indicator for embedding in other components
 */
export interface ToolStatusIndicatorProps {
  /** Active tool calls count */
  activeCount: number;
  /** Total calls in current session */
  totalCount: number;
  /** Success rate percentage */
  successRate: number;
  /** Display mode */
  displayMode?: DisplayMode;
}

export function ToolStatusIndicator({
  activeCount,
  totalCount,
  successRate,
  displayMode = 'normal',
}: ToolStatusIndicatorProps): React.ReactElement {
  const statusColor = activeCount > 0 ? 'yellow' : 'gray';
  const rateColor = successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red';

  if (displayMode === 'compact') {
    return (
      <Box gap={1}>
        <Text color={statusColor}>🔧</Text>
        <Text color="gray">
          {activeCount}/{totalCount}
        </Text>
        <Text color={rateColor}>
          {successRate.toFixed(0)}%
        </Text>
      </Box>
    );
  }

  return (
    <Box gap={2}>
      <Text color={statusColor}>
        🔧 {activeCount > 0 ? `${activeCount} active` : 'idle'}
      </Text>
      <Text color="gray">
        {totalCount} total
      </Text>
      <Text color={rateColor}>
        {successRate.toFixed(1)}% success
      </Text>
    </Box>
  );
}

export default ToolExecutionPanel;