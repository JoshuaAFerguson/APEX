import type { AiDriver, DriverRequest, DriverEvent } from './types.js';

/**
 * OpenAI driver using the openai npm package.
 * Maps APEX driver interface to OpenAI's chat completions API with streaming.
 */
export class OpenAiCodexDriver implements AiDriver {
  readonly providerId = 'openai-codex';
  private apiKey: string | undefined;

  async initialize(): Promise<void> {
    // Check for API key
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  async authenticate(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = process.env.OPENAI_API_KEY;
    }
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }

  resolveModel(modelAlias: string): string {
    const modelMap: Record<string, string> = {
      opus: 'gpt-4o',
      sonnet: 'gpt-4o',
      haiku: 'gpt-4o-mini',
      inherit: 'gpt-4o',
    };
    return modelMap[modelAlias] || modelAlias;
  }

  async *stream(request: DriverRequest): AsyncIterable<DriverEvent> {
    if (!this.apiKey) {
      yield { type: 'error', message: 'OpenAI API key not configured' };
      return;
    }

    yield { type: 'status', message: 'Connecting to OpenAI...' };

    try {
      // Dynamic import to avoid requiring openai at module load time.
      // The openai package is an optional peer dependency - only users of the OpenAI
      // driver need to install it. The @ts-ignore suppresses the missing module error.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore -- openai is an optional dynamic dependency
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: this.apiKey });

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const stream = await client.chat.completions.create({
        model: request.model,
        messages,
        stream: true,
        max_tokens: 4096,
      });

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          yield { type: 'text', content: delta.content };
        }

        // Track usage from final chunk
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens || 0;
          outputTokens = chunk.usage.completion_tokens || 0;
        }
      }

      yield { type: 'usage', inputTokens, outputTokens };
      yield { type: 'complete', summary: fullContent.substring(0, 200) };
    } catch (error) {
      yield { type: 'error', message: `OpenAI error: ${(error as Error).message}` };
    }
  }

  async dispose(): Promise<void> {
    // No cleanup needed
  }
}
