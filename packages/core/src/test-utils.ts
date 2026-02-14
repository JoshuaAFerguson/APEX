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

/**
 * Assert that a permission result has the expected properties for testing
 *
 * @param actual - The actual permission result object
 * @param expected - The expected permission result properties
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * const result = await permissionManager.checkToolPermission('Read', '/project/file.ts');
 * assertPermissionResultEquals(result, {
 *   allowed: true,
 *   level: 'allow-always',
 *   requiresConfirmation: false
 * });
 * ```
 */
export function assertPermissionResultEquals(
  actual: ToolPermissionResult,
  expected: Partial<ToolPermissionResult>,
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
    throw new Error(`Permission result assertion failed: ${fullMessage}`);
  }
}

/**
 * Assert that a permission state matches expected state for testing
 *
 * @param actual - The actual permission state
 * @param expected - The expected permission state
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * assertPermissionState('allow-always', 'allow-always');
 * assertPermissionState('deny', 'deny', 'Write permission should be denied');
 * ```
 */
export function assertPermissionState(
  actual: PermissionLevel | null,
  expected: PermissionLevel | null,
  message?: string
): void {
  if (actual !== expected) {
    const fullMessage = message
      ? `${message}: expected ${expected}, got ${actual}`
      : `Permission state assertion failed: expected ${expected}, got ${actual}`;
    throw new Error(fullMessage);
  }
}

/**
 * Assert that a tool is allowed with the expected permission level
 *
 * @param result - The permission result to check
 * @param expectedLevel - The expected permission level, or null if denied
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * const result = await manager.checkPermission('Read');
 * assertToolIsAllowed(result, 'allow-always', 'Read should be always allowed');
 *
 * const deniedResult = await manager.checkPermission('Bash');
 * assertToolIsDenied(deniedResult, 'Bash should be denied');
 * ```
 */
export function assertToolIsAllowed(
  result: ToolPermissionResult,
  expectedLevel?: PermissionLevel,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (!result.allowed) {
    throw new Error(`${baseMessage}Tool should be allowed but was denied. Reason: ${result.denialReason || 'Unknown'}`);
  }

  if (expectedLevel && result.level !== expectedLevel) {
    throw new Error(`${baseMessage}Tool allowed but with wrong level. Expected: ${expectedLevel}, got: ${result.level}`);
  }
}

/**
 * Assert that a tool is denied
 *
 * @param result - The permission result to check
 * @param expectedReason - Optional expected denial reason
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * const result = await manager.checkPermission('Bash');
 * assertToolIsDenied(result, 'Tool requires confirmation');
 * ```
 */
export function assertToolIsDenied(
  result: ToolPermissionResult,
  expectedReason?: string,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (result.allowed) {
    throw new Error(`${baseMessage}Tool should be denied but was allowed with level: ${result.level}`);
  }

  if (expectedReason && result.denialReason !== expectedReason) {
    throw new Error(`${baseMessage}Tool denied but with wrong reason. Expected: "${expectedReason}", got: "${result.denialReason || 'Unknown'}"`);
  }
}

/**
 * Assert that a tool requires confirmation
 *
 * @param result - The permission result to check
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * const result = await manager.checkPermission('Write');
 * assertToolRequiresConfirmation(result, 'Write should require user confirmation');
 * ```
 */
export function assertToolRequiresConfirmation(
  result: ToolPermissionResult,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (!result.allowed) {
    throw new Error(`${baseMessage}Tool is denied, cannot require confirmation`);
  }

  if (!result.requiresConfirmation) {
    throw new Error(`${baseMessage}Tool should require confirmation but doesn't`);
  }

  if (result.level !== 'allow-once') {
    throw new Error(`${baseMessage}Tool requires confirmation but has wrong level. Expected: allow-once, got: ${result.level}`);
  }
}

/**
 * Create a comprehensive permission testing suite with helper methods
 *
 * @param initialPermissions - Optional initial permissions to set up
 * @returns Testing suite with commonly used assertion methods
 *
 * @example
 * ```typescript
 * describe('Permission integration tests', () => {
 *   const suite = createPermissionTestingSuite([
 *     createMockPermission({ tool: 'Read', level: 'allow-always' })
 *   ]);
 *
 *   it('should test read permissions', async () => {
 *     await suite.assertToolIsAllowed('Read', 'allow-always');
 *     await suite.assertToolIsDenied('Write');
 *   });
 * });
 * ```
 */
