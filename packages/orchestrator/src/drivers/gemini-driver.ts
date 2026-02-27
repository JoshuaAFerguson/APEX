import { 
  AiDriver, 
  DriverRequest, 
  DriverEvent 
} from './types.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CredentialManager } from '../auth/credential-manager.js';

export class GeminiDriver implements AiDriver {
  readonly providerId = 'gemini';
  private client?: GoogleGenerativeAI;
  private credentialManager = new CredentialManager();

  async initialize(): Promise<void> {
    const creds = await this.credentialManager.getCredentials('gemini');
    const apiKey = creds?.accessToken || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  async authenticate(): Promise<void> {
    // This will be implemented in the CLI layer to handle Google Cloud OAuth
    console.log('Please run "apex auth login gemini"');
  }

  async dispose(): Promise<void> {}

  resolveModel(modelAlias: string): string {
    switch (modelAlias) {
      case 'opus': return 'gemini-1.5-pro';
      case 'haiku': return 'gemini-1.5-flash';
      case 'sonnet':
      default:
        return 'gemini-1.5-pro';
    }
  }

  async *stream(request: DriverRequest): AsyncIterable<DriverEvent> {
    if (!this.client) {
      yield { type: 'error', message: 'Gemini client not initialized. Please authenticate.' };
      return;
    }

    try {
      const model = this.client.getGenerativeModel({ model: request.model });
      
      // Simple non-agentic implementation for now, 
      // can be expanded to use Function Calling (Tools)
      const result = await model.generateContentStream(request.prompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { type: 'text', content: text };
        }
      }

      yield { type: 'usage', inputTokens: 0, outputTokens: 0 }; // Gemini SDK token tracking varies
      yield { type: 'complete', summary: 'Finished' };
    } catch (error) {
      yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  }
}
