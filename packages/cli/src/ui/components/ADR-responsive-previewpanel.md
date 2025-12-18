# ADR: Responsive PreviewPanel with Adaptive Borders and Content

## Status
Proposed

## Context

The `PreviewPanel` component needs to be enhanced with responsive layout capabilities using the `useStdoutDimensions` hook. This follows the established pattern used by other components in the codebase (StatusBar, TaskProgress, ActivityLog, AgentPanel).

### Acceptance Criteria (from task)
1. PreviewPanel.tsx: Uses `useStdoutDimensions` hook
2. Narrow terminals use minimal/no borders
3. Content adapts to available width without truncation issues
4. Wide terminals show full decorative borders
5. No visual overflow
6. Unit tests for responsive behavior

### Current State Analysis

**PreviewPanel.tsx** (packages/cli/src/ui/components/PreviewPanel.tsx):
- Does **NOT** use `useStdoutDimensions` hook
- Uses fixed `borderStyle="round"` for outer container
- Uses fixed `borderStyle="single"` for intent detection section
- Has fixed `paddingX={2}` and `paddingY={1}`
- Contains four main sections:
  1. Header with "Input Preview" title and [on] indicator
  2. Input display (quoted user input)
  3. Intent detection box (type, confidence, action, agent flow)
  4. Action buttons ([Enter] Confirm, [Esc] Cancel, [e] Edit)
- No width considerations - assumes adequate terminal space

**useStdoutDimensions hook** (exists in codebase):
```typescript
interface StdoutDimensions {
  width: number;
  height: number;
  breakpoint: 'narrow' | 'compact' | 'normal' | 'wide';
  isAvailable: boolean;
  isNarrow: boolean;   // < 60 cols
  isCompact: boolean;  // 60-100 cols
  isNormal: boolean;   // 100-160 cols
  isWide: boolean;     // >= 160 cols
}
```

### Reference Implementations

The codebase has established responsive patterns in:

1. **AgentPanel.tsx**: Uses `ResponsiveAgentConfig` object with breakpoint-specific settings for borders, layout, and content
2. **StatusBar.tsx**: Uses priority-based segment filtering and label abbreviation
3. **TaskProgress.tsx**: Auto-switches to compact mode in narrow terminals, adjusts description truncation
4. **ActivityLog.tsx**: Responsive message truncation, timestamp abbreviation

## Decision

### 1. Hook Integration

Add `useStdoutDimensions` hook to PreviewPanel:

```typescript
import { useStdoutDimensions, type Breakpoint } from '../hooks/index.js';

export function PreviewPanel({
  input,
  intent,
  workflow,
  onConfirm,
  onCancel,
  onEdit,
}: PreviewPanelProps): React.ReactElement {
  const { width, breakpoint, isNarrow, isCompact } = useStdoutDimensions();

  // Get responsive configuration
  const config = useMemo(
    () => getResponsiveConfig(breakpoint, width),
    [breakpoint, width]
  );

  // ... rest of component
}
```

### 2. Four-Tier Responsive Strategy

#### Tier 1: Narrow (< 60 cols) - MINIMAL MODE
**Behavior**: No decorative borders, compact content layout
- No outer border (removes 4 chars of width)
- No inner border around intent detection
- Reduced padding (paddingX={1}, paddingY={0})
- Abbreviated labels: "Input:" -> ">"
- Action buttons condensed: `[⏎]OK [⎋]No [e]Ed`
- Intent type shown as icon only (no text)
- Confidence shown as single char indicator (H/M/L)
- Input text truncated with ellipsis

**Example output (50 cols):**
```
> "implement dark mode..."
⚡ Task [H] Create task (feature workflow)
[⏎]OK [⎋]No [e]Ed
```

#### Tier 2: Compact (60-100 cols) - SIMPLIFIED MODE
**Behavior**: Single-line border, condensed content
- Outer border uses `single` style (thinner than `round`)
- No inner border around intent detection
- Standard padding (paddingX={1}, paddingY={0})
- Short labels preserved
- Action buttons slightly condensed: `[Enter] OK  [Esc] No  [e] Edit`
- Intent shows type + confidence percentage
- Full input with smart truncation

**Example output (80 cols):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 Preview                                                            [on]  │
│ Input: "implement dark mode for the settings page"                          │
│ ⚡ Task Intent (85%) - Create task (feature workflow)                       │
│ [Enter] OK  [Esc] No  [e] Edit                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Tier 3: Normal (100-160 cols) - STANDARD MODE
**Behavior**: Full decorative borders, standard layout
- Outer border uses `round` style
- Inner border around intent detection (single style)
- Standard padding (paddingX={2}, paddingY={1})
- Full labels and descriptions
- Full action buttons with spacing
- Agent flow shown for task intents

