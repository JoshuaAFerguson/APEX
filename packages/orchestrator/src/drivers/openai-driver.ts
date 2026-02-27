import { 
  AiDriver, 
  DriverRequest, 
  DriverEvent 
} from './types.js';
import { CredentialManager } from '../auth/credential-manager.js';

export class OpenAiCodexDriver implements AiDriver {
  readonly providerId = 'openai-codex';
  private credentialManager = new CredentialManager();

  async initialize(): Promise<void> {
    const creds = await this.credentialManager.getCredentials('openai');
    if (creds?.accessToken) {
      process.env.OPENAI_API_KEY = creds.accessToken;
    }
  }

  async authenticate(): Promise<void> {
    // Trigger OpenAuth flow
  }

  async dispose(): Promise<void> {
  }

  resolveModel(modelAlias: string): string {
    switch (modelAlias) {
      case 'opus': return 'gpt-4o';
      case 'haiku': return 'gpt-4o-mini';
      case 'sonnet':
      default:
        return 'gpt-4o';
    }
  }

  async *stream(request: DriverRequest): AsyncIterable<DriverEvent> {
    // Implementation using @openai/agents
    yield { type: 'status', message: 'OpenAI Codex driver not fully implemented yet' };
    yield { type: 'error', message: 'Coming soon' };
  }
}
