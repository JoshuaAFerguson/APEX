# Technical Design: Responsive PreviewPanel with Adaptive Borders

## Overview

This document provides detailed technical specifications for implementing responsive borders and content adaptation in the PreviewPanel component.

## 1. Current Component Analysis

### Current Structure (PreviewPanel.tsx)
```
PreviewPanel
├── Outer Box (borderStyle="round", paddingX=2, paddingY=1)
│   ├── Header Row (justifyContent="space-between")
│   │   ├── "📋 Input Preview" (bold, cyan)
│   │   └── [on] indicator
│   │
│   ├── Input Display Row
│   │   └── Input: "user input text"
│   │
│   ├── Intent Detection Section
│   │   ├── "Detected Intent:" label
│   │   └── Inner Box (borderStyle="single", paddingX=1)
│   │       ├── Type + Confidence row
│   │       ├── Action description row
│   │       └── Agent Flow row (conditional)
│   │
│   └── Action Buttons Row
│       └── [Enter] Confirm  [Esc] Cancel  [e] Edit
```

### Width Budget Analysis (Normal 120 cols)
```
Total width: 120 cols
- Border:    2 cols (left + right)
- PaddingX:  4 cols (2 each side)
= Content:   114 cols available

Inner Intent Box:
- Inner Border: 2 cols
- Inner PaddingX: 2 cols
= Intent Content: 110 cols
```

### Width Budget Analysis (Narrow 50 cols)
```
Total width: 50 cols
- Border:    0 cols (removed)
- PaddingX:  2 cols (1 each side)
= Content:   48 cols available
```

## 2. Responsive Configuration Implementation

### TypeScript Interfaces

