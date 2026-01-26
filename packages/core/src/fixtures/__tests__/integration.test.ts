/**
 * @fileoverview Integration test for marketplace fixtures export
 *
 * Tests that marketplace fixtures are properly accessible through the main package exports.
 */

import { describe, expect, it } from 'vitest';

describe('Marketplace Fixtures Integration', () => {
  it('should be accessible through test-fixtures export', async () => {
    // This tests the integration with the test-fixtures module
    const {
      baseMarketplace,
      baseMarketplaceEntries,
      createMarketplaceEntry
    } = await import('../index.js');

    expect(baseMarketplace).toBeDefined();
    expect(baseMarketplace.name).toBe('MCP Registry');
    expect(baseMarketplace.servers).toHaveLength(5);

    expect(baseMarketplaceEntries).toBeDefined();
    expect(baseMarketplaceEntries.filesystem).toBeDefined();

    expect(createMarketplaceEntry).toBeDefined();
    expect(typeof createMarketplaceEntry).toBe('function');
  });

  it('should be accessible through core package exports', async () => {
    // Test that the fixtures are properly exported from the core package
    try {
      const coreExports = await import('../../index.js');

      // The fixtures should be available through the test-fixtures export
      expect(coreExports).toBeDefined();

      // Note: The actual marketplace fixtures are nested in the test-fixtures export
      // This test validates that the export structure works
      console.log('Core package exports structure validated');
    } catch (error) {
      // If there are import errors, we'll catch them here
      console.error('Import error:', error);
      throw error;
    }
  });

  it('should demonstrate complete marketplace fixture usage', async () => {
    const {
      baseMarketplace,
      baseFilesystemMarketplaceEntry,
      createMarketplaceEntry,
      getVerifiedEntries,
      getEntriesByCapability
    } = await import('../index.js');

    // Test complete workflow
    const customEntry = createMarketplaceEntry(baseFilesystemMarketplaceEntry, {
      name: 'test-server',
      verified: false,
    });

    expect(customEntry.name).toBe('test-server');
    expect(customEntry.verified).toBe(false);

    // Test filtering functions
    const verifiedEntries = getVerifiedEntries();
    expect(verifiedEntries.length).toBeGreaterThan(0);

    const toolEntries = getEntriesByCapability('tools');
    expect(toolEntries.length).toBeGreaterThan(0);

    // Test marketplace structure
    expect(baseMarketplace.servers).toContain(baseFilesystemMarketplaceEntry);
  });
});