import { promises as fs } from 'fs';
import { EventEmitter } from 'eventemitter3';
import { join } from 'path';
import {
  Task,
  TaskSessionData,
  TaskCheckpoint,
  AgentMessage,
  DaemonConfig,
} from '@apexcli/core';

export interface SessionRecoveryOptions {
  projectPath: string;
  config: DaemonConfig;
}

export interface SessionSummary {
  conversationLength: number;
  keyDecisions: string[];
  currentContext: string;
  progressSummary: string;
}

export interface SessionManagerEvents {
  'session-recovered': (taskId: string) => void;
}

/**
 * Manages session recovery and continuity for long-running tasks
 */
export class SessionManager extends EventEmitter<SessionManagerEvents> {
  private projectPath: string;
  private config: DaemonConfig;
  private checkpointDir: string;

  constructor(options: SessionRecoveryOptions) {
    super();
    this.projectPath = options.projectPath;
    this.config = options.config;
    this.checkpointDir = join(this.projectPath, '.apex', 'checkpoints');
  }

  /**
   * Initialize session manager and ensure checkpoint directory exists
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.checkpointDir, { recursive: true });
  }

  /**
   * Create a checkpoint for a task
   */
  async createCheckpoint(
    task: Task,
    conversationHistory: AgentMessage[],
    stageState?: Record<string, unknown>
  ): Promise<TaskCheckpoint> {
    const checkpointId = `${task.id}-${Date.now()}`;
    const checkpoint: TaskCheckpoint = {
      taskId: task.id,
      checkpointId,
      stage: task.currentStage,
      stageIndex: this.getStageIndex(task),
      conversationState: conversationHistory,
      metadata: {
        status: task.status,
        usage: task.usage,
        stageState,
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date(),
    };

    // Save checkpoint to file
    const checkpointPath = join(this.checkpointDir, `${checkpointId}.json`);
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');

    // Update task session data
    await this.updateTaskSessionData(task, conversationHistory);

    return checkpoint;
  }

  /**
   * Restore session data for a task
   */
  async restoreSession(taskId: string): Promise<{
    checkpoint: TaskCheckpoint | null;
    sessionData: TaskSessionData | null;
    canResume: boolean;
  }> {
    try {
      // Find the latest checkpoint for this task
      const checkpoint = await this.getLatestCheckpoint(taskId);

      if (!checkpoint) {
        return { checkpoint: null, sessionData: null, canResume: false };
      }

      // Load session data
      const sessionData = await this.loadTaskSessionData(taskId);

      // Determine if task can be resumed
      const canResume = this.canResumeTask(checkpoint, sessionData);

      return { checkpoint, sessionData, canResume };
    } catch (error) {
      console.warn(`Failed to restore session for task ${taskId}:`, error);
      return { checkpoint: null, sessionData: null, canResume: false };
    }
  }

  /**
   * Auto-resume a task from its last checkpoint
   */
  async autoResumeTask(task: Task): Promise<{
    resumed: boolean;
    resumePoint?: {
      stage: string;
      conversationHistory: AgentMessage[];
      stageState?: Record<string, unknown>;
    };
  }> {
    if (!this.config.sessionRecovery?.autoResume) {
      return { resumed: false };
    }

    const { checkpoint, sessionData, canResume } = await this.restoreSession(task.id);

    if (!canResume || !checkpoint || !sessionData) {
      return { resumed: false };
    }

    // Restore conversation history and state
    const resumePoint = {
      stage: checkpoint.stage || task.currentStage || '',
      conversationHistory: checkpoint.conversationState || [],
      stageState: checkpoint.metadata?.stageState as Record<string, unknown> | undefined,
    };

    this.emit('session-recovered', task.id);

    return { resumed: true, resumePoint };
  }

  /**
   * Summarize conversation context when it gets too long
   */
  async summarizeContext(conversationHistory: AgentMessage[]): Promise<SessionSummary> {
    const threshold = this.config.sessionRecovery?.contextSummarizationThreshold || 50;

    if (conversationHistory.length <= threshold) {
      return {
        conversationLength: conversationHistory.length,
        keyDecisions: [],
        currentContext: 'Conversation is within normal length',
        progressSummary: 'No summarization needed',
      };
    }

    // Extract key information from conversation
    const keyDecisions: string[] = [];
    const importantMessages = conversationHistory
      .filter((msg) => msg.type === 'assistant')
      .slice(-Math.min(10, conversationHistory.length))
      .map((msg) => {
        const textContent = msg.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join(' ');

        // Look for decision-making keywords
        if (
          textContent.includes('decided') ||
          textContent.includes('chosen') ||
          textContent.includes('implemented') ||
          textContent.includes('completed')
        ) {
          keyDecisions.push(textContent.substring(0, 200) + '...');
        }

        return textContent;
      });

    const currentContext = importantMessages.slice(-3).join('\n\n');
    const progressSummary = `Conversation has ${conversationHistory.length} messages. ${keyDecisions.length} key decisions identified.`;

    return {
      conversationLength: conversationHistory.length,
      keyDecisions: keyDecisions.slice(0, 5), // Keep top 5 decisions
      currentContext: currentContext.substring(0, 1000), // Limit context size
      progressSummary,
    };
  }

  /**
   * Clean up old checkpoints
   */
  async cleanupCheckpoints(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.checkpointDir, file);
        const stat = await fs.stat(filePath);

        if (now - stat.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup checkpoints:', error);
    }
  }

