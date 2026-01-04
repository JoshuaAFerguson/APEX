import { EventEmitter } from 'events';
import type {
  Task,
  TaskUsage,
  ApprovalGate,
  AutonomyLevel,
  AutonomyLimits,
  ApexOrchestrator
} from '@apexcli/core';

export interface AutonomyEnforcerConfig {
  /** Autonomy level setting */
  level: AutonomyLevel;
  /** Approval gates configuration */
  gates: ApprovalGate[];
  /** Resource and operational limits */
  limits: AutonomyLimits;
  /** Warning thresholds as percentages */
  warningThresholds: {
    costWarningPercent: number;
    tokenWarningPercent: number;
    timeWarningPercent: number;
    fileWarningPercent: number;
  };
}

export interface TaskContext {
  task: Task;
  currentStage?: string;
  agent?: string;
  operationType?: 'read' | 'write' | 'execute' | 'network' | 'dangerous';
}

export interface LimitCheckResult {
  exceeded: boolean;
  limitType?: 'tokens' | 'cost' | 'time' | 'files' | 'lines' | 'turns';
  currentValue?: number;
  limitValue?: number;
  message?: string;
}

export interface WarningResult {
  type: 'tokens' | 'cost' | 'time' | 'files';
  threshold: number;
  currentValue: number;
  limitValue: number;
  message: string;
}

export interface AutonomyEnforcerEvents {
  'limit:warning': (warning: WarningResult) => void;
  'limit:exceeded': (result: LimitCheckResult, task: Task) => void;
  'approval:required': (gateName: string, context: TaskContext) => void;
  'approval:bypass': (gateName: string, reason: string) => void;
}

declare interface AutonomyEnforcer {
  on<U extends keyof AutonomyEnforcerEvents>(
    event: U,
    listener: AutonomyEnforcerEvents[U]
  ): this;

  emit<U extends keyof AutonomyEnforcerEvents>(
    event: U,
    ...args: Parameters<AutonomyEnforcerEvents[U]>
  ): boolean;
}

/**
 * AutonomyEnforcer manages resource limits, approval gates, and safety controls
 * Implements the policy enforcement and resource tracking for autonomous operation
 */
class AutonomyEnforcer extends EventEmitter {
  private config: AutonomyEnforcerConfig;
  private orchestrator: ApexOrchestrator;
  private taskUsageMap = new Map<string, TaskUsage>();
  private taskStartTimes = new Map<string, Date>();

  constructor(config: AutonomyEnforcerConfig, orchestrator: ApexOrchestrator) {
    super();
    this.config = config;
    this.orchestrator = orchestrator;

    // Track task usage updates
    this.setupUsageTracking();
  }

  /**
   * Check if an action requires approval based on autonomy level and gates
   */
  async checkApprovalRequired(action: string, context: TaskContext): Promise<boolean> {
    const { level, gates } = this.config;

    // Full autonomy - no approvals needed unless specifically gated
    if (level === 'full-auto') {
      return this.checkSpecificGates(action, context, gates);
    }

    // Review before commit - requires approval for commit operations
    if (level === 'review-before-commit') {
      const commitActions = ['git-commit', 'git-push', 'deploy', 'publish'];
      if (commitActions.some(commitAction => action.includes(commitAction))) {
        this.emit('approval:required', 'before-commit', context);
        return true;
      }
      return this.checkSpecificGates(action, context, gates);
    }

    // Review all - requires approval for everything except reads
    if (level === 'review-all') {
      if (context.operationType === 'read') {
        return false; // Allow read operations without approval
      }
      this.emit('approval:required', 'review-all', context);
      return true;
    }

    return false;
  }

  /**
   * Check specific approval gates
   */
  private checkSpecificGates(action: string, context: TaskContext, gates: ApprovalGate[]): boolean {
    for (const gate of gates) {
      if (this.matchesGateCondition(action, context, gate)) {
        this.emit('approval:required', gate.type, context);
        return true;
      }
    }
    return false;
  }

  /**
   * Check if action matches gate condition
   */
  private matchesGateCondition(action: string, context: TaskContext, gate: ApprovalGate): boolean {
    switch (gate.type) {
      case 'before-commit':
        return ['git-commit', 'git-push'].some(cmd => action.includes(cmd));

      case 'before-destructive':
        return context.operationType === 'dangerous' ||
               ['delete', 'remove', 'rm', 'drop'].some(keyword => action.includes(keyword));

      case 'before-network':
        return context.operationType === 'network' ||
               ['http', 'fetch', 'download', 'upload'].some(keyword => action.includes(keyword));

      case 'before-file-write':
        return context.operationType === 'write' ||
               ['write', 'edit', 'create', 'save'].some(keyword => action.includes(keyword));

      default:
        return false;
    }
  }

