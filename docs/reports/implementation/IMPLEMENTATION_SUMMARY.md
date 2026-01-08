# Tool Event Streaming Implementation Summary

## Overview
Added tool event streaming to API WebSocket endpoint with event filtering capability.

## Changes Made

### 1. Core Types Updated (`packages/core/src/types.ts`)
- Added `tool:start`, `tool:progress`, `tool:complete` to `ApexEventType` union
- These event types are now properly recognized by the WebSocket streaming system

### 2. API WebSocket Implementation (`packages/api/src/index.ts`)

#### Imports Added
```typescript
import {
  ApexOrchestrator,
  DaemonManager,
  HealthMonitor,
  ToolCallStartEvent,
  ToolCallProgressEvent,
  ToolCallCompleteEvent
} from '@apexcli/orchestrator';
```

#### WebSocket Client Tracking Enhanced
- Updated from `Map<string, Set<WebSocket>>` to `Map<string, Set<WebSocketClient>>`
- Added filtering support with `WebSocketClient` interface:
```typescript
interface WebSocketClient {
  socket: WebSocket;
  eventFilters?: Set<string>;
}
```

#### WebSocket Endpoint Enhanced
- Added query parameter support: `/stream/:taskId?events=tool:start,tool:complete`
- Added event filtering logic in client registration
- Enhanced logging to show active filters

#### Event Broadcasting Updated
- Modified `broadcast()` function to respect client event filters
- Added tool event listeners in `setupEventBroadcasting()`:
  - `tool:start` - emitted when tool call begins
  - `tool:progress` - emitted during long-running operations
  - `tool:complete` - emitted when tool call finishes

#### Documentation Updated
- Added event filtering examples to server startup output
- Listed new tool events in WebSocket events documentation

### 3. Test Coverage (`packages/api/src/websocket-tool-events.test.ts`)
- Created comprehensive tests for tool event streaming
- Tests cover all three tool event types
- Tests verify event filtering functionality
- Tests validate event data structure and content

## Features Implemented

### Event Types Supported
1. **`tool:start`** - Tool call begins
   - Contains: `toolName`, `input`, `callId`

2. **`tool:progress`** - Long-running tool progress updates
   - Contains: `toolName`, `callId`, `progress` (message, percentage)

3. **`tool:complete`** - Tool call completion
   - Contains: `toolName`, `callId`, `result` (success, output/error), `timing`

### Event Filtering
- Client can subscribe to specific event types: `/stream/task123?events=tool:start,tool:complete`
- Multiple event types supported: comma-separated list
- No filtering = receives all events (backward compatible)
- Filters apply per-client, not globally

### Usage Examples

#### Listen to all events
```bash
wscat -c ws://localhost:3000/stream/task123
```

#### Listen to only tool events
```bash
wscat -c ws://localhost:3000/stream/task123?events=tool:start,tool:progress,tool:complete
```

#### Listen to specific tool lifecycle
```bash
wscat -c ws://localhost:3000/stream/task123?events=tool:start,tool:complete
```

## Backward Compatibility
- All existing WebSocket clients continue to work unchanged
- New event types are simply additional events in the stream
- Event filtering is opt-in via query parameters

## Benefits
1. **Real-time tool monitoring** - See what tools agents are using in real-time
2. **Performance visibility** - Track tool execution timing and progress
3. **Debugging capability** - See tool inputs, outputs, and errors as they happen
4. **Selective monitoring** - Filter events to reduce noise for specific use cases
5. **Client efficiency** - Reduce bandwidth by filtering unwanted events

## Technical Implementation Notes
- Event filtering happens at broadcast time, not emission time
- Client disconnections properly clean up tracking
- Event structure follows existing ApexEvent pattern
- Type safety maintained with proper TypeScript interfaces
- Graceful fallback for clients without filtering support