# ADR-080: WebFetch Tool Hooks System and Agent Tool Registry Integration

## Status
Proposed

## Context

APEX has an existing WebFetch tool implementation in `packages/orchestrator/src/tools/webfetch.ts` that provides HTTP request capabilities with caching, HTML-to-markdown conversion, and AI-powered content analysis. However, this tool is not yet integrated into:

1. **The hooks system** (`packages/orchestrator/src/hooks.ts`) - which provides auditing, logging, and permission checks for tool invocations
2. **The agent tool registry** (`packages/core/src/tools/tool-registry.ts`) - which manages tool registration, discovery, and runtime state

### Current State

- **WebFetch Tool**: Complete implementation with HTTP methods, caching, HTML conversion, and AI analysis
- **Hooks System**: Exists for Bash, Write, Edit, and MultiEdit tools - provides auditing, dangerous pattern blocking, and event emission
- **Tool Registry**: Singleton pattern for registering tools with validation, event emission, and statistics tracking
- **ToolPermission**: Includes 'network' permission type in `packages/core/src/types.ts`

### Requirements from Acceptance Criteria

1. Register WebFetch in hooks.ts for auditing
2. Add network permission checks
3. Integrate with orchestrator's tool invocation flow
4. Emit proper events for tool usage

## Decision

We will integrate the WebFetch tool into the APEX hooks system and agent tool registry following these design principles:

### 1. Hook System Integration (hooks.ts)

Add a new PreToolUse hook matcher for 'WebFetch' that:

```typescript
// In createHooks function, add to PreToolUse array:
{
  matcher: 'WebFetch',
  hooks: [
    createHookCallback(context, auditWebFetch),
    createHookCallback(context, validateNetworkPermissions),
  ],
  timeout: 5,
}
```

**New Hook Functions:**

```typescript
/**
 * Audit WebFetch requests for logging and monitoring
 */
async function auditWebFetch(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const url = (toolInput.url as string) || '';
  const method = (toolInput.method as string) || 'GET';

  // Log the request
  await context.store.addLog(context.taskId, {
    level: 'info',
    message: `WebFetch: ${method} ${url.substring(0, 100)}`,
    metadata: { method, url: url.substring(0, 200), hasPrompt: !!toolInput.prompt },
  });

  // Notify callback
  context.onToolUse?.('WebFetch', { url, method });

  return {};
}

/**
 * Validate network permissions and block dangerous URLs
 */
async function validateNetworkPermissions(
  input: HookInput,
  _toolUseId: string | undefined,
  context: HookContext
): Promise<HookJSONOutput> {
  const toolInput = getToolInput(input);
  const url = (toolInput.url as string) || '';

  // Validate URL format
  try {
    const parsedUrl = new URL(url);

    // Block dangerous URL schemes
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `WebFetch blocked: Only http and https URLs are allowed. Got: ${parsedUrl.protocol}`,
        },
      };
    }

    // Block localhost/internal network access (configurable)
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(parsedUrl.hostname)) {
      await context.store.addLog(context.taskId, {
        level: 'warn',
        message: `WebFetch to internal host: ${parsedUrl.hostname}`,
        metadata: { url, blocked: false, warning: true },
      });
    }

  } catch (error) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `WebFetch blocked: Invalid URL format: ${url.substring(0, 100)}`,
      },
    };
  }

  return {};
}
```

### 2. Tool Registry Integration

Create a WebFetch tool class that extends `BaseTool` for registry integration:

**New file: `packages/core/src/tools/web/webfetch-tool.ts`**

