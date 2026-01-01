# ADR: BrowserTool Architecture Design

## Status
Proposed

## Context
APEX needs a browser automation tool that can perform web page interactions (navigate, click, screenshot, etc.) while integrating with the existing permission system. This tool will be used by AI agents to interact with web applications.

## Decision

### 1. Class Structure

The `BrowserTool` class will follow the existing tool pattern established by `WebFetchTool`:

```typescript
packages/orchestrator/src/tools/browser-tool.ts
```

### 2. Permission Integration Points

The BrowserTool integrates with `PermissionManager` at multiple levels:

#### 2.1 Tool-Level Permission
- Uses `checkToolPermission('Browser', options)` before any operation
- Scope parameter encodes operation type + target URL: `navigate:https://example.com`

#### 2.2 Per-Operation Permission Hooks
Each browser operation can trigger permission requests:

| Operation | Permission Scope Pattern | Risk Level |
|-----------|-------------------------|------------|
| navigate  | `navigate:{url}` | Medium - loads external content |
| click     | `click:{selector}` | Low - UI interaction |
| type      | `type:{selector}` | Medium - may submit forms |
| screenshot | `screenshot:{url}` | Low - read-only |
| evaluate  | `evaluate:{script_hash}` | High - arbitrary JS execution |
| submit    | `submit:{form_selector}` | High - may trigger actions |

#### 2.3 Configuration Schema
Extend `ToolPermissionConfigSchema` union in `@apexcli/core` with:

```typescript
export const BrowserToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  /** Allowed domains for navigation (empty = all allowed) */
  allowedDomains: z.array(z.string()).optional().default([]),

  /** Blocked domains */
  blockedDomains: z.array(z.string()).optional().default([]),

  /** Whether to allow JavaScript execution via evaluate() */
  allowJavaScriptExecution: z.boolean().optional().default(false),

  /** Whether to allow form submissions */
  allowFormSubmission: z.boolean().optional().default(true),

  /** Maximum page load timeout in milliseconds */
  pageLoadTimeout: z.number().int().min(0).optional().default(30000),

  /** Whether to allow file downloads */
  allowDownloads: z.boolean().optional().default(false),

  /** Whether to capture screenshots */
  allowScreenshots: z.boolean().optional().default(true),

  /** Whether to block popups/new windows */
  blockPopups: z.boolean().optional().default(true),

  /** User agent override */
  userAgent: z.string().optional(),

  /** Viewport configuration */
  viewport: z.object({
    width: z.number().int().min(320).default(1280),
    height: z.number().int().min(240).default(720),
  }).optional(),
});
```

### 3. Interface Design

```typescript
// Browser operation types
export type BrowserOperation =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'evaluate'
  | 'submit'
  | 'waitForSelector'
  | 'getAttribute'
  | 'getText'
  | 'getHtml'
  | 'scroll'
  | 'hover';

// Parameters for each operation
export interface BrowserNavigateParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface BrowserClickParams {
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface BrowserTypeParams {
  selector: string;
  text: string;
  delay?: number;
  clearFirst?: boolean;
}

export interface BrowserScreenshotParams {
  path?: string;
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface BrowserEvaluateParams {
  script: string;
  args?: unknown[];
}

// ... additional operation params

// Unified params type
export type BrowserParams =
  | { operation: 'navigate'; params: BrowserNavigateParams }
  | { operation: 'click'; params: BrowserClickParams }
  | { operation: 'type'; params: BrowserTypeParams }
  | { operation: 'screenshot'; params: BrowserScreenshotParams }
  | { operation: 'evaluate'; params: BrowserEvaluateParams }
  // ... etc

// Result types
export interface BrowserResult {
  success: boolean;
  operation: BrowserOperation;
  data?: unknown;
  screenshot?: string; // base64 or path
  error?: string;
  metadata?: {
    url: string;
    title?: string;
    executionTime: number;
    permissionGranted: boolean;
    permissionLevel?: PermissionLevel;
  };
}
```

### 4. Permission Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      BrowserTool.execute()                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Validate params & build permission scope                     │
│     scope = `${operation}:${target}`                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Check tool permission via PermissionManager                  │
│     const result = await permissionManager.checkToolPermission(  │
│       'Browser',                                                 │
│       { scope, consumeAllowOnce: true }                         │
│     );                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │ result.allowed?  │
                   └──────────────────┘
                     │           │
                   Yes           No
                     │           │
                     ▼           ▼
┌──────────────────────┐  ┌──────────────────────────────────────┐
│ 3. Check domain      │  │ Return BrowserResult with             │
│    restrictions from │  │ { success: false,                     │
│    config            │  │   error: result.denialReason }        │
└──────────────────────┘  └──────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Check operation-specific restrictions                        │
│     - evaluate: check allowJavaScriptExecution                   │
│     - submit: check allowFormSubmission                          │
│     - screenshot: check allowScreenshots                         │
│     - navigate: check domain allowlist/blocklist                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Execute operation (stub returns placeholder)                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Return BrowserResult with metadata                           │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Dependency Injection Pattern

