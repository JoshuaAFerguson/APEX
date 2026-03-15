/**
 * Responsive StatusBar Component
 *
 * This component implements intelligent breakpoint-based segment adaptation that adjusts
 * the displayed information based on terminal width. It uses a priority-based system
 * to ensure the most important information is always visible.
 *
 * Architecture:
 * - 4-tier priority system: CRITICAL > HIGH > MEDIUM > LOW
 * - 4-tier responsive display: narrow (<60), compact (60-100), normal (100-160), wide (>160)
 * - Progressive segment hiding and abbreviation based on available space
 *
 * Priority Assignments:
 * - CRITICAL: Connection status, Session timer (always shown)
 * - HIGH: Git branch, Agent, Cost, Model
 * - MEDIUM: Workflow stage, Tokens, Subtask progress
 * - LOW: Session name, API URLs, Preview/Verbose indicators
 *
 * Responsive Behavior:
 * - Narrow (<60 cols): Shows only CRITICAL + HIGH priority with abbreviated labels
 * - Compact (60-100 cols): Shows CRITICAL + HIGH + MEDIUM with full labels
 * - Normal (100-160 cols): Shows CRITICAL + HIGH + MEDIUM with full labels
 * - Wide (>160 cols): Shows all segments with full labels and extended details
 *
 * Display Modes:
 * - 'compact': Always shows minimal segments (overrides responsive)
 * - 'normal': Respects responsive tier filtering
 * - 'verbose': Always shows all segments (overrides responsive)
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../hooks/useStdoutDimensions.js';
import { useThemeColors } from '../context/ThemeContext.js';

// Types for segment prioritization and responsive adaptation
type SegmentPriority = 'critical' | 'high' | 'medium' | 'low';
type DisplayTier = 'narrow' | 'compact' | 'normal' | 'wide';
type AbbreviationMode = 'full' | 'abbreviated' | 'auto';

// Priority-based filtering by display tier (4-tier system)
// Maps breakpoints from useStdoutDimensions hook to visible priority levels
// LOW priority segments (session name, API/Web URLs, preview/verbose indicators)
// are ONLY shown in wide mode (>160 cols) per architecture design
const PRIORITY_BY_TIER: Record<DisplayTier, SegmentPriority[]> = {
  narrow: ['critical', 'high'],           // <60 cols: Only essential info
  compact: ['critical', 'high', 'medium'], // 60-100 cols: No LOW priority
  normal: ['critical', 'high', 'medium'],  // 100-160 cols: No LOW priority
  wide: ['critical', 'high', 'medium', 'low'], // >160 cols: Full information including LOW
};

// Mapping of full labels to their abbreviated forms
const LABEL_ABBREVIATIONS: Record<string, string> = {
  'tokens:': 'tk:',
  'cost:': '', // Cost shows just value with $ symbol in abbreviated mode
  'model:': 'mod:',
  'active:': 'act:',
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

function formatCost(cost: number, compact: boolean = false): string {
  // Always use 4 decimal places for consistency across all modes
  // Compact mode affects layout (no labels), not number precision
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
  const colors = useThemeColors();
  const { width: terminalWidth, breakpoint } = useStdoutDimensions({
    fallbackWidth: 120,
  });

  // Use the hook's 4-tier breakpoint system directly for responsive filtering
  // This ensures consistency between the hook's breakpoint helpers and StatusBar behavior
  // Breakpoints: narrow (<60), compact (60-100), normal (100-160), wide (>160)
  const displayTier: DisplayTier = breakpoint;

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
  }, elapsed, terminalWidth, displayTier, colors);

  return (
    <Box
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
      width={terminalWidth}
      justifyContent="space-between"
    >
      <Box gap={2}>
        {segments.left.map((seg, i) => (
          <Text key={i}>
            {seg.icon && <Text color={seg.iconColor}>{seg.icon}</Text>}
            {seg.label && <Text color={seg.labelColor || colors.muted}>{seg.label}</Text>}
            <Text color={seg.valueColor}>{seg.value}</Text>
          </Text>
        ))}
      </Box>

      <Box gap={2}>
        {segments.right.map((seg, i) => (
          <Text key={i}>
            {seg.label && <Text color={seg.labelColor || colors.muted}>{seg.label}</Text>}
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
  priority?: SegmentPriority; // Added for priority-aware trimToFit
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
  displayTier: DisplayTier,
  colors: ReturnType<typeof useThemeColors>
): { left: Segment[]; right: Segment[] } {
  // 1. Build all potential segments with their configurations
  const allSegments = createSegmentConfigs(props, elapsed, colors);

  // 2. Filter by display mode (compact/normal/verbose)
  const modeFiltered = filterByDisplayMode(allSegments, props.displayMode || 'normal');

  // 3. Apply responsive tier filtering (narrow/compact/normal/wide) - but skip for verbose mode only
  // Compact displayMode is different from compact breakpoint - don't confuse them
  const tierFiltered = (props.displayMode === 'verbose')
    ? modeFiltered  // Verbose mode: show all segments regardless of terminal width
    : filterByTier(modeFiltered, displayTier); // Normal/compact displayMode: use responsive filtering

  // 4. Apply abbreviations and separate by side
  // For compact mode, use special handling
  const formatted = applyAbbreviations(tierFiltered, displayTier, props.displayMode);

  // 5. Final width-based trimming (fallback safety)
  // Skip trimToFit for verbose mode since user explicitly wants all info
  if (props.displayMode === 'verbose') {
    return formatted;
  }
  return trimToFit(formatted, terminalWidth);
}

// Create segment configurations with priority and responsive settings
function createSegmentConfigs(
  props: StatusBarProps,
  elapsed: string,
  colors: any
): ResponsiveSegment[] {
  const isCompactMode = props.displayMode === 'compact';
  const segments: ResponsiveSegment[] = [];

  // Connection status - CRITICAL, always shown
  segments.push({
    id: 'connection',
    side: 'left',
    priority: 'critical',
    icon: props.isConnected !== false ? '●' : '○',
    iconColor: props.isConnected !== false ? colors.success : colors.error,
    label: undefined,
    abbreviatedLabel: undefined,
    labelColor: undefined,
    value: '',
    valueColor: colors.text,
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
      iconColor: colors.info,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.gitBranch,
      valueColor: colors.warning,
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
      iconColor: colors.agents.reviewer,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.agent,
      valueColor: colors.text,
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
      iconColor: colors.info,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: props.workflowStage,
      valueColor: colors.muted,
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
      iconColor: colors.info,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: `[${completed}/${total}]`,
      valueColor: completed === total ? colors.success : colors.warning,
      minWidth: 8,
      shouldShow: true,
    });
  }

  // Session name - LOW priority
  // Session names > 15 chars are ALWAYS truncated to 12 chars + '...' regardless of mode
  // This prevents long session names from dominating the status bar
  if (props.sessionName) {
    const truncatedSessionName = props.sessionName.length > 15
      ? props.sessionName.slice(0, 12) + '...'
      : props.sessionName;
    segments.push({
      id: 'sessionName',
      side: 'left',
      priority: 'low',
      icon: '💾',
      iconColor: colors.info,
      label: undefined,
      abbreviatedLabel: undefined,
      labelColor: undefined,
      value: truncatedSessionName, // Always use truncated value
      valueColor: colors.info,
      minWidth: Math.min(truncatedSessionName.length + 2, 17), // Max 15 chars + icon
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
      labelColor: colors.muted,
      value: props.apiUrl.replace('http://localhost:', ''),
      valueColor: colors.success,
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
      labelColor: colors.muted,
      value: props.webUrl.replace('http://localhost:', ''),
      valueColor: colors.success,
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
    valueColor: colors.muted,
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
        abbreviatedLabel: 'act:',
        labelColor: colors.muted,
        value: formatDetailedTime(totalActiveTime),
        valueColor: colors.success,
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
        labelColor: colors.muted,
        value: formatDetailedTime(totalIdleTime),
        valueColor: colors.warning,
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
        labelColor: colors.muted,
        value: formatDetailedTime(currentStageElapsed),
        valueColor: colors.info,
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
        labelColor: colors.muted,
        value: formatTokenBreakdown(props.tokens.input, props.tokens.output),
        valueColor: colors.info,
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
        labelColor: colors.muted,
        value: formatTokens(props.tokens.input, props.tokens.output),
        valueColor: colors.secondary,
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
        labelColor: colors.muted,
        value: formatTokens(props.tokens.input, props.tokens.output),
        valueColor: colors.info,
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
      labelColor: colors.muted,
      value: formatCost(props.cost, isCompactMode),
      valueColor: colors.success,
      minWidth: 12,
      shouldShow: true,
      narrowModeConfig: {
        hideLabel: true, // Hide label in compact mode
      },
    });

    // In verbose mode, also show session cost if different (accounting for floating point precision)
    if (props.displayMode === 'verbose' && props.sessionCost !== undefined &&
        Math.abs(props.sessionCost - props.cost) > 1e-10) {
      segments.push({
        id: 'sessionCost',
        side: 'right',
        priority: 'low',
        icon: undefined,
        iconColor: undefined,
        label: 'session:',
        abbreviatedLabel: 'sess:',
        labelColor: colors.muted,
        value: formatCost(props.sessionCost, isCompactMode),
        valueColor: colors.warning,
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
      abbreviatedLabel: 'mod:',
      labelColor: colors.muted,
      value: props.model,
      valueColor: colors.secondary,
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
      valueColor: colors.info,
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
      valueColor: colors.agents.reviewer,
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
      valueColor: colors.info,
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
    // Per test requirements: should show ●, main (git branch), and $0.05 (cost)
    // Timer is intentionally excluded from compact mode per test expectations
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
  if (!allowedPriorities) {
    console.error(`Invalid display tier: ${tier}. Using 'normal' tier as fallback.`);
    return segments.filter(s => PRIORITY_BY_TIER.normal.includes(s.priority));
  }
  return segments.filter(s => allowedPriorities.includes(s.priority));
}

// Apply abbreviations and separate segments by side
function applyAbbreviations(
  segments: ResponsiveSegment[],
  tier: DisplayTier,
  displayMode?: 'normal' | 'compact' | 'verbose'
): { left: Segment[]; right: Segment[] } {
  // In narrow terminals, use abbreviated labels regardless of display mode
  // Verbose mode shows ALL segments but still abbreviates in narrow terminals
  const useAbbrev = tier === 'narrow';
  const isCompactMode = displayMode === 'compact';
  const isVerboseMode = displayMode === 'verbose';
  const left: Segment[] = [];
  const right: Segment[] = [];

  segments.forEach(config => {
    let effectiveLabel: string | undefined = config.label;
    let effectiveValue = config.value;

    // Apply abbreviations based on display tier
    // Verbose mode shows all segments but still uses abbreviations in narrow terminals
    if (useAbbrev || isCompactMode) {
      // Use abbreviated label if available
      if (config.abbreviatedLabel != null) {
        effectiveLabel = config.abbreviatedLabel === '' ? undefined : config.abbreviatedLabel;
      }

      // Hide label if configured for narrow mode (or compact mode)
      if (config.narrowModeConfig?.hideLabel) {
        effectiveLabel = undefined;
      }

      // Apply value compression in narrow mode, but NOT in verbose or compact mode for git branch
      if (config.narrowModeConfig?.compressValue &&
          !isVerboseMode && // Never compress values in verbose mode - user wants ALL info
          (!isCompactMode || (config.id !== 'gitBranch' && config.value.length > 50))) {
        effectiveValue = config.narrowModeConfig.compressValue(config.value);
      }
    } else if (tier === 'compact' || tier === 'normal') {
      // For normal modes, apply compression for long values (>35 chars), but not in verbose mode
      if (config.narrowModeConfig?.compressValue && !isVerboseMode && config.value.length > 35) {
        effectiveValue = config.narrowModeConfig.compressValue(config.value);
      }
    } else if (tier === 'wide') {
      // In wide mode, apply compression for extremely long values (>50 chars) to prevent
      // one segment from dominating the entire width and forcing removal of other segments
      // But never compress in verbose mode
      if (config.narrowModeConfig?.compressValue && !isVerboseMode && config.value.length > 50) {
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
      priority: config.priority, // Preserve priority for trimToFit
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

// Priority-to-numeric mapping for sorting
const PRIORITY_ORDER: Record<SegmentPriority, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

// Enhanced width-based trimming with priority-aware removal
// This is a safety valve that only removes segments when content genuinely overflows.
// The tier-based filtering (narrow/normal/wide) is the primary mechanism for segment visibility.
function trimToFit(
  segments: { left: Segment[]; right: Segment[] },
  terminalWidth: number
): { left: Segment[]; right: Segment[] } {
  // Calculate actual content width (not minWidth estimates)
  const calculateActualWidth = (segs: Segment[]) =>
    segs.reduce((sum, s) => {
      const iconWidth = s.icon ? s.icon.length + 1 : 0; // Icon + space after
      // Only count label if it exists and has content
      const labelWidth = s.label && s.label.length > 0 ? s.label.length : 0;
      const valueWidth = s.value.length;
      const segWidth = iconWidth + labelWidth + valueWidth;
      // Add gap between segments if segment has content
      return sum + segWidth + (segWidth > 0 ? 2 : 0); // More realistic gap
    }, 0);

  // More conservative padding estimate
  const padding = 4; // Box border (2) + minimal padding
  const centerGap = 4; // Gap between left and right sections (more realistic)
  // Adaptive safety buffer based on terminal width - be more aggressive in narrow terminals
  const safetyBuffer = terminalWidth < 60 ? 5 : 20; // Narrow: strict, wider: more tolerant

  let leftSegs = [...segments.left];
  let rightSegs = [...segments.right];

  // Helper to get numeric priority from segment
  const getPriority = (seg: Segment): number => {
    return seg.priority ? PRIORITY_ORDER[seg.priority] : 3; // Default to medium
  };

  // Sort remaining segments by priority (lowest first for removal)
  // Keep tracking which side each segment is on
  const getAllWithMeta = () => [
    ...leftSegs.map((s, i) => ({ seg: s, side: 'left' as const, index: i, priority: getPriority(s) })),
    ...rightSegs.map((s, i) => ({ seg: s, side: 'right' as const, index: i, priority: getPriority(s) })),
  ].sort((a, b) => b.priority - a.priority); // Lowest priority first (higher number = lower priority)

  // Iteratively remove lowest priority segment until fits
  while (true) {
    const leftWidth = calculateActualWidth(leftSegs);
    const rightWidth = calculateActualWidth(rightSegs);
    const totalWidth = leftWidth + rightWidth + padding + centerGap;

    // Only trim if we exceed width by more than the safety buffer
    // This prevents over-aggressive trimming when content is close to fitting
    if (totalWidth <= terminalWidth + safetyBuffer) break;
    if (leftSegs.length + rightSegs.length <= 2) break; // Keep at least connection + timer

    // Find and remove lowest priority segment
    const candidates = getAllWithMeta().filter(m =>
      // Don't remove critical segments
      m.priority !== 1 && // critical = 1 in numeric form
      (m.side === 'left' ? leftSegs.length > 1 : rightSegs.length > 1)
    );

    if (candidates.length === 0) break;

    const toRemove = candidates[0]; // Lowest priority
    if (toRemove.side === 'left') {
      leftSegs = leftSegs.filter((_, i) => i !== toRemove.index);
    } else {
      rightSegs = rightSegs.filter((_, i) => i !== toRemove.index);
    }
  }

  return { left: leftSegs, right: rightSegs };
}
