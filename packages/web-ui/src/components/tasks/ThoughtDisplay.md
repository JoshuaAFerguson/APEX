# ThoughtDisplay Component

A collapsible component for displaying thought content from AI agents with dimmed styling and smooth animations.

## Usage

```tsx
import { ThoughtDisplay } from '@/components/tasks/ThoughtDisplay'

// Basic usage
<ThoughtDisplay content="This is the thought content from the AI agent..." />

// With custom label and timestamp
<ThoughtDisplay
  content="Analyzing the code structure..."
  label="Planning"
  timestamp={new Date()}
  onToggle={(expanded) => console.log('Expanded:', expanded)}
/>

// Initially expanded
<ThoughtDisplay
  content="The analysis shows..."
  defaultExpanded={true}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | Required | The thought content to display |
| `label` | `string` | `"Thinking..."` | Optional label/title for the thought |
| `defaultExpanded` | `boolean` | `false` | Whether the thought is initially expanded |
| `timestamp` | `Date \| string` | `undefined` | Optional timestamp for when the thought occurred |
| `className` | `string` | `undefined` | Optional className for additional styling |
| `onToggle` | `(isExpanded: boolean) => void` | `undefined` | Optional callback when expand/collapse state changes |

## Features

- **Collapsible**: Click to expand/collapse thought content
- **Keyboard Accessible**: Supports Enter and Space keys for toggling
- **Smooth Animations**: CSS grid-based height transitions
- **Dimmed Styling**: Uses theme-aware foreground-tertiary colors
- **Responsive**: Works on all screen sizes
- **Timestamp Support**: Optional formatted timestamp display
- **Screen Reader Friendly**: Proper ARIA attributes

## Styling

The component uses the following theme colors:
- Container: `bg-background-tertiary/50` with `border-border`
- Header: `text-foreground-secondary` for label, hover state on `bg-background-tertiary`
- Content: `text-foreground-tertiary` (dimmed/gray styling)
- Chevron: `text-foreground-tertiary` with 90-degree rotation animation

## Animation

Uses CSS grid for smooth height animation without requiring fixed max-height values:

```css
.animate-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease-in-out;
}

.animate-collapse[data-expanded="true"] {
  grid-template-rows: 1fr;
}
```

## Integration Points

The component is designed to integrate with:
1. Task detail pages for showing agent reasoning
2. WebSocket events (`agent:message`, `agent:thinking`)
3. Log viewers for inline thought display