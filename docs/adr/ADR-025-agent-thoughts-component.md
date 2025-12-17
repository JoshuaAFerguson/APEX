# ADR-025: AgentThoughts Component

## Status
Proposed

## Context

The APEX CLI needs a component to display agent reasoning/thinking content in a collapsible, visually distinct format. This enhances transparency by showing users what the AI agents are "thinking" during task execution.

### Requirements (from Acceptance Criteria)
1. AgentThoughts component renders thinking content
2. Uses CollapsibleSection for expand/collapse functionality
3. Dimmed gray styling for thought text
4. Shows thinking indicator icon
5. Unit tests

### Existing Components Analysis

**ThoughtDisplay.tsx** (existing):
- Simple component that displays thinking content
- Uses dimmed gray styling with border
- Shows 💭 emoji as indicator
- Supports truncation based on display mode
- Does NOT use CollapsibleSection
- Does NOT support expand/collapse

**CollapsibleSection.tsx** (existing):
- Generic collapsible container
- Animated arrow indicator
- Supports `dimmed` prop for gray styling
- Supports controlled and uncontrolled state
- Supports display modes (normal, compact, verbose)
- Has comprehensive test coverage

## Decision

### Component Design: AgentThoughts

Create a new `AgentThoughts` component that wraps `CollapsibleSection` with agent-specific thinking display features. This provides the collapsible behavior while maintaining semantic clarity for agent thoughts.

### Architecture

```
AgentThoughts
└── CollapsibleSection (dimmed, with thinking icon in title)
    └── ThinkingContent (gray text, wrapped)
```

### Interface Design

```typescript
// packages/cli/src/ui/components/AgentThoughts.tsx

import type { DisplayMode } from '@apexcli/core';

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
```

### Implementation Approach

#### 1. Component Structure

```tsx
export function AgentThoughts({
  thinking,
  agent,
  displayMode = 'normal',
  defaultCollapsed = true,  // Collapsed by default to reduce noise
  collapsed: controlledCollapsed,
  onToggle,
  maxLength = 500,
  icon,
  useAsciiIcons = false,
}: AgentThoughtsProps): React.ReactElement {
  // Icon selection with ASCII fallback
  const thinkingIcon = icon ?? (useAsciiIcons ? '[T]' : '💭');

  // Don't render in compact mode (thoughts are secondary info)
  if (displayMode === 'compact') {
    return <Box />;
  }

  // Truncation logic
  const shouldTruncate = thinking.length > maxLength;
  const displayText = shouldTruncate
    ? thinking.substring(0, maxLength) + '...'
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
```

#### 2. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Default collapsed=true** | Agent thoughts are secondary information; users can expand if interested |
| **Always dimmed** | Thoughts should be visually de-emphasized compared to primary content |
| **Round border style** | Matches existing ThoughtDisplay aesthetics |
| **Hidden in compact mode** | Compact mode prioritizes essential info; thoughts are not essential |
| **Icon in title** | Provides visual recognition; matches 💭 pattern from ThoughtDisplay |
| **Truncation with character count** | Shows users how much content is hidden when collapsed |

#### 3. Display Mode Behavior

| Mode | Behavior |
|------|----------|
| **compact** | Not rendered (returns empty Box) |
| **normal** | Rendered collapsed by default, truncated at 500 chars |
| **verbose** | Rendered collapsed by default, truncated at 1000 chars, shows [expanded/collapsed] state |

For verbose mode, increase maxLength:
```typescript
const effectiveMaxLength = displayMode === 'verbose' ? 1000 : maxLength;
```

#### 4. ASCII Icon Support

```typescript
const THINKING_ICONS = {
  emoji: '💭',
  ascii: '[T]',  // "T" for Thinking
};
```

Integrates with existing `shouldUseAsciiIcons()` from `agents/agentIcons.ts`.

### File Structure

```
packages/cli/src/ui/components/
├── AgentThoughts.tsx                    # Main component
├── __tests__/
│   └── AgentThoughts.test.tsx           # Unit tests
└── index.ts                             # Export (add to existing)
```

### Export Updates

Add to `packages/cli/src/ui/components/index.ts`:

```typescript
export { AgentThoughts, type AgentThoughtsProps } from './AgentThoughts.js';
```

