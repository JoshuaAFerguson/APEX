# Docker Events Monitoring for Container Management

## Overview

The `ContainerManager` class now supports real-time monitoring of Docker/Podman events to detect when containers exit unexpectedly. This functionality enables APEX to respond to container failures and emit appropriate lifecycle events.

## Features

- **Real-time Docker Events Monitoring**: Listens to Docker/Podman events stream
- **APEX Container Filtering**: Only monitors containers that belong to APEX (configurable prefix)
- **Container Died Event Detection**: Emits `container:died` events when containers exit unexpectedly
- **Task ID Extraction**: Automatically extracts task IDs from container names following APEX naming conventions
- **OOM Kill Detection**: Identifies when containers are killed due to out-of-memory conditions
- **Signal Detection**: Determines the signal that caused container termination

## API Reference

### Starting Events Monitoring

```typescript
import { ContainerManager } from '@apex/core';

const containerManager = new ContainerManager();

// Start monitoring with default options
await containerManager.startEventsMonitoring();

// Start monitoring with custom options
await containerManager.startEventsMonitoring({
  namePrefix: 'apex',           // Only monitor containers starting with 'apex-'
  eventTypes: ['die', 'start'], // Monitor specific event types
  labelFilters: {               // Filter by container labels
    'apex.managed': 'true'
  }
});
```

### Stopping Events Monitoring

```typescript
// Stop monitoring
await containerManager.stopEventsMonitoring();

// Check if monitoring is active
const isActive = containerManager.isEventsMonitoringActive();
```

### Event Listeners

```typescript
// Listen for container died events
containerManager.on('container:died', (event) => {
  console.log('Container died:', {
    containerId: event.containerId,
    taskId: event.taskId,
    exitCode: event.exitCode,
    signal: event.signal,
    oomKilled: event.oomKilled,
    timestamp: event.timestamp
  });
});

// Listen for all container lifecycle events
containerManager.on('container:lifecycle', (event, operation) => {
  console.log(`Container ${operation}:`, event.containerId);
});
```

## Configuration Options

### `DockerEventsMonitorOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `namePrefix` | `string` | `'apex'` | Only monitor containers with names starting with this prefix |
| `eventTypes` | `string[]` | `['die', 'start', 'stop', 'create', 'destroy']` | Docker event types to monitor |
| `labelFilters` | `Record<string, string>` | `undefined` | Filter containers by labels |

## Event Data Structures

### Container Died Event

The `container:died` event provides detailed information about container failures:

```typescript
interface ContainerDiedEvent {
  containerId: string;          // Docker container ID
  taskId?: string;             // APEX task ID (extracted from name)
  containerInfo?: ContainerInfo; // Additional container details
  timestamp: Date;             // When the event occurred
  exitCode: number;            // Container exit code
  signal?: string;             // Signal that caused termination (e.g., 'SIGKILL')
  oomKilled?: boolean;         // True if killed due to OOM
}
```

## Container Name Convention

APEX containers should follow this naming convention for proper task ID extraction:

- `apex-{taskId}` - Basic format
- `apex-{taskId}-{timestamp}` - With timestamp
- `apex-{taskId}-{suffix}` - With custom suffix

Examples:
- `apex-task123` → Task ID: `task123`
- `apex-feature-branch-worker` → Task ID: `feature`
- `apex-build-abc123def` → Task ID: `build`

## Error Handling

The events monitoring is designed to be resilient:

- **Process Failures**: If the Docker events process fails, monitoring automatically stops
- **Malformed Events**: Invalid JSON events are logged and ignored
- **Container Info Lookup Failures**: Missing container info doesn't prevent event emission
- **Graceful Shutdown**: Monitoring can be stopped gracefully with cleanup

## Example Usage

```typescript
import { ContainerManager } from '@apex/core';

async function setupContainerMonitoring() {
  const containerManager = new ContainerManager();

  // Set up event handlers
  containerManager.on('container:died', async (event) => {
    if (event.taskId) {
      console.log(`Task ${event.taskId} container died with exit code ${event.exitCode}`);

      if (event.oomKilled) {
        console.log('Container was killed due to memory limit');
        // Could trigger task retry with higher memory limits
      }

      // Perform cleanup or notify task management system
      await handleContainerFailure(event.taskId, event.exitCode);
    }
  });

  // Start monitoring for APEX containers only
  await containerManager.startEventsMonitoring({
    namePrefix: 'apex',
    labelFilters: {
      'apex.managed': 'true'
    }
  });

  console.log('Container monitoring started');
}

async function handleContainerFailure(taskId: string, exitCode: number) {
  // Custom logic for handling container failures
  // - Log the failure
  // - Update task status
  // - Trigger retry logic
  // - Clean up resources
}
```

## Integration with Task Management

The container events monitoring integrates naturally with APEX's task management system:

1. **Task Association**: Task IDs are automatically extracted from container names
2. **Failure Detection**: Unexpected container exits trigger `container:died` events
3. **Cleanup Triggers**: Events can trigger task cleanup and retry logic
4. **Resource Monitoring**: OOM detection helps identify resource constraint issues

## Performance Considerations

- **Low Overhead**: Monitoring uses Docker's native events stream
- **Efficient Filtering**: Events are filtered at the Docker level where possible
- **Async Processing**: Event handling is non-blocking
- **Resource Cleanup**: Processes are properly cleaned up when monitoring stops

## Troubleshooting

### Common Issues

1. **No Events Received**
   - Verify Docker/Podman is running
   - Check container naming convention
   - Ensure containers have proper labels

2. **Process Exits Unexpectedly**
   - Check Docker daemon logs
   - Verify permissions for Docker API access
   - Check for Docker CLI availability

3. **Task IDs Not Extracted**
   - Verify container names follow APEX convention
   - Check container name in Docker events output
   - Review filtering configuration

### Debug Information

```typescript
// Check monitoring status
console.log('Monitoring active:', containerManager.isEventsMonitoringActive());

// Get current configuration
console.log('Options:', containerManager.getMonitoringOptions());

// Monitor stderr output for Docker errors
// (automatically logged to console)
```