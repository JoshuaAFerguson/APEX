# API Reference

APEX provides a REST API and WebSocket interface for programmatic access to task management, agent control, and real-time streaming.

## Base URL

```
http://localhost:3000
```

Start the server with:
```bash
apex serve --port 3000
```

## Authentication

Currently, the API does not require authentication. In future versions, API key authentication will be added.

## Endpoints

### Health Check

Check if the server is running.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## Tasks

### Create Task

Create a new development task and start execution.

```http
POST /tasks
Content-Type: application/json
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Task description |
| `acceptanceCriteria` | string | No | Acceptance criteria |
| `workflow` | string | No | Workflow to use (default: "feature") |
| `autonomy` | string | No | Autonomy level |

**Autonomy Levels:**
- `full` - Complete autonomy
- `review-before-commit` - Pause before commits
- `review-before-merge` - Create PR for review
- `manual` - Pause at each stage

**Example Request:**
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Add health check endpoint",
    "workflow": "feature",
    "autonomy": "review-before-merge"
  }'
```

**Response:**
```json
{
  "taskId": "task_abc123_def456",
  "status": "pending",
  "message": "Task created and execution started"
}
```

**Status Codes:**
- `201` - Task created successfully
- `400` - Invalid request (missing description)

---

### Get Task

Retrieve details for a specific task.

```http
GET /tasks/:id
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Task ID |

**Example Request:**
```bash
curl http://localhost:3000/tasks/task_abc123_def456
```

**Response:**
```json
{
  "id": "task_abc123_def456",
  "description": "Add health check endpoint",
  "status": "in-progress",
  "workflow": "feature",
  "autonomy": "review-before-merge",
  "priority": "normal",
  "branchName": "apex/abc123-add-health-check",
  "currentStage": "implementation",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:35:00.000Z",
  "usage": {
    "inputTokens": 15000,
    "outputTokens": 5000,
    "totalTokens": 20000,
    "estimatedCost": 0.075
  },
  "logs": [
    {
      "timestamp": "2025-01-15T10:30:05.000Z",
      "level": "info",
      "message": "Starting planning stage",
      "agent": "planner"
    }
  ],
  "artifacts": []
}
```

**Status Codes:**
- `200` - Success
- `404` - Task not found

---

### List Tasks

List all tasks with optional filtering.

```http
GET /tasks
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Maximum number of tasks to return |

**Task Statuses:**
- `pending` - Not started
- `queued` - In queue
- `planning` - Planning phase
- `in-progress` - Executing
- `waiting-approval` - Waiting for human approval
- `paused` - Paused
- `completed` - Successfully completed
- `failed` - Failed
- `cancelled` - Cancelled by user

**Example Request:**
```bash
curl "http://localhost:3000/tasks?status=in-progress&limit=10"
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "task_abc123_def456",
      "description": "Add health check endpoint",
      "status": "in-progress",
      "workflow": "feature",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Update Task Status

Update the status of a task (typically called by agents).

```http
POST /tasks/:id/status
Content-Type: application/json
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Task ID |

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New status |
| `stage` | string | No | Current stage name |
| `message` | string | No | Status message |

**Example Request:**
```bash
curl -X POST http://localhost:3000/tasks/task_abc123_def456/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in-progress",
    "stage": "implementation",
    "message": "Writing code"
  }'
```

**Response:**
```json
{
  "ok": true
}
```

---

### Add Log Entry

Add a log entry to a task.

```http
POST /tasks/:id/log
Content-Type: application/json
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Log message |
| `level` | string | No | Log level (default: "info") |
| `agent` | string | No | Agent name |

**Log Levels:**
- `debug`
- `info`
- `warn`
- `error`

**Example Request:**
```bash
curl -X POST http://localhost:3000/tasks/task_abc123_def456/log \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "Created new file: src/health.ts",
    "agent": "developer"
  }'
```

**Response:**
```json
{
  "ok": true
}
```

---

## Gates

Gates are approval points in workflows where human review is required.

### Get Gate Status

Check the status of an approval gate.

```http
GET /tasks/:id/gates/:gateName
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Task ID |
| `gateName` | string | Gate name |

**Response:**
```json
{
  "status": "pending"
}
```

**Gate Statuses:**
- `not-required` - Gate not needed
- `pending` - Awaiting approval
- `approved` - Approved
- `rejected` - Rejected

---

### Approve Gate

Approve a gate to continue task execution.

```http
POST /tasks/:id/gates/:gateName/approve
Content-Type: application/json
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `approver` | string | No | Name of approver |
| `comment` | string | No | Approval comment |

**Example Request:**
```bash
curl -X POST http://localhost:3000/tasks/task_abc123_def456/gates/review/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "john@example.com",
    "comment": "LGTM!"
  }'
