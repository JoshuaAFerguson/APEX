import { describe, it, expect } from 'vitest';
import { MCPServerStore } from '../mcp-store';
import { MCPInstallation } from '@apexcli/core';

describe('MCPServerStore Smoke Test', () => {
  it('should be importable and instantiable', () => {
    expect(MCPServerStore).toBeDefined();
    expect(typeof MCPServerStore).toBe('function');

    // Should be able to create an instance
    const store = new MCPServerStore('/tmp/test');
    expect(store).toBeDefined();
    expect(store).toBeInstanceOf(MCPServerStore);
  });

  it('should validate MCPInstallation type', () => {
    const installation: MCPInstallation = {
      id: 'test-id',
      serverId: 'test-server',
      installedAt: new Date(),
      status: 'installed',
      configPath: '/test/config.json',
    };

    // Type check - this should compile without errors
    expect(installation.id).toBe('test-id');
    expect(installation.serverId).toBe('test-server');
    expect(installation.status).toBe('installed');
    expect(installation.configPath).toBe('/test/config.json');
    expect(installation.installedAt).toBeInstanceOf(Date);
  });
});