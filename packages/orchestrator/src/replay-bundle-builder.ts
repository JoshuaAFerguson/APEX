import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * A captured event in a replay bundle
 */
export interface ReplayEvent {
  timestamp: string;
  type: string;
  data: unknown;
}

/**
 * A tool call captured during execution
 */
export interface ReplayCapturedToolCall {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  isError: boolean;
  startTime: string;
  endTime?: string;
}

/**
 * Complete replay bundle for task execution
 */
export interface ReplayBundle {
  version: string;
  taskId: string;
  taskDescription: string;
  workflow: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  events: ReplayEvent[];
  toolCalls: ReplayCapturedToolCall[];
  stageResults: Record<string, unknown>;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  metadata: {
    projectPath: string;
    branchName?: string;
    agentModels: Record<string, string>;
    totalTokens: number;
    estimatedCost: number;
  };
}

/**
 * Builds replay bundles from task execution events.
 * Subscribes to orchestrator events, captures tool calls, diffs, and messages.
 * On task completion, saves to .apex/replays/{taskId}.json.gz
 */
export class ReplayBundleBuilder {
  private events: ReplayEvent[] = [];
  private toolCalls: ReplayCapturedToolCall[] = [];
  private messages: Array<{ role: string; content: string; timestamp: string }> = [];
  private stageResults: Record<string, unknown> = {};
  private startedAt: Date;
  private taskId: string;
  private taskDescription: string;
  private workflow: string;
  private projectPath: string;
  private branchName?: string;

  constructor(options: {
    taskId: string;
    taskDescription: string;
    workflow: string;
    projectPath: string;
    branchName?: string;
  }) {
    this.taskId = options.taskId;
    this.taskDescription = options.taskDescription;
    this.workflow = options.workflow;
    this.projectPath = options.projectPath;
    this.branchName = options.branchName;
    this.startedAt = new Date();
  }

  /**
   * Record an event
   */
  recordEvent(type: string, data: unknown): void {
    this.events.push({
      timestamp: new Date().toISOString(),
      type,
      data,
    });
  }

  /**
   * Record a tool call start
   */
  recordToolCallStart(id: string, name: string, input: unknown): void {
    this.toolCalls.push({
      id,
      name,
      input,
      isError: false,
      startTime: new Date().toISOString(),
    });
  }

  /**
   * Record a tool call completion
   */
  recordToolCallComplete(id: string, output: unknown, isError: boolean): void {
    const call = this.toolCalls.find(c => c.id === id);
    if (call) {
      call.output = output;
      call.isError = isError;
      call.endTime = new Date().toISOString();
    }
  }

  /**
   * Record a message
   */
  recordMessage(role: string, content: string): void {
    this.messages.push({
      role,
      content: content.substring(0, 10000), // Limit message size
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a stage result
   */
  recordStageResult(stageName: string, result: unknown): void {
    this.stageResults[stageName] = result;
  }

  /**
   * Build and save the replay bundle
   */
  async finalize(options: {
    totalTokens: number;
    estimatedCost: number;
    agentModels: Record<string, string>;
  }): Promise<string> {
    const completedAt = new Date();

    const bundle: ReplayBundle = {
      version: '1.0.0',
      taskId: this.taskId,
      taskDescription: this.taskDescription,
      workflow: this.workflow,
      startedAt: this.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration: completedAt.getTime() - this.startedAt.getTime(),
      events: this.events,
      toolCalls: this.toolCalls,
      stageResults: this.stageResults,
      messages: this.messages,
      metadata: {
        projectPath: this.projectPath,
        branchName: this.branchName,
        agentModels: options.agentModels,
        totalTokens: options.totalTokens,
        estimatedCost: options.estimatedCost,
      },
    };

    // Save to .apex/replays/{taskId}.json.gz
    const replayDir = path.join(this.projectPath, '.apex', 'replays');
    if (!fs.existsSync(replayDir)) {
      fs.mkdirSync(replayDir, { recursive: true });
    }

    const filePath = path.join(replayDir, `${this.taskId}.json.gz`);
    const jsonData = JSON.stringify(bundle, null, 2);
    const compressed = zlib.gzipSync(Buffer.from(jsonData));
    fs.writeFileSync(filePath, compressed);

    return filePath;
  }
}