```typescript
// packages/cli/src/ui/components/PreviewPanel.tsx

import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions, type Breakpoint } from '../hooks/index.js';

/**
 * Border style options for responsive adaptation
 */
type BorderStyleOption = 'none' | 'single' | 'round' | 'double';

/**
 * Action button display style
 */
type ActionButtonStyle = 'full' | 'compact' | 'minimal';

/**
 * Responsive configuration for PreviewPanel layout
 */
interface ResponsivePreviewConfig {
  // === Border Configuration ===
  outerBorderStyle: BorderStyleOption;
  outerBorderColor: string;
  innerBorderStyle: BorderStyleOption;
  innerBorderColor: string;

  // === Spacing Configuration ===
  outerPaddingX: number;
  outerPaddingY: number;
  outerMarginBottom: number;
  innerPaddingX: number;
  innerPaddingY: number;
  sectionMarginY: number;

  // === Header Configuration ===
  showHeader: boolean;
  headerText: string;
  showStatusIndicator: boolean;

  // === Input Display Configuration ===
  inputLabel: string;
  inputQuoteStyle: 'double' | 'single' | 'none';
  inputMaxLength: number; // Base max, will be calculated dynamically

  // === Intent Display Configuration ===
  showIntentSectionLabel: boolean;
  intentSectionLabel: string;
  showIntentIcon: boolean;
  showIntentTypeText: boolean;
  intentTypeSuffix: string; // "Intent" or ""
  showConfidenceLabel: boolean;
  showConfidencePercentage: boolean;
  showActionLabel: boolean;
  showAgentFlow: boolean;
  agentFlowSeparator: string;

  // === Action Buttons Configuration ===
  actionButtonStyle: ActionButtonStyle;
}

/**
 * Breakpoint-specific configurations
 */
const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsivePreviewConfig> = {
  narrow: {
    // Borders - none for maximum content space
    outerBorderStyle: 'none',
    outerBorderColor: 'gray',
    innerBorderStyle: 'none',
    innerBorderColor: 'gray',

    // Spacing - minimal
    outerPaddingX: 1,
    outerPaddingY: 0,
    outerMarginBottom: 0,
    innerPaddingX: 0,
    innerPaddingY: 0,
    sectionMarginY: 0,

    // Header - hidden
    showHeader: false,
    headerText: '',
    showStatusIndicator: false,

    // Input - minimal
    inputLabel: '>',
    inputQuoteStyle: 'double',
    inputMaxLength: 35,

    // Intent - condensed
    showIntentSectionLabel: false,
    intentSectionLabel: '',
    showIntentIcon: true,
    showIntentTypeText: true,
    intentTypeSuffix: '',
    showConfidenceLabel: false,
    showConfidencePercentage: false, // Use H/M/L indicator
    showActionLabel: false,
    showAgentFlow: false,
    agentFlowSeparator: '',

    // Actions - minimal symbols
    actionButtonStyle: 'minimal',
  },

  compact: {
    // Borders - thin single border
    outerBorderStyle: 'single',
    outerBorderColor: 'gray',
    innerBorderStyle: 'none',
    innerBorderColor: 'gray',

    // Spacing - reduced
    outerPaddingX: 1,
    outerPaddingY: 0,
    outerMarginBottom: 1,
    innerPaddingX: 0,
    innerPaddingY: 0,
    sectionMarginY: 0,

    // Header - short
    showHeader: true,
    headerText: '📋 Preview',
    showStatusIndicator: true,

    // Input - moderate
    inputLabel: 'Input:',
    inputQuoteStyle: 'double',
    inputMaxLength: 55,

    // Intent - condensed inline
    showIntentSectionLabel: false,
    intentSectionLabel: '',
    showIntentIcon: true,
    showIntentTypeText: true,
    intentTypeSuffix: '',
    showConfidenceLabel: false,
    showConfidencePercentage: true,
    showActionLabel: false,
    showAgentFlow: false,
    agentFlowSeparator: '',

    // Actions - short text
    actionButtonStyle: 'compact',
  },

  normal: {
    // Borders - decorative round
    outerBorderStyle: 'round',
    outerBorderColor: 'cyan',
    innerBorderStyle: 'single',
    innerBorderColor: 'gray',

    // Spacing - standard
    outerPaddingX: 2,
    outerPaddingY: 1,
    outerMarginBottom: 1,
    innerPaddingX: 1,
    innerPaddingY: 0,
    sectionMarginY: 1,

    // Header - full
    showHeader: true,
    headerText: '📋 Input Preview',
    showStatusIndicator: true,

    // Input - full
    inputLabel: 'Input:',
    inputQuoteStyle: 'double',
    inputMaxLength: 90,

    // Intent - full display
    showIntentSectionLabel: true,
    intentSectionLabel: 'Detected Intent:',
    showIntentIcon: true,
    showIntentTypeText: true,
    intentTypeSuffix: ' Intent',
    showConfidenceLabel: true,
    showConfidencePercentage: true,
    showActionLabel: true,
    showAgentFlow: true,
    agentFlowSeparator: ' → ',

    // Actions - full text
    actionButtonStyle: 'full',
  },

  wide: {
    // Borders - enhanced decorative
    outerBorderStyle: 'double',
    outerBorderColor: 'cyan',
    innerBorderStyle: 'single',
    innerBorderColor: 'gray',

    // Spacing - generous
    outerPaddingX: 2,
    outerPaddingY: 1,
    outerMarginBottom: 1,
    innerPaddingX: 1,
    innerPaddingY: 0,
    sectionMarginY: 1,

    // Header - full
    showHeader: true,
    headerText: '📋 Input Preview',
    showStatusIndicator: true,

    // Input - extended
    inputLabel: 'Input:',
    inputQuoteStyle: 'double',
    inputMaxLength: 140,

    // Intent - full with extras
    showIntentSectionLabel: true,
    intentSectionLabel: 'Detected Intent:',
    showIntentIcon: true,
    showIntentTypeText: true,
    intentTypeSuffix: ' Intent',
    showConfidenceLabel: true,
    showConfidencePercentage: true,
    showActionLabel: true,
    showAgentFlow: true,
    agentFlowSeparator: ' → ',

    // Actions - full text with spacing
    actionButtonStyle: 'full',
  },
};
```

## 3. Helper Functions

