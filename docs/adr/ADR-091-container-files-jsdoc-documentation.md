# ADR-091: Container Files JSDoc Documentation Enhancement

## Status
Proposed

## Context
The container management files in `packages/core/src/` provide critical container orchestration functionality for APEX. While these files have basic JSDoc comments on interfaces and most methods, they lack comprehensive documentation with `@throws`, `@example` tags, and detailed descriptions needed for developer experience and maintainability.

### Files in Scope
1. **container-manager.ts** (~2073 lines) - Container lifecycle management
2. **container-runtime.ts** (~417 lines) - Runtime detection and validation
3. **container-health-monitor.ts** (~581 lines) - Health monitoring system

## Decision

### Documentation Standard
All exported classes, interfaces, functions, and public methods must have complete JSDoc with:
- **`@description`** - Clear explanation of purpose and behavior
- **`@param`** - All parameters with types and descriptions
- **`@returns`** - Return type and meaning
- **`@throws`** - Documented exceptions/error conditions
- **`@example`** - At least one usage example for public APIs

### Current State Analysis

#### container-manager.ts
| Component | Current | Enhancement Needed |
|-----------|---------|-------------------|
| Interfaces (10) | JSDoc with property descriptions | Add interface-level examples |
| `ContainerManager` class | Basic class doc | Add comprehensive examples |
| `createContainer()` | Basic @param/@returns | Add @throws, @example |
| `startContainer()` | Basic @param/@returns | Add @throws, @example |
| `stopContainer()` | Basic @param/@returns | Add @throws, @example |
| `removeContainer()` | Basic @param/@returns | Add @throws, @example |
| `inspect()` | Basic @param/@returns | Add @throws, @example |
| `getStats()` | Basic @param/@returns | Add @throws, @example |
| `getContainerInfo()` | Basic @param/@returns | Add @throws, @example |
| `listApexContainers()` | Basic @param/@returns | Add @throws, @example |
| `streamLogs()` | Basic @param/@returns | Add @throws, @example |
| `execCommand()` | Basic @param/@returns | Add @throws, @example |
| `generateContainerName()` | Basic @param/@returns | Add @example |
| `startEventsMonitoring()` | Basic @param/@returns | Add @throws, @example |
| `stopEventsMonitoring()` | Basic @param/@returns | Add @example |
| `isEventsMonitoringActive()` | Basic @returns | Add @example |
| `getMonitoringOptions()` | Basic @returns | Add @example |
| `ContainerLogStream` class | Basic class doc | Add comprehensive examples |
| Convenience functions (2) | Basic JSDoc | Add @example |

#### container-runtime.ts
| Component | Current | Enhancement Needed |
|-----------|---------|-------------------|
| Interfaces (5) | JSDoc with property descriptions | Add interface-level examples |
| `ContainerRuntime` class | Basic class doc | Add comprehensive examples |
| `detectRuntimes()` | Basic description | Add @throws, @example |
| `getBestRuntime()` | Basic @param/@returns | Add @throws, @example |
| `getRuntimeInfo()` | Basic @param/@returns | Add @example |
| `isRuntimeAvailable()` | Basic @param/@returns | Add @example |
| `validateCompatibility()` | Basic @param/@returns | Add @throws, @example |
| `clearCache()` | No JSDoc | Add complete JSDoc |
| Convenience functions (3) | Basic JSDoc | Add @example |

#### container-health-monitor.ts
| Component | Current | Enhancement Needed |
|-----------|---------|-------------------|
| Interfaces (3) | JSDoc with property descriptions | Add interface-level examples |
| `ContainerHealthMonitor` class | Basic class doc | Add comprehensive examples |
| `startMonitoring()` | Basic description | Add @throws, @example |
| `stopMonitoring()` | Basic description | Add @example |
| `getHealthStatus()` | Basic description | Add @example |
| `getContainerHealth()` | Basic description | Add @example |
| `checkContainerHealth()` | Basic description | Add @throws, @example |
| `addContainer()` | Basic description | Add @throws, @example |
| `removeContainer()` | Basic description | Add @example |
| `updateOptions()` | Basic description | Add @example |
| `isActive()` | Basic description | Add @example |
| `getStats()` | No description | Add complete JSDoc |
| Convenience functions (2) | Basic JSDoc | Add @example |

### JSDoc Format Standards

#### Class Documentation
```typescript
/**
 * Container manager for creating and managing containerized workspaces.
 *
 * Provides high-level container operations with support for Docker and Podman.
 * Extends EventEmitter3 to emit typed lifecycle events for monitoring container
 * state changes.
 *
 * @example
 * ```typescript
 * // Create a container manager with default settings
 * const manager = new ContainerManager();
 *
 * // Create and start a container
 * const result = await manager.createContainer({
 *   config: {
 *     image: 'node:18',
 *     volumes: { '/host/path': '/container/path' },
 *   },
 *   taskId: 'task-123',
 *   autoStart: true,
 * });
 *
 * if (result.success) {
 *   console.log(`Container created: ${result.containerId}`);
 * }
 *
 * // Listen for container events
 * manager.on('container:created', (event) => {
 *   console.log(`Container ${event.containerId} created`);
 * });
 * ```
 *
 * @see ContainerRuntime - For runtime detection
 * @see ContainerHealthMonitor - For health monitoring
 */
```

