import * as os from 'os';
import { vi, describe } from 'vitest';

/**
 * Platform detection utilities for testing
 */

/**
 * Check if the current platform is Windows
 * @returns true if running on Windows, false otherwise
 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Check if the current platform is Unix-like (Linux, macOS, FreeBSD, etc.)
 * @returns true if running on a Unix-like system, false otherwise
 */
export function isUnix(): boolean {
  return !isWindows();
}

/**
 * Check if the current platform is macOS
 * @returns true if running on macOS, false otherwise
 */
export function isMacOS(): boolean {
  return os.platform() === 'darwin';
}

/**
 * Check if the current platform is Linux
 * @returns true if running on Linux, false otherwise
 */
export function isLinux(): boolean {
  return os.platform() === 'linux';
}

/**
 * Get the platform name as a string
 * @returns The current platform name
 */
export function getPlatform(): string {
  return os.platform();
}

/**
 * Test skipping utilities
 */

/**
 * Skip a test if running on Windows
 * Call this at the beginning of a test to skip it on Windows platforms
 *
 * @example
 * ```typescript
 * it('should work on Unix only', () => {
 *   skipOnWindows();
 *   // test code that only works on Unix
 * });
 * ```
 */
export function skipOnWindows(): void {
  if (isWindows()) {
    vi.skip();
  }
}

/**
 * Skip a test if running on Unix-like systems (Linux, macOS, etc.)
 * Call this at the beginning of a test to skip it on Unix platforms
 *
 * @example
 * ```typescript
 * it('should work on Windows only', () => {
 *   skipOnUnix();
 *   // test code that only works on Windows
 * });
 * ```
 */
export function skipOnUnix(): void {
  if (isUnix()) {
    vi.skip();
  }
}

/**
 * Skip a test if running on macOS
 * Call this at the beginning of a test to skip it on macOS
 *
 * @example
 * ```typescript
 * it('should work on non-macOS systems only', () => {
 *   skipOnMacOS();
 *   // test code that doesn't work on macOS
 * });
 * ```
 */
export function skipOnMacOS(): void {
  if (isMacOS()) {
    vi.skip();
  }
}

/**
 * Skip a test if running on Linux
 * Call this at the beginning of a test to skip it on Linux
 *
 * @example
 * ```typescript
 * it('should work on non-Linux systems only', () => {
 *   skipOnLinux();
 *   // test code that doesn't work on Linux
 * });
 * ```
 */
export function skipOnLinux(): void {
  if (isLinux()) {
    vi.skip();
  }
}

/**
 * Skip a test unless running on Windows
 * Call this at the beginning of a test to only run it on Windows
 *
 * @example
 * ```typescript
 * it('should only run on Windows', () => {
 *   skipUnlessWindows();
 *   // test code that only works on Windows
 * });
 * ```
 */
export function skipUnlessWindows(): void {
  if (!isWindows()) {
    vi.skip();
  }
}

/**
 * Skip a test unless running on Unix-like systems
 * Call this at the beginning of a test to only run it on Unix platforms
 *
 * @example
 * ```typescript
 * it('should only run on Unix', () => {
 *   skipUnlessUnix();
 *   // test code that only works on Unix
 * });
 * ```
 */
export function skipUnlessUnix(): void {
  if (!isUnix()) {
    vi.skip();
  }
}

/**
 * Platform-specific describe blocks
 */

/**
 * Create a describe block that only runs on Windows
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeWindows('Windows-specific tests', () => {
 *   it('should test Windows behavior', () => {
 *     // Windows-only test code
 *   });
 * });
 * ```
 */