  /**
   * Check if any resource limits are exceeded
   */
  checkLimits(taskId: string): LimitCheckResult {
    const usage = this.taskUsageMap.get(taskId);
    const startTime = this.taskStartTimes.get(taskId);

    if (!usage) {
      return { exceeded: false };
    }

    const { limits } = this.config;

    // Check token limit
    if (limits.maxTokensPerTask && usage.totalTokens > limits.maxTokensPerTask) {
      return {
        exceeded: true,
        limitType: 'tokens',
        currentValue: usage.totalTokens,
        limitValue: limits.maxTokensPerTask,
        message: `Token limit exceeded: ${usage.totalTokens} > ${limits.maxTokensPerTask}`,
      };
    }

    // Check cost limit
    if (limits.maxCostPerTask && usage.estimatedCost > limits.maxCostPerTask) {
      return {
        exceeded: true,
        limitType: 'cost',
        currentValue: usage.estimatedCost,
        limitValue: limits.maxCostPerTask,
        message: `Cost limit exceeded: $${usage.estimatedCost.toFixed(2)} > $${limits.maxCostPerTask.toFixed(2)}`,
      };
    }

    // Check time limit
    if (limits.maxTimePerTaskMs && startTime) {
      const elapsed = Date.now() - startTime.getTime();
      if (elapsed > limits.maxTimePerTaskMs) {
        return {
          exceeded: true,
          limitType: 'time',
          currentValue: elapsed,
          limitValue: limits.maxTimePerTaskMs,
          message: `Time limit exceeded: ${Math.round(elapsed / 1000)}s > ${Math.round(limits.maxTimePerTaskMs / 1000)}s`,
        };
      }
    }

    // Additional limits could be checked here (files modified, lines changed, turns)

    return { exceeded: false };
  }

  /**
   * Record resource usage for a task
   */
  recordUsage(taskId: string, usage: Partial<TaskUsage>): void {
    const existingUsage = this.taskUsageMap.get(taskId) || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };

    const newUsage = {
      inputTokens: existingUsage.inputTokens + (usage.inputTokens || 0),
      outputTokens: existingUsage.outputTokens + (usage.outputTokens || 0),
      totalTokens: existingUsage.totalTokens + (usage.totalTokens || 0),
      estimatedCost: existingUsage.estimatedCost + (usage.estimatedCost || 0),
    };

    this.taskUsageMap.set(taskId, newUsage);

    // Check for warnings
    this.checkWarningThresholds(taskId, newUsage);

    // Check for limit violations
    const limitCheck = this.checkLimits(taskId);
    if (limitCheck.exceeded) {
      const task = this.orchestrator.store.getTask(taskId);
      if (task) {
        this.emit('limit:exceeded', limitCheck, task);
      }
    }
  }

  /**
   * Check if usage is approaching warning thresholds
   */
  checkWarningThresholds(taskId: string, usage: TaskUsage): WarningResult[] {
    const warnings: WarningResult[] = [];
    const { limits, warningThresholds } = this.config;

    // Token warning
    if (limits.maxTokensPerTask && usage.totalTokens > 0) {
      const tokenPercent = (usage.totalTokens / limits.maxTokensPerTask) * 100;
      if (tokenPercent >= warningThresholds.tokenWarningPercent) {
        const warning: WarningResult = {
          type: 'tokens',
          threshold: warningThresholds.tokenWarningPercent,
          currentValue: usage.totalTokens,
          limitValue: limits.maxTokensPerTask,
          message: `Token usage at ${tokenPercent.toFixed(1)}% of limit`,
        };
        warnings.push(warning);
        this.emit('limit:warning', warning);
      }
    }

    // Cost warning
    if (limits.maxCostPerTask && usage.estimatedCost > 0) {
      const costPercent = (usage.estimatedCost / limits.maxCostPerTask) * 100;
      if (costPercent >= warningThresholds.costWarningPercent) {
        const warning: WarningResult = {
          type: 'cost',
          threshold: warningThresholds.costWarningPercent,
          currentValue: usage.estimatedCost,
          limitValue: limits.maxCostPerTask,
          message: `Cost usage at ${costPercent.toFixed(1)}% of limit`,
        };
        warnings.push(warning);
        this.emit('limit:warning', warning);
      }
    }

    // Time warning
    const startTime = this.taskStartTimes.get(taskId);
    if (limits.maxTimePerTaskMs && startTime) {
      const elapsed = Date.now() - startTime.getTime();
      const timePercent = (elapsed / limits.maxTimePerTaskMs) * 100;
      if (timePercent >= warningThresholds.timeWarningPercent) {
        const warning: WarningResult = {
          type: 'time',
          threshold: warningThresholds.timeWarningPercent,
          currentValue: elapsed,
          limitValue: limits.maxTimePerTaskMs,
          message: `Time usage at ${timePercent.toFixed(1)}% of limit`,
        };
        warnings.push(warning);
        this.emit('limit:warning', warning);
      }
    }

    return warnings;
  }

  /**
   * Start tracking a task
   */
  startTracking(taskId: string): void {
    this.taskStartTimes.set(taskId, new Date());
    this.taskUsageMap.set(taskId, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    });
  }

  /**
   * Stop tracking a task and clean up
   */
  stopTracking(taskId: string): void {
    this.taskStartTimes.delete(taskId);
    this.taskUsageMap.delete(taskId);
  }

  /**
   * Get current usage for a task
   */
  getTaskUsage(taskId: string): TaskUsage | undefined {
    return this.taskUsageMap.get(taskId);
  }

  /**
   * Get elapsed time for a task
   */
  getElapsedTime(taskId: string): number | undefined {
    const startTime = this.taskStartTimes.get(taskId);
    return startTime ? Date.now() - startTime.getTime() : undefined;
  }

  /**
   * Update autonomy configuration
   */
  updateConfig(newConfig: Partial<AutonomyEnforcerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Setup usage tracking from orchestrator events
   */
  private setupUsageTracking(): void {
    this.orchestrator.on('task:started', (task: Task) => {
      this.startTracking(task.id);
    });

    this.orchestrator.on('task:completed', (task: Task) => {
      this.stopTracking(task.id);
    });

    this.orchestrator.on('task:failed', (task: Task) => {
      this.stopTracking(task.id);
    });

    this.orchestrator.on('usage:updated', (taskId: string, usage: TaskUsage) => {
      this.recordUsage(taskId, usage);
    });
  }
}

export { AutonomyEnforcer };