# ADR-046: POST /mcp/install/:id Endpoint with WebSocket Progress Events

## Status
Proposed

## Context

The APEX platform requires a new API endpoint `POST /mcp/install/:id` that initiates asynchronous MCP server installation with real-time progress tracking via WebSocket events. This feature enables users to:

1. Install MCP servers from the marketplace asynchronously
2. Track installation progress in real-time through WebSocket events
3. Handle installation failures gracefully with proper error reporting
4. Maintain an installation registry for tracking installed servers

### Requirements from Acceptance Criteria

- Route registered at `POST /mcp/install/:id` in @apex/api
- Initiates async installation of MCP server
- Emits WebSocket events: `mcp:install:start`, `mcp:install:progress` (with stage/percentage), `mcp:install:complete`, `mcp:install:error`
- Updates local installation registry
- Returns 202 Accepted with installation tracking ID

## Decision

### 1. API Route Design

**Endpoint**: `POST /mcp/install/:id`

**Request**:
```typescript
interface MCPInstallRequest {
  // Optional configuration overrides
  config?: {
    env?: Record<string, string>;
    args?: string[];
    autoStart?: boolean;
  };
  // Force reinstallation if already installed
  force?: boolean;
}
```

**Response** (202 Accepted):
```typescript
interface MCPInstallResponse {
  installationId: string;      // Unique tracking ID for this installation
  serverId: string;            // The MCP server ID being installed
  status: 'pending';           // Initial status
  message: string;             // Human-readable message
  streamUrl: string;           // WebSocket URL for progress updates
}
```

### 2. WebSocket Event Schema

All MCP installation events follow the existing `ApexEvent` pattern:

```typescript
// New event types to add to ApexEventType union
type MCPInstallEventType =
  | 'mcp:install:start'
  | 'mcp:install:progress'
  | 'mcp:install:complete'
  | 'mcp:install:error';
```

**Event Payloads**:

```typescript
// mcp:install:start
interface MCPInstallStartEventData {
  installationId: string;
  serverId: string;
  serverName: string;
  version?: string;
  startedAt: Date;
}

// mcp:install:progress
interface MCPInstallProgressEventData {
  installationId: string;
  serverId: string;
  stage: MCPInstallStage;  // Reuse existing: 'initializing' | 'downloading' | 'extracting' | 'installing' | 'configuring' | 'verifying' | 'completing'
  progress: number;         // 0-100
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  estimatedTimeRemaining?: number;
}

// mcp:install:complete
interface MCPInstallCompleteEventData {
  installationId: string;
  serverId: string;
  serverName: string;
  config: MCPServerConfig;
  installedAt: Date;
  duration: number;  // milliseconds
}

// mcp:install:error
interface MCPInstallErrorEventData {
  installationId: string;
  serverId: string;
  stage: MCPInstallStage;
  error: {
    code: string;
    message: string;
    stack?: string;
  };
  failedAt: Date;
}
```

### 3. Architecture Components

#### 3.1 API Layer (@apex/api)

```
packages/api/src/index.ts
├── POST /mcp/install/:id endpoint registration
├── WebSocket event broadcasting for mcp:install:* events
└── Integration with orchestrator.installMcpServerAsync()
```

**Key Design Decisions**:
- Use existing `broadcast()` function for WebSocket events
- Use installation ID as the WebSocket channel (like task ID)
- Return 202 Accepted immediately after validation
- Background processing via orchestrator

#### 3.2 Orchestrator Layer (@apex/orchestrator)

```
packages/orchestrator/src/index.ts
├── installMcpServerAsync(id, options) -> Promise<MCPInstallResponse>
├── Event emissions for installation progress
└── Installation registry updates via MCPInstaller
```

**New Method in ApexOrchestrator**:
```typescript
public async installMcpServerAsync(
  serverId: string,
  options?: MCPAsyncInstallOptions
): Promise<{
  installationId: string;
  serverId: string;
  status: 'pending';
}> {
  // 1. Validate server exists in marketplace
  // 2. Generate unique installation ID
  // 3. Emit 'mcp:install:start' event
  // 4. Start async installation process
  // 5. Return immediately with tracking info
}
```

#### 3.3 MCPInstaller Enhancement

```
packages/orchestrator/src/mcp-installer.ts
├── installWithProgress(server, options, progressCallback) -> Promise<MCPInstallation>
└── Progress callback invoked at each stage
```

### 4. Event Flow

