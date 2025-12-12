import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// Helper functions moved outside components for reuse
const getLevelIcon = (level: string): { icon: string; color: string } => {
  switch (level) {
    case 'error':
      return { icon: '❌', color: 'red' };
    case 'warn':
      return { icon: '⚠️', color: 'yellow' };
    case 'success':
      return { icon: '✅', color: 'green' };
    case 'info':
      return { icon: 'ℹ️', color: 'blue' };
    default:
      return { icon: '🔍', color: 'gray' };
  }
};

const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  agent?: string;
  category?: string;
  data?: Record<string, unknown>;
  duration?: number;
  collapsed?: boolean;
}

export interface ActivityLogProps {
  entries: LogEntry[];
  maxEntries?: number;
  showTimestamps?: boolean;
  showAgents?: boolean;
  allowCollapse?: boolean;
  filterLevel?: 'debug' | 'info' | 'warn' | 'error';
  width?: number;
  height?: number;
  title?: string;
  autoScroll?: boolean;
}

/**
 * Collapsible activity log with filtering and search
 */
export function ActivityLog({
  entries,
  maxEntries = 100,
  showTimestamps = true,
  showAgents = true,
  allowCollapse = true,
  filterLevel = 'debug',
  width = 80,
  height = 20,
  title = 'Activity Log',
  autoScroll = true,
}: ActivityLogProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filter, setFilter] = useState('');
  const [collapsedEntries, setCollapsedEntries] = useState(new Set<string>());

  const levelOrder = { debug: 0, info: 1, warn: 2, error: 3, success: 1 };

  // Filter entries based on level and search
  const filteredEntries = entries
    .filter(entry => levelOrder[entry.level] >= levelOrder[filterLevel])
    .filter(entry =>
      filter === '' ||
      entry.message.toLowerCase().includes(filter.toLowerCase()) ||
      entry.agent?.toLowerCase().includes(filter.toLowerCase()) ||
      entry.category?.toLowerCase().includes(filter.toLowerCase())
    )
    .slice(-maxEntries);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const toggleEntryCollapse = (entryId: string) => {
    const newCollapsed = new Set(collapsedEntries);
    if (newCollapsed.has(entryId)) {
      newCollapsed.delete(entryId);
    } else {
      newCollapsed.add(entryId);
    }
    setCollapsedEntries(newCollapsed);
  };

  useInput((input, key) => {
    if (!allowCollapse) return;

    if (key.upArrow) {
      setSelectedIndex(Math.max(-1, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(filteredEntries.length - 1, selectedIndex + 1));
    } else if (key.return && selectedIndex >= 0) {
      toggleEntryCollapse(filteredEntries[selectedIndex].id);
    } else if (input === 'c' && !key.ctrl) {
      setCollapsed(!collapsed);
    }
  });

  if (collapsed && allowCollapse) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          {title} (collapsed) - Press 'c' to expand
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" width={width} height={height}>
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
        <Text bold color="cyan">{title}</Text>
        <Text color="gray">{filteredEntries.length} entries</Text>
        {allowCollapse && (
          <Text color="gray" dimColor>Press 'c' to collapse</Text>
        )}
      </Box>

      {/* Filter bar */}
      <Box paddingX={1} paddingY={0}>
        <Text color="gray">Filter: </Text>
        <Text color="white">{filter || 'none'}</Text>
        <Text color="gray"> | Level: {filterLevel}+</Text>
      </Box>

      {/* Log entries */}
      <Box flexDirection="column" paddingX={1} flexGrow={1} overflowY="hidden">
        {filteredEntries.length === 0 ? (
          <Text color="gray" dimColor>No log entries to display</Text>
        ) : (
          filteredEntries.map((entry, index) => {
            const { icon, color } = getLevelIcon(entry.level);
            const isSelected = selectedIndex === index;
            const isCollapsed = collapsedEntries.has(entry.id);

            return (
              <Box key={entry.id} flexDirection="column">
                {/* Main log line */}
                <Box>
                  {showTimestamps && (
                    <Text color="gray" dimColor>
                      [{formatTimestamp(entry.timestamp)}]
                    </Text>
                  )}
                  <Text color={color}>{icon} </Text>
                  {showAgents && entry.agent && (
                    <Text color="magenta" bold>[{entry.agent}] </Text>
                  )}
                  {entry.category && (
                    <Text color="cyan">({entry.category}) </Text>
                  )}
                  <Text color={color}>
                    {isCollapsed ? '▶ ' : ''}
                    {entry.message}
                  </Text>
                  {entry.duration && (
                    <Text color="gray" dimColor> ({formatDuration(entry.duration)})</Text>
                  )}
                </Box>

                {/* Expanded data */}
                {!isCollapsed && entry.data && Object.keys(entry.data).length > 0 && (
                  <Box marginLeft={showTimestamps ? 12 : 4} flexDirection="column">
                    {Object.entries(entry.data).map(([key, value]) => (
                      <Text key={key} color="gray" dimColor>
                        {key}: {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </Text>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer */}
      {allowCollapse && (
        <Box paddingX={1} borderTop={true}>
          <Text color="gray" dimColor>
            ↑↓: Navigate | Enter: Toggle details | c: Collapse panel
          </Text>
        </Box>
      )}
    </Box>
  );
}

export interface LogStreamProps {
  entries: LogEntry[];
  onNewEntry?: (entry: LogEntry) => void;
  realTime?: boolean;
  bufferSize?: number;
  width?: number;
  height?: number;
}

/**
 * Real-time streaming log display
 */
export function LogStream({
  entries,
  onNewEntry,
  realTime = true,
  bufferSize = 1000,
  width = 80,
  height = 15,
}: LogStreamProps): React.ReactElement {
  const [buffer, setBuffer] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (realTime && entries.length > 0) {
      const newEntries = entries.slice(-bufferSize);
      setBuffer(newEntries);

      if (onNewEntry && entries.length > buffer.length) {
        const latestEntry = entries[entries.length - 1];
        onNewEntry(latestEntry);
      }
    }
  }, [entries, realTime, bufferSize, onNewEntry, buffer.length]);

  useInput((input, key) => {
    if (input === ' ') {
      setIsPaused(!isPaused);
    } else if (input === 's') {
      setAutoScroll(!autoScroll);
    }
  });

  const displayEntries = isPaused ? buffer : (realTime ? entries : entries).slice(-height + 2);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" width={width} height={height}>
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color="green">Live Log Stream</Text>
        <Box>
          {isPaused && <Text color="yellow">PAUSED</Text>}
          {!autoScroll && <Text color="gray">SCROLL</Text>}
          <Text color="gray" dimColor> Space: pause | s: scroll</Text>
        </Box>
      </Box>

      {/* Stream content */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {displayEntries.map((entry, index) => {
          const { icon, color } = getLevelIcon(entry.level);
          return (
            <Box key={`${entry.id}-${index}`}>
              <Text color="gray" dimColor>
                {formatTimestamp(entry.timestamp)}
              </Text>
              <Text color={color}>{icon} </Text>
              {entry.agent && (
                <Text color="magenta" bold>[{entry.agent}] </Text>
              )}
              <Text>{entry.message}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Footer stats */}
      <Box justifyContent="space-between" paddingX={1} borderTop={true}>
        <Text color="gray" dimColor>
          Showing {displayEntries.length} of {entries.length} entries
        </Text>
        <Text color="gray" dimColor>
          {realTime ? 'LIVE' : 'STATIC'}
        </Text>
      </Box>
    </Box>
  );
}

export interface CompactLogProps {
  entries: LogEntry[];
  maxLines?: number;
  showIcons?: boolean;
  showTimestamps?: boolean;
}

/**
 * Compact log display for space-constrained areas
 */
export function CompactLog({
  entries,
  maxLines = 5,
  showIcons = true,
  showTimestamps = false,
}: CompactLogProps): React.ReactElement {
  const recentEntries = entries.slice(-maxLines);

  return (
    <Box flexDirection="column">
      {recentEntries.map((entry, index) => {
        const { icon, color } = getLevelIcon(entry.level);
        return (
          <Box key={`${entry.id}-${index}`}>
            {showTimestamps && (
              <Text color="gray" dimColor>
                {formatTimestamp(entry.timestamp)}
              </Text>
            )}
            {showIcons && (
              <Text color={color}>{icon} </Text>
            )}
            <Text color={color} dimColor>
              {entry.message.length > 60 ? `${entry.message.substring(0, 57)}...` : entry.message}
            </Text>
          </Box>
        );
      })}
      {entries.length > maxLines && (
        <Text color="gray" dimColor>
          ... and {entries.length - maxLines} more entries
        </Text>
      )}
    </Box>
  );
}

export default ActivityLog;