# ADR: ThoughtDisplay Component Architecture

**Status**: Proposed
**Date**: 2024
**Context**: Create a collapsible ThoughtDisplay component with dimmed styling for the APEX web-ui

## Decision

### Component Location
`/packages/web-ui/src/components/tasks/ThoughtDisplay.tsx`

### Design Rationale

1. **Single Responsibility**: The component displays thought/reasoning content from AI agents with collapsible behavior
2. **Consistency**: Follows existing patterns from KanbanBoard (collapse), Card (structure), and LogViewer (streaming content)
3. **Accessibility**: Uses semantic HTML with proper ARIA attributes for expand/collapse states
4. **Animation**: CSS-based height transitions for smooth expand/collapse without external libraries

## Technical Specification

### Props Interface

```typescript
interface ThoughtDisplayProps {
  /** The thought content to display */
  content: string
  /** Optional label/title for the thought (e.g., "Thinking...", "Reasoning") */
  label?: string
  /** Whether the thought is initially expanded (default: false - collapsed) */
  defaultExpanded?: boolean
  /** Optional timestamp for when the thought occurred */
  timestamp?: Date | string
  /** Optional className for additional styling */
  className?: string
  /** Optional callback when expand/collapse state changes */
  onToggle?: (isExpanded: boolean) => void
}
```

### Component Structure

```
ThoughtDisplay
├── Header (clickable toggle)
│   ├── Chevron Icon (animated rotation)
│   ├── Label Text ("Thinking..." / custom label)
│   └── Optional Timestamp
└── Content Container (animated height)
    └── Thought Content (dimmed text)
```

### Styling Decisions

| Element | Tailwind Classes | Rationale |
|---------|-----------------|-----------|
| Container | `border border-border rounded-lg bg-background-tertiary/50` | Subtle container, matches tertiary bg pattern |
| Header | `p-3 cursor-pointer hover:bg-background-tertiary transition-colors` | Interactive feedback, consistent padding |
| Label Text | `text-sm text-foreground-secondary italic` | Dimmed, italicized to indicate "thinking" state |
| Chevron | `w-4 h-4 text-foreground-tertiary transition-transform duration-200` | Smooth 90deg rotation animation |
| Content Text | `text-sm text-foreground-tertiary leading-relaxed` | Dimmed/gray styling per requirements |
| Content Area | `px-3 pb-3 overflow-hidden transition-all duration-300 ease-in-out` | Smooth height animation |

### Animation Implementation

**Expand/Collapse Animation Strategy:**

Using CSS `grid-template-rows` technique for smooth height animation (works better than max-height):

```css
/* Collapsed state */
.thought-content-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease-in-out;
}

/* Expanded state */
.thought-content-wrapper[data-expanded="true"] {
  grid-template-rows: 1fr;
}

.thought-content-inner {
  overflow: hidden;
}
```

**Alternative (Tailwind-only approach):**

```typescript
// Using conditional max-height with overflow-hidden
<div className={cn(
  "overflow-hidden transition-all duration-300 ease-in-out",
  isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
)}>
```

**Recommendation**: Use the grid-template-rows approach added to globals.css for smoother animation, as max-height requires guessing a value and can cause jerky animations.

### Chevron Icon Animation

```typescript
<ChevronRight
  className={cn(
    "w-4 h-4 text-foreground-tertiary transition-transform duration-200",
    isExpanded && "rotate-90"
  )}
/>
```

### Color Theme Alignment

Using existing theme variables for "dimmed" styling:
- `text-foreground-secondary` (#a1a1aa dark / #52525b light) - for label
- `text-foreground-tertiary` (#71717a both themes) - for content (most dimmed)
- `bg-background-tertiary/50` - subtle background differentiation

### State Management

```typescript
const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false)

const handleToggle = useCallback(() => {
  const newState = !isExpanded
  setIsExpanded(newState)
  onToggle?.(newState)
}, [isExpanded, onToggle])
```

### Accessibility

- `role="region"` on expandable content
- `aria-expanded={isExpanded}` on toggle button
- `aria-controls` linking header to content
- `aria-labelledby` for content description
- Keyboard support: Enter/Space to toggle

## CSS Additions Required (globals.css)

```css
@layer utilities {
  /* Smooth height animation using grid */
  .animate-collapse {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 300ms ease-in-out;
  }

  .animate-collapse[data-expanded="true"] {
    grid-template-rows: 1fr;
  }

  .animate-collapse-inner {
    overflow: hidden;
  }
}
```

## Dependencies

- **Existing**: React, lucide-react (ChevronRight icon), cn utility
- **New**: None required

## Integration Points

The component is designed to integrate with:
1. Task detail page for showing agent reasoning
2. WebSocket events (`agent:message`, `agent:thinking`)
3. Log viewer for inline thought display

## File Changes Required

| File | Action | Description |
|------|--------|-------------|
| `components/tasks/ThoughtDisplay.tsx` | Create | Main component implementation |
| `app/globals.css` | Modify | Add collapse animation utilities |

## Alternatives Considered

1. **Framer Motion**: Rejected - adds bundle size, overkill for simple collapse
2. **react-collapse**: Rejected - external dependency, simple CSS achieves same result
3. **Headless UI Disclosure**: Considered - good accessibility but more complex, decided to implement inline for simplicity

## Component Code Outline

```typescript
'use client'

import { useState, useCallback, useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThoughtDisplayProps {
  content: string
  label?: string
  defaultExpanded?: boolean
  timestamp?: Date | string
  className?: string
  onToggle?: (isExpanded: boolean) => void
}

export function ThoughtDisplay({
  content,
  label = 'Thinking...',
  defaultExpanded = false,
  timestamp,
  className,
  onToggle,
}: ThoughtDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const contentId = useId()
  const headerId = useId()

  const handleToggle = useCallback(() => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onToggle?.(newState)
  }, [isExpanded, onToggle])

  return (
    <div className={cn(
      'border border-border rounded-lg bg-background-tertiary/50',
      className
    )}>
      {/* Header - Toggle Button */}
      <button
        id={headerId}
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className={cn(
          'w-full p-3 flex items-center gap-2',
          'cursor-pointer hover:bg-background-tertiary transition-colors',
          'text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-apex-500'
        )}
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 text-foreground-tertiary transition-transform duration-200 flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <span className="text-sm text-foreground-secondary italic flex-1">
          {label}
        </span>
        {timestamp && (
          <span className="text-xs text-foreground-tertiary">
            {formatTimestamp(timestamp)}
          </span>
        )}
      </button>

      {/* Content - Animated Collapse */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        className="animate-collapse"
        data-expanded={isExpanded}
      >
        <div className="animate-collapse-inner">
          <div className="px-3 pb-3 pt-0">
            <p className="text-sm text-foreground-tertiary leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
```

## Testing Considerations

1. Renders collapsed by default
2. Expands on click with animation
3. Collapses on second click
4. Respects `defaultExpanded` prop
5. Calls `onToggle` callback with correct state
6. Keyboard accessibility (Enter/Space)
7. Screen reader announces expand/collapse state
8. Renders timestamp when provided
9. Custom className is applied
10. Content preserves whitespace (pre-wrap)

## Consequences

### Positive
- Lightweight implementation with no new dependencies
- Consistent with existing codebase patterns
- Smooth animations enhance UX
- Accessible by default
- Theme-aware dimmed styling

### Negative
- CSS animation requires addition to globals.css
- Fixed animation duration (300ms) not configurable via props

### Risks
- Grid animation technique has limited IE support (acceptable for modern browsers)
