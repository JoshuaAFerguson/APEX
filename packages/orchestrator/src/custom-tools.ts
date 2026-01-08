import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { z } from 'zod';
import type { CustomToolConfig, ToolParametersSchema, ToolParameter } from '@apexcli/core';

const execFileAsync = promisify(execFile);

type ZodShape = Record<string, z.ZodTypeAny>;

function buildZodSchemaFromParameter(parameter: ToolParameter): z.ZodTypeAny {
  switch (parameter.type) {
    case 'string': {
      if (Array.isArray(parameter.enum) && parameter.enum.length > 0) {
        const enumValues = parameter.enum.filter(value => typeof value === 'string') as string[];
        if (enumValues.length === parameter.enum.length) {
          const enumSchema = z.enum(enumValues as [string, ...string[]]);
          return parameter.default !== undefined ? enumSchema.default(parameter.default as string) : enumSchema;
        }
      }
      let strSchema = z.string();
      if (parameter.minLength !== undefined) {
        strSchema = strSchema.min(parameter.minLength);
      }
      if (parameter.maxLength !== undefined) {
        strSchema = strSchema.max(parameter.maxLength);
      }
      if (parameter.pattern) {
        strSchema = strSchema.regex(new RegExp(parameter.pattern));
      }
      return parameter.default !== undefined ? strSchema.default(parameter.default as string) : strSchema;
    }
    case 'integer': {
      let intSchema = z.number().int();
      if (parameter.minimum !== undefined) {
        intSchema = intSchema.min(parameter.minimum);
      }
      if (parameter.maximum !== undefined) {
        intSchema = intSchema.max(parameter.maximum);
      }
      return parameter.default !== undefined ? intSchema.default(parameter.default as number) : intSchema;
    }
    case 'number': {
      let numSchema = z.number();
      if (parameter.minimum !== undefined) {
        numSchema = numSchema.min(parameter.minimum);
      }
      if (parameter.maximum !== undefined) {
        numSchema = numSchema.max(parameter.maximum);
      }
      return parameter.default !== undefined ? numSchema.default(parameter.default as number) : numSchema;
    }
    case 'boolean': {
      const boolSchema = z.boolean();
      return parameter.default !== undefined ? boolSchema.default(parameter.default as boolean) : boolSchema;
    }
    case 'array': {
      const itemSchema = parameter.items ? buildZodSchemaFromParameter(parameter.items) : z.unknown();
      const arrSchema = z.array(itemSchema);
      return parameter.default !== undefined ? arrSchema.default(parameter.default as unknown[]) : arrSchema;
    }
    case 'object': {
      if (parameter.properties && Object.keys(parameter.properties).length > 0) {
        const nestedShape: ZodShape = {};
        for (const [key, value] of Object.entries(parameter.properties)) {
          nestedShape[key] = buildZodSchemaFromParameter(value);
        }
        const objSchema = z.object(nestedShape);
        return parameter.default !== undefined ? objSchema.default(parameter.default as Record<string, unknown>) : objSchema;
      } else {
        const recSchema = z.record(z.unknown());
        return parameter.default !== undefined ? recSchema.default(parameter.default as Record<string, unknown>) : recSchema;
      }
    }
    default: {
      const unknownSchema = z.unknown();
      return parameter.default !== undefined ? unknownSchema.default(parameter.default) : unknownSchema;
    }
  }
}

function buildZodSchemaShape(parameters: ToolParametersSchema): ZodShape {
  const shape: ZodShape = {};
  const properties = parameters.properties || {};
  const required = new Set(parameters.required || []);

  for (const [key, value] of Object.entries(properties)) {
    const parameter = value as ToolParameter;
    const schema = buildZodSchemaFromParameter(parameter);
    shape[key] = required.has(key) ? schema : schema.optional();
  }

  return shape;
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
  projectPath: string
): CustomToolsServer | null {
  const enabledTools = customTools.filter(toolConfig => toolConfig.enabled !== false);
  if (enabledTools.length === 0) {
    return null;
  }

  const toolDefinitions = enabledTools.map((toolConfig) => {
    const shape = buildZodSchemaShape(toolConfig.parameters);
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
