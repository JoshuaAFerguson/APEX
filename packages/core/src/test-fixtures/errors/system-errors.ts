/**
 * @fileoverview System Error Fixtures
 *
 * Node.js system errors, file system errors, and other low-level error scenarios
 * for testing error handling and resilience.
 */

import type { ErrorSimulationOptions } from '../types.js';

/**
 * Node.js system error codes
 * @see https://nodejs.org/api/errors.html#common-system-errors
 */
export const SystemErrorCodes = {
  EACCES: 'EACCES',
  EADDRINUSE: 'EADDRINUSE',
  ECONNREFUSED: 'ECONNREFUSED',
  ECONNRESET: 'ECONNRESET',
  EEXIST: 'EEXIST',
  EISDIR: 'EISDIR',
  EMFILE: 'EMFILE',
  ENOENT: 'ENOENT',
  ENOSPC: 'ENOSPC',
  ENOTDIR: 'ENOTDIR',
  ENOTEMPTY: 'ENOTEMPTY',
  EPERM: 'EPERM',
  EPIPE: 'EPIPE',
  EROFS: 'EROFS',
  ETIMEDOUT: 'ETIMEDOUT',
} as const;

/**
 * Creates a Node.js system error with proper structure
 */
export const createSystemError = (
  code: string,
  message: string,
  path?: string,
  syscall?: string,
  errno?: number
): NodeJS.ErrnoException => {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  error.errno = errno || -2; // Default errno
  if (path) error.path = path;
  if (syscall) error.syscall = syscall;
  return error;
};

/**
 * File system error scenarios
 */
export const FileSystemErrors = {
  /** File or directory not found */
  fileNotFound: createSystemError(
    SystemErrorCodes.ENOENT,
    "ENOENT: no such file or directory, open '/nonexistent/file.txt'",
    '/nonexistent/file.txt',
    'open',
    -2
  ),

  /** Permission denied */
  permissionDenied: createSystemError(
    SystemErrorCodes.EACCES,
    "EACCES: permission denied, access '/restricted/file.txt'",
    '/restricted/file.txt',
    'access',
    -13
  ),

  /** Is a directory (when file expected) */
  isDirectory: createSystemError(
    SystemErrorCodes.EISDIR,
    "EISDIR: illegal operation on a directory, read '/some/directory'",
    '/some/directory',
    'read',
    -21
  ),

  /** Not a directory (when directory expected) */
  notDirectory: createSystemError(
    SystemErrorCodes.ENOTDIR,
    "ENOTDIR: not a directory, scandir '/some/file.txt'",
    '/some/file.txt',
    'scandir',
    -20
  ),

  /** File already exists */
  fileExists: createSystemError(
    SystemErrorCodes.EEXIST,
    "EEXIST: file already exists, mkdir '/existing/directory'",
    '/existing/directory',
    'mkdir',
    -17
  ),

  /** Directory not empty */
  directoryNotEmpty: createSystemError(
    SystemErrorCodes.ENOTEMPTY,
    "ENOTEMPTY: directory not empty, rmdir '/non-empty-dir'",
    '/non-empty-dir',
    'rmdir',
    -39
  ),

  /** No space left on device */
  noSpace: createSystemError(
    SystemErrorCodes.ENOSPC,
    "ENOSPC: no space left on device, write",
    undefined,
    'write',
    -28
  ),

  /** Read-only file system */
  readOnlyFileSystem: createSystemError(
    SystemErrorCodes.EROFS,
    "EROFS: read-only file system, mkdir '/readonly/newdir'",
    '/readonly/newdir',
    'mkdir',
    -30
  ),

  /** Too many open files */
  tooManyFiles: createSystemError(
    SystemErrorCodes.EMFILE,
    "EMFILE: too many open files, open '/some/file.txt'",
    '/some/file.txt',
    'open',
    -24
  ),

  /** Operation not permitted */
  operationNotPermitted: createSystemError(
    SystemErrorCodes.EPERM,
    "EPERM: operation not permitted, unlink '/system/file'",
    '/system/file',
    'unlink',
    -1
  ),
} as const;

