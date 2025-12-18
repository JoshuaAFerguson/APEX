import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../hooks/useStdoutDimensions.js';

// Types for segment prioritization and responsive adaptation
type SegmentPriority = 'critical' | 'high' | 'medium' | 'low';
type DisplayTier = 'narrow' | 'normal' | 'wide';
type AbbreviationMode = 'full' | 'abbreviated' | 'auto';

// Priority-based filtering by display tier
const PRIORITY_BY_TIER: Record<DisplayTier, SegmentPriority[]> = {
  narrow: ['critical', 'high'],
  normal: ['critical', 'high', 'medium'],
  wide: ['critical', 'high', 'medium', 'low'],
};

// Mapping of full labels to their abbreviated forms
const LABEL_ABBREVIATIONS: Record<string, string> = {
  'tokens:': 'tk:',
  'cost:': '', // Cost shows just value with $ symbol in abbreviated mode
  'model:': 'm:',
  'active:': 'a:',
  'idle:': 'i:',
  'stage:': 's:',
  'session:': 'sess:',
  'total:': '∑:',
  'api:': '→',
  'web:': '↗',
};

// Helper functions for formatting
function formatTokens(input: number, output: number): string {
  const total = input + output;
  if (total >= 1000000) {
    return `${(total / 1000000).toFixed(1)}M`;
  } else if (total >= 1000) {
    return `${(total / 1000).toFixed(1)}k`;
  }
  return total.toString();
}

function formatTokenBreakdown(input: number, output: number): string {
  const formatValue = (val: number): string => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    } else if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return val.toString();
  };

  return `${formatValue(input)}→${formatValue(output)}`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDetailedTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}


export interface StatusBarProps {
  gitBranch?: string;
  tokens?: { input: number; output: number };
  cost?: number;
  sessionCost?: number;
  model?: string;
  agent?: string;
  workflowStage?: string;
  isConnected?: boolean;
  apiUrl?: string;
  webUrl?: string;
  sessionStartTime?: Date;
  subtaskProgress?: { completed: number; total: number };
  sessionName?: string;
  displayMode?: 'normal' | 'compact' | 'verbose';
  previewMode?: boolean;
  showThoughts?: boolean;
  // Verbose mode timing details
  detailedTiming?: {
    stageStartTime?: Date;
    totalActiveTime?: number; // milliseconds of active processing
    totalIdleTime?: number;   // milliseconds of waiting/idle
    currentStageElapsed?: number; // milliseconds in current stage
  };
}