```typescript
/**
 * Calculate actual available width for input text
 */
function calculateAvailableInputWidth(
  terminalWidth: number,
  config: ResponsivePreviewConfig
): number {
  // Border width (each side)
  const borderWidth = config.outerBorderStyle === 'none' ? 0 : 2;

  // Padding (both sides)
  const paddingWidth = config.outerPaddingX * 2;

  // Label width + space + quotes
  const labelWidth = config.inputLabel.length + 1; // label + space
  const quoteWidth = config.inputQuoteStyle === 'none' ? 0 : 2;

  const available = terminalWidth - borderWidth - paddingWidth - labelWidth - quoteWidth;

  return Math.max(15, Math.min(available, config.inputMaxLength));
}

/**
 * Smart truncation preserving word boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  // If we can break at a word boundary (at least 60% of max length)
  if (lastSpace > maxLength * 0.6) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Get intent type icon
 */
function getIntentIcon(type: string): string {
  switch (type) {
    case 'command': return '⚡';
    case 'task': return '📝';
    case 'question': return '❓';
    case 'clarification': return '💬';
    default: return '🔍';
  }
}

/**
 * Format confidence display based on config
 */
function formatConfidence(
  confidence: number,
  config: ResponsivePreviewConfig
): { text: string; color: string } {
  const percentage = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? 'green' :
                confidence >= 0.6 ? 'yellow' : 'red';

  // Minimal mode - show H/M/L indicator
  if (!config.showConfidencePercentage) {
    const indicator = percentage >= 80 ? 'H' :
                      percentage >= 60 ? 'M' : 'L';
    return { text: `[${indicator}]`, color };
  }

  // With label
  if (config.showConfidenceLabel) {
    return { text: `Confidence: ${percentage}%`, color };
  }

  // Just percentage
  return { text: `(${percentage}%)`, color };
}

/**
 * Get action description text based on config
 */
function getActionDescription(
  intent: PreviewPanelProps['intent'],
  workflow: string | undefined,
  config: ResponsivePreviewConfig
): string {
  if (!config.showActionLabel) {
    // Short form for narrow/compact
    switch (intent.type) {
      case 'command':
        return `/${intent.command}${intent.args?.length ? ' ' + intent.args.join(' ') : ''}`;
      case 'task':
        return `Create task${workflow ? ` (${workflow})` : ''}`;
      case 'question':
        return 'Answer';
      case 'clarification':
        return 'Clarify';
      default:
        return 'Process';
    }
  }

  // Full form with "Action:" label
  switch (intent.type) {
    case 'command':
      return `Action: Execute command: /${intent.command}${intent.args?.length ? ' ' + intent.args.join(' ') : ''}`;
    case 'task':
      return `Action: Create task${workflow ? ` (${workflow} workflow)` : ''}`;
    case 'question':
      return 'Action: Answer question';
    case 'clarification':
      return 'Action: Provide clarification';
    default:
      return 'Action: Process input';
  }
}

/**
 * Action button configurations
 */
interface ActionButton {
  key: string;
  keyColor: string;
  label: string;
  labelColor: string;
}

function getActionButtons(style: ActionButtonStyle): ActionButton[] {
  switch (style) {
    case 'minimal':
      return [
        { key: '[⏎]', keyColor: 'green', label: '', labelColor: 'white' },
        { key: '[⎋]', keyColor: 'red', label: '', labelColor: 'white' },
        { key: '[e]', keyColor: 'yellow', label: '', labelColor: 'white' },
      ];
    case 'compact':
      return [
        { key: '[Enter]', keyColor: 'green', label: ' OK', labelColor: 'white' },
        { key: '[Esc]', keyColor: 'red', label: ' No', labelColor: 'white' },
        { key: '[e]', keyColor: 'yellow', label: ' Edit', labelColor: 'white' },
      ];
    case 'full':
    default:
      return [
        { key: '[Enter]', keyColor: 'green', label: ' Confirm', labelColor: 'white' },
        { key: '[Esc]', keyColor: 'red', label: ' Cancel', labelColor: 'white' },
        { key: '[e]', keyColor: 'yellow', label: ' Edit', labelColor: 'white' },
      ];
  }
}

/**
 * Calculate button separator based on style
 */
function getButtonSeparator(style: ActionButtonStyle): string {
  switch (style) {
    case 'minimal': return ' ';
    case 'compact': return '  ';
    case 'full': return '    ';
  }
}
```

