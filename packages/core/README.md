# @apexcli/core

Core types, configuration, and utilities for the APEX platform.

## Overview

This package provides the foundational building blocks for APEX:

- **Type Definitions** - Zod schemas and TypeScript types for tasks, agents, workflows, and more
- **Configuration Loading** - Parse and validate `.apex/config.yaml` files
- **Utility Functions** - Common helpers for formatting, validation, and data manipulation

## Installation

```bash
npm install @apexcli/core
```

## Usage

### Types

```typescript
import {
  Task,
  TaskSchema,
  Agent,
  AgentSchema,
  Workflow,
  WorkflowSchema,
  ApexConfig
} from '@apexcli/core';

// Validate task data
const task = TaskSchema.parse({
  id: 'task_123',
  description: 'Implement feature X',
  status: 'pending',
  // ...
});
```

### Configuration

```typescript
import { loadConfig, loadAgents, loadWorkflows } from '@apexcli/core';

// Load project configuration
const config = await loadConfig('/path/to/project');

// Load agent definitions
const agents = await loadAgents('/path/to/project/.apex/agents');

// Load workflow definitions
const workflows = await loadWorkflows('/path/to/project/.apex/workflows');
```

### Utilities

```typescript
import {
  formatDuration,
  formatBytes,
  calculateCost,
  generateId
} from '@apexcli/core';

// Format a duration in milliseconds
formatDuration(3600000); // "1h 0m 0s"

// Format bytes
formatBytes(1048576); // "1.00 MB"

// Calculate token cost
calculateCost(1000, 500, 'claude-3-opus'); // 0.045
```

## Key Types

| Type | Description |
|------|-------------|
| `Task` | A unit of work with status, agent, and workflow |
| `Agent` | AI agent definition with capabilities and prompts |
| `Workflow` | Multi-stage development workflow |
| `ApexConfig` | Project configuration schema |
| `TaskStatus` | Task lifecycle states |

## Related Packages

- [@apexcli/orchestrator](https://www.npmjs.com/package/@apexcli/orchestrator) - Task execution engine
- [@apexcli/cli](https://www.npmjs.com/package/@apexcli/cli) - Command-line interface
- [@apexcli/api](https://www.npmjs.com/package/@apexcli/api) - REST API server

## License

MIT
