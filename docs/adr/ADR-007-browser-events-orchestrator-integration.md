# ADR-007: Browser Events Integration with Orchestrator Streaming

**Status**: Proposed
**Date**: 2025-01-10
**Decision**: Design specification for integrating browser events with orchestrator streaming
**Author**: Architect Agent

## Context

The APEX platform has comprehensive browser automation capabilities through the `@apexcli/browser` package with `BrowserManager` and `BrowserSession` classes. Currently, browser events (console messages, JavaScript errors, page errors, etc.) are captured locally within browser sessions but are not integrated with the orchestrator's event streaming system. This limits visibility into browser activity during task execution.

### Current State

1. **Browser Package (`@apexcli/browser`)**:
   - `BrowserSession` extends `EventEmitter<BrowserCaptureEvents>` with events: `consoleMessage`, `javascriptError`, `pageError`
   - `BrowserManager` extends `EventEmitter<BrowserManagerEvents>` with events: `browserCreated`, `browserClosed`, `contextCreated`, `contextClosed`, `resourceLimitExceeded`

2. **Orchestrator Package (`@apexcli/orchestrator`)**:
   - `BrowserConsoleStream` provides enhanced console capture with severity levels, error categorization, and session tracking
   - `BrowserTool` wraps browser operations with permission checks and captures console/error data in operation results
   - `ApexOrchestrator` extends `EventEmitter<OrchestratorEvents>` with 70+ event types

3. **API Package (`@apexcli/api`)**:
   - `setupEventBroadcasting()` subscribes to orchestrator events and broadcasts via WebSocket
   - Supports per-client event filtering

4. **CLI Package (`@apexcli/cli`)**:
   - `useOrchestratorEvents` hook transforms orchestrator events into React component state

### Problem

- Browser console messages and errors are not streamed to CLI/API consumers in real-time
- No correlation between browser events and task context for debugging
- CLI cannot display browser activity during task execution
- WebSocket clients cannot subscribe to browser-specific events

## Decision

### 1. New Event Types

Add browser-specific event types to `ApexEventType` in `@apexcli/core`:

```typescript
// packages/core/src/types.ts
export type ApexEventType =
  // ... existing events ...
  // Browser automation events
  | 'browser:console'           // Console message from browser
  | 'browser:error'             // JavaScript/runtime error
  | 'browser:network-error'     // Network request failures
  | 'browser:performance'       // Performance warnings
  | 'browser:session-created'   // Browser session started
  | 'browser:session-closed'    // Browser session ended
  | 'browser:navigation'        // Page navigation events
  | 'browser:screenshot';       // Screenshot captured
```

### 2. Browser Event Data Types

Add typed event data interfaces to `@apexcli/core`:

