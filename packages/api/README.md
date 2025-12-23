# @apexcli/api

REST API and WebSocket server for APEX.

## Overview

This package provides HTTP and WebSocket interfaces for APEX:

- **REST API** - Create, monitor, and manage tasks
- **WebSocket Streaming** - Real-time task progress and events
- **Fastify-based** - High-performance, low-overhead server

## Installation

```bash
npm install @apexcli/api
```

## Usage

### Starting the Server

```typescript
import { createServer } from '@apexcli/api';

const server = await createServer({
  port: 3000,
  host: '0.0.0.0',
  projectPath: '/path/to/project'
});

await server.listen({ port: 3000 });
```

### Using the CLI

```bash
# Start the API server
apex serve

# Start on a specific port
apex serve --port 8080
```

## REST API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tasks` | Create a new task |
| `GET` | `/tasks` | List all tasks |
| `GET` | `/tasks/:id` | Get task by ID |
| `GET` | `/tasks/:id/logs` | Get task logs |
| `GET` | `/tasks/:id/subtasks` | Get subtasks |
| `POST` | `/tasks/:id/cancel` | Cancel a task |
| `POST` | `/tasks/:id/retry` | Retry a failed task |
| `POST` | `/tasks/:id/resume` | Resume a paused task |

### Agents & Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/agents` | List available agents |
| `GET` | `/config` | Get project configuration |
| `GET` | `/health` | Health check |

### Example: Create a Task

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Add user authentication",
    "workflow": "feature"
  }'
```

Response:
```json
{
  "taskId": "task_abc123",
  "status": "queued",
  "message": "Task created and execution started"
}
```

### Example: Get Task Status

```bash
curl http://localhost:3000/tasks/task_abc123
```

Response:
```json
{
  "id": "task_abc123",
  "description": "Add user authentication",
  "status": "in-progress",
  "workflow": "feature",
  "currentStage": "implementation",
  "usage": {
    "inputTokens": 5000,
    "outputTokens": 2000,
    "estimatedCost": 0.21
  }
}
```

## WebSocket API

Connect to `/ws/:taskId` for real-time task updates:

```typescript
const ws = new WebSocket('ws://localhost:3000/ws/task_abc123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data);
};
```

### Event Types

| Event | Description |
|-------|-------------|
| `taskStarted` | Task execution began |
| `stageStarted` | Workflow stage began |
| `stageCompleted` | Workflow stage finished |
| `taskCompleted` | Task finished successfully |
| `taskFailed` | Task failed with error |
| `taskPaused` | Task awaiting input |
| `log` | New log entry |
| `usageUpdated` | Token usage updated |

### Example Event

```json
{
  "type": "stageCompleted",
  "taskId": "task_abc123",
  "stageName": "planning",
  "result": {
    "status": "completed",
    "output": "Implementation plan created"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Server Options

```typescript
interface ServerOptions {
  port?: number;        // Default: 3000
  host?: string;        // Default: '0.0.0.0'
  projectPath: string;  // Required: path to APEX project
  silent?: boolean;     // Disable logging
}
```

## Related Packages

- [@apexcli/core](https://www.npmjs.com/package/@apexcli/core) - Core types and utilities
- [@apexcli/orchestrator](https://www.npmjs.com/package/@apexcli/orchestrator) - Task execution engine
- [@apexcli/cli](https://www.npmjs.com/package/@apexcli/cli) - Command-line interface

## License

MIT
