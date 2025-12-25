# ContainerRuntime Utility

The ContainerRuntime utility provides automated detection and compatibility validation for Docker and Podman container runtimes. It enables APEX to work seamlessly with either container technology while providing a unified interface.

## Features

- **Automatic Detection**: Detects available container runtimes (Docker/Podman) on the system
- **Runtime Type Detection**: Returns 'docker', 'podman', or 'none' based on availability
- **Version Information**: Provides detailed version information for detected runtimes
- **Compatibility Validation**: Validates runtime compatibility against requirements
- **Intelligent Caching**: Caches detection results to avoid repeated system calls
- **Graceful Fallback**: Falls back gracefully when no runtime is available

## Usage

### Basic Detection

```typescript
import { detectContainerRuntime, isContainerRuntimeAvailable } from '@apexcli/core';

// Detect the best available runtime
const runtime = await detectContainerRuntime();
console.log(`Best runtime: ${runtime}`); // 'docker', 'podman', or 'none'

// Check if specific runtime is available
const dockerAvailable = await isContainerRuntimeAvailable('docker');
const podmanAvailable = await isContainerRuntimeAvailable('podman');
```

### Version Information

```typescript
import { getContainerRuntimeInfo } from '@apexcli/core';

// Get version information
const dockerInfo = await getContainerRuntimeInfo('docker');
if (dockerInfo) {
  console.log(`Docker version: ${dockerInfo.version}`);
  console.log(`Build info: ${dockerInfo.buildInfo}`);
}
```

### Advanced Usage with ContainerRuntime Class

```typescript
import { ContainerRuntime } from '@apexcli/core';

const runtime = new ContainerRuntime();

// Detect all available runtimes
const runtimes = await runtime.detectRuntimes();
for (const rt of runtimes) {
  console.log(`${rt.type}: ${rt.available ? 'available' : 'not available'}`);
  if (rt.versionInfo) {
    console.log(`  Version: ${rt.versionInfo.version}`);
  }
}

// Get the best runtime with preference
const bestRuntime = await runtime.getBestRuntime('podman'); // Prefer Podman if available

// Validate compatibility
const compatibility = await runtime.validateCompatibility('docker', {
  minVersion: '20.0.0',
  maxVersion: '30.0.0',
  requiredFeatures: ['buildkit']
});

if (!compatibility.compatible) {
  console.log('Issues:', compatibility.issues);
  console.log('Recommendations:', compatibility.recommendations);
}
```

### Integration with Workspace Manager

The ContainerRuntime utility is automatically integrated with the WorkspaceManager:

```typescript
import { WorkspaceManager } from '@apexcli/orchestrator';

const workspaceManager = new WorkspaceManager({
  projectPath: '/path/to/project',
  defaultStrategy: 'container'
});

await workspaceManager.initialize(); // Automatically detects container runtime

// Check if container workspaces are supported
if (workspaceManager.supportsContainerWorkspaces()) {
  console.log(`Using container runtime: ${workspaceManager.getContainerRuntime()}`);
} else {
  console.log('Container workspaces not available');
}
```

## API Reference

### Types

```typescript
type ContainerRuntimeType = 'docker' | 'podman' | 'none';

interface RuntimeVersionInfo {
  version: string;
  fullVersion: string;
  apiVersion?: string;
  buildInfo?: string;
}

interface RuntimeDetectionResult {
  type: ContainerRuntimeType;
  available: boolean;
  versionInfo?: RuntimeVersionInfo;
  error?: string;
  command?: string;
}

interface CompatibilityRequirement {
  minVersion?: string;
  maxVersion?: string;
  requiredFeatures?: string[];
}

interface CompatibilityResult {
  compatible: boolean;
  versionCompatible: boolean;
  featuresCompatible: boolean;
  issues: string[];
  recommendations: string[];
}
```

### ContainerRuntime Class

- `detectRuntimes(): Promise<RuntimeDetectionResult[]>` - Detect all available runtimes
- `getBestRuntime(preferred?: ContainerRuntimeType): Promise<ContainerRuntimeType>` - Get best available runtime
- `getRuntimeInfo(type: ContainerRuntimeType): Promise<RuntimeDetectionResult | null>` - Get runtime info
- `isRuntimeAvailable(type: ContainerRuntimeType): Promise<boolean>` - Check availability
- `validateCompatibility(type, requirements): Promise<CompatibilityResult>` - Validate compatibility
- `clearCache(): void` - Clear detection cache

### Convenience Functions

- `detectContainerRuntime(preferred?: ContainerRuntimeType): Promise<ContainerRuntimeType>` - Detect best runtime
- `isContainerRuntimeAvailable(type: ContainerRuntimeType): Promise<boolean>` - Check availability
- `getContainerRuntimeInfo(type: ContainerRuntimeType): Promise<RuntimeVersionInfo | null>` - Get version info

## Error Handling

The utility handles various error conditions gracefully:

- **Runtime not installed**: Returns appropriate error message
- **Runtime installed but not functional**: Detects when daemon is not running
- **Permission errors**: Handles cases where runtime requires elevated privileges
- **Timeout errors**: Handles slow or unresponsive runtime commands
- **Malformed version output**: Gracefully handles unexpected version formats

## Caching

Detection results are automatically cached for 5 minutes to avoid repeated system calls. The cache can be manually cleared using `clearCache()` method.

## Testing

The utility includes comprehensive unit tests with mocked command execution:

```bash
npm test --workspace=@apex/core -- container-runtime
```

Tests cover:
- Docker detection scenarios
- Podman detection scenarios
- Version parsing
- Compatibility validation
- Error handling
- Caching behavior
- Integration scenarios