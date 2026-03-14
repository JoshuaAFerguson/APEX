# ADR-202: MCP Install/Uninstall Event Broadcasting Architecture

## Status
Proposed

## Context

The APEX system needs to provide real-time WebSocket notifications when MCP (Model Context Protocol) servers are installed or uninstalled. Currently, MCP install/uninstall events are broadcast directly from HTTP endpoint handlers in `packages/api/src/index.ts`, using `as any` type casts to bypass type checking.

### Current Implementation Issues
1. Events are broadcast directly from API handlers, not through the orchestrator event system
2. Event types are not defined in `OrchestratorEvents` interface
3. No `mcp:install-progress` event exists - only start, complete, and error
4. Inconsistent with other event patterns in the codebase (tool events, autofix events, etc.)

### Acceptance Criteria Requirements
- Orchestrator emits MCP installation events
- `setupEventBroadcasting` subscribes to these events
- WebSocket clients receive real-time installation progress
- Error events include full error details

## Decision

### 1. Event Type Definitions

Add the following event types to `OrchestratorEvents` interface in `packages/orchestrator/src/index.ts`:

```typescript
// MCP Installation events (v0.6.0)
'mcp:install-start': (event: MCPInstallStartEventData) => void;
'mcp:install-progress': (event: MCPInstallProgressEventData) => void;
'mcp:install-complete': (event: MCPInstallCompleteEventData) => void;
'mcp:install-error': (event: MCPInstallErrorEventData) => void;
'mcp:uninstall-start': (event: MCPUninstallStartEventData) => void;
'mcp:uninstall-complete': (event: MCPUninstallCompleteEventData) => void;
'mcp:uninstall-error': (event: MCPUninstallErrorEventData) => void;
```

### 2. Event Data Interfaces

Define event data interfaces in `packages/orchestrator/src/index.ts`:

```typescript
export interface MCPInstallStartEventData {
  serverId: string;
  serverName?: string;
  stage: 'starting';
  progress: 0;
  message: string;
  timestamp: Date;
}

export interface MCPInstallProgressEventData {
  serverId: string;
  serverName?: string;
  stage: 'downloading' | 'installing' | 'configuring' | 'verifying';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
}

export interface MCPInstallCompleteEventData {
  serverId: string;
  serverName?: string;
  stage: 'complete';
  progress: 100;
  message: string;
  config: MCPServerConfig;
  timestamp: Date;
}

export interface MCPInstallErrorEventData {
  serverId: string;
  serverName?: string;
  stage: 'error';
  progress: number;
  message: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
    recoverable: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
}

export interface MCPUninstallStartEventData {
  serverId: string;
  serverName?: string;
  stage: 'uninstalling';
  progress: 0;
  message: string;
  timestamp: Date;
}

export interface MCPUninstallCompleteEventData {
  serverId: string;
  serverName?: string;
  stage: 'complete';
  progress: 100;
  message: string;
  timestamp: Date;
}

export interface MCPUninstallErrorEventData {
  serverId: string;
  serverName?: string;
  stage: 'error';
  progress: number;
  message: string;
  error: {
    message: string;
    code?: string;
    stack?: string;
    recoverable: boolean;
    suggestedAction?: string;
  };
  timestamp: Date;
}
```

### 3. Orchestrator Method Updates

Update `installMcpServer` and `uninstallMcpServer` methods to emit events:

```typescript
public async installMcpServer(name: string): Promise<MCPServerConfig> {
  if (!this.mcpServerManager) {
    throw new Error('MCP server manager not initialized');
  }

  // Emit start event
  this.emit('mcp:install-start', {
    serverId: name,
    stage: 'starting',
    progress: 0,
    message: `Starting installation of MCP server '${name}'`,
    timestamp: new Date(),
  });

  try {
    // Emit progress events during installation
    this.emit('mcp:install-progress', {
      serverId: name,
      stage: 'installing',
      progress: 50,
      message: `Installing MCP server '${name}'`,
      timestamp: new Date(),
    });

    const installed = await this.mcpServerManager.installServer(name);
    this.config = await loadConfig(this.projectPath);
    this.effectiveConfig = getEffectiveConfig(this.config);
    this.mcpServerManager.updateConfig(this.config);

    // Emit complete event
    this.emit('mcp:install-complete', {
      serverId: name,
      stage: 'complete',
      progress: 100,
      message: `MCP server '${name}' installed successfully`,
      config: installed,
      timestamp: new Date(),
    });

    return installed;
  } catch (error) {
    // Emit error event with full details
    this.emit('mcp:install-error', {
      serverId: name,
      stage: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : `Failed to install MCP server '${name}'`,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        recoverable: true,
        suggestedAction: 'Check network connectivity and try again',
      },
      timestamp: new Date(),
    });
    throw error;
  }
}
```

