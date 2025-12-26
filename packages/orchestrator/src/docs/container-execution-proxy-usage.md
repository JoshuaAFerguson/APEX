# ContainerExecutionProxy Usage Guide

The `ContainerExecutionProxy` class provides a unified interface for command execution that automatically routes commands through container or local execution based on the workspace configuration.

## Basic Usage

```typescript
import { ContainerExecutionProxy, createContainerExecutionProxy } from '@apexcli/orchestrator';
import { ContainerManager } from '@apexcli/core';

// Create container manager and proxy
const containerManager = new ContainerManager();
const proxy = createContainerExecutionProxy(containerManager, {
  defaultTimeout: 30000, // 30 seconds
});

// Execute command in container workspace
const containerContext = {
  taskId: 'task-123',
  containerId: 'my-container-id',
  isContainerWorkspace: true,
  runtimeType: 'docker' as const,
  workingDir: '/workspace',
};

const result = await proxy.execute('npm install', containerContext, {
  timeout: 120000, // 2 minutes for npm install
  environment: { NODE_ENV: 'development' },
});

console.log(`Command ${result.success ? 'succeeded' : 'failed'}`);
console.log(`Output: ${result.stdout}`);
console.log(`Mode: ${result.mode}`); // 'container' or 'local'
```

## Local Fallback

```typescript
// Execute command locally when not in container workspace
const localContext = {
  taskId: 'task-456',
  isContainerWorkspace: false,
};

const localResult = await proxy.execute('git status', localContext);
// This will execute locally since isContainerWorkspace is false
```

## Event Handling

```typescript
proxy.on('execution:started', (event) => {
  console.log(`Started ${event.command} in ${event.mode} mode`);
});

proxy.on('execution:completed', (event) => {
  console.log(`Completed ${event.command}, took ${event.result.duration}ms`);
});

proxy.on('execution:failed', (event) => {
  console.error(`Failed ${event.command}: ${event.error}`);
});
```

## Sequential Execution

```typescript
const commands = [
  'npm ci',
  'npm run build',
  'npm test',
];

const results = await proxy.executeSequential(commands, containerContext);

// Results contains array of CommandExecutionResult
// Execution stops on first failure
const allSucceeded = results.every(r => r.success);
```

## Features

- **Automatic Routing**: Commands are routed to container or local execution based on context
- **Timeout Handling**: Configurable timeouts with fallback to default
- **Error Propagation**: Comprehensive error handling and reporting
- **Event System**: Real-time events for monitoring execution
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Flexible Options**: Support for custom working directories, environment variables, and user specification