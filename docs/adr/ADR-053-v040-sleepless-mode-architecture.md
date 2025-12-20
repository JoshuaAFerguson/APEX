# ADR-053: v0.4.0 Sleepless Mode & Autonomy - Technical Architecture

## Status
Proposed

## Date
2024-12-20

## Context

APEX v0.4.0 "Sleepless Mode & Autonomy" aims to enable 24/7 autonomous operation with intelligent scheduling, session recovery, workspace isolation, and enhanced task management. This release builds upon the existing daemon infrastructure (DaemonManager, DaemonRunner from v0.3.0) and extends APEX to operate as a fully autonomous development assistant.

This ADR provides the comprehensive technical architecture for v0.4.0, covering all major subsystems.

## Goals

1. **24/7 Autonomous Operation** - APEX runs continuously as a background daemon
2. **Intelligent Scheduling** - Day/night modes with configurable thresholds
3. **Session Recovery** - Auto-resume when context window expires or rate limits hit
4. **Workspace Isolation** - Container and worktree-based isolation for parallel execution
5. **Enhanced Task Commands** - Rich inspection, iteration, and git integration commands
6. **Idle Processing** - Auto-generate improvement tasks during idle periods

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APEX v0.4.0 Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   CLI Layer     │  │   API Layer     │  │   Web UI        │             │
│  │  @apexcli/cli   │  │  @apexcli/api   │  │  @apex/web-ui   │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    @apexcli/orchestrator                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  ││
│  │  │ ApexOrch-    │  │ Session      │  │ Task         │                  ││
│  │  │ estrator     │  │ Manager      │  │ Store        │                  ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  ││
│  │         │                 │                 │                           ││
│  │  ┌──────┴─────────────────┴─────────────────┴──────┐                   ││
│  │  │                   NEW IN v0.4.0                 │                   ││
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │                   ││
│  │  │  │ Usage      │  │ Session    │  │ Isolation  │ │                   ││
│  │  │  │ Manager    │  │ Recovery   │  │ Manager    │ │                   ││
│  │  │  └────────────┘  └────────────┘  └────────────┘ │                   ││
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │                   ││
│  │  │  │ Idle       │  │ Thought    │  │ Task       │ │                   ││
│  │  │  │ Scheduler  │  │ Capture    │  │ Inspector  │ │                   ││
│  │  │  └────────────┘  └────────────┘  └────────────┘ │                   ││
│  │  └─────────────────────────────────────────────────┘                   ││
│  │                                                                         ││
│  │  ┌──────────────┐  ┌──────────────┐                                    ││
│  │  │ Daemon       │  │ Daemon       │  (Already implemented)             ││
│  │  │ Manager      │  │ Runner       │                                    ││
│  │  └──────────────┘  └──────────────┘                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Daemon Mode Enhancements

### 1.1 Current State (v0.3.0)

The daemon infrastructure is already implemented:
- `DaemonManager` (packages/orchestrator/src/daemon.ts) - PID file management, start/stop
- `DaemonRunner` (packages/orchestrator/src/runner.ts) - Task polling and execution
- `daemon-entry.ts` - Entry point for forked daemon process
- CLI commands: `/daemon start|stop|status`

### 1.2 Service Installation (New)

Add system service registration for systemd (Linux) and launchd (macOS):

```typescript
// packages/orchestrator/src/service-installer.ts

export interface ServiceInstallerOptions {
  projectPath: string;
  serviceName?: string;  // Default: 'apex-daemon'
  autoStart?: boolean;   // Start on boot
  user?: string;         // Run as specific user
}

export class ServiceInstaller {
  constructor(options: ServiceInstallerOptions);

  /** Install as system service */
  async install(): Promise<void>;

  /** Uninstall system service */
  async uninstall(): Promise<void>;

  /** Check if installed as service */
  async isInstalled(): Promise<boolean>;

  /** Get service status */
  async getStatus(): Promise<ServiceStatus>;
}

export type ServiceStatus =
  | 'not-installed'
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'failed';
```

#### Linux (systemd)

Generate `/etc/systemd/system/apex-daemon.service`:

```ini
[Unit]
Description=APEX Daemon - Autonomous Development Agent
After=network.target

[Service]
Type=simple
User=<user>
WorkingDirectory=<projectPath>
ExecStart=/usr/bin/node <path-to-daemon-entry>
Restart=on-failure
RestartSec=5
Environment=APEX_PROJECT_PATH=<projectPath>
Environment=APEX_DAEMON_MODE=1

[Install]
WantedBy=multi-user.target
```

