import {
  AiDriver,
  DriverRequest,
  DriverEvent
} from './types.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  Options as SdkOptions,
} from '@anthropic-ai/claude-agent-sdk';
import { CredentialManager } from '../auth/credential-manager.js';

export class AnthropicDriver implements AiDriver {
  readonly providerId = 'anthropic';
  private credentialManager = new CredentialManager();

  /** Track active AbortControllers so dispose() can kill all running queries */
  private activeControllers = new Set<AbortController>();

  async initialize(): Promise<void> {
    const creds = await this.credentialManager.getCredentials('anthropic');
    if (creds?.accessToken) {
      process.env.ANTHROPIC_API_KEY = creds.accessToken;
    }
  }

  async authenticate(): Promise<void> {
    console.log('Please run "apex auth login anthropic" to authenticate.');
  }

  async dispose(): Promise<void> {
    // Abort all active SDK queries — this kills the spawned claude subprocesses
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch {
        // Ignore errors during abort
      }
    }
    this.activeControllers.clear();
  }

  resolveModel(modelAlias: string): string {
    switch (modelAlias) {
      case 'opus': return 'claude-opus-4-5-20251101';
      case 'haiku': return 'claude-haiku-4-5-20251001';
      case 'sonnet':
      default:
        return 'claude-sonnet-4-20250514';
    }
  }

  async *stream(request: DriverRequest): AsyncIterable<DriverEvent> {
    // Use caller's AbortController if provided, so they can abort this specific query
    const abortController = request.abortController ?? new AbortController();
    this.activeControllers.add(abortController);

    try {
      // Build SDK options from the driver request
      const sdkOptions: SdkOptions = {
        abortController,
        systemPrompt: request.systemPrompt,
        model: request.model,
        maxTurns: request.maxTurns,
        cwd: request.cwd,
        // APEX manages permissions internally — bypass SDK permission prompts
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        // Use the full Claude Code tool preset (Bash, Read, Write, Edit, Glob, Grep, etc.)
        tools: { type: 'preset', preset: 'claude_code' },
      };

      // Pass MCP servers if configured
      if (request.mcpServers && Object.keys(request.mcpServers).length > 0) {
        sdkOptions.mcpServers = request.mcpServers;
      }

      const queryResult = query({
        prompt: request.prompt,
        options: sdkOptions,
      });

      for await (const message of queryResult) {
        yield* this.mapSdkMessage(message);
      }
    } catch (error) {
      // Don't emit error events for intentional aborts
      if (error instanceof Error && error.name === 'AbortError') {
        yield { type: 'status', message: 'Query aborted' };
      } else {
        yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
      }
    } finally {
      this.activeControllers.delete(abortController);
    }
  }

  /**
   * Maps a Claude Agent SDK message to one or more DriverEvent emissions.
   *
   * The SDK emits several message types:
   * - 'assistant': Contains content blocks (text, tool_use, thinking)
   * - 'user': Contains tool results (synthetic messages from tool execution)
   * - 'result': Final summary with usage stats and completion status
   * - 'system', 'stream_event', etc.: Internal SDK messages we can skip
   */
  private *mapSdkMessage(message: SDKMessage): Generator<DriverEvent> {
    switch (message.type) {
      case 'assistant': {
        // SDKAssistantMessage contains a BetaMessage with content blocks
        const assistantMsg = message as SDKAssistantMessage;
        const content = assistantMsg.message?.content;
        if (!Array.isArray(content)) break;

        for (const block of content) {
          // Cast to any for type checks — the SDK's discriminated union may not
          // include all runtime block types (e.g., 'thinking', 'redacted_thinking')
          const b = block as any;
          if (b.type === 'text') {
            yield { type: 'text', content: b.text ?? '' };
          } else if (b.type === 'tool_use') {
            yield { type: 'tool_call', id: b.id, name: b.name, input: b.input };
          } else if (b.type === 'thinking') {
            yield { type: 'thinking', content: b.thinking ?? '' };
          }
        }

        // Extract per-message usage if available
        const usage = assistantMsg.message?.usage;
        if (usage) {
          yield {
            type: 'usage',
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0
          };
        }
        break;
      }

      case 'user': {
        // SDKUserMessage — synthetic messages containing tool results
        const userContent = (message as any).message?.content;
        if (!Array.isArray(userContent)) break;

        for (const block of userContent) {
          if (typeof block === 'object' && block !== null && block.type === 'tool_result') {
            yield {
              type: 'tool_result',
              id: block.tool_use_id,
              content: block.content,
              isError: block.is_error ?? false
            };
          }
        }
        break;
      }

      case 'result': {
        // SDKResultMessage — final result with aggregated usage
        const resultMsg = message as SDKResultMessage;

        // Emit final usage
        if (resultMsg.usage) {
          yield {
            type: 'usage',
            inputTokens: resultMsg.usage.input_tokens ?? 0,
            outputTokens: resultMsg.usage.output_tokens ?? 0
          };
        }

        // Emit completion or error
        if (resultMsg.subtype === 'success') {
          yield { type: 'complete', summary: (resultMsg as any).result ?? 'Task finished' };
        } else {
          const errors = (resultMsg as any).errors;
          const errorMsg = Array.isArray(errors) ? errors.join('; ') : `Task ended: ${resultMsg.subtype}`;
          yield { type: 'error', message: errorMsg };
        }
        break;
      }

      // Skip system init, stream_event, compact_boundary, status, etc.
      default:
        break;
    }
  }
}
