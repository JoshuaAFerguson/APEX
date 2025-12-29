import { describe, it, expect } from 'vitest';

/**
 * Smoke test to verify that test utilities can be imported and basic functions work
 */
describe('test-utils smoke test', () => {
  it('should be able to import test utilities', async () => {
    // Test that all utilities can be imported
    const testUtils = await import('../test-utils.js');

    // Check that main exports exist
    expect(typeof testUtils.isWindows).toBe('function');
    expect(typeof testUtils.isUnix).toBe('function');
    expect(typeof testUtils.isMacOS).toBe('function');
    expect(typeof testUtils.isLinux).toBe('function');
    expect(typeof testUtils.getPlatform).toBe('function');

    // Check skip utilities exist
    expect(typeof testUtils.skipOnWindows).toBe('function');
    expect(typeof testUtils.skipOnUnix).toBe('function');
    expect(typeof testUtils.skipOnMacOS).toBe('function');
    expect(typeof testUtils.skipOnLinux).toBe('function');

    // Check describe utilities exist
    expect(typeof testUtils.describeWindows).toBe('function');
    expect(typeof testUtils.describeUnix).toBe('function');
    expect(typeof testUtils.describeMacOS).toBe('function');
    expect(typeof testUtils.describeLinux).toBe('function');

    // Check conditional runners exist
    expect(typeof testUtils.runOnWindows).toBe('function');
    expect(typeof testUtils.runOnUnix).toBe('function');
    expect(typeof testUtils.runOnMacOS).toBe('function');
    expect(typeof testUtils.runOnLinux).toBe('function');

    // Check mocking utilities exist
    expect(typeof testUtils.mockPlatform).toBe('function');
    expect(typeof testUtils.testOnAllPlatforms).toBe('function');

    // Check constants exist
    expect(typeof testUtils.PLATFORMS).toBe('object');
    expect(typeof testUtils.isValidPlatform).toBe('function');
  });

  it('should detect platform correctly', async () => {
    const { isWindows, isUnix, isMacOS, isLinux, getPlatform } = await import('../test-utils.js');

    // Basic platform detection should work
    const platform = getPlatform();
    expect(typeof platform).toBe('string');
    expect(platform.length).toBeGreaterThan(0);

    // Platform detection functions should be boolean
    expect(typeof isWindows()).toBe('boolean');
    expect(typeof isUnix()).toBe('boolean');
    expect(typeof isMacOS()).toBe('boolean');
    expect(typeof isLinux()).toBe('boolean');

    // Exactly one should be true (Windows vs Unix distinction)
    const isWindowsPlatform = isWindows();
    const isUnixPlatform = isUnix();
    expect(isWindowsPlatform || isUnixPlatform).toBe(true);
    expect(isWindowsPlatform && isUnixPlatform).toBe(false);
  });

  it('should have working constants', async () => {
    const { PLATFORMS, isValidPlatform } = await import('../test-utils.js');

    // Constants should exist
    expect(PLATFORMS.WINDOWS).toBe('win32');
    expect(PLATFORMS.MACOS).toBe('darwin');
    expect(PLATFORMS.LINUX).toBe('linux');
    expect(PLATFORMS.FREEBSD).toBe('freebsd');

    // Type guard should work
    expect(isValidPlatform('win32')).toBe(true);
    expect(isValidPlatform('darwin')).toBe(true);
    expect(isValidPlatform('linux')).toBe(true);
    expect(isValidPlatform('freebsd')).toBe(true);
    expect(isValidPlatform('unknown')).toBe(false);
  });

  it('should be available from main exports', async () => {
    // Test that utilities are exported from the main index
    const coreExports = await import('../index.js');

    // Check that test utilities are available from main exports
    expect(typeof coreExports.isWindows).toBe('function');
    expect(typeof coreExports.skipOnWindows).toBe('function');
    expect(typeof coreExports.describeWindows).toBe('function');
    expect(typeof coreExports.runOnWindows).toBe('function');
    expect(typeof coreExports.mockPlatform).toBe('function');
    expect(typeof coreExports.PLATFORMS).toBe('object');
  });
});