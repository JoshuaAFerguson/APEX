import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';

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

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
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
}: StatusBarProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 120;

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
        {segments.left.map((seg, i) => (
          <Text key={i}>
            <Text color={seg.iconColor}>{seg.icon}</Text>
            <Text color={seg.valueColor}>{seg.value}</Text>
          </Text>
        ))}
      </Box>

      <Box gap={2}>
        {segments.right.map((seg, i) => (
          <Text key={i}>
            <Text color={seg.labelColor || 'gray'}>{seg.label}</Text>
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
  labelColor?: string;
  value: string;
  valueColor: string;
  minWidth: number;
}

function buildSegments(
  props: StatusBarProps,
  elapsed: string,
  terminalWidth: number
): { left: Segment[]; right: Segment[] } {
  const left: Segment[] = [];
  const right: Segment[] = [];

  // Handle compact mode - minimal status information
  if (props.displayMode === 'compact') {
    // Show only connection status, active agent, and elapsed time
    left.push({
      icon: props.isConnected !== false ? '●' : '○',
      iconColor: props.isConnected !== false ? 'green' : 'red',
      value: '',
      valueColor: 'white',
      minWidth: 2,
    });

    if (props.agent) {
      left.push({
        value: props.agent,
        valueColor: 'white',
        minWidth: props.agent.length,
      });
    }

    right.push({
      value: elapsed,
      valueColor: 'gray',
      minWidth: 6,
    });

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
      labelColor: 'gray',
      value: props.apiUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
    });
  }

  if (props.webUrl) {
    left.push({
      label: 'web:',
      labelColor: 'gray',
      value: props.webUrl.replace('http://localhost:', ''),
      valueColor: 'green',
      minWidth: 10,
    });
  }

  // Right side segments
  right.push({
    label: '',
    value: elapsed,
    valueColor: 'gray',
    minWidth: 6,
  });

  if (props.tokens) {
    const total = props.tokens.input + props.tokens.output;
    right.push({
      label: 'tokens:',
      labelColor: 'gray',
      value: formatTokens(props.tokens.input, props.tokens.output),
      valueColor: 'cyan',
      minWidth: 14,
    });
  }

  if (props.cost !== undefined) {
    right.push({
      label: 'cost:',
      labelColor: 'gray',
      value: `$${props.cost.toFixed(4)}`,
      valueColor: 'green',
      minWidth: 12,
    });
  }

  if (props.model) {
    right.push({
      label: 'model:',
      labelColor: 'gray',
      value: props.model,
      valueColor: 'blue',
      minWidth: props.model.length + 7,
    });
  }

  // Preview mode indicator
  if (previewMode) {
    right.push({
      label: '',
      value: '📋 PREVIEW',
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
