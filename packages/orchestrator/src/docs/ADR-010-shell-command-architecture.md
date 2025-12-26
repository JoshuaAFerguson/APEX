# ADR-010: Shell Command for Interactive Container Intervention

## Status

Proposed

## Context

APEX v0.4.0 introduces container isolation for task execution via the `WorkspaceManager` and `ContainerManager` classes. When debugging or manually intervening in a running task, users need the ability to attach an interactive shell to the task's container.

This ADR describes the technical architecture for implementing the `apex shell <taskId>` CLI command that enables manual container intervention.

## Decision

### 1. Command Interface

The new `shell` command will be added to the CLI with the following interface:

```
apex shell <taskId>

Options:
  -s, --shell <shell>   Shell to use (default: /bin/sh)
  -u, --user <user>     User to run shell as (default: container's configured user)
  -w, --workdir <path>  Working directory inside container (default: /workspace)
  --help                Show help for shell command

Examples:
  apex shell abc123xyz         # Attach shell to task abc123xyz's container
  apex shell abc123 -s bash    # Use bash instead of default sh
  apex shell abc123 -u root    # Attach as root user
```

### 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Layer                                │
│  packages/cli/src/index.ts                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  'shell' command handler                                   │  │
│  │  - Validates taskId                                       │  │
│  │  - Calls orchestrator.getTask(taskId)                     │  │
│  │  - Validates workspace.strategy === 'container'          │  │
│  │  - Retrieves container info from workspace manager       │  │
│  │  - Spawns interactive docker/podman exec                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestrator Layer                           │
│  packages/orchestrator/src/index.ts                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  getTask(taskId): Task                                     │  │
│  │  getWorkspaceManager(): WorkspaceManager                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  packages/orchestrator/src/workspace-manager.ts                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  getWorkspace(taskId): WorkspaceInfo                       │  │
│  │  getContainerRuntime(): ContainerRuntimeType              │  │
│  │  getContainerManager(): ContainerManager                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Layer                                │
│  packages/core/src/container-manager.ts                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  getContainerInfo(containerId): ContainerInfo             │  │
│  │  generateContainerName(taskId): string                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  packages/core/src/container-runtime.ts                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  getBestRuntime(): ContainerRuntimeType                   │  │
│  │  Returns: 'docker' | 'podman' | 'none'                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Implementation Details

#### 3.1 CLI Command Handler (`packages/cli/src/index.ts`)

```typescript
{
  name: 'shell',
  aliases: ['sh'],
  description: 'Attach interactive shell to a running task container',
  usage: '/shell <task_id> [--shell <shell>] [--user <user>] [--workdir <path>]',
  handler: async (ctx, args) => {
    // 1. Validate initialization
    if (!ctx.initialized || !ctx.orchestrator) {
      console.log(chalk.red('APEX not initialized. Run /init first.'));
      return;
    }

    // 2. Parse arguments
    const taskId = args[0];
    if (!taskId) {
      console.log(chalk.red('Usage: /shell <task_id>'));
      return;
    }

    let shell = '/bin/sh';
    let user: string | undefined;
    let workdir: string | undefined;

    for (let i = 1; i < args.length; i++) {
      if ((args[i] === '-s' || args[i] === '--shell') && args[i + 1]) {
        shell = args[++i];
      } else if ((args[i] === '-u' || args[i] === '--user') && args[i + 1]) {
        user = args[++i];
      } else if ((args[i] === '-w' || args[i] === '--workdir') && args[i + 1]) {
        workdir = args[++i];
      }
    }

    // 3. Get task and validate
    const task = await ctx.orchestrator.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      return;
    }

    // 4. Check for container isolation
    if (!task.workspace || task.workspace.strategy !== 'container') {
      console.log(chalk.red('❌ Task is not using container isolation.'));
      console.log(chalk.gray('   The shell command only works with container-isolated tasks.'));
      console.log(chalk.gray(`   Current workspace strategy: ${task.workspace?.strategy || 'none'}`));
      return;
    }

    // 5. Get container info and runtime
    const containerName = `apex-task-${taskId}`;
    const runtime = ctx.orchestrator.getWorkspaceManager().getContainerRuntime();

    if (!runtime || runtime === 'none') {
      console.log(chalk.red('❌ No container runtime available.'));
      return;
    }

    // 6. Check container is running
    const containerManager = ctx.orchestrator.getWorkspaceManager().getContainerManager();
    const containerInfo = await containerManager.getContainerInfo(containerName);

    if (!containerInfo || containerInfo.status !== 'running') {
      console.log(chalk.red(`❌ Container is not running.`));
      console.log(chalk.gray(`   Container status: ${containerInfo?.status || 'not found'}`));
      return;
    }

    // 7. Build and execute interactive shell
    console.log(chalk.cyan(`🐚 Attaching shell to container ${containerName}...`));
    console.log(chalk.gray(`   Runtime: ${runtime}`));
    console.log(chalk.gray(`   Shell: ${shell}`));
    console.log(chalk.gray('   Press Ctrl+D or type exit to detach.\n'));

    const execArgs = ['exec', '-it'];
    if (user) execArgs.push('--user', user);
    if (workdir) execArgs.push('--workdir', workdir);
    execArgs.push(containerName, shell);

    // Spawn interactive process
    const { spawnSync } = require('child_process');
    const result = spawnSync(runtime, execArgs, {
      stdio: 'inherit',
      shell: false,
    });

    if (result.error) {
      console.log(chalk.red(`\n❌ Shell session failed: ${result.error.message}`));
    } else if (result.status !== 0) {
      console.log(chalk.yellow(`\nShell session ended with exit code: ${result.status}`));
    } else {
      console.log(chalk.green('\n✅ Shell session ended.'));
    }
  },
}
```