  /**
   * Get checkpoint statistics
   */
  async getCheckpointStats(): Promise<{
    totalCheckpoints: number;
    checkpointsByTask: Record<string, number>;
    oldestCheckpoint?: Date;
    newestCheckpoint?: Date;
    diskUsage: number;
  }> {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const checkpointsByTask: Record<string, number> = {};
      let oldestCheckpoint: Date | undefined;
      let newestCheckpoint: Date | undefined;
      let diskUsage = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.checkpointDir, file);
        const stat = await fs.stat(filePath);
        diskUsage += stat.size;

        // Update oldest/newest
        if (!oldestCheckpoint || stat.mtime < oldestCheckpoint) {
          oldestCheckpoint = stat.mtime;
        }
        if (!newestCheckpoint || stat.mtime > newestCheckpoint) {
          newestCheckpoint = stat.mtime;
        }

        // Extract task ID from filename
        const taskId = file.split('-')[0];
        checkpointsByTask[taskId] = (checkpointsByTask[taskId] || 0) + 1;
      }

      return {
        totalCheckpoints: files.filter(f => f.endsWith('.json')).length,
        checkpointsByTask,
        oldestCheckpoint,
        newestCheckpoint,
        diskUsage,
      };
    } catch (error) {
      console.warn('Failed to get checkpoint stats:', error);
      return {
        totalCheckpoints: 0,
        checkpointsByTask: {},
        diskUsage: 0,
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getLatestCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const taskCheckpoints = files
        .filter(file => file.startsWith(taskId) && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      if (taskCheckpoints.length === 0) {
        return null;
      }

      const latestCheckpointFile = taskCheckpoints[0];
      const checkpointPath = join(this.checkpointDir, latestCheckpointFile);
      const checkpointData = await fs.readFile(checkpointPath, 'utf-8');

      const checkpoint = JSON.parse(checkpointData) as TaskCheckpoint;

      // Convert date strings back to Date objects
      checkpoint.createdAt = new Date(checkpoint.createdAt);

      return checkpoint;
    } catch (error) {
      console.warn(`Failed to load checkpoint for task ${taskId}:`, error);
      return null;
    }
  }

  private async updateTaskSessionData(
    task: Task,
    conversationHistory: AgentMessage[]
  ): Promise<void> {
    const sessionSummary = await this.summarizeContext(conversationHistory);

    const sessionData: TaskSessionData = {
      lastCheckpoint: new Date(),
      contextSummary: sessionSummary.currentContext,
      conversationHistory: conversationHistory.slice(-20), // Keep last 20 messages
      stageState: {}, // Will be populated by specific stage implementations
      resumePoint: {
        stage: task.currentStage || '',
        stepIndex: this.getStageIndex(task),
        metadata: {
          progressSummary: sessionSummary.progressSummary,
          keyDecisions: sessionSummary.keyDecisions,
        },
      },
    };

    // Save session data (this would typically be stored in the database)
    const sessionPath = join(this.checkpointDir, `${task.id}-session.json`);
    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
  }

  private async loadTaskSessionData(taskId: string): Promise<TaskSessionData | null> {
    try {
      const sessionPath = join(this.checkpointDir, `${taskId}-session.json`);
      const sessionData = await fs.readFile(sessionPath, 'utf-8');

      const session = JSON.parse(sessionData) as TaskSessionData;

      // Convert date strings back to Date objects
      session.lastCheckpoint = new Date(session.lastCheckpoint);

      return session;
    } catch (error) {
      return null;
    }
  }

  private canResumeTask(
    checkpoint: TaskCheckpoint,
    sessionData: TaskSessionData | null
  ): boolean {
    if (!this.config.sessionRecovery?.enabled) {
      return false;
    }

    // Check if checkpoint is recent enough (within last 24 hours by default)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const checkpointAge = Date.now() - checkpoint.createdAt.getTime();

    if (checkpointAge > maxAge) {
      return false;
    }

    // Check if we have valid conversation state
    if (!checkpoint.conversationState || checkpoint.conversationState.length === 0) {
      return false;
    }

    // Check if stage information is available
    if (!checkpoint.stage) {
      return false;
    }

    return true;
  }

  private getStageIndex(task: Task): number {
    // This would typically be determined by the workflow definition
    // For now, return a default value
    return 0;
  }
}
