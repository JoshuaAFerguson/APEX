/**
 * PanelStateStatus component - Displays terminal accessibility status text for panel states
 *
 * Provides ARIA-equivalent feedback in terminal environments by showing bracketed status
 * text (e.g., '[minimized]', '[maximized]', '[normal]') based on panel state and display
 * conditions. Follows terminal accessibility conventions for non-visual feedback.
 *
 * Features:
 * - Conditional visibility based on displayMode and focused state
 * - Standard terminal status text formatting with brackets
 * - Accessible color scheme with dimmed text
 * - Support for manual visibility override
 *
 * @packageDocumentation
 */

import React from 'react';
import { Text } from 'ink';
import { useThemeColors } from '../../context/ThemeContext.js';
import {
  type PanelState,
  type TerminalPanelDisplayMode,
  type StatusTextVisibility,
  getPanelStateStatusText,
  shouldShowStatusText,
} from './AgentTerminalPanel.types.js';

/**
 * Props for the PanelStateStatus component
 */
export interface PanelStateStatusProps {
  /**
   * Current panel state to display
   */
  panelState: PanelState;

  /**
   * Current display mode affecting visibility
   */
  displayMode: TerminalPanelDisplayMode;

  /**
   * Whether the panel is focused
   */
  focused: boolean;

  /**
   * Override visibility behavior
   * - 'auto': Use displayMode/focused logic (default)
   * - 'always': Always show status text
   * - 'never': Never show status text
   * @default 'auto'
   */
  visibility?: StatusTextVisibility;

  /**
   * Test ID for testing purposes
   */
  testId?: string;
}

/**
 * Renders terminal accessibility status text for panel states
 *
 * Displays bracketed status text (e.g., '[minimized]') based on panel state
 * and visibility conditions. Follows terminal conventions for accessible
 * state feedback in CLI environments.
 *
 * @param props - Component props
 * @returns Status text element or null if not visible
 */
export function PanelStateStatus({
  panelState,
  displayMode,
  focused,
  visibility = 'auto',
  testId,
}: PanelStateStatusProps): React.ReactElement | null {
  const colors = useThemeColors();

  // Calculate visibility based on conditions
  const isVisible =
    visibility === 'always' ||
    (visibility === 'auto' && shouldShowStatusText({
      displayMode,
      focused,
      panelState,
    }));

  if (!isVisible) {
    return null;
  }

  const statusText = getPanelStateStatusText(panelState);

  return (
    <Text
      dimColor
      color={colors.textMuted}
      data-testid={testId}
    >
      {statusText}
    </Text>
  );
}

/**
 * Export types for external use
 * Note: Type is already exported inline above, no need to re-export
 */