### 4. API Event Broadcasting Setup

Add MCP event handlers in `setupEventBroadcasting()` function:

```typescript
// MCP Installation events (v0.6.0)
orchestrator.on('mcp:install-start', (event: MCPInstallStartEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:install-start',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
    },
  });
});

orchestrator.on('mcp:install-progress', (event: MCPInstallProgressEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:install-progress',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
    },
  });
});

orchestrator.on('mcp:install-complete', (event: MCPInstallCompleteEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:install-complete',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
      config: event.config,
    },
  });
});

orchestrator.on('mcp:install-error', (event: MCPInstallErrorEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:install-error',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
      error: event.error,
    },
  });
});

// Similar handlers for uninstall events
orchestrator.on('mcp:uninstall-start', (event: MCPUninstallStartEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:uninstall-start',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
    },
  });
});

orchestrator.on('mcp:uninstall-complete', (event: MCPUninstallCompleteEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:uninstall-complete',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
    },
  });
});

orchestrator.on('mcp:uninstall-error', (event: MCPUninstallErrorEventData) => {
  broadcast('mcp-installation', {
    type: 'mcp:uninstall-error',
    taskId: 'mcp-installation',
    timestamp: event.timestamp,
    data: {
      serverId: event.serverId,
      serverName: event.serverName,
      stage: event.stage,
      progress: event.progress,
      message: event.message,
      error: event.error,
    },
  });
});
```

### 5. Remove Direct Broadcasts from HTTP Handlers

After wiring up orchestrator events, remove the direct `broadcast()` calls from the HTTP endpoint handlers (`/mcp/install/:id` and `/mcp/uninstall/:id`). The orchestrator methods will emit the events, and `setupEventBroadcasting` will handle broadcasting to WebSocket clients.

## Implementation Plan

### Phase 1: Orchestrator Changes
1. Add event data interfaces to `packages/orchestrator/src/index.ts`
2. Add event signatures to `OrchestratorEvents` interface
3. Update `installMcpServer` and `installMcpServerEnhanced` methods to emit events
4. Update `uninstallMcpServer` and `uninstallMcpServerEnhanced` methods to emit events
5. Export new interfaces

### Phase 2: API Changes
1. Import new event data interfaces in `packages/api/src/index.ts`
2. Add event handlers in `setupEventBroadcasting()` function
3. Remove direct `broadcast()` calls from HTTP handlers (or keep as fallback)
4. Update type casts to use proper types instead of `as any`

### Phase 3: Testing
1. Add unit tests for event emission in orchestrator
2. Add integration tests for WebSocket event broadcasting
3. Verify end-to-end flow from HTTP request to WebSocket notification

## Files to Modify

1. `packages/orchestrator/src/index.ts`
   - Add event data interfaces (~100 lines)
   - Update `OrchestratorEvents` interface (~10 lines)
   - Update `installMcpServer` method (~30 lines)
   - Update `uninstallMcpServer` method (~30 lines)

2. `packages/api/src/index.ts`
   - Add event handlers in `setupEventBroadcasting` (~80 lines)
   - Optionally remove or simplify HTTP handler broadcasts (~20 lines)

## Consequences

### Positive
- Consistent event pattern with other orchestrator events
- Proper type safety (no `as any` casts)
- Real-time progress updates via WebSocket
- Error events include full details for debugging
- Decouples event emission from HTTP handlers
- Easier to test in isolation

### Negative
- Requires changes to both orchestrator and API packages
- Slight increase in code complexity
- Need to ensure both direct and event-based paths work during transition

### Neutral
- Uses existing `broadcast()` function infrastructure
- Maintains backward compatibility with existing WebSocket clients
- Event channel remains `'mcp-installation'` for consistency

## References

- Existing event patterns in `setupEventBroadcasting` (tool events, autofix events)
- `OrchestratorEvents` interface structure
- MCP server manager implementation
