# ADR: BrowserTool Architecture Design

## Status
Accepted (Implemented)

## Context
APEX needs browser automation capabilities that AI agents can invoke through the existing tool system. Browser tool handlers must support basic browser operations (navigate, click, type, screenshot, evaluate, etc.) and return structured results, while integrating with the permission system and exposing operations via the MCP server protocol for Claude Agent SDK compatibility.

## Decision

### 1. Component Architecture

The browser tool system is organized into three layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK (query())                     │
│  Tools: [...builtInTools], mcpServers: { browser-tools: ... }    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                    MCP Protocol (tool invocation)
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│  browser-mcp.ts - MCP Server Adapter                             │
│  buildBrowserToolsServer(browserTool) → { name, config }         │
│  - Zod schema for operation + params                             │
│  - Routes calls to BrowserTool.execute()                         │
│  - Formats results for SDK (text + structuredContent)            │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│  browser-tool.ts - BrowserTool Class (~1500 lines)               │
│  Core execution engine with:                                     │
│  - Permission checking (3-layer: tool, config, dangerous-op)     │
│  - 13 browser operations with typed params                       │
│  - Dual backend: Playwright (primary) + Puppeteer (optional)     │
│  - Console/error stream capture                                  │
│  - Visual regression via pixelmatch                              │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│  browser-manager.ts - BrowserManager Class                       │
│  Lifecycle management layer:                                     │
│  - Browser instance pool (max 5 concurrent)                      │
│  - Context isolation per task                                    │
│  - Automatic cleanup of idle resources (5-min timeout)           │
│  - Event-driven state changes                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 2. File Structure

```
packages/orchestrator/src/
├── tools/
│   ├── index.ts                    # Module exports (BrowserTool, types)
│   ├── browser-tool.ts             # BrowserTool class implementation
│   ├── browser-tool.adr.md         # This architecture document
│   └── __tests__/
│       ├── browser-tool.test.ts                        # Core unit tests
│       ├── browser-tool-error-handling.test.ts          # Error scenarios
│       └── browser-tool-permission-integration.test.ts  # Permission tests
├── browser-mcp.ts                  # MCP server adapter
├── browser-mcp.test.ts             # MCP adapter tests
├── browser-manager.ts              # Browser lifecycle manager
├── browser-manager.test.ts         # Manager tests
├── browser-console-stream.ts       # Enhanced console capture
└── browser-tool-console.test.ts    # Console capture tests (tools dir)
```

### 3. Supported Operations (13 total)

| Operation | Params Interface | Description | Risk |
|-----------|-----------------|-------------|------|
| navigate | BrowserNavigateParams | Load URL with wait conditions | Medium |
| click | BrowserClickParams | Click element by selector | Low |
| type | BrowserTypeParams | Type text into input element | Medium |
| screenshot | BrowserScreenshotParams | Capture viewport/element/fullpage | Low |
| compareScreenshot | BrowserCompareScreenshotParams | Visual regression diff via pixelmatch | Low |
| evaluate | BrowserEvaluateParams | Execute arbitrary JavaScript | **High** |
| submit | BrowserSubmitParams | Submit form by selector | **High** |
| waitForSelector | BrowserWaitForSelectorParams | Wait for element presence | Low |
| getAttribute | BrowserGetAttributeParams | Read element attribute value | Low |
| getText | BrowserGetTextParams | Read element text content | Low |
| getHtml | BrowserGetHtmlParams | Read element/page HTML | Low |
| scroll | BrowserScrollParams | Scroll to coordinates/element | Low |
| hover | BrowserHoverParams | Hover over element | Low |

### 4. Type System

All types use a discriminated union pattern for type safety:

```typescript
// Discriminated union - compiler ensures correct params per operation
export type BrowserParams =
  | { operation: 'navigate'; params: BrowserNavigateParams }
  | { operation: 'click'; params: BrowserClickParams }
  | { operation: 'type'; params: BrowserTypeParams }
  | { operation: 'screenshot'; params: BrowserScreenshotParams }
  | { operation: 'compareScreenshot'; params: BrowserCompareScreenshotParams }
  | { operation: 'evaluate'; params: BrowserEvaluateParams }
  | { operation: 'submit'; params: BrowserSubmitParams }
  | { operation: 'waitForSelector'; params: BrowserWaitForSelectorParams }
  | { operation: 'getAttribute'; params: BrowserGetAttributeParams }
  | { operation: 'getText'; params: BrowserGetTextParams }
  | { operation: 'getHtml'; params: BrowserGetHtmlParams }
  | { operation: 'scroll'; params: BrowserScrollParams }
  | { operation: 'hover'; params: BrowserHoverParams };

// Unified result with operation metadata
export interface BrowserResult {
  success: boolean;
  operation: BrowserOperation;
  data?: unknown;
  screenshot?: string;         // base64 or file path
  error?: string;
  metadata?: {
    url: string;
    title?: string;
    executionTime: number;
    permissionGranted: boolean;
    permissionLevel?: PermissionLevel;
    target?: string;
    consoleMessages?: BrowserConsoleMessage[];
    runtimeErrors?: BrowserRuntimeError[];
    enhancedConsoleMessages?: EnhancedConsoleMessage[];
    enhancedRuntimeErrors?: EnhancedRuntimeError[];
  };
}
```