```typescript
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolCategory, ToolPermission } from '../../types.js';

export interface WebFetchToolInput {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  convertToMarkdown?: boolean;
  bypassCache?: boolean;
  cacheTtl?: number;
  prompt?: string;
  maxAnalysisContent?: number;
}

export class WebFetchTool extends BaseTool<WebFetchToolInput, WebFetchResult> {
  constructor() {
    super({
      name: 'WebFetch',
      description: 'Fetches content from a URL and optionally processes it with AI analysis. Supports GET, POST, PUT, DELETE methods with caching and HTML-to-markdown conversion.',
      category: 'web' as ToolCategory,
      permissions: ['network' as ToolPermission],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch (required)' },
          method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE). Default: GET' },
          headers: { type: 'object', description: 'Custom HTTP headers to send' },
          body: { type: 'string', description: 'Request body for POST/PUT requests' },
          timeout: { type: 'number', description: 'Request timeout in milliseconds (default: 10000)' },
          convertToMarkdown: { type: 'boolean', description: 'Convert HTML to markdown (default: true)' },
          bypassCache: { type: 'boolean', description: 'Bypass cache (default: false)' },
          cacheTtl: { type: 'number', description: 'Cache TTL in milliseconds (default: 900000)' },
          prompt: { type: 'string', description: 'AI analysis prompt for content extraction' },
          maxAnalysisContent: { type: 'number', description: 'Max content length for AI analysis (default: 100000)' },
        },
        required: ['url'],
        additionalProperties: false,
      },
      version: '1.0.0',
      tags: ['web', 'http', 'fetch', 'network', 'scraping'],
    });
  }

  // Implementation delegates to existing webfetch.ts
  protected async executeImpl(
    params: WebFetchToolInput,
    context?: ToolExecutionContext
  ): Promise<WebFetchResult> {
    // Import and delegate to existing implementation
    const { webFetch } = await import('@apex/orchestrator');
    return webFetch(params);
  }
}
```

### 3. Registration Functions

**Add to `packages/core/src/tools/web/register.ts`:**

```typescript
import { WebFetchTool, type WebFetchToolConfig } from './webfetch-tool.js';

export function registerWebFetchTool(
  registry: ToolRegistry,
  config?: WebFetchToolConfig
): void {
  registry.register(new WebFetchTool(config));
}

// Update registerWebTools to include WebFetch
export function registerWebTools(
  registry: ToolRegistry,
  config?: WebSearchToolConfig & WebFetchToolConfig
): void {
  registerWebSearchTool(registry, config);
  registerWebFetchTool(registry, config);
}

// Update webToolClasses
export const webToolClasses = [WebSearchTool, WebFetchTool] as const;
```

### 4. Event Emission Flow

The integration follows this event flow:

```
Agent invokes WebFetch
       │
       ▼
┌──────────────────────────────────┐
│  PreToolUse Hook                 │
│  ├── auditWebFetch()             │ ─── Logs request, emits 'agent:tool-use'
│  └── validateNetworkPermissions()│ ─── Checks URL validity, protocol safety
└──────────────────────────────────┘
       │
       ▼ (if allowed)
┌──────────────────────────────────┐
│  WebFetchTool.execute()          │
│  ├── Validation                  │
│  ├── HTTP Request                │
│  ├── HTML-to-Markdown            │
│  └── AI Analysis (optional)      │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  PostToolUse Hook                │
│  └── logToolResult()             │ ─── Logs completion
└──────────────────────────────────┘
       │
       ▼
Registry.recordInvocation(success/failure)
```

### 5. Configuration Schema Updates

Add to `packages/core/src/types.ts` configuration if needed:

