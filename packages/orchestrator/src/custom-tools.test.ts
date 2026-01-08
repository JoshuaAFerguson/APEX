import { describe, it, expect } from 'vitest';
import { buildCustomToolsServer } from './custom-tools';
import type { CustomToolConfig } from '@apexcli/core';

describe('buildCustomToolsServer', () => {
  it('returns null when no tools are enabled', () => {
    const server = buildCustomToolsServer([], '/tmp');
    expect(server).toBeNull();
  });

  it('creates an SDK MCP server for enabled tools', () => {
    const toolConfig: CustomToolConfig = {
      name: 'EchoTool',
      description: 'Echo input payload',
      command: 'echo',
      args: ['{{input.message}}'],
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
      outputParser: 'text',
      timeoutMs: 1000,
      enabled: true,
    };

    const server = buildCustomToolsServer([toolConfig], '/tmp');
    expect(server).not.toBeNull();
    expect(server?.config.type).toBe('sdk');
    expect(server?.config.name).toBe('custom-tools');
  });
});
