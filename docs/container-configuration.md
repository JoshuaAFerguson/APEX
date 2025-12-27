# Container Configuration Reference

Complete reference for all container configuration options in APEX. For conceptual background, setup instructions, and best practices, see the [Container Isolation Guide](./container-isolation.md).

## Overview

APEX supports running tasks in isolated Docker or Podman containers. Container configuration is defined in `.apex/config.yaml` under `workspace.container` and can be overridden on a per-task basis.

## Quick Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| [`image`](#image) | string | - | Docker/OCI image (required for container strategy) |
| [`dockerfile`](#dockerfile) | string | - | Path to custom Dockerfile |
| [`buildContext`](#buildcontext) | string | `"."` | Docker build context path |
| [`imageTag`](#imagetag) | string | - | Custom tag for built images |
| [`volumes`](#volumes) | object | - | Host:container volume mounts |
| [`environment`](#environment) | object | - | Environment variables |
| [`resourceLimits`](#resource-limits) | object | - | CPU/memory constraints |
| [`networkMode`](#network-modes) | string | `"bridge"` | Container network mode |
| [`workingDir`](#workingdir) | string | - | Working directory in container |
| [`user`](#user) | string | - | User/group to run as |
| [`labels`](#labels) | object | - | Container metadata labels |
| [`entrypoint`](#entrypoint) | string[] | - | Container entrypoint override |
| [`command`](#command) | string[] | - | Container command override |
| [`autoRemove`](#autoremove) | boolean | `true` | Remove container on exit |
| [`privileged`](#privileged) | boolean | `false` | Run in privileged mode |
| [`securityOpts`](#securityopts) | string[] | - | Security options |
| [`capAdd`](#capabilities) | string[] | - | Linux capabilities to add |
| [`capDrop`](#capabilities) | string[] | - | Linux capabilities to drop |
| [`autoDependencyInstall`](#autodependencyinstall) | boolean | `true` | Auto-install dependencies |
| [`customInstallCommand`](#custominstallcommand) | string | - | Custom install command |
| [`useFrozenLockfile`](#usefrozenlockfile) | boolean | `true` | Use frozen lockfile |
| [`installTimeout`](#installtimeout) | number | - | Install timeout (ms) |
| [`installRetries`](#installretries) | number | - | Install retry count |

---

## Image Configuration

### `image`

**Type**: `string`
**Default**: None
**Required**: Yes (when using container strategy)
**Since**: v0.4.0

The Docker/OCI image to use as the base for the container. This is the only required field when using container isolation.

**Validation**:
- Must be a valid Docker image reference
- Format: `[registry/]name[:tag]`
- Examples: `node:20-alpine`, `python:3.11-slim`, `ghcr.io/myorg/myimage:v1.0`

**Example**:
```yaml
workspace:
  defaultStrategy: "container"
  container:
    image: "node:20-alpine"
```

**Best Practice**: Use specific version tags instead of `latest` for reproducibility.

---

### `dockerfile`

**Type**: `string`
**Default**: None
**Required**: No
**Since**: v0.4.0

Path to a custom Dockerfile for building project-specific images. Relative paths are resolved from the project root.

**Example**:
```yaml
workspace:
  container:
    dockerfile: ".apex/Dockerfile"
    buildContext: "."
    imageTag: "my-project:dev"
```

**Related**: [`buildContext`](#buildcontext), [`imageTag`](#imagetag)

---

### `buildContext`

**Type**: `string`
**Default**: `"."`
**Required**: No
**Since**: v0.4.0

The build context path for Docker image builds. Only used when `dockerfile` is specified.

**Example**:
```yaml
workspace:
  container:
    dockerfile: "docker/Dockerfile.dev"
    buildContext: "."
```

---

### `imageTag`

**Type**: `string`
**Default**: Auto-generated
**Required**: No
**Since**: v0.4.0

Custom tag for images built from a Dockerfile.

**Example**:
```yaml
workspace:
  container:
    dockerfile: ".apex/Dockerfile"
    imageTag: "my-project:apex-dev"
```

---

## Resource Limits

Resource limits control CPU, memory, and process constraints for containerized tasks. These map directly to Docker/Podman runtime flags.

### Resource Limits Reference Table

| Field | Type | Range | Unit | Docker Flag | Description |
|-------|------|-------|------|-------------|-------------|
| `cpu` | number | 0.1-64 | cores | `--cpus` | CPU core limit |
| `memory` | string | - | k/m/g | `--memory` | Memory hard limit |
| `memoryReservation` | string | - | k/m/g | `--memory-reservation` | Memory soft limit |
| `memorySwap` | string | - | k/m/g | `--memory-swap` | Swap + memory limit |
| `cpuShares` | number | 2-262144 | weight | `--cpu-shares` | CPU priority (1024 = 1 share) |
| `pidsLimit` | number | 1+ | count | `--pids-limit` | Maximum process count |

### Memory Unit Suffixes

| Suffix | Meaning | Example |
|--------|---------|---------|
| `k` or `K` | Kilobytes | `512k` |
| `m` or `M` | Megabytes | `256m` |
| `g` or `G` | Gigabytes | `4g` |

### `cpu`

**Type**: `number`
**Range**: 0.1 to 64
**Default**: Unlimited
**Docker Flag**: `--cpus`

Limits the number of CPU cores available to the container. Fractional values are supported.

**Examples**:
```yaml
resourceLimits:
  cpu: 2        # 2 full cores
  cpu: 0.5      # Half a core
  cpu: 1.5      # 1.5 cores
```

---

### `memory`

**Type**: `string`
**Format**: `<number>[k|m|g]`
**Default**: Unlimited
**Docker Flag**: `--memory`

Hard limit on container memory usage. The container will be killed if it exceeds this limit (OOM killed).

**Examples**:
```yaml
resourceLimits:
  memory: "4g"      # 4 gigabytes
  memory: "512m"    # 512 megabytes
  memory: "2048m"   # 2 gigabytes
```

---

### `memoryReservation`

**Type**: `string`
**Format**: `<number>[k|m|g]`
**Default**: None
**Docker Flag**: `--memory-reservation`

Soft limit (reservation) for memory. Docker attempts to keep memory usage under this value but allows bursts up to the `memory` limit.

**Example**:
```yaml
resourceLimits:
  memory: "4g"
  memoryReservation: "2g"  # Reserve 2GB, allow up to 4GB
```

---

### `memorySwap`

**Type**: `string`
**Format**: `<number>[k|m|g]`
**Default**: Same as `memory` (no swap)
**Docker Flag**: `--memory-swap`

Total memory + swap limit. Set equal to `memory` to disable swap.

**Examples**:
```yaml
resourceLimits:
  memory: "4g"
  memorySwap: "8g"    # Allow 4GB swap

  # Disable swap
  memory: "4g"
  memorySwap: "4g"
```

---

### `cpuShares`

**Type**: `number`
**Range**: 2 to 262144
**Default**: 1024
**Docker Flag**: `--cpu-shares`

Relative CPU weight for scheduling priority. Higher values get more CPU time when resources are contested.

**Examples**:
```yaml
resourceLimits:
  cpuShares: 512     # Lower priority (half of default)
  cpuShares: 2048    # Higher priority (double default)
```

---

### `pidsLimit`

**Type**: `number`
**Range**: 1+
**Default**: Unlimited
**Docker Flag**: `--pids-limit`

Maximum number of processes (PIDs) allowed in the container. Prevents fork bombs and runaway process creation.

**Example**:
```yaml
resourceLimits:
  pidsLimit: 1000    # Allow up to 1000 processes
```

### Complete Resource Limits Example

```yaml
workspace:
  container:
    image: "node:20-alpine"
    resourceLimits:
      cpu: 2
      memory: "4g"
      memoryReservation: "2g"
      memorySwap: "8g"
      cpuShares: 1024
      pidsLimit: 1000
```

---

## Environment Variables

### `environment`

**Type**: `Record<string, string>`
**Default**: None
**Required**: No
**Since**: v0.4.0

Environment variables to set inside the container. Values are string key-value pairs.

**Example**:
```yaml
workspace:
  container:
    image: "node:20-alpine"
    environment:
      NODE_ENV: "development"
      NPM_CONFIG_UPDATE_NOTIFIER: "false"
      CI: "true"
      DEBUG: "apex:*"
      TZ: "UTC"
```

### Common Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Node.js environment | `development`, `production` |
| `CI` | CI/CD indicator | `true` |
| `DEBUG` | Debug logging | `*`, `apex:*` |
| `TZ` | Timezone | `UTC`, `America/New_York` |
| `NPM_CONFIG_*` | npm configuration | Various |

**Note**: The `ANTHROPIC_API_KEY` is automatically passed to containers when needed for agent execution.

---

## Volume Mounting

### `volumes`

**Type**: `Record<string, string>`
**Format**: `"host_path": "container_path"`
**Default**: None
**Required**: No
**Since**: v0.4.0

Mount host directories or files into the container. The project workspace is automatically mounted.

**Example**:
```yaml
workspace:
  container:
    image: "node:20-alpine"
    volumes:
      "./data": "/app/data"
      "./config": "/app/config:ro"  # Read-only mount
      "~/.npm": "/root/.npm"        # Cache directory
```

### Volume Mount Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `"./local": "/container"` | Relative host path | Project data |
| `"/absolute": "/container"` | Absolute host path | System files |
| `"~/home": "/container"` | Home directory | User caches |
| `"path": "/path:ro"` | Read-only mount | Config files |

### Default Mounts

APEX automatically mounts:
- Project directory to `/workspace` (or custom `workingDir`)
- `.apex/` directory for configuration access

---

### `workingDir`

**Type**: `string`
**Default**: `/workspace`
**Required**: No
**Since**: v0.4.0

The working directory inside the container where the project is mounted and commands are executed.

**Example**:
```yaml
workspace:
  container:
    image: "node:20-alpine"
    workingDir: "/app"
    volumes:
      ".": "/app"
```

---

## Network Modes

### `networkMode`

**Type**: `"bridge" | "host" | "none" | "container"`
**Default**: `"bridge"`
**Required**: No
**Since**: v0.4.0

Controls the container's network configuration.

### Network Mode Comparison

| Mode | Isolation | Performance | Internet Access | Port Binding | Use Case |
|------|-----------|-------------|-----------------|--------------|----------|
| `bridge` | Full | Good | Yes | Required | Default, most tasks |
| `host` | None | Best | Yes | Automatic | Performance-critical, port access |
| `none` | Complete | N/A | No | None | Airgapped, security-sensitive |
| `container` | Shared | Good | Via target | Via target | Container-to-container communication |

### Network Mode Details

#### `bridge` (Default)

Isolated virtual network with NAT. Containers can access the internet but are isolated from the host network.

```yaml
networkMode: "bridge"
```

#### `host`

Shares the host's network namespace. Best performance but no network isolation.

```yaml
networkMode: "host"
```

**Warning**: Use with caution in production. Reduces security isolation.

#### `none`

No network access. Complete network isolation.

```yaml
networkMode: "none"
```

**Use Case**: Tasks that don't need network access, security-sensitive operations.

#### `container`

Share network namespace with another container (advanced use case).

```yaml
networkMode: "container"
```

---

## Security Options

### `privileged`

**Type**: `boolean`
**Default**: `false`
**Required**: No
**Since**: v0.4.0

Runs the container with extended privileges, giving access to all host devices.

**Warning**: This is a significant security risk. Only enable when absolutely necessary.

```yaml
workspace:
  container:
    image: "docker:dind"
    privileged: true  # Required for Docker-in-Docker
```

---

### `securityOpts`

**Type**: `string[]`
**Default**: None
**Required**: No
**Since**: v0.4.0

Security options for AppArmor, SELinux, and other kernel security modules.

**Examples**:
```yaml
securityOpts:
  - "no-new-privileges:true"    # Prevent privilege escalation
  - "apparmor:unconfined"       # Disable AppArmor (use with caution)
  - "seccomp:unconfined"        # Disable seccomp (use with caution)
```

### Recommended Security Options

| Option | Purpose | Recommendation |
|--------|---------|----------------|
| `no-new-privileges:true` | Prevent privilege escalation | Always enable |
| `apparmor:docker-default` | Default AppArmor profile | Keep default |
| `seccomp:default` | Default seccomp profile | Keep default |

---

### Capabilities

Linux capabilities control fine-grained privileges. APEX supports both adding and dropping capabilities.

### `capDrop`

**Type**: `string[]`
**Default**: None
**Required**: No
**Since**: v0.4.0

Linux capabilities to remove from the container.

**Best Practice**: Drop all capabilities and add only what's needed:

```yaml
capDrop:
  - "ALL"
capAdd:
  - "NET_BIND_SERVICE"  # Only add what's needed
```

### `capAdd`

**Type**: `string[]`
**Default**: None
**Required**: No
**Since**: v0.4.0

Linux capabilities to add to the container.

### Common Capabilities Reference

| Capability | Purpose | Risk |
|------------|---------|------|
| `NET_BIND_SERVICE` | Bind to ports < 1024 | Low |
| `SYS_PTRACE` | Debug processes | Medium |
| `SYS_ADMIN` | Various admin operations | High |
| `NET_ADMIN` | Network configuration | Medium |
| `ALL` | All capabilities | Critical |

**Example - Minimal Capabilities**:
```yaml
workspace:
  container:
    image: "node:20-alpine"
    capDrop:
      - "ALL"
    capAdd:
      - "NET_BIND_SERVICE"
    securityOpts:
      - "no-new-privileges:true"
```

---

### `user`

**Type**: `string`
**Format**: `"uid"`, `"uid:gid"`, or `"username"`
**Default**: Container default (often root)
**Required**: No
**Since**: v0.4.0

The user and optional group to run container processes as.

**Examples**:
```yaml
user: "1000"         # UID only
user: "1000:1000"    # UID:GID
user: "node"         # Username (must exist in image)
user: "root"         # Run as root (less secure)
```

**Best Practice**: Match the container user to your host user to avoid permission issues:

```bash
# Get your UID:GID
id -u  # e.g., 1000
id -g  # e.g., 1000
```

```yaml
user: "1000:1000"
```

---

## Lifecycle & Behavior

### `autoRemove`

**Type**: `boolean`
**Default**: `true`
**Required**: No
**Since**: v0.4.0

Automatically remove the container when it stops. Keeps the system clean.

```yaml
autoRemove: true   # Default, recommended
autoRemove: false  # Keep container for debugging
```

---

### `entrypoint`

**Type**: `string[]`
**Default**: Image default
**Required**: No
**Since**: v0.4.0

Override the container's entrypoint.

```yaml
entrypoint: ["/bin/sh", "-c"]
```

---

### `command`

**Type**: `string[]`
**Default**: Image default
**Required**: No
**Since**: v0.4.0

Override the container's default command.

```yaml
command: ["tail", "-f", "/dev/null"]
```

---

### `labels`

**Type**: `Record<string, string>`
**Default**: APEX management labels
**Required**: No
**Since**: v0.4.0

Additional metadata labels for the container. APEX automatically adds management labels.

```yaml
labels:
  "com.example.project": "my-app"
  "com.example.environment": "development"
```

**Automatic Labels**:
- `apex.managed=true`
- `apex.task.id=<taskId>`
- `apex.project=<projectName>`

---

## Dependency Management

APEX can automatically install project dependencies when starting containers.

### `autoDependencyInstall`

**Type**: `boolean`
**Default**: `true`
**Required**: No
**Since**: v0.4.0

Automatically detect and install project dependencies (npm, yarn, pip, etc.).

```yaml
autoDependencyInstall: true   # Default
autoDependencyInstall: false  # Skip auto-install
```

---

### `customInstallCommand`

**Type**: `string`
**Default**: Auto-detected
**Required**: No
**Since**: v0.4.0

Override the automatic dependency installation command.

**Examples**:
```yaml
# Custom npm command
customInstallCommand: "npm ci --prefer-offline"

# Yarn with specific flags
customInstallCommand: "yarn install --frozen-lockfile --network-timeout 300000"

# Python with pip
customInstallCommand: "pip install -r requirements.txt --no-cache-dir"
```

---

### `useFrozenLockfile`

**Type**: `boolean`
**Default**: `true`
**Required**: No
**Since**: v0.4.0

Use frozen/locked dependency installation for reproducibility.

| Package Manager | Frozen Command |
|-----------------|----------------|
| npm | `npm ci` |
| yarn | `yarn --frozen-lockfile` |
| pnpm | `pnpm install --frozen-lockfile` |

```yaml
useFrozenLockfile: true   # Use npm ci, yarn --frozen-lockfile
useFrozenLockfile: false  # Use npm install, yarn install
```

---

### `installTimeout`

**Type**: `number`
**Unit**: milliseconds
**Default**: 300000 (5 minutes)
**Required**: No
**Since**: v0.4.0

Maximum time to wait for dependency installation.

```yaml
installTimeout: 600000  # 10 minutes for large projects
```

---

### `installRetries`

**Type**: `number`
**Range**: 0+
**Default**: 2
**Required**: No
**Since**: v0.4.0

Number of retry attempts if dependency installation fails.

```yaml
installRetries: 3  # Retry 3 times on failure
```

---

## Per-Task Overrides

Container settings can be overridden on a per-task basis using CLI flags or programmatic configuration.

### CLI Override Flags

| Flag | Maps To | Example |
|------|---------|---------|
| `--workspace-strategy` | `workspace.strategy` | `--workspace-strategy container` |
| `--container-cpu` | `resourceLimits.cpu` | `--container-cpu 4` |
| `--container-memory` | `resourceLimits.memory` | `--container-memory "8g"` |
| `--container-memory-reservation` | `resourceLimits.memoryReservation` | `--container-memory-reservation "4g"` |
| `--container-cpu-shares` | `resourceLimits.cpuShares` | `--container-cpu-shares 2048` |
| `--container-pids-limit` | `resourceLimits.pidsLimit` | `--container-pids-limit 500` |

### CLI Override Examples

```bash
# Use more resources for intensive tasks
apex run "build production bundle" \
  --workspace-strategy container \
  --container-cpu 4 \
  --container-memory "8g"

# Limit resources for lightweight tasks
apex run "update documentation" \
  --container-cpu 0.5 \
  --container-memory "512m"

# Override strategy temporarily
apex run "quick fix" --workspace-strategy none
```

### Programmatic Override (API)

```typescript
import { ApexOrchestrator } from '@apex/orchestrator';

const orchestrator = new ApexOrchestrator(config);

await orchestrator.createTask({
  description: "Build production bundle",
  workspace: {
    strategy: "container",
    container: {
      image: "node:20-alpine",
      resourceLimits: {
        cpu: 4,
        memory: "8g",
        pidsLimit: 2000
      }
    },
    cleanup: true
  }
});
```

### Override Priority Chain

Configuration values are resolved in this order (highest priority first):

```
1. CLI Flags (--container-cpu, etc.)
      ↓
2. Task-level workspace.container
      ↓
3. Workflow-level container defaults
      ↓
4. Project workspace.container (config.yaml)
      ↓
5. Built-in APEX defaults
```

---

## Default Configuration

### WorkspaceDefaults Schema

Project-wide workspace defaults in `.apex/config.yaml`:

```yaml
workspace:
  # Default isolation strategy: none | directory | worktree | container
  defaultStrategy: "container"

  # Cleanup workspace after task completion
  cleanupOnComplete: true

  # Default container settings (applied to all container tasks)
  container:
    image: "node:20-alpine"
    resourceLimits:
      cpu: 2
      memory: "4g"
    networkMode: "bridge"
    autoRemove: true
```

### ContainerDefaults Schema

The `workspace.container` section defines defaults for all container-based tasks:

| Field | Type | Description |
|-------|------|-------------|
| `image` | string | Default image for containers |
| `resourceLimits` | object | Default CPU/memory limits |
| `networkMode` | string | Default network mode |
| `environment` | object | Default environment variables |
| `autoRemove` | boolean | Default auto-remove behavior |
| `installTimeout` | number | Default install timeout |
| `installRetries` | number | Default retry count |

---

## Complete Configuration Examples

### Minimal Configuration

```yaml
workspace:
  defaultStrategy: "container"
  container:
    image: "node:20-alpine"
```

### Production-Ready Configuration

```yaml
workspace:
  defaultStrategy: "container"
  cleanupOnComplete: true
  container:
    image: "node:20-alpine"
    resourceLimits:
      cpu: 2
      memory: "4g"
      memoryReservation: "2g"
      pidsLimit: 1000
    networkMode: "bridge"
    environment:
      NODE_ENV: "development"
      NPM_CONFIG_UPDATE_NOTIFIER: "false"
    autoRemove: true
    autoDependencyInstall: true
    useFrozenLockfile: true
    installTimeout: 300000
    installRetries: 2
    capDrop:
      - "ALL"
    capAdd:
      - "NET_BIND_SERVICE"
    securityOpts:
      - "no-new-privileges:true"
```

### Custom Dockerfile Configuration

```yaml
workspace:
  defaultStrategy: "container"
  container:
    dockerfile: ".apex/Dockerfile"
    buildContext: "."
    imageTag: "my-project:apex"
    resourceLimits:
      cpu: 4
      memory: "8g"
    volumes:
      "./data": "/app/data"
      "~/.npm": "/root/.npm"
    environment:
      NODE_ENV: "development"
```

### High-Security Configuration

```yaml
workspace:
  defaultStrategy: "container"
  container:
    image: "node:20-alpine"
    networkMode: "none"
    user: "1000:1000"
    privileged: false
    capDrop:
      - "ALL"
    securityOpts:
      - "no-new-privileges:true"
    resourceLimits:
      cpu: 1
      memory: "2g"
      pidsLimit: 100
```

---

## Related Documentation

- [Container Isolation Guide](./container-isolation.md) - Concepts, setup, and best practices
- [Configuration Reference](./configuration.md) - General APEX configuration
- [Workflows](./workflows.md) - Workflow definition and container integration
- [API Reference](./api-reference.md) - Programmatic container management