**Example output (120 cols):**
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

#### Tier 4: Wide (>= 160 cols) - EXPANDED MODE
**Behavior**: Full decorative borders with enhanced details
- Same as Normal but with:
  - Double border style for outer container (more decorative)
  - Additional metadata display
  - More spacing for visual clarity
  - Full workflow information

### 3. Responsive Configuration Interface

```typescript
/**
 * Responsive configuration for PreviewPanel
 */
interface ResponsivePreviewConfig {
  // Border settings
  outerBorderStyle: 'none' | 'single' | 'round' | 'double';
  innerBorderStyle: 'none' | 'single';

  // Padding settings
  paddingX: number;
  paddingY: number;
  marginBottom: number;

  // Content display
  showHeader: boolean;
  headerText: string;
  showStatusIndicator: boolean;

  // Input display
  inputLabelText: string;
  inputMaxLength: number;

  // Intent display
  showIntentSection: boolean;
  showIntentLabel: boolean;
  showIntentIcon: boolean;
  showIntentText: boolean;
  showConfidenceLabel: boolean;
  showConfidencePercentage: boolean;
  showActionLabel: boolean;
  showAgentFlow: boolean;

  // Action buttons
  actionButtonStyle: 'full' | 'compact' | 'minimal';
}
```

### 4. Breakpoint Configuration Map

```typescript
const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsivePreviewConfig> = {
  narrow: {
    // Borders
    outerBorderStyle: 'none',
    innerBorderStyle: 'none',

    // Padding
    paddingX: 1,
    paddingY: 0,
    marginBottom: 0,

    // Header
    showHeader: false,
    headerText: '',
    showStatusIndicator: false,

    // Input
    inputLabelText: '>',
    inputMaxLength: 40, // Will be calculated based on width

    // Intent
    showIntentSection: true,
    showIntentLabel: false,
    showIntentIcon: true,
    showIntentText: false,
    showConfidenceLabel: false,
    showConfidencePercentage: false, // Show as H/M/L indicator
    showActionLabel: false,
    showAgentFlow: false,

    // Actions
    actionButtonStyle: 'minimal',
  },

  compact: {
    // Borders
    outerBorderStyle: 'single',
    innerBorderStyle: 'none',

    // Padding
    paddingX: 1,
    paddingY: 0,
    marginBottom: 1,

    // Header
    showHeader: true,
    headerText: '📋 Preview',
    showStatusIndicator: true,

    // Input
    inputLabelText: 'Input:',
    inputMaxLength: 60,

    // Intent
    showIntentSection: true,
    showIntentLabel: false,
    showIntentIcon: true,
    showIntentText: true,
    showConfidenceLabel: false,
    showConfidencePercentage: true,
    showActionLabel: false,
    showAgentFlow: false,

    // Actions
    actionButtonStyle: 'compact',
  },

  normal: {
    // Borders
    outerBorderStyle: 'round',
    innerBorderStyle: 'single',

    // Padding
    paddingX: 2,
    paddingY: 1,
    marginBottom: 1,

    // Header
    showHeader: true,
    headerText: '📋 Input Preview',
    showStatusIndicator: true,

    // Input
    inputLabelText: 'Input:',
    inputMaxLength: 100,

    // Intent
    showIntentSection: true,
    showIntentLabel: true,
    showIntentIcon: true,
    showIntentText: true,
    showConfidenceLabel: true,
    showConfidencePercentage: true,
    showActionLabel: true,
    showAgentFlow: true,

    // Actions
    actionButtonStyle: 'full',
  },

  wide: {
    // Borders
    outerBorderStyle: 'double',
    innerBorderStyle: 'single',

    // Padding
    paddingX: 2,
    paddingY: 1,
    marginBottom: 1,

    // Header
    showHeader: true,
    headerText: '📋 Input Preview',
    showStatusIndicator: true,

    // Input
    inputLabelText: 'Input:',
    inputMaxLength: 150,

    // Intent
    showIntentSection: true,
    showIntentLabel: true,
    showIntentIcon: true,
    showIntentText: true,
    showConfidenceLabel: true,
    showConfidencePercentage: true,
    showActionLabel: true,
    showAgentFlow: true,

    // Actions
    actionButtonStyle: 'full',
  },
};
```

### 5. Dynamic Width Calculation