#### macOS (launchd)

Generate `~/Library/LaunchAgents/com.apex.daemon.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.apex.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string><path-to-daemon-entry></string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>APEX_PROJECT_PATH</key>
        <string><projectPath></string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

### 1.3 CLI Commands

```bash
apex install-service [--auto-start] [--user <user>]   # Install as system service
apex uninstall-service                                  # Remove system service
apex daemon restart                                     # Restart daemon
apex daemon logs [--follow] [--lines <n>]               # View daemon logs
```

### 1.4 Health Monitoring

Extend `DaemonRunner` with watchdog capabilities:

```typescript
// packages/orchestrator/src/runner.ts (extended)

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
}

export class DaemonRunner {
  // ... existing methods ...

  /** Perform health checks */
  async checkHealth(): Promise<HealthCheck[]>;

  /** Self-healing: restart components */
  private async performRecovery(failedChecks: HealthCheck[]): Promise<void>;
}
```

Health checks:
1. **SQLite connection** - Can read/write to TaskStore
2. **API connectivity** - Can reach Claude API (test with minimal request)
3. **Disk space** - Sufficient space for logs and database
4. **Memory usage** - Below configurable threshold

---

## 2. Time-Based Usage Management

### 2.1 Usage Manager

```typescript
// packages/orchestrator/src/usage-manager.ts

export interface UsageManagerOptions {
  projectPath: string;
  config: UsageConfig;
}

export interface UsageConfig {
  /** Day mode configuration */
  dayMode: {
    startHour: number;    // 0-23, default: 8
    endHour: number;      // 0-23, default: 18
    threshold: number;    // 0-1, default: 0.90 (90%)
  };

  /** Night mode configuration */
  nightMode: {
    threshold: number;    // 0-1, default: 0.96 (96%)
  };

  /** Weekly limits */
  weeklyBudget?: number;  // Max cost per week

  /** Timezone for day/night calculation */
  timezone?: string;      // Default: system timezone
}

export interface UsageStatus {
  currentMode: 'day' | 'night';
  threshold: number;
  currentUsage: number;  // 0-1 percentage
  canStartNewTask: boolean;
  nextModeChange: Date;
  dailySpent: number;
  weeklySpent: number;
  budgetRemaining: {
    daily: number;
    weekly: number;
  };
}

export class UsageManager {
  constructor(options: UsageManagerOptions);

  /** Get current usage status */
  getStatus(): UsageStatus;

  /** Check if we can start a new task */
  canAcceptTask(): boolean;

  /** Record usage from completed task */
  recordUsage(taskId: string, cost: number, tokens: number): void;

  /** Get usage history */
  getHistory(days: number): DailyUsage[];

  /** Wait until we can accept new tasks */
  waitForCapacity(): Promise<void>;
}
```

### 2.2 Database Schema

```sql
-- New table for usage tracking
CREATE TABLE IF NOT EXISTS usage_daily (
  date TEXT PRIMARY KEY,        -- YYYY-MM-DD
  total_cost REAL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  day_hours_cost REAL DEFAULT 0,
  night_hours_cost REAL DEFAULT 0
);

CREATE INDEX idx_usage_date ON usage_daily(date);
```

### 2.3 Configuration

```yaml
# .apex/config.yaml (extended)

usage:
  dayMode:
    startHour: 8        # 8 AM
    endHour: 18         # 6 PM
    threshold: 0.90     # 90% - more conservative during work hours
  nightMode:
    threshold: 0.96     # 96% - more aggressive overnight
  weeklyBudget: 500     # $500/week cap
  timezone: "America/New_York"
```

### 2.4 Integration with DaemonRunner

```typescript
// Modify DaemonRunner.poll()
private async poll(): Promise<void> {
  // Check usage limits before accepting tasks
  if (!this.usageManager.canAcceptTask()) {
    this.log('info', 'Usage threshold reached, pausing new tasks');
    await this.usageManager.waitForCapacity();
  }

  // ... existing poll logic ...
}
```

---

## 3. Session Recovery & Continuity

### 3.1 Session Recovery Manager

```typescript
// packages/orchestrator/src/session-recovery.ts