```
Client                  API                    Orchestrator          MCPInstaller
  │                      │                          │                     │
  │ POST /mcp/install/x  │                          │                     │
  │─────────────────────>│                          │                     │
  │                      │ installMcpServerAsync()  │                     │
  │                      │─────────────────────────>│                     │
  │                      │<─ {installationId}       │                     │
  │<── 202 Accepted ─────│                          │                     │
  │                      │                          │ installWithProgress()│
  │                      │                          │────────────────────>│
  │                      │ emit mcp:install:start   │                     │
  │<── WS: start ────────│<────────────────────────│                     │
  │                      │                          │    progress cb      │
  │                      │ emit mcp:install:progress│<────────────────────│
  │<── WS: progress ─────│<────────────────────────│                     │
  │                      │                          │    ... more stages  │
  │                      │ emit mcp:install:complete│<────────────────────│
  │<── WS: complete ─────│<────────────────────────│                     │
  │                      │                          │                     │
```

### 5. Installation Registry

The local installation registry is maintained in SQLite via the existing `TaskStore`:

- Uses existing `MCPInstallation` schema
- Updates status through installation lifecycle
- Tracks installation metadata (timestamps, config path)

### 6. Error Handling

| Error Scenario | HTTP Response | WebSocket Event |
|----------------|---------------|-----------------|
| Server not found | 404 Not Found | None |
| Already installed (no force) | 409 Conflict | None |
| Invalid server ID | 400 Bad Request | None |
| Installation failed | - | mcp:install:error |
| Download failed | - | mcp:install:error with stage='downloading' |
| Configuration failed | - | mcp:install:error with stage='configuring' |

### 7. WebSocket Channel Strategy

For installation progress events, we use the **installation ID as the channel**:

```typescript
// Broadcasting pattern
broadcast(installationId, {
  type: 'mcp:install:progress',
  taskId: installationId,  // Use installationId as taskId for consistency
  timestamp: new Date(),
  data: progressData
});
```

Clients connect to: `ws://host:port/stream/{installationId}`

### 8. Type Exports

New types to export from `@apexcli/core`:

```typescript
// Event data interfaces
export interface MCPInstallStartEventData { ... }
export interface MCPInstallProgressEventData { ... }
export interface MCPInstallCompleteEventData { ... }
export interface MCPInstallErrorEventData { ... }

// Request/Response types
export interface MCPAsyncInstallOptions { ... }
export interface MCPAsyncInstallResponse { ... }
```

### 9. Implementation Phases

1. **Phase 1: Core Types** (in @apex/core)
   - Add new event types to ApexEventType union
   - Define event data interfaces
   - Define request/response types

2. **Phase 2: Orchestrator** (in @apex/orchestrator)
   - Add `installMcpServerAsync()` method
   - Enhance MCPInstaller with progress callbacks
   - Wire up event emissions

3. **Phase 3: API Endpoint** (in @apex/api)
   - Register POST /mcp/install/:id route
   - Configure WebSocket event broadcasting
   - Implement error handling

4. **Phase 4: Testing**
   - Unit tests for new types
   - Integration tests for async installation
   - WebSocket event streaming tests

## Consequences

### Positive

1. **Real-time feedback**: Users can monitor installation progress via WebSocket
2. **Non-blocking**: 202 Accepted response allows immediate UI feedback
3. **Consistent patterns**: Reuses existing event broadcasting infrastructure
4. **Type safety**: Full TypeScript types for all events and responses
5. **Trackable**: Installation ID enables status querying and troubleshooting

### Negative

1. **Complexity**: Adds async processing and event coordination
2. **State management**: Must handle partial failures and cleanup
3. **WebSocket dependency**: Clients need WebSocket support for progress

### Risks

1. **Long-running installations**: May need timeout handling
2. **Concurrent installations**: Need to handle multiple simultaneous installs
3. **Registry consistency**: Must ensure registry stays in sync with actual state

## Alternatives Considered

### Alternative 1: Synchronous Installation
- Simpler implementation but blocks client
- Poor UX for large packages
- Rejected due to potential timeout issues

### Alternative 2: Polling-based Progress
- Uses HTTP polling instead of WebSocket
- Simpler client implementation
- Rejected due to inefficiency and delayed updates

### Alternative 3: Server-Sent Events (SSE)
- Simpler than WebSocket for one-way communication
- Less infrastructure overhead
- Rejected to maintain consistency with existing WebSocket patterns

## References

- Existing MCP types: `packages/core/src/types.ts` (MCPInstallStage, MCPInstallProgress, MCPInstallation)
- MCPInstaller implementation: `packages/orchestrator/src/mcp-installer.ts`
- WebSocket event broadcasting: `packages/api/src/index.ts` (broadcast function, setupEventBroadcasting)
- Orchestrator MCP methods: `packages/orchestrator/src/index.ts` (installMcpServer, listMcpInstallations)
