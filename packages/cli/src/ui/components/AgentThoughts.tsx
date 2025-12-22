import React from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';
import { CollapsibleSection } from './CollapsibleSection.js';

export interface AgentThoughtsProps {
  /** The thinking/reasoning content from the agent */
  thinking: string;

  /** Name of the agent doing the thinking */
  agent: string;

  /** Display mode for styling variations */
  displayMode?: DisplayMode;

  /** Whether to start collapsed (default: true for thoughts) */
  defaultCollapsed?: boolean;

  /** Controlled collapsed state */
  collapsed?: boolean;

  /** Callback when collapse state changes */
  onToggle?: (collapsed: boolean) => void;

  /** Maximum characters to display before truncation (default: 500) */
  maxLength?: number;

  /** Custom thinking icon (default: 💭) */
  icon?: string;

  /** Whether to use ASCII icons for terminal compatibility */
  useAsciiIcons?: boolean;
}

/**
 * AgentThoughts component for displaying agent reasoning/thinking content
 * in a collapsible, visually distinct format.
 *
 * Features:
 * - Wraps CollapsibleSection for expand/collapse functionality
 * - Always uses dimmed styling for secondary content appearance
 * - Defaults to collapsed state to reduce visual noise
 * - Supports truncation with character count display
 * - Provides thinking indicator icon with ASCII fallback
 * - Hidden in compact display mode
 */
export function AgentThoughts({
  thinking,
  agent,
  displayMode = 'normal',
  defaultCollapsed = true,
  collapsed: controlledCollapsed,
  onToggle,
  maxLength = 500,
  icon,
  useAsciiIcons = false,
}: AgentThoughtsProps): React.ReactElement {
  // Don't render in compact mode (thoughts are secondary info)
  if (displayMode === 'compact') {
    return <Box />;
  }

  // Icon selection with ASCII fallback
  const thinkingIcon = icon ?? (useAsciiIcons ? '[T]' : '💭');

  // Adjust max length based on display mode
  const effectiveMaxLength = displayMode === 'verbose' ? 1000 : maxLength;

  // Truncation logic
  const shouldTruncate = thinking.length > effectiveMaxLength;
  const displayText = shouldTruncate
    ? thinking.substring(0, effectiveMaxLength) + '...'
    : thinking;

  // Build title with icon and agent name
  const title = `${thinkingIcon} ${agent} thinking`;

  // Header extra shows truncation info if applicable
  const headerExtra = shouldTruncate ? (
    <Text color="gray" dimColor>
      ({thinking.length} chars)
    </Text>
  ) : undefined;

  return (
    <CollapsibleSection
      title={title}
      defaultCollapsed={defaultCollapsed}
      collapsed={controlledCollapsed}
      onToggle={onToggle}
      dimmed={true}  // Always dimmed for secondary content
      borderStyle="round"
      displayMode={displayMode}
      headerExtra={headerExtra}
    >
      <Text color="gray" dimColor wrap="wrap">
        {displayText}
      </Text>
    </CollapsibleSection>
  );
}

export default AgentThoughts;