export function createPermissionTestingSuite(initialPermissions: Permission[] = []) {
  const permissionMap = new Map<string, Permission>();

  // Initialize with provided permissions
  for (const permission of initialPermissions) {
    const key = permission.scope ? `${permission.tool}:${permission.scope}` : permission.tool;
    permissionMap.set(key, permission);
  }

  return {
    /**
     * Add a permission to the test suite
     */
    addPermission(permission: Permission): void {
      const key = permission.scope ? `${permission.tool}:${permission.scope}` : permission.tool;
      permissionMap.set(key, permission);
    },

    /**
     * Remove a permission from the test suite
     */
    removePermission(tool: string, scope?: string): void {
      const key = scope ? `${tool}:${scope}` : tool;
      permissionMap.delete(key);
    },

    /**
     * Get a permission from the test suite
     */
    getPermission(tool: string, scope?: string): Permission | undefined {
      const key = scope ? `${tool}:${scope}` : tool;
      return permissionMap.get(key);
    },

    /**
     * Check if a tool is allowed based on current permissions
     */
    isAllowed(tool: string, scope?: string): boolean {
      const permission = this.getPermission(tool, scope);
      if (!permission) return false;
      return permission.level !== 'deny';
    },

    /**
     * Check if a tool requires confirmation based on current permissions
     */
    requiresConfirmation(tool: string, scope?: string): boolean {
      const permission = this.getPermission(tool, scope);
      if (!permission) return false;
      return permission.level === 'allow-once';
    },

    /**
     * Assert that a tool is allowed with expected level
     */
    async assertToolIsAllowed(tool: string, expectedLevel?: PermissionLevel, scope?: string, message?: string): Promise<void> {
      const permission = this.getPermission(tool, scope);
      if (!permission) {
        throw new Error(`${message || ''}: No permission found for ${tool}${scope ? `:${scope}` : ''}`);
      }
      if (permission.level === 'deny') {
        throw new Error(`${message || ''}: Tool ${tool} is denied`);
      }
      if (expectedLevel && permission.level !== expectedLevel) {
        throw new Error(`${message || ''}: Tool ${tool} has level ${permission.level}, expected ${expectedLevel}`);
      }
    },

    /**
     * Assert that a tool is denied
     */
    async assertToolIsDenied(tool: string, scope?: string, message?: string): Promise<void> {
      const permission = this.getPermission(tool, scope);
      if (!permission) {
        // No permission found means denied in most cases
        return;
      }
      if (permission.level !== 'deny') {
        throw new Error(`${message || ''}: Tool ${tool} should be denied but has level ${permission.level}`);
      }
    },

    /**
     * Assert that a tool requires confirmation
     */
    async assertToolRequiresConfirmation(tool: string, scope?: string, message?: string): Promise<void> {
      const permission = this.getPermission(tool, scope);
      if (!permission) {
        throw new Error(`${message || ''}: No permission found for ${tool}${scope ? `:${scope}` : ''}`);
      }
      if (permission.level !== 'allow-once') {
        throw new Error(`${message || ''}: Tool ${tool} should require confirmation but has level ${permission.level}`);
      }
    },

    /**
     * Get all permissions in the test suite
     */
    getAllPermissions(): Permission[] {
      return Array.from(permissionMap.values());
    },

    /**
     * Clear all permissions
     */
    clearAll(): void {
      permissionMap.clear();
    },
  };
}

/**
 * Create a batch permission checker for testing multiple tools at once
 *
 * @param permissions - Array of permissions to check against
 * @returns Batch checker with utility methods
 *
 * @example
 * ```typescript
 * const checker = createBatchPermissionChecker([
 *   createMockPermission({ tool: 'Read', level: 'allow-always' }),
 *   createMockPermission({ tool: 'Write', level: 'deny' })
 * ]);
 *
 * checker.assertBatch([
 *   { tool: 'Read', expected: 'allow-always' },
 *   { tool: 'Write', expected: 'deny' }
 * ]);
 * ```
 */
export function createBatchPermissionChecker(permissions: Permission[]) {
  const permissionMap = new Map<string, Permission>();

  for (const permission of permissions) {
    const key = permission.scope ? `${permission.tool}:${permission.scope}` : permission.tool;
    permissionMap.set(key, permission);
  }

  return {
    /**
     * Check permissions for multiple tools at once
     */
    checkBatch(checks: Array<{ tool: string; scope?: string; expected: PermissionLevel | null }>): Array<{ tool: string; scope?: string; passed: boolean; actual: PermissionLevel | null; expected: PermissionLevel | null; error?: string }> {
      return checks.map(check => {
        const key = check.scope ? `${check.tool}:${check.scope}` : check.tool;
        const permission = permissionMap.get(key);
        const actual = permission?.level || null;
        const passed = actual === check.expected;

        return {
          tool: check.tool,
          scope: check.scope,
          passed,
          actual,
          expected: check.expected,
          error: passed ? undefined : `Expected ${check.expected}, got ${actual}`,
        };
      });
    },

    /**
     * Assert that all batch checks pass
     */
    assertBatch(checks: Array<{ tool: string; scope?: string; expected: PermissionLevel | null }>): void {
      const results = this.checkBatch(checks);
      const failures = results.filter(result => !result.passed);

      if (failures.length > 0) {
        const errorMessages = failures.map(failure =>
          `${failure.tool}${failure.scope ? `:${failure.scope}` : ''}: ${failure.error}`
        ).join(', ');
        throw new Error(`Batch permission assertion failed: ${errorMessages}`);
      }
    },

    /**
     * Get summary of all permissions
     */
    getSummary(): { tool: string; scope?: string; level: PermissionLevel }[] {
      return Array.from(permissionMap.values()).map(permission => ({
        tool: permission.tool,
        scope: permission.scope,
        level: permission.level,
      }));
    },
  };
}

/**
 * Helper to wait for permission events in tests
 *
 * @param eventEmitter - Event emitter to listen on
 * @param eventType - Type of permission event to wait for
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves with the event data
 *
 * @example
 * ```typescript
 * // Start an operation that should trigger a permission request
 * const operation = manager.requestPermission('Write', '/file.ts');
 *
 * // Wait for the permission request event
 * const requestEvent = await waitForPermissionEvent(orchestrator, 'permission:requested', 5000);
 * expect(requestEvent.tool).toBe('Write');
 * ```
 */
export function waitForPermissionEvent<T = any>(
  eventEmitter: { on: (event: string, listener: (data: T) => void) => void; off: (event: string, listener: (data: T) => void) => void },
  eventType: string,
  timeout = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      eventEmitter.off(eventType, listener);
      reject(new Error(`Permission event '${eventType}' not received within ${timeout}ms`));
    }, timeout);

    const listener = (data: T) => {
      clearTimeout(timeoutId);
      eventEmitter.off(eventType, listener);
      resolve(data);
    };

    eventEmitter.on(eventType, listener);
  });
}