## 4. Component Implementation

```typescript
// Updated PreviewPanelProps
export interface PreviewPanelProps {
  input: string;
  intent: {
    type: 'command' | 'task' | 'question' | 'clarification';
    confidence: number;
    command?: string;
    args?: string[];
    metadata?: Record<string, unknown>;
  };
  workflow?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
  /** Optional explicit width for testing */
  width?: number;
}

export function PreviewPanel({
  input,
  intent,
  workflow,
  onConfirm,
  onCancel,
  onEdit,
  width: explicitWidth,
}: PreviewPanelProps): React.ReactElement {
  // Get terminal dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Get responsive configuration
  const config = useMemo(
    () => RESPONSIVE_CONFIGS[breakpoint],
    [breakpoint]
  );

  // Calculate dynamic values
  const availableInputWidth = useMemo(
    () => calculateAvailableInputWidth(width, config),
    [width, config]
  );

  const truncatedInput = useMemo(
    () => truncateText(input, availableInputWidth),
    [input, availableInputWidth]
  );

  const confidenceDisplay = useMemo(
    () => formatConfidence(intent.confidence, config),
    [intent.confidence, config]
  );

  const actionDescription = useMemo(
    () => getActionDescription(intent, workflow, config),
    [intent, workflow, config]
  );

  const actionButtons = useMemo(
    () => getActionButtons(config.actionButtonStyle),
    [config.actionButtonStyle]
  );

  const buttonSeparator = getButtonSeparator(config.actionButtonStyle);

  // Determine border style for Box component
  const outerBorderStyle = config.outerBorderStyle === 'none'
    ? undefined
    : config.outerBorderStyle;

  const innerBorderStyle = config.innerBorderStyle === 'none'
    ? undefined
    : config.innerBorderStyle;

  return (
    <Box
      flexDirection="column"
      borderStyle={outerBorderStyle}
      borderColor={config.outerBorderColor}
      paddingX={config.outerPaddingX}
      paddingY={config.outerPaddingY}
      marginBottom={config.outerMarginBottom}
    >
      {/* Header */}
      {config.showHeader && (
        <Box justifyContent="space-between" marginBottom={config.sectionMarginY}>
          <Text bold color="cyan">
            {config.headerText}
          </Text>
          {config.showStatusIndicator && (
            <Box>
              <Text color="cyan">[</Text>
              <Text color="green" bold>on</Text>
              <Text color="cyan">]</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Input display */}
      <Box marginBottom={config.sectionMarginY}>
        <Text color="gray">{config.inputLabel} </Text>
        {config.inputQuoteStyle !== 'none' && (
          <Text color="white">
            {config.inputQuoteStyle === 'double' ? '"' : "'"}
          </Text>
        )}
        <Text color="white">{truncatedInput}</Text>
        {config.inputQuoteStyle !== 'none' && (
          <Text color="white">
            {config.inputQuoteStyle === 'double' ? '"' : "'"}
          </Text>
        )}
      </Box>

      {/* Intent detection section */}
      <Box flexDirection="column" marginBottom={config.sectionMarginY}>
        {config.showIntentSectionLabel && (
          <Text color="white" bold>{config.intentSectionLabel}</Text>
        )}

        <Box
          flexDirection="column"
          borderStyle={innerBorderStyle}
          borderColor={config.innerBorderColor}
          paddingX={config.innerPaddingX}
          paddingY={config.innerPaddingY}
          marginTop={config.showIntentSectionLabel ? 1 : 0}
        >
          {/* Intent type and confidence row */}
          <Box justifyContent="space-between">
            <Box>
              {config.showIntentIcon && (
                <Text>{getIntentIcon(intent.type)} </Text>
              )}
              {config.showIntentTypeText && (
                <Text color="white">
                  {intent.type.charAt(0).toUpperCase() + intent.type.slice(1)}
                  {config.intentTypeSuffix}
                </Text>
              )}
              {!config.showConfidenceLabel && (
                <Text color={confidenceDisplay.color}>
                  {' '}{confidenceDisplay.text}
                </Text>
              )}
            </Box>
            {config.showConfidenceLabel && (
              <Text color={confidenceDisplay.color}>
                {confidenceDisplay.text}
              </Text>
            )}
          </Box>

          {/* Action description */}
          <Box>
            <Text color="gray">{actionDescription}</Text>
          </Box>

          {/* Agent flow (conditional) */}
          {config.showAgentFlow && workflow && intent.type === 'task' && (
            <Box>
              <Text color="gray">Agent Flow: </Text>
              <Text color="white">
                planner{config.agentFlowSeparator}architect{config.agentFlowSeparator}developer{config.agentFlowSeparator}tester
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Action buttons */}
      <Box>
        {actionButtons.map((button, index) => (
          <React.Fragment key={button.key}>
            <Text color={button.keyColor}>{button.key}</Text>
            <Text color={button.labelColor}>{button.label}</Text>
            {index < actionButtons.length - 1 && (
              <Text>{buttonSeparator}</Text>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
```

