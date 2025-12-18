import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../hooks/useStdoutDimensions.js';

// Types for abbreviated labels
type AbbreviationMode = 'full' | 'abbreviated' | 'auto';

// Mapping of full labels to their abbreviated forms
const ABBREVIATED_LABELS: Record<string, string> = {
  'tokens:': 'tok:',
  'cost:': '$',
  'model:': 'mod:',
  'active:': 'act:',
  'idle:': 'idl:',
  'stage:': 'stg:',
  'session:': 'sess:',
  'total:': 'tot:',
  'api:': 'api:',  // Already short
  'web:': 'web:',  // Already short
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

// Helper function to select appropriate label based on abbreviation mode
function getEffectiveLabel(
  segment: Segment,
  abbreviationMode: AbbreviationMode,
  terminalWidth: number
): string | undefined {
  if (!segment.label) return undefined;

  const useAbbreviated =
    abbreviationMode === 'abbreviated' ||
    (abbreviationMode === 'auto' && terminalWidth < 80);

  if (useAbbreviated && segment.abbreviatedLabel !== undefined) {
    // Empty string abbreviation means no label should be shown when abbreviated
    return segment.abbreviatedLabel === '' ? undefined : segment.abbreviatedLabel;
  }

  return segment.label;
}

// Calculate minWidth dynamically based on label mode
function calculateMinWidth(
  segment: Segment,
  useAbbreviated: boolean
): number {
  const labelLength = useAbbreviated
    ? (segment.abbreviatedLabel?.length ?? segment.label?.length ?? 0)
    : (segment.label?.length ?? 0);

  const valueLength = segment.value.length;
  const iconLength = segment.icon ? segment.icon.length + 1 : 0;

  return labelLength + valueLength + iconLength;
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
  // Calculate what fits in terminal width
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
  }, elapsed, terminalWidth);

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={terminalWidth}
      justifyContent="space-between"
    >
      <Box gap={2}>
        {segments.left.map((seg, i) => {
          // Determine abbreviation mode based on display mode
          const abbreviationMode: AbbreviationMode =
            displayMode === 'compact' ? 'abbreviated' :
            displayMode === 'verbose' ? 'full' :
            'auto';
          const effectiveLabel = getEffectiveLabel(seg, abbreviationMode, terminalWidth);
          return (
            <Text key={i}>
              <Text color={seg.iconColor}>{seg.icon}</Text>
              {effectiveLabel && <Text color={seg.labelColor || 'gray'}>{effectiveLabel}</Text>}
              <Text color={seg.valueColor}>{seg.value}</Text>
            </Text>
          );
        })}
      </Box>

      <Box gap={2}>
        {segments.right.map((seg, i) => {
          // Determine abbreviation mode based on display mode
          const abbreviationMode: AbbreviationMode =
            displayMode === 'compact' ? 'abbreviated' :
            displayMode === 'verbose' ? 'full' :
            'auto';
          const effectiveLabel = getEffectiveLabel(seg, abbreviationMode, terminalWidth);
          return (
            <Text key={i}>
              {effectiveLabel && <Text color={seg.labelColor || 'gray'}>{effectiveLabel}</Text>}
              <Text color={seg.valueColor}>{seg.value}</Text>
            </Text>
          );
        })}
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

function buildSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number,
  abbreviationMode: AbbreviationMode = 'auto'
): { left: Segment[]; right: Segment[] } {
  const left: Segment[] = [];
  const right: Segment[] = [];

  // Determine effective abbreviation mode based on display mode
  const effectiveAbbreviationMode: AbbreviationMode =
    props.displayMode === 'compact' ? 'abbreviated' :
    props.displayMode === 'verbose' ? 'full' :
    abbreviationMode;

  // Handle compact mode - minimal status information
  if (props.displayMode === 'compact') {
    // Show only connection status, git branch, and cost
    left.push({
      icon: props.isConnected !== false ? '●' : '○',
      iconColor: props.isConnected !== false ? 'green' : 'red',
      value: '',
      valueColor: 'white',
      minWidth: 2,
    });

    if (props.gitBranch) {
      left.push({
        value: props.gitBranch,
        valueColor: 'yellow',
        minWidth: props.gitBranch.length,
      });
    }

    if (props.cost !== undefined) {
      // In compact mode, just show the cost value without label since space is critical
      right.push({
        value: formatCost(props.cost),
        valueColor: 'green',
        minWidth: 8, // For "$0.0000" format
      });
    }

    return { left, right };
  }

  // Left side segments
  left.push({
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? 'green' : 'red',
    value: '',
    valueColor: 'white',
    minWidth: 2,
  });

  if (props.gitBranch) {
    left.push({
      icon: '',
      iconColor: 'cyan',
      value: props.gitBranch,
      valueColor: 'yellow',
      minWidth: props.gitBranch.length + 3,
    });
  }

  if (props.agent) {
    left.push({
      icon: '⚡',
      iconColor: 'magenta',
      value: props.agent,
      valueColor: 'white',
      minWidth: props.agent.length + 2,
    });
  }

  if (props.workflowStage) {
    left.push({
      icon: '▶',
      iconColor: 'blue',
      value: props.workflowStage,
      valueColor: 'gray',
      minWidth: props.workflowStage.length + 2,
    });
  }

  if (props.subtaskProgress && props.subtaskProgress.total > 0) {
    const { completed, total } = props.subtaskProgress;
    left.push({
      icon: '📋',
      iconColor: 'cyan',
      value: `[${completed}/${total}]`,
      valueColor: completed === total ? 'green' : 'yellow',
      minWidth: 8,
    });
  }

  if (props.sessionName) {
    left.push({
      icon: '💾',
      iconColor: 'blue',
      value: props.sessionName.length > 15 ? props.sessionName.slice(0, 12) + '...' : props.sessionName,
      valueColor: 'cyan',
      minWidth: Math.min(props.sessionName.length + 2, 17),
    });
  }

  if (props.apiUrl) {
    left.push({
      label: 'api:',
      abbreviatedLabel: 'api:',
      labelColor: 'gray',
      value: props.apiUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
    });
  }

  if (props.webUrl) {
    left.push({
      label: 'web:',
      abbreviatedLabel: 'web:',
      labelColor: 'gray',
      value: props.webUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
    });
  }

  // Right side segments - Session timer
  right.push({
    label: '',
    value: elapsed,
    valueColor: 'gray',
    minWidth: 6,
  });

  // In verbose mode, add detailed timing information
  if (props.displayMode === 'verbose' && props.detailedTiming) {
    const { totalActiveTime, totalIdleTime, currentStageElapsed } = props.detailedTiming;

    // Show active vs idle time breakdown
    if (totalActiveTime !== undefined && totalIdleTime !== undefined) {
      right.push({
        label: 'active:',
        abbreviatedLabel: 'act:',
        labelColor: 'gray',
        value: formatDetailedTime(totalActiveTime),
        valueColor: 'green',
        minWidth: 12,
      });

      right.push({
        label: 'idle:',
        abbreviatedLabel: 'idl:',
        labelColor: 'gray',
        value: formatDetailedTime(totalIdleTime),
        valueColor: 'yellow',
        minWidth: 10,
      });
    }

    // Show current stage elapsed time
    if (currentStageElapsed !== undefined && props.workflowStage) {
      right.push({
        label: 'stage:',
        abbreviatedLabel: 'stg:',
        labelColor: 'gray',
        value: formatDetailedTime(currentStageElapsed),
        valueColor: 'cyan',
        minWidth: 12,
      });
    }
  }

  if (props.tokens) {
    const total = props.tokens.input + props.tokens.output;

    // In verbose mode, show input→output breakdown
    if (props.displayMode === 'verbose') {
      right.push({
        label: 'tokens:',
        abbreviatedLabel: 'tok:',
        labelColor: 'gray',
        value: formatTokenBreakdown(props.tokens.input, props.tokens.output),
        valueColor: 'cyan',
        minWidth: 18, // Increased width for breakdown format
      });

      // Also show total for clarity in verbose mode
      right.push({
        label: 'total:',
        abbreviatedLabel: 'tot:',
        labelColor: 'gray',
        value: formatTokens(props.tokens.input, props.tokens.output),
        valueColor: 'blue',
        minWidth: 12,
      });
    } else {
      right.push({
        label: 'tokens:',
        abbreviatedLabel: 'tok:',
        labelColor: 'gray',
        value: formatTokens(props.tokens.input, props.tokens.output),
        valueColor: 'cyan',
        minWidth: 14,
      });
    }
  }

  if (props.cost !== undefined) {
    // Special handling for cost: when abbreviated, show just the value without prefix
    // since the value already has $ symbol
    const costValue = `$${props.cost.toFixed(4)}`;
    right.push({
      label: 'cost:',
      abbreviatedLabel: '', // Empty abbreviation means no label when abbreviated
      labelColor: 'gray',
      value: costValue,
      valueColor: 'green',
      minWidth: 12,
    });

    // In verbose mode, also show session cost if available and different from regular cost
    if (props.displayMode === 'verbose' && props.sessionCost !== undefined && props.sessionCost !== props.cost) {
      right.push({
        label: 'session:',
        abbreviatedLabel: 'sess:',
        labelColor: 'gray',
        value: `$${props.sessionCost.toFixed(4)}`,
        valueColor: 'yellow',
        minWidth: 14,
      });
    }
  }

  if (props.model) {
    right.push({
      label: 'model:',
      abbreviatedLabel: 'mod:',
      labelColor: 'gray',
      value: props.model,
      valueColor: 'blue',
      minWidth: props.model.length + 7,
    });
  }

  // Preview mode indicator
  if (props.previewMode) {
    right.push({
      label: '',
      value: '📋 PREVIEW',
      valueColor: 'cyan',
      minWidth: 9,
    });
  }

  // Show thoughts indicator
  if (props.showThoughts) {
    right.push({
      label: '',
      value: '💭 THOUGHTS',
      valueColor: 'magenta',
      minWidth: 10,
    });
  }

  // Verbose mode indicator
  if (props.displayMode === 'verbose') {
    right.push({
      label: '',
      value: '🔍 VERBOSE',
      valueColor: 'cyan',
      minWidth: 9,
    });
  }

  // Handle verbose mode - show all information, no filtering
  if (props.displayMode === 'verbose') {
    return { left, right };
  }

  // Filter segments based on available width (normal mode)
  const minLeftWidth = left.reduce((sum, s) => sum + s.minWidth + 1, 0);
  const minRightWidth = right.reduce((sum, s) => sum + s.minWidth + 1, 0);
  const padding = 6; // Border and spacing

  if (minLeftWidth + minRightWidth + padding > terminalWidth) {
    // Remove lower priority segments from left side
    while (left.length > 3 &&
           left.reduce((sum, s) => sum + s.minWidth + 1, 0) +
           right.reduce((sum, s) => sum + s.minWidth + 1, 0) +
           padding > terminalWidth) {
      // Remove services first, then stage, keeping branch and agent
      if (left.length > 3) {
        left.splice(left.length - 1, 1);
      }
    }
  }

  return { left, right };
}
