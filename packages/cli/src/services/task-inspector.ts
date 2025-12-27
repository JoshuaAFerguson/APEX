import chalk from 'chalk';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskLog, TaskArtifact, TaskCheckpoint, formatDuration, formatTokens, formatCost } from '@apexcli/core';

export interface TaskInspectionOptions {
  files?: boolean;
  file?: string;
  timeline?: boolean;
  docs?: boolean;
  logs?: boolean;
  artifacts?: boolean;
  checkpoints?: boolean;
}

export class TaskInspector {
  constructor(private orchestrator: ApexOrchestrator) {}

  async inspectTask(taskId: string, options: TaskInspectionOptions = {}): Promise<void> {
    const task = await this.orchestrator.getTask(taskId);
    if (!task) {
      console.log(chalk.red(`Task not found: ${taskId}`));
      return;
    }

    // Default comprehensive view if no specific options
    if (Object.values(options).every(v => !v)) {
      await this.showComprehensiveView(task);
      return;
    }

    if (options.files) {
      await this.showModifiedFiles(task);
    } else if (options.file) {
      await this.showFileContent(task, options.file);
    } else if (options.timeline) {
      await this.showExecutionTimeline(task);
    } else if (options.docs) {
      await this.showGeneratedDocs(task);
    } else if (options.logs) {
      await this.showTaskLogs(task);
    } else if (options.artifacts) {
      await this.showTaskArtifacts(task);
    } else if (options.checkpoints) {
      await this.showTaskCheckpoints(task);
    }
  }