## 5. Visual Examples by Breakpoint

### Narrow (< 60 cols) - 50 columns
```
> "implement dark mode for..."
📝 Task [H] Create task (feature)
[⏎] [⎋] [e]
```

### Compact (60-100 cols) - 80 columns
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 Preview                                                            [on]  │
│ Input: "implement dark mode for the settings page"                          │
│ 📝 Task (85%) Create task (feature workflow)                                │
│ [Enter] OK  [Esc] No  [e] Edit                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Normal (100-160 cols) - 120 columns
```
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ 📋 Input Preview                                                                                        [on] │
│                                                                                                              │
│ Input: "implement dark mode for the settings page"                                                           │
│                                                                                                              │
│ Detected Intent:                                                                                             │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📝 Task Intent                                                                    Confidence: 85%        │ │
│ │ Action: Create task (feature workflow)                                                                   │ │
│ │ Agent Flow: planner → architect → developer → tester                                                     │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                              │
│ [Enter] Confirm    [Esc] Cancel    [e] Edit                                                                  │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Wide (>= 160 cols) - 180 columns
```
╔════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ 📋 Input Preview                                                                                                                                                            [on] ║
║                                                                                                                                                                                  ║
║ Input: "implement dark mode for the settings page with automatic system theme detection"                                                                                         ║
║                                                                                                                                                                                  ║
║ Detected Intent:                                                                                                                                                                 ║
║ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ ║
║ │ 📝 Task Intent                                                                                                                                        Confidence: 85%        │ ║
║ │ Action: Create task (feature workflow)                                                                                                                                       │ ║
║ │ Agent Flow: planner → architect → developer → tester                                                                                                                         │ ║
║ └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                                                                                                                  ║
║ [Enter] Confirm    [Esc] Cancel    [e] Edit                                                                                                                                      ║
╚════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

## 6. Test File Structure

```typescript
// packages/cli/src/ui/components/__tests__/PreviewPanel.responsive.test.tsx

import React from 'react';
import { render } from 'ink-testing-library';
import { PreviewPanel } from '../PreviewPanel.js';

// Mock useStdoutDimensions
const mockDimensions = {
  width: 120,
  height: 40,
  breakpoint: 'normal' as const,
  isNarrow: false,
  isCompact: false,
  isNormal: true,
  isWide: false,
  isAvailable: true,
};

jest.mock('../../hooks/index.js', () => ({
  useStdoutDimensions: jest.fn(() => mockDimensions),
}));

const defaultProps = {
  input: 'implement dark mode for the settings page',
  intent: {
    type: 'task' as const,
    confidence: 0.85,
  },
  workflow: 'feature',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
  onEdit: jest.fn(),
};

describe('PreviewPanel - Responsive Layout', () => {
  // Test implementations...
});
```

## 7. Migration Path

### Backward Compatibility
- All existing props work unchanged
- New `width` prop is optional
- Default behavior matches current implementation at normal breakpoint

### Testing Migration
- Existing tests need mock for `useStdoutDimensions`
- Add responsive tests incrementally
- Use explicit `width` prop for deterministic testing

## 8. Performance Considerations

- All responsive configurations are static constants (no runtime computation)
- `useMemo` used for all derived values
- No additional re-renders beyond terminal resize events
- Breakpoint comparison is O(1)
