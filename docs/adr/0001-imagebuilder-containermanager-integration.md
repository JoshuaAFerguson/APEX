# ADR-0001: ImageBuilder Integration into ContainerManager

**Status**: Proposed
**Date**: 2024-01-XX
**Authors**: Architect Agent

## Context

Currently, `ContainerManager` and `ImageBuilder` are two separate, independent components in the `@apex/core` package:

1. **ContainerManager** (`container-manager.ts`): Manages container lifecycle operations (create, start, stop, remove) using Docker/Podman. The `createContainer()` method accepts a `ContainerConfig` with an `image` field.

2. **ImageBuilder** (`image-builder.ts`): Builds Docker/OCI images from Dockerfiles with features like content-hash-based caching, project-specific tagging, and multi-stage build support.

The `ContainerConfig` schema already includes optional fields for Dockerfile-based builds:
- `dockerfile?: string` - Path to Dockerfile
- `buildContext?: string` - Build context directory
- `imageTag?: string` - Custom tag for built images

However, these fields are currently **not used** by `ContainerManager`. Users who want to use custom Dockerfiles must manually:
1. Create an `ImageBuilder` instance
2. Call `buildImage()` with the config
3. Extract the resulting image tag
4. Pass that tag to `ContainerManager.createContainer()`

This multi-step process is error-prone and violates the principle of least surprise.

## Decision

We will integrate `ImageBuilder` into `ContainerManager` so that:

1. When `ContainerManager.createContainer()` receives a config with a `dockerfile` field, it automatically:
   - Creates/uses an `ImageBuilder` instance
   - Checks if the Dockerfile exists and if the image needs to be (re)built
   - Builds the image using `ImageBuilder.buildImage()`
   - Uses the resulting image tag for container creation

2. When no `dockerfile` field is present, the existing behavior continues unchanged (use `config.image` directly)

3. The default fallback image remains `node:20` when neither `dockerfile` nor `image` is provided

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ContainerManager                              │
├─────────────────────────────────────────────────────────────────────┤
│  createContainer(options)                                           │
│      │                                                              │
│      ├── config.dockerfile exists?                                  │
│      │       │                                                      │
│      │       ├── YES: ensureImage(config)                          │
│      │       │         │                                            │
│      │       │         ├── Initialize ImageBuilder (if needed)      │
│      │       │         ├── Check if image exists & is current       │
│      │       │         ├── Build if stale/missing                   │
│      │       │         └── Return image tag                         │
│      │       │                                                      │
│      │       └── NO: Use config.image (default: 'node:20')         │
│      │                                                              │
│      └── Continue with container creation using resolved image tag  │
└─────────────────────────────────────────────────────────────────────┘
```

### New Interface Definitions

```typescript
/**
 * Options for image building during container creation
 */
export interface ImageBuildOptions {
  /** Force rebuild even if image exists and Dockerfile unchanged */
  forceRebuild?: boolean;
  /** Disable cache during build */
  noCache?: boolean;
  /** Build arguments */
  buildArgs?: Record<string, string>;
  /** Target stage for multi-stage builds */
  target?: string;
  /** Platform specification */
  platform?: string;
}

/**
 * Result of image resolution during container creation
 */
export interface ImageResolutionResult {
  /** The image tag to use for container creation */
  imageTag: string;
  /** Whether the image was built as part of this operation */
  wasBuilt: boolean;
  /** Build result (if image was built) */
  buildResult?: ImageBuildResult;
}

/**
 * Extended container operation result with build info
 */
export interface ContainerOperationResult {
  // ... existing fields ...

  /** Image resolution result (if applicable) */
  imageResolution?: ImageResolutionResult;
}

/**
 * Extended container creation options
 */
export interface CreateContainerOptions {
  // ... existing fields ...

  /** Options for image building (if dockerfile is present in config) */
  imageBuildOptions?: ImageBuildOptions;
}
```

### ContainerManager Modifications

#### New Private Methods

```typescript
class ContainerManager {
  // New private property
  private imageBuilder?: ImageBuilder;