### 5. Permission Flow (3-Layer Check)

```
BrowserTool.execute(params)
  │
  ├─ Layer 1: Tool Permission ─────────────────────────────────────┐
  │  permissionManager.checkToolPermission('Browser', {            │
  │    scope: `${operation}:${target}`,                            │
  │    consumeAllowOnce: true                                      │
  │  })                                                            │
  │  → denied? return { success: false, error: denialReason }      │
  │                                                                │
  ├─ Layer 2: Configuration Restrictions ──────────────────────────┤
  │  checkConfigurationRestrictions(operation, params)             │
  │  - evaluate → config.allowJavaScriptExecution required         │
  │  - submit → config.allowFormSubmission required                │
  │  - screenshot → config.allowScreenshots required               │
  │  - navigate → domain allowlist/blocklist check                 │
  │  → restricted? return { success: false, error: reason }        │
  │                                                                │
  ├─ Layer 3: Dangerous Operation Gate ────────────────────────────┤
  │  checkDangerousOperation(operation, params)                    │
  │  - evaluate: always dangerous                                  │
  │  - submit: always dangerous                                    │
  │  - navigate: dangerous if domain not in allowlist              │
  │  → dangerous + no explicit permission? deny                    │
  │                                                                │
  └─ Execute Operation ────────────────────────────────────────────┘
    executeOperation(params) → BrowserResult
```

**Permission Scope Patterns:**

| Operation | Scope Pattern | Example |
|-----------|--------------|---------|
| navigate | `navigate:{url}` | `navigate:https://example.com` |
| click | `click:{selector}` | `click:#submit-btn` |
| type | `type:{selector}` | `type:#email-input` |
| screenshot | `screenshot:{selector\|viewport}` | `screenshot:viewport` |
| evaluate | `evaluate:{script_hash}` | `evaluate:a1b2c3d4` |
| submit | `submit:{selector}` | `submit:#login-form` |

### 6. Backend Architecture

The BrowserTool supports dual backends with a preference for Playwright:

```
┌───────────────────────────────────────────────────────────────┐
│                     BrowserTool                                │
│  backend: 'playwright' | 'puppeteer'                         │
│  activeBackend: tracks which is currently in use              │
├───────────────────────────────────────────────────────────────┤
│  ensurePage(config?) → { backend, page }                     │
│    ├── playwright: chromium.launch() → browser.newContext()   │
│    │              → context.newPage()                         │
│    │   Engines: chromium | firefox | webkit                  │
│    └── puppeteer: dynamically imported                       │
│                   puppeteer.launch() → browser.newPage()     │
└───────────────────────────────────────────────────────────────┘
```

**Backend Selection:**
- Playwright is the primary backend (imported statically)
- Puppeteer is optional (dynamically imported to avoid hard dependency)
- Backend can be configured per-tool instance or per-operation via config
- Operations use backend-specific APIs with conditional logic

### 7. MCP Server Integration

Browser tool is exposed to Claude Agent SDK via MCP server protocol:

```typescript
// browser-mcp.ts
export function buildBrowserToolsServer(browserTool: BrowserTool): BrowserToolsServer {
  const browserToolDefinition = tool(
    'Browser',
    'Browser automation tool for navigation, interaction, screenshots, and evaluation.',
    {
      operation: z.enum([...13 operations]),
      params: z.record(z.unknown()).optional(),
    },
    async (args) => {
      const result = await browserTool.execute({ operation, params } as BrowserParams);
      return {
        content: [{ type: 'text', text: outputText }],
        structuredContent: result,
        isError: !result.success,
      };
    }
  );
  return { name: 'browser-tools', config: createSdkMcpServer({ ... }) };
}
```

**Key design choice:** Browser is NOT a built-in SDK tool. It is exposed exclusively via MCP server, which:
- Enables clean separation of concerns (BrowserTool knows nothing about SDK)
- Allows the tool to be conditionally enabled/disabled via config
- Supports the same invocation pattern as external MCP tools
- Makes it testable independently of the SDK

### 8. Orchestrator Wiring

In `ApexOrchestrator` initialization:

```typescript
// 1. Create and wire BrowserTool
browserTool.setPermissionManager(this.permissionManager);
browserTool.setEventEmitter(this);

// 2. Conditionally build MCP server
const browserToolConfig = this.effectiveConfig.tools?.Browser;
if (browserToolConfig?.enabled !== false) {
  this.browserToolsServer = buildBrowserToolsServer(browserTool);
}

// 3. Create BrowserManager for lifecycle
this.browserManager = new BrowserManager({
  permissionManager: this.permissionManager,
  browserTool,
  defaultConfig: browserToolConfig?.browserConfig || {},
});

// 4. Forward browser events
this.setupBrowserEventIntegration();

// 5. Include in query() call
mcpServers: { [this.browserToolsServer.name]: this.browserToolsServer.config }
```