export function describeWindows(name: string, fn: () => void): void {
  if (isWindows()) {
    describe(`${name} (Windows)`, fn);
  } else {
    describe.skip(`${name} (Windows - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Create a describe block that only runs on Unix-like systems
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeUnix('Unix-specific tests', () => {
 *   it('should test Unix behavior', () => {
 *     // Unix-only test code
 *   });
 * });
 * ```
 */
export function describeUnix(name: string, fn: () => void): void {
  if (isUnix()) {
    describe(`${name} (Unix)`, fn);
  } else {
    describe.skip(`${name} (Unix - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Create a describe block that only runs on macOS
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeMacOS('macOS-specific tests', () => {
 *   it('should test macOS behavior', () => {
 *     // macOS-only test code
 *   });
 * });
 * ```
 */
export function describeMacOS(name: string, fn: () => void): void {
  if (isMacOS()) {
    describe(`${name} (macOS)`, fn);
  } else {
    describe.skip(`${name} (macOS - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Create a describe block that only runs on Linux
 *
 * @param name - Test suite name
 * @param fn - Test suite function
 *
 * @example
 * ```typescript
 * describeLinux('Linux-specific tests', () => {
 *   it('should test Linux behavior', () => {
 *     // Linux-only test code
 *   });
 * });
 * ```
 */
export function describeLinux(name: string, fn: () => void): void {
  if (isLinux()) {
    describe(`${name} (Linux)`, fn);
  } else {
    describe.skip(`${name} (Linux - skipped on ${getPlatform()})`, fn);
  }
}

/**
 * Platform-specific test conditionals
 */

/**
 * Run a function only if on Windows
 *
 * @param fn - Function to run on Windows
 * @returns Result of the function or undefined if not on Windows
 *
 * @example
 * ```typescript
 * it('should handle platform differences', () => {
 *   const windowsResult = runOnWindows(() => getWindowsSpecificValue());
 *   const unixResult = runOnUnix(() => getUnixSpecificValue());
 *
 *   if (windowsResult) {
 *     expect(windowsResult).toBe(expectedWindowsValue);
 *   }
 *   if (unixResult) {
 *     expect(unixResult).toBe(expectedUnixValue);
 *   }
 * });
 * ```
 */
export function runOnWindows<T>(fn: () => T): T | undefined {
  if (isWindows()) {
    return fn();
  }
  return undefined;
}

/**
 * Run a function only if on Unix-like systems
 *
 * @param fn - Function to run on Unix
 * @returns Result of the function or undefined if not on Unix
 *
 * @example
 * ```typescript
 * it('should handle platform differences', () => {
 *   const result = runOnUnix(() => getUnixSpecificValue());
 *   if (result) {
 *     expect(result).toBe(expectedValue);
 *   }
 * });
 * ```
 */
export function runOnUnix<T>(fn: () => T): T | undefined {
  if (isUnix()) {
    return fn();
  }
  return undefined;
}

/**
 * Run a function only if on macOS
 *
 * @param fn - Function to run on macOS
 * @returns Result of the function or undefined if not on macOS
 */
export function runOnMacOS<T>(fn: () => T): T | undefined {
  if (isMacOS()) {
    return fn();
  }
  return undefined;
}

/**
 * Run a function only if on Linux
 *
 * @param fn - Function to run on Linux
 * @returns Result of the function or undefined if not on Linux
 */
export function runOnLinux<T>(fn: () => T): T | undefined {
  if (isLinux()) {
    return fn();
  }
  return undefined;
}

/**
 * Platform mocking utilities for testing
 */

/**
 * Mock the platform for testing purposes
 *
 * @param platform - Platform to mock ('win32', 'darwin', 'linux', etc.)
 * @returns Function to restore the original platform
 *
 * @example
 * ```typescript
 * describe('cross-platform behavior', () => {
 *   it('should behave correctly on Windows', () => {
 *     const restore = mockPlatform('win32');
 *     expect(isWindows()).toBe(true);
 *     // test Windows behavior
 *     restore();
 *   });
 * });
 * ```
 */
export function mockPlatform(platform: string): () => void {
  const originalPlatform = process.platform;

  // Mock os.platform to return the desired platform
  vi.mocked(os.platform).mockReturnValue(platform as any);

  // Also mock process.platform for consistency
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true,
  });

  return () => {
    // Restore original values
    vi.mocked(os.platform).mockReturnValue(originalPlatform);
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  };
}

/**
 * Test a function on all major platforms
 *
 * @param testName - Name of the test
 * @param testFn - Test function that receives the platform name
 *
 * @example
 * ```typescript
 * testOnAllPlatforms('should work on all platforms', (platform) => {
 *   expect(someFunction()).toBeTruthy();
 * });
 * ```
 */
export function testOnAllPlatforms(
  testName: string,
  testFn: (platform: string) => void | Promise<void>
): void {
  const platforms = ['win32', 'darwin', 'linux', 'freebsd'];

  for (const platform of platforms) {
    it(`${testName} on ${platform}`, async () => {
      const restore = mockPlatform(platform);
      try {
        await testFn(platform);
      } finally {
        restore();
      }
    });
  }
}

/**
 * Constants for common platform names
 */
export const PLATFORMS = {
  WINDOWS: 'win32',
  MACOS: 'darwin',
  LINUX: 'linux',
  FREEBSD: 'freebsd',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

/**
 * Type guard to check if a string is a valid platform
 */
export function isValidPlatform(platform: string): platform is Platform {
  return Object.values(PLATFORMS).includes(platform as Platform);
}

/**
 * Permission Test Utilities
 */

import type {
  Permission,
  ExtendedPermission,
  PermissionQuery,
  PermissionLevel,
  BaseToolPermissionConfig,
  FilesystemToolConfig,
  ShellToolConfig,
  WebToolConfig,
  BrowserToolConfig,
  SearchToolConfig,
  DirectoryAccessConfig,
  ToolPermissionResult,
  DirectoryAccessResult,
  PermissionsConfig,
  PermissionPresetConfig,
  ToolPermissionRule,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData,
  PermissionPreset,
  ToolPermissionBehavior,
} from './types.js';

/**
 * Create a mock Permission object with sensible defaults
 *
 * @param overrides - Optional partial permission to override defaults
 * @returns A complete Permission object suitable for testing
 *
 * @example
 * ```typescript
 * const readPermission = createMockPermission({
 *   tool: 'Read',
 *   scope: '/project/src/**',
 *   level: 'allow-always'
 * });
 * ```
 */
export function createMockPermission(overrides: Partial<Permission> = {}): Permission {
  const now = new Date();
  return {
    tool: 'Read',
    scope: undefined,
    level: 'allow-always' as PermissionLevel,
    expiry: undefined,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Create a mock ExtendedPermission object with sensible defaults
 *
 * @param overrides - Optional partial extended permission to override defaults
 * @returns A complete ExtendedPermission object suitable for testing
 *
 * @example
 * ```typescript
 * const extendedPermission = createMockExtendedPermission({
 *   tool: 'Write',
 *   grantReason: 'User requested file creation',
 *   grantedBy: 'user@example.com'
 * });
 * ```
 */
export function createMockExtendedPermission(overrides: Partial<ExtendedPermission> = {}): ExtendedPermission {
  const basePermission = createMockPermission(overrides);
  return {
    ...basePermission,
    config: undefined,
    grantReason: undefined,
    grantedBy: undefined,
    tags: undefined,
    ...overrides,
  };
}

/**
 * Create a mock PermissionQuery object for testing permission lookups
 *
 * @param overrides - Optional partial query to override defaults
 * @returns A complete PermissionQuery object suitable for testing
 *
 * @example
 * ```typescript
 * const query = createMockPermissionQuery({
 *   tool: 'Bash',
 *   scope: 'npm install'
 * });
 * ```
 */
export function createMockPermissionQuery(overrides: Partial<PermissionQuery> = {}): PermissionQuery {
  return {
    tool: 'Read',
    scope: undefined,
    ...overrides,
  };
}

/**
 * Create a mock BaseToolPermissionConfig with sensible defaults
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete BaseToolPermissionConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const config = createMockToolPermissionConfig({
 *   requireConfirmation: true,
 *   timeout: 30000
 * });
 * ```
 */
export function createMockToolPermissionConfig(overrides: Partial<BaseToolPermissionConfig> = {}): BaseToolPermissionConfig {
  return {
    enabled: true,
    timeout: 0,
    requireConfirmation: false,
    rateLimitPerMinute: 0,
    metadata: undefined,
    ...overrides,
  };
}

/**
 * Create a mock DirectoryAccessConfig for testing filesystem access control
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete DirectoryAccessConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const dirConfig = createMockDirectoryAccessConfig({
 *   allowlist: ['/project/src/**'],
 *   blocklist: ['/project/node_modules/**']
 * });
 * ```
 */
export function createMockDirectoryAccessConfig(overrides: Partial<DirectoryAccessConfig> = {}): DirectoryAccessConfig {
  return {
    allowlist: [],
    blocklist: [],
    defaultAllow: undefined,
    resolveSymlinks: true,
    maxDepth: 0,
    ...overrides,
  };
}

/**
 * Create a mock FilesystemToolConfig for testing filesystem tool permissions
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete FilesystemToolConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const fsConfig = createMockFilesystemToolConfig({
 *   maxFileSize: 1024 * 1024,
 *   allowedExtensions: ['.ts', '.js', '.json'],
 *   directoryAccess: createMockDirectoryAccessConfig({ allowlist: ['/project/**'] })
 * });
 * ```
 */
export function createMockFilesystemToolConfig(overrides: Partial<FilesystemToolConfig> = {}): FilesystemToolConfig {
  const baseConfig = createMockToolPermissionConfig(overrides);
  return {
    ...baseConfig,
    directoryAccess: undefined,
    maxFileSize: 0,
    allowedExtensions: [],
    blockedExtensions: [],
    ...overrides,
  };
}

/**
 * Create a mock ShellToolConfig for testing shell command permissions
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete ShellToolConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const shellConfig = createMockShellToolConfig({
 *   blockedCommands: ['rm -rf', 'sudo'],
 *   allowElevatedPrivileges: false,
 *   workingDirectory: '/project'
 * });
 * ```
 */
export function createMockShellToolConfig(overrides: Partial<ShellToolConfig> = {}): ShellToolConfig {
  const baseConfig = createMockToolPermissionConfig(overrides);
  return {
    ...baseConfig,
    directoryAccess: undefined,
    blockedCommands: [],
    allowElevatedPrivileges: false,
    environment: undefined,
    workingDirectory: undefined,
    ...overrides,
  };
}

/**
 * Create a mock WebToolConfig for testing web access permissions
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete WebToolConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const webConfig = createMockWebToolConfig({
 *   allowedDomains: ['api.example.com'],
 *   maxResponseSize: 1024 * 1024,
 *   followRedirects: false
 * });
 * ```
 */
export function createMockWebToolConfig(overrides: Partial<WebToolConfig> = {}): WebToolConfig {
  const baseConfig = createMockToolPermissionConfig(overrides);
  return {
    ...baseConfig,
    allowedDomains: [],
    blockedDomains: [],
    maxResponseSize: 0,
    followRedirects: true,
    headers: undefined,
    ...overrides,
  };
}

/**
 * Create a mock BrowserToolConfig for testing browser automation permissions
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete BrowserToolConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const browserConfig = createMockBrowserToolConfig({
 *   allowedDomains: ['example.com'],
 *   allowJavaScriptExecution: false,
 *   headless: true
 * });
 * ```
 */
export function createMockBrowserToolConfig(overrides: Partial<BrowserToolConfig> = {}): BrowserToolConfig {
  const baseConfig = createMockToolPermissionConfig(overrides);
  return {
    ...baseConfig,
    allowedDomains: [],
    blockedDomains: [],
    allowJavaScriptExecution: undefined,
    allowFormSubmission: undefined,
    pageLoadTimeout: undefined,
    allowDownloads: undefined,
    allowScreenshots: undefined,
    blockPopups: undefined,
    engine: undefined,
    backend: undefined,
    headless: undefined,
    userAgent: undefined,
    viewport: undefined,
    ...overrides,
  };
}

/**
 * Create a mock SearchToolConfig for testing search tool permissions
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete SearchToolConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const searchConfig = createMockSearchToolConfig({
 *   directoryAccess: createMockDirectoryAccessConfig({ allowlist: ['/project/src/**'] }),
 *   maxResults: 100
 * });
 * ```
 */
export function createMockSearchToolConfig(overrides: Partial<SearchToolConfig> = {}): SearchToolConfig {
  const baseConfig = createMockToolPermissionConfig(overrides);
  return {
    ...baseConfig,
    directoryAccess: undefined,
    maxResults: 0,
    caseSensitive: undefined,
    includeHidden: undefined,
    ...overrides,
  };
}

/**
 * Create a mock ToolPermissionResult for testing permission check results
 *
 * @param overrides - Optional partial result to override defaults
 * @returns A complete ToolPermissionResult object suitable for testing
 *
 * @example
 * ```typescript
 * const result = createMockToolPermissionResult({
 *   allowed: false,
 *   denialReason: 'Tool requires confirmation',
 *   requiresConfirmation: true
 * });
 * ```
 */
export function createMockToolPermissionResult(overrides: Partial<ToolPermissionResult> = {}): ToolPermissionResult {
  return {
    allowed: true,
    level: 'allow-always' as PermissionLevel,
    requiresConfirmation: false,
    denialReason: undefined,
    config: undefined,
    ...overrides,
  };
}

/**
 * Create a mock DirectoryAccessResult for testing directory access checks
 *
 * @param overrides - Optional partial result to override defaults
 * @returns A complete DirectoryAccessResult object suitable for testing
 *
 * @example
 * ```typescript
 * const accessResult = createMockDirectoryAccessResult({
 *   allowed: false,
 *   reason: 'Path is in blocklist'
 * });
 * ```
 */
export function createMockDirectoryAccessResult(overrides: Partial<DirectoryAccessResult> = {}): DirectoryAccessResult {
  return {
    allowed: true,
    reason: 'Access granted by configuration',
    resolvedPath: undefined,
    appliedRule: undefined,
    ...overrides,
  };
}

/**
 * Create a mock PermissionsConfig for testing permission configuration
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete PermissionsConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const permissionsConfig = createMockPermissionsConfig({
 *   preset: 'read-only',
 *   customRules: {
 *     Read: { behavior: 'allow', config: createMockFilesystemToolConfig() }
 *   }
 * });
 * ```
 */
export function createMockPermissionsConfig(overrides: Partial<PermissionsConfig> = {}): PermissionsConfig {
  return {
    preset: 'review-all' as PermissionPreset,
    customRules: undefined,
    ...overrides,
  };
}

/**
 * Create a mock PermissionPresetConfig for testing permission presets
 *
 * @param overrides - Optional partial config to override defaults
 * @returns A complete PermissionPresetConfig object suitable for testing
 *
 * @example
 * ```typescript
 * const presetConfig = createMockPermissionPresetConfig({
 *   name: 'custom',
 *   description: 'Custom permission preset for testing',
 *   defaultBehavior: 'deny'
 * });
 * ```
 */
export function createMockPermissionPresetConfig(overrides: Partial<PermissionPresetConfig> = {}): PermissionPresetConfig {
  return {
    name: 'review-all' as PermissionPreset,
    description: 'Mock permission preset for testing',
    defaultBehavior: 'confirm' as ToolPermissionBehavior,
    toolRules: {},
    ...overrides,
  };
}

/**
 * Create a mock ToolPermissionRule for testing tool-specific permission rules
 *
 * @param overrides - Optional partial rule to override defaults
 * @returns A complete ToolPermissionRule object suitable for testing
 *
 * @example
 * ```typescript
 * const rule = createMockToolPermissionRule({
 *   behavior: 'allow',
 *   config: createMockFilesystemToolConfig({ requireConfirmation: true })
 * });
 * ```
 */
export function createMockToolPermissionRule(overrides: Partial<ToolPermissionRule> = {}): ToolPermissionRule {
  return {
    behavior: 'confirm' as ToolPermissionBehavior,
    config: undefined,
    ...overrides,
  };
}

/**
 * Create a mock PermissionRequestEventData for testing permission request events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns A complete PermissionRequestEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const requestEvent = createMockPermissionRequestEventData({
 *   tool: 'Write',
 *   scope: '/project/new-file.ts',
 *   reason: 'Agent wants to create a new TypeScript file'
 * });
 * ```
 */
export function createMockPermissionRequestEventData(overrides: Partial<PermissionRequestEventData> = {}): PermissionRequestEventData {
  return {
    tool: 'Read',
    scope: undefined,
    reason: 'Mock permission request for testing',
    agent: 'test-agent',
    stage: 'test-stage',
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...overrides,
  };
}

/**
 * Create a mock PermissionGrantedEventData for testing permission granted events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns A complete PermissionGrantedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const grantedEvent = createMockPermissionGrantedEventData({
 *   tool: 'Bash',
 *   level: 'allow-once',
 *   grantedBy: 'user@example.com'
 * });
 * ```
 */
export function createMockPermissionGrantedEventData(overrides: Partial<PermissionGrantedEventData> = {}): PermissionGrantedEventData {
  const requestData = createMockPermissionRequestEventData(overrides);
  return {
    ...requestData,
    level: 'allow-always' as PermissionLevel,
    grantedBy: 'test-user',
    grantedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock PermissionDeniedEventData for testing permission denied events
 *
 * @param overrides - Optional partial data to override defaults
 * @returns A complete PermissionDeniedEventData object suitable for testing
 *
 * @example
 * ```typescript
 * const deniedEvent = createMockPermissionDeniedEventData({
 *   tool: 'Bash',
 *   denialReason: 'Command contains dangerous operations',
 *   deniedBy: 'security-policy'
 * });
 * ```
 */
export function createMockPermissionDeniedEventData(overrides: Partial<PermissionDeniedEventData> = {}): PermissionDeniedEventData {
  const requestData = createMockPermissionRequestEventData(overrides);
  return {
    ...requestData,
    denialReason: 'Mock denial for testing',
    deniedBy: 'test-system',
    deniedAt: new Date(),
    ...overrides,
  };
}

/**
 * Interface for agent permission context used in tests
 */
export interface AgentPermissionContext {
  agent: string;
  permissions: Permission[];
  checkPermission: (tool: string, scope?: string) => { allowed: boolean; level: PermissionLevel | null };
  hasPermission: (tool: string) => boolean;
  grantPermission: ReturnType<typeof vi.fn>;
  revokePermission: ReturnType<typeof vi.fn>;
}

/**
 * Interface for tool permission context used in tests
 */
export interface ToolPermissionContext {
  tool: string;
  permissions: Array<{ level: PermissionLevel; scope?: string }>;
  checkAccess: (scope?: string) => { allowed: boolean; level: PermissionLevel };
  isAllowed: (scope?: string) => boolean;
  requiresConfirmation: (scope?: string) => boolean;
}

/**
 * Interface for comprehensive permission context used in tests
 */
export interface MockPermissionContext {
  preset: PermissionPreset;
  agents: Record<string, AgentPermissionContext>;
  tools: Record<string, ToolPermissionContext>;
  checkGlobalPermission: (tool: string, scope?: string) => { allowed: boolean; level?: PermissionLevel; reason?: string };
  grantPermission: ReturnType<typeof vi.fn>;
  revokePermission: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock agent permission context for testing
 *
 * @param agentName - Name of the agent these permissions apply to
 * @param permissions - Array of permission objects to associate with the agent
 * @returns Agent permission context with utility methods
 *
 * @example
 * ```typescript
 * const agentContext = mockAgentPermissions('developer', [
 *   createMockPermission({ tool: 'Read', level: 'allow-always' }),
 *   createMockPermission({ tool: 'Write', level: 'allow-once' })
 * ]);
 *
 * expect(agentContext.hasPermission('Read')).toBe(true);
 * ```
 */
export function mockAgentPermissions(agentName: string, permissions: Permission[]): AgentPermissionContext {
  return {
    agent: agentName,
    permissions,
    checkPermission: (tool: string, scope?: string) => {
      const permission = permissions.find(p => p.tool === tool && (scope ? p.scope === scope : true));
      if (permission) {
        return { allowed: true, level: permission.level };
      }
      return { allowed: false, level: null };
    },
    hasPermission: (tool: string) => {
      return permissions.some(p => p.tool === tool);
    },
    grantPermission: vi.fn(),
    revokePermission: vi.fn(),
  };
}

/**
 * Create a mock tool permission context for testing
 *
 * @param toolName - Name of the tool these permissions apply to
 * @param permissions - Array of permission rules for the tool
 * @returns Tool permission context with utility methods
 *
 * @example
 * ```typescript
 * const toolContext = mockToolPermissions('filesystem', [
 *   { level: 'allow-always', scope: '/workspace/**' },
 *   { level: 'deny', scope: '/system/**' }
 * ]);
 *
 * expect(toolContext.isAllowed('/workspace/file.txt')).toBe(true);
 * ```
 */
export function mockToolPermissions(
  toolName: string,
  permissions: Array<{ level: PermissionLevel; scope?: string }>
): ToolPermissionContext {
  const context = {
    tool: toolName,
    permissions,
    checkAccess: (scope?: string) => {
      // Find the most specific permission that matches the scope
      const matchingPermission = permissions.find(p => {
        if (!p.scope) return true; // Global permission
        if (!scope) return false;  // No scope provided, but permission has scope
        // Simple pattern matching - in a real implementation this would be more sophisticated
        return scope.startsWith(p.scope.replace('/**', '/')) || scope.includes(p.scope.replace('/**', ''));
      });

      if (matchingPermission) {
        return {
          allowed: matchingPermission.level !== 'deny',
          level: matchingPermission.level
        };
      }

      // Default to deny if no matching permission found
      return { allowed: false, level: 'deny' };
    },
    isAllowed: (scope?: string) => {
      const result = context.checkAccess(scope);
      return result.allowed;
    },
    requiresConfirmation: (scope?: string) => {
      const result = context.checkAccess(scope);
      return result.allowed && result.level === 'allow-once';
    },
  };

  return context;
}

/**
 * Create a comprehensive mock permission context for testing
 *
 * @param options - Configuration options for the permission context
 * @returns Mock permission context with all utility methods
 *
 * @example
 * ```typescript
 * const context = createMockPermissionContext({
 *   preset: 'autonomous',
 *   agents: {
 *     developer: [{ tool: 'Read', level: 'allow-always' }]
 *   },
 *   tools: {
 *     shell: [{ level: 'allow-once' }]
 *   }
 * });
 *
 * expect(context.checkGlobalPermission('Read')).toEqual(expect.objectContaining({ allowed: true }));
 * ```
 */
export function createMockPermissionContext(options: {
  preset?: PermissionPreset;
  agents?: Record<string, Array<{ tool: string; level: PermissionLevel }>>;
  tools?: Record<string, Array<{ level: PermissionLevel; scope?: string }>>;
} = {}): MockPermissionContext {
  const {
    preset = 'review-all',
    agents = {},
    tools = {}
  } = options;

  // Convert agent permission arrays to AgentPermissionContext objects
  const agentContexts: Record<string, AgentPermissionContext> = {};
  for (const [agentName, perms] of Object.entries(agents)) {
    const permissions = perms.map(p => createMockPermission(p));
    agentContexts[agentName] = mockAgentPermissions(agentName, permissions);
  }

  // Convert tool permission arrays to ToolPermissionContext objects
  const toolContexts: Record<string, ToolPermissionContext> = {};
  for (const [toolName, perms] of Object.entries(tools)) {
    toolContexts[toolName] = mockToolPermissions(toolName, perms);
  }

  return {
    preset,
    agents: agentContexts,
    tools: toolContexts,
    checkGlobalPermission: (tool: string, scope?: string) => {
      // Check if there's a specific tool context first
      const toolContext = toolContexts[tool];
      if (toolContext) {
        const result = toolContext.checkAccess(scope);
        return {
          allowed: result.allowed,
          level: result.level,
          reason: result.allowed ? 'Tool-specific permission' : 'Tool-specific denial'
        };
      }

      // Fall back to preset behavior
      switch (preset) {
        case 'autonomous':
          return { allowed: true, level: 'allow-once', reason: 'Autonomous preset allows all tools' };
        case 'read-only':
          const readOnlyTools = ['Read', 'Grep', 'Glob'];
          return {
            allowed: readOnlyTools.includes(tool),
            level: readOnlyTools.includes(tool) ? 'allow-always' : undefined,
            reason: readOnlyTools.includes(tool) ? 'Read-only preset allows read operations' : 'Read-only preset denies write operations'
          };
        case 'review-all':
        default:
          return { allowed: false, reason: 'Preset behavior requires confirmation' };
      }
    },
    grantPermission: vi.fn(),
    revokePermission: vi.fn(),
  };
}

/**
 * Create a set of common permission scenarios for testing
 *
 * @returns Object containing common permission scenarios
 *
 * @example
 * ```typescript
 * const scenarios = createCommonPermissionScenarios();
 *
 * // Test with read-only permissions
 * expect(checkPermission(scenarios.readOnly.Read)).toBe(true);
 * expect(checkPermission(scenarios.readOnly.Write)).toBe(false);
 *
 * // Test with full permissions
 * expect(checkPermission(scenarios.fullAccess.Bash)).toBe(true);
 * ```
 */
export function createCommonPermissionScenarios() {
  return {
    // Read-only scenario: only read operations allowed
    readOnly: {
      Read: createMockPermission({ tool: 'Read', level: 'allow-always' }),
      Grep: createMockPermission({ tool: 'Grep', level: 'allow-always' }),
      Glob: createMockPermission({ tool: 'Glob', level: 'allow-always' }),
      Write: createMockPermission({ tool: 'Write', level: 'deny' }),
      Bash: createMockPermission({ tool: 'Bash', level: 'deny' }),
    },
    // Review-all scenario: all tools require confirmation
    reviewAll: {
      Read: createMockPermission({ tool: 'Read', level: 'allow-once' }),
      Write: createMockPermission({ tool: 'Write', level: 'allow-once' }),
      Bash: createMockPermission({ tool: 'Bash', level: 'allow-once' }),
      WebFetch: createMockPermission({ tool: 'WebFetch', level: 'allow-once' }),
    },
    // Full access scenario: all tools allowed without confirmation
    fullAccess: {
      Read: createMockPermission({ tool: 'Read', level: 'allow-always' }),
      Write: createMockPermission({ tool: 'Write', level: 'allow-always' }),
      Edit: createMockPermission({ tool: 'Edit', level: 'allow-always' }),
      Bash: createMockPermission({ tool: 'Bash', level: 'allow-always' }),
      WebFetch: createMockPermission({ tool: 'WebFetch', level: 'allow-always' }),
      WebSearch: createMockPermission({ tool: 'WebSearch', level: 'allow-always' }),
    },
    // Mixed scenario: different permission levels for different tools
    mixed: {
      Read: createMockPermission({ tool: 'Read', level: 'allow-always' }),
      Write: createMockPermission({ tool: 'Write', level: 'allow-once' }),
      Bash: createMockPermission({ tool: 'Bash', level: 'deny' }),
      WebFetch: createMockPermission({ tool: 'WebFetch', level: 'allow-always' }),
    },
  };
}

/**
 * Create mock user confirmation simulation for testing interactive flows
 *
 * @param responses - Map of tool names to user responses (true = approve, false = deny)
 * @returns Mock function that simulates user confirmations
 *
 * @example
 * ```typescript
 * const mockConfirmation = createMockUserConfirmation({
 *   'Write': true,    // User approves Write operations
 *   'Bash': false,    // User denies Bash operations
 *   'Read': true      // User approves Read operations
 * });
 *
 * expect(mockConfirmation('Write', '/project/file.ts')).toBe(true);
 * expect(mockConfirmation('Bash', 'rm -rf /')).toBe(false);
 * ```
 */
export function createMockUserConfirmation(
  responses: Record<string, boolean>
): (tool: string, scope?: string) => boolean {
  return (tool: string, scope?: string): boolean => {
    // First check for tool-specific response
    if (tool in responses) {
      return responses[tool];
    }

    // Check for scope-specific response
    if (scope) {
      const scopeKey = `${tool}:${scope}`;
      if (scopeKey in responses) {
        return responses[scopeKey];
      }
    }

    // Default to approval if no specific response configured
    return true;
  };
}

/**
 * Create a mock permission store setup for testing database operations
 *
 * @param initialPermissions - Array of permissions to pre-populate the store
 * @returns Mock permission store context
 *
 * @example
 * ```typescript
 * const { store, cleanup } = await createTestPermissionStore([
 *   createMockPermission({ tool: 'Read', level: 'allow-always' }),
 *   createMockPermission({ tool: 'Write', level: 'deny' })
 * ]);
 *
 * const permission = await store.getPermission('Read');
 * expect(permission?.level).toBe('allow-always');
 *
 * await cleanup();
 * ```
 */
export async function createTestPermissionStore(initialPermissions: Permission[] = []) {
  // This will be implemented as part of the database utilities task
  // For now, return a placeholder that can be extended
  return {
    store: {
      async getPermission(tool: string, scope?: string): Promise<Permission | null> {
        return initialPermissions.find(p => p.tool === tool && p.scope === scope) || null;
      },
      async savePermission(permission: Permission): Promise<void> {
        // Mock implementation
      },
      async listPermissions(): Promise<Permission[]> {
        return [...initialPermissions];
      },
      async deletePermission(tool: string, scope?: string): Promise<boolean> {
        return true;
      },
    },
    cleanup: async (): Promise<void> => {
      // Mock cleanup
    },
  };
}

/**
 * Assert that a permission has the expected properties for testing
 *
 * @param actual - The actual permission object
 * @param expected - The expected permission properties
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * const permission = createMockPermission({ tool: 'Read' });
 * assertPermissionEquals(permission, {
 *   tool: 'Read',
 *   level: 'allow-always',
 *   scope: undefined
 * });
 * ```
 */
export function assertPermissionEquals(
  actual: Permission,
  expected: Partial<Permission>,
  message?: string
): void {
  const failures: string[] = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = (actual as any)[key];
    if (actualValue !== expectedValue) {
      failures.push(`${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
    }
  }

  if (failures.length > 0) {
    const failureMessage = failures.join(', ');
    const fullMessage = message ? `${message}: ${failureMessage}` : failureMessage;
    throw new Error(`Permission assertion failed: ${fullMessage}`);
  }
}