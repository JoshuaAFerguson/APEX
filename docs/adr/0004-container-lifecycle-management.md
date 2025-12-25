# ADR-0004: Container Lifecycle Management

## Status
Proposed

## Date
2025-01-13

## Context

APEX needs comprehensive container lifecycle management to support containerized task execution. The current implementation has partial support for container operations, but lacks:

1. A simplified, user-friendly public API with consistent method signatures
2. Container statistics (CPU, memory, network I/O) retrieval capability
3. Clear separation between internal implementation methods and public API

### Current State

The `ContainerManager` class currently has these methods:
- `startContainer(containerId, runtimeType?)` - Works but exposes internal runtime parameter
- `stopContainer(containerId, runtimeType?, timeout?)` - Works but has awkward signature
- `removeContainer(containerId, runtimeType?, force?)` - Works but has awkward signature
- `getContainerInfo(containerId, runtimeType?)` - Returns basic container info

### Acceptance Criteria

The acceptance criteria specify:
- `start(containerId)` - Start a container
- `stop(containerId, timeout?)` - Stop a container with optional timeout
- `remove(containerId, force?)` - Remove a container with optional force flag
- `inspect(containerId)` returning `ContainerInfo` - Get container details
- `getStats(containerId)` returning `ContainerStats` - Get runtime statistics
- All methods must work with both Docker and Podman
- Unit tests required

## Decision

We will extend the `ContainerManager` class with a clean public API that:

### 1. Public API Methods (New)

Add simplified public methods that auto-detect the container runtime:

```typescript
// Start a container
async start(containerId: string): Promise<ContainerOperationResult>

// Stop a container with optional timeout (defaults to 10 seconds)
async stop(containerId: string, timeout?: number): Promise<ContainerOperationResult>

// Remove a container with optional force flag
async remove(containerId: string, force?: boolean): Promise<ContainerOperationResult>

// Get container information (alias for getContainerInfo)
async inspect(containerId: string): Promise<ContainerInfo | null>

// NEW: Get container runtime statistics
async getStats(containerId: string): Promise<ContainerStats | null>
```

### 2. Container Stats Implementation

The `getStats()` method will:
- Use `docker/podman stats --no-stream --format` to get a single snapshot
- Parse the JSON or table output into the existing `ContainerStats` interface
- Handle both Docker and Podman output format differences
- Return null if container is not running or doesn't exist

**Stats Command Comparison:**

Docker:
```bash
docker stats --no-stream --format '{{json .}}' <container_id>
```

Podman:
```bash
podman stats --no-stream --format '{{json .}}' <container_id>
```

Both support JSON format with fields like:
- CPU% / CPUPerc
- MemUsage / MEM USAGE
- MemPerc / MEM %
- NetIO / NETIO
- BlockIO / BLOCK IO
- PIDs

### 3. Method Signatures

**Current Internal Methods (kept for backward compatibility):**
- `startContainer(containerId, runtimeType?)` - Internal, accepts runtime override
- `stopContainer(containerId, runtimeType?, timeout?)` - Internal, accepts runtime override
- `removeContainer(containerId, runtimeType?, force?)` - Internal, accepts runtime override

**New Public Methods (simplified API):**
- `start(containerId)` - Public, auto-detects runtime
- `stop(containerId, timeout?)` - Public, auto-detects runtime
- `remove(containerId, force?)` - Public, auto-detects runtime
- `inspect(containerId)` - Public, auto-detects runtime (alias for getContainerInfo)
- `getStats(containerId)` - Public, auto-detects runtime

### 4. Stats Output Parsing

Create a robust parser that handles Docker and Podman stats output:

```typescript
interface RawStatsOutput {
  // Docker format
  CPUPerc?: string;      // "0.50%"
  MemUsage?: string;     // "10MiB / 1GiB"
  MemPerc?: string;      // "1.00%"
  NetIO?: string;        // "1kB / 2kB"
  BlockIO?: string;      // "0B / 0B"
  PIDs?: string;         // "5"

  // Podman variations (may use different field names)
  CPU?: string;
  Mem?: string;
  // ... etc
}
```

Parse and normalize to `ContainerStats`:

```typescript
interface ContainerStats {
  cpuPercent: number;      // Parsed from CPUPerc
  memoryUsage: number;     // Bytes, parsed from MemUsage
  memoryLimit: number;     // Bytes, parsed from MemUsage
  memoryPercent: number;   // Parsed from MemPerc
  networkRxBytes: number;  // Parsed from NetIO (first value)
  networkTxBytes: number;  // Parsed from NetIO (second value)
  blockReadBytes: number;  // Parsed from BlockIO (first value)
  blockWriteBytes: number; // Parsed from BlockIO (second value)
  pids: number;            // Parsed from PIDs
}
```

### 5. Error Handling

All methods will:
- Return appropriate result types (success/failure with error messages)
- Handle container not found gracefully
- Handle runtime unavailability
- Set appropriate timeouts for all exec operations
- Log detailed error information for debugging

### 6. Testing Strategy

Add comprehensive unit tests:
- Test each new public method with Docker runtime
- Test each new public method with Podman runtime
- Test stats parsing for various Docker output formats
- Test stats parsing for various Podman output formats
- Test error handling (container not found, not running, runtime unavailable)
- Test byte parsing for memory, network, and block I/O

## Consequences

### Positive

1. **Clean API**: Users get a simple, consistent API without needing to know about runtime internals
2. **Stats Support**: Teams can monitor container resource usage during task execution
3. **Backward Compatible**: Existing internal methods remain available for advanced use cases
4. **Comprehensive Testing**: Full test coverage ensures reliability across runtimes

### Negative

1. **Slight API Redundancy**: Both `inspect()` and `getContainerInfo()` will exist (inspect is an alias)
2. **Stats Overhead**: Gathering stats adds an additional exec call when requested

### Risks

1. **Docker/Podman Stats Format Differences**: May need to handle edge cases in output parsing
2. **Stats Availability**: Some container states may not support stats (e.g., created but not running)

## Alternatives Considered

### Alternative 1: Single Method Per Operation

Keep only the simplified methods and deprecate the internal versions.

**Rejected because:** This would break backward compatibility and the internal runtime parameter is useful for testing and advanced scenarios.

### Alternative 2: Stats via Docker API

Use Docker/Podman API directly instead of CLI commands.

**Rejected because:**
- Adds complexity with socket/API connections
- Current pattern uses CLI for all operations consistently
- CLI approach works reliably across different system configurations

### Alternative 3: Streaming Stats

Provide a streaming stats interface with continuous updates.

**Rejected because:**
- Adds significant complexity
- Not needed for current use cases (snapshot stats are sufficient)
- Can be added later if needed without breaking changes

## Implementation Plan

1. Add `start()`, `stop()`, `remove()`, `inspect()` wrapper methods
2. Implement `getStats()` with output parsing
3. Add helper methods for parsing stats output
4. Write comprehensive unit tests
5. Update package exports if needed
6. Verify build and all tests pass

## References

- Docker stats documentation: https://docs.docker.com/engine/reference/commandline/stats/
- Podman stats documentation: https://docs.podman.io/en/latest/markdown/podman-stats.1.html
- Existing container types: `packages/core/src/types.ts`
- Existing ContainerManager: `packages/core/src/container-manager.ts`
