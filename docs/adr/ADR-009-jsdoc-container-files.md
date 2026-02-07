# ADR-009: JSDoc Documentation Standards for Container Files

## Status
Accepted

## Context
The container management subsystem in `@apex/core` consists of three main files:
- `container-manager.ts` (2185 lines) - Core container lifecycle management
- `container-runtime.ts` (417 lines) - Runtime detection and validation
- `container-health-monitor.ts` (747 lines) - Health monitoring system

These files contain critical functionality for APEX's containerization capabilities. Complete JSDoc documentation is required for:
1. API discoverability via IDE intellisense
2. Generated API documentation
3. Developer onboarding and maintenance
4. Type safety documentation

## Decision

### JSDoc Standard Format

All exported classes, interfaces, and functions MUST have complete JSDoc with:

1. **@param** - For each parameter with type and description
2. **@returns** - Return type and description of what is returned
3. **@throws** - Any exceptions that may be thrown with conditions
4. **@example** - At least one practical usage example

### Files Requiring Updates

#### container-manager.ts

**Public Methods Requiring Full JSDoc:**

| Method | Missing Tags |
|--------|--------------|
| `inspect()` | @example, @throws |
| `getStats()` | @example, @throws |
| `getContainerInfo()` | @example, @throws |
| `listApexContainers()` | @example, @throws |
| `streamLogs()` | @example, @throws |
| `execCommand()` | @example, @throws |
| `generateContainerName()` | @example |
| `startEventsMonitoring()` | @example |
| `stopEventsMonitoring()` | @example |
| `isEventsMonitoringActive()` | @example |
| `getMonitoringOptions()` | @example |

**ContainerLogStream Class Methods:**
| Method | Missing Tags |
|--------|--------------|
| `constructor()` | @param, @example |
| `end()` | @returns, @example |
| `isActive` (getter) | @returns, @example |
| `[Symbol.asyncIterator]()` | @returns, @yields, @example |

**Private Methods (for maintainability):**
- `emitContainerEvent()` - enhance existing
- `startDockerEventsProcess()` - enhance existing
- `buildEventsCommand()` - enhance existing
- `processEventsData()` - enhance existing
- `parseDockerEvent()` - enhance existing
- `handleDockerEvent()` - enhance existing
- `handleContainerDiedEvent()` - enhance existing
- `buildExecCommand()` - enhance existing
- `parseCommandString()` - enhance existing
- `buildCreateCommand()` - enhance existing
- `buildResourceLimitsArgs()` - enhance existing
- `parseContainerStatus()` - enhance existing
- `parseDate()` - enhance existing
- `parsePercentage()` - enhance existing
- `parseMemoryValue()` - enhance existing
- `parseNetworkIO()` - enhance existing
- `parseBlockIO()` - enhance existing
- `parsePids()` - enhance existing
- `parseByteValue()` - enhance existing
- `escapeShellArg()` - enhance existing

#### container-runtime.ts

**Class and Public Methods Requiring Full JSDoc:**

| Element | Missing Tags |
|---------|--------------|
| `ContainerRuntime` (class) | Class description, @example |
| `detectRuntimes()` | @returns (detailed), @throws, @example |
| `getBestRuntime()` | @example |
| `getRuntimeInfo()` | @example |
| `isRuntimeAvailable()` | @example |
| `validateCompatibility()` | @throws, @example |
| `clearCache()` | @example |

**Exported Functions:**
| Function | Missing Tags |
|----------|--------------|
| `detectContainerRuntime()` | @example |
| `isContainerRuntimeAvailable()` | @example |
| `getContainerRuntimeInfo()` | @example |

**Private Methods (for maintainability):**
- `detectRuntime()` - enhance existing
- `parseVersionOutput()` - enhance existing
- `compareVersions()` - enhance existing

#### container-health-monitor.ts

**Status**: Mostly complete - this file has good JSDoc coverage

**Minor Enhancements Needed:**

| Element | Missing Tags |
|---------|--------------|
| `ContainerHealthMonitor` (constructor) | @param, @example |

**Private Methods (for maintainability):**
- `setupContainerLifecycleHandlers()` - add JSDoc
- `performHealthChecks()` - add JSDoc
- `getContainersToMonitor()` - add JSDoc
- `shouldMonitorContainer()` - add JSDoc
- `performContainerHealthCheck()` - add JSDoc
- `evaluateContainerHealth()` - add JSDoc
- `updateContainerHealth()` - add JSDoc
- `emitHealthEvent()` - add JSDoc
- `extractTaskIdFromContainerName()` - add JSDoc

### JSDoc Template Examples

#### Method with Full Documentation
```typescript
/**
 * Execute a command inside a running container
 *
 * Runs the specified command within the container's filesystem and process
 * namespace. The command can be specified as a string or array of arguments.
 *
 * @param containerId - Container ID or name to execute command in
 * @param command - Command string or array of command parts to execute
 * @param options - Execution options (working directory, user, timeout, etc.)
 * @param runtimeType - Optional runtime type (auto-detected if not provided)
 * @returns Promise resolving to execution result with stdout, stderr, exit code
 * @throws {Error} When container is not running or command execution fails
 *
 * @example
 * ```typescript
 * // Execute a simple command
 * const result = await containerManager.execCommand(
 *   'my-container',
 *   'ls -la /app'
 * );
 * console.log(result.stdout);
 *
 * // Execute with options
 * const result = await containerManager.execCommand(
 *   'my-container',
 *   ['npm', 'run', 'build'],
 *   {
 *     workingDir: '/app',
 *     user: 'node',
 *     timeout: 60000,
 *     environment: { NODE_ENV: 'production' }
 *   }
 * );
 * ```
 */
```

#### Class with Full Documentation
```typescript
/**
 * Container runtime detection and management utility
 *
 * Detects available container runtimes (Docker/Podman) on the system and
 * provides methods for selecting the best available runtime, validating
 * compatibility, and retrieving version information.
 *
 * Features:
 * - Automatic detection of Docker and Podman
 * - Caching of detection results (5-minute expiry)
 * - Version compatibility validation
 * - Runtime prioritization (Docker > Podman)
 *
 * @example
 * ```typescript
 * const runtime = new ContainerRuntime();
 *
 * // Detect all available runtimes
 * const runtimes = await runtime.detectRuntimes();
 * console.log('Available runtimes:', runtimes.filter(r => r.available));
 *
 * // Get the best runtime to use
 * const bestRuntime = await runtime.getBestRuntime();
 * if (bestRuntime !== 'none') {
 *   console.log('Using runtime:', bestRuntime);
 * }
 * ```
 */
```

### Implementation Guidelines

1. **Consistency**: Use the same format across all three files
2. **Brevity**: Keep descriptions concise but informative
3. **Examples**: Provide realistic, copy-pasteable examples
4. **Error Conditions**: Document all @throws conditions
5. **Types**: Leverage TypeScript types - don't duplicate type info in descriptions
6. **Private Methods**: Document purpose and internal contract for maintainability

### Verification

After implementation:
1. Run `npm run build` - must pass without errors
2. Run `npm run typecheck` - TypeScript must validate
3. Run `npm run test` - all tests must pass
4. IDE intellisense should show complete documentation

## Consequences

### Positive
- Improved developer experience with complete intellisense
- Better API documentation generation
- Easier onboarding for new contributors
- Self-documenting codebase

### Negative
- Additional maintenance overhead for documentation
- Larger file sizes (minimal impact)

### Neutral
- Documentation updates required when APIs change