export interface SessionRecoveryOptions {
  projectPath: string;
  maxResumeAttempts?: number;     // Default: 3
  resumeDelayMs?: number;         // Default: 1000
  summarizeContext?: boolean;     // Default: true
}

export interface RecoveryState {
  taskId: string;
  stage: string;
  stageIndex: number;
  conversationSummary?: string;
  lastCheckpoint: Date;
  resumeAttempts: number;
}

export class SessionRecoveryManager {
  constructor(options: SessionRecoveryOptions);

  /** Save recovery state before session ends */
  async saveRecoveryState(
    taskId: string,
    state: Partial<RecoveryState>
  ): Promise<void>;

  /** Resume task from saved state */
  async resumeTask(taskId: string): Promise<void>;

  /** Generate context summary for injection */
  async generateContextSummary(taskId: string): Promise<string>;

  /** Check if task can be auto-resumed */
  canAutoResume(taskId: string): Promise<boolean>;
}
```

### 3.2 Context Summarization

When a session is about to expire (context window full), generate a summary:

```typescript
// Generate summary prompt
const summarizationPrompt = `
Summarize the current state of this task for session continuation:

Task: ${task.description}
Current Stage: ${task.currentStage}
Completed Stages: ${completedStages.join(', ')}

Recent conversation (last 10 messages):
${recentMessages}

Output a concise summary (max 2000 tokens) covering:
1. What has been accomplished
2. Current state/progress
3. What remains to be done
4. Any important context or decisions made
`;
```

### 3.3 Resume Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Session Resume Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Session      │                                               │
│  │ Expires      │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐      ┌─────────────────┐                     │
│  │ Generate     │─────▶│ Save Checkpoint │                     │
│  │ Summary      │      │ with Summary    │                     │
│  └──────────────┘      └────────┬────────┘                     │
│                                 │                               │
│                                 ▼                               │
│  ┌─────────────────────────────────────────────┐               │
│  │ Resume Delay (configurable, default: 1s)   │               │
│  └─────────────────────────────────────────────┘               │
│                                 │                               │
│                                 ▼                               │
│  ┌──────────────┐      ┌─────────────────┐                     │
│  │ Create New   │◀─────│ Inject Summary  │                     │
│  │ Session      │      │ as Context      │                     │
│  └──────┬───────┘      └─────────────────┘                     │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                               │
│  │ Continue     │                                               │
│  │ from Stage   │                                               │
│  └──────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Orchestrator Integration

```typescript
// packages/orchestrator/src/index.ts (extended)

export class ApexOrchestrator {
  private recoveryManager: SessionRecoveryManager;

  // Called when Claude SDK throws context limit error
  private async handleContextLimitError(
    taskId: string,
    error: Error
  ): Promise<void> {
    this.emit('task:paused', await this.store.getTask(taskId), 'context_limit');

    // Save recovery state
    await this.recoveryManager.saveRecoveryState(taskId, {
      stage: task.currentStage,
      stageIndex: currentStageIndex,
    });

    // Check if we can auto-resume
    if (await this.recoveryManager.canAutoResume(taskId)) {
      // Schedule resume after delay
      setTimeout(async () => {
        await this.resumeFromCheckpoint(taskId);
      }, this.recoveryManager.resumeDelayMs);
    }
  }
}
```

---

## 4. Workspace Isolation

### 4.1 Isolation Manager

```typescript
// packages/orchestrator/src/isolation-manager.ts

export type IsolationMode =
  | 'shared'       // Current behavior - single workspace
  | 'worktree'     // Git worktree per task
  | 'container'    // Docker/Podman container
  | 'full';        // Container + worktree

export interface IsolationOptions {
  mode: IsolationMode;
  containerImage?: string;       // For container mode
  resourceLimits?: {
    cpuLimit?: string;           // e.g., '2' (2 cores)
    memoryLimit?: string;        // e.g., '4g'
  };
  cleanupAfter?: 'merge' | 'cancel' | 'never';
}

export interface IsolatedWorkspace {
  taskId: string;
  mode: IsolationMode;
  path: string;                  // Workspace path
  containerId?: string;          // If container mode
  worktreePath?: string;         // If worktree mode
  createdAt: Date;
}

export class IsolationManager {
  constructor(projectPath: string);