```typescript
// Network permission is already defined in ToolPermissionSchema:
// 'network'     // Network access

// Optionally add URL blocklist configuration to ApexConfig
export const NetworkConfigSchema = z.object({
  /** URLs/hosts to block for WebFetch */
  blockedHosts: z.array(z.string()).optional(),
  /** Whether to allow localhost access */
  allowLocalhost: z.boolean().optional().default(false),
  /** Default timeout for network operations */
  defaultTimeout: z.number().optional().default(10000),
});
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          APEX Agent Execution                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK query()                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         hooks: HooksConfig                          │ │
│  │  PreToolUse:                                                        │ │
│  │    ├── matcher: 'Bash'    → auditBashCommand, blockDangerousCommands│ │
│  │    ├── matcher: 'Write'   → auditFileWrite                          │ │
│  │    ├── matcher: 'Edit'    → auditFileWrite                          │ │
│  │    ├── matcher: 'WebFetch' → auditWebFetch, validateNetworkPerms ◄──┼─┼─ NEW
│  │    └── default           → logToolUsage                             │ │
│  │  PostToolUse:                                                       │ │
│  │    └── default           → logToolResult                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ToolRegistry (Singleton)                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Registered Tools:                                                  │ │
│  │    ├── Read      (filesystem) - permissions: [read]                 │ │
│  │    ├── Write     (filesystem) - permissions: [write]                │ │
│  │    ├── Edit      (filesystem) - permissions: [write]                │ │
│  │    ├── Bash      (shell)      - permissions: [execute]              │ │
│  │    ├── Grep      (search)     - permissions: [read]                 │ │
│  │    ├── WebSearch (web)        - permissions: [network]              │ │
│  │    └── WebFetch  (web)        - permissions: [network]        ◄─────┼─ NEW
│  │                                                                     │ │
│  │  Events: tool:registered, tool:unregistered, tool:availability      │ │
│  │  Stats:  invocationCount, successCount, failureCount                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Orchestrator Event Emission                           │
│  'agent:tool-use' → { taskId, tool: 'WebFetch', input: {...} }          │
│  'usage:updated'  → { taskId, usage: {...} }                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Hook System Integration
1. Add `auditWebFetch` function to `packages/orchestrator/src/hooks.ts`
2. Add `validateNetworkPermissions` function to `packages/orchestrator/src/hooks.ts`
3. Add WebFetch matcher to `createHooks` function PreToolUse array
4. Add BLOCKED_URLS and RISKY_URLS patterns constants (similar to DANGEROUS_PATTERNS)

### Phase 2: Tool Registry Integration
1. Create `packages/core/src/tools/web/webfetch-tool.ts` extending BaseTool
2. Update `packages/core/src/tools/web/register.ts` with registration functions
3. Update `packages/core/src/tools/web/index.ts` exports
4. Update `packages/core/src/tools/index.ts` with WebFetch exports

### Phase 3: Testing
1. Add unit tests for new hook functions
2. Add integration tests for WebFetch with hooks
3. Add tool registry registration tests
4. Verify event emission works correctly

### Phase 4: Documentation
1. Update CLAUDE.md with WebFetch tool documentation
2. Add JSDoc comments to all new functions
3. Update any agent definition templates to include WebFetch

## Consequences

### Positive
- **Consistent Auditing**: All WebFetch requests are logged and auditable
- **Security**: Network permission checks prevent unsafe URL access
- **Observability**: Events emitted for real-time monitoring via WebSocket/CLI
- **Registry Integration**: WebFetch discoverable via getByCategory('web')
- **Statistics**: Usage tracking for WebFetch operations

### Negative
- **Slight Overhead**: Hook evaluation adds minimal latency (~1-5ms)
- **Dependency**: WebFetch tool class depends on orchestrator implementation

### Neutral
- **Two Implementations**: BaseTool wrapper in core delegates to orchestrator implementation
- This follows the existing pattern where core defines interfaces and orchestrator provides implementations

## Files to Modify

1. `packages/orchestrator/src/hooks.ts` - Add WebFetch hooks
2. `packages/core/src/tools/web/webfetch-tool.ts` - New file for BaseTool implementation
3. `packages/core/src/tools/web/register.ts` - Add registration functions
4. `packages/core/src/tools/web/index.ts` - Export WebFetch tool
5. `packages/core/src/tools/index.ts` - Re-export WebFetch from web module

## References

- ADR-014: Base Tool and Tool Interface Architecture
- ADR-015: Tool Registry Singleton Design
- ADR-017: WebSearch Tool Implementation
- `packages/orchestrator/src/tools/webfetch.ts` - Existing implementation
- `packages/orchestrator/src/hooks.ts` - Current hook system
- `packages/core/src/tools/tool-registry.ts` - Registry implementation