  /**
   * Lazily initialize ImageBuilder when needed
   */
  private getImageBuilder(projectRoot: string): ImageBuilder {
    if (!this.imageBuilder) {
      this.imageBuilder = new ImageBuilder(projectRoot);
    }
    return this.imageBuilder;
  }

  /**
   * Ensure the required image exists, building from Dockerfile if necessary
   */
  private async ensureImage(
    config: ContainerConfig,
    projectRoot: string,
    buildOptions?: ImageBuildOptions
  ): Promise<ImageResolutionResult> {
    // Implementation details below
  }

  /**
   * Check if an image needs to be rebuilt
   */
  private async shouldRebuildImage(
    imageBuilder: ImageBuilder,
    dockerfilePath: string,
    imageTag: string
  ): Promise<boolean> {
    // Compare Dockerfile hash with existing image metadata
  }
}
```

#### Modified createContainer Method

```typescript
async createContainer(options: CreateContainerOptions): Promise<ContainerOperationResult> {
  try {
    const runtimeType = await this.runtime.getBestRuntime();

    if (runtimeType === 'none') {
      // ... existing error handling ...
    }

    // NEW: Resolve the image to use
    let effectiveImage = options.config.image || 'node:20';
    let imageResolution: ImageResolutionResult | undefined;

    if (options.config.dockerfile) {
      // Determine project root from build context or dockerfile path
      const projectRoot = options.config.buildContext ||
                          path.dirname(path.resolve(options.config.dockerfile));

      imageResolution = await this.ensureImage(
        options.config,
        projectRoot,
        options.imageBuildOptions
      );

      if (!imageResolution.imageTag) {
        return {
          success: false,
          error: `Image build failed: ${imageResolution.buildResult?.error || 'Unknown error'}`,
        };
      }

      effectiveImage = imageResolution.imageTag;
    }

    // Continue with existing container creation logic,
    // but use effectiveImage instead of config.image
    const containerName = options.nameOverride || this.generateContainerName(options.taskId);

    // Create a modified config with the resolved image
    const effectiveConfig = { ...options.config, image: effectiveImage };
    const command = this.buildCreateCommand(runtimeType, effectiveConfig, containerName);

    // ... rest of existing implementation ...

    return {
      success: true,
      containerId,
      containerInfo,
      command,
      output: stdout,
      imageResolution, // NEW: Include image resolution result
    };
  } catch (error) {
    // ... existing error handling ...
  }
}
```

### ensureImage Implementation

```typescript
private async ensureImage(
  config: ContainerConfig,
  projectRoot: string,
  buildOptions?: ImageBuildOptions
): Promise<ImageResolutionResult> {
  const imageBuilder = this.getImageBuilder(projectRoot);

  // Ensure ImageBuilder is initialized
  try {
    await imageBuilder.initialize();
  } catch (error) {
    return {
      imageTag: '',
      wasBuilt: false,
      buildResult: {
        success: false,
        error: `Failed to initialize ImageBuilder: ${error}`,
        buildOutput: '',
        buildDuration: 0,
        rebuilt: false,
      },
    };
  }

  // Resolve dockerfile path
  const dockerfilePath = config.dockerfile!;

  // Generate or use custom image tag
  const imageTag = config.imageTag ||
                   await imageBuilder.generateProjectTag(dockerfilePath);

  // Check if rebuild is needed
  const forceRebuild = buildOptions?.forceRebuild || false;
  const needsBuild = forceRebuild ||
                     await this.shouldRebuildImage(imageBuilder, dockerfilePath, imageTag);

  if (!needsBuild) {
    return {
      imageTag,
      wasBuilt: false,
    };
  }

  // Build the image
  const buildResult = await imageBuilder.buildImage({
    dockerfilePath,
    buildContext: config.buildContext,
    imageTag,
    forceRebuild,
    noCache: buildOptions?.noCache,
    buildArgs: buildOptions?.buildArgs,
    target: buildOptions?.target,
    platform: buildOptions?.platform,
  });

  if (!buildResult.success) {
    return {
      imageTag: '',
      wasBuilt: false,
      buildResult,
    };
  }

  return {
    imageTag: buildResult.imageInfo?.tag || imageTag,
    wasBuilt: buildResult.rebuilt,
    buildResult,
  };
}
```

### shouldRebuildImage Implementation

```typescript
private async shouldRebuildImage(
  imageBuilder: ImageBuilder,
  dockerfilePath: string,
  imageTag: string
): Promise<boolean> {
  try {
    // Check if image exists
    const imageInfo = await imageBuilder.getImageInfo(imageTag);
    if (!imageInfo.exists) {
      return true; // Image doesn't exist, needs build
    }

    // Check if Dockerfile has changed
    const currentHash = await imageBuilder.calculateDockerfileHash(dockerfilePath);
    if (imageInfo.dockerfileHash !== currentHash) {
      return true; // Dockerfile changed, needs rebuild
    }

    return false; // Image is current
  } catch (error) {
    // If any check fails, assume rebuild is needed
    return true;
  }
}
```

### Event Emission

Add a new event type for image build operations:

```typescript
export interface ContainerManagerEvents {
  // ... existing events ...