### Test Strategy

#### Test Categories

1. **Basic Rendering Tests**
   - Renders thinking content when expanded
   - Renders agent name in title
   - Shows thinking icon (💭)
   - Shows thinking icon (ASCII fallback)

2. **Collapse/Expand Tests**
   - Starts collapsed by default
   - Can be expanded via toggle
   - Controlled state works correctly
   - onToggle callback fires

3. **Display Mode Tests**
   - Returns empty in compact mode
   - Normal mode with standard truncation
   - Verbose mode with extended truncation
   - Shows [expanded/collapsed] in verbose mode

4. **Truncation Tests**
   - Truncates long content at maxLength
   - Shows character count in header when truncated
   - Custom maxLength works
   - No truncation for short content

5. **Styling Tests**
   - Always uses dimmed styling
   - Uses round border style
   - Text is gray and dimmed

6. **Integration Tests**
   - Works within AgentPanel
   - Works within ResponseStream context
   - Keyboard toggle works (inherits from CollapsibleSection)

#### Test File Structure

```typescript
// packages/cli/src/ui/components/__tests__/AgentThoughts.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Text } from 'ink';
import { AgentThoughts, type AgentThoughtsProps } from '../AgentThoughts.js';

// Mock CollapsibleSection to verify props passing
vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: vi.fn(({ title, children, ...props }) => (
    <div data-testid="collapsible-section" data-props={JSON.stringify(props)}>
      <span data-testid="title">{title}</span>
      <div data-testid="content">{children}</div>
    </div>
  )),
}));

function renderAgentThoughts(props: Partial<AgentThoughtsProps> = {}) {
  const defaultProps: AgentThoughtsProps = {
    thinking: 'Test thinking content',
    agent: 'developer',
    ...props,
  };
  return render(<AgentThoughts {...defaultProps} />);
}

describe('AgentThoughts', () => {
  // Test cases...
});
```

### Relationship to Existing Components

| Component | Relationship |
|-----------|-------------|
| **ThoughtDisplay** | Simpler version; AgentThoughts adds collapse support |
| **CollapsibleSection** | AgentThoughts wraps this for core collapse behavior |
| **AgentPanel** | Can contain AgentThoughts for per-agent thinking display |
| **ResponseStream** | May display AgentThoughts inline during streaming |

**Migration Path**: ThoughtDisplay can be deprecated in favor of AgentThoughts, or kept as a simpler non-collapsible alternative. Recommendation: Keep both for different use cases.

### Dependencies

- `ink` (Box, Text)
- `CollapsibleSection` (from same package)
- `@apexcli/core` (DisplayMode type)

### Implementation Order

1. Create `AgentThoughts.tsx` component
2. Add export to `index.ts`
3. Create `__tests__/AgentThoughts.test.tsx`
4. Run tests and verify
5. Build and typecheck

## Consequences

### Positive
- Provides collapsible agent thinking display (requested feature)
- Reuses existing CollapsibleSection (DRY principle)
- Consistent with existing styling patterns (dimmed, gray, round borders)
- Flexible with controlled/uncontrolled state
- Test coverage from the start
- ASCII icon fallback for terminal compatibility

### Negative
- Slight overlap with existing ThoughtDisplay (but different use case)
- Additional component to maintain
- Adds to bundle size (minimal)

### Risks
- None significant; straightforward composition of existing components

## Alternatives Considered

### 1. Modify ThoughtDisplay to Support Collapse
**Rejected**: Would change existing behavior and API; better to have a new component

### 2. Use CollapsibleSection Directly in Consuming Components
**Rejected**: Would require duplicating thinking-specific logic (icon, dimming, truncation) everywhere

### 3. Add Collapse to AgentPanel Only
**Rejected**: AgentThoughts should be reusable in multiple contexts (panel, stream, standalone)

## Implementation Checklist

- [ ] Create `AgentThoughts.tsx` component
- [ ] Add props interface with JSDoc documentation
- [ ] Implement display mode handling (compact = hidden)
- [ ] Implement truncation logic
- [ ] Implement ASCII icon support
- [ ] Add export to `index.ts`
- [ ] Create comprehensive test file
- [ ] Run `npm run typecheck`
- [ ] Run `npm run test`
- [ ] Update any consuming components if needed
