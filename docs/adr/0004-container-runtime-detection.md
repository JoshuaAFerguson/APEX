# ADR 0004: Container Runtime Detection Utility

## Status
Proposed

## Date
2024-12-25

## Context

APEX needs to execute tasks in isolated container environments for secure and reproducible builds. Before running containerized operations, APEX must detect which container runtime is available on the host system (Docker or Podman) and validate its compatibility.

### Requirements from Acceptance Criteria
1. Detect if docker or podman is available
2. Return runtime type ('docker' | 'podman' | 'none')
3. Provide version information
4. Validate runtime compatibility
5. Include unit tests with mocked command execution

## Decision

### Architecture Overview

We will implement a `ContainerRuntime` class in `packages/orchestrator/src/container-runtime.ts` following the established patterns in the codebase, specifically mirroring the `ServiceManager` pattern for platform/runtime detection.

### Type Definitions

```typescript
// Runtime type discriminator
export type ContainerRuntimeType = 'docker' | 'podman' | 'none';

// Error codes for container runtime operations
export type ContainerRuntimeErrorCode =
  | 'RUNTIME_NOT_FOUND'
  | 'DETECTION_FAILED'
  | 'VERSION_PARSE_FAILED'
  | 'INCOMPATIBLE_VERSION';

// Custom error class following ServiceError pattern
export class ContainerRuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: ContainerRuntimeErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ContainerRuntimeError';
  }
}

// Semantic version structure
export interface ContainerVersion {
  major: number;
  minor: number;
  patch: number;
  full: string;
  buildInfo?: string;
}

// Complete runtime information
export interface ContainerRuntimeInfo {
  type: ContainerRuntimeType;
  version: ContainerVersion | null;
  path: string | null;
  compatible: boolean;
  apiVersion?: string;
  features?: ContainerFeatures;
}

// Feature detection for advanced capabilities
export interface ContainerFeatures {
  buildx: boolean;      // Docker buildx or Podman build
  compose: boolean;     // Docker Compose or Podman Compose
  rootless: boolean;    // Rootless mode support
}

// Compatibility requirements
export interface CompatibilityRequirements {
  minDockerVersion?: string;  // e.g., "20.10.0"
  minPodmanVersion?: string;  // e.g., "4.0.0"
  requiredFeatures?: (keyof ContainerFeatures)[];
}
```

### Class Design

```typescript
export class ContainerRuntime {
  private cachedInfo: ContainerRuntimeInfo | null = null;
  private readonly requirements: CompatibilityRequirements;

  constructor(requirements?: CompatibilityRequirements);

  // Primary detection method
  async detect(): Promise<ContainerRuntimeInfo>;

  // Convenience methods
  async getType(): Promise<ContainerRuntimeType>;
  async getVersion(): Promise<ContainerVersion | null>;
  async isCompatible(): Promise<boolean>;
  async isAvailable(): Promise<boolean>;

  // Feature detection
  async hasFeature(feature: keyof ContainerFeatures): Promise<boolean>;
  async getFeatures(): Promise<ContainerFeatures>;

  // Utility methods
  async getExecutablePath(): Promise<string | null>;
  clearCache(): void;

  // Static factory methods for convenience
  static async detectRuntime(
    requirements?: CompatibilityRequirements
  ): Promise<ContainerRuntimeInfo>;
}
```

### Detection Strategy

The detection follows a priority-based approach:

1. **Docker Detection** (higher priority)
   - Execute `docker --version` to check availability
   - Parse version from output: `Docker version 24.0.5, build ...`
   - Execute `docker info` for additional metadata (API version, rootless mode)

2. **Podman Detection** (fallback)
   - Execute `podman --version` to check availability
   - Parse version from output: `podman version 4.7.2`
   - Execute `podman info` for additional metadata

3. **Feature Detection**
   - `docker buildx version` / `podman build --help`
   - `docker compose version` / `podman-compose --version`
   - Check rootless mode via info output

### Version Parsing

Using existing `parseSemver` utility from `@apexcli/core/utils`:

```typescript
import { parseSemver } from '@apexcli/core';

// Docker: "Docker version 24.0.5, build ced0996"
// Podman: "podman version 4.7.2"
function parseContainerVersion(output: string, type: ContainerRuntimeType): ContainerVersion | null {
  const match = output.match(/(\d+\.\d+\.\d+)/);
  if (!match) return null;

  const parsed = parseSemver(match[1]);
  if (!parsed) return null;

  return {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    full: match[1],
    buildInfo: extractBuildInfo(output),
  };
}
```

### Compatibility Validation