```

**Response:**
```json
{
  "ok": true
}
```

---

## Agents

### List Agents

Get all available agents.

```http
GET /agents
```

**Response:**
```json
{
  "agents": {
    "planner": {
      "name": "planner",
      "description": "Creates implementation plans",
      "tools": ["Read", "Grep", "Glob"],
      "model": "opus"
    },
    "developer": {
      "name": "developer",
      "description": "Implements features",
      "tools": ["Read", "Write", "Edit", "Bash"],
      "model": "sonnet"
    }
  }
}
```

---

## Configuration

### Get Configuration

Get the current APEX configuration.

```http
GET /config
```

**Response:**
```json
{
  "version": "1.0",
  "project": {
    "name": "my-project",
    "language": "typescript"
  },
  "autonomy": {
    "default": "review-before-merge"
  },
  "models": {
    "planning": "opus",
    "implementation": "sonnet",
    "review": "haiku"
  },
  "limits": {
    "maxTokensPerTask": 1000000,
    "maxCostPerTask": 10,
    "dailyBudget": 100
  }
}
```

---

## WebSocket Streaming

Connect to receive real-time task updates.

### Connect

```
WS /stream/:taskId
```

**Example (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:3000/stream/task_abc123_def456');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.data);
};

ws.onopen = () => {
  console.log('Connected to task stream');
};

ws.onclose = () => {
  console.log('Disconnected from task stream');
};
```

### Event Types

| Event | Description |
|-------|-------------|
| `task:state` | Initial task state on connection |
| `task:created` | Task was created |
| `task:started` | Task execution started |
| `task:stage-changed` | Workflow stage changed |
| `task:completed` | Task completed successfully |
| `task:failed` | Task failed |
| `agent:message` | Agent sent a message |
| `agent:tool-use` | Agent used a tool |
| `usage:updated` | Token usage updated |
| `log:entry` | New log entry added |
| `gate:approved` | Approval gate was approved |

### Event Format

All events follow this structure:

```json
{
  "type": "event-type",
  "taskId": "task_abc123_def456",
  "timestamp": "2025-01-15T10:35:00.000Z",
  "data": {
    // Event-specific data
  }
}
```

### Example Events

**task:stage-changed:**
```json
{
  "type": "task:stage-changed",
  "taskId": "task_abc123_def456",
  "timestamp": "2025-01-15T10:35:00.000Z",
  "data": {
    "stage": "implementation",
    "status": "in-progress"
  }
}
```

**agent:tool-use:**
```json
{
  "type": "agent:tool-use",
  "taskId": "task_abc123_def456",
  "timestamp": "2025-01-15T10:35:05.000Z",
  "data": {
    "tool": "Write",
    "input": {
      "file_path": "/src/health.ts",
      "content": "..."
    }
  }
}
```

**usage:updated:**
```json
{
  "type": "usage:updated",
  "taskId": "task_abc123_def456",
  "timestamp": "2025-01-15T10:35:10.000Z",
  "data": {
    "inputTokens": 15000,
    "outputTokens": 5000,
    "totalTokens": 20000,
    "estimatedCost": 0.075
  }
}
```

---

## Error Handling

All errors return a JSON response with an `error` field:

```json
{
  "error": "Error message here"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |

---

## Rate Limiting

Currently, no rate limiting is implemented. This will be added in future versions.

---

## SDK Examples

### Node.js

```javascript
const axios = require('axios');

const APEX_URL = 'http://localhost:3000';

// Create a task
async function createTask(description) {
  const response = await axios.post(`${APEX_URL}/tasks`, {
    description,
    workflow: 'feature',
  });
  return response.data;
}

// Get task status
async function getTask(taskId) {
  const response = await axios.get(`${APEX_URL}/tasks/${taskId}`);
  return response.data;
}

// Stream task updates
function streamTask(taskId, onEvent) {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://localhost:3000/stream/${taskId}`);

  ws.on('message', (data) => {
    onEvent(JSON.parse(data));
  });

  return ws;
}

// Usage
async function main() {
  const { taskId } = await createTask('Add user authentication');

  streamTask(taskId, (event) => {
    console.log(`[${event.type}]`, event.data);
  });
}
```

### Python

```python
import requests
import websocket
import json

APEX_URL = 'http://localhost:3000'

def create_task(description):
    response = requests.post(f'{APEX_URL}/tasks', json={
        'description': description,
        'workflow': 'feature'
    })
    return response.json()

def get_task(task_id):
    response = requests.get(f'{APEX_URL}/tasks/{task_id}')
    return response.json()

def stream_task(task_id, on_event):
    ws = websocket.WebSocketApp(
        f'ws://localhost:3000/stream/{task_id}',
        on_message=lambda ws, msg: on_event(json.loads(msg))
    )
    ws.run_forever()

# Usage
if __name__ == '__main__':
    result = create_task('Add user authentication')
    print(f'Created task: {result["taskId"]}')
```

---

## OpenAPI Specification

The full OpenAPI 3.0 specification is available at:

```
GET /openapi.json
```

You can use this with Swagger UI or other OpenAPI tools.

---

## Next Steps

- [Getting Started](getting-started.md) - Initial setup
- [Agent Authoring Guide](agents.md) - Create custom agents
- [Workflow Authoring Guide](workflows.md) - Define workflows
- [Configuration Reference](configuration.md) - Configure APEX