### 9. Configuration Schema

```typescript
export interface BrowserToolConfig {
  enabled?: boolean;                    // Enable/disable tool
  timeout?: number;                     // Max execution time
  requireConfirmation?: boolean;        // Pre-execution confirmation
  rateLimitPerMinute?: number;          // Rate limiting
  allowedDomains?: string[];            // Navigation whitelist
  blockedDomains?: string[];            // Navigation blacklist
  allowJavaScriptExecution?: boolean;   // Gate for evaluate()
  allowFormSubmission?: boolean;        // Gate for submit()
  pageLoadTimeout?: number;             // Navigation timeout
  allowDownloads?: boolean;             // File download permission
  allowScreenshots?: boolean;           // Screenshot permission
  blockPopups?: boolean;                // Popup blocking
  engine?: 'chromium' | 'firefox' | 'webkit';  // Browser engine
  backend?: 'playwright' | 'puppeteer';          // Automation backend
  headless?: boolean;                   // Headless mode
  userAgent?: string;                   // UA override
  viewport?: { width: number; height: number };  // Viewport size
  consoleStream?: {                     // Console capture config
    enabled?: boolean;
    config?: ConsoleStreamConfig;
  };
}
```

### 10. Dependency Injection Pattern

All external dependencies are injected via setter methods for testability:

```typescript
class BrowserTool {
  setPermissionManager(manager: PermissionManager): void;  // Permission checks
  setEventEmitter(emitter: EventEmitter): void;            // Event broadcasting
}

class BrowserManager extends EventEmitter {
  setPermissionManager(manager: PermissionManager): void;
  setBrowserTool(tool: BrowserTool): void;
}
```

This enables:
- Unit testing with mock dependencies
- Lazy binding after orchestrator initialization
- Optional permission enforcement (no manager = allow all)

### 11. Console & Error Capture

Two levels of capture:

1. **Legacy** (`BrowserConsoleMessage`, `BrowserRuntimeError`): Simple message/stack capture
2. **Enhanced** (`BrowserConsoleStream`): Full context with log levels, session tracking, page correlation, and configurable buffer sizes (max 1000 items)

Both are included in `BrowserResult.metadata` for backward compatibility.

### 12. Visual Regression Testing

The `compareScreenshot` operation:
1. Captures current page screenshot
2. Reads baseline image from specified path
3. Computes pixel diff using `pixelmatch`
4. Emits `visual:comparison:*` events with diff data
5. Returns pass/fail based on configurable threshold

### 13. Resource Management

**BrowserManager** handles lifecycle:
- Max 5 concurrent browser instances
- Max 10 contexts per browser
- Automatic cleanup of idle resources (5-minute timeout)
- Graceful shutdown with force-close fallback
- Event-driven state tracking (`browser:launched`, `browser:closed`, etc.)

## Testing Strategy

1. **Unit Tests** (`browser-tool.test.ts`): Core functionality with mocked backends
2. **Permission Tests** (`browser-tool-permission-integration.test.ts`): All permission layers
3. **Error Handling Tests** (`browser-tool-error-handling.test.ts`): Failure scenarios, backend switching
4. **Console Tests** (`browser-tool-console.test.ts`): Message capture, session tracking
5. **MCP Tests** (`browser-mcp.test.ts`): Server adapter formatting

All tests mock Playwright/Puppeteer to avoid requiring browser binaries in CI.

## Consequences

### Positive
- Clean 3-layer architecture (MCP adapter → Tool engine → Browser manager)
- Comprehensive permission system with per-operation granularity
- Dual backend support for flexibility
- Fully testable without browser dependencies
- Consistent with existing tool patterns (WebFetch)
- Conditional enablement via configuration

### Negative
- 3-layer permission checking adds latency per operation
- Playwright as a dependency adds ~50MB to install
- MCP server indirection adds protocol overhead vs built-in tools

### Risks
- Browser process leaks if cleanup fails
- Security exposure from `evaluate()` operation
- Cross-origin restrictions may limit automation scope
- Puppeteer backend may drift from Playwright API surface

## References
- `packages/orchestrator/src/tools/browser-tool.ts` - Core implementation
- `packages/orchestrator/src/browser-mcp.ts` - MCP server adapter
- `packages/orchestrator/src/browser-manager.ts` - Lifecycle manager
- `packages/orchestrator/src/browser-console-stream.ts` - Console capture
- `packages/orchestrator/src/permission-manager.ts` - Permission integration
- `packages/core/src/types.ts` - Type definitions and schemas
- `packages/orchestrator/src/tools/webfetch.ts` - Reference tool pattern