  private async showComprehensiveView(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n📋 Task Inspection: ${task.id}\n`));

    // Basic task info
    this.showTaskHeader(task);

    // Task details
    console.log(chalk.cyan.bold('\n📝 Details:\n'));
    console.log(`  Description: ${task.description}`);
    if (task.acceptanceCriteria) {
      console.log(`  Acceptance Criteria: ${task.acceptanceCriteria}`);
    }
    console.log(`  Workflow: ${task.workflow}`);
    console.log(`  Priority: ${task.priority}`);
    console.log(`  Effort: ${task.effort}`);
    console.log(`  Autonomy: ${task.autonomy}`);

    if (task.currentStage) {
      console.log(`  Current Stage: ${task.currentStage}`);
    }

    // Usage and cost
    console.log(chalk.cyan.bold('\n💰 Usage & Cost:\n'));
    console.log(`  Total Tokens: ${formatTokens(task.usage.totalTokens)}`);
    console.log(`  Input Tokens: ${formatTokens(task.usage.inputTokens)}`);
    console.log(`  Output Tokens: ${formatTokens(task.usage.outputTokens)}`);
    console.log(`  Estimated Cost: ${formatCost(task.usage.estimatedCost)}`);

    // Timestamps
    console.log(chalk.cyan.bold('\n⏱️  Timeline:\n'));
    console.log(`  Created: ${task.createdAt.toLocaleString()}`);
    console.log(`  Updated: ${task.updatedAt.toLocaleString()}`);
    if (task.completedAt) {
      console.log(`  Completed: ${task.completedAt.toLocaleString()}`);
      const duration = task.completedAt.getTime() - task.createdAt.getTime();
      console.log(`  Duration: ${formatDuration(duration)}`);
    }
    if (task.pausedAt) {
      console.log(`  Paused: ${task.pausedAt.toLocaleString()}`);
      if (task.pauseReason) {
        console.log(`  Pause Reason: ${task.pauseReason}`);
      }
    }

    // Dependencies and subtasks
    if (task.dependsOn?.length || task.blockedBy?.length || task.subtaskIds?.length || task.parentTaskId) {
      console.log(chalk.cyan.bold('\n🔗 Dependencies & Subtasks:\n'));

      if (task.dependsOn?.length) {
        console.log(`  Depends On: ${task.dependsOn.join(', ')}`);
      }
      if (task.blockedBy?.length) {
        console.log(`  Blocked By: ${task.blockedBy.join(', ')}`);
      }
      if (task.parentTaskId) {
        console.log(`  Parent Task: ${task.parentTaskId}`);
      }
      if (task.subtaskIds?.length) {
        console.log(`  Subtasks: ${task.subtaskIds.join(', ')}`);
        if (task.subtaskStrategy) {
          console.log(`  Subtask Strategy: ${task.subtaskStrategy}`);
        }
      }
    }

    // Git info
    if (task.branchName || task.prUrl) {
      console.log(chalk.cyan.bold('\n🌿 Git Info:\n'));
      if (task.branchName) {
        console.log(`  Branch: ${task.branchName}`);
      }
      if (task.prUrl) {
        console.log(`  Pull Request: ${task.prUrl}`);
      }
    }

    // Error info
    if (task.error) {
      console.log(chalk.red.bold('\n❌ Error:\n'));
      console.log(chalk.red(`  ${task.error}`));
    }

    // Show quick summary of artifacts and logs
    console.log(chalk.cyan.bold('\n📎 Quick Summary:\n'));
    console.log(`  Artifacts: ${task.artifacts?.length || 0} items`);
    console.log(`  Log Entries: ${task.logs?.length || 0} entries`);
    console.log(`  Retry Count: ${task.retryCount}/${task.maxRetries}`);
    console.log(`  Resume Attempts: ${task.resumeAttempts}`);

    console.log(chalk.gray('\n💡 Use specific options for detailed views:'));
    console.log(chalk.gray('  --files      Show modified files'));
    console.log(chalk.gray('  --timeline   Show execution timeline'));
    console.log(chalk.gray('  --logs       Show task logs'));
    console.log(chalk.gray('  --artifacts  Show task artifacts'));
    console.log(chalk.gray('  --docs       Show generated documentation\n'));
  }

  private showTaskHeader(task: Task): void {
    const statusEmoji = this.getStatusEmoji(task.status);
    const status = `${statusEmoji} ${task.status.toUpperCase()}`;

    console.log(`  ID: ${chalk.yellow(task.id)}`);
    console.log(`  Status: ${status}`);
    console.log(`  Project: ${task.projectPath}`);
  }

  private async showModifiedFiles(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n📁 Modified Files for Task: ${task.id}\n`));

    const artifacts = task.artifacts?.filter(a => a.type === 'file') || [];

    if (artifacts.length === 0) {
      console.log(chalk.gray('  No file modifications found.\n'));
      return;
    }

    artifacts.forEach(artifact => {
      if (artifact.path) {
        console.log(chalk.green(`  📄 ${artifact.path}`));
        console.log(chalk.gray(`      Modified: ${artifact.createdAt.toLocaleString()}`));
      }
    });

    console.log(chalk.cyan(`\n📊 Total: ${artifacts.length} files modified\n`));
  }

  private async showFileContent(task: Task, filePath: string): Promise<void> {
    console.log(chalk.cyan.bold(`\n📄 File Content: ${filePath}\n`));
    console.log(chalk.gray(`Task: ${task.id}\n`));

    const artifact = task.artifacts?.find(a => a.path === filePath);

    if (!artifact) {
      console.log(chalk.red(`File not found in task artifacts: ${filePath}\n`));
      return;
    }

    if (artifact.content) {
      console.log(chalk.gray('─'.repeat(60)));
      console.log(artifact.content);
      console.log(chalk.gray('─'.repeat(60)));
    } else {
      console.log(chalk.yellow('File content not available in artifacts.\n'));
    }
  }

  private async showExecutionTimeline(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n⏱️  Execution Timeline for Task: ${task.id}\n`));

    // Collect timeline events from logs and checkpoints
    const logs = await this.orchestrator.getTaskLogs(task.id);
    const checkpoints = await this.orchestrator.listCheckpoints(task.id);

    // Combine and sort by timestamp
    const events: Array<{ timestamp: Date; type: 'log' | 'checkpoint'; event: string; details?: string }> = [];

    logs.forEach(log => {
      let event = log.message;
      if (log.stage) event = `[${log.stage}] ${event}`;
      if (log.agent) event = `${log.agent}: ${event}`;

      events.push({
        timestamp: log.timestamp,
        type: 'log',
        event,
        details: log.level
      });
    });

    checkpoints.forEach(checkpoint => {
      events.push({
        timestamp: checkpoint.createdAt,
        type: 'checkpoint',
        event: `Checkpoint created: ${checkpoint.checkpointId}`,
        details: checkpoint.stage
      });
    });

    // Add task lifecycle events
    events.push({ timestamp: task.createdAt, type: 'log', event: 'Task created', details: 'info' });
    if (task.completedAt) {
      events.push({ timestamp: task.completedAt, type: 'log', event: 'Task completed', details: 'info' });
    }
    if (task.pausedAt) {
      events.push({ timestamp: task.pausedAt, type: 'log', event: `Task paused: ${task.pauseReason}`, details: 'warn' });
    }

    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (events.length === 0) {
      console.log(chalk.gray('  No timeline events found.\n'));
      return;
    }

    events.forEach(event => {
      const time = event.timestamp.toLocaleString();
      const typeIcon = event.type === 'checkpoint' ? '🏁' : this.getLevelEmoji(event.details);

      console.log(`  ${typeIcon} ${chalk.gray(time)} ${event.event}`);
      if (event.details && event.type === 'checkpoint') {
        console.log(chalk.gray(`      Stage: ${event.details}`));
      }
    });

    console.log(chalk.cyan(`\n📊 Total events: ${events.length}\n`));
  }

  private async showGeneratedDocs(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n📚 Generated Documentation for Task: ${task.id}\n`));

    const docArtifacts = task.artifacts?.filter(a =>
      a.type === 'report' ||
      a.name.includes('doc') ||
      a.name.includes('README') ||
      a.path?.includes('.md')
    ) || [];

    if (docArtifacts.length === 0) {
      console.log(chalk.gray('  No documentation artifacts found.\n'));
      return;
    }

    docArtifacts.forEach(artifact => {
      console.log(chalk.blue(`  📖 ${artifact.name}`));
      if (artifact.path) {
        console.log(chalk.gray(`      Path: ${artifact.path}`));
      }
      console.log(chalk.gray(`      Created: ${artifact.createdAt.toLocaleString()}`));
      if (artifact.content) {
        const lines = artifact.content.split('\n').length;
        console.log(chalk.gray(`      Content: ${lines} lines`));
      }
      console.log();
    });

    console.log(chalk.cyan(`📊 Total documentation artifacts: ${docArtifacts.length}\n`));
  }

  private async showTaskLogs(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n📝 Task Logs for: ${task.id}\n`));

    const logs = await this.orchestrator.getTaskLogs(task.id);

    if (logs.length === 0) {
      console.log(chalk.gray('  No logs found.\n'));
      return;
    }

    logs.forEach(log => {
      const time = log.timestamp.toLocaleString();
      const levelIcon = this.getLevelEmoji(log.level);
      const stage = log.stage ? chalk.blue(`[${log.stage}]`) : '';
      const agent = log.agent ? chalk.magenta(`{${log.agent}}`) : '';

      console.log(`  ${levelIcon} ${chalk.gray(time)} ${stage} ${agent} ${log.message}`);

      if (log.metadata && Object.keys(log.metadata).length > 0) {
        console.log(chalk.gray(`      Metadata: ${JSON.stringify(log.metadata)}`));
      }
    });

    console.log(chalk.cyan(`\n📊 Total log entries: ${logs.length}\n`));
  }

  private async showTaskArtifacts(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n📎 Task Artifacts for: ${task.id}\n`));

    const artifacts = task.artifacts || [];

    if (artifacts.length === 0) {
      console.log(chalk.gray('  No artifacts found.\n'));
      return;
    }

    // Group artifacts by type
    const groupedArtifacts = artifacts.reduce((acc, artifact) => {
      if (!acc[artifact.type]) acc[artifact.type] = [];
      acc[artifact.type].push(artifact);
      return acc;
    }, {} as Record<string, TaskArtifact[]>);

    Object.entries(groupedArtifacts).forEach(([type, typeArtifacts]) => {
      console.log(chalk.blue.bold(`  ${this.getArtifactTypeEmoji(type)} ${type.toUpperCase()} (${typeArtifacts.length}):`));

      typeArtifacts.forEach(artifact => {
        console.log(`    📄 ${artifact.name}`);
        if (artifact.path) {
          console.log(chalk.gray(`        Path: ${artifact.path}`));
        }
        console.log(chalk.gray(`        Created: ${artifact.createdAt.toLocaleString()}`));
        if (artifact.content) {
          const size = artifact.content.length;
          console.log(chalk.gray(`        Size: ${size} characters`));
        }
      });
      console.log();
    });

    console.log(chalk.cyan(`📊 Total artifacts: ${artifacts.length}\n`));
  }

  private async showTaskCheckpoints(task: Task): Promise<void> {
    console.log(chalk.cyan.bold(`\n🏁 Task Checkpoints for: ${task.id}\n`));

    const checkpoints = await this.orchestrator.listCheckpoints(task.id);

    if (checkpoints.length === 0) {
      console.log(chalk.gray('  No checkpoints found.\n'));
      return;
    }

    checkpoints.forEach((checkpoint, index) => {
      console.log(`  🏁 ${chalk.yellow(checkpoint.checkpointId)}`);
      console.log(`     Stage: ${checkpoint.stage || 'N/A'} (Index: ${checkpoint.stageIndex})`);
      console.log(`     Created: ${checkpoint.createdAt.toLocaleString()}`);

      if (checkpoint.conversationState?.length) {
        console.log(`     Conversation Messages: ${checkpoint.conversationState.length}`);
      }

      if (checkpoint.metadata && Object.keys(checkpoint.metadata).length > 0) {
        console.log(chalk.gray(`     Metadata: ${JSON.stringify(checkpoint.metadata)}`));
      }

      if (index < checkpoints.length - 1) console.log();
    });

    console.log(chalk.cyan(`\n📊 Total checkpoints: ${checkpoints.length}\n`));
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'paused': return '⏸️';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  }

  private getLevelEmoji(level?: string): string {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🔍';
      default: return '📝';
    }
  }

  private getArtifactTypeEmoji(type: string): string {
    switch (type) {
      case 'file': return '📄';
      case 'diff': return '📊';
      case 'report': return '📋';
      case 'log': return '📝';
      default: return '📎';
    }
  }
}