```typescript
import { compareVersions } from '@apexcli/core';

async isCompatible(): Promise<boolean> {
  const info = await this.detect();

  if (info.type === 'none') return false;
  if (!info.version) return false;

  const minVersion = info.type === 'docker'
    ? this.requirements.minDockerVersion
    : this.requirements.minPodmanVersion;

  if (minVersion) {
    const comparison = compareVersions(info.version.full, minVersion);
    if (comparison < 0) return false;
  }

  // Check required features
  if (this.requirements.requiredFeatures) {
    const features = await this.getFeatures();
    for (const feature of this.requirements.requiredFeatures) {
      if (!features[feature]) return false;
    }
  }

  return true;
}
```

### Caching Strategy

- Cache detection results to avoid repeated shell calls
- Provide `clearCache()` method for forced re-detection
- Cache expires on explicit clear or new instance creation

### Command Execution Pattern

Following `worktree-manager.ts` pattern:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

private async executeCommand(command: string): Promise<{ stdout: string; stderr: string } | null> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 5000, // 5 second timeout
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    // Command not found or execution failed
    return null;
  }
}
```

### File Structure

```
packages/orchestrator/src/
├── container-runtime.ts       # Main implementation
├── container-runtime.test.ts  # Unit tests with mocks
```

### Test Strategy

Following `service-manager.test.ts` pattern:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { exec } from 'child_process';
import { ContainerRuntime, ContainerRuntimeError, type ContainerRuntimeInfo } from './container-runtime';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec) as MockedFunction<typeof exec>;

describe('ContainerRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect()', () => {
    it('should detect Docker when available', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command === 'docker --version') {
          callback(null, { stdout: 'Docker version 24.0.5, build ced0996', stderr: '' });
        }
        return {} as any;
      });

      const runtime = new ContainerRuntime();
      const info = await runtime.detect();

      expect(info.type).toBe('docker');
      expect(info.version?.major).toBe(24);
    });

    it('should fallback to Podman when Docker not available', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command === 'docker --version') {
          callback(new Error('command not found'));
        } else if (command === 'podman --version') {
          callback(null, { stdout: 'podman version 4.7.2', stderr: '' });
        }
        return {} as any;
      });

      const runtime = new ContainerRuntime();
      const info = await runtime.detect();

      expect(info.type).toBe('podman');
    });

    it('should return none when no runtime available', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        callback(new Error('command not found'));
        return {} as any;
      });

      const runtime = new ContainerRuntime();
      const info = await runtime.detect();

      expect(info.type).toBe('none');
      expect(info.compatible).toBe(false);
    });
  });

  describe('isCompatible()', () => {
    it('should validate minimum version requirements', async () => {
      mockExec.mockImplementation((command: string, callback?: any) => {
        if (command === 'docker --version') {
          callback(null, { stdout: 'Docker version 19.0.0, build old', stderr: '' });
        }
        return {} as any;
      });

      const runtime = new ContainerRuntime({
        minDockerVersion: '20.10.0',
      });

      expect(await runtime.isCompatible()).toBe(false);
    });
  });

  // ... additional test cases
});
```

### Integration Points

1. **Orchestrator Integration**: `ApexOrchestrator` can use `ContainerRuntime` to validate environment before container-based task execution.

2. **CLI Integration**: `apex init` or `apex run` commands can display container runtime information.

3. **Configuration**: Future extension could add container settings to `.apex/config.yaml`:
   ```yaml
   container:
     runtime: auto  # auto | docker | podman
     requirements:
       minDockerVersion: "20.10.0"
       minPodmanVersion: "4.0.0"
   ```

## Consequences

### Positive
- Clean abstraction over multiple container runtimes
- Follows established codebase patterns (consistency)
- Comprehensive version validation
- Extensible for future runtimes
- Well-tested with mocked command execution

### Negative
- Adds dependency on shell command execution
- Detection may have slight performance overhead (mitigated by caching)

### Risks
- Version string format may change between runtime releases (mitigated by flexible regex parsing)
- Feature detection commands may differ between versions (mitigated by graceful degradation)

## Alternatives Considered

1. **Direct binary detection via `which`/`where`**: Less reliable, doesn't validate version
2. **Environment variable-based configuration**: Requires user setup, less automatic
3. **Runtime SDK integration**: Too heavyweight for detection purposes

## Implementation Notes

1. Place in `packages/orchestrator/src/container-runtime.ts` alongside other system utilities
2. Export from `packages/orchestrator/src/index.ts` for external use
3. Tests in `packages/orchestrator/src/container-runtime.test.ts`
4. Follow existing error handling patterns with custom error class
5. Use existing `parseSemver` and `compareVersions` utilities from core package