```typescript
// packages/core/src/types.ts

/**
 * Severity levels for browser console messages
 */
export const BrowserConsoleSeveritySchema = z.enum([
  'verbose', 'debug', 'log', 'info', 'warn', 'error', 'fatal'
]);
export type BrowserConsoleSeverity = z.infer<typeof BrowserConsoleSeveritySchema>;

/**
 * Browser error categories for classification
 */
export const BrowserErrorCategorySchema = z.enum([
  'javascript', 'network', 'security', 'permission', 'resource', 'unknown'
]);
export type BrowserErrorCategory = z.infer<typeof BrowserErrorCategorySchema>;

/**
 * Base interface for all browser event data
 */
export interface BrowserEventDataBase {
  /** Task ID for correlation */
  taskId: string;
  /** Browser session ID */
  sessionId: string;
  /** Current page URL */
  pageUrl?: string;
  /** Page title */
  pageTitle?: string;
  /** User agent string */
  userAgent?: string;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Event data for 'browser:console' event
 */
export interface BrowserConsoleEventData extends BrowserEventDataBase {
  /** Console message severity level */
  severity: BrowserConsoleSeverity;
  /** Message text */
  message: string;
  /** Original arguments passed to console method */
  args?: unknown[];
  /** Source location (URL, line, column) */
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

/**
 * Event data for 'browser:error' event
 */
export interface BrowserErrorEventData extends BrowserEventDataBase {
  /** Error category for classification */
  category: BrowserErrorCategory;
  /** Error message */
  message: string;
  /** Error name/type */
  name?: string;
  /** Stack trace */
  stack?: string;
  /** Source location */
  source?: {
    url?: string;
    line?: number;
    column?: number;
  };
  /** Whether the error was uncaught */
  uncaught: boolean;
  /** Error severity for prioritization */
  errorSeverity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Event data for 'browser:network-error' event
 */
export interface BrowserNetworkErrorEventData extends BrowserEventDataBase {
  /** Failed request URL */
  requestUrl: string;
  /** HTTP method */
  method: string;
  /** HTTP status code (if available) */
  statusCode?: number;
  /** Error message */
  errorMessage: string;
  /** Request headers (sanitized) */
  headers?: Record<string, string>;
}

/**
 * Event data for 'browser:session-created' event
 */
export interface BrowserSessionCreatedEventData extends BrowserEventDataBase {
  /** Browser engine being used */
  engine: 'chromium' | 'firefox' | 'webkit';
  /** Whether running headless */
  headless: boolean;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
}

/**
 * Event data for 'browser:session-closed' event
 */
export interface BrowserSessionClosedEventData extends BrowserEventDataBase {
  /** Total session duration in milliseconds */
  duration: number;
  /** Number of console messages captured */
  consoleMessageCount: number;
  /** Number of errors captured */
  errorCount: number;
  /** Exit reason */
  reason: 'completed' | 'error' | 'timeout' | 'cancelled';
}

/**
 * Event data for 'browser:navigation' event
 */
export interface BrowserNavigationEventData extends BrowserEventDataBase {
  /** Navigation type */
  type: 'navigate' | 'reload' | 'back' | 'forward';
  /** Target URL */
  url: string;
  /** HTTP status code */
  statusCode?: number;
  /** Navigation timing (DOMContentLoaded, load) */
  timing?: {
    domContentLoaded?: number;
    load?: number;
  };
}

/**
 * Event data for 'browser:screenshot' event
 */
export interface BrowserScreenshotEventData extends BrowserEventDataBase {
  /** Screenshot file path or base64 data reference */
  path?: string;
  /** Whether full page was captured */
  fullPage: boolean;
  /** Dimensions */
  dimensions: { width: number; height: number };
  /** Image format */
  format: 'png' | 'jpeg';
  /** File size in bytes (if saved to file) */
  fileSize?: number;
}
```

### 3. OrchestratorEvents Interface Updates

Extend `OrchestratorEvents` in `@apexcli/orchestrator`:

```typescript
// packages/orchestrator/src/index.ts

export interface OrchestratorEvents {
  // ... existing events ...

  // Browser events
  'browser:console': (eventData: BrowserConsoleEventData) => void;
  'browser:error': (eventData: BrowserErrorEventData) => void;
  'browser:network-error': (eventData: BrowserNetworkErrorEventData) => void;
  'browser:performance': (eventData: BrowserPerformanceEventData) => void;
  'browser:session-created': (eventData: BrowserSessionCreatedEventData) => void;
  'browser:session-closed': (eventData: BrowserSessionClosedEventData) => void;
  'browser:navigation': (eventData: BrowserNavigationEventData) => void;
  'browser:screenshot': (eventData: BrowserScreenshotEventData) => void;
}
```

### 4. BrowserEventAdapter Class

Create a new adapter class to bridge browser events to orchestrator:

