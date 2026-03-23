/**
 * AgentTerminalPanel component - Terminal-optimized panel for displaying agent execution status
 *
 * Displays agent execution information with integrated status indicators, progress bars,
 * and responsive layout for terminal environments. Provides clear visual feedback about
 * agent state including idle, active, and error conditions.
 *
 * Features:
 * - AgentStatusIndicator integration in header
 * - Agent name and stage display
 * - Progress bars and elapsed time
 * - Responsive configuration based on terminal width
 * - Visual state management for different execution statuses
 * - Keyboard accessibility and focus management
 * - Terminal-compatible animations and borders
 *
 * @packageDocumentation
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../../hooks/useStdoutDimensions.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { useThemeColors } from '../../context/ThemeContext.js';
import { AgentStatusIndicator } from './AgentStatusIndicator.js';
import { ProgressBar } from '../ProgressIndicators.js';
import {
  type AgentTerminalPanelProps,
  type AgentExecution,
  type ProcessedExecutionData,
  DEFAULT_TERMINAL_PANEL_PROPS,
  getResponsiveTerminalPanelConfig,
  processExecutionData,
  getExecutionVisualState,
  mapExecutionStatusToAgentStatus,
} from './AgentTerminalPanel.types.js';

/**
 * Custom hook to process execution data for display
 */
function useProcessedExecutionData(
  execution: AgentExecution
): ProcessedExecutionData & { elapsedTime: string } {
  const { breakpoint } = useStdoutDimensions();
  const config = useMemo(() => getResponsiveTerminalPanelConfig(breakpoint), [breakpoint]);
  const elapsedTime = useElapsedTime(execution.startedAt);

  const processedData = useMemo(
    () => processExecutionData(execution, config),
    [execution, config]
  );

  return {
    ...processedData,
    elapsedTime: config.showElapsedTime ? elapsedTime : '',
  };
}

/**
 * Renders the header section with status indicator and agent name
 */
function HeaderSection({
  execution,
  displayName,
  visualState,
  indicatorStatus,
  focused,
  animated,
  onSelect,
}: {
  execution: AgentExecution;
  displayName: string;
  visualState: any;
  indicatorStatus: any;
  focused: boolean;
  animated: boolean;
  onSelect?: (execution: AgentExecution) => void;
}) {
  const colors = useThemeColors();

  const handleClick = React.useCallback(() => {
    onSelect?.(execution);
  }, [onSelect, execution]);

  return (
    <Box alignItems="center" gap={1}>
      <AgentStatusIndicator
        status={indicatorStatus}
        size="medium"
        animated={animated}
      />
      <Text
        color={visualState.nameColor === 'white' ? colors.text : colors[visualState.nameColor] || visualState.nameColor}
        bold={focused && execution.status === 'running'}
      >
        {displayName}
      </Text>
    </Box>
  );
}

/**
 * Renders the stage and elapsed time information
 */
function InfoSection({
  displayStage,
  elapsedTime,
  visualState,
  config,
}: {
  displayStage: string | null;
  elapsedTime: string;
  visualState: any;
  config: any;
}) {
  const colors = useThemeColors();

  if (!config.showStage && !config.showElapsedTime) {
    return null;
  }

  return (
    <Box alignItems="center" gap={1}>
      {config.showStage && displayStage && (
        <Text
          color={visualState.stageColor === 'white' ? colors.text : colors[visualState.stageColor] || visualState.stageColor}
          dimColor={visualState.stageColor === 'gray'}
        >
          {displayStage}
        </Text>
      )}
      {config.showElapsedTime && elapsedTime && (
        <Text color={colors.textMuted} dimColor>
          {elapsedTime}
        </Text>
      )}
    </Box>
  );
}

/**
 * Renders the progress bar section
 */
function ProgressSection({
  execution,
  config,
  visualState,
}: {
  execution: AgentExecution;
  config: any;
  visualState: any;
}) {
  const colors = useThemeColors();

  if (!config.showProgress || config.progressBarWidth === 0) {
    return null;
  }

  const progressColor = execution.status === 'running' ? 'cyan' :
                       execution.status === 'completed' ? 'green' :
                       execution.status === 'failed' ? 'red' : 'gray';

  return (
    <Box marginTop={1}>
      <ProgressBar
        progress={execution.progress}
        width={config.progressBarWidth}
        color={progressColor}
        showPercentage={config.progressBarWidth >= 20}
      />
    </Box>
  );
}

/**
 * Renders error message if present
 */
function ErrorSection({
  errorMessage,
  config,
}: {
  errorMessage: string | null;
  config: any;
}) {
  const colors = useThemeColors();

  if (!config.showError || !errorMessage) {
    return null;
  }

  return (
    <Box marginTop={1}>
      <Text color={colors.error}>
        ⚠ {errorMessage}
      </Text>
    </Box>
  );
}

/**
 * Renders border around the panel content
 */