/**
 * Mock permission confirmation dialog for testing user interactions
 *
 * @param responses - Map of permission prompts to user responses
 * @returns Mock confirmation function
 *
 * @example
 * ```typescript
 * const mockConfirm = mockPermissionConfirmation({
 *   'Allow Write access to /project/file.ts?': true,
 *   'Allow Bash command: npm install?': false
 * });
 *
 * // Use in your permission manager configuration
 * const manager = new PermissionManager(store, { confirmationHandler: mockConfirm });
 * ```
 */
export function mockPermissionConfirmation(responses: Record<string, boolean>) {
  return (prompt: string, details?: any): Promise<boolean> => {
    if (prompt in responses) {
      return Promise.resolve(responses[prompt]);
    }

    // Check for partial matches
    for (const [pattern, response] of Object.entries(responses)) {
      if (prompt.includes(pattern) || pattern.includes(prompt)) {
        return Promise.resolve(response);
      }
    }

    // Default to deny if no specific response configured
    return Promise.resolve(false);
  };
}

// ============================================================================
// Enhanced Permission Assertion Helpers (v0.5.0)
// ============================================================================

/**
 * Assert that a permission is granted (allowed) with optional permission level check
 *
 * @param result - The permission result to check
 * @param expectedLevel - Optional expected permission level
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const result = await permissionManager.checkPermission('Read', '/project/file.ts');
 * expectPermissionGranted(result, 'allow-always', 'Read access should be granted');
 * ```
 */
export function expectPermissionGranted(
  result: ToolPermissionResult,
  expectedLevel?: PermissionLevel,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (!result.allowed) {
    throw new Error(`${baseMessage}Expected permission to be granted, but was denied. Reason: ${result.denialReason || 'Unknown'}`);
  }

  if (expectedLevel && result.level !== expectedLevel) {
    throw new Error(`${baseMessage}Permission granted but with unexpected level. Expected: ${expectedLevel}, got: ${result.level}`);
  }
}

/**
 * Assert that a permission is denied with optional reason check
 *
 * @param result - The permission result to check
 * @param expectedReason - Optional expected denial reason (partial match)
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const result = await permissionManager.checkPermission('Bash', 'rm -rf /');
 * expectPermissionDenied(result, 'dangerous operation', 'Dangerous commands should be denied');
 * ```
 */
export function expectPermissionDenied(
  result: ToolPermissionResult,
  expectedReason?: string,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (result.allowed) {
    throw new Error(`${baseMessage}Expected permission to be denied, but was granted with level: ${result.level}`);
  }

  if (expectedReason && result.denialReason) {
    const actualReason = result.denialReason.toLowerCase();
    const expectedReasonLower = expectedReason.toLowerCase();
    if (!actualReason.includes(expectedReasonLower)) {
      throw new Error(`${baseMessage}Permission denied but with unexpected reason. Expected reason containing "${expectedReason}", got: "${result.denialReason}"`);
    }
  }
}

/**
 * Assert that a permission is pending (requires user confirmation)
 *
 * @param result - The permission result to check
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const result = await permissionManager.checkPermission('Write', '/project/new-file.ts');
 * expectPermissionPending(result, 'Write operations should require confirmation');
 * ```
 */
export function expectPermissionPending(
  result: ToolPermissionResult,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (!result.allowed && !result.requiresConfirmation) {
    throw new Error(`${baseMessage}Expected permission to be pending (require confirmation), but was denied outright`);
  }

  if (result.allowed && !result.requiresConfirmation) {
    throw new Error(`${baseMessage}Expected permission to be pending (require confirmation), but was granted automatically`);
  }

  if (!result.requiresConfirmation) {
    throw new Error(`${baseMessage}Expected permission to require confirmation, but requiresConfirmation is false`);
  }

  if (result.level !== 'allow-once') {
    throw new Error(`${baseMessage}Expected permission level to be 'allow-once' for pending permissions, got: ${result.level}`);
  }
}

/**
 * Interface for permission context used in assertions
 */
