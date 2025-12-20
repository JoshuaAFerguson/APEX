# ADR-024: CollapsibleSection Component

## Status
Proposed

## Context

APEX CLI needs a generic, reusable CollapsibleSection component for expandable UI sections. This component is needed for:
- Improving information density by allowing users to collapse non-essential sections
- Providing consistent expand/collapse behavior across the UI
- Supporting dimmed/gray styling for secondary content
- Animated arrow indicators for better visual feedback

The codebase already has collapse/expand patterns in:
- `ActivityLog.tsx` - Individual entry collapse with keyboard navigation
- `KanbanBoard.tsx` (web-ui) - Column collapse with ChevronRight/ChevronDown icons
- Various components using `useState(collapsed)` pattern

## Decision

### Component Design

We will create a generic `CollapsibleSection` component in the CLI package that follows existing patterns while providing a reusable, composable API.

#### File Location
```
packages/cli/src/ui/components/CollapsibleSection.tsx
packages/cli/src/ui/components/__tests__/CollapsibleSection.test.tsx
```

#### Component Interface

```typescript
export interface CollapsibleSectionProps {
  /** Section title displayed in the header */
  title: string;

  /** Content to render when expanded */
  children: React.ReactNode;

  /** Initial collapsed state (default: false) */
  defaultCollapsed?: boolean;

  /** Controlled collapsed state */
  collapsed?: boolean;

  /** Callback when collapse state changes */
  onToggle?: (collapsed: boolean) => void;

  /** Enable dimmed/gray styling for secondary content */
  dimmed?: boolean;

  /** Whether to show the animated arrow indicator (default: true) */
  showArrow?: boolean;

  /** Border style (default: 'single') */
  borderStyle?: 'single' | 'round' | 'double' | 'none';

  /** Border color (default: 'cyan', 'gray' when dimmed) */
  borderColor?: string;

  /** Custom width */
  width?: number;

  /** Display mode affects styling and information density */
  displayMode?: 'normal' | 'compact' | 'verbose';

  /** Additional header content (rendered after title) */
  headerExtra?: React.ReactNode;

  /** Whether keyboard input is enabled for toggling */
  allowKeyboardToggle?: boolean;

  /** Custom toggle key (default: Enter when focused, 'c' global) */
  toggleKey?: string;
}
```

### Implementation Architecture

#### 1. State Management

Support both controlled and uncontrolled patterns:

```typescript
export function CollapsibleSection({
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onToggle,
  ...props
}: CollapsibleSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  // Determine if controlled or uncontrolled
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const handleToggle = useCallback(() => {
    const newState = !collapsed;
    if (!isControlled) {
      setInternalCollapsed(newState);
    }
    onToggle?.(newState);
  }, [collapsed, isControlled, onToggle]);

  // ... rest of component
}
```

#### 2. Animated Arrow Indicator

Use React state with interval-based animation for smooth rotation effect:

```typescript
const ArrowIndicator: React.FC<{ collapsed: boolean; animated: boolean }> = ({
  collapsed,
  animated
}) => {
  const [rotation, setRotation] = useState(collapsed ? 0 : 90);

  useEffect(() => {
    if (!animated) {
      setRotation(collapsed ? 0 : 90);
      return;
    }

    const targetRotation = collapsed ? 0 : 90;
    const startRotation = rotation;
    const duration = 150; // ms
    const startTime = Date.now();
    const frameRate = 30;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 2); // ease-out

      const currentRotation = startRotation + (targetRotation - startRotation) * easedProgress;
      setRotation(currentRotation);

      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 1000 / frameRate);

    return () => clearInterval(interval);
  }, [collapsed, animated]);

  // Use Unicode arrow characters based on rotation state
  // ▶ (collapsed, pointing right) → ▼ (expanded, pointing down)
  const arrow = rotation < 45 ? '▶' : '▼';

  return <Text>{arrow}</Text>;
};
```

#### 3. Dimmed Styling Support

Apply dimmed styling through Ink's `dimColor` prop and color modifications:

```typescript
const getColors = (dimmed: boolean, displayMode: DisplayMode) => ({
  border: dimmed ? 'gray' : 'cyan',
  title: dimmed ? 'gray' : 'white',
  arrow: dimmed ? 'gray' : 'cyan',
  content: dimmed ? true : false, // dimColor prop value
});
```

#### 4. Display Mode Behavior