```typescript
/**
 * Calculate maximum input text length based on available width
 */
function calculateInputMaxLength(
  width: number,
  config: ResponsivePreviewConfig
): number {
  // Account for borders, padding, and labels
  const borderWidth = config.outerBorderStyle === 'none' ? 0 : 2;
  const paddingWidth = config.paddingX * 2;
  const labelWidth = config.inputLabelText.length + 3; // label + ": " + quote
  const quoteWidth = 2; // Opening and closing quotes

  const availableWidth = width - borderWidth - paddingWidth - labelWidth - quoteWidth;

  // Return calculated width but cap at config max
  return Math.min(
    Math.max(20, availableWidth), // Minimum 20 chars
    config.inputMaxLength
  );
}

/**
 * Smart truncation that preserves meaning
 */
function truncateInput(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;

  // Try to truncate at word boundary
  const truncated = input.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.6) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}
```

### 6. Action Button Styles

```typescript
/**
 * Action button configurations by style
 */
const ACTION_BUTTON_STYLES = {
  full: {
    confirm: { text: '[Enter] Confirm', spacing: '    ' },
    cancel: { text: '[Esc] Cancel', spacing: '    ' },
    edit: { text: '[e] Edit', spacing: '' },
  },
  compact: {
    confirm: { text: '[Enter] OK', spacing: '  ' },
    cancel: { text: '[Esc] No', spacing: '  ' },
    edit: { text: '[e] Edit', spacing: '' },
  },
  minimal: {
    confirm: { text: '[⏎]', spacing: ' ' },
    cancel: { text: '[⎋]', spacing: ' ' },
    edit: { text: '[e]', spacing: '' },
  },
};
```

### 7. Confidence Display Variants

```typescript
/**
 * Format confidence based on display mode
 */
function formatConfidence(
  confidence: number,
  showLabel: boolean,
  showPercentage: boolean
): string {
  const percentage = Math.round(confidence * 100);

  if (!showPercentage) {
    // Single character indicator
    if (percentage >= 80) return '[H]'; // High
    if (percentage >= 60) return '[M]'; // Medium
    return '[L]'; // Low
  }

  if (showLabel) {
    return `Confidence: ${percentage}%`;
  }

  return `(${percentage}%)`;
}

/**
 * Get confidence color based on value
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'green';
  if (confidence >= 0.6) return 'yellow';
  return 'red';
}
```

### 8. Updated Component Props

```typescript
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
  /** Optional explicit width (for testing or fixed-width containers) */
  width?: number;
}
```

### 9. Component Structure

```typescript
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
  const inputMaxLength = useMemo(
    () => calculateInputMaxLength(width, config),
    [width, config]
  );

  const truncatedInput = useMemo(
    () => truncateInput(input, inputMaxLength),
    [input, inputMaxLength]
  );

  const actionButtons = ACTION_BUTTON_STYLES[config.actionButtonStyle];

  // Render based on breakpoint
  if (breakpoint === 'narrow') {
    return <NarrowPreviewPanel {...props} config={config} />;
  }

  if (breakpoint === 'compact') {
    return <CompactPreviewPanel {...props} config={config} />;
  }

  return <StandardPreviewPanel {...props} config={config} />;
}
```

### 10. Sub-Component: NarrowPreviewPanel

```typescript
function NarrowPreviewPanel({
  input,
  intent,
  workflow,
  config,
  onConfirm,
  onCancel,
  onEdit,
}: NarrowPreviewPanelProps): React.ReactElement {
  const inputMaxLength = calculateInputMaxLength(width, config);
  const truncatedInput = truncateInput(input, inputMaxLength);

  return (
    <Box flexDirection="column" paddingX={config.paddingX}>
      {/* Input line */}
      <Box>
        <Text color="gray">{config.inputLabelText} </Text>
        <Text color="white">"{truncatedInput}"</Text>
      </Box>

      {/* Intent line */}
      <Box>
        <Text>{getIntentIcon(intent.type)}</Text>
        <Text color="white"> {capitalizeFirst(intent.type)}</Text>
        <Text color={getConfidenceColor(intent.confidence)}>
          {' '}{formatConfidence(intent.confidence, false, false)}
        </Text>
        <Text color="gray"> {getShortActionDescription(intent, workflow)}</Text>
      </Box>

      {/* Action buttons */}
      <Box marginTop={1}>
        <Text color="green">[⏎]</Text>
        <Text color="white">OK </Text>
        <Text color="red">[⎋]</Text>
        <Text color="white">No </Text>
        <Text color="yellow">[e]</Text>
        <Text color="white">Ed</Text>
      </Box>
    </Box>
  );
}
```

### 11. Testing Strategy

#### Test File: `PreviewPanel.responsive.test.tsx`