  /** Create isolated workspace for a task */
  async createWorkspace(
    taskId: string,
    options: IsolationOptions
  ): Promise<IsolatedWorkspace>;

  /** Execute command in isolated workspace */
  async execInWorkspace(
    workspace: IsolatedWorkspace,
    command: string
  ): Promise<ExecResult>;

  /** Cleanup workspace after task completion */
  async cleanupWorkspace(workspace: IsolatedWorkspace): Promise<void>;

  /** Get shell access to workspace */
  async getShellAccess(workspace: IsolatedWorkspace): Promise<void>;

  /** List all active workspaces */
  async listWorkspaces(): Promise<IsolatedWorkspace[]>;
}
```

### 4.2 Git Worktree Implementation

```typescript
// packages/orchestrator/src/worktree-manager.ts

export class WorktreeManager {
  constructor(projectPath: string);

  /** Create a new worktree for a task */
  async createWorktree(taskId: string, branchName: string): Promise<string> {
    const worktreePath = join(this.projectPath, '.apex', 'worktrees', taskId);

    await execAsync(`git worktree add "${worktreePath}" -b "${branchName}"`);

    return worktreePath;
  }

  /** Remove worktree after task completion */
  async removeWorktree(taskId: string): Promise<void> {
    const worktreePath = join(this.projectPath, '.apex', 'worktrees', taskId);

    await execAsync(`git worktree remove "${worktreePath}" --force`);
  }

  /** List all worktrees */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    const { stdout } = await execAsync('git worktree list --porcelain');
    return this.parseWorktreeList(stdout);
  }
}
```

### 4.3 Container Implementation

```typescript
// packages/orchestrator/src/container-manager.ts

export class ContainerManager {
  private runtime: 'docker' | 'podman';

  constructor(projectPath: string);

  /** Create container for task execution */
  async createContainer(
    taskId: string,
    options: ContainerOptions
  ): Promise<string> {
    const image = options.image || await this.buildDefaultImage();

    const containerId = await this.runContainer({
      image,
      name: `apex-task-${taskId}`,
      mounts: [
        { src: this.projectPath, dst: '/workspace', mode: 'rw' }
      ],
      env: {
        APEX_TASK_ID: taskId,
        APEX_PROJECT_PATH: '/workspace',
      },
      limits: options.resourceLimits,
    });

    // Install project dependencies
    await this.execInContainer(containerId, 'npm install');

    return containerId;
  }

  /** Execute command in container */
  async execInContainer(containerId: string, command: string): Promise<ExecResult>;

  /** Stop and remove container */
  async removeContainer(containerId: string): Promise<void>;
}
```

### 4.4 Configuration

```yaml
# .apex/config.yaml (extended)

isolation:
  defaultMode: shared    # shared | worktree | container | full
  container:
    image: "apex/sandbox:latest"
    dockerfile: ".apex/Dockerfile"  # Optional custom dockerfile
    resourceLimits:
      cpu: "2"
      memory: "4g"
  worktree:
    basePath: ".apex/worktrees"
  cleanup: merge         # merge | cancel | never
```

### 4.5 Directory Structure

```
project/
├── .apex/
│   ├── worktrees/              # Git worktrees for parallel tasks
│   │   ├── task-abc123/
│   │   └── task-def456/
│   ├── Dockerfile              # Custom sandbox image
│   └── container-cache/        # Container layer cache
└── ...
```

---

## 5. Task Interaction Commands

### 5.1 New CLI Commands

#### Iterate Command

```bash
apex iterate <taskId>                    # Interactive refinement prompt
apex iterate <taskId> "add error handling"  # Direct feedback
apex iterate <taskId> --redo              # Redo entire task
```

```typescript
// packages/cli/src/handlers/iterate-handlers.ts

export async function handleIterate(
  ctx: ApexContext,
  taskId: string,
  feedback?: string
): Promise<void> {
  const task = await ctx.orchestrator.getTask(taskId);

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Create child iteration task
  const iterationTask = await ctx.orchestrator.createTask({
    description: `Iteration on ${taskId}: ${feedback || 'refinement'}`,
    parentTaskId: task.parentTaskId || taskId,
    workflow: 'iteration',  // Special iteration workflow
    priority: 'high',
  });

  // Include original task context
  await ctx.orchestrator.setTaskContext(iterationTask.id, {
    originalTaskId: taskId,
    feedback,
    previousOutput: await getTaskOutput(taskId),
  });

  await ctx.orchestrator.executeTask(iterationTask.id);
}
```

#### Inspect Command

```bash
apex inspect <taskId>                    # Overview
apex inspect <taskId> --files            # List files
apex inspect <taskId> --file <path>      # View file content
apex inspect <taskId> --docs             # View documentation
apex inspect <taskId> --timeline         # Execution timeline
apex inspect <taskId> --json             # JSON output
```

```typescript
// packages/orchestrator/src/task-inspector.ts