#### 3.2 Orchestrator Extension (`packages/orchestrator/src/index.ts`)

Add a getter method to expose the WorkspaceManager:

```typescript
/**
 * Get the workspace manager instance
 */
getWorkspaceManager(): WorkspaceManager {
  return this.workspaceManager;
}
```

#### 3.3 Container Name Convention

APEX uses a consistent naming convention for task containers:
- Pattern: `apex-task-{taskId}`
- Example: `apex-task-abc123xyz`

This is already implemented in `ContainerManager.generateContainerName()`.

### 4. Error Handling

The shell command handles the following error scenarios:

| Scenario | Error Message | User Guidance |
|----------|---------------|---------------|
| APEX not initialized | "APEX not initialized. Run /init first." | Initialize APEX |
| Task ID missing | "Usage: /shell <task_id>" | Provide task ID |
| Task not found | "Task not found: {taskId}" | Check task ID |
| Not container strategy | "Task is not using container isolation." | Use container strategy |
| No container runtime | "No container runtime available." | Install Docker/Podman |
| Container not running | "Container is not running." | Start task first |
| Shell execution fails | "Shell session failed: {error}" | Debug issue |

### 5. Security Considerations

1. **User Context**: The `--user` flag allows specifying the user context within the container. By default, it uses the container's configured user.

2. **Interactive Mode**: The command uses `-it` flags (`--interactive --tty`) which requires a proper TTY. This prevents non-interactive abuse.

3. **Container Isolation**: The shell only attaches to existing containers - it cannot create new containers or modify container configurations.

4. **Escape Prevention**: Shell arguments are not interpolated - the runtime binary receives exact arguments.

### 6. Testing Strategy

1. **Unit Tests**: Test argument parsing, validation logic, and error handling in isolation.

2. **Integration Tests**: Test with mock container runtime to verify command construction.

3. **Manual Testing**: Verify interactive shell attachment works with both Docker and Podman.

### 7. Future Enhancements

1. **Shell Detection**: Auto-detect available shells (bash, zsh, sh) in the container.
2. **Session Recording**: Optional recording of shell sessions for audit.
3. **Multi-Container Support**: For tasks with multiple containers (future).
4. **Web Terminal**: WebSocket-based shell access via the Web UI.

## Consequences

### Positive

- Enables manual debugging of containerized tasks
- Supports both Docker and Podman runtimes
- Consistent with existing CLI command patterns
- Clear error messages guide users to resolution

### Negative

- Only works with container-isolated tasks (by design)
- Requires TTY (not suitable for scripted automation)
- Cannot attach to completed/stopped containers

### Neutral

- Relies on existing container infrastructure
- Uses synchronous spawn (blocks CLI until shell exits)

## Files to Modify

1. `packages/cli/src/index.ts` - Add 'shell' command
2. `packages/orchestrator/src/index.ts` - Add `getWorkspaceManager()` getter
3. `packages/cli/README.md` - Document new command

## Implementation Notes

### Container Naming

The container name follows the pattern established in `ContainerManager`:
```typescript
// packages/core/src/container-manager.ts
generateContainerName(taskId: string, config?: Partial<ContainerNamingConfig>): string {
  const namingConfig = { ...this.defaultNamingConfig, ...config };
  const parts = [namingConfig.prefix]; // 'apex'

  if (namingConfig.includeTaskId) {
    const sanitizedTaskId = taskId.replace(/[^a-zA-Z0-9_.-]/g, '_');
    parts.push(sanitizedTaskId);
  }

  return parts.join(namingConfig.separator); // 'apex-{taskId}'
}
```

### Runtime Detection

The runtime is detected using `ContainerRuntime.getBestRuntime()`:
```typescript
// packages/core/src/container-runtime.ts
async getBestRuntime(): Promise<ContainerRuntimeType> {
  // Returns 'docker', 'podman', or 'none'
}
```

### Interactive Shell Execution

Using `spawnSync` with `stdio: 'inherit'` ensures:
- Full TTY passthrough
- Proper signal handling (Ctrl+C, Ctrl+D)
- Synchronized execution (CLI waits for shell to exit)

```typescript
const result = spawnSync(runtime, execArgs, {
  stdio: 'inherit',
  shell: false,
});
```

## References

- [Docker exec documentation](https://docs.docker.com/engine/reference/commandline/exec/)
- [Podman exec documentation](https://docs.podman.io/en/latest/markdown/podman-exec.1.html)
- ADR-001: Container Workspace Isolation (v0.4.0 design)
- `packages/core/src/container-manager.ts` - Container management implementation
- `packages/orchestrator/src/workspace-manager.ts` - Workspace management implementation
