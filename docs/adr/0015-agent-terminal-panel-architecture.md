# ADR-0015: AgentTerminalPanel Component Architecture

## Status
Accepted

## Context
The APEX CLI needs an `AgentTerminalPanel` component that displays agent execution information in a terminal panel format with integrated status indicators. This component will:

1. Display `AgentStatusIndicator` in the header
2. Show agent name and current stage
3. Integrate with the `AgentExecution` type from `parallel-agent-view.ts`
4. Properly render idle/active/error visual states

## Decision

### Component Architecture

The `AgentTerminalPanel` will be a composite terminal UI component built on Ink (React for CLI) following established patterns in the codebase.

```
AgentTerminalPanel
├── Header
│   ├── AgentStatusIndicator (visual status)
│   ├── Agent Name
│   └── Stage Label
├── Content Area
│   ├── Progress/Activity Display
│   └── Optional Debug Info (verbose mode)
└── Footer (optional)
    └── Error/Status Messages
```

### Type Definitions

#### 1. AgentTerminalPanelProps Interface

```typescript
/**
 * Props for the AgentTerminalPanel component
 */
export interface AgentTerminalPanelProps {
  /** The agent execution data to display */
  execution: AgentExecution;

  /** Display mode affecting layout and information density */
  displayMode?: 'normal' | 'compact' | 'verbose';

  /** Whether the panel is currently focused/active */
  focused?: boolean;

  /** Whether to show animation effects */
  animated?: boolean;

  /** Optional explicit width (otherwise uses terminal width) */
  width?: number;

  /** Border style for the panel */
  borderStyle?: 'single' | 'round' | 'double' | 'none';

  /** Custom border color */
  borderColor?: string;

  /** Whether to show elapsed time */
  showElapsedTime?: boolean;

  /** Whether to show progress bar */
  showProgress?: boolean;

  /** Callback when panel header is clicked/selected */
  onSelect?: (execution: AgentExecution) => void;

  /** Test ID for testing purposes */
  testId?: string;
}
```

#### 2. Status Mapping

Map `AgentExecutionStatus` to `AgentStatus` for the indicator:

```typescript
/**
 * Maps AgentExecutionStatus to AgentStatus for the indicator component
 */
const STATUS_MAPPING: Record<AgentExecutionStatus, AgentStatus> = {
  idle: 'idle',
  queued: 'idle',
  running: 'active',
  paused: 'idle',
  completed: 'idle',
  failed: 'error',
  cancelled: 'idle',
};
```

### Component Structure

```typescript
// packages/cli/src/ui/components/agents/AgentTerminalPanel.tsx

import React from 'react';
import { Box, Text } from 'ink';
import { AgentStatusIndicator, type AgentStatus } from './AgentStatusIndicator.js';
import type { AgentExecution, AgentExecutionStatus } from '@apexcli/web-ui/types';
import { useThemeColors } from '../../context/ThemeContext.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { ProgressBar } from '../ProgressIndicators.js';

export function AgentTerminalPanel({
  execution,
  displayMode = 'normal',
  focused = false,
  animated = true,
  width,
  borderStyle = 'single',
  borderColor,
  showElapsedTime = true,
  showProgress = true,
  onSelect,
  testId,
}: AgentTerminalPanelProps): React.ReactElement {
  // Implementation...
}
```

### Visual States

| Execution Status | Indicator Status | Indicator Color | Animation |
|------------------|------------------|-----------------|-----------|
| `idle`           | `idle`           | muted           | none      |
| `queued`         | `idle`           | muted           | none      |
| `running`        | `active`         | info (cyan)     | pulse     |
| `paused`         | `idle`           | muted           | none      |
| `completed`      | `idle`           | muted           | none      |
| `failed`         | `error`          | error (red)     | fade      |
| `cancelled`      | `idle`           | muted           | none      |

### Responsive Design

The component will integrate with the existing responsive system using `useStdoutDimensions` hook:

```typescript
interface ResponsiveTerminalPanelConfig {
  showBorder: boolean;
  showProgress: boolean;
  showStage: boolean;
  showElapsedTime: boolean;
  maxNameLength: number;
  progressBarWidth: number;
}

const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsiveTerminalPanelConfig> = {
  narrow: {
    showBorder: false,
    showProgress: false,
    showStage: false,
    showElapsedTime: true,
    maxNameLength: 12,
    progressBarWidth: 0,
  },
  compact: {
    showBorder: true,
    showProgress: false,
    showStage: true,
    showElapsedTime: true,
    maxNameLength: 16,
    progressBarWidth: 0,
  },
  normal: {
    showBorder: true,
    showProgress: true,
    showStage: true,
    showElapsedTime: true,
    maxNameLength: 24,
    progressBarWidth: 30,
  },
  wide: {
    showBorder: true,
    showProgress: true,
    showStage: true,
    showElapsedTime: true,
    maxNameLength: 32,
    progressBarWidth: 40,
  },
};
```

### File Structure

```
packages/cli/src/ui/components/agents/
├── AgentTerminalPanel.tsx          # Main component
├── AgentTerminalPanel.types.ts     # Type definitions
├── __tests__/
│   ├── AgentTerminalPanel.test.tsx              # Unit tests
│   ├── AgentTerminalPanel.acceptance.test.tsx   # Acceptance criteria tests
│   └── AgentTerminalPanel.visual.test.tsx       # Visual state tests
└── index.ts                        # Updated exports
```

### Integration Points

1. **Type Import**: Import `AgentExecution` from `@apexcli/web-ui/types/parallel-agent-view`
2. **Status Indicator**: Use existing `AgentStatusIndicator` component
3. **Theme**: Use `useThemeColors` hook for consistent theming
4. **Elapsed Time**: Use `useElapsedTime` hook for time tracking
5. **Progress**: Use existing `ProgressBar` component

### Export Updates

Update `packages/cli/src/ui/components/agents/index.ts`:

```typescript
export { AgentTerminalPanel, type AgentTerminalPanelProps } from './AgentTerminalPanel.js';
export {
  mapExecutionStatusToAgentStatus,
  DEFAULT_TERMINAL_PANEL_PROPS,
  RESPONSIVE_TERMINAL_PANEL_CONFIGS,
} from './AgentTerminalPanel.types.js';
```

## Consequences

### Positive
- Consistent with existing component patterns (AgentPanel, ServicesPanel)
- Reuses existing building blocks (AgentStatusIndicator, ProgressBar)
- Follows SOLID principles with clear single responsibility
- Type-safe integration with AgentExecution
- Responsive design support out of the box

### Negative
- Adds another component to the agents directory (increased surface area)
- Status mapping adds minor complexity

### Neutral
- Requires coordination with web-ui types for AgentExecution

## Implementation Notes

1. **Phase 1**: Create type definitions (`AgentTerminalPanel.types.ts`)
2. **Phase 2**: Implement component (`AgentTerminalPanel.tsx`)
3. **Phase 3**: Add comprehensive tests
4. **Phase 4**: Update exports and documentation

## Related Documents
- `packages/cli/src/ui/components/agents/AgentStatusIndicator.tsx`
- `packages/cli/src/ui/components/agents/AgentStatusIndicator.types.ts`
- `packages/web-ui/src/types/parallel-agent-view.ts`
- `packages/web-ui/src/types/agent-terminal-panel.ts`