function BorderWrapper({
  children,
  showBorder,
  borderStyle,
  borderColor,
  focused,
  visualState,
}: {
  children: React.ReactNode;
  showBorder: boolean;
  borderStyle: string;
  borderColor?: string;
  focused: boolean;
  visualState: any;
}) {
  const colors = useThemeColors();

  if (!showBorder) {
    return <>{children}</>;
  }

  const effectiveBorderColor = borderColor ||
    (focused ? visualState.focusedBorderColor : visualState.unfocusedBorderColor);

  const color = effectiveBorderColor === 'white' ? colors.text :
               colors[effectiveBorderColor] || effectiveBorderColor;

  const borderChars = {
    single: { horizontal: '─', vertical: '│', topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘' },
    round: { horizontal: '─', vertical: '│', topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯' },
    double: { horizontal: '═', vertical: '║', topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝' },
  };

  const chars = borderChars[borderStyle as keyof typeof borderChars] || borderChars.single;

  return (
    <Box borderStyle={borderStyle as any} borderColor={color} paddingX={1} paddingY={0}>
      {children}
    </Box>
  );
}

/**
 * Main AgentTerminalPanel component
 *
 * Displays agent execution information in a terminal-optimized format with
 * integrated status indicators, progress tracking, and responsive layout.
 *
 * @param props - Component props
 * @returns Rendered terminal panel
 */
export function AgentTerminalPanel({
  execution,
  displayMode = DEFAULT_TERMINAL_PANEL_PROPS.displayMode,
  focused = DEFAULT_TERMINAL_PANEL_PROPS.focused,
  animated = DEFAULT_TERMINAL_PANEL_PROPS.animated,
  width,
  borderStyle = DEFAULT_TERMINAL_PANEL_PROPS.borderStyle,
  borderColor,
  showElapsedTime = DEFAULT_TERMINAL_PANEL_PROPS.showElapsedTime,
  showProgress = DEFAULT_TERMINAL_PANEL_PROPS.showProgress,
  onSelect,
  testId,
}: AgentTerminalPanelProps): React.ReactElement {
  // Process execution data for display
  const processedData = useProcessedExecutionData(execution);
  const { breakpoint } = useStdoutDimensions();
  const config = useMemo(() => getResponsiveTerminalPanelConfig(breakpoint), [breakpoint]);

  // Override config with explicit props
  const effectiveConfig = useMemo(() => ({
    ...config,
    showElapsedTime: showElapsedTime && config.showElapsedTime,
    showProgress: showProgress && config.showProgress,
  }), [config, showElapsedTime, showProgress]);

  // Apply display mode adjustments
  const modeConfig = useMemo(() => {
    if (displayMode === 'compact') {
      return {
        ...effectiveConfig,
        showProgress: false,
        progressBarWidth: 0,
        maxNameLength: Math.min(effectiveConfig.maxNameLength, 16),
      };
    } else if (displayMode === 'verbose') {
      return {
        ...effectiveConfig,
        showProgress: true,
        showStage: true,
        showElapsedTime: true,
        showError: true,
        maxNameLength: Math.max(effectiveConfig.maxNameLength, 24),
      };
    }
    return effectiveConfig;
  }, [effectiveConfig, displayMode]);

  const {
    displayName,
    displayStage,
    elapsedTime,
    errorMessage,
    indicatorStatus,
    visualState,
  } = processedData;

  // Handle panel selection
  const handleSelect = React.useCallback(() => {
    onSelect?.(execution);
  }, [onSelect, execution]);

  // Main content
  const content = (
    <Box flexDirection="column" gap={0}>
      {/* Header with status indicator and agent name */}
      <HeaderSection
        execution={execution}
        displayName={displayName}
        visualState={visualState}
        indicatorStatus={indicatorStatus}
        focused={focused}
        animated={animated}
        onSelect={onSelect}
      />

      {/* Stage and elapsed time info */}
      <InfoSection
        displayStage={displayStage}
        elapsedTime={elapsedTime}
        visualState={visualState}
        config={modeConfig}
      />

      {/* Progress bar */}
      <ProgressSection
        execution={execution}
        config={modeConfig}
        visualState={visualState}
      />

      {/* Error message */}
      <ErrorSection
        errorMessage={errorMessage}
        config={modeConfig}
      />
    </Box>
  );

  // Wrap with border if needed
  const panelContent = (
    <BorderWrapper
      showBorder={modeConfig.showBorder && borderStyle !== 'none'}
      borderStyle={borderStyle}
      borderColor={borderColor}
      focused={focused}
      visualState={visualState}
    >
      {content}
    </BorderWrapper>
  );

  // Note: Ink Box doesn't support onClick directly
  // Selection handling would need to be implemented at a higher level
  // This is a display-only component
  return (
    <Box data-testid={testId}>
      {panelContent}
    </Box>
  );
}

/**
 * Export default props for external use
 */
export const defaultProps = DEFAULT_TERMINAL_PANEL_PROPS;

/**
 * Re-export types for convenience
 */
export type {
  AgentTerminalPanelProps,
  AgentExecution,
  AgentExecutionStatus,
  TerminalPanelDisplayMode,
  TerminalPanelBorderStyle,
  ResponsiveTerminalPanelConfig,
  ExecutionVisualState,
  ProcessedExecutionData,
} from './AgentTerminalPanel.types.js';