export interface PermissionContext {
  /** Active permissions */
  permissions: Permission[];
  /** Permission preset being used */
  preset?: PermissionPreset;
  /** Agent name this context applies to */
  agent?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Assert that a permission context has expected state and permissions
 *
 * @param context - The permission context to validate
 * @param expectedState - Expected context properties
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const context = {
 *   permissions: [
 *     createMockPermission({ tool: 'Read', level: 'allow-always' }),
 *     createMockPermission({ tool: 'Write', level: 'allow-once' })
 *   ],
 *   preset: 'review-all' as PermissionPreset,
 *   agent: 'developer'
 * };
 *
 * assertPermissionContext(context, {
 *   hasPermissions: ['Read', 'Write'],
 *   preset: 'review-all',
 *   agent: 'developer'
 * });
 * ```
 */
export function assertPermissionContext(
  context: PermissionContext,
  expectedState: {
    hasPermissions?: string[];
    lacksPermissions?: string[];
    preset?: PermissionPreset;
    agent?: string;
    permissionCount?: number;
  },
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';
  const errors: string[] = [];

  // Check if expected permissions exist
  if (expectedState.hasPermissions) {
    for (const tool of expectedState.hasPermissions) {
      const hasPermission = context.permissions.some(p => p.tool === tool);
      if (!hasPermission) {
        errors.push(`Missing expected permission for tool: ${tool}`);
      }
    }
  }

  // Check if permissions should not exist
  if (expectedState.lacksPermissions) {
    for (const tool of expectedState.lacksPermissions) {
      const hasPermission = context.permissions.some(p => p.tool === tool);
      if (hasPermission) {
        errors.push(`Unexpected permission found for tool: ${tool}`);
      }
    }
  }

  // Check preset
  if (expectedState.preset !== undefined && context.preset !== expectedState.preset) {
    errors.push(`Expected preset: ${expectedState.preset}, got: ${context.preset}`);
  }

  // Check agent
  if (expectedState.agent !== undefined && context.agent !== expectedState.agent) {
    errors.push(`Expected agent: ${expectedState.agent}, got: ${context.agent}`);
  }

  // Check permission count
  if (expectedState.permissionCount !== undefined && context.permissions.length !== expectedState.permissionCount) {
    errors.push(`Expected ${expectedState.permissionCount} permissions, got: ${context.permissions.length}`);
  }

  if (errors.length > 0) {
    throw new Error(`${baseMessage}Permission context assertion failed:\n  ${errors.join('\n  ')}`);
  }
}

/**
 * Interface for permission history entry
 */
export interface PermissionHistoryEntry {
  /** Tool name */
  tool: string;
  /** Permission scope */
  scope?: string;
  /** Permission level granted/denied */
  level?: PermissionLevel;
  /** Whether permission was granted */
  granted: boolean;
  /** Timestamp of the decision */
  timestamp: Date;
  /** Reason for the decision */
  reason?: string;
  /** Who made the decision */
  decidedBy?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for permission history
 */
export interface PermissionHistory {
  /** List of permission entries */
  entries: PermissionHistoryEntry[];
  /** Total number of entries */
  total: number;
  /** Number of granted permissions */
  granted: number;
  /** Number of denied permissions */
  denied: number;
}

/**
 * Assert that permission history matches expected criteria
 *
 * @param history - The permission history to validate
 * @param expectedCriteria - Expected history state
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const history: PermissionHistory = {
 *   entries: [
 *     {
 *       tool: 'Read',
 *       granted: true,
 *       level: 'allow-always',
 *       timestamp: new Date(),
 *       decidedBy: 'user'
 *     }
 *   ],
 *   total: 1,
 *   granted: 1,
 *   denied: 0
 * };
 *
 * assertPermissionHistory(history, {
 *   totalEntries: 1,
 *   grantedCount: 1,
 *   deniedCount: 0,
 *   hasToolEntry: 'Read'
 * });
 * ```
 */
export function assertPermissionHistory(
  history: PermissionHistory,
  expectedCriteria: {
    totalEntries?: number;
    grantedCount?: number;
    deniedCount?: number;
    hasToolEntry?: string;
    lacksToolEntry?: string;
    hasRecentEntry?: {
      tool: string;
      withinMinutes: number;
      granted?: boolean;
    };
    entriesInOrder?: string[]; // Tool names in expected chronological order
  },
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';
  const errors: string[] = [];

  // Check total entries
  if (expectedCriteria.totalEntries !== undefined && history.total !== expectedCriteria.totalEntries) {
    errors.push(`Expected ${expectedCriteria.totalEntries} total entries, got: ${history.total}`);
  }

  // Check granted count
  if (expectedCriteria.grantedCount !== undefined && history.granted !== expectedCriteria.grantedCount) {
    errors.push(`Expected ${expectedCriteria.grantedCount} granted entries, got: ${history.granted}`);
  }

  // Check denied count
  if (expectedCriteria.deniedCount !== undefined && history.denied !== expectedCriteria.deniedCount) {
    errors.push(`Expected ${expectedCriteria.deniedCount} denied entries, got: ${history.denied}`);
  }

  // Check for specific tool entry
  if (expectedCriteria.hasToolEntry) {
    const hasEntry = history.entries.some(entry => entry.tool === expectedCriteria.hasToolEntry);
    if (!hasEntry) {
      errors.push(`Expected entry for tool: ${expectedCriteria.hasToolEntry}`);
    }
  }

  // Check for absence of specific tool entry
  if (expectedCriteria.lacksToolEntry) {
    const hasEntry = history.entries.some(entry => entry.tool === expectedCriteria.lacksToolEntry);
    if (hasEntry) {
      errors.push(`Unexpected entry found for tool: ${expectedCriteria.lacksToolEntry}`);
    }
  }

  // Check for recent entry
  if (expectedCriteria.hasRecentEntry) {
    const { tool, withinMinutes, granted } = expectedCriteria.hasRecentEntry;
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);

    const recentEntry = history.entries.find(entry =>
      entry.tool === tool &&
      entry.timestamp >= cutoffTime &&
      (granted === undefined || entry.granted === granted)
    );

    if (!recentEntry) {
      const grantedText = granted !== undefined ? ` (${granted ? 'granted' : 'denied'})` : '';
      errors.push(`Expected recent entry for tool: ${tool} within ${withinMinutes} minutes${grantedText}`);
    }
  }

