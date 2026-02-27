import {
  AiDriver,
  DriverRequest,
  DriverEvent,
  DriverMessage
} from './types.js';
import {
  streamText,
  tool,
  stepCountIs,
} from 'ai';
import { ToolDefinition } from '@apexcli/core';
import { z } from 'zod';

export abstract class AgnosticDriver implements AiDriver {
  abstract readonly providerId: string;
  protected modelInstance?: any;

  abstract initialize(): Promise<void>;
  abstract authenticate(): Promise<void>;
  abstract resolveModel(modelAlias: string): string;

  async dispose(): Promise<void> {
    // Default implementation
  }

  protected abstract getModel(modelName: string): any;

  async *stream(request: DriverRequest): AsyncIterable<DriverEvent> {
    const model = this.getModel(request.model);
    
    // Convert APEX tools to Vercel AI SDK tools
    const tools: Record<string, any> = {};
    if (request.tools) {
      for (const toolDef of request.tools) {
        tools[toolDef.name] = tool({
          description: toolDef.description,
          inputSchema: this.convertParametersToZod(toolDef.parameters),
          execute: async (args: Record<string, unknown>) => {
            // This will be handled by the orchestrator tool executor
            // The driver just needs to emit the tool call event
            return { __tool_call_id: 'pending' };
          }
        });
      }
    }

    const messages = [
      { role: 'user' as const, content: request.prompt }
    ];

    try {
      const result = await streamText({
        model,
        system: request.systemPrompt || undefined,
        messages,
        tools,
        stopWhen: stepCountIs(request.maxTurns || 10),
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            yield { type: 'text', content: part.text };
            break;
          case 'tool-call':
            yield {
              type: 'tool_call',
              id: part.toolCallId,
              name: part.toolName,
              input: part.input
            };
            break;
          case 'tool-result':
            yield {
              type: 'tool_result',
              id: part.toolCallId,
              content: part.output,
              isError: false
            };
            break;
          case 'finish':
            yield {
              type: 'usage',
              inputTokens: part.totalUsage.inputTokens ?? 0,
              outputTokens: part.totalUsage.outputTokens ?? 0
            };
            yield { type: 'complete', summary: part.finishReason ?? 'stop' };
            break;
          case 'error':
            yield { type: 'error', message: String(part.error) };
            break;
        }
      }
    } catch (error) {
      yield { type: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  }

  private convertParametersToZod(parameters: any): z.ZodObject<any> {
    // If it's already a Zod object (shouldn't be for ToolDefinition, which is JSON schema)
    if (parameters._def) return parameters;

    // Convert JSON Schema properties to Zod
    const props: Record<string, z.ZodTypeAny> = {};
    const properties = parameters.properties || {};
    const required = parameters.required || [];

    for (const [key, prop] of Object.entries<any>(properties)) {
      let zodType: z.ZodTypeAny;
      switch (prop.type) {
        case 'string': zodType = z.string(); break;
        case 'number': zodType = z.number(); break;
        case 'integer': zodType = z.number().int(); break;
        case 'boolean': zodType = z.boolean(); break;
        case 'object': zodType = z.record(z.any()); break;
        case 'array': zodType = z.array(z.any()); break;
        default: zodType = z.any();
      }
      
      if (prop.description) zodType = zodType.describe(prop.description);
      if (!required.includes(key)) zodType = zodType.optional();
      
      props[key] = zodType;
    }

    return z.object(props);
  }
}

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export class GenericAgnosticDriver extends AgnosticDriver {
  readonly providerId = 'agnostic';
  private providerType: 'openai' | 'anthropic' | 'google' = 'openai';

  async initialize(): Promise<void> {
    // Check for API keys
    const provider = process.env.APEX_PRIMARY_PROVIDER || 'openai';
    if (provider === 'openai' || provider === 'anthropic' || provider === 'google') {
      this.providerType = provider as any;
    }
  }

  async authenticate(): Promise<void> {
    console.log(`Using API Key from environment for ${this.providerType}`);
  }

  resolveModel(modelAlias: string): string {
    if (this.providerType === 'anthropic') {
      if (modelAlias === 'opus') return 'claude-3-opus-20240229';
      if (modelAlias === 'haiku') return 'claude-3-haiku-20240307';
      return 'claude-3-5-sonnet-20240620';
    }
    if (this.providerType === 'google') {
      if (modelAlias === 'opus') return 'gemini-1.5-pro';
      if (modelAlias === 'haiku') return 'gemini-1.5-flash';
      return 'gemini-1.5-pro';
    }
    // Default to OpenAI
    if (modelAlias === 'opus') return 'gpt-4o';
    if (modelAlias === 'haiku') return 'gpt-4o-mini';
    return 'gpt-4o';
  }

  protected getModel(modelName: string): any {
    switch (this.providerType) {
      case 'anthropic': return anthropic(modelName);
      case 'google': return google(modelName);
      case 'openai': 
      default:
        return openai(modelName);
    }
  }
}