```typescript
describe('PreviewPanel - Responsive Layout', () => {
  describe('useStdoutDimensions integration', () => {
    it('uses useStdoutDimensions hook to get terminal width');
    it('respects explicit width prop for testing');
    it('handles missing dimensions gracefully with fallbacks');
  });

  describe('Narrow terminals (< 60 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 50, breakpoint: 'narrow' });
    });

    it('removes outer border');
    it('removes inner intent border');
    it('uses minimal padding');
    it('shows abbreviated input label');
    it('shows minimal action buttons');
    it('shows intent icon without text');
    it('shows confidence as H/M/L indicator');
    it('truncates long input appropriately');
    it('does not overflow terminal width');
  });

  describe('Compact terminals (60-100 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 80, breakpoint: 'compact' });
    });

    it('uses single border style');
    it('shows condensed header');
    it('shows compact action buttons');
    it('shows intent with percentage');
    it('hides agent flow');
  });

  describe('Normal terminals (100-160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 120, breakpoint: 'normal' });
    });

    it('uses round border style');
    it('shows full header');
    it('shows inner intent border');
    it('shows full action buttons');
    it('shows agent flow for task intents');
    it('shows confidence with label');
  });

  describe('Wide terminals (>= 160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions({ width: 180, breakpoint: 'wide' });
    });

    it('uses double border style');
    it('shows full decorative display');
    it('has generous spacing');
  });

  describe('Content adaptation', () => {
    it('calculates input max length based on width');
    it('truncates input at word boundaries');
    it('preserves input meaning when truncating');
    it('adapts to very long inputs');
    it('handles short inputs without truncation');
  });

  describe('No overflow at any width', () => {
    it.each([40, 50, 60, 80, 100, 120, 160, 200])(
      'renders without overflow at width %d',
      (width) => {
        // Render and verify no line exceeds width
      }
    );
  });

  describe('Edge cases', () => {
    it('handles empty input');
    it('handles very long input');
    it('handles all intent types');
    it('handles missing workflow');
    it('handles terminal resize');
    it('handles undefined dimensions');
  });
});
```

### 12. Implementation Plan

#### Phase 1: Hook Integration & Configuration (1-2 hours)
1. Import `useStdoutDimensions` hook
2. Add `width` prop for testing
3. Create `ResponsivePreviewConfig` interface
4. Define `RESPONSIVE_CONFIGS` map for all breakpoints
5. Add helper functions for dynamic calculations

#### Phase 2: Narrow Mode Implementation (2 hours)
1. Create `NarrowPreviewPanel` sub-component
2. Remove borders and reduce padding
3. Implement minimal action buttons
4. Add confidence indicator (H/M/L)
5. Test overflow prevention

#### Phase 3: Compact Mode Implementation (1.5 hours)
1. Create `CompactPreviewPanel` sub-component
2. Use single border style
3. Implement condensed content
4. Add compact action buttons
5. Test at various widths

#### Phase 4: Standard/Wide Mode Updates (1 hour)
1. Update existing component to be `StandardPreviewPanel`
2. Add double border support for wide mode
3. Add width prop support
4. Ensure backward compatibility

#### Phase 5: Test Suite (2-3 hours)
1. Create `PreviewPanel.responsive.test.tsx`
2. Add mock helpers
3. Test all breakpoints
4. Add overflow prevention tests
5. Test content truncation
6. Test edge cases

#### Phase 6: Integration & Polish (1 hour)
1. Manual testing in various terminal sizes
2. Verify no overflow at edge cases
3. Ensure all intent types work
4. Update existing tests if needed

### 13. File Changes

```
packages/cli/src/ui/components/
├── PreviewPanel.tsx                      # UPDATE: Add responsive logic
├── ADR-responsive-previewpanel.md        # NEW: This document
└── __tests__/
    ├── PreviewPanel.test.tsx             # UPDATE: Add mock dimensions
    └── PreviewPanel.responsive.test.tsx  # NEW: Comprehensive responsive tests
```

## Consequences

### Positive
- PreviewPanel adapts intelligently to all terminal widths
- No visual overflow or content truncation issues
- Narrow terminals still show essential preview information
- Wide terminals get enhanced decorative display
- Follows established responsive patterns in codebase
- Backward compatible with existing usage

### Negative
- Increased component complexity
- Additional test coverage required
- May need fine-tuning of breakpoint thresholds

### Neutral
- Consistent with AgentPanel, StatusBar, TaskProgress patterns
- Uses existing `useStdoutDimensions` hook

## API Changes

**No breaking changes** - existing props work as before.

**New optional prop:**
- `width?: number` - Explicit width override for testing

**Behavioral changes:**
- Borders adapt based on terminal width
- Content truncates intelligently
- Action buttons condense in narrow terminals

## Dependencies

- `useStdoutDimensions` hook (exists in codebase)
- No new external dependencies

## Related Documents

- `ADR-responsive-agentpanel.md` - Similar responsive pattern
- `ADR-responsive-statusbar.md` - Similar responsive pattern
- `ADR-responsive-taskprogress.md` - Similar responsive pattern
- `ADR-useStdoutDimensions.md` - Hook documentation
