import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useStdoutDimensions, type Breakpoint } from '../hooks/index.js';

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

const formatTimestamp = (date: Date, abbreviated: boolean = false, verbose: boolean = false): string => {
  if (abbreviated) {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const base = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Add milliseconds in verbose mode
  if (verbose) {
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${base}.${ms}`;
  }

  return base;
};

// Responsive utility functions
const calculateMessageMaxLength = (
  totalWidth: number,
  hasTimestamp: boolean,
  hasAgent: boolean,
  hasIcon: boolean,
  isNarrow: boolean
): number => {
  // Reserve space for UI elements
  let reserved = 4; // borders and padding
  if (hasIcon) reserved += 3; // icon + space
  if (hasTimestamp) reserved += isNarrow ? 8 : 12; // [HH:MM] or [HH:MM:SS] + brackets + space
  if (hasAgent) reserved += 12; // average agent name [developer]

  return Math.max(20, totalWidth - reserved);
};

const truncateMessage = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
};

interface ResponsiveConfig {
  messageMaxLength: number;
  abbreviateTimestamp: boolean;
  showIcons: boolean;
}

const getResponsiveConfig = (
  width: number,
  breakpoint: Breakpoint,
  options: { hasTimestamp: boolean; hasAgent: boolean; hasIcon: boolean }
): ResponsiveConfig => {
  const isNarrow = breakpoint === 'narrow';
  return {
    messageMaxLength: calculateMessageMaxLength(width, options.hasTimestamp, options.hasAgent, options.hasIcon, isNarrow),
    abbreviateTimestamp: isNarrow,
    showIcons: !isNarrow || width >= 40, // Hide icons only in extremely narrow terminals
  };
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
  displayMode?: 'normal' | 'compact' | 'verbose';
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
  filterLevel,
  width: explicitWidth,
  height: explicitHeight,
  title = 'Activity Log',
  autoScroll = true,
  displayMode = 'normal',
}: ActivityLogProps): React.ReactElement {
  // Use responsive dimensions when explicit values aren't provided
  const { width: terminalWidth, height: terminalHeight, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;
  const height = explicitHeight ?? terminalHeight;

  // Get responsive configuration
  const responsiveConfig = getResponsiveConfig(width, breakpoint, {
    hasTimestamp: showTimestamps,
    hasAgent: showAgents,
    hasIcon: true,
  });
  const [collapsed, setCollapsed] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filter, setFilter] = useState('');
  const [collapsedEntries, setCollapsedEntries] = useState(new Set<string>());

  const levelOrder = { debug: 0, info: 1, warn: 2, error: 3, success: 1 };

  // Determine effective filter level - auto-set to debug in verbose mode
  const effectiveFilterLevel = displayMode === 'verbose'
    ? (filterLevel ?? 'debug')  // If verbose, default to debug if no explicit level
    : (filterLevel ?? 'info');   // Otherwise, default to info if no explicit level

  // Filter entries based on level and search
  const filteredEntries = entries
    .filter(entry => levelOrder[entry.level] >= levelOrder[effectiveFilterLevel])
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
        <Text color="gray"> | Level: {effectiveFilterLevel}+</Text>
        {displayMode === 'verbose' && !filterLevel && (
          <Text color="cyan"> (auto: verbose)</Text>
        )}
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
                      [{formatTimestamp(entry.timestamp, displayMode !== 'verbose' && responsiveConfig.abbreviateTimestamp, displayMode === 'verbose')}]
                    </Text>
                  )}
                  {responsiveConfig.showIcons && <Text color={color}>{icon} </Text>}
                  {showAgents && entry.agent && (
                    <Text color="magenta" bold>[{entry.agent}] </Text>
                  )}
                  {entry.category && (
                    <Text color="cyan">({entry.category}) </Text>
                  )}
                  <Text color={color}>
                    {isCollapsed ? '▶ ' : ''}
                    {displayMode === 'verbose' ? entry.message : truncateMessage(entry.message, responsiveConfig.messageMaxLength)}
                  </Text>
                  {entry.duration && (
                    <Text color="gray" dimColor> ({formatDuration(entry.duration)})</Text>
                  )}
                </Box>

                {/* Expanded data */}
                {((displayMode === 'verbose' && entry.data && Object.keys(entry.data).length > 0) || (!isCollapsed && entry.data && Object.keys(entry.data).length > 0)) && (
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
  width: explicitWidth,
  height: explicitHeight,
}: LogStreamProps): React.ReactElement {
  // Use responsive dimensions when explicit values aren't provided
  const { width: terminalWidth, height: terminalHeight, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;
  const height = explicitHeight ?? terminalHeight;

  // Get responsive configuration
  const responsiveConfig = getResponsiveConfig(width, breakpoint, {
    hasTimestamp: true, // LogStream always shows timestamps
    hasAgent: true,
    hasIcon: true,
  });
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
                {formatTimestamp(entry.timestamp, responsiveConfig.abbreviateTimestamp)}
              </Text>
              {responsiveConfig.showIcons && <Text color={color}>{icon} </Text>}
              {entry.agent && (
                <Text color="magenta" bold>[{entry.agent}] </Text>
              )}
              <Text>{truncateMessage(entry.message, responsiveConfig.messageMaxLength)}</Text>
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