/**
 * Network error scenarios
 */
export const NetworkErrors = {
  /** Connection refused */
  connectionRefused: createSystemError(
    SystemErrorCodes.ECONNREFUSED,
    'ECONNREFUSED: Connection refused',
    undefined,
    'connect',
    -61
  ),

  /** Connection reset */
  connectionReset: createSystemError(
    SystemErrorCodes.ECONNRESET,
    'ECONNRESET: Connection reset by peer',
    undefined,
    'read',
    -54
  ),

  /** Connection timeout */
  connectionTimeout: createSystemError(
    SystemErrorCodes.ETIMEDOUT,
    'ETIMEDOUT: Operation timed out',
    undefined,
    'connect',
    -60
  ),

  /** Address already in use */
  addressInUse: createSystemError(
    SystemErrorCodes.EADDRINUSE,
    'EADDRINUSE: Address already in use',
    undefined,
    'listen',
    -48
  ),

  /** Broken pipe */
  brokenPipe: createSystemError(
    SystemErrorCodes.EPIPE,
    'EPIPE: Broken pipe',
    undefined,
    'write',
    -32
  ),
} as const;

/**
 * Custom system error scenarios for testing
 */
export const CustomSystemErrors = {
  /** Git-related errors */
  gitNotFound: new Error('git: command not found'),
  gitNotRepository: new Error('fatal: not a git repository (or any of the parent directories): .git'),
  gitDetachedHead: new Error('fatal: You are in \'detached HEAD\' state'),
  gitMergeConflict: new Error('error: Merge conflict in src/app.js'),

  /** Database-related errors */
  databaseLocked: new Error('database is locked'),
  databaseBusy: new Error('SQLITE_BUSY: database is locked'),
  databaseCorrupt: new Error('SQLITE_CORRUPT: database disk image is malformed'),

  /** Process-related errors */
  processKilled: createSystemError('SIGTERM', 'Process terminated', undefined, 'kill'),
  processOutOfMemory: new Error('FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory'),

  /** Docker/Container errors */
  dockerNotRunning: new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?'),
  containerNotFound: new Error('Error: No such container: apex-mcp-server'),

  /** NPM/Package manager errors */
  packageNotFound: new Error('npm ERR! 404 Not Found - GET https://registry.npmjs.org/nonexistent-package'),
  packageInstallFailed: new Error('npm ERR! peer dep missing: react@>=16.8.0, required by @example/component@1.0.0'),

  /** Environment errors */
  nodeVersionMismatch: new Error('error Unsupported Node.js version. Expected >= 18.0.0, got 16.14.0'),
  missingEnvironmentVariable: new Error('Error: Required environment variable ANTHROPIC_API_KEY is not set'),
} as const;

/**
 * Timeout error scenarios
 */
export const TimeoutErrors = {
  /** File operation timeout */
  fileOperationTimeout: new Error('File operation timed out after 30 seconds'),

  /** Network request timeout */
  networkTimeout: new Error('Network request timed out after 60 seconds'),

  /** Tool execution timeout */
  toolExecutionTimeout: new Error('Tool execution timed out after 120 seconds'),

  /** Database query timeout */
  databaseQueryTimeout: new Error('Database query timed out after 10 seconds'),

  /** Agent response timeout */
  agentResponseTimeout: new Error('Agent response timed out after 300 seconds'),
} as const;

/**
 * Utility functions for creating custom system errors
 */

/**
 * Creates a timeout error with custom duration and operation
 */
export const createTimeoutError = (operation: string, timeoutMs: number): Error =>
  new Error(`${operation} timed out after ${timeoutMs}ms`);

/**
 * Creates a permission error for specific path and operation
 */
