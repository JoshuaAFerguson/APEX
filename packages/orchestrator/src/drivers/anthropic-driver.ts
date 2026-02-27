import { 
  AiDriver, 
  DriverRequest, 
  DriverEvent 
} from './types.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { CredentialManager } from '../auth/credential-manager.js';

export class AnthropicDriver implements AiDriver {
  readonly providerId = 'anthropic';
  private credentialManager = new CredentialManager();

  async initialize(): Promise<void> {
    const creds = await this.credentialManager.getCredentials('anthropic');
    if (creds?.accessToken) {
      process.env.ANTHROPIC_API_KEY = creds.accessToken;
    }
  }

  async authenticate(): Promise<void> {
    // In the future, this would trigger the CLI auth flow
    console.log('Please run "apex auth login anthropic" to authenticate.');
  }

  async dispose(): Promise<void> {
    // Cleanup if needed
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
    try {
      // Map APEX tools to Anthropic SDK tools if needed, 
      // but the SDK handles MCP automatically.
      // For standalone APEX tools, we pass them as definitions.
      
      const stream = query({
        prompt: request.prompt,
        // The SDK might have different param names, 
        // we map them here.
      });

      for await (const message of stream as AsyncIterable<any>) {
        // Map SDK messages to DriverEvent format
        if (message.type === 'text') {
          yield { type: 'text', content: message.content };
        } else if (message.type === 'tool_use') {
          yield { 
            type: 'tool_call', 
            id: message.id, 
            name: message.name, 
            input: message.input 
          };
        } else if (message.type === 'usage') {
          yield { 
            type: 'usage', 
            inputTokens: message.input_tokens, 
            outputTokens: message.output_tokens 
          };
        }
      }
      
      yield { type: 'complete', summary: 'Task finished' };
    } catch (error) {
      yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  }
}