export interface InspectResult {
  task: Task;
  files: FileChange[];
  timeline: TimelineEntry[];
  documentation?: string;
  metrics: TaskMetrics;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

export interface TimelineEntry {
  timestamp: Date;
  event: string;
  agent?: string;
  stage?: string;
  duration?: number;
}

export class TaskInspector {
  constructor(store: TaskStore);

  /** Get comprehensive inspection result */
  async inspect(taskId: string): Promise<InspectResult>;

  /** Get file changes for task */
  async getFileChanges(taskId: string): Promise<FileChange[]>;

  /** Get execution timeline */
  async getTimeline(taskId: string): Promise<TimelineEntry[]>;

  /** Get generated documentation */
  async getDocumentation(taskId: string): Promise<string | null>;
}
```

#### Diff Command

```bash
apex diff <taskId>                       # All changes
apex diff <taskId> --stat                # Summary statistics
apex diff <taskId> --file <path>         # Specific file diff
apex diff <taskId> --staged              # What will be committed
```

#### Git Integration Commands

```bash
apex push <taskId>                       # Push task branch
apex merge <taskId>                      # Merge to current branch
apex merge <taskId> --squash             # Squash merge
apex checkout <taskId>                   # Switch to task branch/worktree
```

### 5.2 Database Schema Extensions

```sql
-- Iteration tracking
CREATE TABLE IF NOT EXISTS task_iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  iteration_number INTEGER NOT NULL,
  parent_iteration_id INTEGER,
  feedback TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- File changes tracking
CREATE TABLE IF NOT EXISTS task_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL,  -- added, modified, deleted
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_file_changes_task ON task_file_changes(task_id);
```

---

## 6. Task Auto-Generation (Idle Processing)

### 6.1 Idle Scheduler

```typescript
// packages/orchestrator/src/idle-scheduler.ts

export interface IdleConfig {
  enabled: boolean;
  strategies: IdleStrategy[];
  minIdleTime: number;         // Minimum idle time before generating (ms)
  maxTasksPerDay: number;      // Cap on auto-generated tasks
  priority: TaskPriority;      // Priority for generated tasks (default: low)
}

export interface IdleStrategy {
  name: string;
  weight: number;              // 0-1, relative probability
  analyzer: ProjectAnalyzer;
}

export interface IdleTask {
  description: string;
  category: 'maintenance' | 'refactoring' | 'documentation' | 'tests';
  priority: TaskPriority;
  estimatedEffort: 'small' | 'medium' | 'large';
  rationale: string;
}

export class IdleScheduler {
  constructor(orchestrator: ApexOrchestrator, config: IdleConfig);

  /** Generate improvement tasks based on codebase analysis */
  async generateIdleTasks(): Promise<IdleTask[]>;

  /** Queue an idle task for execution */
  async queueIdleTask(task: IdleTask): Promise<string>;

  /** Get count of idle tasks generated today */
  getIdleTaskCount(): number;

