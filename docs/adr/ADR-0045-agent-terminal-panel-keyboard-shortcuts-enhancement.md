# ADR-0045: AgentTerminalPanel Keyboard Shortcuts Enhancement (Minus/Plus Keys)

## Status
**Proposed**

## Context

The `AgentTerminalPanel` component in `packages/web-ui/src/components/agents/AgentTerminalPanel.tsx` has existing keyboard shortcuts implemented (Enter/Space, M/m, Escape) but is missing the Minus (-) and Plus (+) key shortcuts specified in ADR-0032.

### Current Implementation Analysis

The existing `handleKeyDown` function (lines 292-321) handles:
- **Enter/Space**: Toggle between minimized and normal states
- **M/m**: Toggle between maximized and normal states
- **Escape**: Restore from maximized state

### Missing Implementation

Per ADR-0032 Section 4 (Keyboard Accessibility), the following shortcuts are specified but not implemented:
- **`-` (minus)**: Focused panel → Minimize panel
- **`+` (plus)**: Focused panel → Restore from minimized

## Decision

### 1. Implementation Strategy

Add two new key handlers to the existing `handleKeyDown` function following the established pattern.

#### Key Mapping Analysis

| Key | `event.key` Value | US Layout | International Keyboards |
|-----|------------------|-----------|------------------------|
| Minus | `-` | `-` key | `-` on numpad, varies on main keyboard |
| Plus | `+` | `Shift` + `=` | `+` on numpad, varies on main keyboard |
| Equal | `=` | `=` key | Often same key as `+` without shift |

**Note**: On US keyboards, `+` typically requires `Shift` + `=`. For better UX, we should also accept `=` (Equal) as an alternative to `+` to allow unshifted access to the "restore" function.

### 2. Technical Design

#### Code Changes

**File**: `packages/web-ui/src/components/agents/AgentTerminalPanel.tsx`

**Location**: Within the `handleKeyDown` callback (lines 292-321)

```typescript
// Handle keyboard navigation
const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
  if (event.target !== event.currentTarget) return // Only handle when focused on container

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (effectivePanelState === 'minimized') {
        handleRestore()
      } else {
        handleMinimize()
      }
      break
    case 'M':
    case 'm':
      event.preventDefault()
      if (effectivePanelState === 'maximized') {
        handleRestore()
      } else {
        handleMaximize()
      }
      break
    case 'Escape':
      event.preventDefault()
      if (effectivePanelState === 'maximized') {
        handleRestore()
      }
      break
    // NEW: Minus key - minimize panel
    case '-':
      event.preventDefault()
      if (effectivePanelState !== 'minimized') {
        handleMinimize()
      }
      break
    // NEW: Plus/Equal key - restore from minimized
    case '+':
    case '=':
      event.preventDefault()
      if (effectivePanelState === 'minimized') {
        handleRestore()
      }
      break
  }
}, [effectivePanelState, handleRestore, handleMinimize, handleMaximize])
```

### 3. Behavior Specification

| Current State | Key Press | Action | New State |
|--------------|-----------|--------|-----------|
| normal | `-` | Minimize | minimized |
| maximized | `-` | Minimize | minimized |
| minimized | `-` | No action | minimized |
| minimized | `+` or `=` | Restore | normal |
| normal | `+` or `=` | No action | normal |
| maximized | `+` or `=` | No action | maximized |

### 4. Consistency with Existing Shortcuts

The new shortcuts complement existing ones:

| Shortcut | Purpose | Consistent Behavior |
|----------|---------|-------------------|
| Enter/Space | Toggle min/normal | Bidirectional toggle |
| M | Toggle max/normal | Bidirectional toggle |
| Escape | Restore from max | Unidirectional (safety) |
| **- (Minus)** | **Minimize only** | **Unidirectional (explicit collapse)** |
| **+ (Plus)** | **Restore from min** | **Unidirectional (explicit expand)** |

**Rationale**:
- Minus/Plus are explicit directional shortcuts
- They don't toggle (unlike Enter/Space/M) - this is intentional for predictability
- Users who want toggle behavior can use Enter/Space

### 5. Accessibility Considerations

1. **Screen Reader Announcements**: No changes needed - existing ARIA attributes handle state
2. **Keyboard Discoverability**: Should be documented in tooltip/help
3. **No Conflicts**: `-` and `+` are standard expand/collapse metaphors (zoom in/out, volume, etc.)