  /** Emitted when an image is built for container creation */
  'image:built': (event: ImageBuildEvent) => void;

  /** Emitted when using cached image (no rebuild needed) */
  'image:cached': (event: ImageCachedEvent) => void;
}

export interface ImageBuildEvent {
  taskId?: string;
  imageTag: string;
  dockerfilePath: string;
  buildDuration: number;
  timestamp: Date;
}

export interface ImageCachedEvent {
  taskId?: string;
  imageTag: string;
  timestamp: Date;
}
```

### Default Image Handling

The fallback logic follows this order:
1. If `config.dockerfile` exists → Build image, use resulting tag
2. If `config.image` exists → Use it directly
3. Fallback → Use `'node:20'` as the default image

## Consequences

### Positive

1. **Simplified API**: Users can specify a Dockerfile in `ContainerConfig` and the system handles building automatically
2. **Automatic Caching**: Leverages `ImageBuilder`'s hash-based caching to avoid unnecessary rebuilds
3. **Transparent Integration**: Existing code using `config.image` continues to work unchanged
4. **Event Visibility**: Build events provide observability into the image building process
5. **Lazy Initialization**: `ImageBuilder` is only created when needed, minimizing overhead

### Negative

1. **Increased Complexity**: `ContainerManager` now has image-building responsibilities
2. **Longer Creation Time**: First container creation with a Dockerfile will take longer due to build
3. **Error Handling Complexity**: Need to handle both build and container creation failures

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Build failures blocking container creation | Clear error messages with build output; fallback to `config.image` if provided |
| Performance impact from unnecessary builds | Hash-based caching; `forceRebuild` option for explicit control |
| ImageBuilder initialization failures | Graceful degradation with informative errors |

## File Changes Summary

| File | Changes |
|------|---------|
| `packages/core/src/container-manager.ts` | Add `ImageBuilder` integration, new methods, modified `createContainer()` |
| `packages/core/src/types.ts` | Add `ImageBuildOptions`, `ImageResolutionResult` interfaces |
| `packages/core/src/__tests__/container-manager-image-integration.test.ts` | New test file for integration tests |

## Testing Strategy

1. **Unit Tests**: Mock `ImageBuilder` to test `ContainerManager` integration logic
2. **Integration Tests**: Test build-then-create flow with mock filesystem
3. **Edge Cases**:
   - Missing Dockerfile
   - Build failures
   - Cached image usage
   - Fallback to `config.image`
   - No Dockerfile and no image (uses default `node:20`)

## Open Questions

1. Should we expose a method to explicitly pre-build images without creating containers?
2. Should the `ImageBuilder` instance be shared across `ContainerManager` instances?
3. How should we handle concurrent builds of the same image from multiple container creations?