| Mode | Header | Content | Border |
|------|--------|---------|--------|
| normal | Full title with arrow | Full content | Standard |
| compact | Abbreviated title, no extra | Content unchanged | Thinner |
| verbose | Full title with state info | Content + metadata | Highlighted |

#### 5. Keyboard Interaction

Following existing patterns from `ActivityLog.tsx`:

```typescript
useInput((input, key) => {
  if (!allowKeyboardToggle) return;

  if (key.return || input === toggleKey) {
    handleToggle();
  }
});
```

### Component Structure

```tsx
<Box
  flexDirection="column"
  borderStyle={borderStyle}
  borderColor={colors.border}
  width={width}
>
  {/* Header */}
  <Box
    paddingX={1}
    justifyContent="space-between"
    onClick={handleToggle}
  >
    <Box>
      {showArrow && <ArrowIndicator collapsed={collapsed} animated={true} />}
      <Text color={colors.title} bold={!dimmed}> {title}</Text>
    </Box>
    {headerExtra}
  </Box>

  {/* Content - conditionally rendered */}
  {!collapsed && (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {dimmed ? (
        <Text dimColor>{children}</Text>
      ) : (
        children
      )}
    </Box>
  )}
</Box>
```

### Usage Examples

#### Basic Usage
```tsx
<CollapsibleSection title="Details">
  <Text>Detailed content here...</Text>
</CollapsibleSection>
```

#### Dimmed Secondary Section
```tsx
<CollapsibleSection
  title="Debug Information"
  dimmed
  defaultCollapsed={true}
>
  <Text>Debug logs...</Text>
</CollapsibleSection>
```

#### Controlled State
```tsx
const [isOpen, setIsOpen] = useState(false);

<CollapsibleSection
  title="Configuration"
  collapsed={!isOpen}
  onToggle={(collapsed) => setIsOpen(!collapsed)}
>
  <ConfigPanel />
</CollapsibleSection>
```

#### With Header Extra Content
```tsx
<CollapsibleSection
  title="Activity Log"
  headerExtra={<Badge count={entries.length} />}
>
  <ActivityList entries={entries} />
</CollapsibleSection>
```

### Test Coverage Plan

The test file should cover:

1. **Rendering Tests**
   - Renders with title and children
   - Renders collapsed state correctly
   - Renders expanded state correctly
   - Renders with dimmed styling

2. **Toggle Behavior**
   - Toggles on click/Enter key
   - Calls onToggle callback
   - Respects controlled state
   - Respects defaultCollapsed prop

3. **Arrow Animation**
   - Shows correct arrow direction when collapsed
   - Shows correct arrow direction when expanded
   - Animates between states

4. **Display Mode**
   - Renders correctly in compact mode
   - Renders correctly in verbose mode
   - Adapts styling based on mode

5. **Props**
   - Respects borderStyle prop
   - Respects borderColor prop
   - Respects width prop
   - Renders headerExtra content

6. **Accessibility**
   - Keyboard toggle works
   - Custom toggleKey works

## Consequences

### Positive
- **Reusability**: Single component for all collapse/expand needs
- **Consistency**: Unified collapse behavior across the CLI
- **Flexibility**: Supports both controlled and uncontrolled patterns
- **Accessibility**: Keyboard support built-in
- **Maintainability**: Centralized logic for collapse behavior

### Negative
- **Migration**: Existing components with custom collapse logic may need refactoring
- **Bundle Size**: Adds a new component (minimal impact)

### Neutral
- **Learning Curve**: Developers need to understand the API (well-documented)

## Implementation Notes

### File Structure
```
packages/cli/src/ui/components/
├── CollapsibleSection.tsx       # Main component
├── __tests__/
│   └── CollapsibleSection.test.tsx
└── index.ts                     # Update exports
```

### Dependencies
- `ink` (Box, Text, useInput) - already installed
- `react` (useState, useEffect, useCallback) - already installed

### Export Updates
Add to `packages/cli/src/ui/components/index.ts`:
```typescript
export { CollapsibleSection, type CollapsibleSectionProps } from './CollapsibleSection';
```

## Related Documents
- ADR-020: Display Modes (Compact and Verbose)
- ADR-023: stdout Dimensions Breakpoint System
- ActivityLog.tsx - Reference implementation for collapse patterns
- KanbanBoard.tsx - Reference implementation for arrow indicators
