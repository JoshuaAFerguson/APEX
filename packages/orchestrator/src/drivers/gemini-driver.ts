import type { AiDriver, DriverRequest, DriverEvent } from './types.js';

/**
 * Google Gemini driver using the @google/generative-ai package.
 * Maps APEX driver interface to Gemini's streaming API.
 */
export class GeminiDriver implements AiDriver {
  readonly providerId = 'gemini';
  private apiKey: string | undefined;

  async initialize(): Promise<void> {
    this.apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  }

  async authenticate(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    }
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
    }
  }

  resolveModel(modelAlias: string): string {
    const modelMap: Record<string, string> = {
      opus: 'gemini-2.0-flash',
      sonnet: 'gemini-2.0-flash',
      haiku: 'gemini-2.0-flash-lite',
      inherit: 'gemini-2.0-flash',
    };
    return modelMap[modelAlias] || modelAlias;
  }

  async *stream(request: DriverRequest): AsyncIterable<DriverEvent> {
    if (!this.apiKey) {
      yield { type: 'error', message: 'Gemini API key not configured' };
      return;
    }

    yield { type: 'status', message: 'Connecting to Gemini...' };

    try {
      // Dynamic import to avoid requiring @google/generative-ai at module load time.
      // The @google/generative-ai package is an optional peer dependency - only users
      // of the Gemini driver need to install it.
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.apiKey);

      const model = genAI.getGenerativeModel({ model: request.model });

      // Build content with system instruction if provided
      const chat = model.startChat({
        history: [],
        ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
      });

      const result = await chat.sendMessageStream(request.prompt);
      let fullContent = '';

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          yield { type: 'text', content: text };
        }
      }

      // Get final response for usage metadata
      const response = await result.response;
      const usageMetadata = response.usageMetadata;

      yield {
        type: 'usage',
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
      };

      yield { type: 'complete', summary: fullContent.substring(0, 200) };
    } catch (error) {
      yield { type: 'error', message: `Gemini error: ${(error as Error).message}` };
    }
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }
}