export function StatusBar({
  gitBranch,
  tokens,
  cost,
  sessionCost,
  model,
  agent,
  workflowStage,
  isConnected = true,
  apiUrl,
  webUrl,
  sessionStartTime,
  subtaskProgress,
  sessionName,
  displayMode = 'normal',
  previewMode = false,
  showThoughts = false,
  detailedTiming,
}: StatusBarProps): React.ReactElement {
  const { width: terminalWidth, breakpoint } = useStdoutDimensions({
    breakpoints: {
      narrow: 80,    // < 80 = narrow
      compact: 100,  // 80-99 = compact
      normal: 120,   // 100-119 = normal
    },               // >= 120 = wide
    fallbackWidth: 120,
  });

  // Determine display tier based on terminal width and task requirements
  const displayTier: DisplayTier = terminalWidth < 80 ? 'narrow' :
                                  terminalWidth < 120 ? 'normal' : 'wide';

  // Session timer
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!sessionStartTime) return;

    const updateTimer = () => {
      const diff = Date.now() - sessionStartTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Build responsive segments based on terminal width and display mode
  const segments = buildSegments({
    gitBranch,
    tokens,
    cost,
    sessionCost,
    model,
    agent,
    workflowStage,
    isConnected,
    apiUrl,
    webUrl,
    sessionStartTime,
    subtaskProgress,
    sessionName,
    displayMode,
    previewMode,
    showThoughts,
    detailedTiming,
  }, elapsed, terminalWidth, displayTier);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={terminalWidth}
      justifyContent="space-between"
    >
      <Box gap={2}>
        {segments.left.map((seg, i) => (
          <Text key={i}>
            {seg.icon && <Text color={seg.iconColor}>{seg.icon}</Text>}
            {seg.label && <Text color={seg.labelColor || 'gray'}>{seg.label}</Text>}
            <Text color={seg.valueColor}>{seg.value}</Text>
          </Text>
        ))}
      </Box>

      <Box gap={2}>
        {segments.right.map((seg, i) => (
          <Text key={i}>
            {seg.label && <Text color={seg.labelColor || 'gray'}>{seg.label}</Text>}
            <Text color={seg.valueColor}>{seg.value}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

interface Segment {
  icon?: string;
  iconColor?: string;
  label?: string;
  abbreviatedLabel?: string;
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
}

// Enhanced segment interface with priority and responsive support
interface ResponsiveSegment extends Segment {
  id: string;
  priority: SegmentPriority;
  side: 'left' | 'right';
  shouldShow: boolean;
  narrowModeConfig?: {
    hideLabel?: boolean;
    hideValue?: boolean;
    compressValue?: (value: string) => string;
  };
}

function buildSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number,
  displayTier: DisplayTier
): { left: Segment[]; right: Segment[] } {
  // 1. Build all potential segments with their configurations
  const allSegments = createSegmentConfigs(props, elapsed);

  // 2. Filter by display mode (compact/normal/verbose)
  const modeFiltered = filterByDisplayMode(allSegments, props.displayMode);

  // 3. Apply responsive tier filtering (narrow/normal/wide)
  const tierFiltered = filterByTier(modeFiltered, displayTier);

  // 4. Apply abbreviations and separate by side
  const formatted = applyAbbreviations(tierFiltered, displayTier);

  // 5. Final width-based trimming (fallback safety)
  return trimToFit(formatted, terminalWidth);
}

// Create segment configurations with priority and responsive settings
function createSegmentConfigs(
  props: StatusBarProps,
  elapsed: string
): ResponsiveSegment[] {
  const segments: ResponsiveSegment[] = [];

  // Connection status - CRITICAL, always shown
  segments.push({
    id: 'connection',
    side: 'left',
    priority: 'critical',
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? 'green' : 'red',
    label: undefined,
    abbreviatedLabel: undefined,
    labelColor: undefined,
    value: '',
    valueColor: 'white',
    minWidth: 2,
    shouldShow: true,
  });

  // Git branch - HIGH priority
  if (props.gitBranch) {
    segments.push({
      id: 'gitBranch',
      side: 'left',
      priority: 'high',
      icon: '',
      iconColor: 'cyan',
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.gitBranch,
      valueColor: 'yellow',
      minWidth: props.gitBranch.length + 3,
      shouldShow: true,
      narrowModeConfig: {
        compressValue: (v) => v.length > 12 ? v.slice(0, 9) + '...' : v,
      },
    });
  }

  // Agent - HIGH priority
  if (props.agent) {
    segments.push({
      id: 'agent',
      side: 'left',
      priority: 'high',
      icon: '⚡',
      iconColor: 'magenta',
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.agent,
      valueColor: 'white',
      minWidth: props.agent.length + 2,
      shouldShow: true,
    });
  }

  // Workflow stage - MEDIUM priority
  if (props.workflowStage) {
    segments.push({
      id: 'workflowStage',
      side: 'left',
      priority: 'medium',
      icon: '▶',
      iconColor: 'blue',
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.workflowStage,
      valueColor: 'gray',
      minWidth: props.workflowStage.length + 2,
      shouldShow: true,
    });
  }

  // Subtask progress - MEDIUM priority
  if (props.subtaskProgress && props.subtaskProgress.total > 0) {
    const { completed, total } = props.subtaskProgress;
    segments.push({
      id: 'subtaskProgress',
      side: 'left',
      priority: 'medium',
      icon: '📋',
      iconColor: 'cyan',
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: `[${completed}/${total}]`,
      valueColor: completed === total ? 'green' : 'yellow',
      minWidth: 8,
      shouldShow: true,
    });
  }

  // Session name - LOW priority
  if (props.sessionName) {
    segments.push({
      id: 'sessionName',
      side: 'left',
      priority: 'low',
      icon: '💾',
      iconColor: 'blue',
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.sessionName.length > 15 ? props.sessionName.slice(0, 12) + '...' : props.sessionName,
      valueColor: 'cyan',
      minWidth: Math.min(props.sessionName.length + 2, 17),
      shouldShow: true,
    });
  }

  // API URL - LOW priority
  if (props.apiUrl) {
    segments.push({
      id: 'apiUrl',
      side: 'left',
      priority: 'low',
      icon: undefined,
      iconColor: undefined,
      label: 'api:',
      abbreviatedLabel: '→',
      labelColor: 'gray',
      value: props.apiUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
      shouldShow: true,
    });
  }

  // Web URL - LOW priority
  if (props.webUrl) {
    segments.push({
      id: 'webUrl',
      side: 'left',
      priority: 'low',
      icon: undefined,
      iconColor: undefined,
      label: 'web:',
      abbreviatedLabel: '↗',
      labelColor: 'gray',
      value: props.webUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
      shouldShow: true,
    });
  }

  // Session timer - CRITICAL, always shown
  segments.push({
    id: 'sessionTimer',
    side: 'right',
    priority: 'critical',
    icon: undefined,
    iconColor: undefined,
    label: undefined,
    abbreviatedLabel: undefined,
    labelColor: undefined,
    value: elapsed,
    valueColor: 'gray',
    minWidth: 6,
    shouldShow: true,
  });

  // Verbose mode timing details
  if (props.displayMode === 'verbose' && props.detailedTiming) {
    const { totalActiveTime, totalIdleTime, currentStageElapsed } = props.detailedTiming;

    if (totalActiveTime !== undefined && totalIdleTime !== undefined) {
      segments.push({
        id: 'activeTime',
        side: 'right',
        priority: 'medium',
        icon: undefined,
        iconColor: undefined,
        label: 'active:',
        abbreviatedLabel: 'a:',
        labelColor: 'gray',
        value: formatDetailedTime(totalActiveTime),
        valueColor: 'green',
        minWidth: 12,
        shouldShow: true,
      });

      segments.push({
        id: 'idleTime',
        side: 'right',
        priority: 'medium',
        icon: undefined,
        iconColor: undefined,
        label: 'idle:',
        abbreviatedLabel: 'i:',
        labelColor: 'gray',
        value: formatDetailedTime(totalIdleTime),
        valueColor: 'yellow',
        minWidth: 10,
        shouldShow: true,
      });
    }

    if (currentStageElapsed !== undefined && props.workflowStage) {
      segments.push({
        id: 'stageTime',
        side: 'right',
        priority: 'medium',
        icon: undefined,
        iconColor: undefined,
        label: 'stage:',
        abbreviatedLabel: 's:',
        labelColor: 'gray',
        value: formatDetailedTime(currentStageElapsed),
        valueColor: 'cyan',
        minWidth: 12,
        shouldShow: true,
      });
    }
  }

  // Tokens - MEDIUM priority
  if (props.tokens) {
    if (props.displayMode === 'verbose') {
      // In verbose mode, show input→output breakdown
      segments.push({
        id: 'tokensBreakdown',
        side: 'right',
        priority: 'medium',
        icon: undefined,
        iconColor: undefined,
        label: 'tokens:',
        abbreviatedLabel: 'tk:',
        labelColor: 'gray',
        value: formatTokenBreakdown(props.tokens.input, props.tokens.output),
        valueColor: 'cyan',
        minWidth: 18,
        shouldShow: true,
      });

      // Also show total for clarity
      segments.push({
        id: 'tokensTotal',
        side: 'right',
        priority: 'medium',
        icon: undefined,
        iconColor: undefined,
        label: 'total:',
        abbreviatedLabel: '∑:',
        labelColor: 'gray',
        value: formatTokens(props.tokens.input, props.tokens.output),
        valueColor: 'blue',
        minWidth: 12,
        shouldShow: true,
      });
    } else {
      segments.push({
        id: 'tokens',
        side: 'right',
        priority: 'medium',
        icon: undefined,
        iconColor: undefined,
        label: 'tokens:',
        abbreviatedLabel: 'tk:',
        labelColor: 'gray',
        value: formatTokens(props.tokens.input, props.tokens.output),
        valueColor: 'cyan',
        minWidth: 14,
        shouldShow: true,
      });
    }
  }

  // Cost - HIGH priority
  if (props.cost !== undefined) {
    segments.push({
      id: 'cost',
      side: 'right',
      priority: 'high',
      icon: undefined,
      iconColor: undefined,
      label: 'cost:',
      abbreviatedLabel: '', // Empty abbreviation means no label when abbreviated
      labelColor: 'gray',
      value: formatCost(props.cost),
      valueColor: 'green',
      minWidth: 12,
      shouldShow: true,
    });

    // In verbose mode, also show session cost if different
    if (props.displayMode === 'verbose' && props.sessionCost !== undefined && props.sessionCost !== props.cost) {
      segments.push({
        id: 'sessionCost',
        side: 'right',
        priority: 'low',
        icon: undefined,
        iconColor: undefined,
        label: 'session:',
        abbreviatedLabel: 'sess:',
        labelColor: 'gray',
        value: formatCost(props.sessionCost),
        valueColor: 'yellow',
        minWidth: 14,
        shouldShow: true,
      });
    }
  }

  // Model - HIGH priority
  if (props.model) {
    segments.push({
      id: 'model',
      side: 'right',
      priority: 'high',
      icon: undefined,
      iconColor: undefined,
      label: 'model:',
      abbreviatedLabel: 'm:',
      labelColor: 'gray',
      value: props.model,
      valueColor: 'blue',
      minWidth: props.model.length + 7,
      shouldShow: true,
    });
  }

  // Preview mode indicator - LOW priority
  if (props.previewMode) {
    segments.push({
      id: 'previewMode',
      side: 'right',
      priority: 'low',
      icon: undefined,
      iconColor: undefined,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: '📋 PREVIEW',
      valueColor: 'cyan',
      minWidth: 9,
      shouldShow: true,
    });
  }

  // Show thoughts indicator - LOW priority
  if (props.showThoughts) {
    segments.push({
      id: 'showThoughts',
      side: 'right',
      priority: 'low',
      icon: undefined,
      iconColor: undefined,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: '💭 THOUGHTS',
      valueColor: 'magenta',
      minWidth: 10,
      shouldShow: true,
    });
  }

  // Verbose mode indicator - LOW priority
  if (props.displayMode === 'verbose') {
    segments.push({
      id: 'verboseMode',
      side: 'right',
      priority: 'low',
      icon: undefined,
      iconColor: undefined,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: '🔍 VERBOSE',
      valueColor: 'cyan',
      minWidth: 9,
      shouldShow: true,
    });
  }

  return segments;
}

// Filter segments by display mode
function filterByDisplayMode(
  segments: ResponsiveSegment[],
  displayMode: 'normal' | 'compact' | 'verbose'
): ResponsiveSegment[] {
  if (displayMode === 'compact') {
    // In compact mode, show only connection, git branch, and cost
    return segments.filter(s =>
      s.id === 'connection' ||
      s.id === 'gitBranch' ||
      s.id === 'cost'
    );
  }

  // In verbose mode, show all segments
  if (displayMode === 'verbose') {
    return segments;
  }

  // In normal mode, exclude verbose-only timing details
  return segments.filter(s =>
    s.id !== 'activeTime' &&
    s.id !== 'idleTime' &&
    s.id !== 'stageTime' &&
    s.id !== 'tokensBreakdown' &&
    s.id !== 'tokensTotal' &&
    s.id !== 'sessionCost'
  );
}

// Filter segments by display tier based on priority
function filterByTier(
  segments: ResponsiveSegment[],
  tier: DisplayTier
): ResponsiveSegment[] {
  const allowedPriorities = PRIORITY_BY_TIER[tier];
  return segments.filter(s => allowedPriorities.includes(s.priority));
}

// Apply abbreviations and separate segments by side
function applyAbbreviations(
  segments: ResponsiveSegment[],
  tier: DisplayTier
): { left: Segment[]; right: Segment[] } {
  const useAbbrev = tier === 'narrow';
  const left: Segment[] = [];
  const right: Segment[] = [];

  segments.forEach(config => {
    let effectiveLabel: string | undefined = config.label;
    let effectiveValue = config.value;

    if (useAbbrev) {
      // Use abbreviated label if available
      if (config.abbreviatedLabel !== undefined) {
        effectiveLabel = config.abbreviatedLabel === '' ? undefined : config.abbreviatedLabel;
      }

      // Apply value compression if available
      if (config.narrowModeConfig?.compressValue) {
        effectiveValue = config.narrowModeConfig.compressValue(config.value);
      }
    }

    const segment: Segment = {
      icon: config.icon,
      iconColor: config.iconColor,
      label: effectiveLabel,
      abbreviatedLabel: config.abbreviatedLabel,
      labelColor: config.labelColor,
      value: effectiveValue,
      valueColor: config.valueColor,
      minWidth: config.minWidth,
    };

    // Add to the appropriate side
    if (config.side === 'left') {
      left.push(segment);
    } else {
      right.push(segment);
    }
  });

  return { left, right };
}

// Final fallback width-based trimming
function trimToFit(
  segments: { left: Segment[]; right: Segment[] },
  terminalWidth: number
): { left: Segment[]; right: Segment[] } {
  // Calculate current width usage
  const leftWidth = segments.left.reduce((sum, s) => sum + s.minWidth + 1, 0);
  const rightWidth = segments.right.reduce((sum, s) => sum + s.minWidth + 1, 0);
  const padding = 6; // Border and spacing
  const totalWidth = leftWidth + rightWidth + padding;

  // If it fits, return as-is
  if (totalWidth <= terminalWidth) {
    return segments;
  }

  // Otherwise, progressively remove lower priority segments
  // For simplicity, remove from the end of each side (lower priority typically appears later)
  const left = [...segments.left];
  const right = [...segments.right];

  while (left.length + right.length > 2) {
    const currentLeftWidth = left.reduce((sum, s) => sum + s.minWidth + 1, 0);
    const currentRightWidth = right.reduce((sum, s) => sum + s.minWidth + 1, 0);
    const currentTotal = currentLeftWidth + currentRightWidth + padding;

    if (currentTotal <= terminalWidth) {
      break;
    }

    // Remove from left side if it has more segments, otherwise from right
    if (left.length > right.length && left.length > 1) {
      left.pop();
    } else if (right.length > 1) {
      right.pop();
    } else if (left.length > 1) {
      left.pop();
    } else {
      break; // Can't remove any more
    }
  }

  return { left, right };
}