```typescript
// packages/orchestrator/src/browser-event-adapter.ts

import { EventEmitter } from 'eventemitter3';
import { BrowserConsoleStream, ConsoleStreamEvents } from './browser-console-stream';
import {
  BrowserConsoleEventData,
  BrowserErrorEventData,
  BrowserNetworkErrorEventData,
  BrowserSessionCreatedEventData,
  BrowserSessionClosedEventData,
  BrowserNavigationEventData,
  BrowserScreenshotEventData,
} from '@apexcli/core';

/**
 * Configuration for browser event adapter
 */
export interface BrowserEventAdapterConfig {
  /** Task ID for event correlation */
  taskId: string;
  /** Minimum console severity to emit (default: 'info') */
  minConsoleSeverity?: BrowserConsoleSeverity;
  /** Maximum buffer size for console messages (default: 100) */
  maxBufferSize?: number;
  /** Whether to include full error stacks (default: true) */
  includeStacks?: boolean;
  /** Whether to batch console messages (default: false) */
  batchConsoleMessages?: boolean;
  /** Batch interval in milliseconds (default: 100) */
  batchInterval?: number;
}

/**
 * Events emitted by BrowserEventAdapter
 */
export interface BrowserEventAdapterEvents {
  'browser:console': (eventData: BrowserConsoleEventData) => void;
  'browser:error': (eventData: BrowserErrorEventData) => void;
  'browser:network-error': (eventData: BrowserNetworkErrorEventData) => void;
  'browser:session-created': (eventData: BrowserSessionCreatedEventData) => void;
  'browser:session-closed': (eventData: BrowserSessionClosedEventData) => void;
  'browser:navigation': (eventData: BrowserNavigationEventData) => void;
  'browser:screenshot': (eventData: BrowserScreenshotEventData) => void;
}

/**
 * BrowserEventAdapter bridges browser session events to orchestrator events
 *
 * This adapter:
 * - Subscribes to BrowserConsoleStream events
 * - Enriches events with task context (taskId, sessionId)
 * - Filters and transforms events based on configuration
 * - Emits orchestrator-compatible events
 * - Supports batching for high-volume console output
 */
export class BrowserEventAdapter extends EventEmitter<BrowserEventAdapterEvents> {
  private config: Required<BrowserEventAdapterConfig>;
  private sessionId: string;
  private consoleStream?: BrowserConsoleStream;
  private sessionStartTime: Date;
  private consoleMessageCount: number = 0;
  private errorCount: number = 0;
  private batchBuffer: BrowserConsoleEventData[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(config: BrowserEventAdapterConfig) {
    super();
    this.config = {
      taskId: config.taskId,
      minConsoleSeverity: config.minConsoleSeverity ?? 'info',
      maxBufferSize: config.maxBufferSize ?? 100,
      includeStacks: config.includeStacks ?? true,
      batchConsoleMessages: config.batchConsoleMessages ?? false,
      batchInterval: config.batchInterval ?? 100,
    };
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
  }

  /**
   * Attach to a BrowserConsoleStream and start forwarding events
   */
  attach(consoleStream: BrowserConsoleStream): void {
    this.consoleStream = consoleStream;

    // Subscribe to console messages
    consoleStream.on('message', (message) => {
      this.handleConsoleMessage(message);
    });

    // Subscribe to errors
    consoleStream.on('error', (error) => {
      this.handleError(error);
    });

    // Subscribe to network errors
    consoleStream.on('network-error', (error) => {
      this.handleNetworkError(error);
    });

    // Subscribe to performance warnings
    consoleStream.on('performance-warning', (warning) => {
      this.handlePerformanceWarning(warning);
    });
  }

  /**
   * Emit session created event
   */
  emitSessionCreated(details: {
    engine: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    viewport?: { width: number; height: number };
    pageUrl?: string;
  }): void {
    const eventData: BrowserSessionCreatedEventData = {
      taskId: this.config.taskId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      ...details,
    };
    this.emit('browser:session-created', eventData);
  }

  /**
   * Emit session closed event and cleanup
   */
  emitSessionClosed(reason: 'completed' | 'error' | 'timeout' | 'cancelled'): void {
    this.flushBatch(); // Flush any pending batched messages

    const eventData: BrowserSessionClosedEventData = {
      taskId: this.config.taskId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      duration: Date.now() - this.sessionStartTime.getTime(),
      consoleMessageCount: this.consoleMessageCount,
      errorCount: this.errorCount,
      reason,
    };
    this.emit('browser:session-closed', eventData);
    this.cleanup();
  }

  /**
   * Emit navigation event
   */
  emitNavigation(details: {
    type: 'navigate' | 'reload' | 'back' | 'forward';
    url: string;
    statusCode?: number;
    timing?: { domContentLoaded?: number; load?: number };
  }): void {
    const eventData: BrowserNavigationEventData = {
      taskId: this.config.taskId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      pageUrl: details.url,
      ...details,
    };
    this.emit('browser:navigation', eventData);
  }

  /**
   * Emit screenshot event
   */
  emitScreenshot(details: {
    path?: string;
    fullPage: boolean;
    dimensions: { width: number; height: number };
    format: 'png' | 'jpeg';
    fileSize?: number;
    pageUrl?: string;
  }): void {
    const eventData: BrowserScreenshotEventData = {
      taskId: this.config.taskId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      ...details,
    };
    this.emit('browser:screenshot', eventData);
  }

  // ... private methods for handling events, batching, filtering ...

  private generateSessionId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanup(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.consoleStream?.removeAllListeners();
  }
}
```

### 5. Integration Points

#### 5.1 BrowserTool Integration

Modify `BrowserTool` to use `BrowserEventAdapter`:

```typescript
// packages/orchestrator/src/tools/browser-tool.ts

export class BrowserTool {
  private eventAdapter?: BrowserEventAdapter;
  private orchestrator?: ApexOrchestrator;

  /**
   * Set orchestrator for event forwarding
   */
  setOrchestrator(orchestrator: ApexOrchestrator): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Set up browser event adapter for a task
   */
  private setupEventAdapter(taskId: string): void {
    this.eventAdapter = new BrowserEventAdapter({ taskId });

    // Forward adapter events to orchestrator
    if (this.orchestrator) {
      this.eventAdapter.on('browser:console', (data) =>
        this.orchestrator!.emit('browser:console', data));
      this.eventAdapter.on('browser:error', (data) =>
        this.orchestrator!.emit('browser:error', data));
      // ... other event types
    }

    // Attach to console stream if available
    if (this.consoleStream) {
      this.eventAdapter.attach(this.consoleStream);
    }
  }
}
```

