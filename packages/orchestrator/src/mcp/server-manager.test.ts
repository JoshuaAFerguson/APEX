import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ApexConfig } from '@apexcli/core';
import { MCPServerManager } from './server-manager';

const baseConfig: ApexConfig = {
  version: '1.0',
  project: {
    name: 'mcp-test',
  },
};

describe('MCPServerManager', () => {
  it('filters invalid MCP server configs', () => {
    const config: ApexConfig = {
      ...baseConfig,
      mcp: {
        enabled: true,
        servers: {
          valid: {
            name: 'valid',
            type: 'stdio',
            command: 'node',
          },
          invalid: {
            name: 'invalid',
            type: 'stdio',
          },
        },
      },
    };

    const manager = new MCPServerManager('/tmp', config);
    const servers = manager.getSdkServerConfigs();
    expect(Object.keys(servers)).toEqual(['valid']);
  });

  it('loads marketplace entries from a local file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-mcp-marketplace-'));
    const marketplacePath = path.join(tempDir, 'marketplace.json');

    await fs.writeFile(
      marketplacePath,
      JSON.stringify([
        {
          name: 'example-server',
          description: 'Example MCP server',
          version: '1.0.0',
          serverConfig: {
            name: 'example-server',
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
          verified: true,
        },
      ]),
      'utf-8'
    );

    const config: ApexConfig = {
      ...baseConfig,
      mcp: {
        enabled: true,
        servers: {},
        marketplace: {
          url: marketplacePath,
          enabled: true,
          refreshIntervalMinutes: 60,
          allowUnverified: false,
        },
      },
    };

    const manager = new MCPServerManager(tempDir, config);
    const entries = await manager.listMarketplaceEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('example-server');
  });
});