  // Check entries order
  if (expectedCriteria.entriesInOrder) {
    const actualOrder = history.entries
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(entry => entry.tool);

    const expectedOrder = expectedCriteria.entriesInOrder;

    if (actualOrder.length !== expectedOrder.length) {
      errors.push(`Expected ${expectedOrder.length} entries in order, got: ${actualOrder.length}`);
    } else {
      for (let i = 0; i < expectedOrder.length; i++) {
        if (actualOrder[i] !== expectedOrder[i]) {
          errors.push(`Expected entry ${i + 1} to be '${expectedOrder[i]}', got: '${actualOrder[i]}'`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`${baseMessage}Permission history assertion failed:\n  ${errors.join('\n  ')}`);
  }
}

/**
 * Create a mock permission history for testing
 *
 * @param entries - Array of permission history entries
 * @returns Complete permission history object
 *
 * @example
 * ```typescript
 * const history = createMockPermissionHistory([
 *   {
 *     tool: 'Read',
 *     granted: true,
 *     level: 'allow-always',
 *     timestamp: new Date(),
 *     decidedBy: 'user'
 *   },
 *   {
 *     tool: 'Write',
 *     granted: false,
 *     timestamp: new Date(),
 *     reason: 'User denied request',
 *     decidedBy: 'user'
 *   }
 * ]);
 * ```
 */
export function createMockPermissionHistory(entries: Partial<PermissionHistoryEntry>[]): PermissionHistory {
  const completeEntries: PermissionHistoryEntry[] = entries.map(entry => ({
    tool: entry.tool || 'Read',
    scope: entry.scope,
    level: entry.level,
    granted: entry.granted ?? true,
    timestamp: entry.timestamp || new Date(),
    reason: entry.reason,
    decidedBy: entry.decidedBy || 'test-system',
    metadata: entry.metadata,
  }));

  const granted = completeEntries.filter(entry => entry.granted).length;
  const denied = completeEntries.filter(entry => !entry.granted).length;

  return {
    entries: completeEntries,
    total: completeEntries.length,
    granted,
    denied,
  };
}

/**
 * Comprehensive permission state matcher for complex assertions
 *
 * @param result - The permission result to check
 * @param expectedState - Expected permission state with multiple criteria
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const result = await permissionManager.checkPermission('Write');
 * expectPermissionState(result, {
 *   allowed: true,
 *   level: 'allow-once',
 *   requiresConfirmation: true,
 *   hasConfig: true,
 *   configType: 'filesystem'
 * });
 * ```
 */
export function expectPermissionState(
  result: ToolPermissionResult,
  expectedState: {
    allowed?: boolean;
    level?: PermissionLevel | null;
    requiresConfirmation?: boolean;
    denialReason?: string | RegExp;
    hasConfig?: boolean;
    configType?: string;
  },
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';
  const errors: string[] = [];

  // Check allowed state
  if (expectedState.allowed !== undefined && result.allowed !== expectedState.allowed) {
    errors.push(`Expected allowed: ${expectedState.allowed}, got: ${result.allowed}`);
  }

  // Check permission level
  if (expectedState.level !== undefined && result.level !== expectedState.level) {
    errors.push(`Expected level: ${expectedState.level}, got: ${result.level}`);
  }

  // Check confirmation requirement
  if (expectedState.requiresConfirmation !== undefined && result.requiresConfirmation !== expectedState.requiresConfirmation) {
    errors.push(`Expected requiresConfirmation: ${expectedState.requiresConfirmation}, got: ${result.requiresConfirmation}`);
  }

  // Check denial reason
  if (expectedState.denialReason !== undefined && result.denialReason) {
    if (typeof expectedState.denialReason === 'string') {
      if (!result.denialReason.includes(expectedState.denialReason)) {
        errors.push(`Expected denial reason to contain: "${expectedState.denialReason}", got: "${result.denialReason}"`);
      }
    } else if (expectedState.denialReason instanceof RegExp) {
      if (!expectedState.denialReason.test(result.denialReason)) {
        errors.push(`Expected denial reason to match: ${expectedState.denialReason}, got: "${result.denialReason}"`);
      }
    }
  }

  // Check config presence
  if (expectedState.hasConfig !== undefined) {
    const hasConfig = result.config !== undefined && result.config !== null;
    if (hasConfig !== expectedState.hasConfig) {
      errors.push(`Expected hasConfig: ${expectedState.hasConfig}, got: ${hasConfig}`);
    }
  }

  // Check config type (if config exists)
  if (expectedState.configType !== undefined && result.config) {
    // This is a simplified check - in practice you might want more sophisticated type detection
    const configHasExpectedType = Object.prototype.hasOwnProperty.call(result.config, expectedState.configType) ||
      (expectedState.configType === 'filesystem' && 'directoryAccess' in result.config) ||
      (expectedState.configType === 'shell' && 'blockedCommands' in result.config) ||
      (expectedState.configType === 'web' && 'allowedDomains' in result.config);

    if (!configHasExpectedType) {
      errors.push(`Expected config type: ${expectedState.configType}, but config doesn't match`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`${baseMessage}Permission state assertion failed:\n  ${errors.join('\n  ')}`);
  }
}

/**
 * Batch permission assertions for testing multiple permissions at once
 *
 * @param results - Array of permission results to check
 * @param expectations - Array of expected states for each result
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * const results = await Promise.all([
 *   permissionManager.checkPermission('Read'),
 *   permissionManager.checkPermission('Write'),
 *   permissionManager.checkPermission('Bash')
 * ]);
 *
 * expectBatchPermissions(results, [
 *   { tool: 'Read', allowed: true, level: 'allow-always' },
 *   { tool: 'Write', allowed: true, requiresConfirmation: true },
 *   { tool: 'Bash', allowed: false, denialReason: 'dangerous' }
 * ]);
 * ```
 */
export function expectBatchPermissions(
  results: ToolPermissionResult[],
  expectations: Array<{
    tool: string;
    allowed?: boolean;
    level?: PermissionLevel | null;
    requiresConfirmation?: boolean;
    denialReason?: string;
  }>,
  message?: string
): void {
  const baseMessage = message ? `${message}: ` : '';

  if (results.length !== expectations.length) {
    throw new Error(`${baseMessage}Results count (${results.length}) doesn't match expectations count (${expectations.length})`);
  }

  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const expectation = expectations[i];

    try {
      expectPermissionState(result, expectation, `Tool ${expectation.tool}`);
    } catch (error) {
      errors.push(`${expectation.tool}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`${baseMessage}Batch permission assertion failed:\n  ${errors.join('\n  ')}`);
  }
}

// ============================================================================
// Vitest Custom Matchers for Permission Testing
// ============================================================================

import type { ExpectStatic } from 'vitest';

/**
 * Interface for custom permission matchers
 */
export interface PermissionMatchers<R = unknown> {
  /**
   * Assert that a permission result is granted
   *
   * @param expectedLevel - Optional expected permission level
   * @example
   * ```typescript
   * const result = await permissionManager.checkPermission('Read');
   * expect(result).toBePermissionGranted('allow-always');
   * ```
   */
  toBePermissionGranted(expectedLevel?: PermissionLevel): R;

  /**
   * Assert that a permission result is denied
   *
   * @param expectedReason - Optional expected denial reason (partial match)
   * @example
   * ```typescript
   * const result = await permissionManager.checkPermission('Bash');
   * expect(result).toBePermissionDenied('dangerous operation');
   * ```
   */
  toBePermissionDenied(expectedReason?: string): R;

  /**
   * Assert that a permission result is pending (requires confirmation)
   *
   * @example
   * ```typescript
   * const result = await permissionManager.checkPermission('Write');
   * expect(result).toBePermissionPending();
   * ```
   */
  toBePermissionPending(): R;

  /**
   * Assert that a permission context has expected state
   *
   * @param expectedState - Expected context properties
   * @example
   * ```typescript
   * const context = { permissions: [...], preset: 'review-all' };
   * expect(context).toHavePermissionContext({
   *   hasPermissions: ['Read', 'Write'],
   *   preset: 'review-all'
   * });
   * ```
   */
  toHavePermissionContext(expectedState: {
    hasPermissions?: string[];
    lacksPermissions?: string[];
    preset?: PermissionPreset;
    agent?: string;
    permissionCount?: number;
  }): R;

  /**
   * Assert that a permission history matches expected criteria
   *
   * @param expectedCriteria - Expected history state
   * @example
   * ```typescript
   * const history = { entries: [...], total: 5, granted: 3, denied: 2 };
   * expect(history).toHavePermissionHistory({
   *   totalEntries: 5,
   *   grantedCount: 3,
   *   hasToolEntry: 'Read'
   * });
   * ```
   */
  toHavePermissionHistory(expectedCriteria: {
    totalEntries?: number;
    grantedCount?: number;
    deniedCount?: number;
    hasToolEntry?: string;
    lacksToolEntry?: string;
    hasRecentEntry?: {
      tool: string;
      withinMinutes: number;
      granted?: boolean;
    };
    entriesInOrder?: string[];
  }): R;
}

// Add the matchers to the global expect
declare module 'vitest' {
  interface Assertion extends PermissionMatchers {}
  interface AsymmetricMatchersContaining extends PermissionMatchers {}
}

/**
 * Custom Vitest matcher: toBePermissionGranted
 */
export function toBePermissionGranted(
  this: { isNot?: boolean; utils?: any },
  received: ToolPermissionResult,
  expectedLevel?: PermissionLevel
): { message(): string; pass: boolean } {
  const { isNot = false, utils = {} } = this;
  const { printReceived = (x: any) => x, printExpected = (x: any) => x, matcherHint = (x: any) => x } = utils;

  const pass = received.allowed && (expectedLevel ? received.level === expectedLevel : true);

  const message = () => {
    const hint = matcherHint('.toBePermissionGranted', 'result', expectedLevel || '');

    if (isNot) {
      if (!received.allowed) {
        return `${hint}\n\nExpected permission NOT to be granted, but it was denied:\n  Received: ${printReceived(received)}\n  Reason: ${received.denialReason || 'Unknown'}`;
      }
      if (expectedLevel && received.level !== expectedLevel) {
        return `${hint}\n\nExpected permission NOT to be granted with level ${expectedLevel}, but it was:\n  Received level: ${printReceived(received.level)}`;
      }
      return `${hint}\n\nExpected permission NOT to be granted, but it was:\n  Received: ${printReceived(received)}`;
    }

    if (!received.allowed) {
      return `${hint}\n\nExpected permission to be granted, but it was denied:\n  Received: ${printReceived(received)}\n  Reason: ${received.denialReason || 'Unknown'}`;
    }

    if (expectedLevel && received.level !== expectedLevel) {
      return `${hint}\n\nExpected permission to be granted with level ${expectedLevel}, but got:\n  Expected level: ${printExpected(expectedLevel)}\n  Received level: ${printReceived(received.level)}`;
    }

    return `${hint}\n\nExpected permission NOT to be granted, but it was:\n  Received: ${printReceived(received)}`;
  };

  return { message, pass };
}

/**
 * Custom Vitest matcher: toBePermissionDenied
 */
export function toBePermissionDenied(
  this: { isNot?: boolean; utils?: any },
  received: ToolPermissionResult,
  expectedReason?: string
): { message(): string; pass: boolean } {
  const { isNot = false, utils = {} } = this;
  const { printReceived = (x: any) => x, printExpected = (x: any) => x, matcherHint = (x: any) => x } = utils;

  const reasonMatches = !expectedReason ||
    (received.denialReason && received.denialReason.toLowerCase().includes(expectedReason.toLowerCase()));

  const pass = !received.allowed && reasonMatches;

  const message = () => {
    const hint = matcherHint('.toBePermissionDenied', 'result', expectedReason || '');

    if (isNot) {
      if (received.allowed) {
        return `${hint}\n\nExpected permission NOT to be denied, but it was granted:\n  Received: ${printReceived(received)}\n  Level: ${received.level}`;
      }
      if (expectedReason && !reasonMatches) {
        return `${hint}\n\nExpected permission NOT to be denied with reason containing "${expectedReason}", but it was:\n  Received reason: ${printReceived(received.denialReason || 'No reason given')}`;
      }
      return `${hint}\n\nExpected permission NOT to be denied, but it was:\n  Received: ${printReceived(received)}`;
    }

    if (received.allowed) {
      return `${hint}\n\nExpected permission to be denied, but it was granted:\n  Received: ${printReceived(received)}\n  Level: ${received.level}`;
    }

    if (expectedReason && !reasonMatches) {
      return `${hint}\n\nExpected permission to be denied with reason containing "${expectedReason}", but got:\n  Expected reason containing: ${printExpected(expectedReason)}\n  Received reason: ${printReceived(received.denialReason || 'No reason given')}`;
    }

    return `${hint}\n\nExpected permission to be denied, but it was granted:\n  Received: ${printReceived(received)}`;
  };

  return { message, pass };
}

/**
 * Custom Vitest matcher: toBePermissionPending
 */
export function toBePermissionPending(
  this: { isNot?: boolean; utils?: any },
  received: ToolPermissionResult
): { message(): string; pass: boolean } {
  const { isNot = false, utils = {} } = this;
  const { printReceived = (x: any) => x, matcherHint = (x: any) => x } = utils;

  const pass = received.requiresConfirmation && received.level === 'allow-once';

  const message = () => {
    const hint = matcherHint('.toBePermissionPending', 'result');

    if (isNot) {
      return `${hint}\n\nExpected permission NOT to be pending, but it was:\n  Received: ${printReceived(received)}`;
    }

    if (!received.allowed && !received.requiresConfirmation) {
      return `${hint}\n\nExpected permission to be pending (require confirmation), but it was denied outright:\n  Received: ${printReceived(received)}\n  Reason: ${received.denialReason || 'Unknown'}`;
    }

    if (received.allowed && !received.requiresConfirmation) {
      return `${hint}\n\nExpected permission to be pending (require confirmation), but it was granted automatically:\n  Received: ${printReceived(received)}\n  Level: ${received.level}`;
    }

    if (!received.requiresConfirmation) {
      return `${hint}\n\nExpected permission to require confirmation, but requiresConfirmation is false:\n  Received: ${printReceived(received)}`;
    }

    if (received.level !== 'allow-once') {
      return `${hint}\n\nExpected permission level to be 'allow-once' for pending permissions, but got:\n  Received level: ${printReceived(received.level)}`;
    }

    return `${hint}\n\nExpected permission NOT to be pending, but it was:\n  Received: ${printReceived(received)}`;
  };

  return { message, pass };
}

/**
 * Custom Vitest matcher: toHavePermissionContext
 */
export function toHavePermissionContext(
  this: { isNot?: boolean; utils?: any },
  received: PermissionContext,
  expectedState: {
    hasPermissions?: string[];
    lacksPermissions?: string[];
    preset?: PermissionPreset;
    agent?: string;
    permissionCount?: number;
  }
): { message(): string; pass: boolean } {
  const { isNot = false, utils = {} } = this;
  const { printReceived = (x: any) => x, printExpected = (x: any) => x, matcherHint = (x: any) => x } = utils;

  const errors: string[] = [];

  // Check if expected permissions exist
  if (expectedState.hasPermissions) {
    for (const tool of expectedState.hasPermissions) {
      const hasPermission = received.permissions.some(p => p.tool === tool);
      if (!hasPermission) {
        errors.push(`Missing expected permission for tool: ${tool}`);
      }
    }
  }

  // Check if permissions should not exist
  if (expectedState.lacksPermissions) {
    for (const tool of expectedState.lacksPermissions) {
      const hasPermission = received.permissions.some(p => p.tool === tool);
      if (hasPermission) {
        errors.push(`Unexpected permission found for tool: ${tool}`);
      }
    }
  }

  // Check preset
  if (expectedState.preset !== undefined && received.preset !== expectedState.preset) {
    errors.push(`Expected preset: ${expectedState.preset}, got: ${received.preset}`);
  }

  // Check agent
  if (expectedState.agent !== undefined && received.agent !== expectedState.agent) {
    errors.push(`Expected agent: ${expectedState.agent}, got: ${received.agent}`);
  }

  // Check permission count
  if (expectedState.permissionCount !== undefined && received.permissions.length !== expectedState.permissionCount) {
    errors.push(`Expected ${expectedState.permissionCount} permissions, got: ${received.permissions.length}`);
  }

  const pass = errors.length === 0;

  const message = () => {
    const hint = matcherHint('.toHavePermissionContext', 'context', 'expectedState');

    if (isNot) {
      if (pass) {
        return `${hint}\n\nExpected permission context NOT to match expected state, but it did:\n  Received: ${printReceived(received)}\n  Expected: ${printExpected(expectedState)}`;
      }
      return `${hint}\n\nExpected permission context NOT to match expected state, and it didn't:\n  Received: ${printReceived(received)}\n  Validation errors: ${errors.join(', ')}`;
    }

    if (pass) {
      return `${hint}\n\nExpected permission context NOT to match expected state, but it did:\n  Received: ${printReceived(received)}`;
    }

    return `${hint}\n\nExpected permission context to match expected state:\n  Received: ${printReceived(received)}\n  Expected: ${printExpected(expectedState)}\n  Validation errors:\n    ${errors.join('\n    ')}`;
  };

  return { message, pass };
}

/**
 * Custom Vitest matcher: toHavePermissionHistory
 */
export function toHavePermissionHistory(
  this: { isNot?: boolean; utils?: any },
  received: PermissionHistory,
  expectedCriteria: {
    totalEntries?: number;
    grantedCount?: number;
    deniedCount?: number;
    hasToolEntry?: string;
    lacksToolEntry?: string;
    hasRecentEntry?: {
      tool: string;
      withinMinutes: number;
      granted?: boolean;
    };
    entriesInOrder?: string[];
  }
): { message(): string; pass: boolean } {
  const { isNot = false, utils = {} } = this;
  const { printReceived = (x: any) => x, printExpected = (x: any) => x, matcherHint = (x: any) => x } = utils;

  const errors: string[] = [];

  // Check total entries
  if (expectedCriteria.totalEntries !== undefined && received.total !== expectedCriteria.totalEntries) {
    errors.push(`Expected ${expectedCriteria.totalEntries} total entries, got: ${received.total}`);
  }

  // Check granted count
  if (expectedCriteria.grantedCount !== undefined && received.granted !== expectedCriteria.grantedCount) {
    errors.push(`Expected ${expectedCriteria.grantedCount} granted entries, got: ${received.granted}`);
  }

  // Check denied count
  if (expectedCriteria.deniedCount !== undefined && received.denied !== expectedCriteria.deniedCount) {
    errors.push(`Expected ${expectedCriteria.deniedCount} denied entries, got: ${received.denied}`);
  }

  // Check for specific tool entry
  if (expectedCriteria.hasToolEntry) {
    const hasEntry = received.entries.some(entry => entry.tool === expectedCriteria.hasToolEntry);
    if (!hasEntry) {
      errors.push(`Expected entry for tool: ${expectedCriteria.hasToolEntry}`);
    }
  }

  // Check for absence of specific tool entry
  if (expectedCriteria.lacksToolEntry) {
    const hasEntry = received.entries.some(entry => entry.tool === expectedCriteria.lacksToolEntry);
    if (hasEntry) {
      errors.push(`Unexpected entry found for tool: ${expectedCriteria.lacksToolEntry}`);
    }
  }

  // Check for recent entry
  if (expectedCriteria.hasRecentEntry) {
    const { tool, withinMinutes, granted } = expectedCriteria.hasRecentEntry;
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);

    const recentEntry = received.entries.find(entry =>
      entry.tool === tool &&
      entry.timestamp >= cutoffTime &&
      (granted === undefined || entry.granted === granted)
    );

    if (!recentEntry) {
      const grantedText = granted !== undefined ? ` (${granted ? 'granted' : 'denied'})` : '';
      errors.push(`Expected recent entry for tool: ${tool} within ${withinMinutes} minutes${grantedText}`);
    }
  }

  // Check entries order
  if (expectedCriteria.entriesInOrder) {
    const actualOrder = received.entries
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(entry => entry.tool);

    const expectedOrder = expectedCriteria.entriesInOrder;

    if (actualOrder.length !== expectedOrder.length) {
      errors.push(`Expected ${expectedOrder.length} entries in order, got: ${actualOrder.length}`);
    } else {
      for (let i = 0; i < expectedOrder.length; i++) {
        if (actualOrder[i] !== expectedOrder[i]) {
          errors.push(`Expected entry ${i + 1} to be '${expectedOrder[i]}', got: '${actualOrder[i]}'`);
        }
      }
    }
  }

  const pass = errors.length === 0;

  const message = () => {
    const hint = matcherHint('.toHavePermissionHistory', 'history', 'expectedCriteria');

    if (isNot) {
      if (pass) {
        return `${hint}\n\nExpected permission history NOT to match expected criteria, but it did:\n  Received: ${printReceived(received)}\n  Expected: ${printExpected(expectedCriteria)}`;
      }
      return `${hint}\n\nExpected permission history NOT to match expected criteria, and it didn't:\n  Received: ${printReceived(received)}\n  Validation errors: ${errors.join(', ')}`;
    }

    if (pass) {
      return `${hint}\n\nExpected permission history NOT to match expected criteria, but it did:\n  Received: ${printReceived(received)}`;
    }

    return `${hint}\n\nExpected permission history to match expected criteria:\n  Received: ${printReceived(received)}\n  Expected: ${printExpected(expectedCriteria)}\n  Validation errors:\n    ${errors.join('\n    ')}`;
  };

  return { message, pass };
}

/**
 * Setup function to extend Vitest's expect with custom permission matchers
 * Call this in your test setup file or at the beginning of test files
 *
 * @example
 * ```typescript
 * import { expect } from 'vitest';
 * import { setupPermissionMatchers } from '@apexcli/core/test-utils';
 *
 * setupPermissionMatchers(expect);
 * ```
 */
export function setupPermissionMatchers(expectInstance: ExpectStatic): void {
  expectInstance.extend({
    toBePermissionGranted,
    toBePermissionDenied,
    toBePermissionPending,
    toHavePermissionContext,
    toHavePermissionHistory,
  });
}
// Export sensitive patterns utilities
export * from './test-utils/sensitive-patterns';

// Export mock tool types and interfaces for Claude Agent SDK testing
export * from './test-utils/mock-tool-types';