#### 5.2 API Event Broadcasting

Update `setupEventBroadcasting` in `@apexcli/api`:

```typescript
// packages/api/src/index.ts

function setupEventBroadcasting(orchestrator: ApexOrchestrator): void {
  // ... existing event handlers ...

  // Browser events
  orchestrator.on('browser:console', (eventData) => {
    broadcast(eventData.taskId, {
      type: 'browser:console',
      taskId: eventData.taskId,
      timestamp: new Date(),
      data: { ...eventData },
    });
  });

  orchestrator.on('browser:error', (eventData) => {
    broadcast(eventData.taskId, {
      type: 'browser:error',
      taskId: eventData.taskId,
      timestamp: new Date(),
      data: { ...eventData },
    });
  });

  // ... other browser events
}
```

#### 5.3 CLI Hook Updates

Update `useOrchestratorEvents` to handle browser events:

```typescript
// packages/cli/src/ui/hooks/useOrchestratorEvents.ts

export interface OrchestratorEventState {
  // ... existing state ...

  /** Browser console messages for current task */
  browserConsole: BrowserConsoleEventData[];
  /** Browser errors for current task */
  browserErrors: BrowserErrorEventData[];
  /** Current browser session info */
  browserSession?: {
    sessionId: string;
    engine: string;
    pageUrl?: string;
  };
}

// Add event handlers for browser events
orchestrator.on('browser:console', (eventData) => {
  setState((prev) => ({
    ...prev,
    browserConsole: [...prev.browserConsole.slice(-99), eventData],
  }));
});

orchestrator.on('browser:error', (eventData) => {
  setState((prev) => ({
    ...prev,
    browserErrors: [...prev.browserErrors, eventData],
  }));
});
```

### 6. Event Filtering and Buffering

To handle high-volume browser output:

1. **Severity Filtering**: Only emit console messages at or above configured severity level
2. **Buffering**: Batch console messages in short intervals to reduce event volume
3. **Buffer Limits**: Maintain rolling buffer with configurable max size
4. **Deduplication**: Optionally deduplicate repeated console messages

### 7. Task Context Correlation

All browser events include:
- `taskId`: Associates browser activity with APEX tasks
- `sessionId`: Unique identifier for browser session (for multi-session scenarios)
- `timestamp`: Event timing for correlation and replay

## Consequences

### Positive

1. **Real-time Visibility**: CLI/API consumers can monitor browser activity during task execution
2. **Debugging Support**: Console messages and errors help diagnose issues
3. **Event Correlation**: All browser events linked to task context
4. **Extensible**: Event types can be extended for new browser capabilities
5. **Consistent Patterns**: Follows existing APEX event architecture

### Negative

1. **Increased Event Volume**: Browser output can be verbose
2. **Storage Requirements**: Long-running tasks may generate significant event data
3. **Complexity**: Additional code paths for event forwarding

### Mitigations

1. **Filtering**: Configurable severity levels reduce noise
2. **Batching**: Aggregate console messages to reduce event count
3. **Buffer Limits**: Prevent unbounded memory growth
4. **Per-Client Filtering**: WebSocket clients can subscribe to specific event types

## Implementation Phases

### Phase 1: Core Types (Priority: High)
- Add browser event types to `@apexcli/core`
- Define Zod schemas for validation

### Phase 2: Adapter Implementation (Priority: High)
- Create `BrowserEventAdapter` class
- Integrate with existing `BrowserConsoleStream`

### Phase 3: Orchestrator Integration (Priority: High)
- Add browser events to `OrchestratorEvents`
- Update `BrowserTool` to use adapter

### Phase 4: API Broadcasting (Priority: Medium)
- Add browser event handlers to `setupEventBroadcasting`
- Test WebSocket streaming

### Phase 5: CLI Support (Priority: Medium)
- Update `useOrchestratorEvents` hook
- Add browser console panel to UI (optional)

### Phase 6: Documentation (Priority: Low)
- Update API documentation
- Add event reference documentation

## Related ADRs

- ADR-001: Event-driven Architecture
- ADR-003: Browser Automation Integration
- ADR-005: Permission System Design

## References

- Existing `BrowserConsoleStream` implementation
- `OrchestratorEvents` interface
- WebSocket event broadcasting in API package