## Test Plan

### Unit Tests

Add to `packages/web-ui/src/components/agents/__tests__/AgentTerminalPanel.three-state.test.tsx`:

```typescript
describe('Keyboard Navigation - Minus/Plus Keys (ADR-0045)', () => {
  describe('Minus key (-) behavior', () => {
    it('minimizes panel when in normal state', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '-' })
      expect(onMinimize).toHaveBeenCalledTimes(1)
    })

    it('minimizes panel when in maximized state', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '-' })
      expect(onMinimize).toHaveBeenCalledTimes(1)
    })

    it('does nothing when already minimized', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '-' })
      expect(onMinimize).not.toHaveBeenCalled()
    })
  })

  describe('Plus key (+) behavior', () => {
    it('restores panel when minimized', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '+' })
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('restores panel when using Equal key (=)', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '=' })
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('does nothing when in normal state', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '+' })
      expect(onRestore).not.toHaveBeenCalled()
    })

    it('does nothing when in maximized state', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: '+' })
      expect(onRestore).not.toHaveBeenCalled()
    })
  })

  describe('Existing shortcuts still work', () => {
    it('Enter toggles between minimized and normal', () => {
      const onMinimize = vi.fn()
      const onRestore = vi.fn()

      const { container, rerender } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
          onRestore={onRestore}
        />
      )

      let panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: 'Enter' })
      expect(onMinimize).toHaveBeenCalledTimes(1)

      rerender(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="minimized"
          onMinimize={onMinimize}
          onRestore={onRestore}
        />
      )

      panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: 'Enter' })
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('Space toggles between minimized and normal', () => {
      const onMinimize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMinimize={onMinimize}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: ' ' })
      expect(onMinimize).toHaveBeenCalledTimes(1)
    })

    it('M toggles maximize state', () => {
      const onMaximize = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="normal"
          onMaximize={onMaximize}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: 'M' })
      expect(onMaximize).toHaveBeenCalledTimes(1)
    })

    it('Escape restores from maximized', () => {
      const onRestore = vi.fn()
      const { container } = render(
        <AgentTerminalPanel
          {...defaultProps}
          panelState="maximized"
          onRestore={onRestore}
        />
      )

      const panel = container.firstChild as HTMLElement
      fireEvent.keyDown(panel, { key: 'Escape' })
      expect(onRestore).toHaveBeenCalledTimes(1)
    })
  })
})
```

## Implementation Checklist

- [ ] Modify `handleKeyDown` in `AgentTerminalPanel.tsx` to handle `-`, `+`, and `=` keys
- [ ] Add unit tests for new keyboard shortcuts
- [ ] Add unit tests verifying existing shortcuts still work
- [ ] Update any keyboard shortcut documentation
- [ ] Run full test suite to ensure no regressions

## Files to Modify

1. **Primary Change**:
   - `packages/web-ui/src/components/agents/AgentTerminalPanel.tsx` (handleKeyDown function)

2. **Test Files**:
   - `packages/web-ui/src/components/agents/__tests__/AgentTerminalPanel.three-state.test.tsx` (add new test cases)
   - OR create new file: `packages/web-ui/src/components/agents/__tests__/AgentTerminalPanel.keyboard-shortcuts.test.tsx`

## Consequences

### Positive
1. **Compliance**: Implements shortcuts specified in ADR-0032
2. **Intuitive**: `-` for collapse, `+` for expand is a universal metaphor
3. **Accessibility**: Provides explicit keyboard control without relying on toggles
4. **Non-breaking**: Adds new functionality without changing existing behavior

### Negative
1. **Key conflicts**: Potential conflict if user needs to type `-` or `+` in a child input (mitigated by `event.target !== event.currentTarget` check)
2. **Discoverability**: Users may not know about these shortcuts (documentation needed)

### Mitigations
1. The existing guard `if (event.target !== event.currentTarget) return` prevents interference with child inputs
2. Shortcuts should be documented in UI tooltip or help dialog

## References

- ADR-0032: AgentTerminalPanel Minimize/Maximize Functionality Architecture
- Existing implementation: `packages/web-ui/src/components/agents/AgentTerminalPanel.tsx`
- Test patterns: `packages/web-ui/src/components/agents/__tests__/AgentTerminalPanel.three-state.test.tsx`