  /** Check if idle task generation is allowed */
  canGenerateIdleTask(): boolean;
}
```

### 6.2 Project Analyzers

```typescript
// packages/orchestrator/src/analyzers/

// Maintenance analyzer - find outdated dependencies, security issues
export class MaintenanceAnalyzer implements ProjectAnalyzer {
  async analyze(projectPath: string): Promise<IdleTask[]> {
    const tasks: IdleTask[] = [];

    // Check for outdated dependencies
    const outdated = await this.checkOutdatedDeps();
    if (outdated.length > 0) {
      tasks.push({
        description: `Update ${outdated.length} outdated dependencies`,
        category: 'maintenance',
        priority: 'low',
        estimatedEffort: 'small',
        rationale: `Found outdated packages: ${outdated.slice(0, 3).join(', ')}...`,
      });
    }

    // Check for security vulnerabilities
    const vulns = await this.checkVulnerabilities();
    // ...

    return tasks;
  }
}

// Refactoring analyzer - find code smells, complexity issues
export class RefactoringAnalyzer implements ProjectAnalyzer { ... }

// Documentation analyzer - find undocumented code
export class DocumentationAnalyzer implements ProjectAnalyzer { ... }

// Test coverage analyzer - find untested code
export class TestAnalyzer implements ProjectAnalyzer { ... }
```

### 6.3 Configuration

```yaml
# .apex/config.yaml (extended)

idleProcessing:
  enabled: true
  strategies:
    maintenance: 0.40      # 40% weight
    refactoring: 0.30      # 30% weight
    documentation: 0.20    # 20% weight
    tests: 0.10            # 10% weight
  minIdleTime: 300000      # 5 minutes before generating
  maxTasksPerDay: 5        # Max 5 auto-generated tasks per day
  priority: low
```

---

## 7. Thought Capture Mode

### 7.1 Thought Manager

```typescript
// packages/orchestrator/src/thought-manager.ts

export interface Thought {
  id: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  promotedToTaskId?: string;
  expiresAt?: Date;
}

export class ThoughtManager {
  constructor(projectPath: string);

  /** Capture a quick thought */
  async capture(content: string, options?: {
    category?: string;
    tags?: string[];
    expiresIn?: number;  // Days until expiration
  }): Promise<Thought>;

  /** Promote thought to full task */
  async promoteToTask(thoughtId: string): Promise<Task>;

  /** List thoughts with optional filters */
  async list(options?: {
    category?: string;
    search?: string;
    includeExpired?: boolean;
  }): Promise<Thought[]>;

  /** Delete expired thoughts */
  async cleanup(): Promise<number>;
}
```

### 7.2 Git Integration

Thoughts are stored in a dedicated branch:

```bash
apex think "Add caching to API endpoints"
# Creates commit on apex/ideas branch with thought content
```

```typescript
async capture(content: string): Promise<Thought> {
  const thoughtId = generateThoughtId();
  const thought: Thought = {
    id: thoughtId,
    content,
    createdAt: new Date(),
  };

  // Store in database
  await this.store.createThought(thought);

  // Commit to ideas branch
  await this.commitToIdeasBranch(thought);

  return thought;
}

private async commitToIdeasBranch(thought: Thought): Promise<void> {
  const currentBranch = await this.getCurrentBranch();

  // Switch to or create ideas branch
  await execAsync('git checkout apex/ideas 2>/dev/null || git checkout -b apex/ideas');

  // Create thought file
  const thoughtFile = `.apex/thoughts/${thought.id}.md`;
  await fs.writeFile(thoughtFile, `# ${thought.content}\n\nCreated: ${thought.createdAt.toISOString()}\n`);

  // Commit
  await execAsync(`git add "${thoughtFile}"`);
  await execAsync(`git commit -m "thought: ${thought.content.substring(0, 50)}"`);

  // Return to original branch
  await execAsync(`git checkout "${currentBranch}"`);
}
```

### 7.3 CLI Commands

```bash
apex think "idea content"              # Capture thought
apex thoughts                          # List thoughts
apex thoughts --search "cache"         # Search thoughts
apex thoughts promote <thoughtId>      # Promote to task
apex thoughts delete <thoughtId>       # Delete thought
apex thoughts cleanup                  # Remove expired
```

---

## 8. Task Lifecycle Improvements

### 8.1 Soft Delete (Trash)

```typescript
// packages/orchestrator/src/trash-manager.ts

export interface TrashedTask {
  task: Task;
  trashedAt: Date;
  trashedBy?: string;
  expiresAt: Date;  // Auto-delete after 30 days
}

export class TrashManager {
  constructor(store: TaskStore);

  /** Move task to trash */
  async trash(taskId: string): Promise<void>;

  /** Restore task from trash */
  async restore(taskId: string): Promise<Task>;

  /** List trashed tasks */
  async list(): Promise<TrashedTask[]>;

  /** Permanently delete all trashed tasks */
  async empty(): Promise<number>;

