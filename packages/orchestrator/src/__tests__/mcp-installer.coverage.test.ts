import { describe, it, expect } from 'vitest';
import { MCPInstaller } from '../mcp-installer';

/**
 * Basic smoke test to verify MCPInstaller can be imported and instantiated
 * This test serves as a coverage baseline and import validation
 */
describe('MCPInstaller Coverage Test', () => {
  it('should be importable and instantiable', () => {
    expect(MCPInstaller).toBeDefined();
    expect(typeof MCPInstaller).toBe('function');

    // Test that it can be constructed (we won't call any methods that require real dependencies)
    const mockStore = {} as any;
    const installer = new MCPInstaller('/test/path', mockStore);
    expect(installer).toBeInstanceOf(MCPInstaller);
  });

  it('should have all required public methods', () => {
    const mockStore = {} as any;
    const installer = new MCPInstaller('/test/path', mockStore);

    // Check that all public methods exist
    expect(typeof installer.install).toBe('function');
    expect(typeof installer.uninstall).toBe('function');
    expect(typeof installer.listInstalled).toBe('function');
    expect(typeof installer.getInstallation).toBe('function');
    expect(typeof installer.isInstalled).toBe('function');
    expect(typeof installer.updateMarketplaceCache).toBe('function');
    expect(typeof installer.getMarketplaceEntries).toBe('function');
  });
});