The BrowserTool accepts an optional `PermissionManager` instance for testability:

```typescript
export class BrowserTool {
  private permissionManager?: PermissionManager;

  constructor(options?: BrowserToolOptions) {
    this.permissionManager = options?.permissionManager;
  }

  /**
   * Inject permission manager at runtime
   * Allows lazy binding after orchestrator initialization
   */
  setPermissionManager(manager: PermissionManager): void {
    this.permissionManager = manager;
  }

  /**
   * Permission check hook - returns whether operation is allowed
   * External code can use this to pre-check permissions
   */
  async checkPermission(
    operation: BrowserOperation,
    target: string
  ): Promise<ToolPermissionResult> {
    if (!this.permissionManager) {
      // If no permission manager, allow by default
      return { allowed: true, level: null, requiresConfirmation: false };
    }

    const scope = this.buildScope(operation, target);
    return this.permissionManager.checkToolPermission('Browser', { scope });
  }
}
```

### 6. Dangerous Operation Detection

Integrate with `DangerousOperationDetector` from `@apexcli/core`:

```typescript
// High-risk operations that require explicit confirmation
const DANGEROUS_OPERATIONS = {
  evaluate: 'Executing arbitrary JavaScript code',
  submit: 'Submitting form data',
  navigate: 'Navigating to external domain', // only for non-allowed domains
};

// Check before execution
private async checkDangerousOperation(
  operation: BrowserOperation,
  params: unknown
): Promise<{ isDangerous: boolean; reason?: string }> {
  if (operation === 'evaluate') {
    return { isDangerous: true, reason: DANGEROUS_OPERATIONS.evaluate };
  }

  if (operation === 'submit') {
    return { isDangerous: true, reason: DANGEROUS_OPERATIONS.submit };
  }

  if (operation === 'navigate') {
    const { url } = params as BrowserNavigateParams;
    const domain = new URL(url).hostname;
    const config = await this.getConfig();

    if (config?.blockedDomains?.includes(domain)) {
      return { isDangerous: true, reason: `Domain ${domain} is blocked` };
    }

    if (config?.allowedDomains?.length && !config.allowedDomains.includes(domain)) {
      return { isDangerous: true, reason: `Domain ${domain} is not in allowlist` };
    }
  }

  return { isDangerous: false };
}
```

### 7. File Structure

```
packages/orchestrator/src/tools/
├── index.ts                    # Re-exports all tools
├── webfetch.ts                 # Existing WebFetch tool
├── browser-tool.ts             # NEW: BrowserTool implementation
├── browser-tool.test.ts        # NEW: Unit tests
└── browser-tool.adr.md         # NEW: This architecture document
```

### 8. Export Updates

Update `packages/orchestrator/src/tools/index.ts`:

```typescript
export {
  WebFetchTool,
  webFetchTool,
  webFetch,
  type WebFetchParams,
  type WebFetchResult,
  type HttpMethod,
} from './webfetch';

export {
  BrowserTool,
  browserTool,
  type BrowserOperation,
  type BrowserParams,
  type BrowserResult,
  type BrowserNavigateParams,
  type BrowserClickParams,
  type BrowserTypeParams,
  type BrowserScreenshotParams,
  type BrowserEvaluateParams,
  type BrowserToolConfig,
} from './browser-tool';
```

### 9. Core Types Updates (Future)

When the BrowserTool config is finalized, add to `@apexcli/core` types:

1. Add `BrowserToolConfigSchema` to the union in `ToolPermissionConfigSchema`
2. Add 'Browser' to the `WRITE_TOOLS` array (since it can modify state)
3. Export `BrowserToolConfig` type

## Implementation Notes

### Stub Implementation
For the initial stub:
- All browser operations return placeholder results
- Permission hooks are fully implemented and functional
- Actual browser automation (Playwright/Puppeteer) will be added later

### Future Browser Backend Options
The stub is designed to be backend-agnostic. Future implementations could use:
1. **Playwright** - Cross-browser, modern API, good TypeScript support
2. **Puppeteer** - Chrome-focused, widely used
3. **CDP (Chrome DevTools Protocol)** - Direct protocol access

### Testing Strategy
1. Unit tests for permission hook integration
2. Mock `PermissionManager` for isolated testing
3. Integration tests with actual permission store
4. E2E tests when real browser backend is added

## Consequences

### Positive
- Clean separation between permission logic and browser automation
- Follows existing tool patterns for consistency
- Easy to test permission behavior without browser dependencies
- Flexible configuration per domain/operation

### Negative
- Initial stub doesn't provide real browser automation
- Multiple permission checks per operation may add latency
- Configuration schema adds complexity

### Risks
- Browser automation security implications
- Resource management (browser process lifecycle)
- Cross-origin restrictions in real browsers

## References
- `packages/orchestrator/src/tools/webfetch.ts` - Existing tool pattern
- `packages/orchestrator/src/permission-manager.ts` - Permission integration
- `packages/core/src/types.ts` - Type definitions and schemas