#### Method Documentation
```typescript
/**
 * Create a new container with the specified configuration.
 *
 * Creates a container using the detected runtime (Docker or Podman).
 * If a Dockerfile is specified in the config, the image will be built
 * before container creation. Optionally starts the container immediately.
 *
 * @param options - Container creation options
 * @param options.config - Container configuration (image, volumes, etc.)
 * @param options.taskId - Task ID for naming and tracking
 * @param options.autoStart - Whether to start immediately (default: false)
 * @param options.nameOverride - Optional custom container name
 * @returns Promise resolving to operation result with containerId if successful
 *
 * @throws {Error} When no container runtime is available
 * @throws {Error} When container creation command fails
 * @throws {Error} When autoStart is true and container fails to start
 *
 * @example
 * ```typescript
 * const result = await manager.createContainer({
 *   config: {
 *     image: 'node:18-alpine',
 *     volumes: {
 *       '/home/user/project': '/workspace',
 *     },
 *     environment: {
 *       NODE_ENV: 'development',
 *     },
 *     workingDir: '/workspace',
 *   },
 *   taskId: 'build-task-001',
 *   autoStart: true,
 * });
 *
 * if (result.success) {
 *   console.log(`Created container: ${result.containerId}`);
 *   console.log(`Status: ${result.containerInfo?.status}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */
```

#### Interface Documentation
```typescript
/**
 * Options for container creation operations.
 *
 * @example
 * ```typescript
 * const options: CreateContainerOptions = {
 *   config: {
 *     image: 'node:18',
 *     volumes: { './src': '/app/src' },
 *   },
 *   taskId: 'my-task',
 *   autoStart: true,
 * };
 * ```
 */
export interface CreateContainerOptions {
  /** Container configuration including image, volumes, and resource limits */
  config: ContainerConfig;
  /** Associated task ID for naming and tracking */
  taskId: string;
  // ...
}
```

### Implementation Approach

1. **Preserve Existing Documentation**: Keep all current JSDoc content
2. **Enhance Descriptions**: Add more detail to existing descriptions
3. **Add @throws Tags**: Document all error conditions
4. **Add @example Tags**: Provide realistic usage examples
5. **Add @see References**: Cross-reference related classes/methods
6. **Maintain Type Accuracy**: Ensure all types match actual signatures

### Error Documentation Strategy

For each method, document:
1. Runtime unavailability errors
2. Command execution failures
3. Timeout errors
4. Container not found errors
5. Invalid configuration errors

Example error patterns:
```typescript
/**
 * @throws {Error} When no container runtime (Docker/Podman) is available
 * @throws {Error} When container with specified ID is not found
 * @throws {Error} When command execution times out (default: 30s)
 */
```

### Example Categories

Each example should demonstrate:
1. **Basic Usage**: Simple, common use case
2. **With Options**: Using optional parameters
3. **Error Handling**: Try/catch pattern
4. **Event Listening**: For EventEmitter methods

## Consequences

### Positive
- Improved developer experience with IntelliSense documentation
- Clear understanding of error conditions
- Runnable examples for testing understanding
- Better onboarding for new contributors
- Self-documenting codebase

### Negative
- Increased file size (~15-20% larger)
- Documentation maintenance burden
- Examples may become outdated

## Implementation Checklist

- [ ] container-manager.ts
  - [ ] Enhance ContainerManager class JSDoc
  - [ ] Add @throws/@example to createContainer()
  - [ ] Add @throws/@example to startContainer()
  - [ ] Add @throws/@example to stopContainer()
  - [ ] Add @throws/@example to removeContainer()
  - [ ] Add @throws/@example to inspect()
  - [ ] Add @throws/@example to getStats()
  - [ ] Add @throws/@example to getContainerInfo()
  - [ ] Add @throws/@example to listApexContainers()
  - [ ] Add @throws/@example to streamLogs()
  - [ ] Add @throws/@example to execCommand()
  - [ ] Add @example to generateContainerName()
  - [ ] Add @throws/@example to startEventsMonitoring()
  - [ ] Add @example to stopEventsMonitoring()
  - [ ] Add @example to isEventsMonitoringActive()
  - [ ] Add @example to getMonitoringOptions()
  - [ ] Enhance ContainerLogStream class JSDoc
  - [ ] Add @example to convenience functions

- [ ] container-runtime.ts
  - [ ] Enhance ContainerRuntime class JSDoc
  - [ ] Add @throws/@example to detectRuntimes()
  - [ ] Add @throws/@example to getBestRuntime()
  - [ ] Add @example to getRuntimeInfo()
  - [ ] Add @example to isRuntimeAvailable()
  - [ ] Add @throws/@example to validateCompatibility()
  - [ ] Add JSDoc to clearCache()
  - [ ] Add @example to convenience functions

- [ ] container-health-monitor.ts
  - [ ] Enhance ContainerHealthMonitor class JSDoc
  - [ ] Add @throws/@example to startMonitoring()
  - [ ] Add @example to stopMonitoring()
  - [ ] Add @example to getHealthStatus()
  - [ ] Add @example to getContainerHealth()
  - [ ] Add @throws/@example to checkContainerHealth()
  - [ ] Add @throws/@example to addContainer()
  - [ ] Add @example to removeContainer()
  - [ ] Add @example to updateOptions()
  - [ ] Add @example to isActive()
  - [ ] Add complete JSDoc to getStats()
  - [ ] Add @example to convenience functions

## Verification

After implementation:
1. Run `npm run build` - Must pass with no errors
2. Run `npm run test` - All tests must pass
3. Verify IntelliSense shows complete documentation
4. Verify examples are syntactically correct

## Notes for Developer Stage

1. Start with container-manager.ts as it's the largest file
2. Use consistent example patterns across all files
3. Ensure examples use realistic values
4. Test that examples compile correctly
5. Keep examples concise but complete