  /** Auto-cleanup expired trash */
  async cleanup(): Promise<number>;
}
```

### 8.2 Database Schema

```sql
-- Soft delete support
ALTER TABLE tasks ADD COLUMN trashed_at TEXT;
ALTER TABLE tasks ADD COLUMN trash_expires_at TEXT;

CREATE INDEX idx_tasks_trashed ON tasks(trashed_at) WHERE trashed_at IS NOT NULL;

-- Thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT,  -- JSON array
  created_at TEXT NOT NULL,
  promoted_to_task_id TEXT,
  expires_at TEXT,
  FOREIGN KEY (promoted_to_task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_thoughts_created ON thoughts(created_at);
```

### 8.3 CLI Commands

```bash
apex trash <taskId>                    # Move to trash
apex restore <taskId>                  # Restore from trash
apex trash list                        # List trashed tasks
apex trash empty                       # Permanently delete all
```

---

## 9. Configuration Schema

### 9.1 Extended ApexConfig

```typescript
// packages/core/src/types.ts (extended)

export const UsageConfigSchema = z.object({
  dayMode: z.object({
    startHour: z.number().min(0).max(23).default(8),
    endHour: z.number().min(0).max(23).default(18),
    threshold: z.number().min(0).max(1).default(0.90),
  }).optional(),
  nightMode: z.object({
    threshold: z.number().min(0).max(1).default(0.96),
  }).optional(),
  weeklyBudget: z.number().optional(),
  timezone: z.string().optional(),
});

export const IsolationConfigSchema = z.object({
  defaultMode: z.enum(['shared', 'worktree', 'container', 'full']).default('shared'),
  container: z.object({
    image: z.string().optional(),
    dockerfile: z.string().optional(),
    resourceLimits: z.object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
    }).optional(),
  }).optional(),
  worktree: z.object({
    basePath: z.string().default('.apex/worktrees'),
  }).optional(),
  cleanup: z.enum(['merge', 'cancel', 'never']).default('merge'),
});

export const IdleProcessingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  strategies: z.record(z.number().min(0).max(1)).optional(),
  minIdleTime: z.number().default(300000),
  maxTasksPerDay: z.number().default(5),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('low'),
});

export const SessionRecoveryConfigSchema = z.object({
  autoResume: z.boolean().default(true),
  maxResumeAttempts: z.number().default(3),
  resumeDelayMs: z.number().default(1000),
  summarizeContext: z.boolean().default(true),
});

// Extended DaemonConfig
export const DaemonConfigSchema = z.object({
  pollInterval: z.number().optional().default(5000),
  autoStart: z.boolean().optional().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  // NEW
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    intervalMs: z.number().default(60000),
  }).optional(),
  watchdog: z.object({
    enabled: z.boolean().default(true),
    restartOnFailure: z.boolean().default(true),
  }).optional(),
});

