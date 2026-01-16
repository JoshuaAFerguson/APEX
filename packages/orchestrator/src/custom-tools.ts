import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { z } from 'zod';
import type { CustomToolConfig, ToolParametersSchema, ToolParameter } from '@apexcli/core';
import { SchemaTranslator } from './schema-translator.js';

const execFileAsync = promisify(execFile);

type ZodShape = Record<string, z.ZodTypeAny>;

/**
 * Build Zod schema shape from tool parameters using SchemaTranslator
 * @deprecated - Use SchemaTranslator directly for new code
 */
function buildZodSchemaShape(parameters: ToolParametersSchema): ZodShape {
  const schemaTranslator = new SchemaTranslator();

  // Convert ToolParametersSchema to MCPToolSchema format
  const mcpSchema = {
    type: 'object' as const,
    properties: parameters.properties || {},
    required: parameters.required || [],
  };

  // Use SchemaTranslator to convert
  const zodObjectSchema = schemaTranslator.translateInputSchema(mcpSchema);

  // Return the shape for compatibility with existing code
  return zodObjectSchema.shape;
}

function interpolateArg(arg: string, input: Record<string, unknown>): string {
  return arg.replace(/{{\s*input(?:\.([a-zA-Z0-9_]+))?\s*}}/g, (_, key: string | undefined) => {
    if (!key) {
      return JSON.stringify(input);
    }
    const value = input[key];
    if (value === undefined) {
      return '';
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

function buildCommandArgs(baseArgs: string[], input: Record<string, unknown>): string[] {
  const hasPlaceholder = baseArgs.some(arg => arg.includes('{{'));
  const interpolated = baseArgs.map(arg => interpolateArg(arg, input));
  if (hasPlaceholder) {
    return interpolated;
  }
  return [...interpolated, JSON.stringify(input)];
}

function parseToolOutput(output: string, mode: CustomToolConfig['outputParser']): unknown {
  switch (mode) {
    case 'json':
      return JSON.parse(output);
    case 'lines':
      return output.split(/\r?\n/).filter(line => line.length > 0);
    case 'text':
    default:
      return output;
  }
}

function formatToolOutput(parsed: unknown): { text: string; structured?: Record<string, unknown> } {
  if (parsed === undefined) {
    return { text: '' };
  }

  if (typeof parsed === 'string') {
    return { text: parsed };
  }

  if (Array.isArray(parsed)) {
    return { text: parsed.join('\n'), structured: { items: parsed } };
  }

  if (parsed && typeof parsed === 'object') {
    return { text: JSON.stringify(parsed, null, 2), structured: parsed as Record<string, unknown> };
  }

  return { text: String(parsed) };
}

export type CustomToolsServer = { name: string; config: ReturnType<typeof createSdkMcpServer> };

export function buildCustomToolsServer(
  customTools: CustomToolConfig[],
  projectPath: string,
  schemaTranslator?: SchemaTranslator
): CustomToolsServer | null {
  const enabledTools = customTools.filter(toolConfig => toolConfig.enabled !== false);
  if (enabledTools.length === 0) {
    return null;
  }

  const translator = schemaTranslator || new SchemaTranslator();

  const toolDefinitions = enabledTools.map((toolConfig) => {
    // Convert ToolParametersSchema to MCPToolSchema format
    const mcpSchema = {
      type: 'object' as const,
      properties: toolConfig.parameters.properties || {},
      required: toolConfig.parameters.required || [],
    };

    // Use SchemaTranslator to get Zod schema
    const zodObjectSchema = translator.translateInputSchema(mcpSchema);
    const shape = zodObjectSchema.shape;

    return tool(toolConfig.name, toolConfig.description, shape, async (args) => {
      const input = (args ?? {}) as Record<string, unknown>;
      const executionArgs = buildCommandArgs(toolConfig.args, input);
      const cwd = toolConfig.workingDirectory
        ? path.resolve(projectPath, toolConfig.workingDirectory)
        : projectPath;

      try {
        const { stdout, stderr } = await execFileAsync(toolConfig.command, executionArgs, {
          cwd,
          timeout: toolConfig.timeoutMs,
          env: {
            ...process.env,
            ...toolConfig.env,
            APEX_TOOL_INPUT: JSON.stringify(input),
          },
          maxBuffer: 1024 * 1024 * 10,
        });

        const parsed = parseToolOutput(stdout.trim(), toolConfig.outputParser);
        const formatted = formatToolOutput(parsed);

        return {
          content: formatted.text ? [{ type: 'text', text: formatted.text }] : [],
          structuredContent: formatted.structured,
          isError: false,
          _meta: {
            stderr: stderr?.trim() || undefined,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: message }],
          isError: true,
        };
      }
    });
  });

  const name = 'custom-tools';
  return {
    name,
    config: createSdkMcpServer({
      name,
      tools: toolDefinitions,
    }),
  };
}
