# @apex/web-ui

Modern web dashboard for APEX (Autonomous Product Engineering eXecutor).

## Overview

This package provides a Next.js-based web interface for managing APEX tasks, agents, and configuration. It features real-time updates via WebSocket streaming and a clean, dark-themed UI.

## Features

- Real-time task monitoring via WebSocket
- Task creation and management
- Agent configuration viewer
- Project configuration editor
- Live event streaming
- Responsive dark theme UI

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **@apex/core** - Shared types and utilities

## Development

```bash
# Install dependencies (from root)
npm install

# Run in development mode
npm run dev --workspace=@apex/web-ui

# Build for production
npm run build --workspace=@apex/web-ui

# Start production server
npm run start --workspace=@apex/web-ui

# Lint
npm run lint --workspace=@apex/web-ui

# Type check
npm run typecheck --workspace=@apex/web-ui
```

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with sidebar
│   ├── page.tsx           # Dashboard home
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   └── index.ts
│   └── layout/            # Layout components
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── index.ts
└── lib/
    ├── api-client.ts      # REST API client
    ├── websocket-client.ts # WebSocket client + hooks
    └── utils.ts           # Utility functions
```

## Environment Variables

Create a `.env.local` file in the package root:

```env
NEXT_PUBLIC_APEX_API_URL=http://localhost:3000
```

## API Client

The `ApexApiClient` provides methods for interacting with the APEX API:

```typescript
import { apiClient } from '@/lib/api-client'

// Create a task
const response = await apiClient.createTask({
  description: 'Add user authentication',
  projectPath: '/path/to/project',
})

// Get task status
const task = await apiClient.getTask(taskId)

// List all tasks
const { tasks, total } = await apiClient.listTasks()
```

## WebSocket Client

Use the `useTaskStream` hook for real-time updates:

```typescript
import { useTaskStream } from '@/lib/websocket-client'

function TaskMonitor({ taskId }) {
  const { events, tasks, isConnected } = useTaskStream(taskId)

  return (
    <div>
      {isConnected ? 'Connected' : 'Disconnected'}
      {events.map((event) => (
        <div key={event.timestamp.toISOString()}>{event.type}</div>
      ))}
    </div>
  )
}
```

## UI Components

### Button

```typescript
import { Button } from '@/components/ui'

<Button variant="primary" size="md">Click me</Button>
<Button variant="secondary" loading>Loading...</Button>
```

### Card

```typescript
import { Card, CardHeader, CardContent } from '@/components/ui'

<Card>
  <CardHeader>
    <h3>Title</h3>
  </CardHeader>
  <CardContent>
    <p>Content</p>
  </CardContent>
</Card>
```

### Badge

```typescript
import { Badge } from '@/components/ui'

<Badge status={task.status} />
<Badge variant="success">Success</Badge>
```

## Color Palette

The UI uses a custom APEX color scheme:

- **Primary (apex)**: Blue tones for interactive elements
- **Background**: Dark theme with multiple levels
- **Foreground**: Light text with secondary/tertiary variants
- **Border**: Subtle borders for component separation

## License

MIT