// Extended ApexConfig
export const ApexConfigSchema = z.object({
  // ... existing fields ...
  usage: UsageConfigSchema.optional(),
  isolation: IsolationConfigSchema.optional(),
  idleProcessing: IdleProcessingConfigSchema.optional(),
  sessionRecovery: SessionRecoveryConfigSchema.optional(),
});
```

---

## 10. Implementation Plan

### Phase 1: Core Daemon Enhancements (Week 1)

| Task | Priority | Files |
|------|----------|-------|
| Service installer (systemd/launchd) | High | `orchestrator/src/service-installer.ts` |
| Health monitoring & watchdog | High | `orchestrator/src/runner.ts` |
| Graceful shutdown improvements | Medium | `orchestrator/src/daemon.ts` |
| CLI: `install-service`, `daemon restart`, `daemon logs` | Medium | `cli/src/handlers/` |

### Phase 2: Usage Management (Week 1-2)

| Task | Priority | Files |
|------|----------|-------|
| UsageManager implementation | High | `orchestrator/src/usage-manager.ts` |
| Day/night mode logic | High | `orchestrator/src/usage-manager.ts` |
| Usage tracking in database | Medium | `orchestrator/src/store.ts` |
| DaemonRunner integration | High | `orchestrator/src/runner.ts` |
| Configuration schema | Medium | `core/src/types.ts` |

### Phase 3: Session Recovery (Week 2)

| Task | Priority | Files |
|------|----------|-------|
| SessionRecoveryManager | High | `orchestrator/src/session-recovery.ts` |
| Context summarization | High | `orchestrator/src/session-recovery.ts` |
| Checkpoint persistence | Medium | `orchestrator/src/store.ts` |
| Orchestrator integration | High | `orchestrator/src/index.ts` |
| Resume notification events | Medium | `orchestrator/src/index.ts` |

### Phase 4: Workspace Isolation (Week 2-3)

| Task | Priority | Files |
|------|----------|-------|
| WorktreeManager | High | `orchestrator/src/worktree-manager.ts` |
| ContainerManager | Medium | `orchestrator/src/container-manager.ts` |
| IsolationManager facade | High | `orchestrator/src/isolation-manager.ts` |
| Orchestrator integration | High | `orchestrator/src/index.ts` |
| CLI: `apex shell` | Low | `cli/src/handlers/` |

### Phase 5: Task Interaction Commands (Week 3)

| Task | Priority | Files |
|------|----------|-------|
| TaskInspector | High | `orchestrator/src/task-inspector.ts` |
| CLI: `inspect`, `diff` | High | `cli/src/handlers/inspect-handlers.ts` |
| CLI: `iterate` | Medium | `cli/src/handlers/iterate-handlers.ts` |
| CLI: `push`, `merge`, `checkout` | Medium | `cli/src/handlers/git-handlers.ts` |
| Iteration workflow | Medium | `.apex/workflows/iteration.yaml` |

### Phase 6: Idle Processing & Thoughts (Week 3-4)

| Task | Priority | Files |
|------|----------|-------|
| IdleScheduler | Medium | `orchestrator/src/idle-scheduler.ts` |
| Project analyzers | Medium | `orchestrator/src/analyzers/*.ts` |
| ThoughtManager | Medium | `orchestrator/src/thought-manager.ts` |
| CLI: `think`, `thoughts` | Medium | `cli/src/handlers/thought-handlers.ts` |

### Phase 7: Task Lifecycle & Polish (Week 4)

| Task | Priority | Files |
|------|----------|-------|
| TrashManager (soft delete) | Medium | `orchestrator/src/trash-manager.ts` |
| CLI: `trash`, `restore` | Medium | `cli/src/handlers/trash-handlers.ts` |
| Documentation updates | Medium | `docs/` |
| Integration tests | High | `**/src/__tests__/` |

---

## 11. Dependencies

### New Dependencies (Minimal)

```json
{
  "dependencies": {
    // For container management (optional)
    // None - use exec to call docker/podman CLI
  },
  "devDependencies": {
    // No new dev dependencies
  }
}
```

### System Requirements

- **Git 2.20+** - For worktree support
- **Docker or Podman** - For container isolation (optional)
- **systemd (Linux)** or **launchd (macOS)** - For service installation

---

## 12. Migration Strategy

### From v0.3.0 to v0.4.0

1. **Database Migration** - Auto-run on first startup:
   - Add new columns to `tasks` table
   - Create new tables (`usage_daily`, `thoughts`, `task_iterations`, `task_file_changes`)

2. **Configuration Migration** - Backward compatible:
   - New config sections are optional with sensible defaults
   - Existing configs work without modification

3. **Daemon Migration**:
   - Existing daemon PID files remain valid
   - New health checks are opt-in by default

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Container runtime not available | Medium | Graceful fallback to worktree or shared mode |
| Session recovery creates infinite loops | High | Max resume attempts, exponential backoff |
| Idle tasks consume too much budget | Medium | Daily cap, low priority, user opt-in |
| Worktree cleanup fails | Low | Manual cleanup command, periodic garbage collection |
| Service installation fails | Medium | Clear error messages, manual instructions |

---

## 14. Success Metrics

1. **Daemon Uptime** - Target: 99.9% uptime during configured hours
2. **Session Recovery Rate** - Target: 95% of paused tasks successfully resume
3. **Usage Optimization** - Night mode processes 50%+ more tasks than day mode
4. **Isolation Success** - Zero workspace conflicts in parallel execution
5. **User Satisfaction** - Positive feedback on new commands (`inspect`, `iterate`)

---

## References

- [ADR-051: Daemon Process Manager](./ADR-051-daemon-process-manager.md)
- [ADR-052: Daemon CLI Commands](./ADR-052-daemon-cli-commands.md)
- [ROADMAP.md - v0.4.0 Sleepless Mode & Autonomy](/ROADMAP.md)
- [sleepless-agent (Inspiration)](https://github.com/context-machine-lab/sleepless-agent)
- [Rover (Inspiration for Isolation)](https://github.com/endorhq/rover)
