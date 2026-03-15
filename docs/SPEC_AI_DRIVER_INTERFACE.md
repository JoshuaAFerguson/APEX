# Technical Spec: AI Driver Interface

## Location: `packages/orchestrator/src/drivers/types.ts`

## Interface: `AiDriver`
Every provider (Anthropic, OpenAI, Gemini, Agnostic) must implement this interface.

```typescript
export interface AiDriver {
  /**
   * Unique identifier for the provider (e.g., 'anthropic', 'openai-codex')
   */
  readonly providerId: string;

  /**
   * Initialize the driver, checking for valid session/auth
   */
  initialize(): Promise<void>;

  /**
   * Main execution loop for agentic tasks.
   * Handles streaming responses and tool-call handoffs.
   */
  stream(
    request: DriverRequest
  ): AsyncIterable<DriverEvent>;

  /**
   * Register tools with the provider's specific format
   */
  registerTools(tools: ToolDefinition[]): void;
}
```

## Data Models

### `DriverRequest`
```typescript
interface DriverRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  maxTurns: number;
  tools: string[]; // List of registered tool names
  context?: MultimodalContext;
  cwd: string;
}
```

### `DriverEvent`
Events emitted during the `stream` loop to maintain parity with the current Orchestrator event system.
```typescript
type DriverEvent = 
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; content: any; isError: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'complete'; summary: string };
```

## Auth Strategy
Each driver will handle its own authentication requirements internally but expose a standardized `authenticate()` method for the CLI.
*   **Anthropic:** PKCE OAuth to `auth.anthropic.com`.
*   **OpenAI:** OpenAuth to OpenAI's gateway.
*   **Gemini:** Google Cloud OAuth 2.0.
*   **Agnostic:** Standard environment variable check (e.g., `OPENAI_API_KEY`).
