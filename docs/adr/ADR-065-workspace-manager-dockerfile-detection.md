# ADR-065: WorkspaceManager Dockerfile Detection

## Status

Proposed

## Context

Currently, the `WorkspaceManager.createContainerWorkspace()` method creates container workspaces using a pre-configured container image from the task's workspace configuration. This requires users to specify a Docker image explicitly in their configuration.

To improve the developer experience and support project-specific containerized environments, we need to detect and use custom Dockerfiles located at `.apex/Dockerfile` when present in the project directory.

## Decision

### Technical Design

We will modify `WorkspaceManager.createContainerWorkspace()` to:

1. **Check for `.apex/Dockerfile` presence** in the project directory
2. **Pass dockerfile path to ContainerConfig** if found
3. **Default to `node:20-alpine` image** when no Dockerfile exists and no custom image is specified

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     WorkspaceManager                            │
├─────────────────────────────────────────────────────────────────┤
│  createContainerWorkspace(task, config)                         │
│    │                                                            │
│    ├─► checkProjectDockerfile()                                 │
│    │     └─► Check .apex/Dockerfile exists                      │
│    │                                                            │
│    ├─► If Dockerfile exists:                                    │
│    │     └─► Set containerConfig.dockerfile = ".apex/Dockerfile"│
│    │         Set containerConfig.buildContext = projectPath     │
│    │                                                            │
│    ├─► If Dockerfile does NOT exist:                            │
│    │     └─► Use config.container.image OR "node:20-alpine"     │
│    │                                                            │
│    └─► containerManager.createContainer(containerConfig)        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Dockerfile Location Convention

- **Path**: `.apex/Dockerfile` (relative to project root)
- **Rationale**: Keeps APEX-specific configuration within the `.apex/` directory, consistent with other APEX configuration files (`config.yaml`, `agents/`, `workflows/`)

#### 2. Build Context

- **Path**: Project root (`this.projectPath`)
- **Rationale**: The Dockerfile should have access to the entire project for proper `COPY` and `ADD` instructions

#### 3. Image Fallback Strategy

```
Priority Order:
1. .apex/Dockerfile (if exists) → Build custom image
2. config.container.image (if specified) → Use specified image
3. Default: "node:20-alpine" → Standard Node.js Alpine image
```

#### 4. Integration with Existing Infrastructure

The implementation leverages existing infrastructure in `@apex/core`:

- **ImageBuilder**: Already handles Dockerfile-based image building
- **ContainerConfig.dockerfile**: Property already exists in the schema (line 484 in types.ts)
- **ContainerConfig.buildContext**: Property already exists (line 486 in types.ts)
- **ContainerManager.buildImageIfNeeded()**: Already handles image building from Dockerfile

### Implementation Details

#### Modified `createContainerWorkspace()` Method

```typescript
private async createContainerWorkspace(task: Task, config: WorkspaceConfig): Promise<string> {
  if (!config.container) {
    throw new Error('Container configuration required for container strategy');
  }

  if (!this.containerRuntimeType || this.containerRuntimeType === 'none') {
    throw new Error('No container runtime available (Docker or Podman required)');
  }

  const workspacePath = join(this.workspacesDir, `container-${task.id}`);
  await fs.mkdir(workspacePath, { recursive: true });

  try {
    // Check for project-specific Dockerfile
    const dockerfilePath = join(this.projectPath, '.apex', 'Dockerfile');
    const hasProjectDockerfile = await this.fileExists(dockerfilePath);

    // Build container configuration
    const containerConfig = {
      ...config.container,
      // Use project Dockerfile if it exists
      ...(hasProjectDockerfile && {
        dockerfile: '.apex/Dockerfile',
        buildContext: this.projectPath,
      }),
      // Ensure default image fallback
      image: config.container.image || 'node:20-alpine',
      volumes: {
        [this.projectPath]: '/workspace',
        ...config.container.volumes,
      },
      workingDir: config.container.workingDir || '/workspace',
      labels: {
        'apex.task-id': task.id,
        'apex.workspace-type': 'container',
        ...config.container.labels,
      },
    };

    const result = await this.containerManager.createContainer({
      config: containerConfig,
      taskId: task.id,
      autoStart: true,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create container');
    }

    return workspacePath;
  } catch (error) {
    throw new Error(`Failed to create container workspace: ${error}`);
  }
}

/**
 * Check if a file exists
 */
private async fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

### Test Plan

#### Unit Tests Required

1. **Dockerfile Detection Tests**
   - Test that `.apex/Dockerfile` is detected when present
   - Test that missing Dockerfile falls back to default behavior

2. **ContainerConfig Construction Tests**
   - Verify `dockerfile` and `buildContext` are set when Dockerfile exists
   - Verify default `node:20-alpine` image is used when no Dockerfile and no custom image

3. **Integration Tests**
   - End-to-end test with mock container runtime
   - Verify correct command construction with Dockerfile path

#### Test File Location

- `packages/orchestrator/src/workspace-manager.test.ts` (new file)

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/workspace-manager.ts` | Modify | Add Dockerfile detection logic |
| `packages/orchestrator/src/workspace-manager.test.ts` | Create | Unit and integration tests |

### Interface Compatibility

This change is **backward compatible**:
- Existing configurations without `.apex/Dockerfile` will continue to work
- Existing configurations with explicit `container.image` will continue to work
- The new behavior only activates when `.apex/Dockerfile` is present

### Error Handling

| Scenario | Behavior |
|----------|----------|
| `.apex/Dockerfile` exists but is invalid | Build fails with clear error message from ImageBuilder |
| `.apex/Dockerfile` build fails | Falls back to specified image or default |
| No container runtime available | Throws descriptive error (existing behavior) |

## Consequences

### Positive

- **Improved DX**: Projects can define custom container environments without modifying task configurations
- **Consistency**: Uses existing APEX conventions (`.apex/` directory)
- **No Breaking Changes**: Fully backward compatible

### Negative

- **Build Time**: First container creation may take longer due to image build
- **Caching Required**: Relies on ImageBuilder's caching to avoid repeated builds

### Neutral

- **Filesystem Access**: Adds one filesystem check per container workspace creation

## Related ADRs

- ADR-063: Container Manager Architecture
- ADR-064: Container Manager EventEmitter3 Refactoring

## Implementation Priority

This is a focused, well-scoped change that touches a single method in a single file. The implementation should be straightforward given the existing infrastructure in `@apex/core`.