export const createPermissionError = (path: string, operation: string): NodeJS.ErrnoException =>
  createSystemError(
    SystemErrorCodes.EACCES,
    `EACCES: permission denied, ${operation} '${path}'`,
    path,
    operation,
    -13
  );

/**
 * Creates a file not found error for specific path
 */
export const createFileNotFoundError = (path: string, operation: string = 'open'): NodeJS.ErrnoException =>
  createSystemError(
    SystemErrorCodes.ENOENT,
    `ENOENT: no such file or directory, ${operation} '${path}'`,
    path,
    operation,
    -2
  );

/**
 * Creates a network error with custom message
 */
export const createNetworkError = (message: string, code: string = 'ECONNREFUSED'): NodeJS.ErrnoException =>
  createSystemError(code, message, undefined, 'connect');

/**
 * System error preset collections
 */
export const SystemErrorPresets = {
  /** File system errors */
  filesystem: {
    notFound: () => FileSystemErrors.fileNotFound,
    permissionDenied: () => FileSystemErrors.permissionDenied,
    isDirectory: () => FileSystemErrors.isDirectory,
    notDirectory: () => FileSystemErrors.notDirectory,
    exists: () => FileSystemErrors.fileExists,
    noSpace: () => FileSystemErrors.noSpace,
    readOnly: () => FileSystemErrors.readOnlyFileSystem,
    tooManyFiles: () => FileSystemErrors.tooManyFiles,
  },

  /** Network errors */
  network: {
    refused: () => NetworkErrors.connectionRefused,
    reset: () => NetworkErrors.connectionReset,
    timeout: () => NetworkErrors.connectionTimeout,
    addressInUse: () => NetworkErrors.addressInUse,
    brokenPipe: () => NetworkErrors.brokenPipe,
  },

  /** Application-specific errors */
  application: {
    gitNotFound: () => CustomSystemErrors.gitNotFound,
    gitNotRepository: () => CustomSystemErrors.gitNotRepository,
    databaseLocked: () => CustomSystemErrors.databaseLocked,
    dockerNotRunning: () => CustomSystemErrors.dockerNotRunning,
    packageNotFound: () => CustomSystemErrors.packageNotFound,
    nodeVersionMismatch: () => CustomSystemErrors.nodeVersionMismatch,
    missingEnvVar: () => CustomSystemErrors.missingEnvironmentVariable,
  },

  /** Timeout errors */
  timeout: {
    fileOperation: () => TimeoutErrors.fileOperationTimeout,
    network: () => TimeoutErrors.networkTimeout,
    toolExecution: () => TimeoutErrors.toolExecutionTimeout,
    database: () => TimeoutErrors.databaseQueryTimeout,
    agent: () => TimeoutErrors.agentResponseTimeout,
  },
} as const;

/**
 * Error scenarios for testing different failure modes
 */
export const SystemErrorScenarios = {
  /** Resource exhaustion */
  resourceExhaustion: () => [
    FileSystemErrors.noSpace,
    FileSystemErrors.tooManyFiles,
    CustomSystemErrors.processOutOfMemory,
  ],

  /** Permission issues */
  permissionIssues: () => [
    FileSystemErrors.permissionDenied,
    FileSystemErrors.operationNotPermitted,
    FileSystemErrors.readOnlyFileSystem,
  ],

  /** Network connectivity problems */
  networkConnectivity: () => [
    NetworkErrors.connectionRefused,
    NetworkErrors.connectionReset,
    NetworkErrors.connectionTimeout,
  ],

  /** Environment setup issues */
  environmentSetup: () => [
    CustomSystemErrors.gitNotFound,
    CustomSystemErrors.nodeVersionMismatch,
    CustomSystemErrors.missingEnvironmentVariable,
    CustomSystemErrors.dockerNotRunning,
  ],

  /** Development tool issues */
  developmentTools: () => [
    CustomSystemErrors.gitNotRepository,
    CustomSystemErrors.packageInstallFailed,
    CustomSystemErrors.databaseLocked,
  ],
} as const;