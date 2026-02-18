import { describe, it, expect } from 'vitest';
import { BrowserTool } from './tools/browser-tool';
import { buildBrowserToolsServer } from './browser-mcp';

describe('buildBrowserToolsServer', () => {
  it('creates an SDK MCP server with the Browser tool', () => {
    const server = buildBrowserToolsServer(new BrowserTool());
    expect(server.name).toBe('browser-tools');
    expect(server.config.type).toBe('sdk');
  });
});
